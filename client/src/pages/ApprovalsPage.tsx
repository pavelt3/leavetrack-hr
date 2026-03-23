import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { CheckCircle2, XCircle, Clock, CalendarDays, Mail, Flag, Wallet } from "lucide-react";
import { format, parseISO } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";

function formatDateRange(start: string, end: string) {
  const s = parseISO(start), e = parseISO(end);
  if (start === end) return format(s, "d MMM yyyy");
  return `${format(s, "d MMM")} – ${format(e, "d MMM yyyy")}`;
}

const COUNTRY_FLAG: Record<string, string> = { CZ: "🇨🇿", PL: "🇵🇱", MC: "🇲🇨", RO: "🇷🇴", SK: "🇸🇰", AT: "🇦🇹", DE: "🇩🇪", FR: "🇫🇷", GB: "🇬🇧" };

export default function ApprovalsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [decisionDialog, setDecisionDialog] = useState<{ id: number; action: "approved" | "rejected" } | null>(null);
  const [managerNote, setManagerNote] = useState("");

  const { data: pending = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/leave-requests/pending"],
  });

  const year = new Date().getFullYear();
  const { data: allowances = [] } = useQuery<any[]>({
    queryKey: [`/api/allowances?year=${year}`],
  });

  const decisionMutation = useMutation({
    mutationFn: async ({ id, status, note }: { id: number; status: string; note: string }) => {
      const res = await apiRequest("PUT", `/api/leave-requests/${id}/decision`, { status, managerNote: note });
      if (!res.ok) { const err = await res.json(); throw new Error(err.error); }
      return res.json();
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["/api/leave-requests/pending"] });
      queryClient.invalidateQueries({ queryKey: ["/api/leave-requests/all"] });
      queryClient.invalidateQueries({ queryKey: ["/api/allowances"] });
      toast({ title: vars.status === "approved" ? "Request approved ✓" : "Request rejected" });
      setDecisionDialog(null);
      setManagerNote("");
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const reminderMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/reminders/send");
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: (data) => toast({ title: `Reminders sent to ${data.sent} manager${data.sent !== 1 ? "s" : ""}` }),
    onError: () => toast({ title: "Failed to send reminders", variant: "destructive" }),
  });

  const handleDecision = () => {
    if (!decisionDialog) return;
    decisionMutation.mutate({ id: decisionDialog.id, status: decisionDialog.action, note: managerNote });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Pending Approvals</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {pending.length} request{pending.length !== 1 ? "s" : ""} awaiting your decision
          </p>
        </div>
        {user?.role === "admin" && (
          <Button variant="outline" size="sm" onClick={() => reminderMutation.mutate()} disabled={reminderMutation.isPending}>
            <Mail size={15} className="mr-2" />
            {reminderMutation.isPending ? "Sending..." : "Send Reminders"}
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">{[1,2,3].map(i=><div key={i} className="h-24 bg-muted rounded-xl animate-pulse"/>)}</div>
      ) : pending.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center py-16 text-center">
            <CheckCircle2 size={40} className="text-green-500/60 mb-3" />
            <p className="font-medium text-foreground">All caught up!</p>
            <p className="text-muted-foreground text-sm mt-1">No pending leave requests at the moment.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {pending.map((r) => (
            <Card key={r.id} data-testid={`approval-card-${r.id}`} className="border-amber-200 dark:border-amber-800/40">
              <CardContent className="py-4">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="space-y-2 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-foreground">
                        {r.employee?.firstName} {r.employee?.lastName}
                      </span>
                      <span className="text-muted-foreground text-sm">{r.employee?.email}</span>
                      <span className="text-base" title={r.employee?.country}>
                        {COUNTRY_FLAG[r.employee?.country] || r.employee?.country}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-sm flex-wrap">
                      <span className="flex items-center gap-1.5 font-medium">
                        <CalendarDays size={14} className="text-primary" />
                        {formatDateRange(r.startDate, r.endDate)}
                      </span>
                      <span className="flex items-center gap-1.5 text-muted-foreground">
                        <Clock size={14} />
                        {r.halfDay ? "½ day" : `${r.days} working day${r.days !== 1 ? "s" : ""}`}
                      </span>
                      <span className="capitalize text-muted-foreground">{r.leaveType === "home_office" ? "Home Office" : `${r.leaveType} leave`}</span>
                    </div>
                    {r.note && (
                      <p className="text-sm text-muted-foreground italic bg-muted px-3 py-1.5 rounded-md">
                        "{r.note}"
                      </p>
                    )}
                    <div className="flex items-center gap-4 flex-wrap">
                      <p className="text-xs text-muted-foreground">
                        Submitted {format(parseISO(r.createdAt), "d MMM yyyy 'at' HH:mm")}
                      </p>
                      {(() => {
                        const al = allowances.find((a: any) => a.userId === r.userId);
                        if (!al || r.leaveType !== "annual") return null;
                        const proRata = al.proRataTotalDays ?? al.totalDays;
                        const rem = Math.max(0, proRata + al.carriedOverDays - al.usedDays - al.pendingDays);
                        return (
                          <span className={`text-xs flex items-center gap-1 ${rem < 5 ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                            <Wallet size={11} />
                            {rem.toFixed(1)} days remaining (after this: {Math.max(0, rem - r.days).toFixed(1)})
                          </span>
                        );
                      })()}
                    </div>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-destructive text-destructive hover:bg-destructive hover:text-white"
                      onClick={() => { setDecisionDialog({ id: r.id, action: "rejected" }); setManagerNote(""); }}
                      data-testid={`button-reject-${r.id}`}
                    >
                      <XCircle size={14} className="mr-1.5" />
                      Reject
                    </Button>
                    <Button
                      size="sm"
                      className="bg-green-600 hover:bg-green-700 text-white"
                      onClick={() => { setDecisionDialog({ id: r.id, action: "approved" }); setManagerNote(""); }}
                      data-testid={`button-approve-${r.id}`}
                    >
                      <CheckCircle2 size={14} className="mr-1.5" />
                      Approve
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!decisionDialog} onOpenChange={(o) => !o && setDecisionDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {decisionDialog?.action === "approved" ? "Approve this request?" : "Reject this request?"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Note to employee (optional)</Label>
              <Input
                placeholder={decisionDialog?.action === "approved" ? "Enjoy your leave!" : "Please provide a reason..."}
                value={managerNote}
                onChange={(e) => setManagerNote(e.target.value)}
                data-testid="input-manager-note"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDecisionDialog(null)}>Cancel</Button>
            <Button
              onClick={handleDecision}
              disabled={decisionMutation.isPending}
              className={decisionDialog?.action === "approved" ? "bg-green-600 hover:bg-green-700 text-white" : "bg-destructive hover:bg-destructive/90 text-white"}
            >
              {decisionMutation.isPending ? "Processing..." : decisionDialog?.action === "approved" ? "Confirm Approval" : "Confirm Rejection"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
