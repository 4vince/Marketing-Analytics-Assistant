"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import Link from "next/link";

interface CarouselProduct {
  id: string;
  name: string;
  slug: string;
  price: number;
  images: string[];
  category: string;
}

interface ProductCarouselProps {
  products: CarouselProduct[];
  title: string;
  subtitle?: string;
}

function ArrowLeft({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}

function ArrowRight({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 18l6-6-6-6" />
    </svg>
  );
}

export default function ProductCarousel({ products, title, subtitle }: ProductCarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const interactionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const updateScrollState = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 10);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 10);
    setScrollProgress(el.scrollLeft / (el.scrollWidth - el.clientWidth));
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    updateScrollState();
    el.addEventListener("scroll", updateScrollState);
    window.addEventListener("resize", updateScrollState);
    return () => {
      el.removeEventListener("scroll", updateScrollState);
      window.removeEventListener("resize", updateScrollState);
    };
  }, [updateScrollState]);

  const scroll = useCallback((direction: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;
    const cardWidth = el.querySelector("a")?.offsetWidth ?? 280;
    const gap = 16;
    const scrollAmount = (cardWidth + gap) * 1;
    const maxScroll = el.scrollWidth - el.clientWidth;

    if (direction === "right" && el.scrollLeft >= maxScroll - 10) {
      // Wrap around to start
      el.scrollTo({ left: 0, behavior: "smooth" });
    } else {
      el.scrollBy({
        left: direction === "left" ? -scrollAmount : scrollAmount,
        behavior: "smooth",
      });
    }
  }, []);

  const handleInteraction = useCallback(() => {
    setIsPaused(true);
    if (interactionTimer.current) clearTimeout(interactionTimer.current);
    interactionTimer.current = setTimeout(() => setIsPaused(false), 4000);
  }, []);

  // Auto-rotate every 4 seconds unless paused
  useEffect(() => {
    if (isPaused || products.length === 0) return;
    const id = setInterval(() => scroll("right"), 4000);
    return () => clearInterval(id);
  }, [isPaused, scroll, products.length]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (interactionTimer.current) clearTimeout(interactionTimer.current);
    };
  }, []);

  if (products.length === 0) return null;

  return (
    <section
      className="relative"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {/* Header */}
      <div className="flex items-end justify-between mb-8">
        <div>
          <h2 className="text-2xl sm:text-3xl font-display font-semibold text-brand-warm-white tracking-tight">
            {title}
          </h2>
          {subtitle && (
            <p className="text-sm text-brand-muted mt-1.5 max-w-md">{subtitle}</p>
          )}
        </div>

        {/* Desktop arrow controls */}
        <div className="hidden sm:flex items-center gap-2">
          <button
            onClick={() => { scroll("left"); handleInteraction(); }}
            disabled={!canScrollLeft}
            className="w-9 h-9 rounded-lg border border-brand-fence flex items-center justify-center text-brand-muted hover:text-brand-warm-white hover:border-brand-muted/40 transition-all duration-200 disabled:opacity-20 disabled:cursor-not-allowed"
            aria-label="Scroll left"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => { scroll("right"); handleInteraction(); }}
            disabled={!canScrollRight}
            className="w-9 h-9 rounded-lg border border-brand-fence flex items-center justify-center text-brand-muted hover:text-brand-warm-white hover:border-brand-muted/40 transition-all duration-200 disabled:opacity-20 disabled:cursor-not-allowed"
            aria-label="Scroll right"
          >
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Carousel track */}
      <div
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto scroll-smooth snap-x snap-mandatory -mx-6 px-6 pb-4"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        <style>{`
          .carousel-scrollbar::-webkit-scrollbar { display: none; }
        `}</style>
        {products.map((product, i) => (
          <Link
            key={product.id}
            href={`/products/${product.slug}`}
            className="group snap-start shrink-0 w-[240px] sm:w-[260px] bg-brand-clay border border-brand-fence rounded-xl overflow-hidden transition-all duration-300 hover:border-brand-muted/30"
            style={{ animationDelay: `${i * 60}ms` }}
          >
            {/* Image */}
            <div className="aspect-[4/5] bg-brand-risen overflow-hidden">
              {product.images[0] ? (
                <img
                  src={product.images[0]}
                  alt={product.name}
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                  loading="lazy"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <svg className="w-10 h-10 text-brand-fence" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1}>
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <path d="M21 15l-5-5L5 21" />
                  </svg>
                </div>
              )}
            </div>

            {/* Info */}
            <div className="p-4 space-y-1.5">
              <p className="text-[10px] font-medium text-brand-muted uppercase tracking-widest font-body">
                {product.category}
              </p>
              <h3 className="text-sm font-display font-semibold text-brand-warm-white leading-snug transition-colors duration-200 group-hover:text-primary-500 line-clamp-2">
                {product.name}
              </h3>
              <p className="font-mono text-sm text-primary-500 font-medium tabular-nums">
                ${(product.price / 100).toFixed(2)}
              </p>
            </div>
          </Link>
        ))}
      </div>

      {/* Scroll progress dots */}
      <div className="flex items-center justify-center gap-1.5 mt-4">
        {Array.from({ length: Math.max(1, Math.ceil(products.length / 2)) }).map((_, i) => {
          const seg = 1 / Math.ceil(products.length / 2);
          const active = scrollProgress >= seg * i - seg * 0.3 && scrollProgress < seg * (i + 1) + seg * 0.3;
          return (
            <button
              key={i}
              onClick={() => {
                handleInteraction();
                const el = scrollRef.current;
                if (!el) return;
                const targets = el.querySelectorAll("a");
                const idx = Math.min(i * 2, targets.length - 1);
                targets[idx]?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "start" });
              }}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                active
                  ? "w-6 bg-brand-muted/60"
                  : "w-1.5 bg-brand-fence hover:bg-brand-muted/30"
              }`}
              aria-label={`Go to slide ${i + 1}`}
            />
          );
        })}
      </div>
    </section>
  );
}
