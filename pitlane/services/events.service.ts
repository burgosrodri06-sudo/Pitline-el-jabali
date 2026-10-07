import "server-only";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import {
  localToday,
  validateEvent,
  type EventInput,
  type EventRow,
} from "@/domain/events/inventory";
import { checkDatabaseError } from "./inventory.service";
export async function getPublishedEvents(): Promise<EventRow[]> {
  const db = await createClient();
  const { data, error } = await db
    .from("events")
    .select("*")
    .in("status", ["open", "closed", "cancelled"])
    .gte("date", localToday())
    .order("date")
    .order("start_time");
  checkDatabaseError(error);
  return data ?? [];
}
export async function getAdminEvents(): Promise<EventRow[]> {
  await requireAdmin();
  const db = await createClient();
  const { data, error } = await db
    .from("events")
    .select("*")
    .order("date", { ascending: false })
    .order("start_time");
  checkDatabaseError(error);
  return data ?? [];
}
export async function createEvent(input: EventInput) {
  const { user } = await requireAdmin();
  validateEvent(input);
  const db = await createClient();
  const { data, error } = await db
    .from("events")
    .insert({ ...input, created_by: user.id })
    .select()
    .single();
  checkDatabaseError(error);
  return data as EventRow;
}
export async function updateEvent(id: string, input: EventInput) {
  await requireAdmin();
  validateEvent(input);
  const db = await createClient();
  const { data, error } = await db
    .from("events")
    .update(input)
    .eq("id", id)
    .select()
    .single();
  checkDatabaseError(error);
  return data as EventRow;
}
export async function setEventStatus(id: string, status: EventRow["status"]) {
  await requireAdmin();
  if (!["draft", "open", "closed", "cancelled"].includes(status))
    throw new Error("Estado inválido.");
  const db = await createClient();
  const { data, error } = await db
    .from("events")
    .update({ status })
    .eq("id", id)
    .select()
    .single();
  checkDatabaseError(error);
  return data as EventRow;
}
export async function cancelEvent(id: string) {
  return setEventStatus(id, "cancelled");
}
