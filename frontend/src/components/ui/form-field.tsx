import * as React from "react"

import { cn } from "@/lib/utils"
import { Label } from "@/components/ui/label"

interface FormFieldProps {
  label: string
  error?: string
  required?: boolean
  helpText?: string
  className?: string
  children: React.ReactElement<React.InputHTMLAttributes<HTMLElement>>
}

function FormField({ label, error, required, helpText, className, children }: FormFieldProps) {
  const id = React.useId()
  const errorId = error ? `${id}-error` : undefined
  const helpId = helpText ? `${id}-help` : undefined
  const describedBy = [errorId, helpId].filter(Boolean).join(" ") || undefined

  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={id}>
        {label}
        {required && <span className="text-destructive ml-1" aria-hidden="true">*</span>}
      </Label>
      {React.cloneElement(children, {
        id,
        "aria-required": required || undefined,
        "aria-invalid": error ? true : undefined,
        "aria-describedby": describedBy,
      })}
      {helpText && !error && (
        <p id={helpId} className="text-xs text-muted-foreground">{helpText}</p>
      )}
      {error && (
        <p id={errorId} role="alert" className="text-xs text-destructive">{error}</p>
      )}
    </div>
  )
}

export { FormField }
export type { FormFieldProps }
