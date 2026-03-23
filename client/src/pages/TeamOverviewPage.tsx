import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Users, TrendingDown, Thermometer, Home } from "lucide-react";
import { getMonth, getYear, parseISO } from "date-fns";

const COUNTRY_FLAG: Record<string, string> = { CZ: "🇨🇿", PL: "🇵🇱", MC: "🇲🇨", RO: "🇷🇴" };

function AllowanceBar({ used, pending, total, carried }: { used: number; pending: number; total: number; carried: number }) {
  const max = total + carried;
  const usedPct = max > 0 ? (used / max) * 100 : 0;
  const pendingPct = max > 0 ? (pending / max) * 100 : 0;
  const remaining = Math.max(0, max - used - pending);
  return (
    <div className="space-y-1.5">
      <div className="relative h-2.5 bg-muted rounded-full overflow-hidden">
        <div className="absolute inset-y-0 left-0 bg-primary rounded-full transition-all" style={{ width: `${usedPct}%` }} />
        <div className="absolute inset-y-0 bg-amber-400 rounded-full transition-all" style={{ left: `${usedPct}%`, width: `${pendingPct}%` }} />
      </div>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{used.toFixed(1)} used {pending > 0 ? `+ ${pending.toFixed(1)} pending` : ""}</span>
        <span className={remaining < 5 ? "text-destructive font-medium" : ""}>{remaining.toFixed(1)} left</span>
      </div>
    </div>
  );
}

export default function TeamOverviewPage() {
  const { user } = useAuth();
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const currentMonth = new Date().getMonth(); // 0-indexed
  const currentYear = new Date().getFullYear();

  const { data: allowances = [], isLoading } = useQuery<any[]>({
    queryKey: [`/api/allowances?year=${year}`],
  });

  const { data: allUsers = [] } = useQuery<any[]>({ queryKey: ["/api/users/all"] });

  const { data: allLeaveRequests = [] } = useQuery<any[]>({
    queryKey: ["/api/leave-requests/all"],
  });

  // Build per-user stats maps for the selected year
  const sickDaysMap: Record<number, number> = {};
  const hoYearMap: Record<number, number> = {};
  const hoMonthMap: Record<number, number> = {};

  allLeaveRequests.forEach((r: any) => {
    const rYear = r.year ?? getYear(parseISO(r.startDate));
    const rMonth = getMonth(parseISO(r.startDate));
    if (r.status !== "approved") return;

    if (r.leaveType === "sick" && rYear === parseInt(year)) {
      sickDaysMap[r.userId] = (sickDaysMap[r.userId] || 0) + r.days;
    }
    if (r.leaveType === "home_office" && rYear === parseInt(year)) {
      hoYearMap[r.userId] = (hoYearMap[r.userId] || 0) + r.days;
      if (rYear === currentYear && rMonth === currentMonth) {
        hoMonthMap[r.userId] = (hoMonthMap[r.userId] || 0) + r.days;
      }
    }
  });

  const enriched = allowances
    .map((a) => {
      const u = allUsers.find((u: any) => u.id === a.userId);
      return {
        ...a,
        userDetails: u,
        sickDays: sickDaysMap[a.userId] || 0,
        hoYear: hoYearMap[a.userId] || 0,
        hoMonth: hoMonthMap[a.userId] || 0,
      };
    })
    .filter((a) => a.userDetails)
    .sort((a, b) => {
      const nameA = `${a.userDetails.firstName} ${a.userDetails.lastName}`;
      const nameB = `${b.userDetails.firstName} ${b.userDetails.lastName}`;
      return nameA.localeCompare(nameB);
    });

  const years = ["2025", "2026", "2027"];

  const totalTeamDays = enriched.reduce((acc, a) => acc + a.usedDays, 0);
  const totalSickDays = enriched.reduce((acc, a) => acc + a.sickDays, 0);
  const totalHoDays = enriched.reduce((acc, a) => acc + a.hoYear, 0);
  const lowBalance = enriched.filter((a) => {
    const proRata = a.proRataTotalDays ?? a.totalDays;
    const max = proRata + a.carriedOverDays;
    return max - a.usedDays - a.pendingDays < 5;
  }).length;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Team Overview</h1>
          <p className="text-muted-foreground text-sm mt-1">Holiday allowances and balances for your team</p>
        </div>
        <Select value={year} onValueChange={setYear}>
          <SelectTrigger className="w-28" data-testid="select-year">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {years.map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 md:gap-4">
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="text-3xl font-bold text-foreground">{enriched.length}</div>
            <div className="text-sm text-muted-foreground mt-0.5">Team members</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="text-3xl font-bold text-foreground">{totalTeamDays.toFixed(0)}</div>
            <div className="text-sm text-muted-foreground mt-0.5">Holiday days ({year})</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="text-3xl font-bold text-orange-500">{totalSickDays.toFixed(0)}</div>
            <div className="text-sm text-muted-foreground mt-0.5 flex items-center gap-1"><Thermometer size={12} /> Sick days ({year})</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="text-3xl font-bold text-blue-500">{totalHoDays.toFixed(0)}</div>
            <div className="text-sm text-muted-foreground mt-0.5 flex items-center gap-1"><Home size={12} /> Home office ({year})</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className={`text-3xl font-bold ${lowBalance > 0 ? "text-destructive" : "text-foreground"}`}>{lowBalance}</div>
            <div className="text-sm text-muted-foreground mt-0.5">Low balance (&lt;5 days)</div>
          </CardContent>
        </Card>
      </div>

      {/* Team table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Users size={18} />
            Individual Allowances
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">{[1,2,3,4].map(i=><div key={i} className="h-16 bg-muted rounded-lg animate-pulse"/>)}</div>
          ) : enriched.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">No team members found for {year}</div>
          ) : (
            <div className="divide-y divide-border">
              {enriched.map((a) => {
                const u = a.userDetails;
                const initials = `${u.firstName[0]}${u.lastName[0]}`.toUpperCase();
                const proRata = a.proRataTotalDays ?? a.totalDays;
                const max = proRata + a.carriedOverDays;
                const remaining = Math.max(0, max - a.usedDays - a.pendingDays);
                const isLow = remaining < 5;
                return (
                  <div key={a.id} className="py-4 flex items-start gap-4 flex-wrap" data-testid={`team-row-${u.id}`}>
                    <Avatar className="h-9 w-9 flex-shrink-0">
                      <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">{initials}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-[220px]">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="font-medium text-sm text-foreground">{u.firstName} {u.lastName}</span>
                        <span className="text-base">{COUNTRY_FLAG[u.country] || u.country}</span>
                        <span className="text-xs text-muted-foreground capitalize">{u.role}</span>
                        {u.department && <span className="text-xs text-muted-foreground">· {u.department}</span>}
                        {isLow && (
                          <span className="status-badge bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 flex items-center gap-1">
                            <TrendingDown size={10} /> Low
                          </span>
                        )}
                      </div>
                      <AllowanceBar used={a.usedDays} pending={a.pendingDays} total={proRata} carried={a.carriedOverDays} />
                    </div>
                    {/* Stats: scrollable on mobile, fixed grid on desktop */}
                    <div className="w-full md:w-auto overflow-x-auto -mx-1 px-1">
                      <div className="flex md:grid md:grid-cols-8 gap-3 text-center min-w-max md:min-w-0 md:flex-shrink-0">
                        {[
                          { label: "Annual", val: proRata !== a.totalDays ? `${proRata}★` : proRata, title: proRata !== a.totalDays ? `Pro-rata entitlement (full year: ${a.totalDays} days)` : undefined },
                          { label: "Carried", val: a.carriedOverDays },
                          { label: "Holiday", val: a.usedDays.toFixed(1) },
                          { label: "Sick", val: a.sickDays.toFixed(1), color: a.sickDays > 0 ? "text-orange-500" : "text-foreground" },
                          { label: "Home Off.", val: `${a.hoMonth}/${a.hoYear}`, color: a.hoYear > 0 ? "text-blue-500" : "text-foreground", title: `${a.hoMonth} this month / ${a.hoYear} this year` },
                          { label: "Remaining", val: remaining.toFixed(1), color: isLow ? "text-destructive" : "text-green-600 dark:text-green-400" },
                          { label: "Tot. Accrued", val: (a.totalAccruedDays ?? 0).toFixed(1), color: "text-violet-600 dark:text-violet-400", title: "Total days accrued to date (inc. carry-over)" },
                          { label: "Acc. Rem.", val: (a.accruedRemaining ?? 0).toFixed(1), color: (a.accruedRemaining ?? 0) < 2 ? "text-destructive" : "text-violet-600 dark:text-violet-400", title: "Accrued days remaining (accrued minus used/pending)" },
                        ].map((s) => (
                          <div key={s.label} title={(s as any).title} className="min-w-[52px] px-1">
                            <div className={`font-semibold text-sm ${s.color || "text-foreground"}`}>{s.val}</div>
                            <div className="text-xs text-muted-foreground whitespace-nowrap">{s.label}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Column legend */}
      <div className="rounded-xl border border-border bg-muted/30 px-5 py-4 text-xs text-muted-foreground">
        <p className="font-semibold text-foreground text-sm mb-3">Column guide</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-2">
          <div><span className="font-medium text-foreground">Annual</span> &mdash; contractual entitlement for the year (pro-rated if the employee started mid-year)</div>
          <div><span className="font-medium text-foreground">Carried</span> &mdash; unused days brought forward from the previous year</div>
          <div><span className="font-medium text-foreground">Holiday</span> &mdash; approved annual leave days already taken</div>
          <div><span className="font-medium text-foreground">Remaining</span> &mdash; Annual + Carried &minus; Holiday &minus; any pending requests</div>
          <div><span className="font-medium text-foreground">Sick</span> &mdash; approved sick leave days (does not reduce the holiday balance)</div>
          <div><span className="font-medium text-foreground">Home Off.</span> &mdash; home-office days logged (format: this&nbsp;month / this&nbsp;year)</div>
          <div><span className="font-medium text-violet-600 dark:text-violet-400">Tot. Accrued</span> &mdash; days earned so far this year based on time elapsed (carry-over counts in full from day&nbsp;1)</div>
          <div><span className="font-medium text-violet-600 dark:text-violet-400">Acc. Rem.</span> &mdash; accrued days not yet used (Tot.&nbsp;Accrued &minus; Holiday &minus; Pending)</div>
        </div>
        <div className="mt-3 pt-3 border-t border-border flex items-center gap-5 flex-wrap">
          <span className="font-medium text-foreground">Progress bar:</span>
          <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded-sm bg-primary" /> used</span>
          <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded-sm bg-amber-400" /> pending approval</span>
          <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded-sm bg-muted border border-border" /> remaining</span>
        </div>
      </div>
    </div>
  );
}
