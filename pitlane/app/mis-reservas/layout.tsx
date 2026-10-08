import type { ReactNode } from "react";
import SiteHeader from "@/components/layout/SiteHeader";

// Header compartido de las páginas públicas y de piloto.
export default function Layout({ children }: { children: ReactNode }) {
  return (
    <>
      <SiteHeader />
      {children}
    </>
  );
}
