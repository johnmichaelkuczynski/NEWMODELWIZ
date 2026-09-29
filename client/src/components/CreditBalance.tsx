import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { CreditCard, Settings } from "lucide-react";
import { useState } from "react";
import { BuyCreditsDialog } from "./BuyCreditsDialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";

interface CreditBalanceData {
  openai: number;
  anthropic: number;
  perplexity: number;
  deepseek: number;
  unlimited: boolean;
}

interface SubscriptionData {
  status: string | null;
  active: boolean;
  canManage: boolean;
  canSubscribe: boolean;
  currentPeriodEnd: string | null;
}
interface AccessStatus {
  tier: "anonymous" | "free" | "subscriber";
  unlimited: boolean;
  actionsRemaining: number | null;
  wordsRemaining: number | null;
}

export function CreditBalance() {
  const [showBuyDialog, setShowBuyDialog] = useState(false);
  const [isStartingSubscription, setIsStartingSubscription] = useState(false);
  const [isOpeningPortal, setIsOpeningPortal] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
  
  const { data: credits } = useQuery<CreditBalanceData>({
    queryKey: ["/api/credits/balance"],
    refetchInterval: 30000, // Refetch every 30 seconds
  });
  const { data: subscription } = useQuery<SubscriptionData>({
    queryKey: ["/api/payments/subscription"],
    retry: false,
  });
  const { data: access } = useQuery<AccessStatus>({
    queryKey: ["/api/access/status"],
    refetchInterval: 30000,
  });

  if (!credits) return null;

  const formatCredits = (amount: number) => {
    if (amount === Number.POSITIVE_INFINITY) return "∞";
    if (amount >= 1000000) return `${(amount / 1000000).toFixed(1)}M`;
    if (amount >= 1000) return `${(amount / 1000).toFixed(1)}K`;
    return amount.toString();
  };

  const startSubscriptionCheckout = async () => {
    setIsStartingSubscription(true);
    try {
      const response = await fetch("/api/payments/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await response.json();
      if (!response.ok || !data.url) {
        throw new Error(data.message || "Unable to open Stripe Checkout");
      }
      window.location.href = data.url;
    } catch (error: any) {
      toast({
        title: "Payment unavailable",
        description: error.message || "Unable to open Stripe Checkout",
        variant: "destructive",
      });
      setIsStartingSubscription(false);
    }
  };

  const openBillingPortal = async () => {
    setIsOpeningPortal(true);
    try {
      const response = await fetch("/api/payments/portal", { method: "POST" });
      const data = await response.json();
      if (!response.ok || !data.url) {
        throw new Error(data.message || "Unable to open billing settings");
      }
      window.location.href = data.url;
    } catch (error: any) {
      toast({
        title: "Billing unavailable",
        description: error.message || "Unable to open billing settings",
        variant: "destructive",
      });
      setIsOpeningPortal(false);
    }
  };

  return (
    <>
      <div className="flex items-center gap-3" data-testid="credit-balance-container">
        {access && !access.unlimited && window.location.pathname !== "/" && (
          <div className="text-sm font-medium whitespace-nowrap" data-testid="free-access-remaining">
            {access.tier === "anonymous" ? "Preview" : "Free"}: {access.actionsRemaining} actions · {formatCredits(access.wordsRemaining || 0)} words
          </div>
        )}
        <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 dark:bg-gray-800 rounded-lg">
          <CreditCard className="h-4 w-4 text-gray-600 dark:text-gray-400" />
          <div className="flex gap-3 text-sm font-medium">
            <span className="text-gray-700 dark:text-gray-300" data-testid="openai-credits">
              ZHI 1: {credits.unlimited ? "∞" : formatCredits(credits.openai)}
            </span>
            <span className="text-gray-700 dark:text-gray-300" data-testid="anthropic-credits">
              ZHI 2: {credits.unlimited ? "∞" : formatCredits(credits.anthropic)}
            </span>
            <span className="text-gray-700 dark:text-gray-300" data-testid="deepseek-credits">
              ZHI 3: {credits.unlimited ? "∞" : formatCredits(credits.deepseek)}
            </span>
            <span className="text-gray-700 dark:text-gray-300" data-testid="perplexity-credits">
              ZHI 4: {credits.unlimited ? "∞" : formatCredits(credits.perplexity)}
            </span>
          </div>
        </div>
        
        {user && !credits.unlimited && (
          <Button
            size="sm"
            onClick={() => setShowBuyDialog(true)}
            className="gap-2"
            data-testid="button-buy-credits"
          >
            <CreditCard className="h-4 w-4" />
            Buy Credits
          </Button>
        )}
        {subscription?.canManage && (
          <Button
            size="sm"
            variant="secondary"
            onClick={openBillingPortal}
            disabled={isOpeningPortal}
            className="gap-2 whitespace-nowrap"
            data-testid="button-manage-billing"
          >
            <Settings className="h-4 w-4" />
            {isOpeningPortal
              ? "Opening Billing..."
              : subscription.status === "past_due"
                ? "Payment Past Due · Manage Billing"
                : subscription.active
                  ? "Unlimited Use · Manage Billing"
                  : "Subscription Canceled · Manage Billing"}
          </Button>
        )}
        {user && (subscription?.canSubscribe ?? true) && (
          <Button
            size="sm"
            variant="secondary"
            onClick={startSubscriptionCheckout}
            disabled={isStartingSubscription}
            className="gap-2 whitespace-nowrap"
            data-testid="button-subscribe"
          >
            <CreditCard className="h-4 w-4" />
            {isStartingSubscription ? "Opening Checkout..." : "Unlimited Use · $29.95/mo"}
          </Button>
        )}
      </div>

      <BuyCreditsDialog open={showBuyDialog} onOpenChange={setShowBuyDialog} />
    </>
  );
}
