import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Clock, CalendarDays, Filter, XCircle } from "lucide-react";
import { format, parseISO } from "date-fns";

function StatusBadge({ status }: { status: string }) {
  const classes: Record<string, string> = {
    pending: "status-pending", approved: "status-approved",
    rejected: "status-rejected", cancelled: "status-cancelled",
  };
  return <span className={`status-badge ${classes[status] || ""}`}>{status}</span>;
}

const LEAVE_LABELS: Record<string, string> = {
  annual: "Annual", sick: "Sick", unpaid: "Unpaid", home_office: "Home Office", other: "Other",
};

function LeaveTypeBadge({ type }: { type: string }) {
  const classes: Record<string, string> = {
    annual: "leave-annual", sick: "leave-sick", unpaid: "leave-unpaid",
    home_office: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  };
  return <span className={`status-badge ${classes[type] || "leave-other"}`}>{LEAVE_LABELS[type] || type}</span>;
}

function formatDateRange(start: string, end: string) {
  const s = parseISO(start), e = parseISO(end);
  if (start === end) return format(s, "d MMM yyyy");
  return `${format(s, "d MMM")} – ${format(e, "d MMM yyyy")}`;
}

export default function MyRequestsPage() {
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState("all");
  const [yearFilter, setYearFilter] = useState("all");
  const [cancelId, setCancelId] = useState<number | null>(null);

  const today = format(new Date(), "yyyy-MM-dd");

  const { data: requests = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/leave-requests/me"],
  });

  // Collect distinct years for filter
  const years = useMemo(() => {
    const ys = new Set(requests.map((r) => String(r.year ?? new Date(r.startDate).getFullYear())));
    return Array.from(ys).sort().reverse();
  }, [requests]);

  const cancelMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("PUT", `/api/leave-requests/${id}/cancel`);
      if (!res.ok) { const err = await res.json(); throw new Error(err.error); }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leave-requests/me"] });
      queryClient.invalidateQueries({ queryKey: ["/api/allowances/me"] });
      queryClient.invalidateQueries({ queryKey: ["/api/allowances"] });
      toast({ title: "Request cancelled" });
      setCancelId(null);
    },
    onError: (err: any) => {
      toast({ title: "Could not cancel", description: err.message, variant: "destructive" });
    },
  });

  const filtered = requests.filter((r) => {
    if (statusFilter !== "all" && r.status !== statusFilter) return false;
    if (yearFilter !== "all" && String(r.year ?? new Date(r.startDate).getFullYear()) !== yearFilter) return false;
    return true;
  });
  const sorted = [...filtered].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">My Requests</h1>
          <p className="text-muted-foreground text-sm mt-1">All your leave request history</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Filter size={16} className="text-muted-foreground" />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-36" data-testid="filter-status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
          <Select value={yearFilter} onValueChange={setYearFilter}>
            <SelectTrigger className="w-28" data-testid="filter-year">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All years</SelectItem>
              {years.map((y) => (
                <SelectItem key={y} value={y}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => <div key={i} className="h-20 bg-muted rounded-xl animate-pulse" />)}
        </div>
      ) : sorted.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center py-16 text-center">
            <CalendarDays size={40} className="text-muted-foreground/40 mb-3" />
            <p className="font-medium text-foreground">No requests found</p>
            <p className="text-muted-foreground text-sm mt-1">
              {statusFilter !== "all" ? "Try a different filter" : "Submit your first leave request"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {sorted.map((r, idx) => {
            const rYear = r.year ?? new Date(r.startDate).getFullYear();
            const prevYear = idx > 0 ? (sorted[idx - 1].year ?? new Date(sorted[idx - 1].startDate).getFullYear()) : rYear;
            const showYearBadge = idx === 0 || rYear !== prevYear;
            return (
            <div key={r.id}>
              {showYearBadge && (
                <div className="flex items-center gap-3 pt-1 mb-3">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{rYear}</span>
                  <div className="flex-1 h-px bg-border" />
                </div>
              )}
            <Card data-testid={`request-card-${r.id}`} className="hover:shadow-md transition-shadow">
              <CardContent className="flex items-start justify-between gap-4 py-4 flex-wrap">
                <div className="flex-1 min-w-0 space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-foreground">{formatDateRange(r.startDate, r.endDate)}</span>
                    <LeaveTypeBadge type={r.leaveType} />
                    <StatusBadge status={r.status} />
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock size={12} />
                      {r.halfDay ? "½ day" : `${r.days} working day${r.days !== 1 ? "s" : ""}`}
                    </span>
                    <span>Submitted {format(parseISO(r.createdAt), "d MMM yyyy")}</span>
                  </div>
                  {r.note && (
                    <p className="text-sm text-muted-foreground italic">"{r.note}"</p>
                  )}
                  {r.managerNote && (
                    <p className="text-sm text-foreground/80 bg-muted px-3 py-1.5 rounded-md">
                      Manager note: {r.managerNote}
                    </p>
                  )}
                  {/* Feature 5: Attachment download link */}
                  {r.attachmentName && (
                    <a href={`/api/leave-requests/${r.id}/attachment`} target="_blank" rel="noopener noreferrer"
                       className="text-xs text-primary hover:underline flex items-center gap-1 w-fit">
                      📎 {r.attachmentName}
                    </a>
                  )}
                </div>
                {(r.status === "pending" || (r.status === "approved" && r.startDate >= today)) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground hover:text-destructive flex-shrink-0"
                    onClick={() => setCancelId(r.id)}
                    data-testid={`button-cancel-${r.id}`}
                  >
                    <XCircle size={14} className="mr-1.5" />
                    Cancel
                  </Button>
                )}
              </CardContent>
            </Card>
            </div>
            );
          })}
        </div>
      )}

      <AlertDialog open={cancelId !== null} onOpenChange={(o) => !o && setCancelId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel this request?</AlertDialogTitle>
            <AlertDialogDescription>
              This will cancel your leave request and return the days to your allowance.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction onClick={() => cancelId && cancelMutation.mutate(cancelId)}>
              Yes, cancel it
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
