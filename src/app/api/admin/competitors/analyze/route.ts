// Competitor analysis trigger — POST to start analysis (returns job_id for polling),
// GET to list past reports for a competitor.
// POST /api/admin/competitors/analyze — trigger analysis for a competitor, returns { job_id }
// GET  /api/admin/competitors/analyze?competitorId=... — list all past analyses
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const AI_SERVICE = process.env.AI_SERVICE_URL || "http://localhost:8000";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { competitorId } = await req.json();

  if (!competitorId) {
    return NextResponse.json({ error: "competitorId is required" }, { status: 400 });
  }

  const competitor = await prisma.competitor.findUnique({ where: { id: competitorId } });
  if (!competitor) {
    return NextResponse.json({ error: "Competitor not found" }, { status: 404 });
  }

  // Call AI service — returns { job_id } immediately; client polls for completion
  let aiRes: Response;
  try {
    aiRes = await fetch(`${AI_SERVICE}/analyze/competitor`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        competitor: {
          name: competitor.name,
          domain: competitor.domain,
          notes: competitor.notes,
        },
      }),
      // No long timeout — the AI service returns immediately with a job_id
      signal: AbortSignal.timeout(10000),
    });
  } catch {
    return NextResponse.json(
      { error: "AI service is unavailable. Please try again later." },
      { status: 503 }
    );
  }

  if (!aiRes.ok) {
    const errBody = await aiRes.text();
    return NextResponse.json(
      { error: `AI service error: ${errBody}` },
      { status: 502 }
    );
  }

  const { job_id } = await aiRes.json();

  return NextResponse.json({ jobId: job_id, competitorId: competitor.id });
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const competitorId = searchParams.get("competitorId");

  const where = competitorId ? { competitorId } : {};

  const analyses = await prisma.competitorAnalysis.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: competitorId ? 50 : 100,
    include: {
      competitor: {
        select: { name: true, domain: true },
      },
    },
  });

  return NextResponse.json(analyses);
}
