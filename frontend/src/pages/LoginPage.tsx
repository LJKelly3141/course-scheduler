import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

export function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      await login(email, password);
      navigate("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30">
      <form onSubmit={handleSubmit} className="bg-white p-8 rounded-lg shadow-md w-full max-w-sm space-y-4">
        <h1 className="text-2xl font-bold text-center text-primary">UWRF Scheduler</h1>
        <p className="text-sm text-muted-foreground text-center">Sign in to manage schedules</p>
        {error && <p className="text-destructive text-sm text-center">{error}</p>}
        <div>
          <label className="block text-sm font-medium mb-1">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full border border-border rounded-md px-3 py-2 text-sm"
            placeholder="admin@uwrf.edu"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full border border-border rounded-md px-3 py-2 text-sm"
          />
        </div>
        <button
          type="submit"
          className="w-full bg-primary text-primary-foreground rounded-md py-2 text-sm font-medium hover:opacity-90"
        >
          Sign In
        </button>
      </form>
    </div>
  );
}
