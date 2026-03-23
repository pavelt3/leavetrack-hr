import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CalendarDays, ChevronLeft, ChevronRight, Building2, Home, Plane, Thermometer, Clock, HelpCircle } from "lucide-react";
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval,
  startOfWeek, endOfWeek, isSameMonth, isToday, parseISO,
  isWithinInterval, isSameDay, addWeeks, subWeeks, startOfISOWeek, endOfISOWeek,
  addMonths, subMonths, isWeekend,
} from "date-fns";

interface LeaveEntry {
  id: number; userId: number; startDate: string; endDate: string;
  status: string; leaveType: string; days: number; halfDay?: boolean;
  employee?: { firstName: string; lastName: string; email?: string; country?: string };
}
interface UserInfo {
  id: number; firstName: string; lastName: string; country: string;
}
interface Holiday {
  id: number; date: string; name: string; country: string; year: number;
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

// Holiday colors: CZ = teal, PL = red
const HOLIDAY_STYLE: Record<string, { bg: string; text: string; dot: string; flag: string }> = {
  CZ: { bg: "bg-teal-50 border-teal-200", text: "text-teal-700", dot: "bg-teal-500", flag: "🇨🇿" },
  PL: { bg: "bg-red-50 border-red-200",   text: "text-red-700",  dot: "bg-red-500",  flag: "🇵🇱" },
};

const LEAVE_TYPE_LABELS: Record<string, string> = {
  annual: "Annual Leave", sick: "Sick Leave", home_office: "Home Office",
  unpaid: "Unpaid Leave", other: "Other Leave",
};

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
  const [view, setView] = useState<"month" | "week">("month");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [detailEntry, setDetailEntry] = useState<(LeaveEntry & { userName?: string }) | null>(null);

  const viewYear = currentDate.getFullYear();

  // All authenticated users can see this — uses /api/users/basic
  const { data: allUsers = [] } = useQuery<UserInfo[]>({
    queryKey: ["/api/users/basic"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/users/basic");
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: calendarData = [] } = useQuery<LeaveEntry[]>({
    queryKey: ["/api/calendar"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/calendar");
      if (!res.ok) return [];
      return res.json();
    },
  });

  // Fetch CZ and PL holidays for the viewed year
  const { data: czHolidays = [] } = useQuery<Holiday[]>({
    queryKey: [`/api/holidays?year=${viewYear}&country=CZ`],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/holidays?year=${viewYear}&country=CZ`);
      if (!res.ok) return [];
      return res.json();
    },
  });
  const { data: plHolidays = [] } = useQuery<Holiday[]>({
    queryKey: [`/api/holidays?year=${viewYear}&country=PL`],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/holidays?year=${viewYear}&country=PL`);
      if (!res.ok) return [];
      return res.json();
    },
  });

  // Build holiday lookup: date -> [{country, name}]
  const holidayMap = new Map<string, { country: string; name: string }[]>();
  [...czHolidays, ...plHolidays].forEach((h) => {
    const existing = holidayMap.get(h.date) || [];
    existing.push({ country: h.country, name: h.name });
    holidayMap.set(h.date, existing);
  });

  const entries = calendarData.filter((e) => e.status === "approved" || e.status === "pending");
  const activeUsers = [...allUsers].sort((a, b) =>
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

  function openDetail(entry: LeaveEntry) {
    const u = activeUsers.find((u) => u.id === entry.userId);
    setDetailEntry({ ...entry, userName: u ? `${u.firstName} ${u.lastName}` : entry.employee ? `${entry.employee.firstName} ${entry.employee.lastName}` : `User ${entry.userId}` });
  }

  // ── MONTH VIEW
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const monthDays = eachDayOfInterval({ start: gridStart, end: gridEnd });

  const usersWithLeaveThisMonth = new Set<number>();
  monthDays.forEach((day) => {
    if (isSameMonth(day, currentDate)) getEntriesForDay(day).forEach((e) => usersWithLeaveThisMonth.add(e.userId));
  });

  // ── WEEK VIEW
  const weekStart = startOfISOWeek(currentDate);
  const weekEnd = endOfISOWeek(currentDate);
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd }).filter((d) => !isWeekend(d));

  const prev = () => view === "month" ? setCurrentDate(subMonths(currentDate, 1)) : setCurrentDate(subWeeks(currentDate, 1));
  const next = () => view === "month" ? setCurrentDate(addMonths(currentDate, 1)) : setCurrentDate(addWeeks(currentDate, 1));
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
          <p className="text-muted-foreground text-sm mt-1">See who's off across the team — approved and pending leave</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex rounded-lg border border-border overflow-hidden text-sm">
            <button onClick={() => setView("month")} className={`px-3 py-1.5 font-medium transition-colors ${view === "month" ? "bg-primary text-white" : "text-muted-foreground hover:bg-muted"}`}>Month</button>
            <button onClick={() => setView("week")} className={`px-3 py-1.5 font-medium transition-colors ${view === "week" ? "bg-primary text-white" : "text-muted-foreground hover:bg-muted"}`}>Week</button>
          </div>
          <Button variant="outline" size="sm" onClick={goToday}>Today</Button>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={prev} className="h-8 w-8"><ChevronLeft size={16} /></Button>
            <span className="text-sm font-semibold min-w-[160px] text-center">
              {view === "month" ? format(currentDate, "MMMM yyyy") : `${format(weekStart, "d MMM")} – ${format(weekEnd, "d MMM yyyy")}`}
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
                const dayKey = format(day, "yyyy-MM-dd");
                const dayHolidays = holidayMap.get(dayKey) || [];
                return (
                  <div key={day.toISOString()} className={`min-h-[90px] p-1.5 flex flex-col gap-0.5 ${!inMonth ? "bg-muted/20" : weekend ? "bg-muted/10" : ""}`}>
                    <div className="flex justify-end mb-0.5">
                      <span className={`text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full ${todayFlag ? "bg-primary text-white font-bold" : inMonth ? "text-foreground" : "text-muted-foreground/40"}`}>
                        {format(day, "d")}
                      </span>
                    </div>
                    {/* Public holidays */}
                    {inMonth && dayHolidays.map((h, i) => {
                      const style = HOLIDAY_STYLE[h.country];
                      if (!style) return null;
                      return (
                        <div key={i} className={`rounded px-1 py-0.5 text-[9px] leading-tight border ${style.bg} ${style.text} truncate`} title={`${style.flag} ${h.name}`}>
                          {style.flag} {h.name}
                        </div>
                      );
                    })}
                    {/* Leave entries */}
                    <div className="space-y-0.5 flex-1">
                      {dayEntries.slice(0, 3).map((entry) => {
                        const ci = colorMap.get(entry.userId) ?? 0;
                        const u = activeUsers.find((u) => u.id === entry.userId);
                        const name = u ? `${u.firstName} ${u.lastName.charAt(0)}.` : entry.employee ? `${entry.employee.firstName} ${entry.employee.lastName.charAt(0)}.` : `User ${entry.userId}`;
                        const isPending = entry.status === "pending";
                        return (
                          <div
                            key={`${entry.id}-${day.toISOString()}`}
                            className={`${MEMBER_COLORS[ci]} rounded px-1 py-0.5 text-[10px] leading-tight truncate cursor-pointer hover:opacity-80 transition-opacity ${isPending ? "opacity-60 italic" : ""}`}
                            title={`${name} — ${LEAVE_TYPE_LABELS[entry.leaveType] || entry.leaveType}${entry.halfDay ? " (½ day)" : ""}${isPending ? " (pending)" : ""}`}
                            onClick={() => openDetail(entry)}
                          >
                            {name}{isPending && " ·"}
                          </div>
                        );
                      })}
                      {dayEntries.length > 3 && (
                        <div className="text-[10px] text-muted-foreground pl-1 cursor-pointer hover:text-foreground" onClick={() => openDetail(dayEntries[3])}>
                          +{dayEntries.length - 3} more
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          {/* Legend */}
          <div className="flex items-center gap-4 flex-wrap text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded bg-blue-100 border border-blue-200" />Approved leave</div>
            <div className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded bg-blue-100 border border-blue-200 opacity-60" />Pending (italic)</div>
            <div className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded bg-teal-50 border border-teal-200" />🇨🇿 CZ holiday</div>
            <div className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded bg-red-50 border border-red-200" />🇵🇱 PL holiday</div>
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
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground w-40 min-w-[140px]">Team Member</th>
                  {weekDays.map((day) => {
                    const todayFlag = isToday(day);
                    const dayKey = format(day, "yyyy-MM-dd");
                    const dayHolidays = holidayMap.get(dayKey) || [];
                    return (
                      <th key={day.toISOString()} className={`px-2 py-2 text-center min-w-[100px] ${todayFlag ? "bg-primary/5" : ""}`}>
                        <div className="text-xs font-semibold text-muted-foreground">{format(day, "EEE")}</div>
                        <div className={`text-sm font-bold mt-0.5 ${todayFlag ? "text-primary" : "text-foreground"}`}>{format(day, "d MMM")}</div>
                        {/* Holiday chips in week header */}
                        {dayHolidays.map((h, i) => {
                          const style = HOLIDAY_STYLE[h.country];
                          if (!style) return null;
                          return (
                            <div key={i} className={`mt-1 rounded px-1 py-0.5 text-[9px] leading-tight border mx-auto max-w-[90px] truncate ${style.bg} ${style.text}`} title={h.name}>
                              {style.flag} {h.name}
                            </div>
                          );
                        })}
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
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${MEMBER_COLORS[ci]}`}>{initials}</div>
                          <span className="text-sm font-medium text-foreground truncate">{u.firstName} {u.lastName}</span>
                        </div>
                      </td>
                      {weekDays.map((day) => {
                        const todayFlag = isToday(day);
                        const dayEntries = getEntriesForUserDay(u.id, day);
                        const approvedEntry = dayEntries.find((e) => e.status === "approved");
                        const pendingEntry = dayEntries.find((e) => e.status === "pending");
                        const entry = approvedEntry || pendingEntry;
                        return (
                          <td
                            key={day.toISOString()}
                            className={`px-2 py-3 text-center align-middle ${todayFlag ? "bg-primary/5" : ""} ${entry ? "cursor-pointer hover:bg-muted/30" : ""}`}
                            onClick={() => entry && openDetail(entry)}
                          >
                            {entry ? (
                              <StatusIcon type={entry.leaveType} pending={entry.status === "pending"} halfDay={entry.halfDay} />
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
          {/* Week legend */}
          <div className="flex items-center gap-5 px-4 py-3 border-t border-border bg-muted/30 flex-wrap">
            {[
              { icon: <Building2 size={13} className="text-muted-foreground/50" />, label: "In office" },
              { icon: <Plane size={13} className="text-primary" />, label: "Holiday" },
              { icon: <Home size={13} className="text-blue-500" />, label: "WFH" },
              { icon: <Thermometer size={13} className="text-orange-500" />, label: "Sick" },
              { icon: <Clock size={13} className="text-gray-400" />, label: "Unpaid" },
            ].map(({ icon, label }) => (
              <div key={label} className="flex items-center gap-1.5 text-xs text-muted-foreground">{icon} {label}</div>
            ))}
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground opacity-50"><Plane size={13} /> <span className="italic">Pending (faded)</span></div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground ml-auto">
              <span className="inline-block w-3 h-2.5 rounded bg-teal-50 border border-teal-200" /> CZ holiday
              <span className="inline-block w-3 h-2.5 rounded bg-red-50 border border-red-200 ml-2" /> PL holiday
            </div>
          </div>
        </div>
      )}

      {/* ── Detail modal ── */}
      <Dialog open={!!detailEntry} onOpenChange={(o) => !o && setDetailEntry(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {detailEntry?.leaveType === "annual" && <Plane size={16} className="text-primary" />}
              {detailEntry?.leaveType === "sick" && <Thermometer size={16} className="text-orange-500" />}
              {detailEntry?.leaveType === "home_office" && <Home size={16} className="text-blue-500" />}
              {detailEntry?.leaveType === "unpaid" && <Clock size={16} className="text-gray-400" />}
              {LEAVE_TYPE_LABELS[detailEntry?.leaveType || ""] || detailEntry?.leaveType}
            </DialogTitle>
          </DialogHeader>
          {detailEntry && (
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Employee</span>
                <span className="font-medium">{detailEntry.userName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Dates</span>
                <span className="font-medium">
                  {detailEntry.startDate === detailEntry.endDate
                    ? format(parseISO(detailEntry.startDate), "d MMM yyyy")
                    : `${format(parseISO(detailEntry.startDate), "d MMM")} – ${format(parseISO(detailEntry.endDate), "d MMM yyyy")}`}
                  {detailEntry.halfDay && " (½ day)"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Duration</span>
                <span className="font-medium">{detailEntry.halfDay ? "0.5 days" : `${detailEntry.days} working day${detailEntry.days !== 1 ? "s" : ""}`}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Status</span>
                <span className={`font-medium capitalize ${detailEntry.status === "approved" ? "text-green-600" : "text-amber-600"}`}>{detailEntry.status}</span>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
