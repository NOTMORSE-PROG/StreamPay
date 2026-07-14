import { describe, expect, it } from "vitest";
import {
  BASE_DIRECTIVES,
  HEADER_ONLY_DIRECTIVES,
  headerCsp,
  metaCsp,
  serializeCsp,
} from "./csp";
import { FRIENDBOT_BASE, RPC_URL } from "./config";
import vercelRaw from "../../vercel.json?raw";

interface VercelHeader {
  key: string;
  value: string;
}

interface VercelConfig {
  rewrites: { source: string; destination: string }[];
  headers: { source: string; headers: VercelHeader[] }[];
}

const vercel = JSON.parse(vercelRaw) as VercelConfig;

describe("the policy content", () => {
  it("allows exactly the RPC and friendbot origins beyond self", () => {
    expect(BASE_DIRECTIVES["connect-src"]).toEqual([
      "'self'",
      new URL(RPC_URL).origin,
      new URL(FRIENDBOT_BASE).origin,
    ]);
  });

  it("names no external host outside connect-src", () => {
    for (const [name, values] of Object.entries(BASE_DIRECTIVES)) {
      if (name === "connect-src") {
        continue;
      }
      for (const value of values) {
        // Everything else is a keyword ('self', 'none', ...) or a scheme
        // (data:), never a host: no CDN, no external font, no tracker.
        expect(value).toMatch(/^('[a-z-]+'|[a-z]+:)$/);
      }
    }
  });

  it("never allows eval or inline scripts", () => {
    const policy = headerCsp();
    expect(policy).not.toContain("unsafe-eval");
    expect(BASE_DIRECTIVES["script-src"]).toEqual(["'self'"]);
  });

  it("keeps frame-ancestors out of the meta policy (ignored there by spec)", () => {
    expect(metaCsp()).not.toContain("frame-ancestors");
    expect(headerCsp()).toContain("frame-ancestors 'none'");
  });

  it("serializes directives in the wire format", () => {
    expect(
      serializeCsp({ "default-src": ["'self'"], "img-src": ["data:"] }),
    ).toBe("default-src 'self'; img-src data:");
  });
});

describe("vercel.json stays in lockstep", () => {
  const headers = vercel.headers[0]?.headers ?? [];
  const byKey = new Map(headers.map((h) => [h.key, h.value]));

  it("carries exactly the headerCsp() policy", () => {
    expect(byKey.get("Content-Security-Policy")).toBe(headerCsp());
  });

  it("carries nosniff and a same-origin referrer policy", () => {
    expect(byKey.get("X-Content-Type-Options")).toBe("nosniff");
    expect(byKey.get("Referrer-Policy")).toBe("same-origin");
  });

  it("applies its headers to every path", () => {
    expect(vercel.headers[0]?.source).toBe("/(.*)");
  });

  it("rewrites every deep link to the SPA entry (no 404 on /worker/:id)", () => {
    expect(vercel.rewrites).toEqual([
      { source: "/(.*)", destination: "/index.html" },
    ]);
  });

  it("meta and header variants differ only by the header-only directives", () => {
    const meta = metaCsp();
    const header = headerCsp();
    expect(header).toBe(`${meta}; ${serializeCsp(HEADER_ONLY_DIRECTIVES)}`);
  });
});
