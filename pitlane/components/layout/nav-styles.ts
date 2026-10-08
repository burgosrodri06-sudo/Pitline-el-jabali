// Enlace del header de piloto: subrayado rojo animado en la sección activa.
export const headerLinkClass =
  "relative inline-flex min-h-11 items-center whitespace-nowrap text-sm font-medium text-muted transition-colors " +
  "duration-[var(--pl-dur-fast)] hover:text-ink aria-[current=page]:text-ink " +
  "after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:origin-left after:scale-x-0 after:bg-brand " +
  "after:transition-transform after:duration-[var(--pl-dur)] aria-[current=page]:after:scale-x-100";
