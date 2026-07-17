import { WalletConnect } from "../WalletConnect";
import { Card } from "../ui/Card";
import { InfoHint } from "../ui/InfoHint";
import type { UseWallet } from "../../hooks/useWallet";

// The employer sign-in page shown until a Stellar wallet is connected. The wallet
// IS the account (no email or password, nothing stored on a server), so this
// presents Freighter connect as a proper sign-in and explains why. It reuses
// WalletConnect (centered here via its align prop, T-056) so every connection
// state (not installed, wrong network, declined) is handled with a guided fix.

export function SignInGate({ wallet }: { wallet: UseWallet }) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-6 py-10 text-center">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          Sign in with your wallet app
        </h1>
        <p className="text-sm text-slate-600">
          Your wallet app is your sign-in, with no email or password. Connect
          Freighter to open your dashboard, create pay streams, and manage your
          workers. Nothing is stored on a server; your streams are read straight
          from the public record each time you connect.{" "}
          <InfoHint label="Why a wallet app instead of a password">
            StreamPay has no server accounts. Your wallet app approves every
            action and identifies your streams, so connecting it is how you sign
            in. In this demo the wallet app is Freighter, a free browser add-on,
            and your keys never leave it.
          </InfoHint>
        </p>
      </div>

      <Card className="w-full">
        <div className="flex flex-col items-center gap-3">
          <WalletConnect
            status={wallet.status}
            accessError={wallet.accessError}
            onConnect={() => void wallet.connect()}
            align="center"
          />
          <p className="text-xs text-slate-400">
            New to wallet apps? Install Freighter, switch it to the Test
            network, then connect. It is free and takes a minute.
          </p>
        </div>
      </Card>
    </div>
  );
}
