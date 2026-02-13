import { useDroppable } from "@dnd-kit/core";
import type { TimeBlock } from "../../api/types";
import { cn } from "../../lib/utils";

interface Props {
  block: TimeBlock;
  day: string;
  isDragging: boolean;
  children: React.ReactNode;
}

export function DroppableCell({ block, day, isDragging, children }: Props) {
  const { isOver, setNodeRef } = useDroppable({
    id: `cell-${block.id}-${day}`,
    data: { block, day },
  });

  return (
    <td
      ref={setNodeRef}
      className={cn(
        "px-1 py-1 align-top relative min-h-[48px]",
        isDragging && "transition-colors duration-150",
        isOver && "bg-primary/10 outline-dashed outline-2 outline-primary/40 -outline-offset-2"
      )}
    >
      {children}
    </td>
  );
}
