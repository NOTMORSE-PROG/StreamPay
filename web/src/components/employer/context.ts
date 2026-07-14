import { useOutletContext } from "react-router-dom";

// The data the EmployerShell shares with its pages once a wallet is connected:
// the signed-in employer address, the refresh counter the stream list polls on,
// and the callback pages fire after they change on-chain state (create, cancel).
// Kept in a non-component module so the shell and pages can import the hook
// without tripping the react-refresh rule.

export interface EmployerContext {
  address: string;
  refreshKey: number;
  onChanged: () => void;
  /** App-level sign-out (Settings). Freighter stays authorized; the gate holds
   *  until the user reconnects. */
  signOut: () => void;
}

export function useEmployerContext(): EmployerContext {
  return useOutletContext<EmployerContext>();
}
