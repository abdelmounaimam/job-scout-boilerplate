import { cn } from "@/lib/utils";

export function Badge({
  className,
  color,
  ...props
}: Omit<React.ComponentProps<"span">, "color"> & { color?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        className,
      )}
      style={{ borderColor: "var(--border)", color: color ?? "var(--ink-2)" }}
      {...props}
    />
  );
}
