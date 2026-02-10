import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import type { Room, Building } from "../api/types";

export function RoomsPage() {
  const queryClient = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState<Partial<Room>>({});
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editCap, setEditCap] = useState<number>(0);

  const { data: rooms = [] } = useQuery({
    queryKey: ["rooms"],
    queryFn: () => api.get<Room[]>("/rooms"),
  });

  const { data: buildings = [] } = useQuery({
    queryKey: ["buildings"],
    queryFn: () => api.get<Building[]>("/buildings"),
  });

  const createMutation = useMutation({
    mutationFn: (data: Partial<Room>) => api.post("/rooms", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rooms"] });
      setForm({});
      setShowAdd(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, capacity }: { id: number; capacity: number }) =>
      api.put(`/rooms/${id}`, { capacity }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rooms"] });
      setEditingId(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/rooms/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["rooms"] }),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Rooms</h2>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium hover:opacity-90"
        >
          + Add Room
        </button>
      </div>

      {showAdd && (
        <div className="bg-white rounded-lg border border-border p-4 space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <select className="border border-border rounded px-2 py-1.5 text-sm"
              value={form.building_id ?? ""} onChange={(e) => setForm({ ...form, building_id: Number(e.target.value) })}>
              <option value="">Select Building</option>
              {buildings.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
            <input placeholder="Room Number" className="border border-border rounded px-2 py-1.5 text-sm"
              value={form.room_number ?? ""} onChange={(e) => setForm({ ...form, room_number: e.target.value })} />
            <input type="number" placeholder="Capacity" className="border border-border rounded px-2 py-1.5 text-sm"
              value={form.capacity ?? ""} onChange={(e) => setForm({ ...form, capacity: parseInt(e.target.value) || 0 })} />
          </div>
          <button onClick={() => createMutation.mutate(form)}
            className="bg-primary text-primary-foreground px-4 py-1.5 rounded text-sm">Save</button>
        </div>
      )}

      <div className="bg-white rounded-lg border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50 text-left">
              <th className="px-4 py-3">Building</th>
              <th className="px-4 py-3">Room #</th>
              <th className="px-4 py-3">Capacity</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rooms.map((room) => (
              <tr key={room.id} className="border-b border-border hover:bg-muted/30">
                <td className="px-4 py-2.5">{room.building?.name ?? `Building ${room.building_id}`}</td>
                <td className="px-4 py-2.5">{room.room_number}</td>
                <td className="px-4 py-2.5">
                  {editingId === room.id ? (
                    <div className="flex gap-2 items-center">
                      <input type="number" className="border rounded px-2 py-1 w-20 text-sm"
                        value={editCap} onChange={(e) => setEditCap(parseInt(e.target.value) || 0)} />
                      <button onClick={() => updateMutation.mutate({ id: room.id, capacity: editCap })}
                        className="text-primary text-xs">Save</button>
                      <button onClick={() => setEditingId(null)} className="text-muted-foreground text-xs">Cancel</button>
                    </div>
                  ) : (
                    <span onClick={() => { setEditingId(room.id); setEditCap(room.capacity); }}
                      className="cursor-pointer hover:text-primary">{room.capacity}</span>
                  )}
                </td>
                <td className="px-4 py-2.5">
                  <button onClick={() => { if (confirm("Delete room?")) deleteMutation.mutate(room.id); }}
                    className="text-destructive text-xs hover:underline">Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
