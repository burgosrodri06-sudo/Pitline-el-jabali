'use server';

import { createReservation } from '@/lib/services/reservations';
import { runReservationSubmission, testBookingEnabled } from '@/domain/reservations/submission';

export async function submitReservation(input: unknown) {
  return runReservationSubmission(input, testBookingEnabled(process.env), createReservation);
}
