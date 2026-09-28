"use client";
import { cx } from "./styles";
import type { Slot } from "@/domain/events/types";
import { timeLabel } from "@/lib/catalog";
// One timing-sheet row: start time, duration, and neutral availability.
export function SlotCard({
  slot,
  selected,
  onSelect,
}: {
  slot: Slot;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  const disabled = slot.status !== "open" || slot.availableSeats <= 0;
  const status =
    slot.status === "closed"
      ? "Cerrada"
      : slot.availableSeats <= 0
        ? "Agotada"
        : `${slot.availableSeats} de ${slot.capacity} karts libres`;
  return (
    <button
      type="button"
      className={cx(`row slot-row ${selected ? "selected" : ""}`)}
      disabled={disabled}
      aria-pressed={selected}
      aria-label={`${timeLabel(slot.startsAt)}, ${slot.durationMinutes} minutos, ${status}`}
      onClick={() => onSelect(slot.id)}
    >
      <span className={cx("num")}>{timeLabel(slot.startsAt)}</span>
      <span className={cx("muted")}>{slot.durationMinutes} min</span>
      <span className={cx("meter")} aria-hidden="true">
        <span
          style={{
            width: `${(Math.max(slot.availableSeats, 0) / slot.capacity) * 100}%`,
          }}
        />
      </span>
      <span className={cx("slot-status")}>{status}</span>
    </button>
  );
}
