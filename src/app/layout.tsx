// Root layout — minimal shell (html/body/providers). Storefront chrome (Header/Footer/ChatWidget)
// lives in (storefront)/layout.tsx so admin pages don't inherit it.
import type { Metadata } from "next";
// @ts-ignore: allow importing global CSS in app layout
import "./globals.css";
import { ToastProvider } from "@/components/ui/Toast";
import VantaBackground from "@/components/storefront/VantaBackground";

export const metadata: Metadata = {
  title: "Chickenoodle",
  description: "E-commerce template",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col bg-brand-pitch text-brand-warm-white relative">
        <div className="grain-overlay" />
        <VantaBackground />
        <div className="relative z-10 flex flex-col min-h-screen">
          <ToastProvider>
            {children}
          </ToastProvider>
        </div>
      </body>
    </html>
  );
}
