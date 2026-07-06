// Delete product button — inline confirmation, DELETEs via /api/products, then refreshes page.
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function DeleteButton({ productId }: { productId: string }) {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const router = useRouter();

  const handleDelete = async () => {
    setDeleting(true);
    await fetch("/api/products", {
      method: "DELETE",
      body: JSON.stringify({ id: productId }),
    });
    setDeleting(false);
    router.refresh();
  };

  if (confirming) {
    return (
      <span className="inline-flex items-center gap-2">
        <span className="text-[11px] text-brand-muted font-medium">Confirm?</span>
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="text-xs text-primary-500 hover:text-primary-400 font-medium transition-colors disabled:opacity-40"
        >
          {deleting ? "Deleting..." : "Yes, delete"}
        </button>
        <button
          onClick={() => setConfirming(false)}
          className="text-xs text-brand-muted hover:text-brand-warm-white transition-colors font-medium"
        >
          Cancel
        </button>
      </span>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="text-xs text-brand-muted hover:text-primary-500 transition-colors font-medium"
    >
      Delete
    </button>
  );
}
