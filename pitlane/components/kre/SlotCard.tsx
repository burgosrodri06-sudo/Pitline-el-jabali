"use client";
import { cx } from "./styles";
import type { Slot } from "@/domain/events/types";
import { timeLabel } from "@/lib/catalog";
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
  return (
    <button
      type="button"
      className={cx(`slot-card ${selected ? "selected" : ""}`)}
      disabled={disabled}
      aria-pressed={selected}
      onClick={() => onSelect(slot.id)}
    >
      <strong>{timeLabel(slot.startsAt)}</strong>
      <span>{slot.durationMinutes} minutos</span>
      <small
        className={cx(
          disabled ? "muted" : slot.availableSeats <= 3 ? "amber" : "green",
        )}
      >
        {slot.status === "closed"
          ? "Cerrada"
          : slot.availableSeats <= 0
            ? "Agotada"
            : `${slot.availableSeats} cupos disponibles`}
      </small>
    </button>
  );
}
