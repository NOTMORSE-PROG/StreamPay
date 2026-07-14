import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Outlet, Route, Routes } from "react-router-dom";
import type { EmployerContext } from "../../components/employer/context";
import { EmployerSettings } from "./Settings";
import { getBusinessName } from "../../lib/employerProfile";
import { getSavedWorkers, saveWorker } from "../../lib/addressBook";

const A = "GCQGDN634N7LNECZNWXUYHW2OFWNCQRG2CJHLBE4M375CNMXBLL2WKZN";
const B = "GAWCHLI26MZCP4UISX7TSY4SOBRQOKYOANKEQKQWTX4KFFGUYN5LH6V4";

function renderSettings(signOut = vi.fn()) {
  const ctx: EmployerContext = {
    address: A,
    refreshKey: 0,
    onChanged: vi.fn(),
    signOut,
  };
  return render(
    <MemoryRouter>
      <Routes>
        <Route element={<Outlet context={ctx} />}>
          <Route path="*" element={<EmployerSettings />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  localStorage.clear();
});

describe("EmployerSettings", () => {
  it("saves the business name", () => {
    renderSettings();
    const save = screen.getByRole("button", { name: "Save name" });
    expect(save).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Business name"), {
      target: { value: "Acme Co" },
    });
    fireEvent.click(save);
    expect(getBusinessName()).toBe("Acme Co");
  });

  it("lists saved workers and shows an empty state otherwise", () => {
    renderSettings();
    expect(screen.getByText(/No saved workers yet/)).toBeInTheDocument();
  });

  it("renames a saved worker through saveWorker", () => {
    saveWorker("Maria", A);
    renderSettings();
    fireEvent.click(screen.getByRole("button", { name: "Rename" }));
    fireEvent.change(screen.getByLabelText("Rename Maria"), {
      target: { value: "Maria Cruz" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(getSavedWorkers()[0].name).toBe("Maria Cruz");
  });

  it("signs out through the context", () => {
    const signOut = vi.fn();
    renderSettings(signOut);
    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
    expect(signOut).toHaveBeenCalled();
  });

  it("removes a saved worker after confirming", () => {
    saveWorker("Maria", A);
    saveWorker("Jose", B);
    renderSettings();
    // Remove the first row (Jose, newest first).
    fireEvent.click(screen.getAllByRole("button", { name: "Remove" })[0]);
    const dialog = screen.getByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Remove" }));
    const remaining = getSavedWorkers();
    expect(remaining).toHaveLength(1);
    expect(remaining[0].name).toBe("Maria");
  });
});
