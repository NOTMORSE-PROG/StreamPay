import { beforeEach, describe, expect, it, vi } from "vitest";
import { NETWORK_PASSPHRASE } from "./config";

// Mock the Freighter extension API so the connection state machine is tested
// against the exact v6 return shapes (TESTING.md: state machine with the
// Freighter API mocked). Each function returns an object with an optional error.
const mocks = vi.hoisted(() => ({
  isConnected: vi.fn(),
  getNetwork: vi.fn(),
  getAddress: vi.fn(),
  requestAccess: vi.fn(),
  signTransaction: vi.fn(),
}));

vi.mock("@stellar/freighter-api", () => mocks);

const {
  connectWallet,
  resolveWalletStatus,
  signWithFreighter,
  SignError,
  WalletAccessError,
} = await import("./wallet");

const TESTNET_ADDRESS =
  "GAWCHLI2XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX";

function onTestnet(): void {
  mocks.isConnected.mockResolvedValue({ isConnected: true });
  mocks.getNetwork.mockResolvedValue({
    network: "TESTNET",
    networkPassphrase: NETWORK_PASSPHRASE,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("resolveWalletStatus", () => {
  it("reports not-installed when Freighter is absent", async () => {
    mocks.isConnected.mockResolvedValue({ isConnected: false });
    expect(await resolveWalletStatus()).toEqual({ kind: "not-installed" });
  });

  it("reports wrong-network when the passphrase does not match testnet", async () => {
    mocks.isConnected.mockResolvedValue({ isConnected: true });
    mocks.getNetwork.mockResolvedValue({
      network: "PUBLIC",
      networkPassphrase: "Public Global Stellar Network ; September 2015",
    });
    expect(await resolveWalletStatus()).toEqual({
      kind: "wrong-network",
      network: "PUBLIC",
    });
  });

  it("reports disconnected when installed on testnet but unauthorized", async () => {
    onTestnet();
    mocks.getAddress.mockResolvedValue({ address: "" });
    expect(await resolveWalletStatus()).toEqual({ kind: "disconnected" });
  });

  it("treats a getAddress error as disconnected", async () => {
    onTestnet();
    mocks.getAddress.mockResolvedValue({ address: "", error: "not allowed" });
    expect(await resolveWalletStatus()).toEqual({ kind: "disconnected" });
  });

  it("reports connected with the address when authorized (survives refresh)", async () => {
    onTestnet();
    mocks.getAddress.mockResolvedValue({ address: TESTNET_ADDRESS });
    expect(await resolveWalletStatus()).toEqual({
      kind: "connected",
      address: TESTNET_ADDRESS,
    });
  });
});

describe("connectWallet", () => {
  it("throws WalletAccessError when the user declines", async () => {
    mocks.requestAccess.mockResolvedValue({
      address: "",
      error: "User declined access",
    });
    await expect(connectWallet()).rejects.toBeInstanceOf(WalletAccessError);
  });

  it("resolves to connected after the user approves", async () => {
    onTestnet();
    mocks.requestAccess.mockResolvedValue({ address: TESTNET_ADDRESS });
    mocks.getAddress.mockResolvedValue({ address: TESTNET_ADDRESS });
    expect(await connectWallet()).toEqual({
      kind: "connected",
      address: TESTNET_ADDRESS,
    });
  });
});

describe("signWithFreighter", () => {
  it("returns the signed XDR on approval", async () => {
    mocks.signTransaction.mockResolvedValue({
      signedTxXdr: "SIGNED_XDR",
      signerAddress: TESTNET_ADDRESS,
    });
    expect(await signWithFreighter("UNSIGNED", TESTNET_ADDRESS)).toBe(
      "SIGNED_XDR",
    );
    expect(mocks.signTransaction).toHaveBeenCalledWith("UNSIGNED", {
      networkPassphrase: NETWORK_PASSPHRASE,
      address: TESTNET_ADDRESS,
    });
  });

  it("throws SignError when signing is declined", async () => {
    mocks.signTransaction.mockResolvedValue({
      signedTxXdr: "",
      signerAddress: "",
      error: "User declined to sign",
    });
    await expect(
      signWithFreighter("UNSIGNED", TESTNET_ADDRESS),
    ).rejects.toBeInstanceOf(SignError);
  });
});
