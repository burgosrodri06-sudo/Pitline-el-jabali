"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { AuthField, AuthTitle, primaryButton } from "@/components/auth/ui";
import { createClient } from "@/lib/supabase/client";
import { signOut } from "@/services/auth.service";
import { translateAuthError } from "../errors";

type Props = {
  userId: string;
  name: string;
  email: string;
  phone: string;
};

export default function PerfilForm({ userId, name: initialName, email, phone: initialPhone }: Props) {
  const router = useRouter();
  const [errors, setErrors] = useState<{ name?: string; phone?: string }>({});
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const name = String(data.get("name") ?? "").trim();
    const phone = String(data.get("phone") ?? "").trim();

    const next: { name?: string; phone?: string } = {};
    if (!name) next.name = "Escribe tu nombre completo.";
    if (phone.replace(/\D/g, "").length < 8) next.phone = "Escribe un teléfono de 8 dígitos.";

    setErrors(next);
    setError("");
    if (Object.keys(next).length > 0) {
      setSaved(false);
      return;
    }

    const { error } = await createClient()
      .from("profiles")
      .update({ full_name: name, phone })
      .eq("id", userId);

    if (error) {
      setError(translateAuthError(error));
      return;
    }

    setSaved(true);
  }

  async function handleLogout() {
    await signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <>
      <AuthTitle title="Tu perfil" subtitle="Estos datos se usan en tus reservas y en tu check-in." />

      <form onSubmit={handleSubmit} onChange={() => setSaved(false)} noValidate className="space-y-4">
        <AuthField label="Nombre completo" name="name" autoComplete="name" defaultValue={initialName} error={errors.name} />
        <AuthField label="Teléfono" name="phone" type="tel" autoComplete="tel" defaultValue={initialPhone} error={errors.phone} />

        {/* El correo no se edita aquí: cambiarlo requiere verificarlo de nuevo. */}
        <div>
          <span className="mb-1.5 block text-sm font-medium">Correo</span>
          <p className="rounded-md border border-line px-3 py-3 text-muted">{email}</p>
        </div>

        {error && <p className="text-sm text-danger">{error}</p>}

        <button type="submit" className={`${primaryButton} mt-2`}>
          Guardar cambios
        </button>
        {saved && (
          <p role="status" className="text-center text-sm text-success">
            Cambios guardados.
          </p>
        )}
      </form>

      <button
        type="button"
        onClick={handleLogout}
        className="mt-8 w-full rounded-md border border-line px-4 py-3 text-base font-semibold"
      >
        Cerrar sesión
      </button>
    </>
  );
}
