import * as SwitchPrimitive from "@radix-ui/react-switch";
import { cn } from "@/lib/utils";

export function Switch({
  className,
  ...props
}: SwitchPrimitive.SwitchProps) {
  return (
    <SwitchPrimitive.Root
      className={cn(
        "relative h-6 w-10 shrink-0 rounded-full bg-elevated shadow-[var(--shadow-border)] transition-colors duration-(--motion-quick) ease-(--ease-out)",
        "data-[state=checked]:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        className={cn(
          "block size-5 translate-x-0.5 rounded-full bg-fg transition-transform duration-(--motion-quick) ease-(--ease-out)",
          "data-[state=checked]:translate-x-[18px] data-[state=checked]:bg-accent-fg",
        )}
      />
    </SwitchPrimitive.Root>
  );
}
