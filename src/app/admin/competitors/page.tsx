"use client";

// Competitor Intelligence Dashboard — add competitors, trigger web scraping +
// SWOT analysis, and view the 9-section competitive analysis with reports.
import { useState, useEffect, useCallback } from "react";

/* ── Types ── */

interface Competitor {
  id: string;
  name: string;
  domain: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  latestAnalysis: { overallScore: number; summary: string; createdAt: string } | null;
}

interface Finding {
  issue: string;
  severity: "critical" | "high" | "medium" | "low";
  detail: string;
  section: string;
  category: "strength" | "weakness" | "opportunity" | "threat" | null;
  competitor: string;
}

interface Suggestion {
  area: string;
  suggestion: string;
  impact: "high" | "medium" | "low";
  effort: "low" | "medium" | "high";
  competitor: string;
}

interface AnalysisResult {
  id: string;
  overallScore: number;
  summary: string;
  findings: Finding[];
  suggestions: Suggestion[];
  markdownReport: string;
  createdAt: string;
}

interface AnalysisReport {
  id: string;
  competitorId: string;
  overallScore: number;
  summary: string;
  markdownReport: string;
  createdAt: string;
  competitor: { name: string; domain: string | null };
}

/* ── Constants ── */

const SECTION_LABELS: Record<string, string> = {
  core_product: "Core Product",
  value_props: "Value Propositions",
  features: "Features",
  pricing: "Pricing",
  target_audience: "Target Audience",
  market_presence: "Market Presence",
  swot_grid: "SWOT Grid",
  why_choose_us: "Why Merchants Choose Us",
  objections: "Possible Objections",
};

const SECTION_ICONS: Record<string, string> = {
  core_product: "📦",
  value_props: "💎",
  features: "⚙️",
  pricing: "💰",
  target_audience: "👥",
  market_presence: "📡",
  swot_grid: "📊",
  why_choose_us: "✅",
  objections: "⚠️",
};

const SEVERITY_COLORS: Record<string, string> = {
  critical: "bg-red-500/10 text-red-400 border-red-500/20",
  high: "bg-brand-yolk/10 text-brand-yolk border-brand-yolk/20",
  medium: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  low: "bg-brand-fence/30 text-brand-muted border-brand-fence/20",
};

const SWOT_COLORS: Record<string, string> = {
  strength: "bg-emerald-500/5 border-emerald-500/20",
  weakness: "bg-red-500/5 border-red-500/20",
  opportunity: "bg-blue-500/5 border-blue-500/20",
  threat: "bg-purple-500/5 border-purple-500/20",
};

const SWOT_BORDER: Record<string, string> = {
  strength: "border-emerald-500/30",
  weakness: "border-red-500/30",
  opportunity: "border-blue-500/30",
  threat: "border-purple-500/30",
};

const SWOT_ICON: Record<string, string> = {
  strength: "🟢",
  weakness: "🔴",
  opportunity: "🔵",
  threat: "🟣",
};

/* ── Helpers ── */

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
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
      className={`inline-flex items-center justify-center w-14 h-14 rounded-full border-2 text-xl font-display font-bold ${colorMap[hue]}`}
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

/* ── Section Card ── */

function SectionCard({
  section,
  findings,
}: {
  section: string;
  findings: Finding[];
}) {
  const label = SECTION_LABELS[section] || section;
  const icon = SECTION_ICONS[section] || "📋";
  const isSWOT = section === "swot_grid";
  const isWhyChooseUs = section === "why_choose_us";
  const isObjections = section === "objections";

  if (isSWOT) {
    return <SWOTGrid findings={findings} />;
  }

  if (findings.length === 0) return null;

  return (
    <div className="group relative bg-brand-clay border border-brand-fence rounded-xl p-5 transition-all duration-200 hover:border-primary-500/20">
      <span className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-transparent via-primary-500/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-t-xl" />
      <div className="flex items-center gap-2 mb-4">
        <span className="text-base">{icon}</span>
        <h3 className="font-display font-semibold text-brand-warm-white text-sm">{label}</h3>
        <span className="text-[10px] text-brand-muted bg-brand-risen border border-brand-fence/60 rounded-md px-2 py-0.5 ml-auto tabular-nums">
          {findings.length}
        </span>
      </div>

      <ul className="space-y-3">
        {findings.map((f, i) => (
          <li key={i} className="text-xs">
            <div className="flex items-start gap-2">
              <span className="mt-0.5 text-brand-fence shrink-0">
                {isWhyChooseUs ? "✅" : isObjections ? "⚠️" : "—"}
              </span>
              <div className="space-y-1 min-w-0">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-brand-warm-white font-medium leading-snug">{f.issue}</span>
                  <Badge className={SEVERITY_COLORS[f.severity]}>{f.severity}</Badge>
                </div>
                <p className="text-brand-muted leading-relaxed">{f.detail}</p>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ── SWOT Grid ── */

function SWOTGrid({ findings }: { findings: Finding[] }) {
  const quadrants: { key: string; label: string; color: string; border: string; icon: string; items: Finding[] }[] = [
    {
      key: "strength",
      label: "Strengths",
      color: "bg-emerald-500/5 border-emerald-500/20",
      border: "border-emerald-500/30",
      icon: "🟢",
      items: findings.filter((f) => f.category === "strength"),
    },
    {
      key: "weakness",
      label: "Weaknesses",
      color: "bg-red-500/5 border-red-500/20",
      border: "border-red-500/30",
      icon: "🔴",
      items: findings.filter((f) => f.category === "weakness"),
    },
    {
      key: "opportunity",
      label: "Opportunities",
      color: "bg-blue-500/5 border-blue-500/20",
      border: "border-blue-500/30",
      icon: "🔵",
      items: findings.filter((f) => f.category === "opportunity"),
    },
    {
      key: "threat",
      label: "Threats",
      color: "bg-purple-500/5 border-purple-500/20",
      border: "border-purple-500/30",
      icon: "🟣",
      items: findings.filter((f) => f.category === "threat"),
    },
  ];

  return (
    <div className="group relative bg-brand-clay border border-brand-fence rounded-xl p-5 transition-all duration-200 hover:border-primary-500/20">
      <span className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-transparent via-primary-500/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-t-xl" />
      <div className="flex items-center gap-2 mb-4">
        <span className="text-base">📊</span>
        <h3 className="font-display font-semibold text-brand-warm-white text-sm">SWOT Analysis</h3>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {quadrants.map((q) => (
          <div
            key={q.key}
            className={`rounded-lg border p-3.5 ${q.color} ${q.border}`}
          >
            <div className="flex items-center gap-1.5 mb-2">
              <span>{q.icon}</span>
              <span className="font-display font-semibold text-brand-warm-white text-xs uppercase tracking-wider">
                {q.label}
              </span>
              <span className="text-[10px] text-brand-muted bg-black/20 rounded-md px-1.5 py-0.5 ml-auto">
                {q.items.length}
              </span>
            </div>
            {q.items.length === 0 ? (
              <p className="text-[10px] text-brand-muted/50 italic">No items identified</p>
            ) : (
              <ul className="space-y-2">
                {q.items.slice(0, 4).map((f, i) => (
                  <li key={i} className="text-[11px] leading-relaxed">
                    <div className="flex items-start gap-1.5">
                      <span className="text-brand-fence mt-0.5">•</span>
                      <div>
                        <span className="text-brand-warm-white font-medium">{f.issue}</span>
                        <p className="text-brand-muted mt-0.5">{f.detail.slice(0, 150)}{f.detail.length > 150 ? "…" : ""}</p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Report View ── */

function ReportView({
  report,
  onClose,
}: {
  report: AnalysisReport;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="relative bg-brand-pitch border border-brand-fence rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 bg-brand-pitch border-b border-brand-fence px-6 py-4 flex items-center justify-between z-10">
          <div>
            <h2 className="font-display font-semibold text-brand-warm-white text-lg">
              {report.competitor.name} — Report
            </h2>
            <p className="text-xs text-brand-muted mt-0.5">
              {formatDate(report.createdAt)} · Score: {report.overallScore}/100
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-brand-muted hover:text-brand-warm-white bg-brand-risen border border-brand-fence rounded-lg px-3 py-1.5 text-sm transition-colors"
          >
            Close
          </button>
        </div>

        {/* Report body */}
        <div className="px-6 py-6">
          {report.summary && (
            <div className="bg-primary-500/5 border border-primary-500/10 rounded-xl p-4 mb-6">
              <p className="text-xs text-primary-500 font-medium uppercase tracking-widest mb-1">Executive Summary</p>
              <p className="text-sm text-brand-warm-white leading-relaxed">{report.summary}</p>
            </div>
          )}

          {report.markdownReport ? (
            <div className="prose prose-invert prose-sm max-w-none text-brand-muted">
              {/* Simple markdown-like rendering — split by headings */}
              {report.markdownReport.split("\n").map((line, i) => {
                if (line.startsWith("# ")) {
                  return (
                    <h1 key={i} className="text-xl font-display font-semibold text-brand-warm-white mt-8 mb-3">
                      {line.replace("# ", "")}
                    </h1>
                  );
                }
                if (line.startsWith("## ")) {
                  return (
                    <h2 key={i} className="text-base font-display font-semibold text-brand-warm-white mt-6 mb-2">
                      {line.replace("## ", "")}
                    </h2>
                  );
                }
                if (line.startsWith("### ")) {
                  return (
                    <h3 key={i} className="text-sm font-display font-semibold text-brand-warm-white mt-4 mb-1">
                      {line.replace("### ", "")}
                    </h3>
                  );
                }
                if (line.startsWith("| ") && line.includes("|")) {
                  // Table row — render as-is with light formatting
                  return (
                    <pre key={i} className="text-xs text-brand-muted font-mono my-1">
                      {line}
                    </pre>
                  );
                }
                if (line.startsWith("- ") || line.startsWith("  - ")) {
                  return (
                    <li key={i} className="text-sm text-brand-muted ml-4 list-disc">
                      {line.replace(/^[\s-]+/, "")}
                    </li>
                  );
                }
                if (line.trim() === "") {
                  return <div key={i} className="h-2" />;
                }
                return (
                  <p key={i} className="text-sm text-brand-muted leading-relaxed my-1">
                    {line}
                  </p>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-brand-muted">No report body available.</p>
            </div>
          )}

          <div className="mt-6 pt-4 border-t border-brand-fence/50 text-[10px] text-brand-muted/60 text-center">
            Generated by Competitor Intelligence Agent
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Main Component ── */

export default function CompetitorsPage() {
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [formName, setFormName] = useState("");
  const [formDomain, setFormDomain] = useState("");
  const [formNotes, setFormNotes] = useState("");

  // Analysis state
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);
  const [analysisPhase, setAnalysisPhase] = useState<"scraping" | "analyzing" | null>(null);
  const [analysisResults, setAnalysisResults] = useState<Map<string, AnalysisResult>>(new Map());

  // Report view
  const [viewingReport, setViewingReport] = useState<AnalysisReport | null>(null);
  const [reportsList, setReportsList] = useState<Map<string, AnalysisReport[]>>(new Map());
  const [expandedReportId, setExpandedReportId] = useState<string | null>(null);

  const fetchCompetitors = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/competitors");
      if (!res.ok) throw new Error(`Failed to fetch (${res.status})`);
      const data: Competitor[] = await res.json();
      setCompetitors(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load competitors");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCompetitors();
  }, [fetchCompetitors]);

  const addCompetitor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return;

    try {
      const res = await fetch("/api/admin/competitors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formName,
          domain: formDomain,
          notes: formNotes,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to add competitor");
      }

      setFormName("");
      setFormDomain("");
      setFormNotes("");
      setShowForm(false);
      await fetchCompetitors();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add competitor");
    }
  };

  const deleteCompetitor = async (id: string) => {
    if (!confirm("Delete this competitor and all its analyses?")) return;

    try {
      const res = await fetch(`/api/admin/competitors?id=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      setCompetitors((prev) => prev.filter((c) => c.id !== id));
      setAnalysisResults((prev) => {
        const next = new Map(prev);
        next.delete(id);
        return next;
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete competitor");
    }
  };

  const runAnalysis = async (competitorId: string) => {
    setAnalyzingId(competitorId);
    setAnalysisPhase("scraping");

    try {
      // 1. Submit job — returns immediately with jobId
      const res = await fetch("/api/admin/competitors/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ competitorId }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error || `Analysis failed (${res.status})`);
      }

      const { jobId } = await res.json();

      // 2. Poll for completion
      const result = await pollJobCompletion(jobId, competitorId);
      setAnalysisResults((prev) => new Map(prev).set(competitorId, result));
      await fetchCompetitors();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Analysis failed");
    } finally {
      setAnalyzingId(null);
      setAnalysisPhase(null);
    }
  };

  const pollJobCompletion = async (jobId: string, competitorId: string): Promise<AnalysisResult> => {
    const pollInterval = 2000;

    while (true) {
      const res = await fetch(
        `/api/admin/competitors/analyze/status?jobId=${jobId}&competitorId=${competitorId}`
      );

      if (!res.ok) {
        throw new Error(`Status check failed (${res.status})`);
      }

      const data = await res.json();

      // Update phase based on which step is currently running
      if (data.steps && data.steps.length > 0) {
        const activeStep = data.steps.find((s: { name: string; status: string }) => s.status === "running");
        if (activeStep) {
          setAnalysisPhase(activeStep.name === "scrape" ? "scraping" : "analyzing");
        }
      }

      if (data.status === "completed" || data.status === "partial") {
        return data.result as AnalysisResult;
      }

      if (data.status === "failed") {
        throw new Error(data.error || "Analysis failed");
      }

      await new Promise((r) => setTimeout(r, pollInterval));
    }
  };

  const fetchReports = async (competitorId: string) => {
    try {
      const res = await fetch(`/api/admin/competitors/analyze?competitorId=${competitorId}`);
      if (!res.ok) throw new Error("Failed to fetch reports");
      const data: AnalysisReport[] = await res.json();
      setReportsList((prev) => new Map(prev).set(competitorId, data));
      setExpandedReportId(expandedReportId === competitorId ? null : competitorId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load reports");
    }
  };

  /* ── Render ── */

  return (
    <div className="space-y-8">
      {/* Error banner */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-center justify-between">
          <p className="text-sm text-red-400">
            <span className="font-medium">Error:</span> {error}
          </p>
          <button onClick={() => setError(null)} className="text-red-400/60 hover:text-red-400 text-sm ml-4">
            Dismiss
          </button>
        </div>
      )}

      {/* Report modal */}
      {viewingReport && <ReportView report={viewingReport} onClose={() => setViewingReport(null)} />}

      {/* Header + Add button */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-display font-semibold text-brand-warm-white tracking-tight">
            Competitor Intelligence
          </h1>
          <p className="text-sm text-brand-muted mt-1.5">
            AI-powered competitive analysis — web scraping, SWOT, and strategic reports
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="inline-flex items-center gap-2 bg-primary-500 text-brand-warm-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-primary-600 transition-all shadow-lg shadow-primary-500/20 shrink-0"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Add Competitor
        </button>
      </div>

      {/* Add competitor form */}
      {showForm && (
        <form
          onSubmit={addCompetitor}
          className="bg-brand-clay border border-brand-fence rounded-xl p-6 space-y-4"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-brand-muted font-medium mb-1.5">Name *</label>
              <input
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g. Acme Store"
                required
                className="w-full bg-brand-risen border border-brand-fence rounded-lg px-3 py-2 text-sm text-brand-warm-white placeholder:text-brand-muted/50 focus:outline-none focus:border-primary-500/40 transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs text-brand-muted font-medium mb-1.5">Domain / URL</label>
              <input
                type="text"
                value={formDomain}
                onChange={(e) => setFormDomain(e.target.value)}
                placeholder="e.g. acmestore.com"
                className="w-full bg-brand-risen border border-brand-fence rounded-lg px-3 py-2 text-sm text-brand-warm-white placeholder:text-brand-muted/50 focus:outline-none focus:border-primary-500/40 transition-colors"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs text-brand-muted font-medium mb-1.5">Notes (optional)</label>
            <textarea
              value={formNotes}
              onChange={(e) => setFormNotes(e.target.value)}
              placeholder="Any context about this competitor..."
              rows={2}
              className="w-full bg-brand-risen border border-brand-fence rounded-lg px-3 py-2 text-sm text-brand-warm-white placeholder:text-brand-muted/50 focus:outline-none focus:border-primary-500/40 transition-colors resize-none"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={!formName.trim()}
              className="bg-primary-500 text-brand-warm-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-600 transition-all disabled:opacity-40"
            >
              Add Competitor
            </button>
            <button
              type="button"
              onClick={() => { setShowForm(false); setFormName(""); setFormDomain(""); setFormNotes(""); }}
              className="text-brand-muted hover:text-brand-warm-white px-3 py-2 text-sm transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Loading state */}
      {loading && (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-brand-clay border border-brand-fence rounded-xl p-6 animate-pulse">
              <div className="h-5 w-48 bg-brand-risen rounded mb-3" />
              <div className="h-3 w-32 bg-brand-risen rounded mb-2" />
              <div className="h-3 w-full bg-brand-risen rounded" />
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && competitors.length === 0 && (
        <div className="bg-brand-clay border border-brand-fence rounded-xl p-16 text-center">
          <p className="text-4xl font-display text-brand-fence mb-4">◉</p>
          <p className="text-brand-warm-white text-base font-medium mb-1">No competitors yet</p>
          <p className="text-sm text-brand-muted max-w-md mx-auto">
            Add your first competitor to start analyzing their strengths, weaknesses, and market positioning.
          </p>
        </div>
      )}

      {/* Competitor list */}
      {!loading && competitors.map((competitor) => {
        const result = analysisResults.get(competitor.id);
        const latestScore = result?.overallScore ?? competitor.latestAnalysis?.overallScore ?? null;
        const latestSummary = result?.summary ?? competitor.latestAnalysis?.summary ?? null;
        const hasAnalysis = result !== undefined || competitor.latestAnalysis !== null;

        // Group findings by section for display
        const findings = result?.findings ?? [];
        const sections = [
          "core_product",
          "value_props",
          "features",
          "pricing",
          "target_audience",
          "market_presence",
          "swot_grid",
          "why_choose_us",
          "objections",
        ];

        const sectionFindings = sections
          .map((s) => ({
            section: s,
            findings: findings.filter((f) => f.section === s),
          }))
          .filter((s) => s.findings.length > 0);

        const suggestions = result?.suggestions ?? [];
        const reports = reportsList.get(competitor.id) ?? [];
        const showReports = expandedReportId === competitor.id;

        return (
          <div
            key={competitor.id}
            className="group relative bg-brand-clay border border-brand-fence rounded-xl p-6 transition-all duration-200 hover:border-primary-500/20 hover:shadow-lg hover:shadow-black/20"
          >
            <span className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-transparent via-primary-500/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-t-xl" />

            {/* Competitor header */}
            <div className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-4">
              <div className="flex items-center gap-4 min-w-0">
                {latestScore !== null && <ScoreRing score={latestScore} />}
                <div className="min-w-0">
                  <h3 className="font-display font-semibold text-brand-warm-white text-lg">
                    {competitor.name}
                  </h3>
                  <div className="flex flex-wrap items-center gap-2 mt-1">
                    {competitor.domain && (
                      <span className="text-[10px] text-brand-muted bg-brand-risen border border-brand-fence/60 rounded-md px-2 py-0.5 font-mono">
                        {competitor.domain}
                      </span>
                    )}
                    {result && (
                      <span className="text-[10px] text-brand-muted/60">
                        Analyzed {formatDate(result.createdAt)}
                      </span>
                    )}
                    {!result && competitor.latestAnalysis && (
                      <span className="text-[10px] text-brand-muted/60">
                        Last analyzed {formatDate(competitor.latestAnalysis.createdAt)}
                      </span>
                    )}
                  </div>
                  {competitor.notes && (
                    <p className="text-xs text-brand-muted mt-1.5 line-clamp-1">{competitor.notes}</p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => runAnalysis(competitor.id)}
                  disabled={analyzingId === competitor.id}
                  className="inline-flex items-center gap-2 bg-brand-risen text-brand-muted border border-brand-fence px-3 py-1.5 rounded-lg text-xs font-medium hover:text-primary-500 hover:border-primary-500/30 disabled:opacity-40 transition-all"
                >
                  {analyzingId === competitor.id ? (
                    <>
                      <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      {analysisPhase === "scraping" ? "Scraping…" : "Analyzing…"}
                    </>
                  ) : (
                    "Analyze Now"
                  )}
                </button>
                <button
                  onClick={() => fetchReports(competitor.id)}
                  className="text-brand-muted hover:text-brand-warm-white border border-brand-fence/60 rounded-lg px-2.5 py-1.5 text-xs transition-colors"
                >
                  Reports {showReports ? "▲" : "▼"}
                </button>
                <button
                  onClick={() => deleteCompetitor(competitor.id)}
                  className="text-brand-muted hover:text-red-400 text-xs transition-colors px-1"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Analysis phase indicator */}
            {analyzingId === competitor.id && analysisPhase === "scraping" && (
              <div className="bg-primary-500/5 border border-primary-500/10 rounded-lg p-3 mb-4">
                <p className="text-xs text-primary-500/80">🔍 Scraping {competitor.domain || competitor.name}…</p>
              </div>
            )}
            {analyzingId === competitor.id && analysisPhase === "analyzing" && (
              <div className="bg-primary-500/5 border border-primary-500/10 rounded-lg p-3 mb-4">
                <p className="text-xs text-primary-500/80">🤖 Running competitive analysis…</p>
              </div>
            )}

            {/* Summary */}
            {latestSummary && (
              <div className="text-sm text-brand-muted leading-relaxed mb-5 bg-brand-risen/40 border border-brand-fence/30 rounded-lg p-3.5">
                {latestSummary}
              </div>
            )}

            {/* 9-section analysis results */}
            {hasAnalysis && sectionFindings.length > 0 && (
              <div className="space-y-4 mb-5">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {sectionFindings.filter((s) => s.section !== "swot_grid" && s.section !== "why_choose_us" && s.section !== "objections").map(({ section, findings }) => (
                    <SectionCard key={section} section={section} findings={findings} />
                  ))}
                </div>
                {/* Full-width sections */}
                {sectionFindings.filter((s) => s.section === "swot_grid").map(({ section, findings }) => (
                  <SectionCard key={section} section={section} findings={findings} />
                ))}
                {/* Why Choose Us + Objections side by side */}
                {(
                  sectionFindings.filter((s) => s.section === "why_choose_us" || s.section === "objections").length > 0
                ) && (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {sectionFindings.filter((s) => s.section === "why_choose_us" || s.section === "objections").map(({ section, findings }) => (
                      <SectionCard key={section} section={section} findings={findings} />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Suggestions */}
            {suggestions.length > 0 && (
              <section>
                <h4 className="text-xs text-brand-muted uppercase tracking-widest font-medium mb-3">
                  Recommendations ({suggestions.length})
                </h4>
                <div className="space-y-2">
                  {suggestions.slice(0, 5).map((s, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-3 bg-brand-risen/30 border border-brand-fence/40 rounded-lg p-3"
                    >
                      <span className="text-brand-fence text-xs mt-0.5">{i + 1}.</span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5 mb-1">
                          <span className="text-[10px] text-brand-muted uppercase tracking-widest">{s.area}</span>
                          <Badge className={
                            s.impact === "high"
                              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                              : s.impact === "medium"
                              ? "bg-brand-yolk/10 text-brand-yolk border-brand-yolk/20"
                              : "bg-brand-fence/30 text-brand-muted border-brand-fence/20"
                          }>
                            impact: {s.impact}
                          </Badge>
                          <Badge className={
                            s.effort === "low"
                              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                              : s.effort === "medium"
                              ? "bg-brand-yolk/10 text-brand-yolk border-brand-yolk/20"
                              : "bg-brand-fence/30 text-brand-muted border-brand-fence/20"
                          }>
                            effort: {s.effort}
                          </Badge>
                          <span className="text-[10px] text-brand-muted/60 bg-brand-fence/20 rounded px-1.5 py-0.5">
                            {s.competitor}
                          </span>
                        </div>
                        <p className="text-xs text-brand-warm-white leading-relaxed">{s.suggestion}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Report History (collapsible) */}
            {showReports && (
              <div className="mt-4 pt-4 border-t border-brand-fence/50">
                <h4 className="text-xs text-brand-muted uppercase tracking-widest font-medium mb-3">
                  Report History ({reports.length})
                </h4>
                {reports.length === 0 ? (
                  <p className="text-xs text-brand-muted/60 italic">No reports yet. Analyze this competitor to generate one.</p>
                ) : (
                  <div className="space-y-2">
                    {reports.map((report) => (
                      <div
                        key={report.id}
                        className="flex items-center justify-between bg-brand-risen/30 border border-brand-fence/40 rounded-lg p-3 hover:bg-brand-risen/50 transition-colors cursor-pointer"
                        onClick={() => setViewingReport(report)}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="tabular-nums text-xs font-semibold text-brand-warm-white bg-brand-fence/30 rounded-md px-2 py-0.5">
                            {report.overallScore}/100
                          </span>
                          <div className="min-w-0">
                            <p className="text-xs text-brand-warm-white truncate">
                              {report.summary?.slice(0, 120) || "No summary"}
                            </p>
                            <p className="text-[10px] text-brand-muted/60 mt-0.5">
                              {formatDate(report.createdAt)}
                            </p>
                          </div>
                        </div>
                        <span className="text-[10px] text-brand-muted hover:text-primary-500 shrink-0 ml-2">
                          View →
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
