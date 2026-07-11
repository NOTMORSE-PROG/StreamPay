import { Component, type ErrorInfo, type ReactNode } from "react";

// A global error boundary so an unexpected exception during the live demo can
// never white-screen the app (added 2026-07-11 risk sweep, T-009 responsibility).
// It renders a calm, styled fallback with a reload action instead of a blank page.

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // The console is the only sink here (no server, no telemetry by design).
    console.error("StreamPay crashed:", error, info.componentStack);
  }

  private handleReload = (): void => {
    window.location.reload();
  };

  render(): ReactNode {
    if (this.state.error === null) {
      return this.props.children;
    }
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <h1 className="text-xl font-semibold text-slate-900">
            Something went wrong
          </h1>
          <p className="mt-3 text-sm text-slate-600">
            StreamPay hit an unexpected error. Your funds are safe on-chain;
            this is only the display. Reloading usually fixes it.
          </p>
          <button
            type="button"
            onClick={this.handleReload}
            className="mt-6 inline-flex items-center justify-center rounded-lg bg-teal-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-teal-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
          >
            Reload
          </button>
        </div>
      </main>
    );
  }
}
