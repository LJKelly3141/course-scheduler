import * as React from "react"

import { cn } from "@/lib/utils"

function StyledSelect({ className, children, ...props }: React.ComponentProps<"select">) {
  return (
    <select
      data-slot="styled-select"
      className={cn(
        "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm dark:bg-input/30",
        "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
        "aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40",
        "appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%2212%22%20viewBox%3D%220%200%2012%2012%22%3E%3Cpath%20fill%3D%22%236b7280%22%20d%3D%22M2.22%204.47a.75.75%200%20011.06%200L6%207.19l2.72-2.72a.75.75%200%20011.06%201.06l-3.25%203.25a.75.75%200%2001-1.06%200L2.22%205.53a.75.75%200%20010-1.06z%22%2F%3E%3C%2Fsvg%3E')]",
        "bg-[length:12px] bg-[position:right_8px_center] bg-no-repeat pr-8",
        className
      )}
      {...props}
    >
      {children}
    </select>
  )
}

export { StyledSelect }
