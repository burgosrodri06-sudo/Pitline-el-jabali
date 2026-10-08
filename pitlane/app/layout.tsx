import type { Metadata } from "next";
import { barlow, barlowCondensed } from "@/components/auth/fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: "PitLane · El Jabalí",
  description: "Reserva tu turno de karting en el Autódromo El Jabalí.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={`${barlow.variable} ${barlowCondensed.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
