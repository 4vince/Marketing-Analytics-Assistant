// Admin dashboard loading skeleton — animated pulse placeholders for stats and orders table.
export default function AdminDashboardLoading() {
  return (
    <div className="space-y-10">
      <div>
        <div className="h-9 w-48 bg-brand-risen rounded animate-pulse" />
        <div className="h-4 w-36 bg-brand-risen rounded animate-pulse mt-2" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-brand-clay border border-brand-fence rounded-xl p-6">
            <div className="h-4 w-20 bg-brand-risen rounded animate-pulse mb-3" />
            <div className="h-9 w-20 bg-brand-risen rounded animate-pulse" />
          </div>
        ))}
      </div>
      <div>
        <div className="h-6 w-32 bg-brand-risen rounded animate-pulse mb-5" />
        <div className="bg-brand-clay border border-brand-fence rounded-xl">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex gap-6 p-4 border-b border-brand-fence/60 last:border-b-0">
              <div className="h-5 w-24 bg-brand-risen rounded animate-pulse" />
              <div className="h-5 w-32 bg-brand-risen rounded animate-pulse" />
              <div className="h-5 w-16 bg-brand-risen rounded animate-pulse" />
              <div className="h-5 w-16 bg-brand-risen rounded animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
