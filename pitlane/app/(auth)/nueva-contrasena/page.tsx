"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { AuthField, AuthTitle, primaryButton } from "@/components/auth/ui";
import { updatePassword } from "@/services/auth.service";
import { translateAuthError } from "../errors";

// Pantalla a la que llega el usuario desde el enlace de "Olvidé mi contraseña".
// El cliente de Supabase canjea el ?code= del enlace por una sesión al cargar la página.
export default function NuevaContrasenaPage() {
  const [errors, setErrors] = useState<{ password?: string; confirm?: string }>({});
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const password = String(data.get("password") ?? "");
    const confirm = String(data.get("confirm") ?? "");

    const next: { password?: string; confirm?: string } = {};
    if (password.length < 8) next.password = "Usa al menos 8 caracteres.";
    if (confirm !== password) next.confirm = "Las contraseñas no coinciden.";

    setErrors(next);
    if (Object.keys(next).length > 0) return;

    const { error } = await updatePassword(password);
    if (error) {
      setError(translateAuthError(error));
      return;
    }

    setError("");
    setSaved(true);
  }

  if (saved) {
    return (
      <>
        <AuthTitle title="Contraseña actualizada" subtitle="Ya puedes iniciar sesión con tu contraseña nueva." />
        <Link href="/login" className={`${primaryButton} block text-center`}>
          Iniciar sesión
        </Link>
      </>
    );
  }

  return (
    <>
      <AuthTitle title="Crea una contraseña nueva" subtitle="Usa al menos 8 caracteres." />

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <AuthField label="Contraseña nueva" name="password" type="password" autoComplete="new-password" error={errors.password} />
        <AuthField label="Confirma tu contraseña" name="confirm" type="password" autoComplete="new-password" error={errors.confirm} />
        {error && <p className="text-sm text-danger">{error}</p>}
        <button type="submit" className={`${primaryButton} mt-2`}>
          Guardar contraseña
        </button>
      </form>
    </>
  );
}
