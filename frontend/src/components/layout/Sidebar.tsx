import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Package, ArrowDownToLine, ArrowUpFromLine,
  BookOpen, Bell, BarChart3, Users, Settings, LogOut, ShieldCheck
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/authStore";
import { useAlertStore } from "@/stores/alertStore";

type NavItem = {
  href: string;
  icon: React.ElementType;
  label: string;
  badge?: boolean;
  roles?: string[];
};

const NAV_SECTIONS: Array<{ label: string; items: NavItem[] }> = [
  {
    label: "GENERAL",
    items: [
      { href: "/", icon: LayoutDashboard, label: "Dashboard", roles: ["ADMIN"] },
      { href: "/inventario", icon: Package, label: "Inventario" },
      { href: "/ingreso", icon: ArrowDownToLine, label: "Ingreso", roles: ["ADMIN", "OPERATOR"] },
      { href: "/despacho", icon: ArrowUpFromLine, label: "Despacho", roles: ["ADMIN", "OPERATOR"] },
      { href: "/kardex", icon: BookOpen, label: "Kardex" },
    ],
  },
  {
    label: "SUPPORT",
    items: [
      { href: "/alertas", icon: Bell, label: "Alertas", badge: true, roles: ["ADMIN"] },
      { href: "/reportes", icon: BarChart3, label: "Reportes", roles: ["ADMIN"] },
      { href: "/usuarios", icon: Users, label: "Usuarios", roles: ["ADMIN"] },
      { href: "/configuracion", icon: Settings, label: "Configuración", roles: ["ADMIN"] },
    ],
  },
];

export function Sidebar() {
  const { pathname } = useLocation();
  const { user, logout } = useAuthStore();
  const { unreadCount } = useAlertStore();

  return (
    <aside className="flex flex-col w-60 min-h-screen bg-[hsl(var(--panel))] border-r border-[hsl(var(--border))] py-5 px-3">
      {/* Logo */}
      <div className="px-3 mb-7 flex items-center gap-2">
        <div className="grid h-8 w-8 place-items-center rounded-[0.65rem] bg-[hsl(var(--primary))] text-white">
          <ShieldCheck size={17} />
        </div>
        <span className="text-lg font-semibold tracking-[-0.01em] text-[hsl(var(--primary))]">StockListo</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-6">
        {NAV_SECTIONS.map((section) => (
          <div key={section.label}>
            <p className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
              {section.label}
            </p>
            <ul className="space-y-1">
              {section.items.map((item) => {
                if (item.roles && (!user || !item.roles.includes(user.rol))) return null;
                const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
                return (
                  <li key={item.href}>
                    <Link
                      to={item.href}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2.5 rounded-(--radius-btn) text-sm transition-all relative",
                        active
                          ? "font-semibold text-[hsl(var(--primary))] bg-white shadow-[0_6px_18px_rgba(15,23,42,0.07)] border border-[hsl(var(--border))]"
                          : "text-gray-600 hover:bg-white/70 hover:text-gray-900",
                      )}
                    >
                      <item.icon size={16} />
                      <span>{item.label}</span>
                      {item.badge && unreadCount > 0 && (
                        <span className="ml-auto text-[10px] font-bold bg-[hsl(var(--error))] text-white rounded-full px-1.5 py-0.5 leading-none">
                          {unreadCount}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* User + Logout */}
      {user && (
        <div className="border-t border-[hsl(var(--border))] pt-4 px-2">
          <div className="rounded-(--radius-card) bg-white border border-[hsl(var(--border))] p-3 shadow-[0_8px_24px_rgba(15,23,42,0.05)]">
          <p className="text-xs font-semibold text-gray-800 truncate">{user.nombre}</p>
          <p className="text-[11px] text-gray-400 truncate">{user.email}</p>
          <button
            onClick={logout}
            className="mt-3 flex items-center gap-2 text-xs text-gray-500 hover:text-red-600 transition-colors"
          >
            <LogOut size={13} />
            Cerrar sesión
          </button>
          </div>
        </div>
      )}
    </aside>
  );
}
