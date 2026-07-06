// Marketing Intelligence dashboard — site score, per-product analysis results, quarterly reports.
import { prisma } from "@/lib/prisma";
import AnalyzeButton from "@/components/admin/AnalyzeButton";

function ScoreRing({ score }: { score: number }) {
  const hue = score >= 80 ? "emerald" : score >= 50 ? "brand-yolk" : "primary";
  const colorMap: Record<string, string> = {
    emerald: "text-emerald-400 border-emerald-500/20 bg-emerald-500/5",
    "brand-yolk": "text-brand-yolk border-brand-yolk/20 bg-brand-yolk/5",
    primary: "text-primary-500 border-primary-500/20 bg-primary-500/5",
  };
  return (
    <span className={`inline-flex items-center justify-center w-14 h-14 rounded-full border text-lg font-display font-bold ${colorMap[hue]}`}>
      {score}
    </span>
  );
}

export default async function MarketingPage() {
  const [products, results, reports] = await Promise.all([
    prisma.product.findMany({ where: { status: "active" }, orderBy: { createdAt: "desc" } }),
    prisma.analysisResult.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.quarterlyReport.findMany({ orderBy: { createdAt: "desc" } }),
  ]);

  const latestResults = new Map<string, (typeof results)[number]>();
  for (const r of results) {
    if (r.productId) {
      const key = `${r.productId}-${r.agentType}`;
      if (!latestResults.has(key)) latestResults.set(key, r);
    }
  }

  const avgScore = results.length > 0
    ? Math.round(results.reduce((s, r) => s + r.score, 0) / results.length)
    : null;

  return (
    <div className="space-y-10">
      {/* Page header */}
      <div>
        <h1 className="text-3xl font-display font-semibold text-brand-warm-white tracking-tight">Marketing Intelligence</h1>
        <p className="text-sm text-brand-muted mt-1.5">AI-powered product analysis and reporting</p>
      </div>

      {/* Overall Site Score — hero element */}
      {avgScore !== null && (
        <div className="relative bg-brand-clay border border-brand-fence rounded-xl p-7 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary-500/[0.03] to-transparent" />
          <div className="relative flex items-center gap-6">
            <ScoreRing score={avgScore} />
            <div>
              <p className="text-xs text-brand-muted uppercase tracking-widest font-medium font-body">Overall Site Score</p>
              <p className="text-sm text-brand-warm-white mt-0.5">
                {avgScore >= 80 ? "Strong performance across your product pages." :
                 avgScore >= 50 ? "Room for improvement in several areas." :
                 "Significant optimization opportunities detected."}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Per-Product Analysis */}
      <section>
        <h2 className="text-lg font-display font-semibold text-brand-warm-white mb-5">Product Analysis</h2>
        {products.length === 0 ? (
          <div className="bg-brand-clay border border-brand-fence rounded-xl p-12 text-center">
            <p className="text-3xl font-display text-brand-fence mb-3">✦</p>
            <p className="text-brand-warm-white text-sm font-medium">No active products</p>
            <p className="text-xs text-brand-muted mt-1">Activate products to run analysis on them.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {products.map((product) => {
              const productResults = Array.from(latestResults.values()).filter((r) => r.productId === product.id);
              const avg = productResults.length > 0
                ? Math.round(productResults.reduce((s, r) => s + r.score, 0) / productResults.length)
                : null;

              return (
                <div key={product.id} className="group relative bg-brand-clay border border-brand-fence rounded-xl p-6 transition-all duration-200 hover:border-primary-500/20 hover:shadow-lg hover:shadow-black/20">
                  {/* Top accent on hover */}
                  <span className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-transparent via-primary-500/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-t-xl" />

                  <div className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-5">
                    <div className="flex items-center gap-4">
                      {avg !== null && <ScoreRing score={avg} />}
                      <div>
                        <h3 className="font-display font-semibold text-brand-warm-white text-lg">{product.name}</h3>
                        {avg !== null && (
                          <p className="text-xs text-brand-muted mt-0.5">
                            {productResults.length} agent{productResults.length !== 1 ? "s" : ""} analyzed
                          </p>
                        )}
                      </div>
                    </div>
                    <AnalyzeButton productId={product.id} />
                  </div>

                  {productResults.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {productResults.slice(0, 3).map((r) => {
                        const findings = r.findings as Array<{ issue: string; severity: string; confidence?: string; dimension?: string }>;
                        const suggestions = r.suggestions as Array<{ area: string; suggestion: string; impact?: string; effort?: string }>;
                        const isSEO = r.agentType === "seo";

                        return (
                          <div key={r.id} className="bg-brand-risen/60 border border-brand-fence/60 rounded-lg p-4 transition-all duration-200 hover:bg-brand-risen hover:border-brand-fence">
                            <p className="text-[10px] font-medium text-brand-muted uppercase tracking-widest">{r.agentType}</p>
                            <p className="text-xl font-display font-semibold text-brand-warm-white mt-1.5 tabular-nums">{r.score}/100</p>

                            {/* Findings */}
                            {findings.length > 0 && (
                              <ul className="mt-3 space-y-1.5">
                                {findings.slice(0, 2).map((f, i) => (
                                  <li key={i} className="text-xs text-brand-muted">
                                    <div className="flex items-start gap-1.5">
                                      <span className="mt-0.5 text-[10px] text-brand-fence shrink-0">—</span>
                                      <span className="leading-relaxed">{f.issue}</span>
                                    </div>
                                    {isSEO && f.confidence && (
                                      <div className="flex gap-1.5 mt-1 ml-3.5">
                                        <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded ${
                                          f.confidence === "Confirmed"
                                            ? "bg-emerald-500/10 text-emerald-400"
                                            : f.confidence === "Likely"
                                            ? "bg-brand-yolk/10 text-brand-yolk"
                                            : "bg-brand-fence/30 text-brand-muted"
                                        }`}>
                                          {f.confidence}
                                        </span>
                                        {f.dimension && (
                                          <span className="text-[9px] text-brand-muted/60 bg-brand-fence/20 px-1.5 py-0.5 rounded">
                                            {f.dimension.replace(/_/g, " ")}
                                          </span>
                                        )}
                                      </div>
                                    )}
                                  </li>
                                ))}
                              </ul>
                            )}

                            {/* Suggestions */}
                            {isSEO && suggestions.length > 0 && (
                              <details className="mt-3 group">
                                <summary className="text-[10px] text-primary-500/70 hover:text-primary-500 cursor-pointer font-medium transition-colors">
                                  {suggestions.length} suggestion{suggestions.length !== 1 ? "s" : ""}
                                </summary>
                                <ul className="mt-2 space-y-1.5">
                                  {suggestions.slice(0, 3).map((s, i) => (
                                    <li key={i} className="text-[11px] text-brand-muted leading-relaxed">
                                      <span className="text-brand-fence">→ </span>
                                      {s.suggestion}
                                      {s.impact && s.effort && (
                                        <span className="flex gap-1 mt-0.5">
                                          <span className={`text-[9px] font-medium px-1 py-0.5 rounded ${
                                            s.impact === "high"
                                              ? "bg-emerald-500/10 text-emerald-400"
                                              : s.impact === "medium"
                                              ? "bg-brand-yolk/10 text-brand-yolk"
                                              : "bg-brand-fence/30 text-brand-muted"
                                          }`}>
                                            impact: {s.impact}
                                          </span>
                                          <span className={`text-[9px] font-medium px-1 py-0.5 rounded ${
                                            s.effort === "low"
                                              ? "bg-emerald-500/10 text-emerald-400"
                                              : s.effort === "medium"
                                              ? "bg-brand-yolk/10 text-brand-yolk"
                                              : "bg-brand-fence/30 text-brand-muted"
                                          }`}>
                                            effort: {s.effort}
                                          </span>
                                        </span>
                                      )}
                                    </li>
                                  ))}
                                </ul>
                              </details>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Quarterly Reports */}
      <section>
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-lg font-display font-semibold text-brand-warm-white">Quarterly Reports</h2>
            <p className="text-xs text-brand-muted mt-0.5">Automated performance summaries</p>
          </div>
          <form action="/api/report/generate" method="POST">
            <button type="submit"
              className="inline-flex items-center gap-2 bg-primary-500 text-brand-warm-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-primary-600 transition-all shadow-lg shadow-primary-500/20">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
              </svg>
              Generate Report
            </button>
          </form>
        </div>
        {reports.length === 0 ? (
          <div className="bg-brand-clay border border-brand-fence rounded-xl p-12 text-center">
            <p className="text-3xl font-display text-brand-fence mb-3">✦</p>
            <p className="text-brand-warm-white text-sm font-medium">No reports yet</p>
            <p className="text-xs text-brand-muted mt-1">Click &quot;Generate Report&quot; to create your first quarterly analysis.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {reports.map((report) => (
              <div key={report.id} className="group relative bg-brand-clay border border-brand-fence rounded-xl p-5 transition-all duration-200 hover:border-primary-500/20 hover:shadow-lg hover:shadow-black/20">
                {/* Top accent on hover */}
                <span className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-transparent via-primary-500/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-t-xl" />

                <div className="flex items-start justify-between mb-3">
                  <p className="font-display font-semibold text-brand-warm-white text-sm">
                    {new Date(report.periodStart).toLocaleDateString()} — {new Date(report.periodEnd).toLocaleDateString()}
                  </p>
                  {report.overallScore !== null && (
                    <span className="tabular-nums text-xs text-brand-muted bg-brand-risen border border-brand-fence/60 rounded-md px-2 py-0.5">
                      {report.overallScore}/100
                    </span>
                  )}
                </div>
                <p className="text-sm text-brand-muted leading-relaxed line-clamp-3">{report.summary.slice(0, 200)}...</p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
