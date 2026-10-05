// Traduce los errores de Supabase a mensajes en español para mostrar en pantalla.
const MESSAGES: Record<string, string> = {
  invalid_credentials: "Correo o contraseña incorrectos.",
  email_not_confirmed: "Primero verifica tu correo con el enlace que te enviamos.",
  user_already_exists: "Ya existe una cuenta con ese correo.",
  email_exists: "Ya existe una cuenta con ese correo.",
  email_address_invalid: "Escribe un correo válido.",
  weak_password: "La contraseña es muy débil. Usa una más segura.",
  same_password: "La contraseña nueva debe ser distinta a la anterior.",
  over_email_send_rate_limit: "Enviamos demasiados correos. Espera unos minutos e inténtalo de nuevo.",
  over_request_rate_limit: "Demasiados intentos. Espera unos minutos e inténtalo de nuevo.",
  signup_disabled: "Por ahora no se pueden crear cuentas nuevas.",
  user_banned: "Esta cuenta está bloqueada.",
  otp_expired: "El enlace expiró. Pide uno nuevo.",
  session_not_found: "Tu sesión expiró. Vuelve a iniciar sesión.",
  session_expired: "Tu sesión expiró. Vuelve a iniciar sesión.",
};

export function translateAuthError(error: { code?: string; name?: string }): string {
  if (error.code && MESSAGES[error.code]) return MESSAGES[error.code];
  // Pasa cuando el enlace de recuperación expiró o se abrió en otro navegador.
  if (error.name === "AuthSessionMissingError") return "El enlace expiró o ya se usó. Pide uno nuevo.";
  return "Algo salió mal. Inténtalo de nuevo.";
}
