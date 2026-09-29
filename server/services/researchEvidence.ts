export interface ResearchResult {
  title: string;
  url: string;
  snippet: string;
  date?: string;
}

export function requestsResearch(instructions: string): boolean {
  return /\b(?:empirical|scientific|stud(?:y|ies)|data|statistics|evidence|research|clinical|trial|meta.analysis|sources?|citations?)\b/i.test(instructions);
}

export async function searchResearch(query: string): Promise<ResearchResult[]> {
  const key = process.env.PERPLEXITY_API_KEY;
  if (!key) throw new Error("Empirical research was requested, but PERPLEXITY_API_KEY is not configured. A sourced manuscript cannot be generated without evidence retrieval.");
  const response = await fetch("https://api.perplexity.ai/search", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query, max_results: 5 }),
  });
  if (!response.ok) throw new Error(`Research search failed (${response.status}). The job was stopped before unsupported empirical claims could be added.`);
  const payload = await response.json() as { results?: ResearchResult[] };
  return (payload.results || []).filter(result => result.title && result.url && result.snippet);
}

export function researchDossier(results: ResearchResult[]): string {
  const distinct = Array.from(new Map(results.map(result => [result.url, result])).values());
  if (!distinct.length) throw new Error("Research search returned no usable sources. The requested evidence-rich expansion cannot be completed.");
  return `RETRIEVED RESEARCH LEADS (search snippets, not full-text verification). Attribute each supported empirical claim to a numbered source and URL. Cite an exact number or finding only if it appears in the snippet or the source paper. Mark competing explanations and study limits. Do not turn an abstract, search snippet, or association into a demonstrated causal mechanism. If the available evidence cannot support a claim, say what study would test it.\n${distinct.slice(0, 20).map((result, index) => `[${index + 1}] ${result.title} (${result.date || "date unavailable"}) ${result.url}\n${result.snippet}`).join("\n\n")}`;
}
