import type { ReactNode } from "react";
import SiteHeader from "@/components/layout/SiteHeader";

// Layout compartido por las pantallas de auth. El header es el mismo SiteHeader del resto del sitio.
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-background text-ink">
      <SiteHeader />
      <main className="mx-auto max-w-md px-4 pt-10 pb-16 sm:px-6 sm:pt-16">{children}</main>
    </div>
  );
}
