// src/components/shared/ConfirmDialog.tsx
"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
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
  const opener = useRef<HTMLElement | null>(null);
  const cancelButton = useRef<HTMLButtonElement>(null);
  const resolveRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback<ConfirmFn>((options) => {
    return new Promise<boolean>((resolve) => {
      opener.current = document.activeElement as HTMLElement;
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
        <Dialog.Root
          open
          onOpenChange={(open) => {
            if (!open) settle(false);
          }}
        >
          <Dialog.Portal>
            <Dialog.Overlay className="motion-overlay fixed inset-0 z-[110] bg-black/60 backdrop-blur-sm" />
            <Dialog.Content
              role="alertdialog"
              onOpenAutoFocus={(event) => {
                event.preventDefault();
                cancelButton.current?.focus();
              }}
              onCloseAutoFocus={(event) => {
                event.preventDefault();
                opener.current?.focus();
              }}
              onPointerDownOutside={(event) => event.preventDefault()}
              className="motion-dialog fixed top-1/2 left-1/2 z-[110] max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-3xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-2xl shadow-black/40"
            >
              <span
                className={`flex h-11 w-11 items-center justify-center rounded-2xl ${
                  state.danger
                    ? "bg-[var(--destructive)]/15 text-[var(--destructive)]"
                    : "bg-[var(--primary)]/15 text-[var(--primary)]"
                }`}
              >
                <AlertTriangle className="h-5 w-5" />
              </span>
              <Dialog.Title className="mt-4 text-base font-bold text-[var(--foreground)]">
                {state.title}
              </Dialog.Title>
              <Dialog.Description className="mt-1.5 text-sm text-[var(--muted-foreground)]">
                {state.message}
              </Dialog.Description>
              <div className="mt-5 flex justify-end gap-2">
                <button
                  ref={cancelButton}
                  type="button"
                  onClick={() => settle(false)}
                  className="rounded-full border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--muted)]"
                >
                  {state.cancelLabel ?? "Cancel"}
                </button>
                <button
                  type="button"
                  onClick={() => settle(true)}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition-opacity hover:opacity-90 ${
                    state.danger
                      ? "bg-[var(--destructive)] text-[var(--destructive-foreground)]"
                      : "bg-[var(--primary)] text-[var(--primary-foreground)]"
                  }`}
                >
                  {state.confirmLabel ?? "Confirm"}
                </button>
              </div>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm must be used within a ConfirmProvider");
  return ctx;
}
