import { Badge } from "@/components/ui/badge";

export function TrendBadge({ trend }: { trend: string }) {
  if (trend === "growing") {
    return (
      <Badge className="bg-success text-success-foreground border-success">
        &#8593; Growing
      </Badge>
    );
  }
  if (trend === "declining") {
    return (
      <Badge className="bg-warning text-warning-foreground border-warning">
        &#8595; Declining
      </Badge>
    );
  }
  return <Badge variant="secondary">&#8596; Stable</Badge>;
}

export function ConfidenceBadge({ confidence }: { confidence: string }) {
  if (confidence === "high") {
    return (
      <Badge className="bg-success text-success-foreground border-success">
        High
      </Badge>
    );
  }
  if (confidence === "medium") {
    return (
      <Badge className="bg-warning text-warning-foreground border-warning">
        Medium
      </Badge>
    );
  }
  return <Badge variant="secondary">Low</Badge>;
}
