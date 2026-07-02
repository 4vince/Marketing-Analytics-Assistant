// Product detail loading skeleton — animated pulse placeholders for image and details.
export default function ProductDetailLoading() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
        <div className="aspect-square bg-gray-100 rounded-lg animate-pulse" />
        <div className="space-y-4">
          <div className="h-4 w-20 bg-gray-200 rounded animate-pulse" />
          <div className="h-8 w-64 bg-gray-200 rounded animate-pulse" />
          <div className="h-8 w-24 bg-gray-200 rounded animate-pulse" />
          <div className="space-y-2">
            <div className="h-4 w-full bg-gray-200 rounded animate-pulse" />
            <div className="h-4 w-3/4 bg-gray-200 rounded animate-pulse" />
          </div>
        </div>
      </div>
    </div>
  );
}
