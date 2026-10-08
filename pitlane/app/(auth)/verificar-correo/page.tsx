"use client";

import Link from "next/link";
import { useState, useSyncExternalStore, type FormEvent } from "react";
import { AuthField, AuthTitle, primaryButton } from "@/components/auth/ui";
import { resendVerification } from "@/services/auth.service";
import { translateAuthError } from "../errors";
import { safeNextPath, useNextPath, withNext } from "@/lib/auth/next-path";

// registro guarda el correo en sessionStorage antes de redirigir aquí.
function readSignupEmail() {
  try {
    return sessionStorage.getItem("pitlane:signup-email") ?? "";
  } catch {
    return ""; // Sin sessionStorage: se le pide el correo al usuario.
  }
}

function readSignupNext() {
  try {
    return safeNextPath(sessionStorage.getItem("pitlane:signup-next"));
  } catch {
    return null;
  }
}

const noSubscribe = () => () => {};

export default function VerificarCorreoPage() {
  const [resent, setResent] = useState(false);
  const [error, setError] = useState("");
  // null en el servidor; "" = no hay correo guardado y se muestra el campo.
  const storedEmail = useSyncExternalStore(noSubscribe, readSignupEmail, () => null);
  const storedNext = useSyncExternalStore(noSubscribe, readSignupNext, () => null);
  const nextPath = useNextPath() ?? storedNext;

  async function handleResend(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const email = storedEmail || String(new FormData(e.currentTarget).get("email") ?? "").trim();
    if (!email.includes("@")) {
      setError("Escribe un correo válido.");
      return;
    }

    const { error } = await resendVerification(email, nextPath);

    if (error) {
      setError(translateAuthError(error));
      return;
    }

    setError("");
    setResent(true);
  }

  return (
    <>
      <AuthTitle
        title="Revisa tu correo"
        subtitle="Te enviamos un enlace para verificar tu cuenta. Ábrelo desde tu teléfono y vuelve aquí."
      />

      <div className="rounded-md border border-[#2A2A2A] bg-[#1A1A1A] p-4 text-sm text-[#A3A3A3]">
        Si no lo ves en unos minutos, revisa la carpeta de spam o promociones.
      </div>

      <div className="mt-6 space-y-3">
        <Link href={withNext("/login", nextPath)} className={`${primaryButton} block text-center`}>
          Ya verifiqué mi correo
        </Link>

        <form onSubmit={handleResend} noValidate className="space-y-3">
          {storedEmail === "" && <AuthField label="Correo" name="email" type="email" autoComplete="email" />}

          <button
            type="submit"
            disabled={resent}
            className="w-full rounded-md border border-[#2A2A2A] px-4 py-3 text-base font-semibold disabled:text-[#A3A3A3]"
          >
            {resent ? "Correo reenviado" : "Reenviar correo"}
          </button>
        </form>

        {error && <p className="text-sm text-[#FF6B6B]">{error}</p>}
      </div>
    </>
  );
}
