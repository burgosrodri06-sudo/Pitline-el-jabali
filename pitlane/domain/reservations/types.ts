/**
 * Contrato de dominio del bloque inicial de reservas, todavía sin persistencia.
 * No son tipos generados de Supabase ni validadores de entradas externas.
 * Las referencias a slot/package y el contrato RPC esperan el esquema de KRE.
 * Ver docs/RESERVATION_ENGINE.md antes de conectar estos tipos al backend.
 */
export type ReservationStatus =
  | "pending_payment"
  | "payment_review"
  | "paid"
  | "cancelled"
  | "expired"
  | "attended"
  | "no_show";

/** Valores históricos que solo podrá construir la DB desde un paquete real. */
export type ReservationSnapshot = Readonly<{
  packageName: string;
  /** Total del paquete en centavos enteros; no es el precio por participante. */
  totalPriceCents: number;
  currency: "USD";
  /** Cupos consumidos en una única tanda; entero de 1 a 10. */
  spotsRequired: number;
}>;

/** Entrada no confiable: la RPC deberá normalizar y validar el nombre. */
export type ReservationParticipantInput = Readonly<{
  fullName: string;
}>;

/** Núcleo del intento; deliberadamente no acepta precio, cupos ni propietario. */
export type ReservationIntentCore = Readonly<{
  /** UUID nuevo por intento; se conserva al reintentar el mismo contenido. */
  idempotencyKey: string;
  participants: readonly ReservationParticipantInput[];
  waiverAccepted: boolean;
  waiverVersion: string;
}>;

/** Borrador local: todavía sin versión oficial de waiver ni intento persistible. */
export type ReservationPreparation = Pick<
  ReservationIntentCore,
  "participants" | "waiverAccepted"
>;

/**
 * Campos propios de la vertical. No representa una reserva completa ni una fila
 * insertable: faltan las relaciones de catálogo, que no se deben inventar.
 * Los timestamps se serializarán en ISO 8601 desde timestamptz de PostgreSQL.
 */
export type ReservationCore = Readonly<{
  id: string;
  userId: string;
  status: ReservationStatus;
  snapshot: ReservationSnapshot;
  createdAt: string;
  expiresAt: string;
  waiverAcceptedAt: string;
  waiverVersion: string;
}>;

/** El orden preserva la lista enviada, incluso cuando dos nombres coinciden. */
export type ReservationParticipantSnapshot = Readonly<{
  id: string;
  reservationId: string;
  /** Posición entera desde 1 hasta spotsRequired. */
  position: number;
  fullName: string;
}>;
