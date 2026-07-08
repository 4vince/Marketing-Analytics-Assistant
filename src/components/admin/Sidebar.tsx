"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const links = [
  { href: "/admin", label: "Dashboard", icon: "⬡" },
  { href: "/admin/products", label: "Products", icon: "⊞" },
  { href: "/admin/orders", label: "Orders", icon: "☰" },
  { href: "/admin/marketing", label: "Marketing", icon: "⚲" },
  { href: "/admin/competitors", label: "Competitors", icon: "◉" },
  { href: "/admin/audit", label: "Audit", icon: "◈" },
  { href: "/admin/chat", label: "Chat", icon: "💬" },
];

export default function Sidebar() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === "/admin"
      ? pathname === "/admin"
      : pathname.startsWith(href);

  return (
    <>
      {/* Mobile toggle */}
      <button
        onClick={() => setOpen(!open)}
        className="lg:hidden fixed top-2 left-2 z-50 bg-brand-clay border border-brand-fence rounded-xl p-2.5 shadow-xl text-brand-warm-white hover:bg-brand-risen transition-colors"
        aria-label="Toggle sidebar"
      >
        {open ? (
          <span className="text-lg leading-none">&times;</span>
        ) : (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
          </svg>
        )}
      </button>

      {/* Overlay on mobile */}
      {open && (
        <div className="lg:hidden fixed inset-0 bg-black/60 z-30 backdrop-blur-sm" onClick={() => setOpen(false)} />
      )}

      <aside
        className={`
          fixed lg:static inset-y-0 left-0 z-40 w-64 bg-brand-pitch border-r border-brand-fence p-6
          transform transition-transform duration-300
          ${open ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
          flex flex-col
        `}
      >
        {/* Brand */}
        <Link
          href="/admin"
          className="flex items-center gap-3 mb-10 group"
          onClick={() => setOpen(false)}
        >
          <div className="w-9 h-9 bg-primary-500 rounded-xl flex items-center justify-center text-brand-warm-white font-display font-bold text-base transition-transform group-hover:scale-105">
            C
          </div>
          <span className="font-display text-lg font-semibold text-brand-warm-white">
            Admin
          </span>
        </Link>

        {/* Navigation */}
        <nav className="flex flex-col gap-0.5 flex-1">
          {links.map((link) => {
            const active = isActive(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="group relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200"
              >
                {/* Active left bar */}
                <span
                  className={`absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r-full transition-all duration-200 ${
                    active
                      ? "bg-primary-500 opacity-100"
                      : "bg-transparent opacity-0 group-hover:opacity-40 group-hover:bg-brand-muted"
                  }`}
                />
                <span
                  className={`text-base w-5 text-center transition-colors duration-200 ${
                    active ? "text-primary-500" : "text-brand-muted group-hover:text-brand-warm-white"
                  }`}
                >
                  {link.icon}
                </span>
                <span
                  className={`transition-colors duration-200 ${
                    active
                      ? "text-primary-500"
                      : "text-brand-muted group-hover:text-brand-warm-white"
                  }`}
                >
                  {link.label}
                </span>
              </Link>
            );
          })}
        </nav>

        {/* Divider */}
        <div className="h-px bg-brand-fence/50 mt-auto mb-4" />

        {/* Back to store */}
        <Link
          href="/"
          className="group flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm text-brand-muted hover:text-brand-warm-white hover:bg-brand-risen transition-all duration-200"
        >
          <svg className="w-4 h-4 transition-transform duration-200 group-hover:-translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
          </svg>
          Storefront
        </Link>
      </aside>
    </>
  );
}
