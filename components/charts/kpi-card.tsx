import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";

/**
 * A single headline metric (stat tile). The value is the hero; an optional
 * period-over-period delta and a one-line hint sit beneath. Delta direction is
 * shown with an icon + color so meaning never rests on color alone.
 *
 * `deltaPositiveIsGood` lets a metric where "down is good" (e.g. failures) color
 * a decrease as good.
 */
export function KpiCard({
  label,
  value,
  hint,
  changePct,
  deltaPositiveIsGood = true,
  icon: Icon,
}: {
  label: string;
  value: string;
  hint?: string;
  changePct?: number | null;
  deltaPositiveIsGood?: boolean;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  const hasDelta = changePct !== undefined && changePct !== null;
  const up = (changePct ?? 0) > 0;
  const flat = (changePct ?? 0) === 0;
  const good = flat ? undefined : up === deltaPositiveIsGood;

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        {Icon && <Icon className="size-4 shrink-0 text-muted-foreground" />}
      </div>
      <p className="mt-2 text-2xl font-bold tracking-tight tabular-nums">{value}</p>
      <div className="mt-1 flex items-center gap-2">
        {hasDelta && (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 text-xs font-medium tabular-nums",
              good === undefined && "text-muted-foreground",
              good === true && "text-[#0ca30c]",
              good === false && "text-[#d03b3b]"
            )}
          >
            {flat ? <Minus className="size-3" /> : up ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />}
            {Math.abs(changePct as number)}%
          </span>
        )}
        {hint && <span className="truncate text-xs text-muted-foreground">{hint}</span>}
      </div>
    </Card>
  );
}
