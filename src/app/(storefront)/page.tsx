import Link from "next/link";
import ProductGrid from "@/components/storefront/ProductGrid";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  let products: Awaited<ReturnType<typeof prisma.product.findMany>> = [];
  try {
    const raw = await prisma.product.findMany({
      where: { status: "active" },
      take: 8,
      orderBy: { createdAt: "desc" },
    });
    products = raw;
  } catch {
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
    <div>
      {/* Hero */}
      <section className="relative w-full min-h-[calc(100vh-80px)] flex flex-col justify-center">
        <div className="max-w-7xl mx-auto px-6 w-full">
          <div className="flex flex-col lg:flex-row items-center justify-between gap-12">
            <div className="flex-1 max-w-xl">
              <p className="text-sm font-medium text-brand-muted uppercase tracking-widest mb-4 font-body">
                Curated Collection
              </p>
              <h1 className="text-5xl sm:text-6xl lg:text-7xl font-display font-bold text-brand-warm-white leading-[0.95] tracking-tight mb-6">
                Discover{" "}
                <span className="text-primary-500">Our</span>{" "}
                Collection
              </h1>
              <p className="text-lg text-brand-muted mb-8 leading-relaxed max-w-md">
                Handpicked for quality and style. Every product tells a story — find the one that speaks to you.
              </p>
              <div className="flex items-center gap-4">
                <Link
                  href="/products"
                  className="inline-flex items-center gap-2 bg-primary-500 text-brand-warm-white px-7 py-3.5 rounded-xl text-base font-semibold hover:bg-primary-600 transition-all duration-300 shadow-lg shadow-primary-500/25 hover:shadow-xl hover:shadow-primary-500/30 hover:-translate-y-0.5"
                >
                  Shop Now
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                  </svg>
                </Link>
                <Link
                  href="/products"
                  className="text-sm text-brand-muted hover:text-brand-warm-white transition-colors font-medium"
                >
                  Browse all
                </Link>
              </div>
            </div>
            <div className="flex-shrink-0 w-full max-w-md lg:w-[40%]">
              <div className="aspect-square bg-brand-clay rounded-2xl border border-brand-fence overflow-hidden shadow-2xl">
                <img
                  src="/images/landing-hero.png"
                  alt="Landing page hero"
                  className="w-full h-full object-cover hover:scale-105 transition-transform duration-700"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Social links */}
        <div className="hidden lg:flex fixed right-8 top-1/3 flex-col gap-4">
          {["F", "IG", "T"].map((label, i) => (
            <a
              key={label}
              href="#"
              className="w-9 h-9 rounded-lg border border-brand-fence flex items-center justify-center text-xs font-medium text-brand-muted hover:text-primary-500 hover:border-primary-500/40 transition-all duration-200"
              style={{ animationDelay: `${i * 100}ms` }}
            >
              {label}
            </a>
          ))}
        </div>
      </section>

      {/* Featured Products */}
      <section className="max-w-7xl mx-auto px-6 py-20">
        <div className="text-center mb-12">
          <p className="text-sm font-medium text-brand-muted uppercase tracking-widest mb-3 font-body">
            Featured
          </p>
          <h2 className="text-3xl sm:text-4xl font-display font-bold text-brand-warm-white tracking-tight">
            New Arrivals
          </h2>
          <p className="text-brand-muted mt-3 max-w-md mx-auto">
            Browse our latest and most popular items, chosen just for you.
          </p>
        </div>
        <ProductGrid products={safeProducts} />
      </section>
    </div>
  );
}
