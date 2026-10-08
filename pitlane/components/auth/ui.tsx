"use client";

import { useState, type ReactNode } from "react";
import { buttonClass } from "@/components/ui/button";
import { FieldError, inputClass, labelClass } from "@/components/ui/form";

// Clase del botón principal, reutilizada en todas las pantallas de auth.
export const primaryButton = buttonClass({ size: "lg", block: true });

export function AuthTitle({ title, subtitle }: { title: string; subtitle?: ReactNode }) {
  return (
    <div className="mb-7 animate-enter">
      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-brand-text">PitLane · El Jabalí</p>
      <h1 className="font-display text-4xl font-bold uppercase leading-none tracking-tight">{title}</h1>
      {subtitle && <p className="mt-3 text-muted">{subtitle}</p>}
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
      <span className={labelClass}>{label}</span>
      <input
        name={name}
        type={type}
        autoComplete={autoComplete}
        defaultValue={defaultValue}
        aria-invalid={error ? true : undefined}
        className={inputClass}
      />
      <FieldError>{error}</FieldError>
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
      <label htmlFor={name} className={labelClass}>
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
          className={`${inputClass} pr-20`}
        />
        <button
          type="button"
          onClick={() => setVisible(!visible)}
          aria-pressed={visible}
          aria-label={visible ? `Ocultar ${label.toLowerCase()}` : `Mostrar ${label.toLowerCase()}`}
          className="absolute inset-y-0 right-0 px-3 text-sm font-medium text-muted transition-colors hover:text-ink"
        >
          {visible ? "Ocultar" : "Mostrar"}
        </button>
      </div>
      <FieldError>{error}</FieldError>
    </div>
  );
}
