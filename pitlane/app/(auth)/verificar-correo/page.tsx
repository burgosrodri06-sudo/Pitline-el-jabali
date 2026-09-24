"use client";

import Link from "next/link";
import { useState } from "react";
import { AuthTitle, primaryButton } from "@/components/auth/ui";

export default function VerificarCorreoPage() {
  const [resent, setResent] = useState(false);

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
        <Link href="/login" className={`${primaryButton} block text-center`}>
          Ya verifiqué mi correo
        </Link>

        {/* TODO: reenviar con Supabase Auth. Por ahora solo cambia el mensaje. */}
        <button
          type="button"
          onClick={() => setResent(true)}
          disabled={resent}
          className="w-full rounded-md border border-[#2A2A2A] px-4 py-3 text-base font-semibold disabled:text-[#A3A3A3]"
        >
          {resent ? "Correo reenviado" : "Reenviar correo"}
        </button>
      </div>
    </>
  );
}
