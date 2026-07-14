import { useMemo } from "react";
import { renderSVG } from "uqr";

// A QR code rendered fully locally (uqr generates the SVG string from the value,
// no network, no CDN), so a worker can point a phone camera at their address and
// an employer can share the app link. The SVG is generated from our own data
// (an address or an app URL), never from untrusted input.

export function QrCode({
  value,
  size = 160,
  label,
}: {
  value: string;
  size?: number;
  label?: string;
}) {
  const svg = useMemo(
    () =>
      renderSVG(value, {
        blackColor: "#0f172a", // slate-900
        whiteColor: "#ffffff",
        border: 2,
      }),
    [value],
  );
  return (
    <div
      role="img"
      aria-label={label ?? "QR code"}
      style={{ width: size, height: size }}
      className="[&>svg]:h-full [&>svg]:w-full"
      // The SVG is produced locally by uqr from our own value; no external or
      // user-scripted content is injected.
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
