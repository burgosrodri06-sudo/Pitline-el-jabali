import type { ReactNode } from "react";
import Link from "next/link";
import { barlow, barlowCondensed } from "@/components/auth/fonts";

// Layout compartido por login, registro, verificar-correo y recuperar-contrasena.
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className={`${barlow.className} min-h-dvh bg-[#0A0A0A] text-[#F4F4F4]`}>
      <div className="h-1 bg-[#C8102E]" />
      <header className="mx-auto flex max-w-md items-baseline justify-between px-5 py-5">
        <Link href="/" className={`${barlowCondensed.className} text-2xl font-bold`}>
          PitLane
        </Link>
        <span className="text-sm text-[#A3A3A3]">Autódromo El Jabalí</span>
      </header>
      <main className="mx-auto max-w-md px-5 pb-12">{children}</main>
    </div>
  );
}
