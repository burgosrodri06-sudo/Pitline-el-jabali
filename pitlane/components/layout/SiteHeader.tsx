import Brand from "@/components/layout/Brand";
import NavLink from "@/components/layout/NavLink";
import UserMenu from "@/components/layout/UserMenu";
import { headerLinkClass } from "@/components/layout/nav-styles";

// Header de las páginas públicas y de piloto. Mobile-first: a 360 px todo va en una línea.
export default function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-background/90 text-ink backdrop-blur supports-[backdrop-filter]:bg-background/75">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2.5 sm:gap-6 sm:px-6">
        <Brand />
        <nav aria-label="Principal" className="flex min-w-0 items-center gap-4 sm:gap-6">
          <NavLink href="/karting/kartingrentalexperience/reservar" className={headerLinkClass}>
            Reservar
          </NavLink>
          <UserMenu />
        </nav>
      </div>
    </header>
  );
}
