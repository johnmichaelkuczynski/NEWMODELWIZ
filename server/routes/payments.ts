import type { Express, Request, Response } from "express";
import { stripe, CREDIT_PACKAGES, type Provider, type PriceTier, hasUnlimitedCredits } from "../lib/stripe-config";
import { storage } from "../storage";
import { z } from "zod";

const checkoutSchema = z.object({
  provider: z.enum(["openai", "anthropic", "perplexity", "deepseek"]),
  amount: z.union([z.literal(5), z.literal(10), z.literal(25), z.literal(50), z.literal(100)]),
});

async function getPublicUser() {
  const username = "public";
  const existing = await storage.getUserByUsername(username);
  if (existing) return existing;

  return storage.createUser({
    username,
    password: "unused-public-account",
    email: "public@cognitive.platform",
  });
}

export function registerPaymentRoutes(app: Express) {
  app.post("/api/payments/subscribe", async (req: Request, res: Response) => {
    try {
      if (!stripe || !process.env.STRIPE_PRICE_ID) {
        return res.status(503).json({ message: "Stripe subscription is not configured" });
      }

      const user = req.user || await getPublicUser();
      const forwardedProto = req.get("x-forwarded-proto")?.split(",")[0];
      const protocol = forwardedProto || req.protocol;
      const baseUrl = `${protocol}://${req.get("host")}`;

      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        line_items: [{ price: process.env.STRIPE_PRICE_ID, quantity: 1 }],
        success_url: `${baseUrl}/?payment=success&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${baseUrl}/?payment=cancelled`,
        client_reference_id: String(user.id),
        customer_email: user.email || undefined,
        metadata: {
          userId: String(user.id),
          purchaseType: "model-wiz-subscription",
        },
        subscription_data: {
          metadata: {
            userId: String(user.id),
            purchaseType: "model-wiz-subscription",
          },
        },
      });

      return res.json({ url: session.url });
    } catch (error: any) {
      console.error("Subscription checkout error:", error);
      return res.status(500).json({
        message: "Unable to start subscription checkout",
        error: error.message,
      });
    }
  });

  // Create Stripe Checkout Session
  app.post("/api/payments/checkout", async (req: Request, res: Response) => {
    try {
      const publicUser = await getPublicUser();

      // Check if user has unlimited credits (JMK)
      if (hasUnlimitedCredits(publicUser.username)) {
        return res.status(400).json({ 
          message: "You have unlimited credits and don't need to purchase more" 
        });
      }

      const validation = checkoutSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ 
          message: "Invalid request", 
          errors: validation.error.errors 
        });
      }

      const { provider, amount } = validation.data;
      const packageInfo = CREDIT_PACKAGES[provider as Provider][amount as PriceTier];

      // Create pending transaction
      const transaction = await storage.createCreditTransaction({
        userId: publicUser.id,
        provider,
        amount: packageInfo.priceInCents,
        credits: packageInfo.credits,
        transactionType: "purchase",
        status: "pending",
        metadata: { package: `${provider}-${amount}` },
      });

      if (!stripe) {
        return res.status(503).json({ message: "Payment service not configured" });
      }

      // Create Stripe Checkout Session
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        line_items: [
          {
            price_data: {
              currency: "usd",
              product_data: {
                name: `${provider.toUpperCase()} Credits - $${amount}`,
                description: `${packageInfo.credits.toLocaleString()} word credits for ${provider}`,
              },
              unit_amount: packageInfo.priceInCents,
            },
            quantity: 1,
          },
        ],
        mode: "payment",
        success_url: `${process.env.REPLIT_DEV_DOMAIN || 'http://localhost:5000'}?payment=success&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.REPLIT_DEV_DOMAIN || 'http://localhost:5000'}?payment=cancelled`,
        client_reference_id: String(publicUser.id),
        metadata: {
          userId: String(publicUser.id),
          provider,
          credits: String(packageInfo.credits),
          transactionId: String(transaction.id),
        },
      });

      // Update transaction with Stripe session ID
      await storage.updateCreditTransactionSessionId(transaction.id, session.id);

      res.json({ sessionId: session.id, url: session.url });
    } catch (error: any) {
      console.error("Checkout error:", error);
      res.status(500).json({ message: "Error creating checkout session", error: error.message });
    }
  });

  // Stripe Webhook Handler
  app.post("/api/payments/webhook", async (req: Request, res: Response) => {
    const sig = req.headers["stripe-signature"];
    
    if (!sig) {
      return res.status(400).send("No signature");
    }

    let event: any;

    try {
      if (!stripe) {
        return res.status(503).send("Payment service not configured");
      }
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET!
      );
    } catch (err: any) {
      console.error("Webhook signature verification failed:", err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle the checkout.session.completed event
    if (
      event.type === "checkout.session.completed" &&
      event.data.object.metadata?.purchaseType !== "model-wiz-subscription"
    ) {
      const session = event.data.object;
      
      try {
        const userId = parseInt(session.metadata.userId);
        const provider = session.metadata.provider;
        const credits = parseInt(session.metadata.credits);
        const transactionId = parseInt(session.metadata.transactionId);

        // Get current credits or initialize
        let userCredits = await storage.getUserCredits(userId, provider);
        if (!userCredits) {
          userCredits = await storage.initializeUserCredits(userId, provider);
        }

        // Add purchased credits
        await storage.updateUserCredits(
          userId,
          provider,
          userCredits.credits + credits
        );

        // Update transaction status
        await storage.updateCreditTransactionStatus(
          transactionId,
          "completed",
          session.payment_intent as string
        );

        console.log(`✅ Credits added: ${credits} ${provider} credits for user ${userId}`);
      } catch (error) {
        console.error("Error processing webhook:", error);
      }
    }

    res.json({ received: true });
  });

  // Get user credit balances
  app.get("/api/credits/balance", async (req: Request, res: Response) => {
    try {
      const publicUser = await getPublicUser();

      // Check for unlimited credits
      if (hasUnlimitedCredits(publicUser.username)) {
        return res.json({
          openai: 0,
          anthropic: 0,
          perplexity: 0,
          deepseek: 0,
          unlimited: true,
        });
      }

      const credits = await storage.getAllUserCredits(publicUser.id);
      
      const balance = {
        openai: 0,
        anthropic: 0,
        perplexity: 0,
        deepseek: 0,
        unlimited: false,
      };

      credits.forEach((credit) => {
        if (credit.provider in balance) {
          balance[credit.provider as Provider] = credit.credits;
        }
      });

      res.json(balance);
    } catch (error: any) {
      console.error("Error fetching balance:", error);
      res.status(500).json({ message: "Error fetching credit balance" });
    }
  });
}
