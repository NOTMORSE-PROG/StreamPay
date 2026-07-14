import { describe, expect, it } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Term } from "./Term";
import { GLOSSARY } from "../../lib/glossary";

describe("Term", () => {
  it("renders the plain word for a key", () => {
    render(<Term k="stream" />);
    expect(screen.getByText(GLOSSARY.stream.plain)).toBeInTheDocument();
  });

  it("renders children as an override surface word", () => {
    render(<Term k="wallet">my account</Term>);
    expect(screen.getByText("my account")).toBeInTheDocument();
  });

  it("keeps the explanation hidden until the hint is opened", () => {
    render(<Term k="explorer" hint />);
    expect(
      screen.queryByText(GLOSSARY.explorer.explain),
    ).not.toBeInTheDocument();
  });

  it("reveals the glossary explanation behind the hint", () => {
    render(<Term k="explorer" hint />);
    fireEvent.click(screen.getByRole("button", { name: /what this means/i }));
    expect(screen.getByText(GLOSSARY.explorer.explain)).toBeInTheDocument();
  });
});
