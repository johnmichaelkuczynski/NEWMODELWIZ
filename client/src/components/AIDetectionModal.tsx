import React from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose, DialogFooter } from "@/components/ui/dialog";
import { AIDetectionResult } from "@/lib/types";
import { Check, Bot, X } from "lucide-react";

interface AIDetectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  result?: AIDetectionResult;
  isLoading: boolean;
}

const AIDetectionModal: React.FC<AIDetectionModalProps> = ({
  isOpen,
  onClose,
  result,
  isLoading,
}) => {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md" aria-describedby="ai-detection-modal-description">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-gray-800">AI Detection Results</DialogTitle>
          <DialogClose className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </DialogClose>
        </DialogHeader>
        
        <div className="mb-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-10 w-10 border-4 border-blue-500 border-t-transparent"></div>
            </div>
          ) : result ? (
            <div>
              <div className="text-center mb-6">
                <div className={`inline-flex items-center justify-center w-16 h-16 rounded-full mb-2 ${
                  result.isAI ? "bg-red-100 text-red-500" : "bg-green-100 text-green-500"
                }`}>
                  {result.isAI ? (
                    <Bot className="h-8 w-8" />
                  ) : (
                    <Check className="h-8 w-8" />
                  )}
                </div>
                <h3 className="text-lg font-semibold">
                  {result.isAI ? "Likely AI" : "Unlikely AI"}
                </h3>
              </div>
              
              <div className="bg-gray-100 p-4 rounded-md mb-4">
                <div className="mb-2">
                  <label className="text-sm text-gray-600 block mb-1">AI Probability</label>
                  <div className="w-full bg-gray-300 rounded-full h-4">
                    <div 
                      className="bg-blue-600 h-4 rounded-full" 
                      style={{ width: `${result.probability}%` }}
                    ></div>
                  </div>
                </div>
                <div className="flex justify-between text-sm text-gray-600">
                  <span>Human-written</span>
                  <span>{result.probability}%</span>
                  <span>AI-generated</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-4 text-gray-500">
              No AI detection results available
            </div>
          )}
        </div>
        
        <DialogFooter>
          <Button onClick={onClose}>OK</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AIDetectionModal;
