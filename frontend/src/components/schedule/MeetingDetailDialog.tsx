import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../api/client";
import type { Meeting } from "../../api/types";
import { formatTime, parseDaysOfWeek } from "../../lib/utils";
import { ConfirmDialog } from "../ui/confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const DAY_NAMES: Record<string, string> = {
  M: "Monday",
  T: "Tuesday",
  W: "Wednesday",
  Th: "Thursday",
  F: "Friday",
  S: "Saturday",
  U: "Sunday",
};

interface Props {
  meeting: Meeting;
  onClose: () => void;
  onEdit: (meeting: Meeting) => void;
  onDelete: (id: number) => void;
  readOnly?: boolean;
}

export function MeetingDetailDialog({ meeting, onClose, onEdit, onDelete, readOnly }: Props) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const queryClient = useQueryClient();
  const section = meeting.section;
  const course = section?.course;

  const toggleLoadMutation = useMutation({
    mutationFn: (value: boolean) =>
      api.put(`/courses/${course!.id}`, { counts_toward_load: value }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["courses"] });
      queryClient.invalidateQueries({ queryKey: ["meetings"] });
      queryClient.invalidateQueries({ queryKey: ["sections"] });
    },
  });
  const instructor = meeting.instructor;
  const room = meeting.room;
  const timeBlock = meeting.time_block;

  const days = parseDaysOfWeek(meeting.days_of_week);
  const dayNames = days.map((d) => DAY_NAMES[d] ?? d).join(", ");

  const courseNum = course?.course_number ?? "";
  const level = courseNum ? `${Math.floor(parseInt(courseNum) / 100) * 100}-level` : "\u2014";

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-lg p-0 gap-0">
        <DialogHeader className="bg-muted/50 border-b px-6 py-4">
          <DialogTitle>
            {course?.department_code} {courseNum}-{section?.section_number}
          </DialogTitle>
          <p className="text-sm text-muted-foreground">{course?.title ?? "Untitled Course"}</p>
        </DialogHeader>

        <div className="px-6 py-4 space-y-3 text-sm">
          <DetailRow label="Instructor" value={instructor?.name ?? "TBD"} />
          <DetailRow
            label="Room"
            value={
              room
                ? `${room.building?.abbreviation} ${room.room_number} (cap: ${room.capacity})`
                : "Online"
            }
          />
          <DetailRow label="Days" value={dayNames || "\u2014"} />
          <DetailRow
            label="Time"
            value={
              meeting.start_time && meeting.end_time
                ? `${formatTime(meeting.start_time)} \u2013 ${formatTime(meeting.end_time)}`
                : "\u2014"
            }
          />
          <DetailRow label="Time Block" value={timeBlock?.label ?? "Custom"} />
          <DetailRow label="Credits" value={course?.credits != null ? String(course.credits) : "\u2014"} />
          <div className="flex">
            <span className="w-32 flex-shrink-0 text-muted-foreground font-medium">In Load</span>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={course?.counts_toward_load ?? true}
                onChange={(e) => course && toggleLoadMutation.mutate(e.target.checked)}
                disabled={!course || readOnly}
                className="rounded border-border"
              />
              {course?.counts_toward_load === false ? "No" : "Yes"}
            </label>
          </div>
          <DetailRow label="Level" value={level} />
          <DetailRow label="Enrollment Cap" value={section?.enrollment_cap != null ? String(section.enrollment_cap) : "\u2014"} />
          <DetailRow label="Session" value={section?.term_session?.name ?? section?.session?.replace("_", " ") ?? "Regular"} />
          {section?.duration_weeks && (
            <DetailRow label="Duration" value={`${section.duration_weeks} weeks`} />
          )}
          {section?.start_date && section?.end_date && (
            <DetailRow label="Dates" value={`${section.start_date} to ${section.end_date}`} />
          )}
          <DetailRow label="Modality" value={section?.modality?.replace("_", " ") ?? "\u2014"} />
          <DetailRow label="Status" value={section?.status ?? "\u2014"} />
        </div>

        <DialogFooter className="border-t px-6 py-3 bg-muted/50 sm:justify-between">
          {readOnly ? (
            <div />
          ) : (
            <Button
              variant="ghost"
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={() => setShowDeleteConfirm(true)}
            >
              Delete
            </Button>
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>Close</Button>
            {!readOnly && <Button onClick={() => onEdit(meeting)}>Edit</Button>}
          </div>
        </DialogFooter>
      </DialogContent>

      <ConfirmDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        title="Delete meeting?"
        description="This will remove the meeting from the schedule. You can undo this action."
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={() => onDelete(meeting.id)}
      />
    </Dialog>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex">
      <span className="w-32 flex-shrink-0 text-muted-foreground font-medium">{label}</span>
      <span className="capitalize">{value}</span>
    </div>
  );
}
