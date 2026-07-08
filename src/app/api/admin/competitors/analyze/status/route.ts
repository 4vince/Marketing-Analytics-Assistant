// Status polling proxy for competitor analysis jobs.
// GET /api/admin/competitors/analyze/status?jobId=xxx&competitorId=xxx
//
// Polls the AI service for job status and saves results to the database when complete.
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

const AI_SERVICE = process.env.AI_SERVICE_URL || "http://localhost:8000";

interface StepInfo {
  name: string;
  status: string;
  result?: unknown;
  error?: string | null;
}

// The job result is assembled as { [step_name]: step_result, ... }.
// For competitor analysis, the "analyze" step holds the actual analysis output.
interface AnalyzeStepResult {
  score?: number;
  findings?: unknown[];
  suggestions?: unknown[];
  summary?: string;
  markdown_report?: string;
}

interface JobResult {
  [step: string]: AnalyzeStepResult | unknown;
}

interface JobStatusResponse {
  id: string;
  type: string;
  status: string;
  steps: StepInfo[];
  result?: JobResult | null;
  error?: string | null;
}

function extractCompetitorResult(jobResult: JobResult): AnalyzeStepResult | null {
  if (jobResult.analyze && typeof jobResult.analyze === "object") {
    return jobResult.analyze as AnalyzeStepResult;
  }
  return null;
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const jobId = searchParams.get("jobId");
  const competitorId = searchParams.get("competitorId");

  if (!jobId) {
    return NextResponse.json({ error: "jobId is required" }, { status: 400 });
  }

  // Proxy to AI service
  let aiRes: Response;
  try {
    aiRes = await fetch(`${AI_SERVICE}/analyze/status/${jobId}`, {
      signal: AbortSignal.timeout(10000),
    });
  } catch {
    return NextResponse.json({ error: "AI service unavailable" }, { status: 503 });
  }

  if (!aiRes.ok) {
    if (aiRes.status === 404) {
      return NextResponse.json({ status: "not_found" }, { status: 200 });
    }
    return NextResponse.json({ error: "Status fetch failed" }, { status: 502 });
  }

  const job: JobStatusResponse = await aiRes.json();

  // If the job is complete and we have a competitorId, save to DB
  if ((job.status === "completed" || job.status === "partial") && job.result && competitorId) {
    const r = extractCompetitorResult(job.result);
    if (r) {
      try {
        await prisma.competitorAnalysis.create({
          data: {
            competitorId,
            overallScore: r.score ?? 0,
            summary: r.summary || "",
            markdownReport: r.markdown_report || "",
            findings: (r.findings || []) as Prisma.InputJsonValue,
            suggestions: (r.suggestions || []) as Prisma.InputJsonValue,
          },
        });
      } catch (dbErr) {
        // Duplicate saves are harmless — log and continue
        console.warn("[status] DB save skipped (may already exist):", dbErr);
      }
    }
  }

  // Build a clean response for the frontend — send the analyze result to the frontend
  const analyzeResult = job.result ? extractCompetitorResult(job.result) : null;

  const steps = (job.steps || []).map((s: StepInfo) => ({
    name: s.name,
    status: s.status,
    error: s.error || null,
  }));

  return NextResponse.json({
    status: job.status,
    steps,
    result: analyzeResult,
    error: job.error || null,
  });
}
