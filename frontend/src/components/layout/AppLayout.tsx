import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { useTerm } from "../../hooks/useTerm";
import { useAuth } from "../../hooks/useAuth";
import { cn } from "../../lib/utils";

const navItems = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/schedule", label: "Schedule" },
  { to: "/instructors", label: "Instructors" },
  { to: "/rooms", label: "Rooms" },
  { to: "/courses", label: "Courses" },
  { to: "/terms", label: "Terms" },
  { to: "/analytics", label: "Analytics" },
  { to: "/import", label: "Import" },
  { to: "/settings", label: "Settings" },
];

export function AppLayout() {
  const { terms, selectedTerm, selectTerm } = useTerm();
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="bg-white border-b border-border sticky top-0 z-50">
        <div className="max-w-[1440px] mx-auto px-4 flex items-center h-14 gap-4">
          <h1 className="font-bold text-lg whitespace-nowrap text-primary">UWRF Scheduler</h1>

          <select
            className="border border-border rounded-md px-2 py-1 text-sm bg-white"
            value={selectedTerm?.id ?? ""}
            onChange={(e) => selectTerm(Number(e.target.value))}
          >
            {terms.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} {t.status === "final" ? "(Final)" : ""}
              </option>
            ))}
          </select>

          <nav className="flex gap-1 ml-4">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    "px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-accent"
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-3">
            {user && (
              <>
                <span className="text-sm text-muted-foreground">
                  {user.name}{" "}
                  <span className="inline-block px-1.5 py-0.5 text-xs rounded-full bg-accent font-medium">
                    {user.role}
                  </span>
                </span>
                <button
                  onClick={() => {
                    logout();
                    navigate("/login");
                  }}
                  className="text-sm text-muted-foreground hover:text-foreground"
                >
                  Logout
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-[1440px] mx-auto p-4">
        <Outlet context={{ selectedTerm }} />
      </main>
    </div>
  );
}
