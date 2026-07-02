// Products page error boundary — shows error message with "Try Again" button.
"use client";
export default function ProductsError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="max-w-7xl mx-auto px-4 py-16 text-center">
      <h2 className="text-xl font-bold mb-4">Something went wrong</h2>
      <p className="text-gray-500 mb-6">Failed to load products. Please try again.</p>
      <button onClick={reset} className="bg-primary-600 text-white px-6 py-2 rounded hover:bg-primary-700">
        Try Again
      </button>
    </div>
  );
}
