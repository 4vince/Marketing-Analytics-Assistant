"use client";

// Business Auditor dashboard — runs a full audit across sales, inventory, refunds,
// and supplier operations, then displays profit-leak findings with dollar impact.
import { useState, useCallback } from "react";

/* ── Types ── */

interface Finding {
  issue: string;
  severity: "critical" | "high" | "medium" | "low";
  detail: string;
  category: "sales" | "inventory" | "refunds" | "suppliers";
  estimated_annual_loss_cents: number;
}

interface Suggestion {
  area: string;
  suggestion: string;
  impact: "high" | "medium" | "low";
  effort: "low" | "medium" | "high";
  expected_savings_cents: number;
}

interface AuditResult {
  score: number;
  findings: Finding[];
  suggestions: Suggestion[];
}

/* ── Helpers ── */

const SEVERITY_COLORS: Record<string, string> = {
  critical: "bg-red-500/10 text-red-400 border-red-500/20",
  high: "bg-brand-yolk/10 text-brand-yolk border-brand-yolk/20",
  medium: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  low: "bg-brand-fence/30 text-brand-muted border-brand-fence/20",
};

const CATEGORY_ICONS: Record<string, string> = {
  sales: "📊",
  inventory: "📦",
  refunds: "↩",
  suppliers: "🏭",
};

const CATEGORY_LABELS: Record<string, string> = {
  sales: "Sales",
  inventory: "Inventory",
  refunds: "Refunds",
  suppliers: "Suppliers",
};

function formatMoney(cents: number): string {
  const abs = Math.abs(cents);
  if (abs >= 1_000_000) return `$${(cents / 100_000).toFixed(1)}k`;
  if (abs >= 100_000) return `$${(cents / 100).toLocaleString()}`;
  return `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function ScoreRing({ score }: { score: number }) {
  const hue = score >= 80 ? "emerald" : score >= 50 ? "brand-yolk" : "red";
  const colorMap: Record<string, string> = {
    emerald: "text-emerald-400 border-emerald-500/20 bg-emerald-500/5",
    "brand-yolk": "text-brand-yolk border-brand-yolk/20 bg-brand-yolk/5",
    red: "text-red-400 border-red-500/20 bg-red-500/5",
  };
  return (
    <span
      className={`inline-flex items-center justify-center w-16 h-16 rounded-full border-2 text-2xl font-display font-bold ${colorMap[hue]}`}
    >
      {score}
    </span>
  );
}

function Badge({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex text-[10px] font-medium px-2 py-0.5 rounded-full border ${className ?? ""}`}
    >
      {children}
    </span>
  );
}

/* ── Main Component ── */

export default function AuditPage() {
  const [result, setResult] = useState<AuditResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runAudit = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/audit", { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error || `Server error (${res.status})`);
      }
      const data: AuditResult = await res.json();
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Audit failed");
    } finally {
      setLoading(false);
    }
  }, []);

  const findingsByCategory = result
    ? (["sales", "inventory", "refunds", "suppliers"] as const).map((cat) => ({
        key: cat,
        label: CATEGORY_LABELS[cat],
        icon: CATEGORY_ICONS[cat],
        findings: result.findings.filter((f) => f.category === cat),
      }))
    : [];

  const totalAnnualLoss = result
    ? result.findings.reduce(
        (s, f) => s + (typeof f.estimated_annual_loss_cents === "number" ? f.estimated_annual_loss_cents : 0),
        0
      )
    : 0;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-display font-semibold text-brand-warm-white tracking-tight">
          Business Auditor
        </h1>
        <p className="text-sm text-brand-muted mt-1.5">
          Identify hidden profit leaks across sales, inventory, refunds, and supplier operations
        </p>
      </div>

      {/* Action bar */}
      <div className="relative bg-brand-clay border border-brand-fence rounded-xl p-6 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary-500/[0.03] to-transparent" />
        <div className="relative flex flex-col sm:flex-row items-start sm:items-center gap-4 justify-between">
          <div>
            <p className="text-sm text-brand-warm-white font-medium">
              {result
                ? "Audit complete — review the findings below"
                : "Run a full business audit to detect profit leaks"}
            </p>
            <p className="text-xs text-brand-muted mt-1">
              {result
                ? `Analyzed across ${result.findings.length} findings and ${result.suggestions.length} suggestions`
                : "Scans orders, products, refunds, suppliers, and campaign data"}
            </p>
          </div>
          <button
            onClick={runAudit}
            disabled={loading}
            className="inline-flex items-center gap-2 bg-primary-500 text-brand-warm-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-primary-600 transition-all shadow-lg shadow-primary-500/20 disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
          >
            {loading ? (
              <>
                <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Running audit…
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {result ? "Re-run Audit" : "Run Audit"}
              </>
            )}
          </button>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-5 text-sm text-red-400">
          <span className="font-medium">Audit failed:</span> {error}
        </div>
      )}

      {/* Results */}
      {result && (
        <>
          {/* Score + total loss summary */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-brand-clay border border-brand-fence rounded-xl p-6 flex items-center gap-5">
              <ScoreRing score={result.score} />
              <div>
                <p className="text-xs text-brand-muted uppercase tracking-widest font-medium">
                  Health Score
                </p>
                <p className="text-sm text-brand-warm-white mt-0.5">
                  {result.score >= 80
                    ? "Business is healthy"
                    : result.score >= 50
                    ? "Moderate leaks detected"
                    : "Significant leaks found"}
                </p>
              </div>
            </div>

            <div className="bg-brand-clay border border-brand-fence rounded-xl p-6 flex items-center gap-5">
              <span className="inline-flex items-center justify-center w-16 h-16 rounded-full border-2 text-2xl font-display font-bold text-red-400 border-red-500/20 bg-red-500/5">
                {formatMoney(totalAnnualLoss)}
              </span>
              <div>
                <p className="text-xs text-brand-muted uppercase tracking-widest font-medium">
                  Est. Annual Leakage
                </p>
                <p className="text-sm text-brand-warm-white mt-0.5">
                  {result.findings.length} leak{result.findings.length !== 1 ? "s" : ""} identified
                </p>
              </div>
            </div>

            <div className="bg-brand-clay border border-brand-fence rounded-xl p-6 flex items-center gap-5">
              <span className="inline-flex items-center justify-center w-16 h-16 rounded-full border-2 text-2xl font-display font-bold text-emerald-400 border-emerald-500/20 bg-emerald-500/5">
                {result.suggestions.length}
              </span>
              <div>
                <p className="text-xs text-brand-muted uppercase tracking-widest font-medium">
                  Recommendations
                </p>
                <p className="text-sm text-brand-warm-white mt-0.5">
                  {result.suggestions.filter((s) => s.impact === "high").length} high-impact
                </p>
              </div>
            </div>
          </div>

          {/* Findings by category */}
          <section>
            <h2 className="text-lg font-display font-semibold text-brand-warm-white mb-5">
              Findings by Category
            </h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {findingsByCategory.map(({ key, label, icon, findings }) => (
                <div
                  key={key}
                  className="group relative bg-brand-clay border border-brand-fence rounded-xl p-5 transition-all duration-200 hover:border-primary-500/20 hover:shadow-lg hover:shadow-black/20"
                >
                  <span className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-transparent via-primary-500/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-t-xl" />
                  <div className="flex items-center gap-2 mb-4">
                    <span className="text-base">{icon}</span>
                    <h3 className="font-display font-semibold text-brand-warm-white text-sm">
                      {label}
                    </h3>
                    <span className="text-[10px] text-brand-muted bg-brand-risen border border-brand-fence/60 rounded-md px-2 py-0.5 ml-auto tabular-nums">
                      {findings.length}
                    </span>
                  </div>

                  {findings.length === 0 ? (
                    <p className="text-xs text-brand-muted/60 italic">No leaks detected in this area</p>
                  ) : (
                    <ul className="space-y-3">
                      {findings.slice(0, 4).map((f, i) => (
                        <li key={i} className="text-xs">
                          <div className="flex items-start gap-2">
                            <span className="mt-0.5 text-brand-fence shrink-0">—</span>
                            <div className="space-y-1 min-w-0">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="text-brand-warm-white font-medium leading-snug">
                                  {f.issue}
                                </span>
                                <Badge className={SEVERITY_COLORS[f.severity]}>
                                  {f.severity}
                                </Badge>
                              </div>
                              <p className="text-brand-muted leading-relaxed line-clamp-2">
                                {f.detail}
                              </p>
                              <p className="text-red-400 font-medium tabular-nums">
                                {formatMoney(typeof f.estimated_annual_loss_cents === "number" ? f.estimated_annual_loss_cents : 0)} /yr
                              </p>
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* Suggestions */}
          {result.suggestions.length > 0 && (
            <section>
              <h2 className="text-lg font-display font-semibold text-brand-warm-white mb-5">
                Recommendations
              </h2>
              <div className="space-y-3">
                {result.suggestions.map((s, i) => (
                  <div
                    key={i}
                    className="group relative bg-brand-clay border border-brand-fence rounded-xl p-5 transition-all duration-200 hover:border-primary-500/20"
                  >
                    <span className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-transparent via-primary-500/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-t-xl" />
                    <div className="flex items-start gap-3">
                      <span className="text-brand-fence text-sm mt-0.5">{i + 1}.</span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <span className="text-[10px] text-brand-muted uppercase tracking-widest font-medium">
                            {s.area}
                          </span>
                          <Badge
                            className={
                              s.impact === "high"
                                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                                : s.impact === "medium"
                                ? "bg-brand-yolk/10 text-brand-yolk border-brand-yolk/20"
                                : "bg-brand-fence/30 text-brand-muted border-brand-fence/20"
                            }
                          >
                            impact: {s.impact}
                          </Badge>
                          <Badge
                            className={
                              s.effort === "low"
                                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                                : s.effort === "medium"
                                ? "bg-brand-yolk/10 text-brand-yolk border-brand-yolk/20"
                                : "bg-brand-fence/30 text-brand-muted border-brand-fence/20"
                            }
                          >
                            effort: {s.effort}
                          </Badge>
                        </div>
                        <p className="text-sm text-brand-warm-white leading-relaxed">
                          {s.suggestion}
                        </p>
                        <p className="text-xs text-emerald-400 font-medium mt-1.5 tabular-nums">
                          Expected savings: {formatMoney(typeof s.expected_savings_cents === "number" ? s.expected_savings_cents : 0)} /yr
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {/* Empty state */}
      {!result && !loading && !error && (
        <div className="bg-brand-clay border border-brand-fence rounded-xl p-16 text-center">
          <p className="text-4xl font-display text-brand-fence mb-4">🔍</p>
          <p className="text-brand-warm-white text-base font-medium mb-1">
            No audit data yet
          </p>
          <p className="text-sm text-brand-muted max-w-md mx-auto">
            Click &quot;Run Audit&quot; to analyze your orders, products, refunds, and supplier data for hidden profit leaks.
          </p>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-brand-clay border border-brand-fence rounded-xl p-6 animate-pulse">
              <div className="h-4 w-32 bg-brand-risen rounded mb-3" />
              <div className="h-3 w-full bg-brand-risen rounded mb-2" />
              <div className="h-3 w-3/4 bg-brand-risen rounded" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
