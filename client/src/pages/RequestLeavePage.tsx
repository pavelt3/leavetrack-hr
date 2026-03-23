import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CalendarDays, Info, Home } from "lucide-react";
import { format, parseISO } from "date-fns";

const LEAVE_TYPES = [
  { value: "annual", label: "Annual Leave", halfDayOk: true },
  { value: "sick", label: "Sick Leave", halfDayOk: true },
  { value: "unpaid", label: "Unpaid Leave", halfDayOk: false },
  { value: "home_office", label: "Home Office", halfDayOk: false },
  { value: "other", label: "Other", halfDayOk: false },
];

export default function RequestLeavePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const year = new Date().getFullYear();

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [leaveType, setLeaveType] = useState("annual");
  const [halfDay, setHalfDay] = useState(false);
  const [note, setNote] = useState("");

  const { data: allowance } = useQuery<any>({ queryKey: [`/api/allowances/me?year=${year}`] });
  const { data: holidays = [] } = useQuery<any[]>({
    queryKey: [`/api/holidays?year=${year}&country=${user?.country}`],
  });

  const holidaySet = new Set(holidays.map((h: any) => h.date));
  const isHomeOffice = leaveType === "home_office";
  const currentType = LEAVE_TYPES.find((t) => t.value === leaveType);
  const canHalfDay = currentType?.halfDayOk ?? false;

  // When switching to a type that doesn't support half-day, reset it
  function handleLeaveTypeChange(val: string) {
    setLeaveType(val);
    const t = LEAVE_TYPES.find((t) => t.value === val);
    if (!t?.halfDayOk) setHalfDay(false);
  }

  // Estimate business days
  function estimateDays(start: string, end: string): number {
    if (!start || !end) return 0;
    if (halfDay) return 0.5;
    let count = 0;
    const s = parseISO(start), e = parseISO(end);
    if (s > e) return 0;
    const cur = new Date(s);
    while (cur <= e) {
      const dow = cur.getDay();
      const iso = cur.toISOString().split("T")[0];
      if (dow !== 0 && dow !== 6 && !holidaySet.has(iso)) count++;
      cur.setDate(cur.getDate() + 1);
    }
    return count;
  }

  const estimatedDays = estimateDays(startDate, endDate);
  const remaining = allowance
    ? (allowance.proRataTotalDays ?? allowance.totalDays) + allowance.carriedOverDays - allowance.usedDays - allowance.pendingDays
    : 0;

  const mutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/leave-requests", data);
      if (!res.ok) { const err = await res.json(); throw new Error(err.error); }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leave-requests/me"] });
      queryClient.invalidateQueries({ queryKey: [`/api/allowances/me?year=${year}`] });
      toast({ title: isHomeOffice ? "Home office request submitted" : "Leave request submitted", description: "Your manager will be notified." });
      setLocation("/my-requests");
    },
    onError: (err: any) => {
      toast({ title: "Failed to submit", description: err.message, variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!startDate) { toast({ title: "Please select a date", variant: "destructive" }); return; }
    if (!halfDay && !endDate) { toast({ title: "Please select an end date", variant: "destructive" }); return; }
    if (!halfDay && endDate < startDate) { toast({ title: "End date must be after start date", variant: "destructive" }); return; }
    mutation.mutate({ startDate, endDate: halfDay ? startDate : endDate, leaveType, note, halfDay });
  };

  const today = format(new Date(), "yyyy-MM-dd");

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          {isHomeOffice ? "Request Home Office" : "Request Leave"}
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          {isHomeOffice ? "Submit a work-from-home request for your manager" : "Submit a new leave request for approval"}
        </p>
      </div>

      {allowance && leaveType === "annual" && (
        <div className="flex gap-3 flex-wrap">
          <div className="bg-muted rounded-lg px-4 py-2.5 text-sm">
            <span className="text-muted-foreground">Remaining: </span>
            <span className={`font-semibold ${remaining < 5 ? "text-destructive" : "text-foreground"}`}>{remaining.toFixed(1)} days</span>
          </div>
          {allowance.pendingDays > 0 && (
            <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg px-4 py-2.5 text-sm">
              <span className="text-amber-700 dark:text-amber-400">{allowance.pendingDays.toFixed(1)} days pending approval</span>
            </div>
          )}
          {(allowance.proRataTotalDays ?? allowance.totalDays) !== allowance.totalDays && (
            <div className="bg-violet-50 dark:bg-violet-900/20 rounded-lg px-4 py-2.5 text-sm">
              <span className="text-violet-700 dark:text-violet-400">Pro-rata entitlement: {(allowance.proRataTotalDays ?? allowance.totalDays).toFixed(1)} days (full year: {allowance.totalDays})</span>
            </div>
          )}
        </div>
      )}

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base flex items-center gap-2">
            {isHomeOffice ? <Home size={18} /> : <CalendarDays size={18} />}
            {isHomeOffice ? "Home Office Details" : "Leave Details"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label>Request type</Label>
              <Select value={leaveType} onValueChange={handleLeaveTypeChange}>
                <SelectTrigger data-testid="select-leave-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LEAVE_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Half-day toggle — only for annual and sick */}
            {canHalfDay && (
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  role="switch"
                  aria-checked={halfDay}
                  onClick={() => setHalfDay(!halfDay)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ${halfDay ? "bg-primary" : "bg-muted-foreground/30"}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${halfDay ? "translate-x-6" : "translate-x-1"}`} />
                </button>
                <Label className="cursor-pointer select-none" onClick={() => setHalfDay(!halfDay)}>
                  Half day
                </Label>
                {halfDay && (
                  <span className="text-xs text-muted-foreground">(0.5 days deducted)</span>
                )}
              </div>
            )}

            <div className={`grid gap-4 ${halfDay ? "grid-cols-1" : "grid-cols-2"}`}>
              <div className="space-y-2">
                <Label htmlFor="start-date">{halfDay ? "Date" : "Start date"}</Label>
                <input
                  id="start-date"
                  type="date"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={startDate}
                  min={today}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    if (!halfDay && (!endDate || e.target.value > endDate)) setEndDate(e.target.value);
                  }}
                  required
                  data-testid="input-start-date"
                />
              </div>
              {!halfDay && (
                <div className="space-y-2">
                  <Label htmlFor="end-date">End date</Label>
                  <input
                    id="end-date"
                    type="date"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    value={endDate}
                    min={startDate || today}
                    onChange={(e) => setEndDate(e.target.value)}
                    required
                    data-testid="input-end-date"
                  />
                </div>
              )}
            </div>

            {startDate && (halfDay || endDate) && (
              <Alert className={estimatedDays === 0 ? "border-destructive" : isHomeOffice ? "border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/40" : "border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/40"}>
                <Info size={16} className="text-blue-600 dark:text-blue-400" />
                <AlertDescription className="text-blue-800 dark:text-blue-300">
                  {estimatedDays === 0
                    ? "No working days in the selected range (all weekend or public holidays)."
                    : isHomeOffice
                    ? `Home office request for ${halfDay ? "half day" : estimatedDays === 1 ? "1 day" : `${estimatedDays} days`}.`
                    : `This request covers ${halfDay ? "half a day (0.5)" : `approximately ${estimatedDays} working day${estimatedDays !== 1 ? "s" : ""}`}.`}
                  {leaveType === "annual" && estimatedDays > remaining && (
                    <div className="text-destructive font-medium mt-1">
                      ⚠ You only have {remaining.toFixed(1)} days remaining.
                    </div>
                  )}
                </AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="note">Note (optional)</Label>
              <Textarea
                id="note"
                placeholder={isHomeOffice ? "Reason for working from home..." : "Add any details for your manager..."}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                data-testid="textarea-note"
              />
            </div>

            <div className="flex gap-3 pt-1">
              <Button type="submit" disabled={mutation.isPending || (!halfDay && estimatedDays === 0)} data-testid="button-submit-request">
                {mutation.isPending ? "Submitting..." : isHomeOffice ? "Submit Home Office Request" : "Submit Request"}
              </Button>
              <Button type="button" variant="outline" onClick={() => setLocation("/my-requests")}>
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
