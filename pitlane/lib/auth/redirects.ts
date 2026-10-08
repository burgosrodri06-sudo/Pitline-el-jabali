/** Allow only local destinations, including after URL normalization. */
export function safeNextPath(next: string | null) {
  if (!next || !next.startsWith('/') || next.startsWith('//') || /[\\\u0000-\u0020\u007f]/.test(next)) return null;
  try {
    const parsed = new URL(next, 'https://pitlane.invalid');
    return parsed.origin === 'https://pitlane.invalid' ? `${parsed.pathname}${parsed.search}${parsed.hash}` : null;
  } catch { return null; }
}

export function withNext(path: string, next: string | null) {
  const safe = safeNextPath(next);
  return safe ? `${path}?next=${encodeURIComponent(safe)}` : path;
}
