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

export async function downloadReleaseReport(
  termIds: number[],
  format: "xlsx" | "html"
): Promise<void> {
  const endpoint =
    format === "xlsx" ? "export-xlsx" : "export-html";
  const url = `/analytics/release-report/${endpoint}?term_ids=${termIds.join(",")}`;

  try {
    const res = await api.getRaw(url);
    if (!res.ok) {
      toast.error("Failed to generate release report");
      return;
    }

    if (format === "html") {
      // Open HTML report in new tab
      const html = await res.text();
      const blob = new Blob([html], { type: "text/html" });
      const blobUrl = URL.createObjectURL(blob);
      window.open(blobUrl, "_blank");
      return;
    }

    // Download XLSX
    const disposition = res.headers.get("Content-Disposition");
    const match = disposition?.match(/filename="?([^"]+)"?/);
    const filename = match ? match[1] : "release_planning_report.xlsx";

    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(blobUrl);
  } catch {
    toast.error("Failed to generate release report");
  }
}
