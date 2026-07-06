import Link from "next/link";
import ProductCarousel from "@/components/storefront/ProductCarousel";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Normalize a product into the shape the carousel expects
type CarouselProduct = {
  id: string;
  name: string;
  slug: string;
  price: number;
  images: string[];
  category: string;
};

function normalize(p: {
  id: string; name: string; slug: string; price: number;
  images: string[] | unknown; category: string;
}): CarouselProduct {
  return {
    id: p.id,
    name: p.name,
    slug: p.slug,
    price: p.price,
    images: Array.isArray(p.images) ? p.images.filter((i): i is string => typeof i === "string") : [],
    category: p.category,
  };
}

// Attempt to hit the dummy products API; silently fail
async function fetchDummyProducts(): Promise<CarouselProduct[] | null> {
  try {
    const url = process.env.DUMMY_PRODUCTS_API_URL || "http://localhost:5050/api/v1";
    const res = await fetch(`${url}/products?limit=8`, {
      signal: AbortSignal.timeout(2000),
    });
    if (!res.ok) return null;
    const json = await res.json();
    const raw = json.data ?? [];
    if (!Array.isArray(raw) || raw.length === 0) return null;
    return raw.map((d: Record<string, unknown>) => ({
      id: String(d._id ?? ""),
      name: String(d.product_name ?? ""),
      slug: String(d._id ?? "").slice(-12),
      price: Math.round(Number(d.product_price ?? 0) * 100),
      images: [String(d.product_image_md ?? d.product_image_sm ?? "")].filter(Boolean),
      category: String(d.product_department ?? d.product_type ?? "General"),
    }));
  } catch {
    return null;
  }
}

async function fetchLocalProducts(): Promise<CarouselProduct[]> {
  try {
    const raw = await prisma.product.findMany({
      where: { status: "active" },
      take: 8,
      orderBy: { createdAt: "desc" },
    });
    return raw.map(normalize);
  } catch {
    return [];
  }
}

// Realistic fallback data when both sources are unavailable
const FALLBACK_PRODUCTS: CarouselProduct[] = [
  { id: "1", name: "Wool Herringbone Blazer", slug: "wool-herringbone-blazer", price: 29500, images: ["https://picsum.photos/seed/blazer/600/750"], category: "Outerwear" },
  { id: "2", name: "Linen Wide-Leg Trouser", slug: "linen-wide-leg-trouser", price: 18500, images: ["https://picsum.photos/seed/trouser/600/750"], category: "Bottoms" },
  { id: "3", name: "Cashmere Rollneck Sweater", slug: "cashmere-rollneck", price: 24500, images: ["https://picsum.photos/seed/sweater/600/750"], category: "Knitwear" },
  { id: "4", name: "Italian Leather Derby", slug: "italian-leather-derby", price: 42000, images: ["https://picsum.photos/seed/derby/600/750"], category: "Footwear" },
  { id: "5", name: "Japanese Selvedge Denim", slug: "japanese-selvedge-denim", price: 26500, images: ["https://picsum.photos/seed/denim/600/750"], category: "Bottoms" },
  { id: "6", name: "Cotton Poplin Shirt", slug: "cotton-poplin-shirt", price: 14500, images: ["https://picsum.photos/seed/shirt/600/750"], category: "Tops" },
  { id: "7", name: "Twill Field Jacket", slug: "twill-field-jacket", price: 37500, images: ["https://picsum.photos/seed/jacket/600/750"], category: "Outerwear" },
  { id: "8", name: "Silk Pocket Square", slug: "silk-pocket-square", price: 6500, images: ["https://picsum.photos/seed/pocket/600/750"], category: "Accessories" },
];

export default async function HomePage() {
  let featured = await fetchDummyProducts();
  if (!featured) {
    const local = await fetchLocalProducts();
    featured = local.length > 0 ? local : FALLBACK_PRODUCTS;
  }

  return (
    <>
      {/* ── Hero ── */}
      <section className="relative w-full min-h-[80dvh] flex items-center">
        <div className="max-w-7xl mx-auto px-6 w-full">
          <div className="max-w-3xl">
            <p className="text-xs font-medium text-brand-muted uppercase tracking-[0.15em] mb-5 font-body">
              Curated essentials
            </p>
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-display font-semibold text-brand-warm-white leading-[0.92] tracking-tight">
              Things worth
              <br />
              <span className="text-primary-500">keeping</span>
            </h1>
            <p className="text-base sm:text-lg text-brand-muted mt-6 leading-relaxed max-w-lg">
              Everyday objects made with care. No trends, no noise — just well-made things that earn their place in your life.
            </p>
            <div className="flex items-center gap-5 mt-8">
              <Link
                href="/products"
                className="inline-flex items-center gap-2.5 bg-brand-warm-white text-brand-pitch px-6 py-3 rounded-lg text-sm font-semibold hover:bg-white transition-all duration-200"
              >
                Shop the collection
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14M12 5l7 7-7 7" />
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
        </div>

        {/* Subtle background radial */}
        <div className="absolute -top-1/4 -right-1/4 w-1/2 aspect-square rounded-full bg-primary-500/3 blur-3xl pointer-events-none" />
      </section>

      {/* ── Featured Carousel ── */}
      <section className="max-w-7xl mx-auto px-6 pb-24">
        <ProductCarousel
          products={featured}
          title="Featured"
          subtitle="A selection of pieces we are proud to carry — each chosen for quality of make and clarity of purpose."
        />
      </section>

      {/* ── Categories grid ── */}
      <section className="max-w-7xl mx-auto px-6 pb-24">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-brand-fence/40 rounded-xl overflow-hidden">
          {[
            { label: "Outerwear", slug: "outerwear", desc: "Coats, jackets, and shells" },
            { label: "Knitwear", slug: "knitwear", desc: "Jumpers, cardigans, and rolls" },
            { label: "Footwear", slug: "footwear", desc: "Boots, shoes, and trainers" },
            { label: "Accessories", slug: "accessories", desc: "Bags, belts, and small goods" },
          ].map((cat, i) => (
            <Link
              key={cat.slug}
              href={`/products?category=${cat.slug}`}
              className="group relative bg-brand-pitch p-8 transition-all duration-300 hover:bg-brand-clay"
              style={{ animationDelay: `${i * 80}ms` }}
            >
              <p className="text-xs font-medium text-brand-muted uppercase tracking-[0.12em] mb-2 font-body">
                {String(i + 1).padStart(2, "0")}
              </p>
              <h3 className="text-lg font-display font-semibold text-brand-warm-white transition-colors duration-200 group-hover:text-primary-500">
                {cat.label}
              </h3>
              <p className="text-xs text-brand-muted mt-1.5">{cat.desc}</p>
              <span className="absolute bottom-8 right-8 w-8 h-px bg-brand-fence transition-all duration-300 group-hover:w-12 group-hover:bg-primary-500/50" />
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
