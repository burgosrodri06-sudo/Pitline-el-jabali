import { useSyncExternalStore } from "react";

// Solo acepta rutas internas ("/algo"), nunca "//otro-sitio.com", "/\otro-sitio.com" ni URLs completas.
export function safeNextPath(next: string | null) {
  return next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : null;
}

// Agrega ?next= a una ruta de auth si hay uno.
export function withNext(path: string, next: string | null) {
  return next ? `${path}?next=${encodeURIComponent(next)}` : path;
}

function readNextPath() {
  return safeNextPath(new URLSearchParams(window.location.search).get("next"));
}

const noSubscribe = () => () => {};

// ?next= de la URL actual; null en el servidor o si no es una ruta interna.
export function useNextPath() {
  return useSyncExternalStore(noSubscribe, readNextPath, () => null);
}
