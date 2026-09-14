export const OUTPUT_EVENT = "treatise:send-output";
export const PENDING_OUTPUT_KEY = "treatise:pending-output";

export const OUTPUT_DESTINATIONS = [
  "Writing", "Intelligence Analysis", "Humanizer", "Text Model Validator",
  "BOTTOMLINE", "Objections", "Whole-Document Coherence", "Mathematical Analysis",
  "Case Assessment", "Fiction Assessment", "AI Chat", "Translation",
  "Web Search/Rewrite",
] as const;

export type OutputDestination = typeof OUTPUT_DESTINATIONS[number];
export interface OutputPayload {
  destination: OutputDestination;
  text: string;
  origin: string;
  allowRecursion: true;
  timestamp: number;
}

const routePaths: Partial<Record<OutputDestination, string>> = {
  Translation: "/translation",
  "Web Search/Rewrite": "/web-search",
};

export function dispatchOutput(destination: OutputDestination, text: string, origin = "unknown") {
  const cleanText = text?.trim();
  if (!cleanText) return;
  const payload: OutputPayload = {
    destination, text: cleanText, origin, allowRecursion: true, timestamp: Date.now(),
  };
  window.dispatchEvent(new CustomEvent(OUTPUT_EVENT, { detail: payload }));
  const path = routePaths[destination];
  if (path && window.location.pathname !== path) {
    sessionStorage.setItem(PENDING_OUTPUT_KEY, JSON.stringify(payload));
    window.history.pushState({}, "", path);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }
}

export function readPendingOutput(destination?: OutputDestination): OutputPayload | null {
  try {
    const raw = sessionStorage.getItem(PENDING_OUTPUT_KEY);
    if (!raw) return null;
    const payload = JSON.parse(raw) as OutputPayload;
    if (destination && payload.destination !== destination) return null;
    return payload;
  } catch { return null; }
}

export function acceptPendingOutput() {
  sessionStorage.removeItem(PENDING_OUTPUT_KEY);
}