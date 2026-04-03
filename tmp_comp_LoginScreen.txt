import { LogOut, Package, User } from "lucide-react";
import type React from "react";
import { useState } from "react";
import type { AppUser } from "../types";

function SidebarButton({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ElementType;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-3 w-full p-3 rounded-xl transition-all text-left ${active ? "bg-blue-600 text-white font-bold shadow-lg shadow-blue-200" : "text-gray-500 hover:bg-gray-100"}`}
    >
      <Icon className="w-5 h-5" />
      <span className="text-sm tracking-tight">{label}</span>
    </button>
  );
}

function NavButton({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ElementType;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-center justify-center min-w-[64px] py-1 px-2 ${active ? "text-blue-600 scale-110 transition-transform" : "text-gray-400"}`}
    >
      <Icon className="w-5 h-5 mb-0.5" />
      <span className="text-[9px] font-black uppercase tracking-tighter">
        {label}
      </span>
    </button>
  );
}

/* ================= LOGIN SCREEN ================= */
function LoginScreen({
  users,
  onLogin,
  showNotification,
  loginViaBackend,
}: {
  users: AppUser[];
  onLogin: (u: AppUser) => void;
  showNotification: (m: string, t?: string) => void;
  loginViaBackend?: (
    username: string,
    password: string,
  ) => Promise<AppUser | null>;
}) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    try {
      if (loginViaBackend) {
        const user = await loginViaBackend(username, password);
        if (user) {
          localStorage.setItem("stockflow_user", JSON.stringify(user));
          onLogin(user);
          showNotification(`Welcome back, ${user.username}!`, "success");
        } else {
          showNotification("Invalid credentials", "error");
        }
      } else {
        const user = users.find(
          (u) =>
            u.username.toLowerCase() === username.toLowerCase() &&
            u.password === password,
        );
        if (user) {
          localStorage.setItem("stockflow_user", JSON.stringify(user));
          onLogin(user);
          showNotification(`Welcome back, ${user.username}!`, "success");
        } else {
          showNotification("Invalid credentials", "error");
        }
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-3xl shadow-2xl w-full max-w-md border border-gray-100">
        <div className="flex justify-center mb-6">
          <div className="bg-blue-600 p-4 rounded-2xl shadow-lg shadow-blue-200 text-white">
            <Package size={40} />
          </div>
        </div>
        <h1 className="text-3xl font-black text-center text-gray-900 mb-2 tracking-tighter">
          StockManager
        </h1>
        <p className="text-center text-gray-500 mb-8 text-xs font-bold uppercase tracking-widest">
          Inventory System
        </p>
        <form onSubmit={handleLogin} className="space-y-4">
          <div className="relative">
            <User
              className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
              size={18}
            />
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              className="w-full pl-12 pr-4 py-4 bg-gray-50 border border-gray-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-bold"
              placeholder="Username"
            />
          </div>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full px-4 py-4 bg-gray-50 border border-gray-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-bold text-center"
            placeholder="••••••••"
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-4 rounded-2xl shadow-lg transition-transform active:scale-95 uppercase tracking-widest text-xs mt-2 disabled:opacity-60"
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}

export { SidebarButton, NavButton, LoginScreen };
