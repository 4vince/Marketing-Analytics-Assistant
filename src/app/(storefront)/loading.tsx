// Homepage loading skeleton — animated pulse placeholders for hero and featured products.
export default function HomeLoading() {
  return (
    <div>
      {/* Hero skeleton */}
      <section className="relative w-full min-h-[calc(100vh-80px)] flex flex-col justify-center">
        <div className="max-w-7xl mx-auto px-6 w-full">
          <div className="flex flex-col lg:flex-row items-center justify-between gap-12">
            <div className="flex-1 max-w-xl space-y-6">
              <div className="h-4 w-24 bg-brand-risen rounded animate-pulse" />
              <div className="h-16 w-96 bg-brand-risen rounded animate-pulse" />
              <div className="h-6 w-72 bg-brand-risen rounded animate-pulse" />
              <div className="h-14 w-40 bg-brand-risen rounded-xl animate-pulse" />
            </div>
            <div className="flex-shrink-0 w-full max-w-md lg:w-[40%]">
              <div className="w-full aspect-square bg-brand-clay rounded-2xl animate-pulse border border-brand-fence" />
            </div>
          </div>
        </div>
      </section>
      {/* Featured products skeleton */}
      <section className="max-w-7xl mx-auto px-6 py-20">
        <div className="h-8 w-64 bg-brand-risen rounded animate-pulse mx-auto mb-10" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-brand-clay rounded-xl overflow-hidden border border-brand-fence">
              <div className="aspect-square bg-brand-risen animate-pulse" />
              <div className="p-4 space-y-2">
                <div className="h-4 w-16 bg-brand-risen rounded animate-pulse" />
                <div className="h-5 w-32 bg-brand-risen rounded animate-pulse" />
                <div className="h-5 w-20 bg-brand-risen rounded animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
