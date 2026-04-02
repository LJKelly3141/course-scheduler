import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import type { Room, Building } from "../api/types";
import { ConfirmDialog } from "../components/ui/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StyledSelect } from "@/components/ui/styled-select";
import { Plus, Trash2 } from "lucide-react";
import { useUndoRedo } from "../hooks/useUndoRedo";
import { useSort } from "../hooks/useSort";
import { SortableHeader } from "@/components/ui/sortable-header";

export function RoomsPage() {
  const queryClient = useQueryClient();
  const { pushUndo } = useUndoRedo();
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState<Partial<Room>>({});
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editCap, setEditCap] = useState<number>(0);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [deleteTarget, setDeleteTarget] = useState<{ type: "single"; id: number } | { type: "batch" } | null>(null);

  const { data: rooms = [], isLoading: loadingRooms, isError: roomsError } = useQuery({
    queryKey: ["rooms"],
    queryFn: () => api.get<Room[]>("/rooms"),
  });

  const { data: buildings = [] } = useQuery({
    queryKey: ["buildings"],
    queryFn: () => api.get<Building[]>("/buildings"),
  });

  const createMutation = useMutation({
    mutationFn: (data: Partial<Room>) => api.post<Room>("/rooms", data),
    onSuccess: (created, data) => {
      queryClient.invalidateQueries({ queryKey: ["rooms"] });
      setForm({});
      setShowAdd(false);
      let currentId = created.id;
      pushUndo({
        label: `Create room ${created.room_number}`,
        undoFn: async () => { await api.delete(`/rooms/${currentId}`); },
        redoFn: async () => {
          const re = await api.post<Room>("/rooms", data);
          currentId = re.id;
        },
        invalidateKeys: [["rooms"], ["meetings"], ["validation"]],
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, capacity, oldCapacity }: { id: number; capacity: number; oldCapacity: number }) =>
      api.put(`/rooms/${id}`, { capacity }),
    onSuccess: (_data, { id, capacity, oldCapacity }) => {
      queryClient.invalidateQueries({ queryKey: ["rooms"] });
      setEditingId(null);
      const room = rooms.find((r) => r.id === id);
      pushUndo({
        label: `Update room ${room?.room_number ?? id} capacity`,
        undoFn: async () => { await api.put(`/rooms/${id}`, { capacity: oldCapacity }); },
        redoFn: async () => { await api.put(`/rooms/${id}`, { capacity }); },
        invalidateKeys: [["rooms"], ["meetings"], ["validation"]],
      });
    },
  });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["rooms"] });
    queryClient.invalidateQueries({ queryKey: ["meetings"] });
    queryClient.invalidateQueries({ queryKey: ["validation"] });
  };

  const deleteMutation = useMutation({
    mutationFn: (room: Room) => api.delete(`/rooms/${room.id}`),
    onSuccess: (_data, room) => {
      invalidateAll();
      let currentId = room.id;
      pushUndo({
        label: `Delete room ${room.room_number}`,
        undoFn: async () => {
          const re = await api.post<Room>("/rooms", {
            building_id: room.building_id,
            room_number: room.room_number,
            capacity: room.capacity,
          });
          currentId = re.id;
        },
        redoFn: async () => { await api.delete(`/rooms/${currentId}`); },
        invalidateKeys: [["rooms"], ["meetings"], ["validation"]],
      });
    },
    onError: () => invalidateAll(),
  });

  const batchDeleteMutation = useMutation({
    mutationFn: (ids: number[]) => api.post("/rooms/batch-delete", { ids }),
    onSettled: () => {
      invalidateAll();
      setSelectedIds(new Set());
    },
  });

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === rooms.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(rooms.map((r) => r.id)));
  };

  const filteredRooms = search
    ? rooms.filter((r) => {
        const q = search.toLowerCase();
        return (
          (r.building?.name && r.building.name.toLowerCase().includes(q)) ||
          (r.building?.abbreviation && r.building.abbreviation.toLowerCase().includes(q)) ||
          r.room_number.toLowerCase().includes(q)
        );
      })
    : rooms;

  const { sortState, toggleSort, sortItems } = useSort<"building" | "room_number" | "capacity">("building");

  const sortedRooms = sortItems(filteredRooms, (r) => {
    switch (sortState.key) {
      case "building": return r.building?.name ?? "";
      case "room_number": return r.room_number;
      case "capacity": return r.capacity;
      default: return r.building?.name ?? "";
    }
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Rooms</h2>
        <div className="flex gap-2 items-center">
          <Input
            placeholder="Search rooms..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-56"
            aria-label="Search rooms"
          />
          {selectedIds.size > 0 && (
            <Button variant="destructive" onClick={() => setDeleteTarget({ type: "batch" })}>
              <Trash2 className="h-4 w-4" />
              Delete Selected ({selectedIds.size})
            </Button>
          )}
          <Button onClick={() => setShowAdd(!showAdd)}>
            <Plus className="h-4 w-4" />
            Add Room
          </Button>
        </div>
      </div>

      {showAdd && (
        <div className="bg-card rounded-lg border border-border p-4 space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label htmlFor="add-room-building" className="sr-only">Building</label>
              <StyledSelect id="add-room-building"
                value={form.building_id ?? ""} onChange={(e) => setForm({ ...form, building_id: Number(e.target.value) })}>
                <option value="">Select Building</option>
                {buildings.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </StyledSelect>
            </div>
            <div>
              <label htmlFor="add-room-number" className="sr-only">Room Number</label>
              <input id="add-room-number" placeholder="Room Number" className="border border-border rounded px-2 py-1.5 text-sm w-full"
                value={form.room_number ?? ""} onChange={(e) => setForm({ ...form, room_number: e.target.value })} />
            </div>
            <div>
              <label htmlFor="add-room-capacity" className="sr-only">Capacity</label>
              <input id="add-room-capacity" type="number" placeholder="Capacity" className="border border-border rounded px-2 py-1.5 text-sm w-full"
                value={form.capacity ?? ""} onChange={(e) => setForm({ ...form, capacity: parseInt(e.target.value) || 0 })} />
            </div>
          </div>
          <Button size="sm" onClick={() => createMutation.mutate(form)}>Save</Button>
        </div>
      )}

      <div className="bg-card rounded-lg border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50 text-left">
              <th className="px-4 py-3 w-10">
                <input
                  type="checkbox"
                  checked={rooms.length > 0 && selectedIds.size === rooms.length}
                  onChange={toggleAll}
                  aria-label="Select all rooms"
                />
              </th>
              <SortableHeader label="Building" sortKey="building" currentKey={sortState.key} direction={sortState.direction} onSort={toggleSort as (key: string) => void} />
              <SortableHeader label="Room #" sortKey="room_number" currentKey={sortState.key} direction={sortState.direction} onSort={toggleSort as (key: string) => void} />
              <SortableHeader label="Capacity" sortKey="capacity" currentKey={sortState.key} direction={sortState.direction} onSort={toggleSort as (key: string) => void} />
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loadingRooms && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center">
                  <div className="flex items-center justify-center gap-3 text-muted-foreground">
                    <div className="h-5 w-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    <span className="text-sm">Loading rooms...</span>
                  </div>
                </td>
              </tr>
            )}
            {roomsError && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center">
                  <p className="text-sm text-destructive">Failed to load rooms.</p>
                </td>
              </tr>
            )}
            {!loadingRooms && !roomsError && rooms.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                  No rooms yet. Click "+ Add Room" to create one.
                </td>
              </tr>
            )}
            {sortedRooms.map((room) => (
              <tr key={room.id} className="border-b border-border hover:bg-muted/30">
                <td className="px-4 py-2.5">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(room.id)}
                    onChange={() => toggleSelect(room.id)}
                    aria-label={`Select room ${room.building?.name ?? ''} ${room.room_number}`}
                  />
                </td>
                <td className="px-4 py-2.5">{room.building?.name ?? `Building ${room.building_id}`}</td>
                <td className="px-4 py-2.5">{room.room_number}</td>
                <td className="px-4 py-2.5">
                  {editingId === room.id ? (
                    <div className="flex gap-2 items-center">
                      <label htmlFor={`edit-cap-${room.id}`} className="sr-only">Capacity for {room.room_number}</label>
                      <input id={`edit-cap-${room.id}`} type="number" className="border rounded px-2 py-1 w-20 text-sm"
                        value={editCap} onChange={(e) => setEditCap(parseInt(e.target.value) || 0)} />
                      <Button variant="link" size="sm" className="h-auto px-0" onClick={() => updateMutation.mutate({ id: room.id, capacity: editCap, oldCapacity: room.capacity })}>Save</Button>
                      <Button variant="ghost" size="sm" className="h-auto px-0" onClick={() => setEditingId(null)}>Cancel</Button>
                    </div>
                  ) : (
                    <span onClick={() => { setEditingId(room.id); setEditCap(room.capacity); }}
                      className="cursor-pointer hover:text-primary">{room.capacity}</span>
                  )}
                </td>
                <td className="px-4 py-2.5">
                  <Button variant="link" size="sm" className="h-auto px-0 text-destructive" onClick={() => setDeleteTarget({ type: "single", id: room.id })}>Delete</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        title={deleteTarget?.type === "batch" ? `Delete ${selectedIds.size} room(s)?` : "Delete room?"}
        description="This will permanently remove the selected room(s) and any associated meetings."
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={() => {
          if (deleteTarget?.type === "batch") {
            batchDeleteMutation.mutate([...selectedIds]);
          } else if (deleteTarget?.type === "single") {
            const room = rooms.find((r) => r.id === deleteTarget.id);
            if (room) deleteMutation.mutate(room);
          }
          setDeleteTarget(null);
        }}
      />
    </div>
  );
}
