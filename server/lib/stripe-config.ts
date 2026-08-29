import Stripe from "stripe";

let stripe: Stripe | null = null;

if (process.env.STRIPE_SECRET_KEY) {
  stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: "2025-09-30.clover",
  });
} else {
  console.warn("WARNING: STRIPE_SECRET_KEY missing - payment features disabled");
}

export { stripe };

// Price schedule for credit packages
export const CREDIT_PACKAGES = {
  openai: {
    5: { credits: 4_275_000, priceInCents: 500 },
    10: { credits: 8_977_500, priceInCents: 1000 },
    25: { credits: 23_512_500, priceInCents: 2500 },
    50: { credits: 51_300_000, priceInCents: 5000 },
    100: { credits: 115_425_000, priceInCents: 10000 },
  },
  anthropic: {
    5: { credits: 106_840, priceInCents: 500 },
    10: { credits: 224_360, priceInCents: 1000 },
    25: { credits: 587_625, priceInCents: 2500 },
    50: { credits: 1_282_100, priceInCents: 5000 },
    100: { credits: 2_883_400, priceInCents: 10000 },
  },
  perplexity: {
    5: { credits: 702_000, priceInCents: 500 },
    10: { credits: 1_474_200, priceInCents: 1000 },
    25: { credits: 3_861_000, priceInCents: 2500 },
    50: { credits: 8_424_000, priceInCents: 5000 },
    100: { credits: 18_954_000, priceInCents: 10000 },
  },
  deepseek: {
    5: { credits: 6_410_255, priceInCents: 500 },
    10: { credits: 13_461_530, priceInCents: 1000 },
    25: { credits: 35_256_400, priceInCents: 2500 },
    50: { credits: 76_923_050, priceInCents: 5000 },
    100: { credits: 173_176_900, priceInCents: 10000 },
  },
} as const;

export type Provider = keyof typeof CREDIT_PACKAGES;
export type PriceTier = keyof typeof CREDIT_PACKAGES.openai;

// Public access is unlimited while account-based access is disabled.
export function hasUnlimitedCredits(username: string | undefined): boolean {
  if (!username) return false;
  const normalized = username.toLowerCase();
  return normalized === "public" || normalized === "jmk" || normalized === "jmkuczynski";
}

// Calculate word count for credit deduction
export function calculateWordCount(text: string): number {
  return text.trim().split(/\s+/).filter(word => word.length > 0).length;
}
