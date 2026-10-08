import type { Metadata } from "next";
import type { ReactNode } from "react";

// La página es client component, así que el título va aquí.
export const metadata: Metadata = { title: "Crear cuenta | PitLane" };

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
