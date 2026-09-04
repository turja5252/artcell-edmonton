import { personHue } from "@/lib/ids";
import { initials } from "@/lib/people";
import { cn } from "@/lib/utils";

export function PersonChip({
  name,
  compact = false,
  className,
}: {
  name: string;
  compact?: boolean;
  className?: string;
}) {
  const hue = personHue(name);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium",
        compact && "px-1.5",
        className
      )}
      style={{
        background: `oklch(0.28 0.05 ${hue})`,
        borderColor: `oklch(0.5 0.08 ${hue})`,
        color: `oklch(0.93 0.04 ${hue})`,
      }}
    >
      <span
        className="grid size-4 place-items-center rounded-full text-[9px] font-bold"
        style={{ background: `oklch(0.55 0.12 ${hue})`, color: "oklch(0.16 0.03 50)" }}
      >
        {initials(name)}
      </span>
      {!compact && name}
    </span>
  );
}
