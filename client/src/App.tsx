import { Switch, Route, Link } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import HomePage from "@/pages/HomePage";
import TranslationPage from "@/pages/TranslationPage";

import WebSearchPage from "@/pages/WebSearchPage";

import { AnalyticsPage } from "@/pages/AnalyticsPage";
import NotFound from "@/pages/not-found";
import DiagnosticPage from "@/pages/DiagnosticPage";
import { BrainCircuit, Brain, Mail, Trash2, Activity } from "lucide-react";
import { useState, createContext, useContext } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CreditBalance } from "@/components/CreditBalance";
import zhiLogo from "@assets/zhi_logoc_1788019705241.png";

// Reset Context
interface ResetContextType {
  resetAll: () => void;
}

const ResetContext = createContext<ResetContextType | null>(null);

export function useReset() {
  const context = useContext(ResetContext);
  if (!context) {
    throw new Error("useReset must be used within a ResetProvider");
  }
  return context;
}

function ResetConfirmDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { resetAll } = useReset();

  const handleReset = () => {
    resetAll();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reset All Data</DialogTitle>
          <DialogDescription>
            This will clear all your current input and analysis results. You'll start completely fresh. This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <div className="flex gap-3 justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-reset">
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleReset} data-testid="button-confirm-reset">
            <Trash2 className="h-4 w-4 mr-2" />
            Reset All
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Navigation() {
  const [resetDialogOpen, setResetDialogOpen] = useState(false);

  return (
    <nav className="bg-primary text-primary-foreground py-4">
      <div className="container mx-auto flex justify-between items-center">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <a
              href="https://zhisystems.ai/"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Visit ZHI Systems"
              data-testid="link-zhi-logo"
              className="shrink-0 rounded-md bg-white p-1 shadow-sm ring-1 ring-white/50 transition-transform hover:scale-105"
            >
              <img src={zhiLogo} alt="ZHI Systems logo" className="h-8 w-8 object-contain" />
            </a>
            <div className="font-bold text-xl">Cognitive Analysis Platform</div>
          </div>
          <a 
            href="mailto:johnmichaelkuczynski@gmail.com" 
            className="flex items-center gap-2 hover:underline text-sm"
            data-testid="link-contact-us"
          >
            <Mail className="h-4 w-4" />
            <span>Contact Us</span>
          </a>
        </div>
        <div className="flex items-center gap-6">
          <ul className="flex gap-6">
            <li>
              <Link href="/" className="flex items-center gap-2 hover:underline">
                <BrainCircuit className="h-5 w-5" />
                <span>Intelligence Analysis</span>
              </Link>
            </li>
            <li>
              <Link href="/analytics" className="flex items-center gap-2 hover:underline">
                <Brain className="h-5 w-5" />
                <span>Cognitive Analytics</span>
              </Link>
            </li>
            <li>
              <Link href="/diagnostic" className="flex items-center gap-2 hover:underline" data-testid="link-diagnostic">
                <Activity className="h-5 w-5" />
                <span>Diagnostic</span>
              </Link>
            </li>
          </ul>
          
          <div className="flex items-center gap-3">
            <div className="bg-primary-foreground/10 px-3 py-1.5 rounded-md">
              <CreditBalance />
            </div>
            
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => setResetDialogOpen(true)}
              className="text-primary-foreground hover:bg-primary-foreground/10"
              data-testid="button-reset-all"
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Reset All
            </Button>
            
          </div>
        </div>
      </div>
      
      <ResetConfirmDialog open={resetDialogOpen} onOpenChange={setResetDialogOpen} />
    </nav>
  );
}

function Router({ resetKey }: { resetKey: number }) {
  return (
    <>
      <Navigation />
      <Switch key={resetKey}>
        <Route path="/" component={HomePage} />
        <Route path="/analytics" component={AnalyticsPage} />
        <Route path="/diagnostic" component={DiagnosticPage} />

        <Route component={NotFound} />
      </Switch>
    </>
  );
}

function App() {
  const [resetKey, setResetKey] = useState(0);

  const resetAll = () => {
    // Clear app-specific localStorage (preserve auth and theme)
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('cap:')) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));
    
    // Remount Router to reset all component state
    setResetKey(prev => prev + 1);
  };

  return (
    <QueryClientProvider client={queryClient}>
      <ResetContext.Provider value={{ resetAll }}>
        <TooltipProvider>
          <Toaster />
          <Router resetKey={resetKey} />
        </TooltipProvider>
      </ResetContext.Provider>
    </QueryClientProvider>
  );
}

export default App;
