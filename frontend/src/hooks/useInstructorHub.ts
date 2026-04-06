import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
import type {
  Instructor,
  AvailabilityTemplate,
  InstructorAvailability,
  InstructorNote,
  InstructorWorkload,
} from "@/api/types";

export function useInstructors() {
  return useQuery<Instructor[]>({
    queryKey: ["instructors"],
    queryFn: () => api.get("/instructors"),
  });
}

export function useInstructor(id: number | null) {
  return useQuery<Instructor>({
    queryKey: ["instructors", id],
    queryFn: () => api.get(`/instructors/${id}`),
    enabled: id !== null,
  });
}

export function useCreateInstructor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<Instructor>) =>
      api.post<Instructor>("/instructors", data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["instructors"] }),
  });
}

export function useUpdateInstructor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: Partial<Instructor> & { id: number }) =>
      api.put<Instructor>(`/instructors/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["instructors"] }),
  });
}

export function useDeleteInstructor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete(`/instructors/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["instructors"] }),
  });
}

export function useInstructorAvailability(
  instructorId: number | null,
  termId: number | null
) {
  return useQuery<InstructorAvailability[]>({
    queryKey: ["instructor-availability", instructorId, termId],
    queryFn: () =>
      api.get(`/instructors/${instructorId}/availability?term_id=${termId}`),
    enabled: instructorId !== null && termId !== null,
  });
}

export function useSaveAvailability() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      instructorId,
      termId,
      slots,
    }: {
      instructorId: number;
      termId: number;
      slots: Array<{
        day_of_week: string;
        start_time: string;
        end_time: string;
        type: string;
      }>;
    }) =>
      api.put(
        `/instructors/${instructorId}/availability?term_id=${termId}`,
        slots
      ),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["instructor-availability"] }),
  });
}

export function useAvailabilityTemplates(
  instructorId: number | null,
  termType?: string
) {
  const params = termType ? `?term_type=${termType}` : "";
  return useQuery<AvailabilityTemplate[]>({
    queryKey: ["availability-templates", instructorId, termType],
    queryFn: () =>
      api.get(
        `/instructors/${instructorId}/availability-templates${params}`
      ),
    enabled: instructorId !== null,
  });
}

export function useSaveAvailabilityTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      instructorId,
      termType,
      slots,
    }: {
      instructorId: number;
      termType: string;
      slots: Array<{
        day_of_week: string;
        start_time: string;
        end_time: string;
        type: string;
      }>;
    }) =>
      api.put(
        `/instructors/${instructorId}/availability-templates/${termType}`,
        slots
      ),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["availability-templates"] }),
  });
}

export function useApplyTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      instructorId,
      termType,
      termId,
    }: {
      instructorId: number;
      termType: string;
      termId: number;
    }) =>
      api.post(
        `/instructors/${instructorId}/availability-templates/${termType}/apply/${termId}`,
        {}
      ),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["instructor-availability"] }),
  });
}

export function useInstructorNotes(
  instructorId: number | null,
  termId?: number | null
) {
  const params = termId ? `?term_id=${termId}` : "";
  return useQuery<InstructorNote[]>({
    queryKey: ["instructor-notes", instructorId, termId],
    queryFn: () =>
      api.get(`/instructors/${instructorId}/notes${params}`),
    enabled: instructorId !== null,
  });
}

export function useCreateNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      instructorId,
      ...data
    }: {
      instructorId: number;
      term_id?: number | null;
      category: string;
      content: string;
    }) => api.post(`/instructors/${instructorId}/notes`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["instructor-notes"] }),
  });
}

export function useDeleteNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      instructorId,
      noteId,
    }: {
      instructorId: number;
      noteId: number;
    }) => api.delete(`/instructors/${instructorId}/notes/${noteId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["instructor-notes"] }),
  });
}

export function useInstructorWorkload(termId: number | null) {
  return useQuery<{ instructors: InstructorWorkload[] }>({
    queryKey: ["instructor-workload", termId],
    queryFn: () =>
      api.get(`/analytics/instructor-workload?term_id=${termId}`),
    enabled: termId !== null,
  });
}
