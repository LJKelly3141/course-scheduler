import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import type { AppSetting } from "../api/types";

export function SettingsPage() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<Record<string, string>>({
    department_name: "",
    export_directory: "",
    github_repo_url: "",
    github_token: "",
  });
  const [toast, setToast] = useState<string | null>(null);

  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: () => api.get<AppSetting[]>("/settings"),
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
    mutationFn: (items: AppSetting[]) => api.put<AppSetting[]>("/settings", items),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      setToast("Settings saved successfully.");
      setTimeout(() => setToast(null), 3000);
    },
  });

  function handleSave() {
    const items: AppSetting[] = Object.entries(form).map(([key, value]) => ({ key, value }));
    saveMutation.mutate(items);
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold">Settings</h2>

      <div className="bg-white rounded-lg border border-border p-6 max-w-xl space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Department Name</label>
          <input
            type="text"
            className="w-full border border-border rounded-md px-3 py-2 text-sm"
            placeholder="e.g. Computer Science"
            value={form.department_name}
            onChange={(e) => setForm({ ...form, department_name: e.target.value })}
          />
          <p className="text-xs text-muted-foreground mt-1">Shown in the exported HTML header.</p>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Local Export Directory</label>
          <input
            type="text"
            className="w-full border border-border rounded-md px-3 py-2 text-sm"
            placeholder="e.g. ~/Documents/schedules"
            value={form.export_directory}
            onChange={(e) => setForm({ ...form, export_directory: e.target.value })}
          />
          <p className="text-xs text-muted-foreground mt-1">Directory where HTML exports are saved locally.</p>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">GitHub Repo URL</label>
          <input
            type="text"
            className="w-full border border-border rounded-md px-3 py-2 text-sm"
            placeholder="e.g. https://github.com/user/schedules"
            value={form.github_repo_url}
            onChange={(e) => setForm({ ...form, github_repo_url: e.target.value })}
          />
          <p className="text-xs text-muted-foreground mt-1">GitHub repo for publishing schedules via Pages.</p>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">GitHub Token</label>
          <input
            type="password"
            className="w-full border border-border rounded-md px-3 py-2 text-sm"
            placeholder="ghp_..."
            value={form.github_token}
            onChange={(e) => setForm({ ...form, github_token: e.target.value })}
          />
          <p className="text-xs text-muted-foreground mt-1">Personal access token with repo scope.</p>
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={handleSave}
            disabled={saveMutation.isPending}
            className="bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium hover:opacity-90 disabled:opacity-50"
          >
            {saveMutation.isPending ? "Saving..." : "Save Settings"}
          </button>
          {toast && (
            <span className="text-sm text-emerald-600 font-medium">{toast}</span>
          )}
        </div>
      </div>
    </div>
  );
}
