// Shopping cart page — displays cart items, total, clear/checkout buttons, and empty state.
"use client";
import { useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { useCartStore } from "@/store/cart-store";
import { useToast } from "@/components/ui/Toast";
import CartItem from "@/components/storefront/CartItem";
import Link from "next/link";

export default function CartPage() {
  const { items, total, clearCart } = useCartStore();
  const { addToast } = useToast();
  const searchParams = useSearchParams();
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return;
    if (searchParams.get("success") === "true") {
      handled.current = true;
      addToast("Payment successful! Thank you for your order.", "success");
      clearCart();
    } else if (searchParams.get("canceled") === "true") {
      handled.current = true;
      addToast("Payment was canceled. Your cart is still here.", "error");
    }
  }, [searchParams, addToast, clearCart]);

  if (items.length === 0) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <div className="text-6xl mb-6 text-primary-500 font-display">✦</div>
        <h1 className="text-3xl font-display font-semibold text-brand-warm-white mb-4">Your Cart is Empty</h1>
        <p className="text-brand-muted mb-8">Looks like you haven&apos;t added anything yet.</p>
        <Link href="/products" className="bg-primary-500 text-brand-warm-white px-8 py-3 rounded-xl font-semibold hover:bg-primary-600 transition-colors no-underline inline-block shadow-lg shadow-primary-500/20">
          Continue Shopping
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-display font-semibold text-brand-warm-white mb-8">Shopping Cart</h1>
      <div className="divide-y divide-brand-fence">
        {items.map((item) => <CartItem key={item.id} item={item} />)}
      </div>
      <div className="mt-8 text-right">
        <div className="flex items-center justify-end gap-2 mb-2">
          <span className="text-brand-muted text-sm font-body">Total:</span>
          <span className="text-2xl font-mono font-semibold text-brand-warm-white">${(total() / 100).toFixed(2)}</span>
        </div>
        <div className="flex gap-4 justify-end mt-4">
          <button
            onClick={clearCart}
            className="px-5 py-2.5 border border-brand-fence text-brand-muted rounded-xl hover:bg-brand-risen hover:text-brand-warm-white transition-all text-sm font-medium"
          >
            Clear Cart
          </button>
          <Link
            href="/checkout"
            className="px-6 py-2.5 bg-primary-500 text-brand-warm-white rounded-xl font-semibold hover:bg-primary-600 transition-all no-underline shadow-lg shadow-primary-500/20"
          >
            Proceed to Checkout
          </Link>
        </div>
      </div>
    </div>
  );
}
