"use client";
import { useState } from "react";

export default function ContactPage() {
  const [form, setForm] = useState({ name: "", email: "", message: "" });
  const [status, setStatus] = useState<"idle" | "sending" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("sending");
    setErrorMsg("");

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Something went wrong.");
      }
      setStatus("success");
      setForm({ name: "", email: "", message: "" });
    } catch (err) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "Failed to send message.");
    }
  };

  const inputClass =
    "w-full bg-brand-risen border border-brand-fence rounded-xl px-4 py-2.5 text-sm text-brand-warm-white placeholder-brand-muted/50 focus:outline-none focus:border-primary-500/50 focus:ring-1 focus:ring-primary-500/30 transition-all";
  const labelClass = "block text-sm font-medium text-brand-muted mb-1.5";

  return (
    <div className="max-w-3xl mx-auto px-4 py-20">
      <p className="text-sm font-medium text-brand-muted uppercase tracking-widest mb-3 font-body">Get in Touch</p>
      <h1 className="text-4xl font-display font-bold text-brand-warm-white tracking-tight mb-4">Contact Us</h1>
      <p className="text-brand-muted mb-10 max-w-lg leading-relaxed">
        Have a question or feedback? We&apos;d love to hear from you. Send us a message and we&apos;ll respond promptly.
      </p>

      {status === "success" && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-4 py-3 rounded-xl mb-6 text-sm">
          Thank you for reaching out! We&apos;ll be in touch soon.
        </div>
      )}

      {status === "error" && (
        <div className="bg-primary-500/10 border border-primary-500/30 text-primary-500 px-4 py-3 rounded-xl mb-6 text-sm">
          {errorMsg}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5 max-w-lg">
        <div>
          <label htmlFor="name" className={labelClass}>Name</label>
          <input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
            className={inputClass} placeholder="Your name" required />
        </div>
        <div>
          <label htmlFor="email" className={labelClass}>Email</label>
          <input id="email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
            className={inputClass} placeholder="you@example.com" required />
        </div>
        <div>
          <label htmlFor="message" className={labelClass}>Message</label>
          <textarea id="message" value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })}
            className={`${inputClass} resize-y min-h-[120px]`} placeholder="What's on your mind?" rows={5} required />
        </div>
        <button type="submit" disabled={status === "sending"}
          className="bg-primary-500 text-brand-warm-white px-8 py-3 rounded-xl font-semibold hover:bg-primary-600 transition-all disabled:opacity-50 shadow-lg shadow-primary-500/20">
          {status === "sending" ? "Sending..." : "Send Message"}
        </button>
      </form>
    </div>
  );
}
