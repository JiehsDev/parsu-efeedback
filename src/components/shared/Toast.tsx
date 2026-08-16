// src/components/shared/Toast.tsx
"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";

type ToastVariant = "success" | "error" | "info";

interface ToastItem {
  id: number;
  message: string;
  variant: ToastVariant;
}

interface ToastContextValue {
  show: (message: string, variant?: ToastVariant) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const VARIANT_STYLES: Record<ToastVariant, { icon: typeof CheckCircle2; className: string }> = {
  success: {
    icon: CheckCircle2,
    className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
  },
  error: {
    icon: AlertCircle,
    className: "border-[var(--destructive)]/40 bg-[var(--destructive)]/10 text-[var(--destructive)]",
  },
  info: {
    icon: Info,
    className: "border-[var(--border)] bg-[var(--card)] text-[var(--foreground)]",
  },
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(0);

  const show = useCallback((message: string, variant: ToastVariant = "success") => {
    const id = nextId.current++;
    setToasts((prev) => [...prev, { id, message, variant }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3200);
  }, []);

  function dismiss(id: number) {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[100] flex flex-col items-center gap-2 px-4 sm:bottom-6 sm:items-end sm:px-6">
        {toasts.map((toast) => {
          const style = VARIANT_STYLES[toast.variant];
          return (
            <div
              key={toast.id}
              role="status"
              className={`animate-toast-in pointer-events-auto flex w-full max-w-sm items-start gap-2.5 rounded-2xl border px-4 py-3 text-sm shadow-xl shadow-black/20 backdrop-blur-xl ${style.className}`}
            >
              <style.icon className="mt-0.5 h-4 w-4 shrink-0" />
              <span className="min-w-0 flex-1">{toast.message}</span>
              <button
                onClick={() => dismiss(toast.id)}
                aria-label="Dismiss"
                className="shrink-0 opacity-60 transition-opacity hover:opacity-100"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within a ToastProvider");
  return ctx;
}
