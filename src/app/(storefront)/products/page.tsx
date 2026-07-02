// Products listing page — fetches active products with optional search and category filters.
import Link from "next/link";
import ProductGrid from "@/components/storefront/ProductGrid";
import { prisma } from "@/lib/prisma";

interface Props {
  searchParams: { search?: string; category?: string };
}

export default async function ProductsPage({ searchParams }: Props) {
  const where: Record<string, unknown> = { status: "active" };
  if (searchParams.search) {
    where.name = { contains: searchParams.search, mode: "insensitive" };
  }
  if (searchParams.category) where.category = searchParams.category;

  let products: Awaited<ReturnType<typeof prisma.product.findMany>> = [];
  let categories: { category: string }[] = [];
  try {
    products = await prisma.product.findMany({ where, orderBy: { createdAt: "desc" } });
    categories = await prisma.product.findMany({
      where: { status: "active" },
      select: { category: true },
      distinct: ["category"],
    });
  } catch {
    // Database unavailable
  }

  const safeProducts = products.map((p) => ({
    id: p.id,
    name: p.name,
    slug: p.slug,
    price: p.price,
    images: Array.isArray(p.images) ? p.images.filter((i): i is string => typeof i === "string") : [],
    category: p.category,
  }));

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-display font-semibold text-brand-warm-white mb-6">Products</h1>
      <div className="flex flex-col sm:flex-row gap-4 mb-8">
        <form className="flex gap-2">
          <input
            name="search"
            defaultValue={searchParams.search}
            placeholder="Search products..."
            className="bg-brand-risen border border-brand-fence rounded-xl px-4 py-2 text-sm text-brand-warm-white placeholder-brand-muted/50 focus:outline-none focus:border-primary-500/50 focus:ring-1 focus:ring-primary-500/30 transition-all"
          />
          <button type="submit"
            className="bg-primary-500 text-brand-warm-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-primary-600 transition-all shadow-lg shadow-primary-500/20">
            Search
          </button>
        </form>
        <div className="flex gap-2 flex-wrap">
          {categories.map((c) => (
            <Link
              key={c.category}
              href={`/products?category=${c.category}`}
              className="px-3 py-1.5 rounded-lg border border-brand-fence text-sm text-brand-muted hover:text-brand-warm-white hover:bg-brand-risen hover:border-primary-500/30 transition-all"
            >
              {c.category}
            </Link>
          ))}
        </div>
      </div>
      <ProductGrid products={safeProducts} />
    </div>
  );
}
