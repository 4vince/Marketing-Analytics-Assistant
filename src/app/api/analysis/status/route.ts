// Status polling proxy for product analysis jobs.
// GET /api/analysis/status?jobId=xxx&productId=xxx
//
// Polls the AI service for job status and saves individual agent results to the database when complete.
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

interface AgentResult {
  score?: number;
  findings?: unknown[];
  suggestions?: unknown[];
}

interface JobResult {
  [agentType: string]: AgentResult | unknown;
}

interface JobStatusResponse {
  id: string;
  type: string;
  status: string;
  steps: StepInfo[];
  result?: JobResult | null;
  error?: string | null;
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const jobId = searchParams.get("jobId");
  const productId = searchParams.get("productId");

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

  // If the job is complete and we have a productId, save individual agent results to DB
  if ((job.status === "completed" || job.status === "partial") && job.result && productId) {
    for (const [agentType, result] of Object.entries(job.result)) {
      const r = result as AgentResult;
      if (!r || typeof r.score !== "number" || !Array.isArray(r.findings)) continue;

      try {
        await prisma.analysisResult.create({
          data: {
            productId,
            agentType,
            score: r.score,
            findings: r.findings as Prisma.InputJsonValue,
            suggestions: (r.suggestions || []) as Prisma.InputJsonValue,
          },
        });
      } catch (dbErr) {
        // Duplicate saves are harmless
        console.warn("[analysis-status] DB save skipped:", dbErr);
      }
    }
  }

  // Build response for the frontend
  const steps = (job.steps || []).map((s: StepInfo) => ({
    name: s.name,
    status: s.status,
    error: s.error || null,
  }));

  return NextResponse.json({
    status: job.status,
    steps,
    result: job.result || null,
    error: job.error || null,
  });
}
