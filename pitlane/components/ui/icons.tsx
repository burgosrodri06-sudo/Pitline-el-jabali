import type { SVGProps } from "react";

// Familia única de iconos de PitLane: trazo de 1.7, esquinas redondeadas, 24×24.
// Decorativos por defecto (aria-hidden); el texto que los acompaña lleva el significado.
type Props = SVGProps<SVGSVGElement> & { size?: number };
function icon(path: string) {
  return function Icon({ size = 24, ...props }: Props) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        {...props}
      >
        <path d={path} />
      </svg>
    );
  };
}
export const ArrowRight = icon("M4 12h16m-6-6 6 6-6 6");
export const ArrowLeft = icon("M20 12H4m6-6-6 6 6 6");
export const ArrowUpRight = icon("M6 18 18 6M6 6h12v12");
export const ChevronLeft = icon("m15 5-7 7 7 7");
export const ChevronRight = icon("m9 5 7 7-7 7");
export const ChevronDown = icon("m5 9 7 7 7-7");
export const Check = icon("m5 12 4 4L19 6");
export const Flag = icon("M4 21V3h15l-3 5 3 5H4");
export const Clock3 = icon("M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18M12 7v5h4");
export const CalendarDays = icon(
  "M4 5h16v16H4ZM8 3v4m8-4v4M4 10h16m-11 4h1m4 0h1m-6 3h1m4 0h1",
);
export const MapPin = icon(
  "M12 21S5 14 5 9a7 7 0 0 1 14 0c0 5-7 12-7 12ZM12 7a2 2 0 1 0 0 4 2 2 0 0 0 0-4",
);
export const Menu = icon("M4 6h16M4 12h16M4 18h16");
export const Close = icon("M6 6l12 12M18 6 6 18");
export const User = icon("M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8m-7 9a7 7 0 0 1 14 0");
export const LogOut = icon("M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10");
export const Ticket = icon(
  "M3 7h18v3a2 2 0 0 0 0 4v3H3v-3a2 2 0 0 0 0-4ZM14 7v10",
);
export const QrCode = icon(
  "M4 4h6v6H4ZM14 4h6v6h-6ZM4 14h6v6H4ZM14 14h2v2h-2ZM18 18h2v2h-2ZM14 18h2M18 14h2",
);
export const ScanLine = icon(
  "M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M4 12h16",
);
export const CreditCard = icon("M3 6h18v12H3ZM3 10h18M7 15h3");
export const Upload = icon("M12 16V4m-5 5 5-5 5 5M4 16v4h16v-4");
export const Download = icon("M12 4v12m-5-5 5 5 5-5M4 16v4h16v-4");
export const CheckCircle = icon("M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18M8 12l3 3 5-6");
export const XCircle = icon("M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18M9 9l6 6m0-6-6 6");
export const AlertTriangle = icon("M12 3 2 20h20ZM12 10v4m0 3v.01");
export const Info = icon("M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18M12 11v5m0-8v.01");
export const Hourglass = icon("M6 3h12M6 21h12M7 3c0 5 10 6 10 9s-10 4-10 9M17 3c0 5-10 6-10 9s10 4 10 9");
export const Users = icon(
  "M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7m-6 9a6 6 0 0 1 12 0M16 4.5a3.5 3.5 0 0 1 0 6.5M18 14a6 6 0 0 1 3 6",
);
export const Wallet = icon("M3 6h16v14H3ZM3 6l13-3v3M15 13h2");
export const Grid = icon("M4 4h7v7H4ZM13 4h7v7h-7ZM4 13h7v7H4ZM13 13h7v7h-7Z");
export const BarChart = icon("M4 20h16M7 16v-5m5 5V6m5 10v-8");
export const Package = icon("M12 3 3 7.5v9L12 21l9-4.5v-9ZM3 7.5 12 12l9-4.5M12 12v9");
