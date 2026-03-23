import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { CalendarDays, ChevronLeft, ChevronRight, Building2, Home, Plane, Thermometer, Clock, HelpCircle } from "lucide-react";
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval,
  startOfWeek, endOfWeek, isSameMonth, isToday, parseISO,
  isWithinInterval, isSameDay, addWeeks, subWeeks, startOfISOWeek, endOfISOWeek,
  addMonths, subMonths, isWeekend,
} from "date-fns";
import { useAuth } from "@/contexts/AuthContext";

interface LeaveEntry {
  id: number; userId: number; startDate: string; endDate: string;
  status: string; leaveType: string; days: number; halfDay?: boolean;
  employee?: { firstName: string; lastName: string; email: string; country: string };
}
interface UserInfo {
  id: number; firstName: string; lastName: string; email: string; isActive: boolean;
}

const MEMBER_COLORS = [
  "bg-blue-100 text-blue-800", "bg-emerald-100 text-emerald-800",
  "bg-violet-100 text-violet-800", "bg-amber-100 text-amber-800",
  "bg-rose-100 text-rose-800", "bg-cyan-100 text-cyan-800",
  "bg-fuchsia-100 text-fuchsia-800", "bg-lime-100 text-lime-800",
  "bg-orange-100 text-orange-800", "bg-teal-100 text-teal-800",
];
const MEMBER_DOTS = [
  "bg-blue-500", "bg-emerald-500", "bg-violet-500", "bg-amber-500",
  "bg-rose-500", "bg-cyan-500", "bg-fuchsia-500", "bg-lime-500",
  "bg-orange-500", "bg-teal-500",
];

// Status icon + label for weekly view
function StatusIcon({ type, pending, halfDay }: { type: string; pending?: boolean; halfDay?: boolean }) {
  const opacity = pending ? "opacity-50" : "";
  const half = halfDay ? " ½" : "";

  if (type === "annual") return (
    <div className={`flex flex-col items-center gap-0.5 ${opacity}`} title={`Annual leave${pending ? " (pending)" : ""}${half}`}>
      <Plane size={16} className="text-primary" />
      <span className="text-[9px] text-primary font-medium leading-none">Holiday{half}</span>
    </div>
  );
  if (type === "sick") return (
    <div className={`flex flex-col items-center gap-0.5 ${opacity}`} title={`Sick leave${pending ? " (pending)" : ""}${half}`}>
      <Thermometer size={16} className="text-orange-500" />
      <span className="text-[9px] text-orange-500 font-medium leading-none">Sick{half}</span>
    </div>
  );
  if (type === "home_office") return (
    <div className={`flex flex-col items-center gap-0.5 ${opacity}`} title={`Home office${pending ? " (pending)" : ""}${half}`}>
      <Home size={16} className="text-blue-500" />
      <span className="text-[9px] text-blue-500 font-medium leading-none">WFH{half}</span>
    </div>
  );
  if (type === "unpaid") return (
    <div className={`flex flex-col items-center gap-0.5 ${opacity}`} title={`Unpaid leave${pending ? " (pending)" : ""}`}>
      <Clock size={16} className="text-gray-400" />
      <span className="text-[9px] text-gray-400 font-medium leading-none">Unpaid</span>
    </div>
  );
  return (
    <div className={`flex flex-col items-center gap-0.5 ${opacity}`} title={`${type} leave`}>
      <HelpCircle size={16} className="text-gray-400" />
      <span className="text-[9px] text-gray-400 font-medium leading-none">Leave</span>
    </div>
  );
}

export default function TeamCalendarPage() {
  const { user } = useAuth();
  const [view, setView] = useState<"month" | "week">("month");
  const [currentDate, setCurrentDate] = useState(new Date());

  const { data: calendarData = [] } = useQuery<LeaveEntry[]>({
    queryKey: ["/api/calendar"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/calendar");
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: allUsers = [] } = useQuery<UserInfo[]>({
    queryKey: ["/api/users/all"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/users/all");
      if (!res.ok) return [];
      return res.json();
    },
  });

  const entries = calendarData.filter((e) => e.status === "approved" || e.status === "pending");
  const activeUsers = allUsers.filter((u) => u.isActive).sort((a, b) =>
    `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`)
  );
  const colorMap = new Map<number, number>();
  activeUsers.forEach((u, i) => colorMap.set(u.id, i % MEMBER_COLORS.length));

  function getEntriesForUserDay(userId: number, day: Date): LeaveEntry[] {
    return entries.filter((e) => {
      if (e.userId !== userId) return false;
      try {
        const start = parseISO(e.startDate);
        const end = parseISO(e.endDate);
        return isWithinInterval(day, { start, end }) || isSameDay(day, start) || isSameDay(day, end);
      } catch { return false; }
    });
  }

  function getEntriesForDay(day: Date): LeaveEntry[] {
    return entries.filter((e) => {
      try {
        const start = parseISO(e.startDate);
        const end = parseISO(e.endDate);
        return isWithinInterval(day, { start, end }) || isSameDay(day, start) || isSameDay(day, end);
      } catch { return false; }
    });
  }

  // ── MONTH VIEW ────────────────────────────────────────────────────────────
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const monthDays = eachDayOfInterval({ start: gridStart, end: gridEnd });

  const usersWithLeaveThisMonth = new Set<number>();
  monthDays.forEach((day) => {
    if (isSameMonth(day, currentDate)) getEntriesForDay(day).forEach((e) => usersWithLeaveThisMonth.add(e.userId));
  });

  // ── WEEK VIEW ─────────────────────────────────────────────────────────────
  const weekStart = startOfISOWeek(currentDate); // Monday
  const weekEnd = endOfISOWeek(currentDate);      // Sunday
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd })
    .filter((d) => !isWeekend(d)); // Mon–Fri only

  // Navigation
  const prev = () => view === "month"
    ? setCurrentDate(subMonths(currentDate, 1))
    : setCurrentDate(subWeeks(currentDate, 1));
  const next = () => view === "month"
    ? setCurrentDate(addMonths(currentDate, 1))
    : setCurrentDate(addWeeks(currentDate, 1));
  const goToday = () => setCurrentDate(new Date());

  const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <CalendarDays size={22} className="text-primary" />
            Team Calendar
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            See who's off across the team — approved and pending leave
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* View toggle */}
          <div className="flex rounded-lg border border-border overflow-hidden text-sm">
            <button
              onClick={() => setView("month")}
              className={`px-3 py-1.5 font-medium transition-colors ${view === "month" ? "bg-primary text-white" : "text-muted-foreground hover:bg-muted"}`}
            >Month</button>
            <button
              onClick={() => setView("week")}
              className={`px-3 py-1.5 font-medium transition-colors ${view === "week" ? "bg-primary text-white" : "text-muted-foreground hover:bg-muted"}`}
            >Week</button>
          </div>
          <Button variant="outline" size="sm" onClick={goToday}>Today</Button>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={prev} className="h-8 w-8"><ChevronLeft size={16} /></Button>
            <span className="text-sm font-semibold min-w-[160px] text-center">
              {view === "month"
                ? format(currentDate, "MMMM yyyy")
                : `${format(weekStart, "d MMM")} – ${format(weekEnd, "d MMM yyyy")}`}
            </span>
            <Button variant="ghost" size="icon" onClick={next} className="h-8 w-8"><ChevronRight size={16} /></Button>
          </div>
        </div>
      </div>

      {/* ── MONTH VIEW ── */}
      {view === "month" && (
        <>
          {usersWithLeaveThisMonth.size > 0 && (
            <div className="flex flex-wrap gap-2">
              {activeUsers.filter((u) => usersWithLeaveThisMonth.has(u.id)).map((u) => {
                const ci = colorMap.get(u.id) ?? 0;
                return (
                  <div key={u.id} className="flex items-center gap-1.5 text-xs">
                    <span className={`inline-block w-2.5 h-2.5 rounded-full ${MEMBER_DOTS[ci]} flex-shrink-0`} />
                    <span className="text-muted-foreground">{u.firstName} {u.lastName}</span>
                  </div>
                );
              })}
            </div>
          )}
          <div className="rounded-xl border border-border overflow-hidden bg-card">
            <div className="grid grid-cols-7 bg-muted/50 border-b border-border">
              {dayNames.map((d) => (
                <div key={d} className="py-2 text-center text-xs font-semibold text-muted-foreground tracking-wide">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 divide-x divide-y divide-border">
              {monthDays.map((day) => {
                const inMonth = isSameMonth(day, currentDate);
                const todayFlag = isToday(day);
                const dayEntries = getEntriesForDay(day);
                const weekend = day.getDay() === 0 || day.getDay() === 6;
                return (
                  <div key={day.toISOString()} className={`min-h-[90px] p-1.5 flex flex-col gap-0.5 ${!inMonth ? "bg-muted/20" : weekend ? "bg-muted/10" : ""}`}>
                    <div className="flex justify-end mb-0.5">
                      <span className={`text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full ${todayFlag ? "bg-primary text-white font-bold" : inMonth ? "text-foreground" : "text-muted-foreground/40"}`}>
                        {format(day, "d")}
                      </span>
                    </div>
                    <div className="space-y-0.5 flex-1">
                      {dayEntries.slice(0, 3).map((entry) => {
                        const ci = colorMap.get(entry.userId) ?? 0;
                        const name = entry.employee
                          ? `${entry.employee.firstName} ${entry.employee.lastName.charAt(0)}.`
                          : `User ${entry.userId}`;
                        const isPending = entry.status === "pending";
                        return (
                          <div
                            key={`${entry.id}-${day.toISOString()}`}
                            className={`${MEMBER_COLORS[ci]} rounded px-1 py-0.5 text-[10px] leading-tight truncate cursor-default ${isPending ? "opacity-60 italic" : ""}`}
                            title={`${name} — ${entry.leaveType}${entry.halfDay ? " (½ day)" : ""}${isPending ? " (pending)" : ""}\n${entry.startDate} → ${entry.endDate}`}
                          >
                            {name}{isPending && " ·"}
                          </div>
                        );
                      })}
                      {dayEntries.length > 3 && (
                        <div className="text-[10px] text-muted-foreground pl-1">+{dayEntries.length - 3} more</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded bg-blue-100 border border-blue-200" />Approved leave</div>
            <div className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded bg-blue-100 border border-blue-200 opacity-60" />Pending (italic)</div>
          </div>
        </>
      )}

      {/* ── WEEK VIEW ── */}
      {view === "week" && (
        <div className="rounded-xl border border-border overflow-hidden bg-card">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse">
              <thead>
                <tr className="bg-muted/50 border-b border-border">
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground w-40 min-w-[140px]">
                    Team Member
                  </th>
                  {weekDays.map((day) => {
                    const todayFlag = isToday(day);
                    return (
                      <th key={day.toISOString()} className={`px-2 py-2.5 text-center min-w-[100px] ${todayFlag ? "bg-primary/5" : ""}`}>
                        <div className="text-xs font-semibold text-muted-foreground">{format(day, "EEE")}</div>
                        <div className={`text-sm font-bold mt-0.5 ${todayFlag ? "text-primary" : "text-foreground"}`}>
                          {format(day, "d MMM")}
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {activeUsers.map((u, idx) => {
                  const initials = `${u.firstName[0]}${u.lastName[0]}`.toUpperCase();
                  const ci = colorMap.get(u.id) ?? 0;
                  return (
                    <tr key={u.id} className={idx % 2 === 0 ? "bg-card" : "bg-muted/20"}>
                      {/* Employee name */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${MEMBER_COLORS[ci]}`}>
                            {initials}
                          </div>
                          <span className="text-sm font-medium text-foreground truncate">
                            {u.firstName} {u.lastName}
                          </span>
                        </div>
                      </td>
                      {/* Day cells */}
                      {weekDays.map((day) => {
                        const todayFlag = isToday(day);
                        const dayEntries = getEntriesForUserDay(u.id, day);
                        const approvedEntry = dayEntries.find((e) => e.status === "approved");
                        const pendingEntry = dayEntries.find((e) => e.status === "pending");
                        const entry = approvedEntry || pendingEntry;

                        return (
                          <td key={day.toISOString()} className={`px-2 py-3 text-center align-middle ${todayFlag ? "bg-primary/5" : ""}`}>
                            {entry ? (
                              <StatusIcon
                                type={entry.leaveType}
                                pending={entry.status === "pending"}
                                halfDay={entry.halfDay}
                              />
                            ) : (
                              <div className="flex flex-col items-center gap-0.5">
                                <Building2 size={16} className="text-muted-foreground/40" />
                                <span className="text-[9px] text-muted-foreground/40 font-medium leading-none">Office</span>
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Week view legend */}
          <div className="flex items-center gap-5 px-4 py-3 border-t border-border bg-muted/30 flex-wrap">
            {[
              { icon: <Building2 size={13} className="text-muted-foreground/50" />, label: "In office" },
              { icon: <Plane size={13} className="text-primary" />, label: "Holiday" },
              { icon: <Home size={13} className="text-blue-500" />, label: "WFH" },
              { icon: <Thermometer size={13} className="text-orange-500" />, label: "Sick" },
              { icon: <Clock size={13} className="text-gray-400" />, label: "Unpaid" },
            ].map(({ icon, label }) => (
              <div key={label} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                {icon} {label}
              </div>
            ))}
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground opacity-50">
              <Plane size={13} /> <span className="italic">Pending (faded)</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
