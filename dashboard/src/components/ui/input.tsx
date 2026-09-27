import { cn } from "@/lib/utils";

export function Input({ className, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      className={cn(
        "h-9 w-full rounded-md border px-3 text-sm outline-none",
        "focus-visible:ring-2 focus-visible:ring-offset-1",
        className,
      )}
      style={{ background: "var(--surface)", borderColor: "var(--border)", color: "var(--ink)" }}
      {...props}
    />
  );
}
