// Dashboard statistic card — displays a title and value (e.g., product count, revenue).
interface StatsCardProps {
  title: string;
  value: string | number;
}

const glyphs: Record<string, string> = {
  Products: "⊞",
  Orders: "☰",
  Revenue: "$",
};

export default function StatsCard({ title, value }: StatsCardProps) {
  return (
    <div className="group relative bg-brand-clay border border-brand-fence rounded-xl p-6 transition-all duration-300 hover:border-primary-500/25 hover:shadow-lg hover:shadow-black/30 overflow-hidden">
      {/* Top accent bar */}
      <span className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-transparent via-primary-500/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-[11px] text-brand-muted uppercase tracking-widest font-medium font-body">
            {title}
          </p>
          <p className="text-3xl font-display font-semibold text-brand-warm-white mt-2 tabular-nums tracking-tight">
            {value}
          </p>
        </div>
        <span className="text-lg text-brand-fence group-hover:text-primary-500/40 transition-colors duration-300 mt-0.5">
          {glyphs[title] || "⬡"}
        </span>
      </div>
    </div>
  );
}
