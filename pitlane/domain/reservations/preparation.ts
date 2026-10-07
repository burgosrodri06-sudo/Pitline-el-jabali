import type { ReservationPreparation } from "./types.ts";

export const PARTICIPANT_NAME_MAX_LENGTH = 120;

type PreparationErrors = Readonly<{
  participants: readonly (string | null)[];
  participantCount: string | null;
  waiver: string | null;
}>;

export type PreparationResult =
  | Readonly<{ valid: true; data: ReservationPreparation; errors: PreparationErrors }>
  | Readonly<{ valid: false; errors: PreparationErrors }>;

/**
 * Validación de preparación; no autoriza reservas ni calcula cupos.
 * El conteo viene del catálogo temporal en la UI; la futura RPC deberá volver a
 * obtenerlo del paquete confiable y validar todo antes de persistir.
 */
export function validateReservationPreparation(
  draft: ReservationPreparation,
  expectedParticipantCount: number,
): PreparationResult {
  const participants = draft.participants.map(({ fullName }) => ({ fullName: fullName.trim() }));
  const errors: PreparationErrors = {
    participantCount:
      !Number.isInteger(expectedParticipantCount) || expectedParticipantCount < 1 || expectedParticipantCount > 10
        ? "Seleccioná un paquete válido."
        : participants.length !== expectedParticipantCount
          ? `Se necesitan exactamente ${expectedParticipantCount} participantes.`
          : null,
    participants: participants.map(({ fullName }) => {
      if (!fullName) return "Escribí el nombre completo del participante.";
      if (fullName.length > PARTICIPANT_NAME_MAX_LENGTH) return `Usá como máximo ${PARTICIPANT_NAME_MAX_LENGTH} caracteres.`;
      return null;
    }),
    waiver: draft.waiverAccepted === true ? null : "Debés aceptar las reglas de esta selección.",
  };

  if (errors.participantCount || errors.waiver || errors.participants.some(Boolean)) {
    return { valid: false, errors };
  }
  return { valid: true, data: { participants, waiverAccepted: true }, errors };
}
