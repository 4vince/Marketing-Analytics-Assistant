"use client";
import { useState, useRef, useEffect } from "react";
import FormattedText from "@/components/ui/FormattedText";

interface Message {
  role: "user" | "agent";
  content: string;
}

export default function AdminChatPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "agent",
      content:
        "Hi! I'm your analytics assistant. I can help you understand your store's performance. Try asking about products, orders, revenue, or analytics.",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const conversationId = useRef(`admin-${Date.now()}`);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim()) return;
    const userMsg = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMsg }]);
    setLoading(true);

    try {
      const res = await fetch("/api/admin/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: conversationId.current,
          message: userMsg,
        }),
      });
      const data = await res.json();
      setMessages((prev) => [...prev, { role: "agent", content: data.message }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "agent", content: "Sorry, I'm having trouble responding right now." },
      ]);
    }
    setLoading(false);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-7rem)]">
      <h1 className="text-2xl font-display font-semibold text-brand-warm-white mb-6">Analytics Chat</h1>

      <div className="flex-1 bg-brand-clay border border-brand-fence rounded-2xl flex flex-col overflow-hidden">
        {/* Messages area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4" style={{ scrollbarWidth: "thin" }}>
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[70%] px-4 py-3 text-sm leading-relaxed rounded-2xl ${
                  msg.role === "user"
                    ? "bg-primary-500 text-brand-warm-white rounded-br-md"
                    : "bg-brand-risen text-brand-warm-white rounded-bl-md border border-brand-fence"
                }`}
              >
                {msg.role === "agent" ? <FormattedText text={msg.content} /> : msg.content}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-brand-risen text-brand-muted px-4 py-3 rounded-2xl text-sm border border-brand-fence">
                <span className="flex gap-1.5">
                  <span className="w-2 h-2 bg-brand-muted rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-2 h-2 bg-brand-muted rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-2 h-2 bg-brand-muted rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                </span>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input area */}
        <div className="border-t border-brand-fence p-4 flex gap-3">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
            placeholder="Ask about your store (e.g., &quot;How many products do I have?&quot;)..."
            className="flex-1 bg-brand-risen text-brand-warm-white border border-brand-fence rounded-xl px-4 py-3 text-sm placeholder-brand-muted/60 focus:outline-none focus:border-primary-500/50 focus:ring-1 focus:ring-primary-500/30 transition-all"
          />
          <button
            onClick={sendMessage}
            disabled={loading}
            className="bg-primary-500 text-brand-warm-white px-6 py-3 rounded-xl text-sm font-medium hover:bg-primary-600 disabled:opacity-40 transition-all flex-shrink-0"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
