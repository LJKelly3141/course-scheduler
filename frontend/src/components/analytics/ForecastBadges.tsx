import { Badge } from "@/components/ui/badge";

export function TrendBadge({ trend }: { trend: string }) {
  if (trend === "growing") {
    return (
      <Badge className="bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800">
        &#8593; Growing
      </Badge>
    );
  }
  if (trend === "declining") {
    return (
      <Badge className="bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800">
        &#8595; Declining
      </Badge>
    );
  }
  return <Badge variant="secondary">&#8596; Stable</Badge>;
}

export function ConfidenceBadge({ confidence }: { confidence: string }) {
  if (confidence === "high") {
    return (
      <Badge className="bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800">
        High
      </Badge>
    );
  }
  if (confidence === "medium") {
    return (
      <Badge className="bg-yellow-100 dark:bg-yellow-950 text-yellow-700 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800">
        Medium
      </Badge>
    );
  }
  return <Badge variant="secondary">Low</Badge>;
}
