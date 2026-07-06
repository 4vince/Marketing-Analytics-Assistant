// Homepage loading skeleton — animated pulse placeholders for hero, carousel, and category grid.
export default function HomeLoading() {
  return (
    <>
      {/* ── Hero skeleton ── */}
      <section className="relative w-full min-h-[80dvh] flex items-center">
        <div className="max-w-7xl mx-auto px-6 w-full">
          <div className="max-w-3xl space-y-6">
            <div className="h-4 w-28 bg-brand-risen rounded animate-pulse" />
            <div className="h-16 w-[32rem] bg-brand-risen rounded animate-pulse" />
            <div className="h-5 w-96 bg-brand-risen rounded animate-pulse" />
            <div className="flex gap-5 pt-2">
              <div className="h-12 w-44 bg-brand-risen rounded-lg animate-pulse" />
              <div className="h-12 w-28 bg-brand-risen rounded-lg animate-pulse" />
            </div>
          </div>
        </div>
      </section>

      {/* ── Carousel skeleton ── */}
      <section className="max-w-7xl mx-auto px-6 pb-24">
        <div className="flex items-end justify-between mb-8">
          <div className="space-y-2">
            <div className="h-8 w-32 bg-brand-risen rounded animate-pulse" />
            <div className="h-4 w-72 bg-brand-risen rounded animate-pulse" />
          </div>
          <div className="flex gap-2">
            <div className="w-9 h-9 rounded-lg bg-brand-risen animate-pulse" />
            <div className="w-9 h-9 rounded-lg bg-brand-risen animate-pulse" />
          </div>
        </div>
        <div className="flex gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="shrink-0 w-[240px] sm:w-[260px] bg-brand-clay border border-brand-fence rounded-xl overflow-hidden">
              <div className="aspect-[4/5] bg-brand-risen animate-pulse" />
              <div className="p-4 space-y-2">
                <div className="h-3 w-16 bg-brand-risen rounded animate-pulse" />
                <div className="h-4 w-32 bg-brand-risen rounded animate-pulse" />
                <div className="h-4 w-20 bg-brand-risen rounded animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Categories skeleton ── */}
      <section className="max-w-7xl mx-auto px-6 pb-24">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-brand-fence/40 rounded-xl overflow-hidden">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-brand-pitch p-8">
              <div className="h-4 w-8 bg-brand-risen rounded animate-pulse mb-3" />
              <div className="h-6 w-24 bg-brand-risen rounded animate-pulse mb-2" />
              <div className="h-4 w-28 bg-brand-risen rounded animate-pulse" />
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
