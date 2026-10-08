// Visual-only fixtures, never imported by production code or database services.
export class OperationError extends Error {}
export const now = Date.parse("2026-10-09T23:00:00Z");
export const localToday = () => "2026-10-09";
export const operationTime = async () => now;
const slot = {
  id: "00000000-0000-4000-8000-000000000011",
  startsAt: "2026-10-10T00:00:00Z",
  endsAt: "2026-10-10T00:10:00Z",
  capacity: 10,
  status: "available",
  eventDate: "2026-10-09",
  eventStatus: "open",
  closed: false,
};
const participant = {
  id: "p1",
  fullName: "María López",
  isHolder: true,
  firstRideParticipantId: null,
  attendance: null,
};
const payment = {
  id: "00000000-0000-4000-8000-000000000013",
  amount: 15,
  method: "bank_transfer",
  status: "uploaded",
  reference: "BANCO-20261009-001",
  last4: "4521",
  receiptPath: "test/receipt.png",
  createdAt: "2026-10-09T22:00:00Z",
  rejectionReason: null,
};
const reservation = {
  id: "00000000-0000-4000-8000-000000000012",
  code: "KRE-PRUEBA",
  userId: "u1",
  slotId: slot.id,
  packageId: "individual",
  amount: 15,
  spots: 1,
  status: "paid",
  qrToken: "00000000-0000-4000-8000-000000000014",
  createdAt: "2026-10-09T22:00:00Z",
  channel: "web",
  slot,
  packageName: "Individual",
  holderName: "María López",
  participants: [participant],
  payments: [{ ...payment, status: "approved" }],
};
export const getMyReservations = async () => ({
  reservations: [reservation],
  total: 1,
});
export const getMyCredits = async () => [
  {
    id: "c1",
    amount: 15,
    reason: "Cancelación por lluvia",
    usedReservationId: null,
  },
];
export const getReservationAccess = async () => reservation;
export const getPaymentsForReview = async () => ({
  payments: [
    { ...payment, reservation: { ...reservation, status: "payment_review" } },
  ],
  total: 1,
});
export const getOperationSlots = async () => [slot];
export const getSlotAttendance = async () => [reservation];
export const getTrackAvailability = async () => 7;
export const getSecondRideCandidates = async () => [
  { id: "p1", fullName: "María López", code: "KRE-PRUEBA" },
];
export const getPackages = async () => [
  {
    id: "individual",
    name: "Individual",
    price: 15,
    spots: 1,
    active: true,
    eligibility: "none",
    validFrom: null,
    validTo: null,
  },
  {
    id: "second",
    name: "Segunda vuelta",
    price: 10,
    spots: 1,
    active: true,
    eligibility: "requires_first_ride",
    validFrom: null,
    validTo: null,
  },
];
export const getReports = async () => ({
  summary: {
    capacity: 10,
    bookedParticipants: 6,
    checkedInParticipants: 5,
    noShowParticipants: 1,
    occupancyPercent: 60,
    noShowPercent: 16.7,
    revenueCents: 9000,
    webRevenueCents: 5000,
    trackCashRevenueCents: 4000,
    creditsIssuedCents: 1500,
    packagesSold: { individual: 6 },
  },
  facts: { slots: [slot], reservations: [reservation] },
});
