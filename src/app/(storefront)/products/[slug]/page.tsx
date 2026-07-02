// Product detail page — fetches product by slug, shows image, price, description, and add-to-cart.
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import AddToCartButton from "./AddToCartButton";

interface Props {
  params: { slug: string };
}

export default async function ProductDetailPage({ params }: Props) {
  let product: Awaited<ReturnType<typeof prisma.product.findUnique>> | null = null;
  try {
    product = await prisma.product.findUnique({ where: { slug: params.slug } });
  } catch {
    // Database unavailable
  }
  if (!product) notFound();

  const safeProduct = {
    ...product,
    images: Array.isArray(product.images) ? product.images.filter((i): i is string => typeof i === "string") : [],
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
        <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden">
          {safeProduct.images[0] && (
            <img src={safeProduct.images[0]} alt={safeProduct.name} className="w-full h-full object-cover" />
          )}
        </div>
        <div>
          <p className="text-sm text-gray-500 mb-2">{safeProduct.category}</p>
          <h1 className="text-3xl font-bold mb-4">{safeProduct.name}</h1>
          <p className="text-2xl text-primary-600 font-bold mb-6">${(safeProduct.price / 100).toFixed(2)}</p>
          {safeProduct.compareAtPrice && (
            <p className="text-sm text-gray-500 line-through mb-4">
              ${(safeProduct.compareAtPrice / 100).toFixed(2)}
            </p>
          )}
          <div className="prose max-w-none mb-8">{safeProduct.description}</div>
          <AddToCartButton product={JSON.parse(JSON.stringify(safeProduct))} />
        </div>
      </div>
    </div>
  );
}
