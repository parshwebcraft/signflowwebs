import React from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { LayoutDashboard, FileText, Upload, LogOut, FileSignature } from "lucide-react";
import { Button } from "@/components/ui/button";

const navItems = [
  { to: "/app", label: "Dashboard", icon: LayoutDashboard, end: true, testid: "nav-dashboard" },
  { to: "/app/documents", label: "Documents", icon: FileText, testid: "nav-documents" },
  { to: "/app/upload", label: "Upload", icon: Upload, testid: "nav-upload" },
];

export default function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-white text-zinc-950 flex" style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* Sidebar */}
      <aside className="hidden md:flex w-64 shrink-0 flex-col bg-[#F7F7F8] border-r border-zinc-200 sticky top-0 h-screen">
        <div className="px-6 py-8">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-md bg-zinc-950 flex items-center justify-center">
              <FileSignature className="h-4 w-4 text-white" />
            </div>
            <span className="text-lg font-semibold tracking-tight" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              Inksign
            </span>
          </div>
        </div>
        <nav className="px-3 flex-1 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              data-testid={item.testid}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                  isActive
                    ? "bg-white text-zinc-950 border border-zinc-200"
                    : "text-zinc-600 hover:bg-white hover:text-zinc-950"
                }`
              }
            >
              <item.icon className="h-4 w-4" />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="p-4 border-t border-zinc-200">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="text-sm font-medium truncate" data-testid="user-name">{user?.name}</div>
              <div className="text-xs text-zinc-500 truncate" data-testid="user-email">{user?.email}</div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleLogout}
              data-testid="logout-button"
              className="h-8 w-8 text-zinc-500 hover:text-zinc-950"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-10 bg-white border-b border-zinc-200 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-md bg-zinc-950 flex items-center justify-center">
            <FileSignature className="h-3.5 w-3.5 text-white" />
          </div>
          <span className="text-base font-semibold" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Inksign</span>
        </div>
        <Button variant="ghost" size="sm" onClick={handleLogout} data-testid="mobile-logout-button">
          <LogOut className="h-4 w-4" />
        </Button>
      </div>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-10 bg-white border-t border-zinc-200 flex">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            data-testid={`mobile-${item.testid}`}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center justify-center py-3 text-xs ${
                isActive ? "text-zinc-950" : "text-zinc-500"
              }`
            }
          >
            <item.icon className="h-5 w-5 mb-1" />
            {item.label}
          </NavLink>
        ))}
      </nav>

      <main className="flex-1 min-w-0 pt-16 md:pt-0 pb-20 md:pb-0">
        <div className="p-6 md:p-12 max-w-6xl">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
