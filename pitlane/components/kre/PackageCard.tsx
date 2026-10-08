"use client";
import { cx } from "./styles";
import type { Package } from "@/domain/events/types";
import { Check, ArrowUpRight } from "./Icons";
export function PackageCard({
  item,
  selected,
  onSelect,
}: {
  item: Package;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  return (
    <article className={cx(`package-card ${selected ? "selected" : ""}`)}>
      <small className={cx("eyebrow")}>
        {item.participants > 1
          ? "COMPARTE LA EXPERIENCIA"
          : "TU TIEMPO EN PISTA"}
      </small>
      <h3>{item.name}</h3>
      <p className={cx("price")}>
        {new Intl.NumberFormat("es-SV", {
          style: "currency",
          currency: "USD",
          minimumFractionDigits: 2,
        }).format(item.priceCents / 100)}
        <span> / paquete</span>
      </p>
      <p>
        <Check size={16} aria-hidden="true" /> {item.participants}{" "}
        {item.participants === 1 ? "persona" : "personas"}
      </p>
      <p>
        <Check size={16} aria-hidden="true" /> {item.sessionsPerPerson}{" "}
        {item.sessionsPerPerson === 1 ? "tanda" : "tandas"} por persona ·{" "}
        {item.minutesPerSession} min c/u
      </p>
      <button
        className={cx("button secondary")}
        disabled={!item.active || item.eligibility !== 'none'}
        aria-pressed={selected}
        onClick={() => onSelect(item.id)}
      >
        {item.eligibility !== 'none' ? 'Disponible en pista tras la primera vuelta' : selected ? "Paquete seleccionado" : "Elegir paquete"}
        <ArrowUpRight size={17} aria-hidden="true" />
      </button>
    </article>
  );
}
