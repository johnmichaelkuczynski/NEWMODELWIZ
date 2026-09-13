import React from "react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Send, ArrowRight, MessageSquare, Zap, Brain, FileEdit, BookOpen, Target, Shield, Calculator } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface SendToButtonProps {
  text: string;
  onSendToHumanizer?: (text: string) => void;
  onSendToIntelligence?: (text: string) => void;
  onSendToChat?: (text: string) => void;
  onSendToValidator?: (text: string) => void;
  variant?: "default" | "secondary" | "outline" | "ghost";
  size?: "default" | "sm" | "lg";
  className?: string;
}

export const SendToButton: React.FC<SendToButtonProps> = ({ 
  text, 
  onSendToHumanizer,
  onSendToIntelligence,
  onSendToChat,
  onSendToValidator,
  variant = "outline", 
  size = "sm",
  className = ""
}) => {
  const { toast } = useToast();

  const handleSendTo = (destination: string, callback?: (text: string) => void) => {
    if (callback) {
      callback(text);
    }
    window.dispatchEvent(new CustomEvent("treatise:send-output", {
      detail: { destination, text },
    }));
    toast({
      title: `Sent to ${destination}`,
      description: `The output is now ready as input for ${destination}.`
    });
  };

  const destinations = [
    { label: "Writing", icon: FileEdit },
    { label: "Intelligence Analysis", icon: Brain, callback: onSendToIntelligence },
    { label: "Humanizer", icon: Zap, callback: onSendToHumanizer },
    { label: "Text Model Validator", icon: BookOpen, callback: onSendToValidator },
    { label: "BOTTOMLINE", icon: Target },
    { label: "Objections", icon: Shield },
    { label: "Whole-Document Coherence", icon: ArrowRight },
    { label: "Mathematical Analysis", icon: Calculator },
    { label: "Case Assessment", icon: FileEdit },
    { label: "Fiction Assessment", icon: MessageSquare },
    { label: "AI Chat", icon: MessageSquare, callback: onSendToChat },
  ];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={variant} size={size} className={`gap-2 ${className}`}>
          <Send className="h-4 w-4" />
          Send To
          <ArrowRight className="h-3 w-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        {destinations.map((dest) => (
          <DropdownMenuItem
            key={dest.label}
            onClick={() => handleSendTo(dest.label, dest.callback)}
            className="cursor-pointer"
          >
            <dest.icon className="h-4 w-4 mr-2" />
            {dest.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default SendToButton;