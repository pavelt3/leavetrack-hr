import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CalendarDays, Clock, CheckSquare, TrendingUp, Plus, ChevronRight, Thermometer, Home, TrendingDown } from "lucide-react";
import { format, parseISO, getMonth, getYear } from "date-fns";

function AllowanceRing({ used, total, carried }: { used: number; total: number; carried: number }) {
  const max = total + carried;
  const remaining = Math.max(0, max - used);
  const pct = max > 0 ? ((max - remaining) / max) * 100 : 0;
  const r = 42, cx = 50, cy = 50;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-32 h-32">
        <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="hsl(var(--muted))" strokeWidth="10" />
          <circle
            cx={cx} cy={cy} r={r} fill="none"
            stroke="hsl(var(--primary))"
            strokeWidth="10"
            strokeDasharray={`${dash} ${circ}`}
            strokeLinecap="round"
            className="transition-all duration-500"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-bold text-foreground">{remaining.toFixed(1)}</span>
          <span className="text-xs text-muted-foreground">remaining</span>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3 text-center text-xs w-full">
        <div>
          <div className="font-semibold text-foreground">{total}</div>
          <div className="text-muted-foreground">Annual</div>
        </div>
        <div>
          <div className="font-semibold text-foreground">{carried}</div>
          <div className="text-muted-foreground">Carried</div>
        </div>
        <div>
          <div className="font-semibold text-destructive">{used.toFixed(1)}</div>
          <div className="text-muted-foreground">Used</div>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const classes: Record<string, string> = {
    pending: "status-pending",
    approved: "status-approved",
    rejected: "status-rejected",
    cancelled: "status-cancelled",
  };
  return <span className={`status-badge ${classes[status] || ""}`}>{status}</span>;
}

function formatDateRange(start: string, end: string) {
  const s = parseISO(start), e = parseISO(end);
  if (start === end) return format(s, "d MMM yyyy");
  if (s.getFullYear() === e.getFullYear() && s.getMonth() === e.getMonth()) {
    return `${format(s, "d")}–${format(e, "d MMM yyyy")}`;
  }
  return `${format(s, "d MMM")} – ${format(e, "d MMM yyyy")}`;
}

function leaveTypeLabel(type: string) {
  const map: Record<string, string> = {
    annual: "Annual",
    sick: "Sick",
    unpaid: "Unpaid",
    home_office: "Home Office",
    other: "Other",
  };
  return map[type] || type;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const year = new Date().getFullYear();
  const month = new Date().getMonth(); // 0-indexed

  const { data: allowance } = useQuery<any>({ queryKey: [`/api/allowances/me?year=${year}`] });
  const { data: myRequests = [] } = useQuery<any[]>({ queryKey: ["/api/leave-requests/me"] });
  const { data: pending = [] } = useQuery<any[]>({
    queryKey: ["/api/leave-requests/pending"],
    enabled: user?.role !== "employee",
  });

  const recent = [...myRequests]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

  const upcomingApproved = myRequests
    .filter((r) => r.status === "approved" && new Date(r.startDate) >= new Date() && r.leaveType !== "home_office")
    .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
    .slice(0, 3);

  // Sick days stats (approved only)
  const sickThisYear = myRequests
    .filter((r) => r.leaveType === "sick" && r.status === "approved" && r.year === year)
    .reduce((acc, r) => acc + r.days, 0);

  const sickThisMonth = myRequests
    .filter((r) => {
      if (r.leaveType !== "sick" || r.status !== "approved") return false;
      const d = parseISO(r.startDate);
      return getFullYear(d) === year && getMonth(d) === month;
    })
    .reduce((acc, r) => acc + r.days, 0);

  // Home office stats (approved only)
  const hoThisYear = myRequests
    .filter((r) => r.leaveType === "home_office" && r.status === "approved" && r.year === year)
    .reduce((acc, r) => acc + r.days, 0);

  const hoThisMonth = myRequests
    .filter((r) => {
      if (r.leaveType !== "home_office" || r.status !== "approved") return false;
      const d = parseISO(r.startDate);
      return getFullYear(d) === year && getMonth(d) === month;
    })
    .reduce((acc, r) => acc + r.days, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Good {new Date().getHours() < 12 ? "morning" : new Date().getHours() < 18 ? "afternoon" : "evening"}, {user?.firstName} 👋
          </h1>
          <p className="text-muted-foreground text-sm mt-1">{format(new Date(), "EEEE, d MMMM yyyy")}</p>
        </div>
        <Link href="/request">
          <Button data-testid="button-request-leave">
            <Plus size={16} className="mr-2" />
            Request Leave
          </Button>
        </Link>
      </div>

      {/* Top row: allowance + stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="md:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Your {year} Allowance</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center pt-2">
            {allowance ? (
              <AllowanceRing
                used={allowance.usedDays + allowance.pendingDays}
                total={allowance.proRataTotalDays ?? allowance.totalDays}
                carried={allowance.carriedOverDays}
              />
            ) : (
              <div className="h-32 flex items-center justify-center text-muted-foreground text-sm">Loading...</div>
            )}
            {allowance && allowance.pendingDays > 0 && (
              <div className="mt-3 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-3 py-1.5 rounded-full">
                {allowance.pendingDays.toFixed(1)} days pending approval
              </div>
            )}
          </CardContent>
        </Card>

        <div className="md:col-span-2 grid grid-cols-2 gap-3 md:gap-4">
          {user?.role !== "employee" && (
            <Card className="bg-primary text-white border-0">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center flex-shrink-0">
                    <CheckSquare size={16} />
                  </div>
                  <span className="text-white/80 text-xs font-medium leading-tight">Pending Approvals</span>
                </div>
                <div className="text-3xl font-bold">{pending.length}</div>
                {pending.length > 0 && (
                  <Link href="/approvals">
                    <button className="mt-2 text-white/70 hover:text-white text-xs flex items-center gap-1 transition-colors">
                      Review now <ChevronRight size={12} />
                    </button>
                  </Link>
                )}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
                  <TrendingUp size={16} className="text-green-700 dark:text-green-400" />
                </div>
                <span className="text-muted-foreground text-xs font-medium leading-tight">Annual Leave Taken</span>
              </div>
              <div className="text-3xl font-bold text-foreground">
                {myRequests.filter((r) => r.status === "approved" && r.year === year && r.leaveType === "annual").reduce((a, b) => a + b.days, 0).toFixed(1)}
              </div>
              <p className="text-muted-foreground text-xs mt-0.5">days this year (annual only)</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 bg-orange-100 dark:bg-orange-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Thermometer size={16} className="text-orange-600 dark:text-orange-400" />
                </div>
                <span className="text-muted-foreground text-xs font-medium leading-tight">Sick Days</span>
              </div>
              <div className="text-3xl font-bold text-orange-500">{sickThisYear.toFixed(1)}</div>
              <p className="text-muted-foreground text-xs mt-0.5">
                yr · <span className="font-medium">{sickThisMonth.toFixed(1)}</span> mo
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Home size={16} className="text-blue-600 dark:text-blue-400" />
                </div>
                <span className="text-muted-foreground text-xs font-medium leading-tight">Home Office</span>
              </div>
              <div className="text-3xl font-bold text-blue-500">{hoThisYear.toFixed(0)}</div>
              <p className="text-muted-foreground text-xs mt-0.5">
                yr · <span className="font-medium">{hoThisMonth.toFixed(0)}</span> mo
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 bg-violet-100 dark:bg-violet-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
                  <TrendingDown size={16} className="text-violet-600 dark:text-violet-400" />
                </div>
                <span className="text-muted-foreground text-xs font-medium leading-tight">Accrued Days</span>
              </div>
              {allowance ? (
                <>
                  <div className="text-3xl font-bold text-violet-600 dark:text-violet-400">
                    {(allowance.totalAccruedDays ?? 0).toFixed(1)}
                  </div>
                  <p className="text-muted-foreground text-xs mt-0.5">
                    accrued · <span className="font-medium">{(allowance.accruedRemaining ?? 0).toFixed(1)}</span> left
                  </p>
                </>
              ) : (
                <p className="text-muted-foreground text-sm">Loading...</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
                  <CalendarDays size={16} className="text-blue-700 dark:text-blue-400" />
                </div>
                <span className="text-muted-foreground text-xs font-medium leading-tight">Upcoming Leave</span>
              </div>
              {upcomingApproved.length > 0 ? (
                <div className="space-y-1">
                  {upcomingApproved.map((r) => (
                    <div key={r.id} className="text-xs">
                      <span className="font-medium">{formatDateRange(r.startDate, r.endDate)}</span>
                      <span className="text-muted-foreground ml-1">{r.halfDay ? "½d" : `${r.days}d`}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-xs">No upcoming leave</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Recent requests */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-base">Recent Requests</CardTitle>
          <Link href="/my-requests">
            <button className="text-xs text-primary hover:underline flex items-center gap-1">
              View all <ChevronRight size={12} />
            </button>
          </Link>
        </CardHeader>
        <CardContent>
          {recent.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <CalendarDays size={36} className="mx-auto mb-3 opacity-40" />
              <p className="text-sm">No leave requests yet</p>
              <Link href="/request">
                <Button variant="outline" size="sm" className="mt-3">Request your first leave</Button>
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-border -mx-2">
              {recent.map((r) => (
                <div key={r.id} className="flex items-center gap-4 px-2 py-3">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm">{formatDateRange(r.startDate, r.endDate)}</div>
                    <div className="text-muted-foreground text-xs">
                      {leaveTypeLabel(r.leaveType)} · {r.halfDay ? "½ day" : `${r.days} day${r.days !== 1 ? "s" : ""}`}
                    </div>
                  </div>
                  <StatusBadge status={r.status} />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Helper to avoid import collision with date-fns
function getFullYear(d: Date) { return d.getFullYear(); }
