import React from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { BrainCircuit, Bot, Sparkles, Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export type LLMProvider = "zhi1" | "zhi2" | "zhi3" | "zhi4" | "zhi5" | "all";

interface ProviderSelectorProps {
  selectedProvider: LLMProvider;
  onProviderChange: (provider: LLMProvider) => void;
  className?: string;
  label?: string;
  smallSize?: boolean;
  apiStatus?: Record<string, boolean>;
  showTooltips?: boolean;
}

const ProviderSelector: React.FC<ProviderSelectorProps> = ({
  selectedProvider,
  onProviderChange,
  className = "",
  label = "AI Provider",
  smallSize = false,
  apiStatus = { openai: true, anthropic: true, perplexity: true },
  showTooltips = true
}) => {
  return (
    <div className={`flex ${smallSize ? "flex-row items-center gap-2" : "flex-col gap-1.5"} ${className}`}>
      <div className="flex items-center gap-2">
        {label && <Label className={smallSize ? "min-w-24" : ""}>{label}</Label>}
        {showTooltips && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-4 w-4 text-gray-400 cursor-help" />
              </TooltipTrigger>
              <TooltipContent className="max-w-sm">
                <p>Choose which ZHI model to use for document analysis:</p>
                <ul className="list-disc pl-5 mt-2 text-sm">
                  <li><span className="font-medium">ZHI 1</span> - Excellent for detailed analysis, strong at recognizing complex patterns</li>
                  <li><span className="font-medium">ZHI 2</span> - Very good at nuanced text interpretation and detailed reasoning</li>
                  <li><span className="font-medium">ZHI 3</span> - Strong analytical capabilities with efficient processing</li>
                  <li><span className="font-medium">ZHI 4</span> - Advanced search-augmented model with strong research capabilities</li>
                  <li><span className="font-medium">ZHI 5</span> - High-performance model for complex reasoning tasks</li>
                </ul>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
      <Select value={selectedProvider} onValueChange={(value) => onProviderChange(value as LLMProvider)}>
        <SelectTrigger className={`${smallSize ? "h-8" : ""} min-w-[220px]`}>
          <SelectValue placeholder="Select AI provider" />
        </SelectTrigger>
        <SelectContent>
          {apiStatus.openai && (
            <SelectItem 
              value="zhi1" 
              className="flex items-center"
            >
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-green-600" />
                <span>ZHI 1</span>
              </div>
            </SelectItem>
          )}
          {apiStatus.anthropic && (
            <SelectItem 
              value="zhi2" 
              className="flex items-center"
            >
              <div className="flex items-center gap-2">
                <BrainCircuit className="h-4 w-4 text-purple-600" />
                <span>ZHI 2</span>
              </div>
            </SelectItem>
          )}
          {apiStatus.deepseek && (
            <SelectItem 
              value="zhi3" 
              className="flex items-center"
            >
              <div className="flex items-center gap-2">
                <Bot className="h-4 w-4 text-orange-600" />
                <span>ZHI 3</span>
              </div>
            </SelectItem>
          )}
          {apiStatus.perplexity && (
            <SelectItem 
              value="zhi4" 
              className="flex items-center"
            >
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-teal-600" />
                <span>ZHI 4</span>
              </div>
            </SelectItem>
          )}
          {apiStatus.grok && (
            <SelectItem 
              value="zhi5" 
              className="flex items-center"
            >
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-blue-600" />
                <span>ZHI 5</span>
              </div>
            </SelectItem>
          )}
          {/* Compare Providers option temporarily removed */}
        </SelectContent>
      </Select>
    </div>
  );
};

export default ProviderSelector;