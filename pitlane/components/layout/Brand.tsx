import Link from "next/link";

// Marca PitLane: logotipo condensado con acento rojo y el contexto debajo.
export default function Brand({ context = "El Jabalí", href = "/karting/kartingrentalexperience" }: { context?: string; href?: string }) {
  return (
    <Link href={href} className="group flex shrink-0 items-center gap-2.5" aria-label={`PitLane · ${context}`}>
      <span aria-hidden="true" className="h-7 w-1.5 -skew-x-12 bg-brand transition-transform duration-[var(--pl-dur)] group-hover:scale-y-110" />
      <span className="leading-none">
        <span className="block font-display text-xl font-bold sm:text-2xl uppercase italic tracking-tight">
          Pit<span className="text-brand-text">Lane</span>
        </span>
        <span className="mt-0.5 block text-[10px] font-semibold uppercase tracking-[0.22em] text-muted">{context}</span>
      </span>
    </Link>
  );
}
