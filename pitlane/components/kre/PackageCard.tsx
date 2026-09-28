"use client";
import { cx } from "./styles";
import type { Package } from "@/domain/events/types";
import { money } from "@/lib/catalog";
// One package row. `seatsLeft` is the selected slot's availability, when known,
// so an oversized package explains itself before the driver tries to commit.
export function PackageCard({
  item,
  selected,
  seatsLeft,
  onSelect,
}: {
  item: Package;
  selected: boolean;
  seatsLeft?: number;
  onSelect: (id: string) => void;
}) {
  const fits = seatsLeft === undefined || seatsLeft >= item.participants;
  return (
    <button
      type="button"
      className={cx(`row package-row ${selected ? "selected" : ""}`)}
      disabled={!item.active || !fits}
      aria-pressed={selected}
      onClick={() => onSelect(item.id)}
    >
      <span className={cx("package-name")}>
        <strong>{item.name}</strong>
        <span className={cx("muted")}>
          {item.participants} {item.participants === 1 ? "kart" : "karts"} ·{" "}
          {item.sessionsPerPerson}{" "}
          {item.sessionsPerPerson === 1 ? "tanda" : "tandas"} de{" "}
          {item.minutesPerSession} min
        </span>
        {!fits && (
          <span className={cx("row-note")}>
            Necesita {item.participants} karts; esta tanda tiene {seatsLeft}.
          </span>
        )}
      </span>
      <span className={cx("num price")}>{money(item.priceCents)}</span>
    </button>
  );
}
