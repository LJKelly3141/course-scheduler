import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import type { AppSetting } from "../api/types";

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg shadow-xl w-[520px] max-h-[80vh] flex flex-col">
        <div className="px-5 py-4 border-b border-border">
          <h3 className="text-base font-semibold">Choose Export Directory</h3>
          <p className="text-xs text-muted-foreground mt-1 font-mono truncate">
            {listing?.path ?? browsePath}
          </p>
        </div>

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
                <button
                  onClick={handleCreateFolder}
                  disabled={!newFolderName.trim() || createFolderMutation.isPending}
                  className="px-2 py-1 text-xs rounded-md bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50"
                >
                  Create
                </button>
                <button
                  onClick={() => {
                    setShowNewFolder(false);
                    setNewFolderName("");
                    setNewFolderError(null);
                  }}
                  className="px-2 py-1 text-xs rounded-md border border-border hover:bg-accent"
                >
                  Cancel
                </button>
              </div>
              {newFolderError && (
                <p className="text-xs text-destructive">{newFolderError}</p>
              )}
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-border flex items-center gap-2">
          <button
            onClick={() => {
              setShowNewFolder(true);
              setNewFolderName("");
              setNewFolderError(null);
            }}
            className="px-3 py-2 text-sm rounded-md border border-border hover:bg-accent flex items-center gap-1.5"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            New Folder
          </button>
          <div className="flex-1" />
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm rounded-md border border-border hover:bg-accent"
          >
            Cancel
          </button>
          <button
            onClick={() => onSelect(listing?.path ?? browsePath)}
            className="px-4 py-2 text-sm rounded-md bg-primary text-primary-foreground hover:opacity-90"
          >
            Select This Folder
          </button>
        </div>
      </div>
    </div>
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg shadow-xl w-[480px]">
        <div className="px-5 py-4 border-b border-border">
          <h3 className="text-base font-semibold">GitHub Pages Setup</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Connect a GitHub repo for publishing schedules as static pages.
          </p>
        </div>

        <div className="px-5 py-4 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">
              Repository URL
            </label>
            <input
              type="text"
              className="w-full border border-border rounded-md px-3 py-2 text-sm"
              placeholder="https://github.com/user/schedules"
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Will be created automatically if it doesn't exist.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Personal Access Token
            </label>
            <input
              type="password"
              className="w-full border border-border rounded-md px-3 py-2 text-sm font-mono"
              placeholder="ghp_..."
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
            <p className="text-sm text-emerald-600 font-medium">
              GitHub configured successfully!
            </p>
          )}
        </div>

        <div className="px-5 py-3 border-t border-border flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm rounded-md border border-border hover:bg-accent"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={setupMutation.isPending || success}
            className="px-4 py-2 text-sm rounded-md bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {setupMutation.isPending ? "Saving..." : "Save & Connect"}
          </button>
        </div>
      </div>
    </div>
  );
}

// --- Main Settings Page ---
export function SettingsPage() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<Record<string, string>>({
    department_name: "",
    export_directory: "",
  });
  const [toast, setToast] = useState<string | null>(null);
  const [dirPickerOpen, setDirPickerOpen] = useState(false);
  const [githubDialogOpen, setGithubDialogOpen] = useState(false);

  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: () => api.get<AppSetting[]>("/settings"),
  });

  const { data: githubStatus, refetch: refetchGithub } = useQuery({
    queryKey: ["github-status"],
    queryFn: () => api.get<GitHubStatus>("/settings/github-status"),
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
      <section className="bg-white rounded-lg border border-border p-6 space-y-4">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          General
        </h3>

        <div>
          <label className="block text-sm font-medium mb-1">
            Department Name
          </label>
          <input
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
          <button
            onClick={handleSave}
            disabled={saveMutation.isPending}
            className="bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium hover:opacity-90 disabled:opacity-50"
          >
            {saveMutation.isPending ? "Saving..." : "Save"}
          </button>
          {toast && (
            <span className="text-sm text-emerald-600 font-medium">
              {toast}
            </span>
          )}
        </div>
      </section>

      {/* Export Directory */}
      <section className="bg-white rounded-lg border border-border p-6 space-y-4">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Local Export
        </h3>

        <div>
          <label className="block text-sm font-medium mb-1">
            Export Directory
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              className="flex-1 border border-border rounded-md px-3 py-2 text-sm font-mono"
              placeholder="~/Documents/schedules"
              value={form.export_directory}
              onChange={(e) =>
                setForm({ ...form, export_directory: e.target.value })
              }
            />
            <button
              onClick={() => setDirPickerOpen(true)}
              className="px-3 py-2 text-sm rounded-md border border-border hover:bg-accent whitespace-nowrap"
            >
              Browse...
            </button>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Directory where "Save to Local Directory" writes HTML files.
          </p>
        </div>

        <button
          onClick={handleSave}
          disabled={saveMutation.isPending}
          className="bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium hover:opacity-90 disabled:opacity-50"
        >
          {saveMutation.isPending ? "Saving..." : "Save"}
        </button>
      </section>

      {/* GitHub Pages */}
      <section className="bg-white rounded-lg border border-border p-6 space-y-4">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          GitHub Pages
        </h3>

        {githubStatus?.configured ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" />
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
            <button
              onClick={() => setGithubDialogOpen(true)}
              className="px-4 py-2 text-sm rounded-md border border-border hover:bg-accent"
            >
              Reconfigure
            </button>
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
            <button
              onClick={() => setGithubDialogOpen(true)}
              className="bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium hover:opacity-90"
            >
              Set Up GitHub
            </button>
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
