import type { SVGProps } from "react";
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
export const ArrowUpRight = icon("M6 18 18 6M6 6h12v12");
export const ChevronLeft = icon("m15 5-7 7 7 7");
export const ChevronRight = icon("m9 5 7 7-7 7");
export const Check = icon("m5 12 4 4L19 6");
export const Flag = icon("M4 21V3h15l-3 5 3 5H4");
export const Clock3 = icon("M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18M12 7v5h4");
export const CalendarDays = icon(
  "M4 5h16v16H4ZM8 3v4m8-4v4M4 10h16m-11 4h1m4 0h1m-6 3h1m4 0h1",
);
export const MapPin = icon(
  "M12 21S5 14 5 9a7 7 0 0 1 14 0c0 5-7 12-7 12ZM12 7a2 2 0 1 0 0 4 2 2 0 0 0 0-4",
);
