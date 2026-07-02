// Products page loading skeleton — animated pulse placeholders for heading and product grid.
export default function ProductsLoading() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="h-8 w-48 bg-gray-200 rounded mb-8 animate-pulse" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="border rounded-lg overflow-hidden">
            <div className="aspect-square bg-gray-100 animate-pulse" />
            <div className="p-4 space-y-2">
              <div className="h-4 w-16 bg-gray-200 rounded animate-pulse" />
              <div className="h-5 w-32 bg-gray-200 rounded animate-pulse" />
              <div className="h-5 w-20 bg-gray-200 rounded animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
