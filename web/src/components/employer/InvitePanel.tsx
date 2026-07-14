import { useState } from "react";
import { getBusinessName } from "../../lib/employerProfile";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import { ShareButton } from "../ui/ShareButton";
import { QrCode } from "../ui/QrCode";

// The employer's side of worker discovery: the worker-app link (for the current
// origin) as text and QR, plus a prewritten message to paste into any chat, so the
// employer can get a worker set up and collect their address without a backend.

export function InvitePanel() {
  const workerUrl = `${window.location.origin}/worker`;
  const businessName = getBusinessName();
  const opener =
    businessName === null
      ? "Join me on StreamPay to get paid per second."
      : `Join ${businessName} on StreamPay to get paid per second.`;
  const message = `${opener} Open this on your phone to set up your account, then send me your account number: ${workerUrl}`;
  const [copied, setCopied] = useState<"link" | "message" | null>(null);

  function copy(kind: "link" | "message", value: string): void {
    void navigator.clipboard.writeText(value).then(() => {
      setCopied(kind);
      setTimeout(() => setCopied(null), 1500);
    });
  }

  return (
    <Card className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-slate-900">
          Invite your worker
        </h3>
        <p className="mt-1 text-sm text-slate-500">
          Send them the worker app. They set up an account in seconds and send
          you their account number so you can start paying them.
        </p>
      </div>

      <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start">
        <div className="rounded-xl bg-slate-50 p-3">
          <QrCode
            value={workerUrl}
            size={128}
            label="QR code of the worker app link"
          />
        </div>
        <div className="flex-1 space-y-2">
          <p className="break-all rounded-lg bg-slate-50 px-3 py-2 font-mono text-xs text-slate-700">
            {workerUrl}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => copy("link", workerUrl)}
            >
              {copied === "link" ? "Copied" : "Copy link"}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => copy("message", message)}
            >
              {copied === "message" ? "Copied" : "Copy message"}
            </Button>
            <ShareButton
              title="Join me on StreamPay"
              text={message}
              className="!px-3 !py-1.5 !text-sm"
            >
              Share
            </ShareButton>
          </div>
        </div>
      </div>
    </Card>
  );
}
