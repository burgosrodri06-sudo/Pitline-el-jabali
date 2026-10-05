import "server-only";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import {
  localToday,
  validatePackage,
  type PackageInput,
  type PackageRow,
} from "@/domain/events/inventory";
import { checkDatabaseError } from "./inventory.service";
export async function getPackages(
  admin = false,
  date = localToday(),
): Promise<PackageRow[]> {
  if (admin) await requireAdmin();
  const db = await createClient();
  let query = db.from("packages").select("*").order("price");
  if (!admin)
    query = query
      .eq("active", true)
      .or("valid_from.is.null,valid_from.lte." + date)
      .or("valid_to.is.null,valid_to.gte." + date);
  const { data, error } = await query;
  checkDatabaseError(error);
  return (data ?? []).map((p) => ({ ...p, price: Number(p.price) }));
}
export async function createPackage(input: PackageInput) {
  await requireAdmin();
  validatePackage(input);
  const db = await createClient();
  const { data, error } = await db
    .from("packages")
    .insert(input)
    .select()
    .single();
  checkDatabaseError(error);
  return data;
}
export async function updatePackage(id: string, input: PackageInput) {
  await requireAdmin();
  validatePackage(input);
  const db = await createClient();
  const { data, error } = await db
    .from("packages")
    .update(input)
    .eq("id", id)
    .select()
    .single();
  checkDatabaseError(error);
  return data;
}
export async function setPackageActive(id: string, active: boolean) {
  await requireAdmin();
  const db = await createClient();
  const { data, error } = await db
    .from("packages")
    .update({ active })
    .eq("id", id)
    .select()
    .single();
  checkDatabaseError(error);
  return data;
}
