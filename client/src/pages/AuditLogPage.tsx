import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  ShieldCheck, User, CalendarDays, CheckCircle2, XCircle, XSquare,
  Settings, ArrowLeftRight, LogIn, ChevronUp, ChevronDown, ChevronsUpDown,
  Search, Filter,
} from "lucide-react";
import { format, parseISO } from "date-fns";

// ── Types ─────────────────────────────────────────────────────────────────────
interface AuditEntry {
  id: number;
  timestamp: string;
  actorId: number | null;
  actorName: string | null;
  targetUserId: number | null;
  targetUserName: string | null;
  eventType: string;
  summary: string;
  detail: string | null;
}

// ── Event type config ─────────────────────────────────────────────────────────
const EVENT_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  leave_request:   { label: "Leave request",    icon: <CalendarDays size={14} />,  color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  leave_approved:  { label: "Approved",         icon: <CheckCircle2 size={14} />,  color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
  leave_rejected:  { label: "Rejected",         icon: <XCircle size={14} />,       color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
  leave_cancelled: { label: "Cancelled",        icon: <XSquare size={14} />,       color: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400" },
  allowance_change:{ label: "Allowance change", icon: <Settings size={14} />,      color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
  user_created:    { label: "User invited",     icon: <User size={14} />,          color: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400" },
  user_updated:    { label: "Profile updated",  icon: <User size={14} />,          color: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400" },
  carry_over:      { label: "Carry-over",       icon: <ArrowLeftRight size={14} />,color: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400" },
  login:           { label: "Login",            icon: <LogIn size={14} />,         color: "bg-muted text-muted-foreground" },
};

const ALL_EVENT_TYPES = Object.keys(EVENT_CONFIG);

// ── Sort helper ───────────────────────────────────────────────────────────────
type SortField = "timestamp" | "actorName" | "targetUserName" | "eventType";
type SortDir = "asc" | "desc";

function SortIcon({ field, sort }: { field: SortField; sort: { field: SortField; dir: SortDir } }) {
  if (sort.field !== field) return <ChevronsUpDown size={13} className="text-muted-foreground/40 ml-1" />;
  return sort.dir === "asc"
    ? <ChevronUp size={13} className="text-primary ml-1" />
    : <ChevronDown size={13} className="text-primary ml-1" />;
}

// ── Detail renderer ───────────────────────────────────────────────────────────
function DetailPanel({ raw }: { raw: string | null }) {
  if (!raw) return null;
  try {
    const obj = JSON.parse(raw);
    const rows = Object.entries(obj).filter(([, v]) => v !== null && v !== undefined && v !== "");
    if (!rows.length) return null;
    return (
      <div className="mt-2 rounded-md bg-muted/50 border border-border px-3 py-2 text-xs space-y-0.5">
        {rows.map(([k, v]) => {
          const label = k.replace(/_/g, " ").replace(/([A-Z])/g, " $1").trim();
          const display = typeof v === "object" ? JSON.stringify(v) : String(v);
          return (
            <div key={k} className="flex gap-2">
              <span className="text-muted-foreground capitalize min-w-[90px] flex-shrink-0">{label}:</span>
              <span className="text-foreground break-all">{display}</span>
            </div>
          );
        })}
      </div>
    );
  } catch {
    return <p className="mt-1 text-xs text-muted-foreground">{raw}</p>;
  }
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function AuditLogPage() {
  const [typeFilter, setTypeFilter] = useState("all");
  const [personFilter, setPersonFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<{ field: SortField; dir: SortDir }>({ field: "timestamp", dir: "desc" });
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const { data: entries = [], isLoading } = useQuery<AuditEntry[]>({
    queryKey: ["/api/audit-log"],
  });

  // Collect distinct people (actors + targets)
  const people = useMemo(() => {
    const map = new Map<string, string>();
    entries.forEach((e) => {
      if (e.actorName) map.set(e.actorName, e.actorName);
      if (e.targetUserName && e.targetUserName !== e.actorName) map.set(e.targetUserName, e.targetUserName);
    });
    return Array.from(map.values()).sort();
  }, [entries]);

  // Filter
  const filtered = useMemo(() => {
    return entries.filter((e) => {
      if (typeFilter !== "all" && e.eventType !== typeFilter) return false;
      if (personFilter !== "all" && e.actorName !== personFilter && e.targetUserName !== personFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        if (
          !e.summary.toLowerCase().includes(q) &&
          !(e.actorName || "").toLowerCase().includes(q) &&
          !(e.targetUserName || "").toLowerCase().includes(q) &&
          !(e.detail || "").toLowerCase().includes(q)
        ) return false;
      }
      return true;
    });
  }, [entries, typeFilter, personFilter, search]);

  // Sort
  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let av: string = "", bv: string = "";
      if (sort.field === "timestamp") { av = a.timestamp; bv = b.timestamp; }
      else if (sort.field === "actorName") { av = a.actorName || ""; bv = b.actorName || ""; }
      else if (sort.field === "targetUserName") { av = a.targetUserName || ""; bv = b.targetUserName || ""; }
      else if (sort.field === "eventType") { av = a.eventType; bv = b.eventType; }
      const cmp = av.localeCompare(bv);
      return sort.dir === "asc" ? cmp : -cmp;
    });
  }, [filtered, sort]);

  function toggleSort(field: SortField) {
    setSort((s) => s.field === field
      ? { field, dir: s.dir === "asc" ? "desc" : "asc" }
      : { field, dir: field === "timestamp" ? "desc" : "asc" }
    );
  }

  function toggleExpand(id: number) {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  const thClass = "px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground whitespace-nowrap cursor-pointer select-none hover:text-foreground transition-colors";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <ShieldCheck size={22} className="text-primary" />
          Audit Log
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Full history of all actions taken on the platform — admin view only
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:flex lg:items-center gap-3">
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-full sm:w-44" data-testid="filter-event-type">
                <SelectValue placeholder="All event types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All event types</SelectItem>
                {ALL_EVENT_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>{EVENT_CONFIG[t].label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={personFilter} onValueChange={setPersonFilter}>
              <SelectTrigger className="w-full sm:w-44" data-testid="filter-person">
                <SelectValue placeholder="All people" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All people</SelectItem>
                {people.map((p) => (
                  <SelectItem key={p} value={p}>{p}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="relative sm:col-span-2 lg:flex-1 lg:max-w-xs">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-9 text-sm w-full"
                data-testid="input-search"
              />
            </div>

            <span className="text-xs text-muted-foreground lg:ml-auto">
              {isLoading ? "Loading…" : `${sorted.length} event${sorted.length !== 1 ? "s" : ""}`}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-2 p-4">
              {[1,2,3,4,5].map(i => <div key={i} className="h-12 bg-muted rounded-lg animate-pulse" />)}
            </div>
          ) : sorted.length === 0 ? (
            <div className="flex flex-col items-center py-16 text-center">
              <ShieldCheck size={36} className="text-muted-foreground/30 mb-3" />
              <p className="font-medium text-foreground">No events found</p>
              <p className="text-muted-foreground text-sm mt-1">
                {typeFilter !== "all" || personFilter !== "all" || search
                  ? "Try adjusting your filters"
                  : "Actions taken on the platform will appear here. Note: data seeded before launch has no audit trail — the log grows from real activity onwards."}
              </p>
            </div>
          ) : (
            <>
              {/* Desktop: table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-muted/50 border-b border-border">
                      <th className={thClass} onClick={() => toggleSort("timestamp")}>
                        <span className="flex items-center">Date &amp; Time <SortIcon field="timestamp" sort={sort} /></span>
                      </th>
                      <th className={thClass} onClick={() => toggleSort("eventType")}>
                        <span className="flex items-center">Event <SortIcon field="eventType" sort={sort} /></span>
                      </th>
                      <th className={thClass} onClick={() => toggleSort("actorName")}>
                        <span className="flex items-center">Performed by <SortIcon field="actorName" sort={sort} /></span>
                      </th>
                      <th className={thClass} onClick={() => toggleSort("targetUserName")}>
                        <span className="flex items-center">Regarding <SortIcon field="targetUserName" sort={sort} /></span>
                      </th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground">Description</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {sorted.map((e) => {
                      const cfg = EVENT_CONFIG[e.eventType] || { label: e.eventType, icon: <ShieldCheck size={14} />, color: "bg-muted text-muted-foreground" };
                      const isExp = expanded.has(e.id);
                      const hasDetail = !!e.detail && e.detail !== "{}";
                      return (
                        <tr
                          key={e.id}
                          className={`transition-colors ${hasDetail ? "cursor-pointer hover:bg-muted/40" : "hover:bg-muted/20"}`}
                          onClick={() => hasDetail && toggleExpand(e.id)}
                          data-testid={`audit-row-${e.id}`}
                        >
                          <td className="px-4 py-3 whitespace-nowrap text-muted-foreground text-xs">
                            <div>{format(parseISO(e.timestamp), "d MMM yyyy")}</div>
                            <div className="font-medium text-foreground">{format(parseISO(e.timestamp), "HH:mm:ss")}</div>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${cfg.color}`}>
                              {cfg.icon}{cfg.label}
                            </span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className="font-medium text-foreground">{e.actorName || "—"}</span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                            {e.targetUserName && e.targetUserName !== e.actorName ? e.targetUserName : "—"}
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-foreground">{e.summary}</div>
                            {hasDetail && isExp && <DetailPanel raw={e.detail} />}
                            {hasDetail && !isExp && (
                              <span className="text-[11px] text-muted-foreground mt-0.5 block">Click to expand details</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile: card list */}
              <div className="md:hidden divide-y divide-border">
                {sorted.map((e) => {
                  const cfg = EVENT_CONFIG[e.eventType] || { label: e.eventType, icon: <ShieldCheck size={14} />, color: "bg-muted text-muted-foreground" };
                  const isExp = expanded.has(e.id);
                  const hasDetail = !!e.detail && e.detail !== "{}";
                  return (
                    <div
                      key={e.id}
                      className={`px-4 py-3 space-y-1.5 ${hasDetail ? "cursor-pointer active:bg-muted/40" : ""}`}
                      onClick={() => hasDetail && toggleExpand(e.id)}
                      data-testid={`audit-row-mob-${e.id}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${cfg.color} flex-shrink-0`}>
                          {cfg.icon}{cfg.label}
                        </span>
                        <span className="text-xs text-muted-foreground text-right">
                          {format(parseISO(e.timestamp), "d MMM yyyy")}
                          <br />
                          <span className="font-medium text-foreground">{format(parseISO(e.timestamp), "HH:mm")}</span>
                        </span>
                      </div>
                      <p className="text-sm text-foreground">{e.summary}</p>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                        {e.actorName && (
                          <span className="flex items-center gap-1"><span className="text-foreground font-medium">{e.actorName}</span></span>
                        )}
                        {e.targetUserName && e.targetUserName !== e.actorName && (
                          <span>→ {e.targetUserName}</span>
                        )}
                      </div>
                      {hasDetail && isExp && <DetailPanel raw={e.detail} />}
                      {hasDetail && !isExp && (
                        <span className="text-[11px] text-muted-foreground">Tap to see details</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
