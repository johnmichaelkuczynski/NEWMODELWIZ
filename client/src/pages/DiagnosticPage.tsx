import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, AlertCircle, Loader2, Activity, Download } from "lucide-react";
import { trackEvent } from "@/lib/analytics";

type CheckStatus = "pass" | "fail" | "warn";
interface Check {
  category: string;
  name: string;
  status: CheckStatus;
  detail: string;
  ms?: number;
}
interface DiagnosticResult {
  success: boolean;
  summary: { total: number; passed: number; failed: number; warned: number; durationMs: number };
  checks: Check[];
}

export default function DiagnosticPage() {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<DiagnosticResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runDiagnostic = async () => {
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const r = await fetch("/api/diagnostic/run", { method: "POST" });
      const data = await r.json();
      if (!r.ok || !data.success) throw new Error(data?.message || "Diagnostic failed");
      setResult(data);
      trackEvent("diagnostic_completed", {
        passed: data.summary.passed,
        failed: data.summary.failed,
        warned: data.summary.warned,
        duration_ms: data.summary.durationMs,
      });
    } catch (e: any) {
      setError(e?.message || "Diagnostic could not complete. Please try again.");
      trackEvent("diagnostic_failed");
    } finally {
      setRunning(false);
    }
  };

  const autoStarted = useRef(false);
  useEffect(() => {
    if (autoStarted.current) return;
    autoStarted.current = true;
    runDiagnostic();
  }, []);

  const downloadReport = () => {
    if (!result) return;
    const lines: string[] = [];
    lines.push("COGNITIVE ANALYSIS PLATFORM — DIAGNOSTIC REPORT");
    lines.push(new Date().toLocaleString());
    lines.push("=".repeat(64));
    lines.push("");
    lines.push(`Total: ${result.summary.total}   Passed: ${result.summary.passed}   Failed: ${result.summary.failed}   Warnings: ${result.summary.warned}`);
    lines.push(`Duration: ${(result.summary.durationMs / 1000).toFixed(2)}s`);
    lines.push("");
    const cats = Array.from(new Set(result.checks.map((c) => c.category)));
    for (const cat of cats) {
      lines.push(`── ${cat} ──`);
      for (const c of result.checks.filter((c) => c.category === cat)) {
        const icon = c.status === "pass" ? "[ OK ]" : c.status === "warn" ? "[WARN]" : "[FAIL]";
        const ms = c.ms != null ? ` (${c.ms}ms)` : "";
        lines.push(`${icon} ${c.name}${ms} — ${c.detail}`);
      }
      lines.push("");
    }
    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `diagnostic-${new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    trackEvent("diagnostic_report_downloaded", {
      passed: result.summary.passed,
      failed: result.summary.failed,
      warned: result.summary.warned,
    });
  };

  const StatusIcon = ({ status }: { status: CheckStatus }) => {
    if (status === "pass") return <CheckCircle2 className="w-5 h-5 text-green-600" />;
    if (status === "warn") return <AlertCircle className="w-5 h-5 text-yellow-600" />;
    return <XCircle className="w-5 h-5 text-red-600" />;
  };

  const categories = result ? Array.from(new Set(result.checks.map((c) => c.category))) : [];

  return (
    <div className="container mx-auto p-6 max-w-5xl">
      <div className="flex items-center gap-3 mb-2">
        <Activity className="w-8 h-8 text-violet-600" />
        <h1 className="text-3xl font-bold">System Diagnostic</h1>
      </div>
      <p className="text-gray-600 dark:text-gray-400 mb-6">
        Verifies services, providers, the database, analysis tools, Markdown exclusion, exact word counts,
        and database-backed large-scale prose coherence.
      </p>

      <div className="flex gap-3 mb-6">
        <Button
          onClick={runDiagnostic}
          disabled={running}
          className="bg-violet-600 hover:bg-violet-700 text-white px-6 py-6 text-lg"
          data-testid="button-run-diagnostic"
        >
          {running ? (
            <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Running diagnostic…</>
          ) : (
            <><Activity className="w-5 h-5 mr-2" /> Re-run Diagnostic</>
          )}
        </Button>
        {result && (
          <Button variant="outline" onClick={downloadReport} data-testid="button-download-diagnostic">
            <Download className="w-4 h-4 mr-2" /> Download Report
          </Button>
        )}
      </div>

      {error && (
        <Card className="p-4 mb-4 border-red-300 bg-red-50 dark:bg-red-950/30 text-red-800 dark:text-red-300">
          <div className="font-medium">Diagnostic could not complete</div>
          <div className="text-sm mt-1">{error}</div>
        </Card>
      )}

      {running && !result && (
        <Card className="p-6 text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3 text-violet-600" />
          <div className="text-gray-700 dark:text-gray-300">
            Pinging providers, testing the database, and exercising analysis and long-form writing…
          </div>
          <div className="text-sm text-gray-500 mt-1">The large-scale prose test can take several minutes.</div>
        </Card>
      )}

      {result && (
        <>
          <Card className="p-4 mb-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
              <div><div className="text-2xl font-bold">{result.summary.total}</div><div className="text-xs text-gray-500">Total Checks</div></div>
              <div><div className="text-2xl font-bold text-green-600">{result.summary.passed}</div><div className="text-xs text-gray-500">Passed</div></div>
              <div><div className="text-2xl font-bold text-yellow-600">{result.summary.warned}</div><div className="text-xs text-gray-500">Warnings</div></div>
              <div><div className="text-2xl font-bold text-red-600">{result.summary.failed}</div><div className="text-xs text-gray-500">Failed</div></div>
            </div>
            <div className="text-center text-sm text-gray-500 mt-3">
              Completed in {(result.summary.durationMs / 1000).toFixed(2)}s
            </div>
          </Card>

          {categories.map((cat) => (
            <Card key={cat} className="p-4 mb-3">
              <div className="font-semibold text-lg mb-3">{cat}</div>
              <div className="space-y-2">
                {result.checks.filter((c) => c.category === cat).map((c, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-3 p-3 rounded border bg-gray-50 dark:bg-gray-900 dark:border-gray-700"
                    data-testid={`check-${c.name.replace(/\s+/g, "-").toLowerCase()}`}
                  >
                    <StatusIcon status={c.status} />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{c.name}</span>
                        {c.ms != null && (
                          <Badge variant="outline" className="text-xs">{c.ms}ms</Badge>
                        )}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400 mt-0.5 break-words">
                        {c.detail}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </>
      )}
    </div>
  );
}
