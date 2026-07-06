// Product analysis API — POST triggers AI analysis for a product; GET returns results (optionally filtered).
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

const AI_SERVICE = process.env.AI_SERVICE_URL || "http://localhost:8000";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { productId } = await req.json();
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });

  let aiRes: Response;
  try {
    aiRes = await fetch(`${AI_SERVICE}/analyze/product`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(product),
      signal: AbortSignal.timeout(70000),
    });
  } catch {
    return NextResponse.json({ error: "AI service is unavailable. Please try again later." }, { status: 503 });
  }

  if (!aiRes.ok) return NextResponse.json({ error: "AI service error" }, { status: 502 });

  const results = await aiRes.json();

  for (const [agentType, result] of Object.entries(results)) {
    await prisma.analysisResult.create({
      data: {
        productId: product.id,
        agentType,
        score: (result as { score: number }).score,
        findings: (result as { findings: Prisma.InputJsonValue }).findings,
        suggestions: (result as { suggestions: Prisma.InputJsonValue }).suggestions,
      },
    });
  }

  return NextResponse.json(results);
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const productId = searchParams.get("productId");

  const where = productId ? { productId } : {};
  const results = await prisma.analysisResult.findMany({
    where,
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(results);
}
