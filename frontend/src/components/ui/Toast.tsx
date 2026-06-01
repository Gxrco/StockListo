/**
 * Minimal toast system using React state + portal.
 * Usage: import { toast } from "@/components/ui/Toast" and call toast.success("...").
 */
import { createContext, useState, useCallback } from "react";
import { CheckCircle, XCircle, X } from "lucide-react";

type ToastType = "success" | "error" | "info";

interface ToastItem {
  id: number;
  type: ToastType;
  message: string;
}

interface ToastContextValue {
  add: (type: ToastType, message: string) => void;
}

const ToastContext = createContext<ToastContextValue>({ add: () => {} });
let _add: (type: ToastType, message: string) => void = () => {};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  let counter = 0;

  const add = useCallback((type: ToastType, message: string) => {
    const id = Date.now() + counter++;
    setItems((prev) => [...prev, { id, type, message }]);
    setTimeout(() => setItems((prev) => prev.filter((t) => t.id !== id)), 4000);
  }, []);

  _add = add;

  return (
    <ToastContext.Provider value={{ add }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full">
        {items.map((item) => (
          <div
            key={item.id}
            className={`flex items-start gap-3 px-4 py-3 rounded-btn shadow-lg text-sm animate-in slide-in-from-right-4 ${
              item.type === "success"
                ? "bg-green-50 border border-green-200 text-green-800"
                : item.type === "error"
                ? "bg-red-50 border border-red-200 text-red-800"
                : "bg-blue-50 border border-blue-200 text-blue-800"
            }`}
          >
            {item.type === "success" ? (
              <CheckCircle size={16} className="shrink-0 mt-0.5" />
            ) : (
              <XCircle size={16} className="shrink-0 mt-0.5" />
            )}
            <span className="flex-1">{item.message}</span>
            <button
              onClick={() => setItems((prev) => prev.filter((t) => t.id !== item.id))}
              className="shrink-0 opacity-60 hover:opacity-100"
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const toast = {
  success: (message: string) => _add("success", message),
  error: (message: string) => _add("error", message),
  info: (message: string) => _add("info", message),
};
