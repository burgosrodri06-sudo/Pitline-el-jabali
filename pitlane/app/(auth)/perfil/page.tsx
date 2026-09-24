"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { AuthField, AuthTitle, primaryButton } from "@/components/auth/ui";

// Datos de ejemplo mientras no hay Supabase.
// TODO: reemplazar por getCurrentUser() cuando se conecte Supabase Auth.
const mockUser = {
  name: "Piloto de prueba",
  email: "piloto@correo.com",
  phone: "7000-0000",
};

export default function PerfilPage() {
  const router = useRouter();
  const [errors, setErrors] = useState<{ name?: string; phone?: string }>({});
  const [saved, setSaved] = useState(false);

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const name = String(data.get("name") ?? "").trim();
    const phone = String(data.get("phone") ?? "").trim();

    const next: { name?: string; phone?: string } = {};
    if (!name) next.name = "Escribe tu nombre completo.";
    if (phone.replace(/\D/g, "").length < 8) next.phone = "Escribe un teléfono de 8 dígitos.";

    setErrors(next);
    if (Object.keys(next).length > 0) {
      setSaved(false);
      return;
    }

    // TODO: guardar los cambios en Supabase.
    setSaved(true);
  }

  function handleLogout() {
    // TODO: cerrar sesión con Supabase Auth.
    router.push("/login");
  }

  return (
    <>
      <AuthTitle title="Tu perfil" subtitle="Estos datos se usan en tus reservas y en tu check-in." />

      <form onSubmit={handleSubmit} onChange={() => setSaved(false)} noValidate className="space-y-4">
        <AuthField label="Nombre completo" name="name" autoComplete="name" defaultValue={mockUser.name} error={errors.name} />
        <AuthField label="Teléfono" name="phone" type="tel" autoComplete="tel" defaultValue={mockUser.phone} error={errors.phone} />

        {/* El correo no se edita aquí: cambiarlo requiere verificarlo de nuevo. */}
        <div>
          <span className="mb-1.5 block text-sm font-medium">Correo</span>
          <p className="rounded-md border border-[#2A2A2A] px-3 py-3 text-[#A3A3A3]">{mockUser.email}</p>
        </div>

        <button type="submit" className={`${primaryButton} mt-2`}>
          Guardar cambios
        </button>
        {saved && (
          <p role="status" className="text-center text-sm text-[#7BD88F]">
            Cambios guardados.
          </p>
        )}
      </form>

      <button
        type="button"
        onClick={handleLogout}
        className="mt-8 w-full rounded-md border border-[#2A2A2A] px-4 py-3 text-base font-semibold"
      >
        Cerrar sesión
      </button>
    </>
  );
}
