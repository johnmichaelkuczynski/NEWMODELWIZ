import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { CreditCard } from "lucide-react";
import { useState } from "react";
import { BuyCreditsDialog } from "./BuyCreditsDialog";

interface CreditBalanceData {
  openai: number;
  anthropic: number;
  perplexity: number;
  deepseek: number;
  unlimited: boolean;
}

export function CreditBalance() {
  const [showBuyDialog, setShowBuyDialog] = useState(false);
  
  const { data: credits } = useQuery<CreditBalanceData>({
    queryKey: ["/api/credits/balance"],
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  if (!credits) return null;

  const formatCredits = (amount: number) => {
    if (amount === Number.POSITIVE_INFINITY) return "∞";
    if (amount >= 1000000) return `${(amount / 1000000).toFixed(1)}M`;
    if (amount >= 1000) return `${(amount / 1000).toFixed(1)}K`;
    return amount.toString();
  };

  return (
    <>
      <div className="flex items-center gap-3" data-testid="credit-balance-container">
        <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 dark:bg-gray-800 rounded-lg">
          <CreditCard className="h-4 w-4 text-gray-600 dark:text-gray-400" />
          <div className="flex gap-3 text-sm font-medium">
            <span className="text-gray-700 dark:text-gray-300" data-testid="openai-credits">
              ZHI 1: {formatCredits(credits.openai)}
            </span>
            <span className="text-gray-700 dark:text-gray-300" data-testid="anthropic-credits">
              ZHI 2: {formatCredits(credits.anthropic)}
            </span>
            <span className="text-gray-700 dark:text-gray-300" data-testid="deepseek-credits">
              ZHI 3: {formatCredits(credits.deepseek)}
            </span>
            <span className="text-gray-700 dark:text-gray-300" data-testid="perplexity-credits">
              ZHI 4: {formatCredits(credits.perplexity)}
            </span>
          </div>
        </div>
        
        {!credits.unlimited && (
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
      </div>

      <BuyCreditsDialog open={showBuyDialog} onOpenChange={setShowBuyDialog} />
    </>
  );
}
