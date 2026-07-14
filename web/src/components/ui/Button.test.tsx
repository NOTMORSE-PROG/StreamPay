import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { Button, ButtonLink, ButtonAnchor } from "./Button";

describe("Button", () => {
  it("renders a native button and fires onClick", () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Withdraw</Button>);
    fireEvent.click(screen.getByRole("button", { name: "Withdraw" }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("does not fire onClick when disabled", () => {
    const onClick = vi.fn();
    render(
      <Button onClick={onClick} disabled>
        Withdraw
      </Button>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Withdraw" }));
    expect(onClick).not.toHaveBeenCalled();
  });

  it("defaults to type=button so it never submits a form by accident", () => {
    render(<Button>Save</Button>);
    expect(screen.getByRole("button", { name: "Save" })).toHaveAttribute(
      "type",
      "button",
    );
  });

  it("ButtonLink renders an in-app router link", () => {
    render(
      <MemoryRouter>
        <ButtonLink to="/worker">Get paid</ButtonLink>
      </MemoryRouter>,
    );
    expect(screen.getByRole("link", { name: "Get paid" })).toHaveAttribute(
      "href",
      "/worker",
    );
  });

  it("ButtonAnchor renders an external link", () => {
    render(
      <ButtonAnchor href="https://example.com" target="_blank">
        Explorer
      </ButtonAnchor>,
    );
    expect(screen.getByRole("link", { name: "Explorer" })).toHaveAttribute(
      "href",
      "https://example.com",
    );
  });
});
