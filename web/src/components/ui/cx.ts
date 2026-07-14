// Tiny className joiner: drops falsy entries so components can compose conditional
// classes without a dependency. Kept in its own module (no component export) so the
// react-refresh rule stays satisfied where it is imported.
export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
