// src/components/shared/ConfirmDialog.tsx
"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";
import { AlertTriangle } from "lucide-react";

interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

interface ConfirmState extends ConfirmOptions {
  open: boolean;
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<ConfirmState>({
    open: false,
    title: "",
    message: "",
  });
  const resolveRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback<ConfirmFn>((options) => {
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve;
      setState({ ...options, open: true });
    });
  }, []);

  function settle(value: boolean) {
    setState((prev) => ({ ...prev, open: false }));
    resolveRef.current?.(value);
    resolveRef.current = null;
  }

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {state.open && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-2xl shadow-black/40">
            <span
              className={`flex h-11 w-11 items-center justify-center rounded-2xl ${
                state.danger
                  ? "bg-[var(--destructive)]/15 text-[var(--destructive)]"
                  : "bg-[var(--primary)]/15 text-[var(--primary)]"
              }`}
            >
              <AlertTriangle className="h-5 w-5" />
            </span>
            <h2 className="mt-4 text-base font-bold text-[var(--foreground)]">{state.title}</h2>
            <p className="mt-1.5 text-sm text-[var(--muted-foreground)]">{state.message}</p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => settle(false)}
                className="rounded-full border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--muted)]"
              >
                {state.cancelLabel ?? "Cancel"}
              </button>
              <button
                onClick={() => settle(true)}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition-opacity hover:opacity-90 ${
                  state.danger
                    ? "bg-[var(--destructive)] text-white"
                    : "bg-[var(--primary)] text-[var(--primary-foreground)]"
                }`}
              >
                {state.confirmLabel ?? "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm must be used within a ConfirmProvider");
  return ctx;
}
