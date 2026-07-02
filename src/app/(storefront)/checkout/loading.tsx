// Checkout page loading skeleton — animated pulse placeholders for order summary.
export default function CheckoutLoading() {
  return (
    <div className="max-w-lg mx-auto px-4 py-8">
      <div className="h-8 w-36 bg-brand-risen rounded animate-pulse mb-8" />
      <div className="bg-brand-clay rounded-xl p-6 border border-brand-fence">
        {[1, 2].map((i) => (
          <div key={i} className="flex justify-between py-2.5 border-b border-brand-fence">
            <div className="h-5 w-40 bg-brand-risen rounded animate-pulse" />
            <div className="h-5 w-20 bg-brand-risen rounded animate-pulse" />
          </div>
        ))}
        <div className="mt-4 pt-4 border-t border-brand-fence">
          <div className="h-7 w-40 bg-brand-risen rounded animate-pulse" />
        </div>
      </div>
      <div className="mt-6 h-12 w-full bg-brand-risen rounded-xl animate-pulse" />
    </div>
  );
}
