import { ReactNode, useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import {
  LayoutDashboard, CalendarDays, Clock, CheckSquare,
  Users, Settings, LogOut, Menu, X, ChevronDown,
  UserCog, CalendarRange, ShieldCheck,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";


interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  roles?: string[];
  badge?: number;
}

function NavLink({ href, label, icon, badge }: NavItem) {
  const [location] = useLocation();
  const isActive = location === href;
  return (
    <Link href={href}>
      <div
        data-testid={`nav-${href.replace("/", "") || "home"}`}
        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium cursor-pointer transition-all duration-150 ${
          isActive
            ? "bg-sidebar-accent text-white"
            : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
        }`}
      >
        <span className="flex-shrink-0">{icon}</span>
        <span className="flex-1">{label}</span>
        {badge && badge > 0 ? (
          <Badge variant="destructive" className="text-xs h-5 min-w-[1.25rem] flex items-center justify-center px-1.5">
            {badge}
          </Badge>
        ) : null}
      </div>
    </Link>
  );
}

export default function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const { data: pendingData } = useQuery<any[]>({
    queryKey: ["/api/leave-requests/pending"],
    enabled: user?.role === "admin" || user?.role === "manager",
  });
  const pendingCount = pendingData?.length || 0;

  const navItems: NavItem[] = [
    { href: "/", label: "Dashboard", icon: <LayoutDashboard size={18} /> },
    { href: "/request", label: "Request Leave", icon: <CalendarDays size={18} /> },
    { href: "/my-requests", label: "My Requests", icon: <Clock size={18} /> },
    ...(user?.role !== "employee"
      ? [{ href: "/approvals", label: "Approvals", icon: <CheckSquare size={18} />, badge: pendingCount, roles: ["admin", "manager"] }]
      : []),
    ...(user?.role !== "employee"
      ? [{ href: "/team", label: "Team Overview", icon: <Users size={18} />, roles: ["admin", "manager"] }]
      : []),
    { href: "/calendar", label: "Team Calendar", icon: <CalendarRange size={18} /> },
    ...(user?.role === "admin"
      ? [{ href: "/people", label: "People", icon: <UserCog size={18} />, roles: ["admin"] }]
      : []),
    ...(user?.role === "admin"
      ? [{ href: "/audit", label: "Audit Log", icon: <ShieldCheck size={18} />, roles: ["admin"] }]
      : []),
    { href: "/settings", label: "Settings", icon: <Settings size={18} /> },
  ];

  const initials = user ? `${user.firstName[0]}${user.lastName[0]}`.toUpperCase() : "?";
  const fullName = user ? `${user.firstName} ${user.lastName}` : "";

  const Sidebar = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-4 py-5 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          {/* Lucent concentric-arc mark — traced from brand logo */}
          <svg viewBox="0 0 36 36" fill="none" className="w-9 h-9 flex-shrink-0" aria-hidden="true">
            <path d="M18 4 A14 14 0 1 1 4 18" stroke="#3a9ec2" strokeWidth="1.4" fill="none" strokeLinecap="round"/>
            <path d="M18 7 A11 11 0 1 1 7 18" stroke="#3a9ec2" strokeWidth="1.6" fill="none" strokeLinecap="round"/>
            <path d="M18 10 A8 8 0 1 1 10 18" stroke="#3a9ec2" strokeWidth="1.8" fill="none" strokeLinecap="round"/>
            <path d="M18 13 A5 5 0 1 1 13 18" stroke="#3a9ec2" strokeWidth="2" fill="none" strokeLinecap="round"/>
            <path d="M18 16 A2 2 0 1 1 16 18" stroke="#3a9ec2" strokeWidth="2" fill="none" strokeLinecap="round"/>
          </svg>
          <div>
            <div className="font-bold text-white text-sm leading-tight tracking-[0.12em] uppercase" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
              Lucent
            </div>
            <div className="text-[#3a9ec2] text-[10px] tracking-[0.22em] uppercase font-medium" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>Renewables</div>
          </div>
        </div>
        <div className="text-sidebar-foreground/40 text-[10px] tracking-[0.18em] uppercase mt-2 pl-0.5">HR Platform</div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => (
          <NavLink key={item.href} {...item} />
        ))}
      </nav>

      {/* User */}
      <div className="px-3 py-4 border-t border-sidebar-border">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              data-testid="user-menu-trigger"
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-sidebar-accent/60 transition-all text-left"
            >
              <Avatar className="h-8 w-8 flex-shrink-0">
                <AvatarFallback className="bg-primary text-white text-xs font-semibold">{initials}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="text-sidebar-foreground text-sm font-medium truncate">{fullName}</div>
                <div className="text-sidebar-foreground/50 text-xs capitalize">{user?.role}</div>
              </div>
              <ChevronDown size={14} className="text-sidebar-foreground/50 flex-shrink-0" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem asChild>
              <Link href="/settings">
                <Settings size={14} className="mr-2" />
                Settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={logout} className="text-destructive focus:text-destructive">
              <LogOut size={14} className="mr-2" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex bg-background">
      {/* Desktop Sidebar */}
      <aside
        className="hidden lg:flex flex-col w-64 flex-shrink-0 fixed inset-y-0 left-0 z-40"
        style={{ backgroundColor: "hsl(var(--sidebar-background))" }}
      >
        <Sidebar />
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 flex-col lg:hidden transition-transform duration-200 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        } flex`}
        style={{ backgroundColor: "hsl(var(--sidebar-background))" }}
      >
        <div className="absolute top-4 right-4">
          <Button variant="ghost" size="icon" onClick={() => setMobileOpen(false)} className="text-sidebar-foreground">
            <X size={20} />
          </Button>
        </div>
        <Sidebar />
      </aside>

      {/* Main */}
      <main className="flex-1 lg:ml-64 min-h-screen flex flex-col">
        {/* Mobile topbar */}
        <header className="lg:hidden sticky top-0 z-30 bg-background border-b border-border px-4 py-3 flex items-center justify-between">
          <Button variant="ghost" size="icon" onClick={() => setMobileOpen(true)}>
            <Menu size={20} />
          </Button>
          <div className="font-semibold text-foreground text-sm tracking-wider" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
            LUCENT RENEWABLES
          </div>
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-primary text-white text-xs font-semibold">{initials}</AvatarFallback>
          </Avatar>
        </header>

        <div className="flex-1 p-4 lg:p-8 max-w-7xl w-full mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
