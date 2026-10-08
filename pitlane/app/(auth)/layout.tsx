import type { ReactNode } from "react";
import { barlow } from "@/components/auth/fonts";
import SiteHeader from "@/components/layout/SiteHeader";

// Layout compartido por las pantallas de auth. El header es el mismo SiteHeader del resto del sitio.
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className={`${barlow.className} min-h-dvh bg-[#0A0A0A] text-[#F4F4F4]`}>
      <div className="h-1 bg-[#C8102E]" />
      <SiteHeader />
      <main className="mx-auto max-w-md px-5 pt-6 pb-12">{children}</main>
    </div>
  );
}
