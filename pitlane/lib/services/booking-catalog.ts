import 'server-only';
import { createClient } from '@/lib/supabase/server';
import type { EventDate, Slot, Package } from '@/app/reservar/booking-data';

export type BookingCatalog = { eventDates: EventDate[]; slots: Slot[]; packages: Package[] };

/** Shared schema projections; availability comes only from the official view. */
export async function getBookingCatalog(): Promise<BookingCatalog> {
  const client = await createClient();
  const [events, slots, packages, availability] = await Promise.all([
    client.from('events').select('id,date').eq('status', 'open').order('date'),
    client.from('slots').select('id,event_id,starts_at,ends_at,capacity').eq('status', 'available').gt('starts_at', new Date().toISOString()).order('starts_at'),
    client.from('packages').select('id,name,price,spots,valid_from,valid_to,duration_minutes').eq('active', true).eq('eligibility', 'none').in('spots', [1, 5]),
    client.from('slot_availability').select('slot_id,available_spots'),
  ]);
  if ([events, slots, packages, availability].some(r => r.error)) throw new Error('catalog_unavailable');
  const available = new Map((availability.data ?? []).map(row => [row.slot_id, row.available_spots]));
  const dates = (events.data ?? []).map(row => ({ id: row.id, date: row.date }));
  return {
    eventDates: dates,
    slots: (slots.data ?? []).filter(row => dates.some(e => e.id === row.event_id)).map(row => {
      const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'America/El_Salvador', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(row.starts_at)).split(':');
      return { id: row.id, eventDateId: row.event_id, startMinutes: Number(parts[0]) * 60 + Number(parts[1]),
        remainingKarts: Math.max(0, available.get(row.id) ?? 0), startsAt: row.starts_at, endsAt: row.ends_at, capacity: row.capacity };
    }),
    packages: (packages.data ?? []).map(row => ({ id: row.id, name: row.name, price: Number(row.price), karts: row.spots,
      description: `${row.spots} participante${row.spots === 1 ? '' : 's'} en la misma tanda.`, validFrom: row.valid_from, validTo: row.valid_to, durationMinutes: row.duration_minutes })),
  };
}
