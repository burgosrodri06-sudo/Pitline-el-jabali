"use client";
import { cx } from "./styles";
import type { KartingEvent } from "@/domain/events/types";
import { dateLabel } from "@/lib/catalog";
import { ArrowUpRight } from "@/components/ui/icons";
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
      className={cx(`event-card ${selected ? "selected" : ""}`)}
      aria-pressed={selected}
      onClick={() => onSelect(event.id)}
    >
      <span className={cx("date-tile")}>
        <b>{event.date.slice(-2)}</b>
        <span>{dateLabel(event.date, { month: "short" })}</span>
      </span>
      <span>
        <small>{dateLabel(event.date, { weekday: "long" })}</small>
        <strong>{event.name}</strong>
        <span className={cx("muted")}>
          {event.status === "open" ? "Ver horarios" : "Inscripciones cerradas"}
        </span>
      </span>
      <ArrowUpRight size={20} aria-hidden="true" />
    </button>
  );
}
