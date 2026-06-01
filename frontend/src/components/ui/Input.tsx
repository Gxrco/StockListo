import { forwardRef } from "react";
import { cn } from "@/lib/utils";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, className, id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-");
    return (
      <div className="space-y-1">
        {label && (
          <label htmlFor={inputId} className="block text-xs font-medium text-gray-700">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={cn(
            "w-full h-10 px-3 border rounded-(--radius-btn) text-sm bg-white transition-colors",
            "placeholder:text-gray-400",
            "focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))] focus:border-transparent",
            error
              ? "border-[hsl(var(--error))] focus:ring-[hsl(var(--error))]"
              : "border-[hsl(var(--border))]",
            className,
          )}
          {...props}
        />
        {error && <p className="text-xs text-[hsl(var(--error))]">{error}</p>}
        {hint && !error && <p className="text-xs text-gray-400">{hint}</p>}
      </div>
    );
  },
);
Input.displayName = "Input";
