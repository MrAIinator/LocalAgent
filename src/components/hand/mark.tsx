import { cn } from "@/lib/utils";

export function AgentMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={cn("text-fg", className)}
      fill="none"
      aria-hidden
    >
      <rect
        x="3"
        y="3"
        width="26"
        height="26"
        rx="8"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path
        d="M11.5 22V13.5M16 22V10M20.5 22V15"
        stroke="currentColor"
        strokeWidth="2.1"
        strokeLinecap="round"
      />
    </svg>
  );
}

export const HandMark = AgentMark;
