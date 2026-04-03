import { useState } from "react";
import { CalendarDays } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../api/client";
import type { Instructor } from "../../api/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface ScheduleResult {
  instructor_id: number;
  instructor_name: string;
  instructor_email: string;
  schedule_text: string;
}

export function InstructorScheduleDialog({
  termId,
  instructors,
  onClose,
}: {
  termId: number;
  instructors: Instructor[];
  onClose: () => void;
}) {
  const activeInstructors = instructors.filter((i) => i.is_active);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [previewId, setPreviewId] = useState<number | null>(null);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);

  const allSelected = selectedIds.size === activeInstructors.length;

  function toggleAll() {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(activeInstructors.map((i) => i.id)));
    }
  }

  function toggleOne(id: number) {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  }

  const idsToFetch = selectedIds.size > 0 ? Array.from(selectedIds) : [];

  const { data: schedules = [], isLoading } = useQuery({
    queryKey: ["instructor-schedules", termId, idsToFetch.sort().join(",")],
    queryFn: () =>
      api.get<ScheduleResult[]>(
        `/terms/${termId}/export/instructor-schedules?instructor_ids=${idsToFetch.join(",")}`
      ),
    enabled: idsToFetch.length > 0,
  });

  const previewSchedule = schedules.find((s) => s.instructor_id === previewId);

  async function copyOne(text: string, name: string) {
    await navigator.clipboard.writeText(text);
    setCopyFeedback(`Copied ${name}'s schedule`);
    setTimeout(() => setCopyFeedback(null), 2000);
  }

  async function copyAll() {
    const combined = schedules.map((s) => s.schedule_text).join("\n---\n\n");
    await navigator.clipboard.writeText(combined);
    setCopyFeedback(`Copied ${schedules.length} schedule(s)`);
    setTimeout(() => setCopyFeedback(null), 2000);
  }

  function emailOne(schedule: ScheduleResult) {
    const subject = encodeURIComponent(`Your Teaching Schedule`);
    const body = encodeURIComponent(schedule.schedule_text);
    window.open(`mailto:${schedule.instructor_email}?subject=${subject}&body=${body}`);
    downloadIcs(schedule.instructor_id, schedule.instructor_name);
  }

  function emailAll() {
    const emails = schedules.filter((s) => s.instructor_email).map((s) => s.instructor_email);
    const subject = encodeURIComponent("Your Teaching Schedule");
    const body = encodeURIComponent(
      schedules.map((s) => s.schedule_text).join("\n---\n\n")
    );
    window.open(`mailto:${emails.join(",")}?subject=${subject}&body=${body}`);
    downloadAllIcs();
  }

  const [downloadFeedback, setDownloadFeedback] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  const [downloadingAll, setDownloadingAll] = useState(false);

  async function downloadIcs(instructorId: number, name: string) {
    setDownloadingId(instructorId);
    try {
      const res = await api.getRaw(`/terms/${termId}/export/ics/${instructorId}`);
      if (!res.ok) throw new Error("Download failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${name.replace(/\s+/g, "-")}-schedule.ics`;
      a.click();
      URL.revokeObjectURL(url);
      setDownloadFeedback(`Downloaded ${name}'s calendar`);
    } catch (e: unknown) {
      setDownloadFeedback(`Download failed: ${e instanceof Error ? e.message : "Unknown error"}`);
    } finally {
      setDownloadingId(null);
      setTimeout(() => setDownloadFeedback(null), 3000);
    }
  }

  async function downloadAllIcs() {
    if (schedules.length === 0) return;
    setDownloadingAll(true);
    try {
      const ids = schedules.map((s) => s.instructor_id).join(",");
      const res = await api.getRaw(`/terms/${termId}/export/ics?instructor_ids=${ids}`);
      if (!res.ok) throw new Error("Download failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "instructor-calendars.zip";
      a.click();
      URL.revokeObjectURL(url);
      setDownloadFeedback(`Downloaded ${schedules.length} calendar(s) as ZIP`);
    } catch (e: unknown) {
      setDownloadFeedback(`Download failed: ${e instanceof Error ? e.message : "Unknown error"}`);
    } finally {
      setDownloadingAll(false);
      setTimeout(() => setDownloadFeedback(null), 3000);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-[800px] max-h-[85vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-5 py-4 border-b">
          <DialogTitle>Instructor Schedules</DialogTitle>
          <DialogDescription>
            Select instructors to preview, copy, or email their schedules.
          </DialogDescription>
        </DialogHeader>

        {/* Body: two columns */}
        <div className="flex flex-1 min-h-0">
          {/* Left: instructor list */}
          <div className="w-[280px] border-r border-border flex flex-col">
            <div className="px-4 py-3 border-b border-border">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  className="rounded border-border"
                />
                <span className="font-medium">
                  Select All ({activeInstructors.length})
                </span>
              </label>
            </div>
            <div className="flex-1 overflow-y-auto">
              {activeInstructors.map((inst) => (
                <div
                  key={inst.id}
                  className={`flex items-center gap-2 px-4 py-2 text-sm cursor-pointer hover:bg-accent ${
                    previewId === inst.id ? "bg-accent" : ""
                  }`}
                  onClick={() => {
                    if (!selectedIds.has(inst.id)) {
                      toggleOne(inst.id);
                    }
                    setPreviewId(inst.id);
                  }}
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.has(inst.id)}
                    onChange={(e) => {
                      e.stopPropagation();
                      toggleOne(inst.id);
                    }}
                    className="rounded border-border shrink-0"
                  />
                  <div className="min-w-0">
                    <div className="font-medium truncate">{inst.name}</div>
                    {inst.email && (
                      <div className="text-xs text-muted-foreground truncate">
                        {inst.email}
                      </div>
                    )}
                  </div>
                  {/* Per-instructor action buttons */}
                  {selectedIds.has(inst.id) && schedules.find((s) => s.instructor_id === inst.id) && (
                    <div className="ml-auto flex gap-1 shrink-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const s = schedules.find((s) => s.instructor_id === inst.id);
                          if (s) copyOne(s.schedule_text, s.instructor_name);
                        }}
                        className="p-1 rounded hover:bg-accent-foreground/10"
                        title="Copy schedule"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9.75a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
                        </svg>
                      </button>
                      {schedules.find((s) => s.instructor_id === inst.id)?.instructor_email && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const s = schedules.find((s) => s.instructor_id === inst.id);
                            if (s) emailOne(s);
                          }}
                          className="p-1 rounded hover:bg-accent-foreground/10"
                          title="Email schedule"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                          </svg>
                        </button>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const s = schedules.find((s) => s.instructor_id === inst.id);
                          if (s) downloadIcs(inst.id, s.instructor_name);
                        }}
                        className="p-1 rounded hover:bg-accent-foreground/10"
                        title="Download calendar (.ics)"
                        disabled={downloadingId === inst.id}
                      >
                        <CalendarDays className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Right: preview pane */}
          <div className="flex-1 flex flex-col min-w-0">
            <div className="flex-1 overflow-y-auto p-4">
              {isLoading && selectedIds.size > 0 && (
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                  <div className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  Loading schedules...
                </div>
              )}
              {previewSchedule ? (
                <pre className="whitespace-pre-wrap text-sm font-mono leading-relaxed">
                  {previewSchedule.schedule_text}
                </pre>
              ) : selectedIds.size === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Select instructors on the left to preview their schedules.
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Click an instructor to preview their schedule.
                </p>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="px-5 py-3 border-t flex items-center gap-2 sm:justify-between">
          <div className="flex items-center gap-2">
            {copyFeedback && (
              <span className="text-sm text-emerald-600 font-medium">
                {copyFeedback}
              </span>
            )}
            {downloadFeedback && (
              <span className="text-sm text-emerald-600 font-medium">
                {downloadFeedback}
              </span>
            )}
            <p className="text-xs text-muted-foreground">
              Note: Very long schedules may be truncated in email clients.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={copyAll} disabled={schedules.length === 0}>
              Copy All Selected
            </Button>
            <Button
              variant="outline"
              onClick={downloadAllIcs}
              disabled={schedules.length === 0 || downloadingAll}
            >
              {downloadingAll ? "Downloading..." : "Download All Selected Calendars"}
            </Button>
            <Button onClick={emailAll} disabled={schedules.length === 0}>
              Email All Selected
            </Button>
            <Button variant="outline" onClick={onClose}>Close</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
