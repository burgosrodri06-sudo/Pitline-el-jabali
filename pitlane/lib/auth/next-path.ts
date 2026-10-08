import { useSyncExternalStore } from "react";
import { safeNextPath } from './redirects';
export { safeNextPath, withNext } from './redirects';

// Solo acepta rutas internas ("/algo"), nunca "//otro-sitio.com", "/\otro-sitio.com" ni URLs completas.
function readNextPath() {
  return safeNextPath(new URLSearchParams(window.location.search).get("next"));
}

const noSubscribe = () => () => {};

// ?next= de la URL actual; null en el servidor o si no es una ruta interna.
export function useNextPath() {
  return useSyncExternalStore(noSubscribe, readNextPath, () => null);
}
