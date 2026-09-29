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
import { BrainCircuit, Brain, Mail, Trash2, Activity, LogIn, LogOut, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { CreditBalance } from "@/components/CreditBalance";
import { PENDING_OUTPUT_KEY } from "@/lib/outputRouting";
import zhiLogo from "@assets/zhi_logoc_1788019705241.png";
import { trackEvent } from "@/lib/analytics";
import { AuthProvider, useAuth } from "@/hooks/use-auth";

function clearPage() {
  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith("cap:")) keysToRemove.push(key);
  }
  keysToRemove.forEach(key => localStorage.removeItem(key));
  localStorage.removeItem("activeCoherenceAnalysisJob");
  localStorage.removeItem("textToDownload");
  sessionStorage.removeItem(PENDING_OUTPUT_KEY);
  trackEvent("app_reset_completed");
  window.location.replace("/");
}

function Navigation() {
  const [visitorCount, setVisitorCount] = useState<number | null>(null);
  const { user, isLoading, logout, isLoggingOut } = useAuth();

  useEffect(() => {
    const storageKey = "neurotext-visitor-id";
    let visitorId = window.localStorage.getItem(storageKey);
    if (!visitorId) {
      visitorId = window.crypto.randomUUID();
      window.localStorage.setItem(storageKey, visitorId);
    }

    fetch("/api/visitor-count", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ visitorId }),
    })
      .then(response => {
        if (!response.ok) throw new Error("Visitor count unavailable");
        return response.json();
      })
      .then(data => setVisitorCount(Number(data.count)))
      .catch(() => setVisitorCount(null));
  }, []);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get("auth") !== "success") return;
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    url.searchParams.delete("auth");
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
  }, [user]);

  return (
    <nav className="bg-primary text-primary-foreground py-4">
      <div className="container mx-auto flex justify-between items-center">
        <div className="flex items-center gap-6">
          <div
            className="flex shrink-0 items-center gap-1.5 rounded-md bg-primary-foreground/10 px-2.5 py-1.5 text-sm"
            aria-label={visitorCount === null ? "Visitor count loading" : `${visitorCount.toLocaleString()} visitors`}
            data-testid="visitor-counter"
          >
            <Users className="h-4 w-4" />
            <span className="font-semibold tabular-nums">
              {visitorCount === null ? "—" : visitorCount.toLocaleString()}
            </span>
            <span className="hidden xl:inline">visitors</span>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="https://zhisystems.ai/"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Visit ZHI Systems"
              data-testid="link-zhi-logo"
              className="shrink-0 rounded-md bg-white p-1 shadow-sm ring-1 ring-white/50 transition-transform hover:scale-105"
              onClick={() => trackEvent("outbound_link_clicked", { destination: "zhi_systems", location: "header" })}
            >
              <img src={zhiLogo} alt="ZHI Systems logo" className="h-8 w-8 object-contain" />
            </a>
            <div className="font-bold text-xl">Treatise Pro</div>
          </div>
          <a 
            href="mailto:johnmichaelkuczynski@gmail.com" 
            className="flex items-center gap-2 hover:underline text-sm"
            data-testid="link-contact-us"
            onClick={() => trackEvent("contact_link_clicked", { location: "header" })}
          >
            <Mail className="h-4 w-4" />
            <span>Contact Us</span>
          </a>
        </div>
        <div className="flex items-center gap-6">
          <ul className="flex gap-6">
            <li>
              <Link href="/" className="flex items-center gap-2 hover:underline" onClick={() => trackEvent("navigation_clicked", { destination: "intelligence_analysis" })}>
                <BrainCircuit className="h-5 w-5" />
                <span>Intelligence Analysis</span>
              </Link>
            </li>
            <li>
              <Link href="/analytics" className="flex items-center gap-2 hover:underline" onClick={() => trackEvent("navigation_clicked", { destination: "cognitive_analytics" })}>
                <Brain className="h-5 w-5" />
                <span>Cognitive Analytics</span>
              </Link>
            </li>
            <li>
              <Link href="/diagnostic" className="flex items-center gap-2 hover:underline" data-testid="link-diagnostic" onClick={() => trackEvent("navigation_clicked", { destination: "diagnostic" })}>
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
              onClick={clearPage}
              className="text-primary-foreground hover:bg-primary-foreground/10"
              data-testid="button-reset-all"
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Clear Page
            </Button>

            {!isLoading && (
              user ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={logout}
                  disabled={isLoggingOut}
                  className="text-primary-foreground hover:bg-primary-foreground/10"
                  data-testid="button-google-logout"
                >
                  <LogOut className="h-4 w-4 mr-1" />
                  {isLoggingOut ? "Signing out..." : "Sign out"}
                </Button>
              ) : (
                <Button
                  asChild
                  variant="secondary"
                  size="sm"
                  data-testid="button-google-login"
                >
                  <a
                    href="/api/auth/google"
                    onClick={() => trackEvent("google_login_started", { location: "header" })}
                  >
                    <LogIn className="h-4 w-4 mr-1" />
                    Sign in with Google
                  </a>
                </Button>
              )
            )}
            
          </div>
        </div>
      </div>
        {!isLoading && user && (
          <div className="container mx-auto mt-2 flex justify-end">
            <div
              className="rounded-md bg-primary-foreground/15 px-3 py-1 text-sm font-semibold"
              data-testid="signed-in-user"
            >
              Signed in as {user.email || user.username}
            </div>
          </div>
        )}
      
    </nav>
  );
}

function Router() {
  return (
    <>
      <Navigation />
      <Switch>
        <Route path="/" component={HomePage} />
        <Route path="/analytics" component={AnalyticsPage} />
        <Route path="/diagnostic" component={DiagnosticPage} />
         <Route path="/translation" component={TranslationPage} />
         <Route path="/web-search" component={WebSearchPage} />

        <Route component={NotFound} />
      </Switch>
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
