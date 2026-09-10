"use client";
import { useState, useRef, useEffect } from "react";
import FormattedText from "@/components/ui/FormattedText";

interface Message {
  role: "user" | "agent";
  content: string;
}

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: "agent", content: "Hi! How can I help you today?" },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const conversationId = useRef(`anon-${Date.now()}`);

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
      const res = await fetch("/api/chat", {
        method: "POST",
        body: JSON.stringify({
          conversationId: conversationId.current,
          message: userMsg,
          catalog: [],
        }),
      });
      const data = await res.json();
      setMessages((prev) => [...prev, { role: "agent", content: data.message }]);
    } catch {
      setMessages((prev) => [...prev, { role: "agent", content: "Sorry, I'm having trouble responding right now." }]);
    }
    setLoading(false);
  };

  return (
    <div className="fixed bottom-5 right-5 z-50">
      {/* Chat panel */}
      {open && (
        <div className="bg-brand-clay border border-brand-fence rounded-2xl shadow-2xl w-80 sm:w-96 flex flex-col mb-3 overflow-hidden animate-slide-up">
          {/* Header */}
          <div className="bg-brand-pitch border-b border-brand-fence px-5 py-3.5 flex items-center gap-3">
            <div className="w-7 h-7 rounded-full bg-primary-500 flex items-center justify-center text-brand-warm-white text-xs font-bold font-display">
              C
            </div>
            <div>
              <p className="text-sm font-semibold text-brand-warm-white font-body">Chickenoodle</p>
              <p className="text-[10px] text-brand-muted">Assistant</p>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 max-h-72" style={{ scrollbarWidth: "thin" }}>
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[80%] px-3.5 py-2.5 text-sm leading-relaxed rounded-2xl ${
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
                <span className="bg-brand-risen text-brand-muted px-3.5 py-2.5 rounded-2xl text-sm border border-brand-fence">
                  <span className="flex gap-1">
                    <span className="w-1.5 h-1.5 bg-brand-muted rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-1.5 h-1.5 bg-brand-muted rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-1.5 h-1.5 bg-brand-muted rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                  </span>
                </span>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="border-t border-brand-fence p-3 flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendMessage()}
              placeholder="Ask anything..."
              className="flex-1 bg-brand-risen text-brand-warm-white border border-brand-fence rounded-xl px-3.5 py-2 text-sm placeholder-brand-muted/60 focus:outline-none focus:border-primary-500/50 focus:ring-1 focus:ring-primary-500/30 transition-all"
            />
            <button
              onClick={sendMessage}
              disabled={loading}
              className="bg-primary-500 text-brand-warm-white px-3.5 py-2 rounded-xl text-sm font-medium hover:bg-primary-600 disabled:opacity-40 transition-all flex-shrink-0"
            >
              Send
            </button>
          </div>
        </div>
      )}

      {/* Toggle button */}
      <button
        onClick={() => setOpen(!open)}
        className={`
          w-13 h-13 w-[52px] h-[52px] rounded-full flex items-center justify-center
          shadow-xl transition-all duration-300
          ${open
            ? "bg-brand-risen text-brand-muted border border-brand-fence"
            : "bg-primary-500 text-brand-warm-white hover:bg-primary-600 animate-pulse-glow"
          }
        `}
        aria-label={open ? "Close chat" : "Open chat"}
      >
        {open ? (
          <span className="text-xl leading-none">&times;</span>
        ) : (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
          </svg>
        )}
      </button>
    </div>
  );
}
