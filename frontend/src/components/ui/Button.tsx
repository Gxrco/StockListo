import { forwardRef } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "accent" | "ghost" | "outline" | "destructive";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

const base =
  "inline-flex items-center justify-center gap-2 font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50";

const variants: Record<Variant, string> = {
  primary: "bg-[hsl(var(--primary))] text-white shadow-[0_10px_22px_rgba(2,88,100,0.16)] hover:bg-[hsl(var(--primary)/0.9)] focus-visible:ring-[hsl(var(--primary))]",
  accent:  "bg-[hsl(var(--accent))] text-[hsl(var(--primary))] hover:bg-[hsl(var(--accent)/0.85)] focus-visible:ring-[hsl(var(--accent))]",
  ghost:   "text-gray-600 hover:bg-gray-100 focus-visible:ring-gray-400",
  outline: "border border-[hsl(var(--border))] bg-white text-gray-700 shadow-sm hover:bg-gray-50 focus-visible:ring-gray-400",
  destructive: "bg-[hsl(var(--error))] text-white hover:bg-[hsl(var(--error)/0.9)] focus-visible:ring-[hsl(var(--error))]",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-xs rounded-(--radius-btn)",
  md: "h-10 px-4 text-sm rounded-(--radius-btn)",
  lg: "h-11 px-5 text-sm rounded-(--radius-btn)",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", size = "md", loading, className, children, disabled, ...props }, ref) => (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(base, variants[variant], sizes[size], className)}
      {...props}
    >
      {loading && (
        <span className="h-3.5 w-3.5 rounded-full border-2 border-current border-t-transparent animate-spin" />
      )}
      {children}
    </button>
  ),
);
Button.displayName = "Button";
