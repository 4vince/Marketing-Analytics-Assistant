// Chat proxy API — POST forwards conversation and message to the AI service and returns the response.
// Falls back gracefully when the AI service is unavailable.
import { NextResponse } from "next/server";

const AI_SERVICE = process.env.AI_SERVICE_URL || "http://localhost:8000";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const aiRes = await fetch(`${AI_SERVICE}/chat/${body.conversationId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: body.message,
        catalog: body.catalog,
        role: "customer",
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (!aiRes.ok) throw new Error(`AI service returned ${aiRes.status}`);
    const data = await aiRes.json();
    return NextResponse.json(data);
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error("Chat proxy error:", detail);
    return NextResponse.json({
      message: "I'm sorry, our AI assistant is currently unavailable. Please check back later or contact us directly.",
      detail,
    });
  }
}
