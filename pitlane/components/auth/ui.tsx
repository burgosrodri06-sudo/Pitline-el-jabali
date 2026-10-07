"use client";

import { useState, type ReactNode } from "react";
import { barlowCondensed } from "./fonts";

// Clase del botón principal, reutilizada en todas las pantallas de auth.
export const primaryButton =
  "w-full rounded-md bg-[#C8102E] px-4 py-3 text-base font-semibold text-white " +
  "hover:bg-[#A50D26] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F4F4F4] " +
  "disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-[#C8102E]";

export function AuthTitle({ title, subtitle }: { title: string; subtitle?: ReactNode }) {
  return (
    <div className="mb-6">
      <h1 className={`${barlowCondensed.className} text-4xl font-bold leading-tight`}>{title}</h1>
      {subtitle && <p className="mt-2 text-[#A3A3A3]">{subtitle}</p>}
    </div>
  );
}

type FieldProps = {
  label: string;
  name: string;
  type?: string;
  autoComplete?: string;
  error?: string;
  defaultValue?: string;
};

export function AuthField({ label, name, type = "text", autoComplete, error, defaultValue }: FieldProps) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium">{label}</span>
      {/* text-base (16px) evita que iOS haga zoom al tocar el input */}
      <input
        name={name}
        type={type}
        autoComplete={autoComplete}
        defaultValue={defaultValue}
        aria-invalid={error ? true : undefined}
        className={
          "w-full rounded-md border bg-[#1A1A1A] px-3 py-3 text-base outline-none " +
          "focus:border-[#C8102E] focus:ring-2 focus:ring-[#C8102E]/40 " +
          (error ? "border-[#FF6B6B]" : "border-[#2A2A2A]")
        }
      />
      {error && <span className="mt-1 block text-sm text-[#FF6B6B]">{error}</span>}
    </label>
  );
}

type PasswordFieldProps = {
  label: string;
  name: string;
  autoComplete: string;
  error?: string;
  onChange?: (value: string) => void;
};

// Igual que AuthField, con botón para mostrar u ocultar la contraseña.
export function PasswordField({ label, name, autoComplete, error, onChange }: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);
  return (
    <div>
      <label htmlFor={name} className="mb-1.5 block text-sm font-medium">
        {label}
      </label>
      <div className="relative">
        <input
          id={name}
          name={name}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          onChange={onChange && ((e) => onChange(e.target.value))}
          aria-invalid={error ? true : undefined}
          className={
            "w-full rounded-md border bg-[#1A1A1A] py-3 pl-3 pr-20 text-base outline-none " +
            "focus:border-[#C8102E] focus:ring-2 focus:ring-[#C8102E]/40 " +
            (error ? "border-[#FF6B6B]" : "border-[#2A2A2A]")
          }
        />
        <button
          type="button"
          onClick={() => setVisible(!visible)}
          aria-pressed={visible}
          aria-label={visible ? `Ocultar ${label.toLowerCase()}` : `Mostrar ${label.toLowerCase()}`}
          className="absolute inset-y-0 right-0 px-3 text-sm font-medium text-[#A3A3A3] hover:text-[#F4F4F4]"
        >
          {visible ? "Ocultar" : "Mostrar"}
        </button>
      </div>
      {error && <span className="mt-1 block text-sm text-[#FF6B6B]">{error}</span>}
    </div>
  );
}
