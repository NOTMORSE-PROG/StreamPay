import { Button } from "./Button";

// A native share button that only appears where the Web Share API exists (mobile,
// secure context). Everywhere else the surrounding copy button is the universal
// fallback, so nothing is lost. A cancelled share is not an error.

function canShare(): boolean {
  return (
    typeof navigator !== "undefined" && typeof navigator.share === "function"
  );
}

export function ShareButton({
  title,
  text,
  url,
  children = "Share",
  className,
}: {
  title?: string;
  text?: string;
  url?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  if (!canShare()) {
    return null;
  }
  return (
    <Button
      variant="secondary"
      className={className}
      onClick={() => {
        void navigator.share({ title, text, url }).catch(() => {
          // The worker cancelled the share sheet; nothing to do.
        });
      }}
    >
      {children}
    </Button>
  );
}
