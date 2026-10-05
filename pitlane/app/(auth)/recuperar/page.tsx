"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { AuthField, AuthTitle, primaryButton } from "@/components/auth/ui";
import { createClient } from "@/lib/supabase/client";
import { translateAuthError } from "../errors";

export default function RecuperarPage() {
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const email = String(new FormData(e.currentTarget).get("email") ?? "").trim();

    if (!email.includes("@")) {
      setError("Escribe un correo válido.");
      return;
    }

    const { error } = await createClient().auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/nueva-contrasena`,
    });
    if (error) {
      setError(translateAuthError(error));
      return;
    }

    setError("");
    setSent(true);
  }

  if (sent) {
    return (
      <>
        {/* El mensaje no confirma si la cuenta existe, para no revelar qué correos están registrados. */}
        <AuthTitle
          title="Revisa tu correo"
          subtitle="Si hay una cuenta con ese correo, te enviamos un enlace para crear una contraseña nueva."
        />
        <Link href="/login" className={`${primaryButton} block text-center`}>
          Volver a iniciar sesión
        </Link>
      </>
    );
  }

  return (
    <>
      <AuthTitle title="Recupera tu contraseña" subtitle="Te enviaremos un enlace para crear una nueva." />

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <AuthField label="Correo" name="email" type="email" autoComplete="email" error={error} />
        <button type="submit" className={primaryButton}>
          Enviar enlace
        </button>
      </form>

      <p className="mt-8 text-center text-sm">
        <Link href="/login" className="text-[#A3A3A3] underline">
          Volver a iniciar sesión
        </Link>
      </p>
    </>
  );
}
