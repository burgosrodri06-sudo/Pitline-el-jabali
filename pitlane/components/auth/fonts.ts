import { Barlow, Barlow_Condensed } from "next/font/google";

// Fuentes del sistema: Barlow (texto) y Barlow Condensed (títulos). El layout raíz expone las variables CSS.
export const barlow = Barlow({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-barlow" });
export const barlowCondensed = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--font-barlow-condensed",
});
