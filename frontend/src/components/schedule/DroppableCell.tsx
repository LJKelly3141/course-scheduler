import { useDroppable } from "@dnd-kit/core";
import { cn } from "../../lib/utils";

interface Props {
  day: string;
  slotIndex: number;
  isDragging: boolean;
  style: React.CSSProperties;
  "aria-label"?: string;
}

export function DroppableCell({ day, slotIndex, isDragging, style, "aria-label": ariaLabel }: Props) {
  const { isOver, setNodeRef } = useDroppable({
    id: `slot-${day}-${slotIndex}`,
    data: { day, slotIndex },
  });

  const isHourBoundary = slotIndex % 4 === 0;

  return (
    <div
      ref={setNodeRef}
      style={style}
      aria-label={ariaLabel}
      className={cn(
        "border-r border-border/30",
        isHourBoundary
          ? "border-t border-t-border"
          : "border-t border-t-border/20",
        isDragging && "transition-colors duration-150",
        isOver && "bg-primary/10"
      )}
    />
  );
}
