import type { Express, Request, Response } from "express";
import { stripe, CREDIT_PACKAGES, type Provider, type PriceTier, hasUnlimitedCredits } from "../lib/stripe-config";
import { storage } from "../storage";
import { z } from "zod";
import type Stripe from "stripe";
import { db } from "../db";
import { sql } from "drizzle-orm";

const checkoutSchema = z.object({
  provider: z.enum(["openai", "anthropic", "perplexity", "deepseek"]),
  amount: z.union([z.literal(5), z.literal(10), z.literal(25), z.literal(50), z.literal(100)]),
});

function getSignedInUser(req: Request, res: Response) {
  if (!req.user) {
    res.status(401).json({ message: "Sign in to manage a subscription" });
    return null;
  }
  return req.user;
}

function stripeId(value: string | { id: string } | null): string | null {
  return typeof value === "string" ? value : value?.id || null;
}

function periodEnd(subscription: Stripe.Subscription): Date | null {
  const timestamp = subscription.items.data.reduce(
    (latest, item) => Math.max(latest, item.current_period_end || 0),
    0,
  );
  return timestamp ? new Date(timestamp * 1000) : null;
}

async function persistSubscription(subscription: Stripe.Subscription) {
  const customerId = stripeId(subscription.customer);
  if (!customerId) return;

  const metadataUserId = Number(subscription.metadata?.userId);
  const user = Number.isInteger(metadataUserId) && metadataUserId > 0
    ? await storage.getUser(metadataUserId)
    : await storage.getUserByStripeCustomerId(customerId);
  if (!user) {
    console.warn(`No user found for Stripe customer ${customerId}`);
    return;
  }

  await storage.updateUserSubscription(user.id, {
    stripeCustomerId: customerId,
    stripeSubscriptionId: subscription.id,
    subscriptionStatus: subscription.status,
    subscriptionCurrentPeriodEnd: periodEnd(subscription),
  });
}

const TERMINAL_SUBSCRIPTION_STATUSES = new Set<Stripe.Subscription.Status>([
  "canceled",
  "incomplete_expired",
]);

async function reconcileCustomerSubscription(customerId: string) {
  if (!stripe) return null;
  const subscriptions = await stripe.subscriptions.list({
    customer: customerId,
    status: "all",
    limit: 20,
  });
  const selected = subscriptions.data
    .sort((a, b) => {
      const aTerminal = TERMINAL_SUBSCRIPTION_STATUSES.has(a.status) ? 1 : 0;
      const bTerminal = TERMINAL_SUBSCRIPTION_STATUSES.has(b.status) ? 1 : 0;
      return aTerminal - bTerminal || b.created - a.created;
    })[0];
  if (selected) await persistSubscription(selected);
  return selected || null;
}

export function registerPaymentRoutes(app: Express) {
  app.post("/api/payments/subscribe", async (req: Request, res: Response) => {
    try {
      if (!stripe || !process.env.STRIPE_PRICE_ID) {
        return res.status(503).json({ message: "Stripe subscription is not configured" });
      }
      const stripeClient = stripe;

      const user = getSignedInUser(req, res);
      if (!user) return;
      const forwardedProto = req.get("x-forwarded-proto")?.split(",")[0];
      const protocol = forwardedProto || req.protocol;
      const baseUrl = `${protocol}://${req.get("host")}`;

      const session = await db.transaction(async (tx) => {
        await tx.execute(sql`SELECT pg_advisory_xact_lock(${user.id})`);
        const currentUser = await storage.getUser(user.id);
        if (!currentUser) throw new Error("Signed-in user no longer exists");

        const legacySubscription = await storage.getUserSubscription(currentUser.id, currentUser.email);
        const knownStatus = currentUser.subscriptionStatus || legacySubscription?.status || null;
        if (
          knownStatus &&
          !TERMINAL_SUBSCRIPTION_STATUSES.has(knownStatus as Stripe.Subscription.Status)
        ) {
          const error = new Error("This account already has a subscription. Use Manage Billing to update it.");
          (error as any).statusCode = 409;
          throw error;
        }
        let customerId = currentUser.stripeCustomerId || legacySubscription?.stripeCustomerId || null;
        if (!currentUser.stripeCustomerId && customerId) {
          await storage.updateUserSubscription(currentUser.id, {
            stripeCustomerId: customerId,
            stripeSubscriptionId: legacySubscription?.stripeSubscriptionId || null,
            subscriptionStatus: legacySubscription?.status || null,
          });
        }
        if (!customerId) {
          const customer = await stripeClient.customers.create({
            email: currentUser.email || undefined,
            metadata: { userId: String(currentUser.id) },
          });
          customerId = customer.id;
          await storage.updateUserSubscription(currentUser.id, { stripeCustomerId: customerId });
        }

        const existingSubscription = await reconcileCustomerSubscription(customerId);
        if (existingSubscription && !TERMINAL_SUBSCRIPTION_STATUSES.has(existingSubscription.status)) {
          const error = new Error("This account already has a subscription. Use Manage Billing to update it.");
          (error as any).statusCode = 409;
          throw error;
        }

        const openSessions = await stripeClient.checkout.sessions.list({
          customer: customerId,
          status: "open",
          limit: 20,
        });
        const existingSession = openSessions.data.find(
          (candidate) =>
            candidate.mode === "subscription" &&
            candidate.metadata?.purchaseType === "model-wiz-subscription" &&
            Boolean(candidate.url),
        );
        if (existingSession) return existingSession;

        return stripeClient.checkout.sessions.create({
          mode: "subscription",
          line_items: [{ price: process.env.STRIPE_PRICE_ID!, quantity: 1 }],
          success_url: `${baseUrl}/?payment=success&session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${baseUrl}/?payment=cancelled`,
          client_reference_id: String(currentUser.id),
          customer: customerId,
          metadata: {
            userId: String(currentUser.id),
            purchaseType: "model-wiz-subscription",
          },
          subscription_data: {
            metadata: {
              userId: String(currentUser.id),
              purchaseType: "model-wiz-subscription",
            },
          },
        });
      });

      return res.json({ url: session.url });
    } catch (error: any) {
      console.error("Subscription checkout error:", error);
      return res.status(error.statusCode || 500).json({
        message: "Unable to start subscription checkout",
        error: error.message,
      });
    }
  });

  app.get("/api/payments/subscription", async (req: Request, res: Response) => {
    if (!req.user) {
      return res.json({
        status: null,
        active: false,
        canManage: false,
        canSubscribe: false,
        currentPeriodEnd: null,
      });
    }
    const user = req.user;

    const currentUser = await storage.getUser(user.id);
    const legacySubscription = await storage.getUserSubscription(user.id, user.email);
    const status = currentUser?.subscriptionStatus || legacySubscription?.status || null;
    const customerId = currentUser?.stripeCustomerId || legacySubscription?.stripeCustomerId || null;
    const subscriptionId = currentUser?.stripeSubscriptionId || legacySubscription?.stripeSubscriptionId || null;

    return res.json({
      status,
      active: status === "active" || status === "trialing",
      canManage: Boolean(customerId && subscriptionId),
      canSubscribe:
        !subscriptionId ||
        status === "canceled" ||
        status === "incomplete_expired",
      currentPeriodEnd: currentUser?.subscriptionCurrentPeriodEnd || null,
    });
  });

  app.get("/api/payments/subscription-status", async (req: Request, res: Response) => {
    if (!req.user) {
      return res.json({ subscribed: false, status: "none" });
    }

    const currentUser = await storage.getUser(req.user.id);
    const legacySubscription = await storage.getUserSubscription(req.user.id, req.user.email);
    const status = currentUser?.subscriptionStatus || legacySubscription?.status || "none";
    return res.json({
      subscribed: status === "active" || status === "trialing",
      status,
    });
  });

  app.post("/api/payments/portal", async (req: Request, res: Response) => {
    try {
      if (!stripe) {
        return res.status(503).json({ message: "Stripe billing is not configured" });
      }
      const user = getSignedInUser(req, res);
      if (!user) return;
      const currentUser = await storage.getUser(user.id);
      const legacySubscription = await storage.getUserSubscription(user.id, user.email);
      const customerId = currentUser?.stripeCustomerId || legacySubscription?.stripeCustomerId;
      if (!customerId) {
        return res.status(400).json({ message: "No Stripe billing account is linked to this user" });
      }

      const forwardedProto = req.get("x-forwarded-proto")?.split(",")[0];
      const baseUrl = `${forwardedProto || req.protocol}://${req.get("host")}`;
      const session = await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: baseUrl,
      });
      return res.json({ url: session.url });
    } catch (error: any) {
      console.error("Billing portal error:", error);
      return res.status(500).json({ message: "Unable to open billing settings" });
    }
  });

  // Create Stripe Checkout Session
  app.post("/api/payments/checkout", async (req: Request, res: Response) => {
    try {
      const user = getSignedInUser(req, res);
      if (!user) return;

      // Check if user has unlimited credits (JMK)
      if (hasUnlimitedCredits(user.username)) {
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
        userId: user.id,
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
        client_reference_id: String(user.id),
        metadata: {
          userId: String(user.id),
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

    if (
      event.type === "checkout.session.completed" &&
      event.data.object.metadata?.purchaseType === "model-wiz-subscription"
    ) {
      try {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = Number(session.metadata?.userId || session.client_reference_id);
        const customerId = stripeId(session.customer);
        const subscriptionId = stripeId(session.subscription);
        if (Number.isInteger(userId) && userId > 0 && customerId) {
          await storage.updateUserSubscription(userId, {
            stripeCustomerId: customerId,
            stripeSubscriptionId: subscriptionId,
          });
        }
        if (customerId) await reconcileCustomerSubscription(customerId);
      } catch (error) {
        console.error("Error linking subscription checkout:", error);
        return res.status(500).json({ message: "Unable to link subscription" });
      }
    }

    if (event.type === "customer.subscription.created" || event.type === "customer.subscription.updated") {
      try {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = stripeId(subscription.customer);
        if (customerId) await reconcileCustomerSubscription(customerId);
      } catch (error) {
        console.error("Error updating subscription:", error);
        return res.status(500).json({ message: "Unable to update subscription" });
      }
    }

    if (event.type === "customer.subscription.deleted") {
      try {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = stripeId(subscription.customer);
        if (customerId) await reconcileCustomerSubscription(customerId);
      } catch (error) {
        console.error("Error canceling subscription:", error);
        return res.status(500).json({ message: "Unable to cancel subscription" });
      }
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
      if (!req.user) {
        return res.json({
          openai: 0,
          anthropic: 0,
          perplexity: 0,
          deepseek: 0,
          unlimited: false,
        });
      }
      const user = await storage.getUser(req.user.id);
      if (!user) return res.status(401).json({ message: "Sign in required" });

      // Check for unlimited credits
      if (
        hasUnlimitedCredits(user.username)
        || user.subscriptionStatus === "active"
        || user.subscriptionStatus === "trialing"
      ) {
        return res.json({
          openai: 0,
          anthropic: 0,
          perplexity: 0,
          deepseek: 0,
          unlimited: true,
        });
      }

      const credits = await storage.getAllUserCredits(user.id);
      
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
