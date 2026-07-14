// The app's Content-Security-Policy, one source of truth (T-038). Two
// consumers: vite.config.ts injects the meta-tag variant into the PRODUCTION
// index.html only (dev needs the react-refresh inline preamble that a strict
// script-src would block), and web/vercel.json carries the header variant for
// the deployed site. csp.test.ts locks vercel.json to headerCsp() so the two
// cannot drift.
//
// The policy is deliberately strict: everything ships same-origin (fonts, QR,
// icons are all self-hosted), so the only external hosts the page may contact
// are the Soroban RPC and friendbot, both derived from config.ts. Explorer and
// freighter.app are plain link navigations, not fetches, and Freighter signs
// via extension messaging, so none of them appear in connect-src.

// The .ts extension is required here: vite.config.ts pulls this module into
// the nodenext project, which demands explicit extensions.
import { FRIENDBOT_BASE, RPC_URL } from "./config.ts";

export type CspDirectives = Readonly<Record<string, readonly string[]>>;

/** Directives shared by the meta tag and the deployed header. */
export const BASE_DIRECTIVES = {
  "default-src": ["'self'"],
  "script-src": ["'self'"],
  // React style attributes (progress widths, safe-area padding) are inline
  // styles; allowing them is the standard SPA compromise. Scripts stay 'self'.
  "style-src": ["'self'", "'unsafe-inline'"],
  "img-src": ["'self'", "data:"],
  // data: is required alongside 'self': Vite inlines font subsets under 4 KB
  // as data URIs (caught live by the T-038 preview pass, a small Manrope
  // subset was blocked). A data: font is self-contained and safe to allow.
  "font-src": ["'self'", "data:"],
  "connect-src": [
    "'self'",
    new URL(RPC_URL).origin,
    new URL(FRIENDBOT_BASE).origin,
  ],
  "object-src": ["'none'"],
  "base-uri": ["'self'"],
  "form-action": ["'self'"],
} satisfies CspDirectives;

/**
 * frame-ancestors is ignored when the policy arrives via a meta tag (per the
 * CSP spec), so it rides only the vercel.json header, where it blocks
 * clickjacking by refusing to render the app inside any frame.
 */
export const HEADER_ONLY_DIRECTIVES = {
  "frame-ancestors": ["'none'"],
} satisfies CspDirectives;

/** Serialize a directive map into the policy-string wire format. */
export function serializeCsp(directives: CspDirectives): string {
  return Object.entries(directives)
    .map(([name, values]) => `${name} ${values.join(" ")}`)
    .join("; ");
}

/** The policy for the build-injected meta tag (no frame-ancestors). */
export function metaCsp(): string {
  return serializeCsp(BASE_DIRECTIVES);
}

/** The full policy for the deployed response header. */
export function headerCsp(): string {
  return serializeCsp({ ...BASE_DIRECTIVES, ...HEADER_ONLY_DIRECTIVES });
}
