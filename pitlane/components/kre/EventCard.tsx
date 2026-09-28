"use client";
import { cx } from "./styles";
import type { KartingEvent } from "@/domain/events/types";
import { dateLabel } from "@/lib/catalog";
export function EventCard({
  event,
  selected,
  onSelect,
}: {
  event: KartingEvent;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  return (
    <button
      type="button"
      className={cx(`row event-row ${selected ? "selected" : ""}`)}
      aria-pressed={selected}
      onClick={() => onSelect(event.id)}
    >
      <span className={cx("num")}>
        {dateLabel(event.date, { day: "numeric", month: "short" })}
      </span>
      <span className={cx("event-day")}>
        {dateLabel(event.date, { weekday: "long" })}
      </span>
      <span className={cx("muted")}>
        {event.status === "open" ? "Abierto" : "Inscripciones cerradas"}
      </span>
    </button>
  );
}
