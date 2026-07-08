// Competitors CRUD API — list, create, and delete competitors.
// GET  /api/admin/competitors — list all with latest analysis scores
// POST /api/admin/competitors — create a competitor { name, domain, notes }
// DELETE /api/admin/competitors?id=... — delete a competitor and its analyses
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const competitors = await prisma.competitor.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      analyses: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          overallScore: true,
          summary: true,
          createdAt: true,
        },
      },
    },
  });

  const result = competitors.map((c) => ({
    id: c.id,
    name: c.name,
    domain: c.domain,
    notes: c.notes,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
    latestAnalysis: c.analyses.length > 0 ? c.analyses[0] : null,
  }));

  return NextResponse.json(result);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name, domain, notes } = await req.json();

  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const competitor = await prisma.competitor.create({
    data: {
      name: name.trim(),
      domain: domain?.trim() || null,
      notes: notes?.trim() || null,
    },
  });

  return NextResponse.json(competitor, { status: 201 });
}

export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Competitor ID is required" }, { status: 400 });
  }

  const competitor = await prisma.competitor.findUnique({ where: { id } });
  if (!competitor) {
    return NextResponse.json({ error: "Competitor not found" }, { status: 404 });
  }

  // Analyses cascade on delete via Prisma schema
  await prisma.competitor.delete({ where: { id } });

  return NextResponse.json({ deleted: true });
}
