// Quarterly report generation API — POST sends last 90 days of analysis results to AI and creates a report.
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const AI_SERVICE = process.env.AI_SERVICE_URL || "http://localhost:8000";

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  const analyses = await prisma.analysisResult.findMany({
    where: { createdAt: { gte: ninetyDaysAgo } },
  });

  let aiRes: Response;
  try {
    aiRes = await fetch(`${AI_SERVICE}/analyze/report`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ analyses }),
      signal: AbortSignal.timeout(70000),
    });
  } catch {
    return NextResponse.json({ error: "AI service is unavailable. Please try again later." }, { status: 503 });
  }
  if (!aiRes.ok) return NextResponse.json({ error: "AI service error" }, { status: 502 });
  const result = await aiRes.json();

  await prisma.quarterlyReport.create({
    data: {
      periodStart: ninetyDaysAgo,
      periodEnd: new Date(),
      overallScore: result.score,
      summary: result.findings.map((f: { issue: string }) => f.issue).join(". "),
      sections: { findings: result.findings, suggestions: result.suggestions },
    },
  });

  return NextResponse.json({ success: true });
}
