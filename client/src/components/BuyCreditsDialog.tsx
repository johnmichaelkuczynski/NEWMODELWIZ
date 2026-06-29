import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { loadStripe } from "@stripe/stripe-js";

const stripePublishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
const stripePromise = stripePublishableKey ? loadStripe(stripePublishableKey) : null;

interface BuyCreditsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const PROVIDERS = [
  { id: "openai", name: "ZHI 1", packages: { 5: "4.3M", 10: "9M", 25: "23.5M", 50: "51.3M", 100: "115.4M" } },
  { id: "anthropic", name: "ZHI 2", packages: { 5: "107K", 10: "224K", 25: "588K", 50: "1.3M", 100: "2.9M" } },
  { id: "deepseek", name: "ZHI 3", packages: { 5: "6.4M", 10: "13.5M", 25: "35.3M", 50: "76.9M", 100: "173.2M" } },
  { id: "perplexity", name: "ZHI 4", packages: { 5: "702K", 10: "1.5M", 25: "3.9M", 50: "8.4M", 100: "19M" } },
];

const PRICE_TIERS = [5, 10, 25, 50, 100];

export function BuyCreditsDialog({ open, onOpenChange }: BuyCreditsDialogProps) {
  const [provider, setProvider] = useState("openai");
  const [amount, setAmount] = useState(5);
  const { toast } = useToast();

  const checkoutMutation = useMutation({
    mutationFn: async ({ provider, amount }: { provider: string; amount: number }) => {
      const response = await apiRequest("POST", "/api/payments/checkout", { provider, amount });
      return await response.json();
    },
    onSuccess: async (data) => {
      const stripe = await stripePromise;
      if (!stripe) {
        toast({ title: "Error", description: "Stripe failed to load", variant: "destructive" });
        return;
      }
      
      // Save current state to localStorage before redirect
      const currentState = {
        timestamp: Date.now(),
        provider,
        amount,
      };
      localStorage.setItem("cap:pending-purchase", JSON.stringify(currentState));
      
      // Redirect to Stripe Checkout using the checkout URL
      window.location.href = data.url;
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create checkout session",
        variant: "destructive",
      });
    },
  });

  const selectedProvider = PROVIDERS.find(p => p.id === provider);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Buy Credits</DialogTitle>
          <DialogDescription>
            Purchase word credits for AI analysis. Credits are specific to each AI provider.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <div className="space-y-3">
            <Label>Select AI Provider</Label>
            <RadioGroup value={provider} onValueChange={setProvider}>
              {PROVIDERS.map((p) => (
                <div key={p.id} className="flex items-center space-x-2">
                  <RadioGroupItem value={p.id} id={p.id} data-testid={`radio-provider-${p.id}`} />
                  <Label htmlFor={p.id} className="cursor-pointer">
                    {p.name}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          <div className="space-y-3">
            <Label>Select Package</Label>
            <div className="grid grid-cols-5 gap-3">
              {PRICE_TIERS.map((tier) => (
                <Card
                  key={tier}
                  className={`p-4 cursor-pointer transition-all ${
                    amount === tier
                      ? "border-primary border-2 bg-primary/5"
                      : "hover:border-gray-400"
                  }`}
                  onClick={() => setAmount(tier)}
                  data-testid={`card-tier-${tier}`}
                >
                  <div className="text-center">
                    <div className="text-2xl font-bold">${tier}</div>
                    <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      {selectedProvider?.packages[tier as keyof typeof selectedProvider.packages]} words
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>

          <Button
            onClick={() => {
              if (!stripePromise) {
                toast({
                  title: "Payments unavailable",
                  description: "Stripe is not configured for this app.",
                  variant: "destructive",
                });
                return;
              }
              checkoutMutation.mutate({ provider, amount });
            }}
            disabled={checkoutMutation.isPending}
            className="w-full"
            data-testid="button-checkout"
          >
            {checkoutMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Purchase ${amount} Package
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
