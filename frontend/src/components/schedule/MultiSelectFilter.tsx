import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown } from "lucide-react";

interface MultiSelectFilterProps {
  label: string;
  options: { value: string; label: string }[];
  selected: Set<string>;
  onChange: (selected: Set<string>) => void;
}

export function MultiSelectFilter({ label, options, selected, onChange }: MultiSelectFilterProps) {
  const displayLabel = selected.size > 0 ? `${label} (${selected.size})` : label;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1">
          {displayLabel}
          <ChevronDown className="h-3.5 w-3.5 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="max-h-64 overflow-y-auto" align="start">
        <div className="flex gap-1 px-2 py-1">
          <button
            className="text-xs text-primary hover:underline"
            onClick={() => onChange(new Set(options.map((o) => o.value)))}
          >
            Select All
          </button>
          <span className="text-xs text-muted-foreground">|</span>
          <button
            className="text-xs text-primary hover:underline"
            onClick={() => onChange(new Set())}
          >
            Clear
          </button>
        </div>
        <DropdownMenuSeparator />
        {options.map((opt) => (
          <DropdownMenuCheckboxItem
            key={opt.value}
            checked={selected.has(opt.value)}
            onCheckedChange={(checked) => {
              const next = new Set(selected);
              if (checked) next.add(opt.value);
              else next.delete(opt.value);
              onChange(next);
            }}
            onSelect={(e) => e.preventDefault()}
          >
            {opt.label}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
