import type { ReactNode } from "react";
import { InfoHint } from "./InfoHint";
import { term, type TermKey } from "../../lib/glossary";

// Renders a concept in plain words, pulling the canonical wording from the
// glossary so every screen agrees (T-051). With `hint`, it appends the existing
// InfoHint "?" affordance whose body is the glossary explanation, reusing that
// primitive rather than inventing a second popover. Optional `children` override
// the surface word while keeping the same hint, for the odd screen that needs a
// different phrasing for the same concept.

export function Term({
  k,
  hint = false,
  children,
}: {
  k: TermKey;
  hint?: boolean;
  children?: ReactNode;
}) {
  const entry = term(k);
  const text = children ?? entry.plain;
  if (!hint) {
    return <>{text}</>;
  }
  return (
    <span className="inline-flex items-center gap-1">
      {text}
      <InfoHint label={`What this means: ${entry.plain}`}>
        {entry.explain}
      </InfoHint>
    </span>
  );
}
