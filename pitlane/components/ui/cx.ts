// Une clases omitiendo valores vacíos: cx("a", cond && "b").
export function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}
