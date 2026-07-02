// Add-to-cart button — calls useCartStore.addItem() with the product and shows a toast notification.
"use client";
import { useCartStore } from "@/store/cart-store";
import { useToast } from "@/components/ui/Toast";

interface Product {
  id: string; name: string; slug: string; price: number; images: string[];
}

export default function AddToCartButton({ product }: { product: Product }) {
  const addItem = useCartStore((s) => s.addItem);
  const { addToast } = useToast();

  return (
    <button
      type="button"
      onClick={() => {
        addItem({ ...product, quantity: 1 });
        addToast(`${product.name} added to cart`);
      }}
      className="w-full bg-primary-600 text-white py-3 rounded-lg hover:bg-primary-700 text-lg font-semibold transition-colors active:scale-[0.98]"
    >
      Add to Cart
    </button>
  );
}
