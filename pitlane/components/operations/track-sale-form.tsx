"use client";
import { useState } from "react";
import { trackSaleAction } from "@/app/operations-actions";
import { ActionForm } from "./action-form";
import styles from "./operations.module.css";
type Package = { id: string; name: string; price: number; eligibility: string };
export function TrackSaleForm({
  slotId,
  packages,
  candidates,
  requestId,
}: {
  slotId: string;
  packages: Package[];
  candidates: { id: string; fullName: string; code: string }[];
  requestId: string;
}) {
  const [attemptId] = useState(requestId);
  const [packageId, setPackageId] = useState(
    packages.find((p) => p.eligibility === "none")?.id ?? packages[0]?.id ?? "",
  );
  const [participantId, setParticipantId] = useState("");
  const selected = packages.find((p) => p.id === packageId);
  const secondRide = selected?.eligibility === "requires_first_ride";
  return (
    <ActionForm
      action={trackSaleAction}
      label="Registrar efectivo y confirmar venta"
      confirm="¿Recibiste el efectivo correspondiente? Se emitirá una reserva pagada."
    >
      <input type="hidden" name="slotId" value={slotId} />
      <input type="hidden" name="requestId" value={attemptId} />
      <label className={styles.label}>
        Paquete
        <select
          className={styles.input}
          name="packageId"
          value={packageId}
          onChange={(e) => {
            setPackageId(e.target.value);
            setParticipantId("");
          }}
          required
        >
          {packages.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} — ${p.price.toFixed(2)}
            </option>
          ))}
        </select>
      </label>
      {secondRide ? (
        <>
          <label className={styles.label}>
            Participante con primera vuelta completada
            <select
              className={styles.input}
              name="firstParticipantId"
              value={participantId}
              onChange={(e) => setParticipantId(e.target.value)}
              required
            >
              <option value="">Selecciona al participante</option>
              {candidates.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.fullName} · {p.code}
                </option>
              ))}
            </select>
          </label>
          <input
            type="hidden"
            name="name"
            value={
              candidates.find((p) => p.id === participantId)?.fullName ?? ""
            }
          />
          {!candidates.length && (
            <p className={styles.error}>
              Todavía no hay participantes con primera vuelta completada hoy.
            </p>
          )}
        </>
      ) : (
        <label className={styles.label}>
          Nombre del participante
          <input
            className={styles.input}
            name="name"
            required
            maxLength={120}
            autoComplete="name"
          />
        </label>
      )}
      <p className={styles.muted}>
        Método: efectivo en pista · 1 participante · 10 minutos
      </p>
      <p className={styles.metric}>${selected?.price.toFixed(2) ?? "0.00"}</p>
    </ActionForm>
  );
}
