import { api } from "@/api/client";
import { toast } from "sonner";

export async function downloadWorkloadReport(termId: number): Promise<void> {
  try {
    const res = await api.getRaw(
      `/analytics/instructor-workload/export?term_id=${termId}`
    );
    if (!res.ok) {
      toast.error("Failed to download load report");
      return;
    }

    const disposition = res.headers.get("Content-Disposition");
    const match = disposition?.match(/filename="?([^"]+)"?/);
    const filename = match ? match[1] : "workload_report.xlsx";

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  } catch {
    toast.error("Failed to download load report");
  }
}
