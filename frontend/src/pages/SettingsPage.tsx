import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import type { AppSetting } from "../api/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { StyledSelect } from "@/components/ui/styled-select";
import { FolderOpen } from "lucide-react";

interface DirectoryEntry {
  name: string;
  path: string;
  is_dir: boolean;
}

interface DirectoryListing {
  path: string;
  parent: string | null;
  entries: DirectoryEntry[];
}

interface GitHubStatus {
  configured: boolean;
  repo_url: string;
  pages_url: string;
}

interface DatabaseInfo {
  path: string;
  size_bytes: number;
  size_display: string;
}

// --- Directory Picker Dialog ---
function DirectoryPickerDialog({
  currentPath,
  onSelect,
  onCancel,
}: {
  currentPath: string;
  onSelect: (path: string) => void;
  onCancel: () => void;
}) {
  const queryClient = useQueryClient();
  const [browsePath, setBrowsePath] = useState(currentPath || "");
  const [newFolderName, setNewFolderName] = useState("");
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderError, setNewFolderError] = useState<string | null>(null);

  const { data: listing, isLoading } = useQuery({
    queryKey: ["browse-directories", browsePath],
    queryFn: () =>
      api.get<DirectoryListing>(
        `/settings/browse-directories?path=${encodeURIComponent(browsePath)}`
      ),
  });

  const createFolderMutation = useMutation({
    mutationFn: (payload: { parent: string; name: string }) =>
      api.post<DirectoryEntry>("/settings/create-directory", payload),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ["browse-directories", browsePath] });
      setShowNewFolder(false);
      setNewFolderName("");
      setNewFolderError(null);
      setBrowsePath(created.path);
    },
    onError: (e: Error) => setNewFolderError(e.message),
  });

  function handleCreateFolder() {
    const name = newFolderName.trim();
    if (!name) return;
    setNewFolderError(null);
    createFolderMutation.mutate({ parent: listing?.path ?? browsePath, name });
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onCancel(); }}>
      <DialogContent className="sm:max-w-[520px] max-h-[80vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-5 py-4 border-b">
          <DialogTitle>Choose Export Directory</DialogTitle>
          <DialogDescription className="font-mono truncate">
            {listing?.path ?? browsePath}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto min-h-0 px-2 py-2">
          {listing?.parent && (
            <button
              onClick={() => setBrowsePath(listing.parent!)}
              className="w-full text-left px-3 py-2 text-sm rounded-md hover:bg-accent flex items-center gap-2"
            >
              <span className="text-muted-foreground">{"../"}</span>
              <span className="text-muted-foreground">Parent directory</span>
            </button>
          )}
          {isLoading && (
            <p className="text-sm text-muted-foreground px-3 py-4">Loading...</p>
          )}
          {listing?.entries.length === 0 && !isLoading && !showNewFolder && (
            <p className="text-sm text-muted-foreground px-3 py-4">No subdirectories</p>
          )}
          {listing?.entries.map((entry) => (
            <button
              key={entry.path}
              onClick={() => setBrowsePath(entry.path)}
              className="w-full text-left px-3 py-2 text-sm rounded-md hover:bg-accent flex items-center gap-2"
            >
              <svg
                className="w-4 h-4 text-amber-500 shrink-0"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
              </svg>
              <span>{entry.name}</span>
            </button>
          ))}

          {/* Inline new folder creation */}
          {showNewFolder && (
            <div className="px-3 py-2 space-y-2">
              <div className="flex items-center gap-2">
                <svg
                  className="w-4 h-4 text-amber-500 shrink-0"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
                </svg>
                <input
                  type="text"
                  autoFocus
                  className="flex-1 border border-border rounded-md px-2 py-1 text-sm"
                  placeholder="Folder name"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleCreateFolder();
                    if (e.key === "Escape") {
                      setShowNewFolder(false);
                      setNewFolderName("");
                      setNewFolderError(null);
                    }
                  }}
                />
                <Button
                  size="sm"
                  onClick={handleCreateFolder}
                  disabled={!newFolderName.trim() || createFolderMutation.isPending}
                >
                  Create
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setShowNewFolder(false);
                    setNewFolderName("");
                    setNewFolderError(null);
                  }}
                >
                  Cancel
                </Button>
              </div>
              {newFolderError && (
                <p className="text-xs text-destructive">{newFolderError}</p>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="px-5 py-3 border-t flex items-center gap-2 sm:justify-between">
          <Button
            variant="outline"
            onClick={() => {
              setShowNewFolder(true);
              setNewFolderName("");
              setNewFolderError(null);
            }}
          >
            New Folder
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={onCancel}>Cancel</Button>
            <Button onClick={() => onSelect(listing?.path ?? browsePath)}>
              Select This Folder
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// --- GitHub Setup Dialog ---
function GitHubSetupDialog({
  currentRepoUrl,
  onDone,
  onCancel,
}: {
  currentRepoUrl: string;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [repoUrl, setRepoUrl] = useState(currentRepoUrl);
  const [token, setToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const setupMutation = useMutation({
    mutationFn: (payload: { repo_url: string; token: string }) =>
      api.post<{ configured: boolean; repo_url: string }>(
        "/settings/github-setup",
        payload
      ),
    onSuccess: () => {
      setSuccess(true);
      setError(null);
      setTimeout(onDone, 1500);
    },
    onError: (e: Error) => setError(e.message),
  });

  function handleSubmit() {
    if (!repoUrl.trim()) {
      setError("Repository URL is required.");
      return;
    }
    if (!token.trim()) {
      setError("Personal access token is required.");
      return;
    }
    setError(null);
    setupMutation.mutate({ repo_url: repoUrl.trim(), token: token.trim() });
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onCancel(); }}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>GitHub Pages Setup</DialogTitle>
          <DialogDescription>
            Connect a GitHub repo for publishing schedules as static pages.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label htmlFor="github-repo-url" className="block text-sm font-medium mb-1">
              Repository URL
            </label>
            <input
              id="github-repo-url"
              type="text"
              className="w-full border border-border rounded-md px-3 py-2 text-sm"
              placeholder="https://github.com/user/schedules"
              aria-required
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Will be created automatically if it doesn't exist.
            </p>
          </div>

          <div>
            <label htmlFor="github-token" className="block text-sm font-medium mb-1">
              Personal Access Token
            </label>
            <input
              id="github-token"
              type="password"
              className="w-full border border-border rounded-md px-3 py-2 text-sm font-mono"
              placeholder="ghp_..."
              aria-required
              value={token}
              onChange={(e) => setToken(e.target.value)}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Needs <code className="bg-muted px-1 rounded">repo</code> scope.
              Stored securely on the server, never sent back to the browser.
            </p>
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
          {success && (
            <p className="text-sm text-success font-medium">
              GitHub configured successfully!
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={setupMutation.isPending || success}>
            {setupMutation.isPending ? "Saving..." : "Save & Connect"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// --- Main Settings Page ---
export function SettingsPage() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<Record<string, string>>({
    department_name: "",
    export_directory: "",
    github_pages_url: "",
    academic_year_start_month: "7",
    disable_availability_warnings: "false",
  });
  const [toast, setToast] = useState<string | null>(null);
  const [dirPickerOpen, setDirPickerOpen] = useState(false);
  const [githubDialogOpen, setGithubDialogOpen] = useState(false);
  const [showRelocate, setShowRelocate] = useState(false);
  const [relocatePath, setRelocatePath] = useState("");
  const [relocateCopy, setRelocateCopy] = useState(true);
  const [relocateStatus, setRelocateStatus] = useState<string | null>(null);

  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: () => api.get<AppSetting[]>("/settings"),
  });

  const { data: githubStatus, refetch: refetchGithub } = useQuery({
    queryKey: ["github-status"],
    queryFn: () => api.get<GitHubStatus>("/settings/github-status"),
  });

  const { data: dbInfo } = useQuery({
    queryKey: ["database-info"],
    queryFn: () => api.get<DatabaseInfo>("/settings/database-info"),
  });

  useEffect(() => {
    if (settings) {
      const map: Record<string, string> = {};
      settings.forEach((s) => {
        map[s.key] = s.value;
      });
      setForm((prev) => ({ ...prev, ...map }));
    }
  }, [settings]);

  const relocateMutation = useMutation({
    mutationFn: (payload: { new_path: string; copy_existing: boolean }) =>
      api.post("/settings/database-relocate", payload),
    onSuccess: () => {
      setRelocateStatus("Database location updated. Please restart the app to use the new location.");
      setShowRelocate(false);
    },
    onError: () => {
      setRelocateStatus("Failed to relocate database. Check the path and try again.");
    },
  });

  const saveMutation = useMutation({
    mutationFn: (items: AppSetting[]) =>
      api.put<AppSetting[]>("/settings", items),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      setToast("Settings saved.");
      setTimeout(() => setToast(null), 3000);
    },
  });

  function handleSave() {
    const items: AppSetting[] = Object.entries(form).map(([key, value]) => ({
      key,
      value,
    }));
    saveMutation.mutate(items);
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <h2 className="text-xl font-bold">Settings</h2>

      {/* General */}
      <section className="bg-card rounded-lg border border-border p-6 space-y-4">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          General
        </h3>

        <div>
          <label htmlFor="settings-dept-name" className="block text-sm font-medium mb-1">
            Department Name
          </label>
          <input
            id="settings-dept-name"
            type="text"
            className="w-full border border-border rounded-md px-3 py-2 text-sm"
            placeholder="e.g. Computer Science"
            value={form.department_name}
            onChange={(e) =>
              setForm({ ...form, department_name: e.target.value })
            }
          />
          <p className="text-xs text-muted-foreground mt-1">
            Shown in the exported HTML header.
          </p>
        </div>

        <div className="flex items-center gap-3 pt-1">
          <Button onClick={handleSave} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? "Saving..." : "Save"}
          </Button>
          {toast && (
            <span className="text-sm text-success font-medium">
              {toast}
            </span>
          )}
        </div>
      </section>

      {/* Scheduling */}
      <section className="bg-card rounded-lg border border-border p-6 space-y-4">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Scheduling
        </h3>

        <div className="flex items-center gap-3">
          <input
            id="settings-disable-avail-warnings"
            type="checkbox"
            checked={form.disable_availability_warnings === "true"}
            onChange={(e) =>
              setForm({
                ...form,
                disable_availability_warnings: e.target.checked ? "true" : "false",
              })
            }
          />
          <label htmlFor="settings-disable-avail-warnings" className="text-sm font-medium">
            Disable inline availability warnings
          </label>
        </div>
        <p className="text-xs text-muted-foreground">
          Turn off warnings when assigning instructors to time slots that conflict with their availability preferences.
          Hard and soft conflicts in term validation are always checked regardless of this setting.
        </p>

        <Button onClick={handleSave} disabled={saveMutation.isPending}>
          {saveMutation.isPending ? "Saving..." : "Save"}
        </Button>
      </section>

      {/* Academic Year */}
      <section className="bg-card rounded-lg border border-border p-6 space-y-4">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Academic Year
        </h3>

        <div>
          <label htmlFor="settings-ay-start" className="block text-sm font-medium mb-1">
            Academic Year Start Month
          </label>
          <StyledSelect
            id="settings-ay-start"
            className="w-48"
            value={form.academic_year_start_month}
            onChange={(e) =>
              setForm({ ...form, academic_year_start_month: e.target.value })
            }
          >
            {[
              "January", "February", "March", "April", "May", "June",
              "July", "August", "September", "October", "November", "December",
            ].map((name, i) => (
              <option key={i + 1} value={String(i + 1)}>{name}</option>
            ))}
          </StyledSelect>
          <p className="text-xs text-muted-foreground mt-1">
            The month the academic year begins. Default is July (Jul 1 – Jun 30).
            Terms are automatically assigned to academic years based on their start date and this setting.
          </p>
        </div>

        <Button onClick={handleSave} disabled={saveMutation.isPending}>
          {saveMutation.isPending ? "Saving..." : "Save"}
        </Button>
      </section>

      {/* Export Directory */}
      <section className="bg-card rounded-lg border border-border p-6 space-y-4">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Local Export
        </h3>

        <div>
          <label htmlFor="settings-export-dir" className="block text-sm font-medium mb-1">
            Export Directory
          </label>
          <div className="flex gap-2">
            <input
              id="settings-export-dir"
              type="text"
              className="flex-1 border border-border rounded-md px-3 py-2 text-sm font-mono"
              placeholder="~/Documents/schedules"
              value={form.export_directory}
              onChange={(e) =>
                setForm({ ...form, export_directory: e.target.value })
              }
            />
            <Button variant="outline" onClick={() => setDirPickerOpen(true)}>
              Browse...
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Directory where "Save to Local Directory" writes HTML files.
          </p>
        </div>

        <Button onClick={handleSave} disabled={saveMutation.isPending}>
          {saveMutation.isPending ? "Saving..." : "Save"}
        </Button>
      </section>

      {/* Database */}
      <section className="bg-card rounded-lg border border-border p-6 space-y-4">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Database
        </h3>

        {dbInfo && (
          <div className="space-y-3">
            <div className="text-sm">
              <span className="text-muted-foreground">File path: </span>
              <span className="font-mono text-xs break-all">{dbInfo.path}</span>
            </div>
            <div className="text-sm">
              <span className="text-muted-foreground">Size: </span>
              <span className="font-medium">{dbInfo.size_display}</span>
            </div>
            <Button
              onClick={() => {
                const isFileProtocol = window.location.protocol === "file:";
                const base = isFileProtocol ? "http://127.0.0.1:8000/api" : "/api";
                const url = `${base}/settings/database-backup`;
                const a = document.createElement("a");
                fetch(url)
                  .then((res) => res.blob())
                  .then((blob) => {
                    const blobUrl = URL.createObjectURL(blob);
                    a.href = blobUrl;
                    a.download = "scheduler-backup.db";
                    a.click();
                    URL.revokeObjectURL(blobUrl);
                  });
              }}
            >
              Download Backup
            </Button>
            <p className="text-xs text-muted-foreground">
              Downloads a portable copy of the database file. Keep this as a backup or transfer to another machine.
            </p>

            <div className="border-t border-border pt-4 mt-4 space-y-3">
              <Button
                variant="outline"
                onClick={() => {
                  setShowRelocate(!showRelocate);
                  setRelocatePath(dbInfo?.path || "");
                  setRelocateStatus(null);
                }}
              >
                <FolderOpen className="h-4 w-4 mr-1" />
                Change Location
              </Button>

              {relocateStatus && (
                <p className="text-sm text-amber-600 dark:text-amber-400 font-medium">
                  {relocateStatus}
                </p>
              )}

              {showRelocate && (
                <div className="space-y-3 bg-muted/30 rounded-lg p-4 border border-border">
                  <label htmlFor="relocate-path" className="text-sm font-medium">
                    New database path
                  </label>
                  <input
                    id="relocate-path"
                    type="text"
                    className="w-full border border-border rounded px-3 py-2 text-sm font-mono"
                    value={relocatePath}
                    onChange={(e) => setRelocatePath(e.target.value)}
                    placeholder="/path/to/scheduler.db"
                  />
                  <div className="flex items-center gap-2">
                    <input
                      id="relocate-copy"
                      type="checkbox"
                      checked={relocateCopy}
                      onChange={(e) => setRelocateCopy(e.target.checked)}
                    />
                    <label htmlFor="relocate-copy" className="text-sm">
                      Copy existing database to new location
                    </label>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      disabled={!relocatePath.trim() || relocateMutation.isPending}
                      onClick={() =>
                        relocateMutation.mutate({
                          new_path: relocatePath,
                          copy_existing: relocateCopy,
                        })
                      }
                    >
                      {relocateMutation.isPending ? "Moving..." : "Confirm"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setShowRelocate(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    The app will need to be restarted after changing the database location.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </section>

      {/* GitHub Pages */}
      <section className="bg-card rounded-lg border border-border p-6 space-y-4">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          GitHub Pages
        </h3>

        {githubStatus?.configured ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-success" />
              <span className="text-sm font-medium">Connected</span>
            </div>
            <div className="text-sm">
              <span className="text-muted-foreground">Repository: </span>
              <span className="font-mono">{githubStatus.repo_url}</span>
            </div>
            <div className="text-sm">
              <span className="text-muted-foreground">Token: </span>
              <span className="font-mono text-muted-foreground">
                {"*".repeat(20)}
              </span>
            </div>

            <div>
              <label htmlFor="settings-gh-pages-url" className="block text-sm font-medium mb-1">
                GitHub Pages URL
              </label>
              <input
                id="settings-gh-pages-url"
                type="text"
                className="w-full border border-border rounded-md px-3 py-2 text-sm font-mono"
                placeholder="https://username.github.io/schedules"
                value={form.github_pages_url}
                onChange={(e) =>
                  setForm({ ...form, github_pages_url: e.target.value })
                }
              />
              <p className="text-xs text-muted-foreground mt-1">
                Base URL for published schedules. Leave blank to auto-derive from the repository URL.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Button onClick={handleSave} disabled={saveMutation.isPending}>
                {saveMutation.isPending ? "Saving..." : "Save"}
              </Button>
              <Button variant="outline" onClick={() => setGithubDialogOpen(true)}>
                Reconfigure
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                Not configured
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              Connect a GitHub repository to publish schedules as static pages
              with a shareable URL.
            </p>
            <Button onClick={() => setGithubDialogOpen(true)}>
              Set Up GitHub
            </Button>
          </div>
        )}
      </section>

      {/* Dialogs */}
      {dirPickerOpen && (
        <DirectoryPickerDialog
          currentPath={form.export_directory}
          onSelect={(path) => {
            setForm({ ...form, export_directory: path });
            setDirPickerOpen(false);
          }}
          onCancel={() => setDirPickerOpen(false)}
        />
      )}

      {githubDialogOpen && (
        <GitHubSetupDialog
          currentRepoUrl={githubStatus?.repo_url ?? ""}
          onDone={() => {
            setGithubDialogOpen(false);
            refetchGithub();
          }}
          onCancel={() => setGithubDialogOpen(false)}
        />
      )}
    </div>
  );
}
