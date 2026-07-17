import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  status: string;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const normalizedStatus = status.toLowerCase();

  let semanticClass = "";
  switch (normalizedStatus) {
    case "completed":
      semanticClass = "bg-status-completed text-white hover:bg-status-completed/80";
      break;
    case "pending":
      semanticClass = "bg-status-pending text-white hover:bg-status-pending/80";
      break;
    case "failed":
      semanticClass = "bg-status-failed text-white hover:bg-status-failed/80";
      break;
    case "cancelled":
      semanticClass = "bg-status-cancelled text-white hover:bg-status-cancelled/80";
      break;
    default:
      semanticClass = "bg-muted text-muted-foreground hover:bg-muted/80";
  }

  return (
    <Badge variant="secondary" className={cn("capitalize font-medium border-transparent", semanticClass)}>
      {status}
    </Badge>
  );
}
