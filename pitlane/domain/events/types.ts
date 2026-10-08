export interface KartingEvent {
  id: string;
  date: string;
  name: string;
  status: "open" | "closed";
}
export interface Slot {
  id: string;
  eventId: string;
  startsAt: string;
  durationMinutes: number;
  capacity: number;
  availableSeats: number;
  status: "open" | "closed";
}
export interface Package {
  id: string;
  name: string;
  priceCents: number;
  participants: number;
  sessionsPerPerson: number;
  minutesPerSession: number;
  active: boolean;
  eligibility: 'none' | 'requires_first_ride';
  validFrom: string | null;
  validTo: string | null;
}
export interface Catalog {
  events: KartingEvent[];
  slots: Slot[];
  packages: Package[];
}
