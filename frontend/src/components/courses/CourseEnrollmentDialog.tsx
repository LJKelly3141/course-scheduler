import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/client";
import { EnrollmentTrendChart } from "@/components/analytics/EnrollmentTrendChart";
import { TrendBadge, ConfidenceBadge } from "@/components/analytics/ForecastBadges";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Course, CourseTrend, CourseForecast } from "@/api/types";

interface Props {
  course: Course;
  termId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CourseEnrollmentDialog({ course, termId, open, onOpenChange }: Props) {
  const { data: trendsData } = useQuery({
    queryKey: ["analytics", "trends", termId],
    queryFn: () =>
      api.get<{ courses: CourseTrend[] }>(
        `/analytics/enrollment-trends?term_id=${termId}`
      ),
    enabled: open,
  });

  const { data: forecastData } = useQuery({
    queryKey: ["analytics", "forecast", termId],
    queryFn: () =>
      api.get<{ forecasts: CourseForecast[] }>(
        `/analytics/enrollment-forecast?term_id=${termId}`
      ),
    enabled: open,
  });

  const trend = trendsData?.courses?.find((c) => c.course_id === course.id);
  const forecast = forecastData?.forecasts?.find((f) => f.course_id === course.id);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {course.department_code} {course.course_number} — {course.title}
          </DialogTitle>
        </DialogHeader>

        {forecast && forecast.confidence !== "none" && (
          <div className="flex gap-2 flex-wrap">
            <TrendBadge trend={forecast.trend} />
            <ConfidenceBadge confidence={forecast.confidence} />
            {forecast.cohort_fallback && (
              <Badge variant="secondary">Cohort Est.</Badge>
            )}
          </div>
        )}

        {trend && trend.data_points.length > 0 ? (
          <EnrollmentTrendChart trend={trend} forecast={forecast} height={280} />
        ) : (
          <p className="text-sm text-muted-foreground py-8 text-center">
            No enrollment history available for this course.
          </p>
        )}

        {forecast && forecast.confidence !== "none" && (
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div className="bg-muted/50 rounded-lg p-3 text-center">
              <p className="text-muted-foreground text-xs">Forecast Enrollment</p>
              <p className="text-lg font-semibold">{forecast.forecast_enrollment}</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-3 text-center">
              <p className="text-muted-foreground text-xs">Suggested Sections</p>
              <p className="text-lg font-semibold">{forecast.suggested_sections}</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-3 text-center">
              <p className="text-muted-foreground text-xs">Suggested Cap/Section</p>
              <p className="text-lg font-semibold">{forecast.suggested_seats}</p>
              <p className="text-muted-foreground text-[10px]">
                Range: {forecast.p25}–{forecast.p75}
              </p>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
