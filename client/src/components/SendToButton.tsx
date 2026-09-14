import React from "react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Send, ArrowRight, MessageSquare, Zap, Brain, FileEdit, BookOpen, Target, Shield, Calculator, Languages, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { dispatchOutput, OUTPUT_DESTINATIONS, OutputDestination } from "@/lib/outputRouting";

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
  variant = "outline", 
  size = "sm",
  className = ""
}) => {
  const { toast } = useToast();

  const handleSendTo = (destination: OutputDestination) => {
    dispatchOutput(destination, text, "SendToButton");
    toast({
      title: `Sent to ${destination}`,
      description: `The output is now ready as input for ${destination}.`
    });
  };

  const icons: Record<OutputDestination, React.ElementType> = {
    Writing: FileEdit, "Intelligence Analysis": Brain, Humanizer: Zap,
    "Text Model Validator": BookOpen, BOTTOMLINE: Target, Objections: Shield,
    "Whole-Document Coherence": ArrowRight, "Mathematical Analysis": Calculator,
    "Case Assessment": FileEdit, "Fiction Assessment": MessageSquare, "AI Chat": MessageSquare,
    Translation: Languages, "Web Search/Rewrite": Search,
  };

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
         {OUTPUT_DESTINATIONS.map((label) => (
          <DropdownMenuItem
            key={label}
            onClick={() => handleSendTo(label)}
            className="cursor-pointer"
          >
             {React.createElement(icons[label], { className: "h-4 w-4 mr-2" })}
             {label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default SendToButton;