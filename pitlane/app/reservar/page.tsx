import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getBookingCatalog, type BookingCatalog } from '@/lib/services/booking-catalog';
import { testBookingEnabled } from '@/domain/reservations/submission';
import BookingWizard from "./booking-wizard";
import { resolveBookingSelection } from './booking-form';

export const metadata: Metadata = {
  title: "Reservar | PitLane · El Jabalí",
  description: "Elegí tu fecha, tanda y experiencia de karting en El Jabalí.",
};

export default async function BookingPage({searchParams}: { searchParams: Promise<Record<string,string|string[]|undefined>> }) {
  const query = await searchParams;
  let catalog: BookingCatalog = { eventDates: [], slots: [], packages: [] };
  let catalogError = false;
  try { catalog = await getBookingCatalog(); } catch { catalogError = true; }
  const { initial, invalidSelection } = resolveBookingSelection(query, catalog);
  const user = await getCurrentUser();
  let principalName = "";
  if (user) {
    const supabase = await createClient();
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .maybeSingle<{ full_name: string | null }>();
    const metadataName: unknown = user.user_metadata.full_name;
    // Solo una sugerencia editable, nunca prueba de identidad ni autorización.
    principalName = profile?.full_name?.trim()
      || (typeof metadataName === "string" ? metadataName.trim() : "");
  }
  return <BookingWizard
    key={`${initial.dateId}-${initial.slotId}-${initial.packageId}-${user?.id ?? "guest"}`}
    initial={initial}
    principalName={principalName}
    authenticated={Boolean(user)}
    verified={Boolean(user?.email_confirmed_at)}
    catalog={catalog}
    catalogError={catalogError}
    invalidSelection={!catalogError && invalidSelection}
    bookingEnabled={testBookingEnabled(process.env)}
  />;
}
