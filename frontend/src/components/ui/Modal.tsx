/**
 * Base modal wrapper using Radix Dialog.
 * Screen modal: a full-page surface that slides up from the bottom.
 */
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  size?: "default" | "full";
  className?: string;
}

export function Modal({ open, onClose, children, size = "default", className }: ModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="screen-modal-overlay fixed inset-0 z-40 bg-slate-950/10" />
        <Dialog.Content
          className={cn(
            "screen-modal fixed inset-0 z-50",
            "bg-white shadow-[0_-24px_70px_rgba(15,23,42,0.18)]",
            "focus:outline-none",
            size === "full" ? "flex flex-col overflow-hidden" : "flex flex-col overflow-hidden",
            className,
          )}
        >
          <button
            onClick={onClose}
            className="absolute right-8 top-7 z-10 grid h-10 w-10 place-items-center rounded-(--radius-btn) border border-[hsl(var(--border))] bg-white text-gray-500 shadow-sm hover:text-gray-800 hover:bg-gray-50 transition-colors"
            aria-label="Cerrar"
          >
            <X size={16} />
          </button>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function ModalHeader({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("shrink-0 border-b border-[hsl(var(--border))] bg-[hsl(var(--panel))] px-8 py-6", className)}>
      <div className="mx-auto w-full max-w-5xl pr-16">
        {children}
      </div>
    </div>
  );
}

export function ModalBody({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className="flex-1 overflow-y-auto px-8 py-10">
      <div className={cn("mx-auto w-full max-w-5xl", className)}>{children}</div>
    </div>
  );
}

export function ModalFooter({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("shrink-0 border-t border-[hsl(var(--border))] bg-white px-8 py-5", className)}>
      <div className="mx-auto flex w-full max-w-5xl items-center justify-end gap-3">
        {children}
      </div>
    </div>
  );
}
