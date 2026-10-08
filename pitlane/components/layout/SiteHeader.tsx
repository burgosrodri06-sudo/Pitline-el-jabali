import Link from "next/link";
import { barlowCondensed } from "@/components/auth/fonts";
import UserMenu from "@/components/layout/UserMenu";

// Header de las páginas públicas y de piloto. Mobile-first: a 360 px todo va en una línea.
export default function SiteHeader() {
  return (
    <header className="border-b border-[#2A2A2A] bg-[#0A0A0A] text-[#F4F4F4]">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-5 py-4 sm:gap-4">
        <Link href="/karting/kartingrentalexperience" className={`${barlowCondensed.className} shrink-0 text-2xl font-bold`}>
          PitLane
        </Link>
        <nav aria-label="Principal" className="flex min-w-0 items-center gap-3 sm:gap-4">
          <Link
            href="/karting/kartingrentalexperience/reservar"
            className="whitespace-nowrap text-sm font-medium hover:text-[#C8102E]"
          >
            Reservar
          </Link>
          <UserMenu />
        </nav>
      </div>
    </header>
  );
}
