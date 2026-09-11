import { type InputHTMLAttributes, type TextareaHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "h-10 w-full rounded-md bg-elevated px-3 text-sm text-fg shadow-[var(--shadow-border)] placeholder:text-subtle",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      "w-full resize-none rounded-md bg-elevated px-3 py-2.5 text-sm text-fg shadow-[var(--shadow-border)] placeholder:text-subtle",
      "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
      className,
    )}
    {...props}
  />
));
Textarea.displayName = "Textarea";
