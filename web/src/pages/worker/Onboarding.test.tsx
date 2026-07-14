import { describe, expect, it, vi, beforeEach, type Mock } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { streamsByWorker } from "../../lib/contract";
import { resetOnboarding } from "../../lib/onboarding";

// Mock the wallet loader and the chain read so the wizard runs without a network.
const useDemoWalletMock = vi.hoisted(() => vi.fn());
vi.mock("../../hooks/useDemoWallet", () => ({
  useDemoWallet: useDemoWalletMock,
}));
vi.mock("../../lib/contract", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../lib/contract")>();
  return { ...actual, streamsByWorker: vi.fn() };
});

import { Onboarding } from "./Onboarding";

const streamsByWorkerMock = streamsByWorker as unknown as Mock;
const ADDRESS = "GCQGDN634N7LNECZNWXUYHW2OFWNCQRG2CJHLBE4M375CNMXBLL2WKZN";

const createWalletMock = vi.fn();

function renderWizard() {
  useDemoWalletMock.mockReturnValue({
    wallet: {
      publicKey: ADDRESS,
      persisted: true,
      signTransactionXdr: vi.fn(),
    },
    fundState: "funded",
    retry: vi.fn(),
    createWallet: createWalletMock,
  });
  return render(
    <MemoryRouter initialEntries={["/worker/onboarding"]}>
      <Routes>
        <Route path="/worker/onboarding" element={<Onboarding />} />
        <Route path="/worker" element={<div>HOME MARKER</div>} />
        <Route path="/worker/:id" element={<div>STREAM MARKER</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("Onboarding wizard", () => {
  beforeEach(() => {
    localStorage.clear();
    resetOnboarding();
    vi.clearAllMocks();
    createWalletMock.mockResolvedValue(undefined);
    streamsByWorkerMock.mockResolvedValue([]);
  });

  function setPin(pin: string) {
    const fields = screen.getAllByLabelText(/PIN/);
    fireEvent.change(fields[0], { target: { value: pin } });
    fireEvent.change(fields[1], { target: { value: pin } });
  }

  it("steps welcome -> PIN -> wallet -> share -> waiting, creating the wallet", async () => {
    renderWizard();
    expect(screen.getByText("Get paid every second")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Get started" }));

    expect(screen.getByText("Secure your account")).toBeInTheDocument();
    setPin("123456");
    fireEvent.click(screen.getByRole("button", { name: "Create my account" }));
    expect(
      await screen.findByText("Your account is ready"),
    ).toBeInTheDocument();
    expect(createWalletMock).toHaveBeenCalledWith("123456");

    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByText("Share your account number")).toBeInTheDocument();
    expect(screen.getByText(ADDRESS)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "I have shared it" }));
    expect(
      screen.getByText("Waiting for your first paycheck"),
    ).toBeInTheDocument();
  });

  it("blocks creation when the two PIN entries do not match", () => {
    renderWizard();
    fireEvent.click(screen.getByRole("button", { name: "Get started" }));
    const fields = screen.getAllByLabelText(/PIN/);
    fireEvent.change(fields[0], { target: { value: "123456" } });
    fireEvent.change(fields[1], { target: { value: "654321" } });
    fireEvent.click(screen.getByRole("button", { name: "Create my account" }));
    expect(screen.getByText(/do not match/)).toBeInTheDocument();
    expect(createWalletMock).not.toHaveBeenCalled();
  });

  it("flips to a stream CTA when the first stream lands", async () => {
    streamsByWorkerMock.mockResolvedValue([8n]);
    renderWizard();
    fireEvent.click(screen.getByRole("button", { name: "Get started" }));
    setPin("123456");
    fireEvent.click(screen.getByRole("button", { name: "Create my account" }));
    fireEvent.click(await screen.findByRole("button", { name: "Continue" }));
    fireEvent.click(screen.getByRole("button", { name: "I have shared it" }));
    expect(await screen.findByText("Your pay has started")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Open your paycheck" }));
    expect(await screen.findByText("STREAM MARKER")).toBeInTheDocument();
  });

  it("Skip marks onboarding done and goes to the app", async () => {
    renderWizard();
    fireEvent.click(screen.getByRole("button", { name: "Skip" }));
    expect(await screen.findByText("HOME MARKER")).toBeInTheDocument();
  });
});
