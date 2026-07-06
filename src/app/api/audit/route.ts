// Business audit API — POST aggregates sales, inventory, refund, and supplier data
// and sends it to the AI service for profit-leak analysis.
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const AI_SERVICE = process.env.AI_SERVICE_URL || "http://localhost:8000";

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Gather all business data in parallel
  const [orders, products, refunds, suppliers, campaigns] = await Promise.all([
    prisma.order.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.product.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.refund.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.supplier.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.campaign.findMany({ orderBy: { createdAt: "desc" } }),
  ]);

  // Send aggregated data to the AI service
  const payload = { orders, products, refunds, suppliers, campaigns };

  let aiRes: Response;
  try {
    aiRes = await fetch(`${AI_SERVICE}/analyze/audit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(70000),
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

  const result = await aiRes.json();
  return NextResponse.json(result);
}
