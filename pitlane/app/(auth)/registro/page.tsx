"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { AuthField, AuthTitle, PasswordField, primaryButton } from "@/components/auth/ui";
import { signUp } from "@/services/auth.service";
import { translateAuthError } from "../errors";
import { useNextPath, withNext } from "@/lib/auth/next-path";

type Errors = Partial<Record<"name" | "email" | "phone" | "password" | "confirm" | "terms", string>>;

// Requisitos de la contraseña; se marcan mientras el usuario escribe.
const PASSWORD_RULES = [
  { label: "Mínimo 8 caracteres", test: (p: string) => p.length >= 8 },
  { label: "Una letra", test: (p: string) => /[a-zA-Z]/.test(p) },
  { label: "Un número", test: (p: string) => /[0-9]/.test(p) },
];

export default function RegistroPage() {
  const router = useRouter();
  const nextPath = useNextPath();
  const [errors, setErrors] = useState<Errors>({});
  const [error, setError] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const name = String(data.get("name") ?? "").trim();
    const email = String(data.get("email") ?? "").trim();
    const phone = String(data.get("phone") ?? "").trim();
    const confirm = String(data.get("confirm") ?? "");
    const terms = data.get("terms") === "on";

    // Validaciones simples, una por campo.
    const next: Errors = {};
    if (!name) next.name = "Escribe tu nombre completo.";
    if (!email.includes("@")) next.email = "Escribe un correo válido.";
    if (phone.replace(/\D/g, "").length < 8) next.phone = "Escribe un teléfono de 8 dígitos.";
    if (!PASSWORD_RULES.every((rule) => rule.test(password))) next.password = "La contraseña no cumple los requisitos.";
    if (confirm !== password) next.confirm = "Las contraseñas no coinciden.";
    if (!terms) next.terms = "Debes aceptar los términos y la política de privacidad.";

    setErrors(next);
    setError("");
    if (Object.keys(next).length > 0) return;

    setLoading(true);
    const { error } = await signUp({ name, email, phone, password }, nextPath);
    if (error) {
      setError(translateAuthError(error));
      setLoading(false);
      return;
    }

    // Guardamos el correo (y el next, si viene de una reserva) para verificar-correo (no van en la URL).
    try {
      sessionStorage.setItem("pitlane:signup-email", email);
      if (nextPath) sessionStorage.setItem("pitlane:signup-next", nextPath);
      else sessionStorage.removeItem("pitlane:signup-next");
    } catch {
      // Sin sessionStorage, verificar-correo le pide el correo al usuario.
    }
    router.push("/verificar-correo");
  }

  return (
    <>
      <AuthTitle title="Crea tu cuenta" subtitle="La necesitas para reservar tu turno en pista." />

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <AuthField label="Nombre completo" name="name" autoComplete="name" error={errors.name} />
        <AuthField label="Correo" name="email" type="email" autoComplete="email" error={errors.email} />
        <AuthField label="Teléfono" name="phone" type="tel" autoComplete="tel" error={errors.phone} />
        <div>
          <PasswordField
            label="Contraseña"
            name="password"
            autoComplete="new-password"
            error={errors.password}
            onChange={setPassword}
          />
          <ul className="mt-2 space-y-1 text-sm" aria-label="Requisitos de la contraseña">
            {PASSWORD_RULES.map((rule) => {
              const ok = rule.test(password);
              return (
                <li key={rule.label} className={ok ? "text-[#7BD88F]" : "text-[#A3A3A3]"}>
                  <span aria-hidden="true">{ok ? "✓" : "○"}</span> {rule.label}
                  <span className="sr-only">{ok ? " (cumplido)" : " (pendiente)"}</span>
                </li>
              );
            })}
          </ul>
        </div>
        <PasswordField label="Confirma tu contraseña" name="confirm" autoComplete="new-password" error={errors.confirm} />

        <div>
          <label className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              name="terms"
              aria-invalid={errors.terms ? true : undefined}
              className="mt-0.5 h-5 w-5 shrink-0 accent-[#C8102E]"
            />
            <span>Acepto los términos y condiciones y la política de privacidad.</span>
          </label>
          {errors.terms && <span className="mt-1 block text-sm text-[#FF6B6B]">{errors.terms}</span>}
        </div>

        {error && <p className="text-sm text-[#FF6B6B]">{error}</p>}

        <button type="submit" disabled={loading} className={`${primaryButton} mt-2`}>
          {loading ? "Creando cuenta..." : "Crear cuenta"}
        </button>
      </form>

      <p className="mt-8 text-center text-sm text-[#A3A3A3]">
        ¿Ya tienes cuenta?{" "}
        <Link href={withNext("/login", nextPath)} className="font-semibold text-[#F4F4F4] underline">
          Inicia sesión
        </Link>
      </p>
    </>
  );
}
