"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { AuthField, AuthTitle, PasswordField, primaryButton } from "@/components/auth/ui";
import { getHomeForRole } from "@/lib/auth/home";
import { getProfile, resendVerification, signIn } from "@/services/auth.service";
import { translateAuthError } from "../errors";
import { useNextPath, withNext } from "@/lib/auth/next-path";
import { ActiveSessionGate } from "@/components/auth/ActiveSessionGate";

export default function LoginPage() {
  const router = useRouter();
  const nextPath = useNextPath();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  // Correo de una cuenta sin verificar: muestra el botón "Reenviar correo".
  const [unverifiedEmail, setUnverifiedEmail] = useState("");
  const [resend, setResend] = useState<"idle" | "sending" | "sent">("idle");

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const email = String(data.get("email") ?? "").trim();
    const password = String(data.get("password") ?? "");

    setUnverifiedEmail("");
    setResend("idle");
    if (!email || !password) {
      setError("Ingresa tu correo y tu contraseña.");
      return;
    }

    setLoading(true);
    const { user, error } = await signIn(email, password);
    if (error || !user) {
      if (error?.code === "email_not_confirmed") {
        setUnverifiedEmail(email);
        setError("");
      } else {
        setError(error ? translateAuthError(error) : "Algo salió mal. Inténtalo de nuevo.");
      }
      setLoading(false);
      return;
    }

    // Sin ?next=, cada rol va a su pantalla de inicio.
    const destination = nextPath ?? getHomeForRole((await getProfile(user.id))?.role ?? "pilot");
    router.push(destination);
    router.refresh();
  }

  async function handleResend() {
    setResend("sending");
    const { error } = await resendVerification(unverifiedEmail, nextPath);
    if (error) {
      setError(translateAuthError(error));
      setResend("idle");
      return;
    }
    setError("");
    setResend("sent");
  }

  return (
    <ActiveSessionGate>
    <>
      <AuthTitle title="Inicia sesión" subtitle="Para continuar con tu reserva." />

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <AuthField label="Correo" name="email" type="email" autoComplete="email" />
        <PasswordField label="Contraseña" name="password" autoComplete="current-password" />

        {unverifiedEmail && (
          <div role="alert" className="rounded-md border border-line bg-surface p-4 text-sm">
            <p>Primero verifica tu correo con el enlace que te enviamos a {unverifiedEmail}.</p>
            <button
              type="button"
              onClick={handleResend}
              disabled={resend !== "idle"}
              className="mt-3 w-full rounded-md border border-line px-4 py-3 text-base font-semibold disabled:text-muted"
            >
              {resend === "sending" ? "Enviando..." : resend === "sent" ? "Correo reenviado" : "Reenviar correo"}
            </button>
          </div>
        )}

        {error && <p className="text-sm text-danger">{error}</p>}

        <div className="text-right">
          <Link href="/recuperar-contrasena" className="text-sm text-muted underline">
            Olvidé mi contraseña
          </Link>
        </div>

        <button type="submit" disabled={loading} className={primaryButton}>
          {loading ? "Ingresando..." : "Iniciar sesión"}
        </button>
      </form>

      <p className="mt-8 text-center text-sm text-muted">
        ¿No tienes cuenta?{" "}
        <Link href={withNext("/registro", nextPath)} className="font-semibold text-ink underline">
          Crea una
        </Link>
      </p>
    </>
    </ActiveSessionGate>
  );
}
