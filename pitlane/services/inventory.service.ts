import "server-only";
export function checkDatabaseError(
  error: { message: string; code?: string } | null,
) {
  if (!error) return;
  if (error.code === "42501")
    throw new Error(
      "Tu cuenta necesita el rol KRE Admin y las políticas de administración aplicadas.",
    );
  if (error.code === "PGRST202")
    throw new Error(
      "Falta aplicar la migración de administración KRE en Supabase.",
    );
  throw new Error(error.message);
}
