import { useEffect } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { useTerm } from "../../hooks/useTerm";
import { useUndoRedo } from "../../hooks/useUndoRedo";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Undo2, Redo2, HelpCircle } from "lucide-react";

export function AppLayout() {
  const navigate = useNavigate();
  const { terms, selectedTerm, selectTerm } = useTerm();
  const { undo, redo, canUndo, canRedo, undoLabel, redoLabel, clearHistory } = useUndoRedo();

  useEffect(() => {
    clearHistory();
  }, [selectedTerm?.id, clearHistory]);

  return (
    <SidebarProvider>
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:px-4 focus:py-2 focus:bg-background focus:text-foreground focus:rounded-md focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-ring">
        Skip to main content
      </a>
      <AppSidebar
        terms={terms}
        selectedTerm={selectedTerm}
        onSelectTerm={selectTerm}
      />
      <SidebarInset>
        <header className="flex h-12 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 !h-4" />
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            disabled={!canUndo}
            onClick={() => undo()}
            title={undoLabel ? `Undo: ${undoLabel}` : "Nothing to undo"}
            aria-label={undoLabel ? `Undo: ${undoLabel}` : "Undo"}
          >
            <Undo2 className={`h-4 w-4 ${canUndo ? "" : "opacity-30"}`} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            disabled={!canRedo}
            onClick={() => redo()}
            title={redoLabel ? `Redo: ${redoLabel}` : "Nothing to redo"}
            aria-label={redoLabel ? `Redo: ${redoLabel}` : "Redo"}
          >
            <Redo2 className={`h-4 w-4 ${canRedo ? "" : "opacity-30"}`} />
          </Button>
          <Separator orientation="vertical" className="mr-2 !h-4" />
          <span className="text-sm font-medium text-muted-foreground flex-1">
            {selectedTerm?.name ?? "No term selected"}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => navigate("/help")}
            title="Help"
            aria-label="Help"
          >
            <HelpCircle className="h-4 w-4" />
          </Button>
        </header>
        <main id="main-content" className="flex-1 overflow-y-auto p-4">
          <Outlet context={{ selectedTerm, isReadOnly: selectedTerm?.status === "final" }} />
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
