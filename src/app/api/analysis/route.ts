// Product analysis API — POST triggers AI analysis for a product (returns job_id for polling);
// GET returns analysis results (optionally filtered by productId).
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const AI_SERVICE = process.env.AI_SERVICE_URL || "http://localhost:8000";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { productId } = await req.json();
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });

  // Submit job to AI service — returns { job_id } immediately
  let aiRes: Response;
  try {
    aiRes = await fetch(`${AI_SERVICE}/analyze/product`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(product),
      signal: AbortSignal.timeout(10000),
    });
  } catch {
    return NextResponse.json({ error: "AI service is unavailable. Please try again later." }, { status: 503 });
  }

  if (!aiRes.ok) {
    const errBody = await aiRes.text();
    return NextResponse.json({ error: `AI service error: ${errBody}` }, { status: 502 });
  }

  const { job_id } = await aiRes.json();

  return NextResponse.json({ jobId: job_id, productId: product.id });
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
