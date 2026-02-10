import { useDroppable } from "@dnd-kit/core";
import type { TimeBlock } from "../../api/types";
import { cn, parseDaysOfWeek } from "../../lib/utils";

interface Props {
  block: TimeBlock;
  day: string;
  isDragging: boolean;
  children: React.ReactNode;
}

export function DroppableCell({ block, day, isDragging, children }: Props) {
  const blockDays = parseDaysOfWeek(block.days_of_week);
  const dayBelongsToBlock = blockDays.includes(day);

  const { isOver, setNodeRef } = useDroppable({
    id: `cell-${block.id}-${day}`,
    data: { block, day },
    disabled: !dayBelongsToBlock,
  });

  return (
    <td
      ref={setNodeRef}
      className={cn(
        "px-1 py-1 align-top relative min-h-[48px]",
        isDragging && dayBelongsToBlock && "transition-colors duration-150",
        isOver && dayBelongsToBlock && "bg-primary/10 outline-dashed outline-2 outline-primary/40 -outline-offset-2"
      )}
    >
      {children}
    </td>
  );
}
