"use client";

import { FormEvent, useMemo, useState } from "react";

type PackageId = "individual" | "second" | "friends";
type Step = 1 | 2 | 3;

type KartPackage = {
  id: PackageId;
  name: string;
  price: number;
  description: string;
  detail: string;
  seats: number;
  badge?: string;
};

const packages: KartPackage[] = [
  {
    id: "individual",
    name: "Individual",
    price: 15,
    description: "Tu experiencia en pista.",
    detail: "1 kart · 1 tanda · 10 minutos",
    seats: 1,
    badge: "Más popular",
  },
  {
    id: "second",
    name: "Segunda vuelta",
    price: 10,
    description: "¿Una no fue suficiente?",
    detail: "1 kart · 1 tanda adicional · 10 minutos",
    seats: 1,
  },
  {
    id: "friends",
    name: "Combo amigos",
    price: 50,
    description: "La pista se disfruta más juntos.",
    detail: "5 karts · misma tanda · 10 minutos",
    seats: 5,
    badge: "Mejor valor",
  },
];

const navItems = [
  "Inicio",
  "Circuito",
  "Karting",
  "Pilotos",
  "RevMarket",
  "Eventos",
];

function formatPrice(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);
}

export default function KartingRentalExperiencePage() {
  const [step, setStep] = useState<Step>(1);
  const [selectedPackage, setSelectedPackage] =
    useState<PackageId>("individual");
  const [loading, setLoading] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [form, setForm] = useState({
    name: "",
    email: "",
    card: "",
    expiry: "",
    cvv: "",
  });

  const selected = useMemo(
    () =>
      packages.find((item) => item.id === selectedPackage) ?? packages[0],
    [selectedPackage]
  );

  const reservationCode = useMemo(
    () => `KRE-2026-${Math.floor(1000 + Math.random() * 9000)}`,
    [step]
  );

  function handleCardChange(value: string) {
    const digits = value.replace(/\D/g, "").slice(0, 16);
    const formatted = digits.replace(/(.{4})/g, "$1 ").trim();
    setForm((prev) => ({ ...prev, card: formatted }));
  }

  function handleExpiryChange(value: string) {
    const digits = value.replace(/\D/g, "").slice(0, 4);
    const formatted =
      digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits;

    setForm((prev) => ({ ...prev, expiry: formatted }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!accepted || loading) return;

    setLoading(true);

    setTimeout(() => {
      setLoading(false);
      setStep(3);
      window.scrollTo({ top: 520, behavior: "smooth" });
    }, 2000);
  }

  function resetDemo() {
    setStep(1);
    setSelectedPackage("individual");
    setAccepted(false);
    setForm({
      name: "",
      email: "",
      card: "",
      expiry: "",
      cvv: "",
    });
    window.scrollTo({ top: 520, behavior: "smooth" });
  }

  function sendToWhatsApp() {
    const message = encodeURIComponent(
      `¡Hola! Mi reserva para Karting Rental Experience está confirmada.\n\nCódigo: ${reservationCode}\nPaquete: ${selected.name}\nTotal: ${formatPrice(
        selected.price
      )}`
    );

    window.open(`https://wa.me/?text=${message}`, "_blank", "noopener,noreferrer");
  }

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white selection:bg-[#C8102E] selection:text-white">
      {/* HEADER */}
      <header className="fixed inset-x-0 top-0 z-50 border-b border-zinc-800 bg-[#0a0a0a]/95 backdrop-blur-xl">
        <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between px-5 lg:px-8">
          <a href="#" className="group flex items-center gap-3">
            <div
              className="grid h-10 w-10 place-items-center bg-[#C8102E] text-[11px] font-black tracking-wide"
              style={{
                clipPath:
                  "polygon(0 0, 100% 0, 100% 70%, 70% 100%, 0 100%)",
              }}
            >
              ACES
            </div>

            <div className="leading-none">
              <span className="mb-1 block text-[10px] font-medium uppercase tracking-[0.18em] text-zinc-500">
                Autódromo Internacional
              </span>
              <span className="text-lg font-black uppercase tracking-tight">
                El Jabalí
              </span>
            </div>
          </a>

          <nav className="hidden items-center lg:flex">
            {navItems.map((item) => (
              <a
                key={item}
                href="#"
                className={`relative px-4 py-7 text-sm font-bold uppercase tracking-[0.1em] transition ${
                  item === "Karting"
                    ? "text-white after:absolute after:inset-x-4 after:bottom-0 after:h-[3px] after:bg-[#C8102E]"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                {item}
              </a>
            ))}
          </nav>

          <div className="hidden items-center gap-5 lg:flex">
            <button className="text-sm font-bold uppercase tracking-widest text-zinc-300 transition hover:text-white">
              Iniciar sesión
            </button>
            <button className="bg-[#C8102E] px-5 py-2.5 text-sm font-black uppercase tracking-widest transition hover:bg-[#a90d27]">
              Suscríbete
            </button>
          </div>

          <button
            type="button"
            aria-label="Abrir menú"
            aria-expanded={mobileMenuOpen}
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            className="grid h-11 w-11 place-items-center border border-zinc-800 text-xl lg:hidden"
          >
            {mobileMenuOpen ? "×" : "☰"}
          </button>
        </div>

        {mobileMenuOpen && (
          <nav className="border-t border-zinc-800 bg-[#0a0a0a] px-5 py-4 lg:hidden">
            {navItems.map((item) => (
              <a
                key={item}
                href="#"
                className="block border-b border-zinc-900 py-4 text-sm font-bold uppercase tracking-widest text-zinc-300"
              >
                {item}
              </a>
            ))}
          </nav>
        )}
      </header>

      {/* HERO */}
      <section className="relative overflow-hidden border-b border-zinc-800 pb-16 pt-36 md:pb-24 md:pt-44">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_75%_50%,rgba(200,16,46,0.24),transparent_45%)]" />
        <div className="absolute inset-0 bg-gradient-to-br from-zinc-900/70 via-[#0a0a0a] to-[#21070c]" />

        <svg
          viewBox="0 0 600 400"
          fill="none"
          stroke="currentColor"
          strokeWidth="14"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className="absolute -right-24 top-1/2 w-[700px] -translate-y-1/2 text-white opacity-[0.07]"
        >
          <path d="M90 320 C40 300 30 240 80 210 L190 160 C230 140 240 100 210 80 C180 60 220 30 270 40 L420 70 C480 82 520 120 500 170 C480 215 430 205 410 240 C390 275 430 300 400 330 C370 355 300 340 250 320 C200 300 150 340 90 320 Z" />
        </svg>

        <div className="relative mx-auto max-w-7xl px-5 lg:px-8">
          <p className="mb-3 text-xs font-black uppercase tracking-[0.28em] text-[#e32646] md:text-sm">
            Temporada de campeonato 2026
          </p>

          <h1 className="max-w-5xl text-5xl font-black uppercase leading-[0.88] tracking-[-0.04em] sm:text-6xl md:text-8xl lg:text-[105px]">
            Superando
            <br />
            los límites
          </h1>

          <p className="mt-7 max-w-xl text-base leading-7 text-zinc-400 md:text-lg">
            Viva el automovilismo al más alto nivel en el Autódromo
            Internacional El Jabalí, donde la precisión se encuentra con la
            pasión en la pista.
          </p>
        </div>
      </section>

      {/* EXPERIENCE INTRO */}
      <section className="border-b border-zinc-800 bg-[#101010]">
        <div className="mx-auto grid max-w-7xl gap-8 px-5 py-14 md:grid-cols-[1fr_auto] md:items-end lg:px-8">
          <div>
            <p className="mb-3 text-xs font-black uppercase tracking-[0.25em] text-[#C8102E]">
              División de kartismo
            </p>
            <h2 className="text-4xl font-black uppercase tracking-tight sm:text-5xl">
              Karting Rental
              <br />
              Experience
            </h2>
            <p className="mt-5 max-w-2xl leading-7 text-zinc-400">
              Reserva tu lugar, llega a pista y prepárate para correr. Cada
              participación corresponde a una tanda de 10 minutos.
            </p>
          </div>

          <div className="flex gap-8 border-l border-zinc-800 pl-8">
            <div>
              <strong className="block text-3xl font-black">10</strong>
              <span className="text-xs uppercase tracking-widest text-zinc-500">
                Minutos
              </span>
            </div>
            <div>
              <strong className="block text-3xl font-black">10</strong>
              <span className="text-xs uppercase tracking-widest text-zinc-500">
                Karts máx.
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* CHECKOUT */}
      <section className="relative py-16 md:py-24">
        <div className="mx-auto max-w-6xl px-5 lg:px-8">
          {/* Progress */}
          <div className="mb-12">
            <div className="relative mx-auto flex max-w-2xl items-start justify-between">
              <div className="absolute left-[16.5%] right-[16.5%] top-4 h-px bg-zinc-800">
                <div
                  className="h-full bg-[#C8102E] transition-all duration-500"
                  style={{
                    width:
                      step === 1 ? "0%" : step === 2 ? "50%" : "100%",
                  }}
                />
              </div>

              {[
                { number: 1, label: "Selecciona" },
                { number: 2, label: "Pago" },
                { number: 3, label: "Confirmación" },
              ].map((item) => {
                const active = step >= item.number;

                return (
                  <div
                    key={item.number}
                    className="relative z-10 flex w-1/3 flex-col items-center"
                  >
                    <div
                      className={`grid h-8 w-8 place-items-center border text-xs font-black transition ${
                        active
                          ? "border-[#C8102E] bg-[#C8102E] text-white"
                          : "border-zinc-700 bg-[#0a0a0a] text-zinc-600"
                      }`}
                    >
                      {step > item.number ? "✓" : item.number}
                    </div>
                    <span
                      className={`mt-3 text-[10px] font-bold uppercase tracking-[0.16em] sm:text-xs ${
                        active ? "text-white" : "text-zinc-600"
                      }`}
                    >
                      {item.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* STEP 1 */}
          {step === 1 && (
            <div>
              <div className="mb-9 text-center">
                <p className="mb-2 text-xs font-black uppercase tracking-[0.25em] text-[#C8102E]">
                  Paso 01
                </p>
                <h2 className="text-4xl font-black uppercase tracking-tight md:text-5xl">
                  Elige cómo quieres correr
                </h2>
                <p className="mx-auto mt-4 max-w-xl text-zinc-500">
                  Selecciona una opción para continuar con tu reserva.
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                {packages.map((item) => {
                  const active = selectedPackage === item.id;
                  const secondLap = item.id === "second";

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setSelectedPackage(item.id)}
                      className={`relative min-h-[280px] overflow-hidden border p-7 text-left transition-all duration-200 ${
                        active
                          ? "border-[#C8102E] bg-[#181214] shadow-[0_0_0_1px_#C8102E]"
                          : "border-zinc-800 bg-[#121212] hover:border-zinc-600"
                      }`}
                    >
                      {item.badge && (
                        <span className="absolute right-0 top-0 bg-[#C8102E] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.15em]">
                          {item.badge}
                        </span>
                      )}

                      <div
                        className={`mb-10 grid h-6 w-6 place-items-center rounded-full border ${
                          active
                            ? "border-[#C8102E]"
                            : "border-zinc-600"
                        }`}
                      >
                        {active && (
                          <span className="h-3 w-3 rounded-full bg-[#C8102E]" />
                        )}
                      </div>

                      <h3 className="text-2xl font-black uppercase">
                        {item.name}
                      </h3>
                      <p className="mt-2 text-sm text-zinc-500">
                        {item.description}
                      </p>

                      <div className="mt-7">
                        <span className="text-4xl font-black">
                          ${item.price.toFixed(2)}
                        </span>
                        <span className="ml-2 text-xs font-bold uppercase tracking-widest text-zinc-600">
                          USD
                        </span>
                      </div>

                      <p className="mt-5 border-t border-zinc-800 pt-5 text-xs font-semibold uppercase tracking-wider text-zinc-400">
                        {item.detail}
                      </p>

                      {secondLap && (
                        <p className="mt-3 text-xs leading-5 text-amber-500/80">
                          Disponible únicamente después de realizar tu primera
                          tanda.
                        </p>
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="mt-8 flex justify-center">
                <button
                  type="button"
                  onClick={() => {
                    setStep(2);
                    window.scrollTo({ top: 520, behavior: "smooth" });
                  }}
                  className="group flex min-w-[280px] items-center justify-center gap-4 bg-[#C8102E] px-8 py-4 text-sm font-black uppercase tracking-[0.14em] transition hover:bg-[#a90d27]"
                >
                  Seleccionar y continuar
                  <span className="transition-transform group-hover:translate-x-1">
                    →
                  </span>
                </button>
              </div>
            </div>
          )}

          {/* STEP 2 */}
          {step === 2 && (
            <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
              <div>
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="mb-7 text-xs font-bold uppercase tracking-widest text-zinc-500 transition hover:text-white"
                >
                  ← Cambiar paquete
                </button>

                <div className="mb-8">
                  <p className="mb-2 text-xs font-black uppercase tracking-[0.25em] text-[#C8102E]">
                    Paso 02
                  </p>
                  <h2 className="text-4xl font-black uppercase tracking-tight md:text-5xl">
                    Completa tu reserva
                  </h2>
                  <p className="mt-3 text-zinc-500">
                    Pago seguro · Simulación de checkout
                  </p>
                </div>

                <form
                  onSubmit={handleSubmit}
                  className="border border-zinc-800 bg-[#111] p-5 sm:p-8"
                >
                  <div className="mb-8">
                    <div className="mb-5 flex items-center gap-3">
                      <span className="grid h-7 w-7 place-items-center bg-[#C8102E] text-xs font-black">
                        1
                      </span>
                      <h3 className="text-lg font-black uppercase tracking-wide">
                        Datos del piloto
                      </h3>
                    </div>

                    <div className="grid gap-5 sm:grid-cols-2">
                      <label className="block">
                        <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-zinc-400">
                          Nombre completo
                        </span>
                        <input
                          required
                          autoComplete="name"
                          value={form.name}
                          onChange={(e) =>
                            setForm((prev) => ({
                              ...prev,
                              name: e.target.value,
                            }))
                          }
                          placeholder="Tu nombre"
                          className="h-12 w-full border border-zinc-700 bg-[#090909] px-4 text-sm text-white outline-none transition placeholder:text-zinc-700 focus:border-[#C8102E]"
                        />
                      </label>

                      <label className="block">
                        <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-zinc-400">
                          Correo electrónico
                        </span>
                        <input
                          required
                          type="email"
                          autoComplete="email"
                          value={form.email}
                          onChange={(e) =>
                            setForm((prev) => ({
                              ...prev,
                              email: e.target.value,
                            }))
                          }
                          placeholder="nombre@correo.com"
                          className="h-12 w-full border border-zinc-700 bg-[#090909] px-4 text-sm text-white outline-none transition placeholder:text-zinc-700 focus:border-[#C8102E]"
                        />
                      </label>
                    </div>
                  </div>

                  <div className="border-t border-zinc-800 pt-8">
                    <div className="mb-5 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <span className="grid h-7 w-7 place-items-center bg-[#C8102E] text-xs font-black">
                          2
                        </span>
                        <h3 className="text-lg font-black uppercase tracking-wide">
                          Información de pago
                        </h3>
                      </div>

                      <div className="hidden gap-1.5 sm:flex">
                        {["VISA", "MC"].map((card) => (
                          <span
                            key={card}
                            className="border border-zinc-700 bg-zinc-900 px-2 py-1 text-[9px] font-black text-zinc-400"
                          >
                            {card}
                          </span>
                        ))}
                      </div>
                    </div>

                    <label className="mb-5 block">
                      <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-zinc-400">
                        Número de tarjeta
                      </span>
                      <div className="relative">
                        <input
                          required
                          inputMode="numeric"
                          autoComplete="cc-number"
                          value={form.card}
                          onChange={(e) => handleCardChange(e.target.value)}
                          placeholder="0000 0000 0000 0000"
                          className="h-12 w-full border border-zinc-700 bg-[#090909] px-4 pr-12 text-sm tracking-[0.15em] text-white outline-none transition placeholder:tracking-normal placeholder:text-zinc-700 focus:border-[#C8102E]"
                        />
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-600">
                          ▣
                        </span>
                      </div>
                    </label>

                    <div className="grid grid-cols-2 gap-5">
                      <label>
                        <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-zinc-400">
                          Vencimiento
                        </span>
                        <input
                          required
                          inputMode="numeric"
                          autoComplete="cc-exp"
                          value={form.expiry}
                          onChange={(e) =>
                            handleExpiryChange(e.target.value)
                          }
                          placeholder="MM/AA"
                          className="h-12 w-full border border-zinc-700 bg-[#090909] px-4 text-sm text-white outline-none transition placeholder:text-zinc-700 focus:border-[#C8102E]"
                        />
                      </label>

                      <label>
                        <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-zinc-400">
                          CVV
                        </span>
                        <input
                          required
                          inputMode="numeric"
                          autoComplete="cc-csc"
                          maxLength={4}
                          value={form.cvv}
                          onChange={(e) =>
                            setForm((prev) => ({
                              ...prev,
                              cvv: e.target.value
                                .replace(/\D/g, "")
                                .slice(0, 4),
                            }))
                          }
                          placeholder="•••"
                          className="h-12 w-full border border-zinc-700 bg-[#090909] px-4 text-sm text-white outline-none transition placeholder:text-zinc-700 focus:border-[#C8102E]"
                        />
                      </label>
                    </div>
                  </div>

                  <label className="mt-8 flex cursor-pointer items-start gap-3 border border-zinc-800 bg-[#0b0b0b] p-4">
                    <input
                      required
                      type="checkbox"
                      checked={accepted}
                      onChange={(e) => setAccepted(e.target.checked)}
                      className="mt-0.5 h-5 w-5 accent-[#C8102E]"
                    />
                    <span className="text-sm leading-6 text-zinc-400">
                      Acepto el{" "}
                      <span className="font-semibold text-white underline underline-offset-4">
                        reglamento y deslinde de responsabilidad
                      </span>{" "}
                      del Karting Rental Experience.
                    </span>
                  </label>

                  <button
                    type="submit"
                    disabled={loading || !accepted}
                    className="mt-6 flex h-14 w-full items-center justify-center gap-3 bg-[#C8102E] px-6 text-sm font-black uppercase tracking-[0.15em] transition hover:bg-[#a90d27] disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500"
                  >
                    {loading ? (
                      <>
                        <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                        Procesando pago...
                      </>
                    ) : (
                      <>
                        Pagar {formatPrice(selected.price)}
                        <span>→</span>
                      </>
                    )}
                  </button>

                  <div className="mt-5 flex items-center justify-center gap-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-600">
                    <span>▣</span>
                    Checkout seguro · Demo sin cobros reales
                  </div>
                </form>
              </div>

              {/* ORDER SUMMARY */}
              <aside className="lg:pt-[116px]">
                <div className="sticky top-28 border border-zinc-800 bg-[#121212]">
                  <div className="border-b border-zinc-800 p-6">
                    <p className="text-xs font-black uppercase tracking-[0.2em] text-[#C8102E]">
                      Tu reserva
                    </p>
                    <h3 className="mt-2 text-2xl font-black uppercase">
                      Resumen
                    </h3>
                  </div>

                  <div className="p-6">
                    <div className="flex items-start justify-between gap-5">
                      <div>
                        <p className="font-black uppercase">{selected.name}</p>
                        <p className="mt-1 text-xs leading-5 text-zinc-500">
                          {selected.detail}
                        </p>
                      </div>
                      <strong>{formatPrice(selected.price)}</strong>
                    </div>

                    <div className="my-6 h-px bg-zinc-800" />

                    <div className="space-y-3 text-sm">
                      <div className="flex justify-between text-zinc-500">
                        <span>Participantes</span>
                        <span className="text-zinc-300">
                          {selected.seats}
                        </span>
                      </div>
                      <div className="flex justify-between text-zinc-500">
                        <span>Duración</span>
                        <span className="text-zinc-300">10 min</span>
                      </div>
                      <div className="flex justify-between text-zinc-500">
                        <span>Servicio</span>
                        <span className="text-zinc-300">$0.00</span>
                      </div>
                    </div>

                    <div className="my-6 h-px bg-zinc-800" />

                    <div className="flex items-end justify-between">
                      <span className="text-xs font-bold uppercase tracking-widest text-zinc-400">
                        Total
                      </span>
                      <div className="text-right">
                        <strong className="block text-3xl font-black">
                          {formatPrice(selected.price)}
                        </strong>
                        <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">
                          USD
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-zinc-800 bg-[#0d0d0d] px-6 py-4 text-xs leading-5 text-zinc-600">
                    Este checkout es una demostración. No se procesará ningún
                    cargo real.
                  </div>
                </div>
              </aside>
            </div>
          )}

          {/* STEP 3 */}
          {step === 3 && (
            <div className="mx-auto max-w-3xl">
              <div className="border border-zinc-800 bg-[#111]">
                <div className="border-b border-zinc-800 bg-[radial-gradient(circle_at_top,rgba(200,16,46,0.20),transparent_55%)] px-6 py-10 text-center sm:px-10">
                  <div className="mx-auto mb-6 grid h-16 w-16 place-items-center rounded-full border border-emerald-500/40 bg-emerald-500/10 text-3xl text-emerald-400">
                    ✓
                  </div>

                  <p className="mb-2 text-xs font-black uppercase tracking-[0.25em] text-emerald-400">
                    Pago aprobado
                  </p>
                  <h2 className="text-4xl font-black uppercase tracking-tight sm:text-5xl">
                    ¡Nos vemos en pista!
                  </h2>
                  <p className="mx-auto mt-4 max-w-lg text-sm leading-6 text-zinc-400">
                    Tu reserva para el Karting Rental Experience fue confirmada.
                    Presenta este código al personal durante tu check-in.
                  </p>
                </div>

                <div className="grid gap-8 p-6 sm:p-10 md:grid-cols-[1fr_260px] md:items-center">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-500">
                      Código de reserva
                    </p>
                    <p className="mt-2 text-3xl font-black tracking-tight">
                      {reservationCode}
                    </p>

                    <div className="my-7 h-px bg-zinc-800" />

                    <div className="grid gap-5 sm:grid-cols-2">
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">
                          Paquete
                        </span>
                        <p className="mt-1 font-bold">{selected.name}</p>
                      </div>

                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">
                          Total pagado
                        </span>
                        <p className="mt-1 font-bold">
                          {formatPrice(selected.price)}
                        </p>
                      </div>

                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">
                          Participantes
                        </span>
                        <p className="mt-1 font-bold">{selected.seats}</p>
                      </div>

                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">
                          Duración
                        </span>
                        <p className="mt-1 font-bold">10 minutos</p>
                      </div>
                    </div>
                  </div>

                  {/* SIMULATED QR */}
                  <div className="mx-auto">
                    <div className="bg-white p-3 shadow-2xl shadow-black/40">
                      <div
                        aria-label="Código QR simulado para check-in"
                        className="relative h-[220px] w-[220px] overflow-hidden bg-white"
                        style={{
                          backgroundImage: `
                            repeating-linear-gradient(
                              0deg,
                              transparent,
                              transparent 7px,
                              #050505 7px,
                              #050505 13px
                            ),
                            repeating-linear-gradient(
                              90deg,
                              transparent,
                              transparent 9px,
                              #050505 9px,
                              #050505 15px
                            )
                          `,
                          backgroundBlendMode: "multiply",
                        }}
                      >
                        <div className="absolute left-3 top-3 h-12 w-12 border-[7px] border-black bg-white">
                          <div className="m-1.5 h-5 w-5 bg-black" />
                        </div>
                        <div className="absolute right-3 top-3 h-12 w-12 border-[7px] border-black bg-white">
                          <div className="m-1.5 h-5 w-5 bg-black" />
                        </div>
                        <div className="absolute bottom-3 left-3 h-12 w-12 border-[7px] border-black bg-white">
                          <div className="m-1.5 h-5 w-5 bg-black" />
                        </div>
                        <div className="absolute left-[82px] top-[84px] grid h-14 w-14 place-items-center bg-white p-1">
                          <div className="grid h-full w-full place-items-center bg-[#C8102E] text-[8px] font-black text-white">
                            ACES
                          </div>
                        </div>
                      </div>
                    </div>

                    <p className="mt-3 text-center text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-600">
                      QR de check-in
                    </p>
                  </div>
                </div>

                <div className="grid gap-3 border-t border-zinc-800 p-6 sm:grid-cols-2 sm:p-8">
                  <button
                    type="button"
                    onClick={sendToWhatsApp}
                    className="flex h-14 items-center justify-center gap-3 bg-[#25D366] px-5 text-sm font-black uppercase tracking-[0.12em] text-black transition hover:bg-[#20bd5a]"
                  >
                    <span className="text-lg">◉</span>
                    Enviar a WhatsApp
                  </button>

                  <button
                    type="button"
                    onClick={resetDemo}
                    className="h-14 border border-zinc-700 px-5 text-sm font-black uppercase tracking-[0.12em] transition hover:border-white hover:bg-white hover:text-black"
                  >
                    Nueva reserva
                  </button>
                </div>
              </div>

              <p className="mt-5 text-center text-xs leading-5 text-zinc-600">
                Demo funcional — la reserva, el pago y el código QR son
                simulados localmente.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* STATIC INFO */}
      <section className="border-y border-zinc-800 bg-[#111]">
        <div className="mx-auto grid max-w-7xl gap-px bg-zinc-800 md:grid-cols-3">
          {[
            {
              number: "01",
              title: "Reserva",
              text: "Selecciona tu paquete y completa tus datos antes de llegar al autódromo.",
            },
            {
              number: "02",
              title: "Prepárate",
              text: "Presenta tu confirmación y sigue las indicaciones del personal de pista.",
            },
            {
              number: "03",
              title: "Check-in",
              text: "Escaneamos el código QR de tu reserva y estás listo para correr.",
            },
          ].map((item) => (
            <article key={item.number} className="bg-[#111] p-8 lg:p-10">
              <span className="text-xs font-black tracking-[0.2em] text-[#C8102E]">
                {item.number}
              </span>
              <h3 className="mt-6 text-2xl font-black uppercase">
                {item.title}
              </h3>
              <p className="mt-3 max-w-sm text-sm leading-6 text-zinc-500">
                {item.text}
              </p>
            </article>
          ))}
        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-[#050505]">
        <div className="mx-auto max-w-7xl px-5 py-14 lg:px-8">
          <div className="grid gap-10 border-b border-zinc-900 pb-12 md:grid-cols-[1.4fr_1fr_1fr]">
            <div>
              <div className="text-2xl font-black uppercase leading-none">
                Autódromo Internacional
                <span className="mt-1 block text-[#C8102E]">El Jabalí</span>
              </div>
              <p className="mt-5 max-w-sm text-sm leading-6 text-zinc-600">
                Liderando el futuro del automovilismo con pasión, precisión y
                excelencia en el rendimiento.
              </p>
            </div>

            <div>
              <h4 className="mb-4 text-xs font-black uppercase tracking-[0.2em] text-zinc-300">
                Accesos rápidos
              </h4>
              <div className="space-y-2 text-sm text-zinc-600">
                <a href="#" className="block hover:text-white">
                  Circuito
                </a>
                <a href="#" className="block hover:text-white">
                  Karting
                </a>
                <a href="#" className="block hover:text-white">
                  Eventos
                </a>
                <a href="#" className="block hover:text-white">
                  Pilotos
                </a>
              </div>
            </div>

            <div>
              <h4 className="mb-4 text-xs font-black uppercase tracking-[0.2em] text-zinc-300">
                Karting Rental
              </h4>
              <p className="text-sm leading-6 text-zinc-600">
                Autódromo Internacional El Jabalí
                <br />
                El Salvador
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-3 pt-7 text-xs text-zinc-700 sm:flex-row sm:items-center sm:justify-between">
            <p>
              © 2026 Autódromo Internacional El Jabalí. Todos los derechos
              reservados.
            </p>
            <p>PitLane · Karting Rental Experience</p>
          </div>
        </div>
      </footer>
    </main>
  );
}