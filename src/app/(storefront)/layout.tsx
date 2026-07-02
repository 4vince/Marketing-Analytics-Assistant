// Storefront layout — renders Header, Footer, and ChatWidget for customer-facing pages only.
// Admin pages use their own layout (src/app/admin/layout.tsx) which has a sidebar instead.
import Header from "@/components/storefront/Header";
import Footer from "@/components/storefront/Footer";
import ChatWidget from "@/components/storefront/ChatWidget";

export default function StorefrontLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
      <ChatWidget />
    </>
  );
}
