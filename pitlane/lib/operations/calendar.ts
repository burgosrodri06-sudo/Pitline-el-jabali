/** RFC 5545 text escaping and UTF-8 line folding. Timestamps come from the DB. */
export function reservationCalendar(
  input: {
    id: string;
    code: string;
    packageName: string;
    startsAt: string;
    endsAt: string;
  },
  generatedAt = new Date(),
) {
  const escape = (s: string) =>
    s
      .replaceAll("\\", "\\\\")
      .replaceAll("\r", "")
      .replaceAll("\n", "\\n")
      .replaceAll(";", "\\;")
      .replaceAll(",", "\\,");
  function stamp(value: string | Date) {
    const date = new Date(value);
    if (!Number.isFinite(date.getTime()))
      throw new Error("Fecha de calendario inválida.");
    return date
      .toISOString()
      .replace(/[-:]/g, "")
      .replace(/\.\d{3}Z$/, "Z");
  }
  function fold(value: string) {
    let length = 0;
    let result = "";
    for (const c of value) {
      const bytes = new TextEncoder().encode(c).length;
      if (length + bytes > 75) {
        result += "\r\n ";
        length = 1;
      }
      result += c;
      length += bytes;
    }
    return result;
  }
  return (
    [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//PitLane//KRE//ES",
      "CALSCALE:GREGORIAN",
      "BEGIN:VEVENT",
      `UID:${escape(input.id)}@pitlane`,
      `DTSTAMP:${stamp(generatedAt)}`,
      `DTSTART:${stamp(input.startsAt)}`,
      `DTEND:${stamp(input.endsAt)}`,
      `SUMMARY:${escape(`KRE · ${input.packageName}`)}`,
      `DESCRIPTION:${escape(`Reserva ${input.code}. Presenta tu QR en pista.`)}`,
      "LOCATION:Autódromo Internacional El Jabalí",
      "END:VEVENT",
      "END:VCALENDAR",
    ]
      .map(fold)
      .join("\r\n") + "\r\n"
  );
}
