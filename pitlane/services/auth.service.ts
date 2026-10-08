// Dueño: Carlos
// Todas las llamadas a Supabase Auth desde el navegador. Las pantallas solo usan estas funciones.
// En el servidor (Server Components) usa @/lib/auth.
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/types/database";
import type { UserRole } from "@/types";

type SignUpData = { name: string; email: string; phone: string; password: string };

// Los enlaces de los correos vuelven a esta app.
const origin = () => window.location.origin;

// Después de verificar el correo vuelve a /login, conservando ?next= si viene de una reserva.
const loginUrl = (next?: string | null) =>
  next ? `${origin()}/login?next=${encodeURIComponent(next)}` : `${origin()}/login`;

export async function signUp({ name, email, phone, password }: SignUpData, next?: string | null) {
  // full_name y phone van a user metadata; el trigger los copia a public.profiles.
  const { error } = await createClient().auth.signUp({
    email,
    password,
    options: {
      data: { full_name: name, phone },
      emailRedirectTo: loginUrl(next),
    },
  });
  // Si el correo ya existe, respondemos igual que con uno nuevo para no revelarlo.
  if (error?.code === "user_already_exists" || error?.code === "email_exists") return { error: null };
  return { error };
}

export async function signIn(email: string, password: string) {
  const { data, error } = await createClient().auth.signInWithPassword({ email, password });
  return { user: data.user, error };
}

export async function signOut() {
  return createClient().auth.signOut();
}

export async function getCurrentUser() {
  const {
    data: { user },
  } = await createClient().auth.getUser();
  return user;
}

// Llama a callback al suscribirse y cada vez que se inicia o se cierra sesión (también en otra pestaña).
// Devuelve la función para dejar de escuchar.
export function onAuthChange(callback: () => void) {
  const {
    data: { subscription },
    // setTimeout: Supabase se puede bloquear si se llama a auth dentro de este callback.
  } = createClient().auth.onAuthStateChange(() => setTimeout(callback, 0));
  return () => subscription.unsubscribe();
}

export async function requestPasswordReset(email: string) {
  return createClient().auth.resetPasswordForEmail(email, {
    redirectTo: `${origin()}/nueva-contrasena`,
  });
}

export async function resendVerification(email: string, next?: string | null) {
  return createClient().auth.resend({
    type: "signup",
    email,
    options: { emailRedirectTo: loginUrl(next) },
  });
}

export async function updatePassword(password: string) {
  return createClient().auth.updateUser({ password });
}

export async function getProfile(userId: string): Promise<Profile | null> {
  const { data } = await createClient()
    .from("profiles")
    .select("id, full_name, phone, role, created_at")
    .eq("id", userId)
    .single<{ id: string; full_name: string | null; phone: string | null; role: UserRole; created_at: string }>();
  if (!data) return null;
  return {
    id: data.id,
    fullName: data.full_name,
    phone: data.phone,
    role: data.role,
    createdAt: data.created_at,
  };
}
