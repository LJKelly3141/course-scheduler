import { fillColor, pct } from "./analyticsHelpers";

interface FillCell {
  course_id: number;
  academic_year: string;
  semester: string;
  fill_rate: number;
  enrolled: number;
  capacity: number;
}

interface CourseInfo {
  course_id: number;
  label: string;
}

interface TermInfo {
  academic_year: string;
  semester: string;
}

interface Props {
  courses: CourseInfo[];
  terms: TermInfo[];
  cells: FillCell[];
}

export function FillRateHeatmap({ courses, terms, cells }: Props) {
  const lookup = new Map<string, FillCell>();
  for (const c of cells) {
    lookup.set(`${c.course_id}-${c.academic_year}-${c.semester}`, c);
  }

  if (courses.length === 0 || terms.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No fill rate data available.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="border-collapse text-xs w-full">
        <thead>
          <tr>
            <th className="p-1.5 text-left font-medium text-muted-foreground sticky left-0 bg-card">
              Course
            </th>
            {terms.map((t) => (
              <th
                key={`${t.academic_year}-${t.semester}`}
                className="p-1.5 text-center font-medium text-muted-foreground whitespace-nowrap"
              >
                {t.academic_year} {t.semester.charAt(0)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {courses.map((course) => (
            <tr key={course.course_id} className="border-t border-border/30">
              <td className="p-1.5 font-medium whitespace-nowrap sticky left-0 bg-card">
                {course.label}
              </td>
              {terms.map((t) => {
                const cell = lookup.get(
                  `${course.course_id}-${t.academic_year}-${t.semester}`
                );
                if (!cell) {
                  return (
                    <td
                      key={`${t.academic_year}-${t.semester}`}
                      className="p-1 text-center"
                    >
                      <div className="w-full h-7 bg-muted/20 rounded-sm" />
                    </td>
                  );
                }
                const bg =
                  cell.fill_rate >= 0.8
                    ? "bg-success text-success-foreground"
                    : cell.fill_rate >= 0.6
                      ? "bg-warning text-warning-foreground"
                      : "bg-destructive/10 text-destructive";
                return (
                  <td
                    key={`${t.academic_year}-${t.semester}`}
                    className="p-1 text-center"
                    title={`${course.label} ${t.academic_year} ${t.semester}: ${cell.enrolled}/${cell.capacity} (${pct(cell.fill_rate)})`}
                  >
                    <div
                      className={`rounded-sm px-1 py-1 font-semibold ${bg}`}
                    >
                      {pct(cell.fill_rate)}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
