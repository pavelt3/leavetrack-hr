import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle2, Info } from "lucide-react";

const COUNTRY_FLAG: Record<string, string> = { CZ: "🇨🇿", PL: "🇵🇱", MC: "🇲🇨" };

export default function SettingsPage() {
  const { user } = useAuth();
  const { toast } = useToast();

  // Feature 4: Profile editing
  const [profileForm, setProfileForm] = useState({ firstName: user?.firstName || "", lastName: user?.lastName || "", phone: user?.phone || "", emergencyContact: user?.emergencyContact || "", emergencyContactPhone: user?.emergencyContactPhone || "" });
  const profileMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PUT", "/api/users/me/profile", profileForm);
      if (!res.ok) { const e = await res.json(); throw new Error(e.error); }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      toast({ title: "Profile updated" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  // Feature 2: Approval delegation
  const { data: delegationData } = useQuery<any>({
    queryKey: ["/api/users/me/delegation"],
  });
  const [delegateToId, setDelegateToId] = useState<string>("");
  const [delegateUntil, setDelegateUntil] = useState<string>("");
  const { data: allUsersForDelegate = [] } = useQuery<any[]>({
    queryKey: ["/api/users/all"],
  });
  const delegationMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PUT", "/api/users/me/delegation", {
        delegateToId: delegateToId ? parseInt(delegateToId) : null,
        delegateUntil: delegateUntil || null,
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error); }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users/me/delegation"] });
      toast({ title: "Delegation updated" });
      setDelegateToId("");
      setDelegateUntil("");
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  // Feature 3: Payroll export
  const [reportYear, setReportYear] = useState(String(new Date().getFullYear()));
  const [reportMonth, setReportMonth] = useState("all");
  const payrollMutation = useMutation({
    mutationFn: async () => {
      const monthParam = reportMonth !== "all" ? `&month=${reportMonth}` : "";
      const url = `/api/reports/payroll?year=${reportYear}${monthParam}`;
      const res = await apiRequest("GET", url);
      const blob = await res.blob();
      const urlObj = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = urlObj;
      a.download = reportMonth !== "all" ? `payroll_${reportYear}_${String(reportMonth).padStart(2, "0")}.csv` : `payroll_${reportYear}.csv`;
      a.click();
      URL.revokeObjectURL(urlObj);
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  // Change password
  const [pwForm, setPwForm] = useState({ current: "", newPw: "", confirm: "" });
  const pwMutation = useMutation({
    mutationFn: async () => {
      if (pwForm.newPw !== pwForm.confirm) throw new Error("Passwords do not match");
      if (pwForm.newPw.length < 8) throw new Error("Password must be at least 8 characters");
      const res = await apiRequest("POST", "/api/auth/change-password", { currentPassword: pwForm.current, newPassword: pwForm.newPw });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error); }
    },
    onSuccess: () => { setPwForm({ current: "", newPw: "", confirm: "" }); toast({ title: "Password updated" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  // Carry-over management (admin)
  const currentYear = new Date().getFullYear();
  const [coUserId, setCoUserId] = useState("");
  const [coDays, setCoDays] = useState("5");
  const [coYear, setCoYear] = useState(String(currentYear - 1));

  const { data: allUsers = [] } = useQuery<any[]>({ queryKey: ["/api/users/all"], enabled: user?.role === "admin" });
  const { data: allowances = [] } = useQuery<any[]>({ queryKey: [`/api/allowances?year=${currentYear}`], enabled: user?.role === "admin" });

  const coMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/allowances/carry-over", {
        userId: parseInt(coUserId),
        fromYear: parseInt(coYear),
        days: parseFloat(coDays),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error); }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/allowances`] });
      toast({ title: "Carry-over applied successfully" });
      setCoUserId(""); setCoDays("5");
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  // Edit allowance
  const [editAllow, setEditAllow] = useState<any>(null);
  const [editDays, setEditDays] = useState("");
  const [editCarried, setEditCarried] = useState("");
  const allowMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PUT", `/api/allowances/${editAllow.userId}/${currentYear}`, {
        totalDays: parseFloat(editDays),
        carriedOverDays: parseFloat(editCarried) || 0,
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error); }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/allowances`] });
      toast({ title: "Allowance updated" });
      setEditAllow(null);
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const enrichedAllowances = allowances.map((a: any) => {
    const u = (allUsers as any[]).find((u: any) => u.id === a.userId);
    return { ...a, user: u };
  }).filter((a: any) => a.user);

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground text-sm mt-1">Manage your account and platform settings</p>
      </div>

      <Tabs defaultValue={user?.role === "admin" ? "admin" : "account"}>
        <TabsList className="w-full">
          <TabsTrigger value="account" className="flex-1">My Account</TabsTrigger>
          {user?.role === "admin" && <TabsTrigger value="admin" className="flex-1">Admin</TabsTrigger>}
        </TabsList>

        <TabsContent value="account" className="mt-6 space-y-5">
          {/* Feature 4: Editable Profile card */}
          <Card>
            <CardHeader><CardTitle className="text-base">Profile</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>First name</Label>
                  <Input value={profileForm.firstName} onChange={(e) => setProfileForm((f) => ({ ...f, firstName: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Last name</Label>
                  <Input value={profileForm.lastName} onChange={(e) => setProfileForm((f) => ({ ...f, lastName: e.target.value }))} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input type="tel" value={profileForm.phone} onChange={(e) => setProfileForm((f) => ({ ...f, phone: e.target.value }))} placeholder="Optional" />
              </div>
              <div className="space-y-2">
                <Label>Emergency contact name</Label>
                <Input value={profileForm.emergencyContact} onChange={(e) => setProfileForm((f) => ({ ...f, emergencyContact: e.target.value }))} placeholder="Optional" />
              </div>
              <div className="space-y-2">
                <Label>Emergency contact phone</Label>
                <Input type="tel" value={profileForm.emergencyContactPhone} onChange={(e) => setProfileForm((f) => ({ ...f, emergencyContactPhone: e.target.value }))} placeholder="Optional" />
              </div>
              <div className="text-sm text-muted-foreground space-y-1 pt-2">
                <div><strong>Email:</strong> {user?.email}</div>
                <div><strong>Role:</strong> {user?.role}</div>
                <div><strong>Country:</strong> {COUNTRY_FLAG[user?.country || ""] || ""} {user?.country}</div>
                <p className="text-xs italic pt-1">Contact admin to change email, role, or country.</p>
              </div>
              <Button disabled={profileMutation.isPending} onClick={() => profileMutation.mutate()}>
                {profileMutation.isPending ? "Saving..." : "Save Profile"}
              </Button>
            </CardContent>
          </Card>

          {/* Feature 2: Approval Delegation */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Approval Delegation</CardTitle>
              <CardDescription>While you are away, delegate your leave approvals to a colleague.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {delegationData?.delegateTo ? (
                <div className="space-y-4">
                  <div className="rounded-md bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-800 px-3 py-2">
                    <p className="text-sm text-green-800 dark:text-green-300">
                      <CheckCircle2 size={14} className="inline mr-1" />
                      Your approvals are delegated to <strong>{delegationData.delegateTo.firstName} {delegationData.delegateTo.lastName}</strong> until {delegationData.delegateUntil}
                    </p>
                  </div>
                  <Button variant="outline" onClick={() => { setDelegateToId(""); setDelegateUntil(""); delegationMutation.mutate(); }}>
                    Clear Delegation
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Delegate to</Label>
                    <Select value={delegateToId} onValueChange={setDelegateToId}>
                      <SelectTrigger><SelectValue placeholder="Select colleague" /></SelectTrigger>
                      <SelectContent>
                        {(allUsersForDelegate as any[]).filter((u: any) => u.id !== user?.id && u.isActive).map((u: any) => (
                          <SelectItem key={u.id} value={String(u.id)}>{u.firstName} {u.lastName}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Until (date)</Label>
                    <input type="date" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={delegateUntil} onChange={(e) => setDelegateUntil(e.target.value)} />
                  </div>
                  <Button disabled={delegationMutation.isPending || !delegateToId || !delegateUntil} onClick={() => delegationMutation.mutate()}>
                    {delegationMutation.isPending ? "Saving..." : "Set Delegation"}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Change password */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Change Password</CardTitle>
              <CardDescription>Use a strong password of at least 8 characters</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2"><Label>Current password</Label><Input type="password" value={pwForm.current} onChange={(e) => setPwForm((f) => ({ ...f, current: e.target.value }))} data-testid="input-current-password" /></div>
              <div className="space-y-2"><Label>New password</Label><Input type="password" value={pwForm.newPw} onChange={(e) => setPwForm((f) => ({ ...f, newPw: e.target.value }))} data-testid="input-new-password" /></div>
              <div className="space-y-2"><Label>Confirm new password</Label><Input type="password" value={pwForm.confirm} onChange={(e) => setPwForm((f) => ({ ...f, confirm: e.target.value }))} data-testid="input-confirm-new-password" /></div>
              <Button disabled={pwMutation.isPending || !pwForm.current || !pwForm.newPw || !pwForm.confirm} onClick={() => pwMutation.mutate()} data-testid="button-change-password">
                {pwMutation.isPending ? "Updating..." : "Update Password"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {user?.role === "admin" && (
          <TabsContent value="admin" className="mt-6 space-y-5">
            {/* Feature 3: Payroll Export */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Payroll Export</CardTitle>
                <CardDescription>Download approved leave data as CSV for payroll processing</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Year</Label>
                    <Select value={reportYear} onValueChange={setReportYear}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {[String(new Date().getFullYear() - 1), String(new Date().getFullYear()), String(new Date().getFullYear() + 1)].map((y) => (
                          <SelectItem key={y} value={y}>{y}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Month (optional)</Label>
                    <Select value={reportMonth} onValueChange={setReportMonth}>
                      <SelectTrigger><SelectValue placeholder="All months" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All months</SelectItem>
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => (
                          <SelectItem key={m} value={String(m)}>{new Date(2024, m - 1).toLocaleString("en", { month: "long" })}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button disabled={payrollMutation.isPending} onClick={() => payrollMutation.mutate()}>
                  {payrollMutation.isPending ? "Downloading..." : "Download CSV"}
                </Button>
              </CardContent>
            </Card>

            {/* Carry-over */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Apply Carry-Over</CardTitle>
                <CardDescription>Carry unused days from a previous year into the next year for a team member.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Team member</Label>
                  <Select value={coUserId} onValueChange={setCoUserId}>
                    <SelectTrigger data-testid="select-co-user"><SelectValue placeholder="Select person" /></SelectTrigger>
                    <SelectContent>
                      {(allUsers as any[]).filter((u: any) => u.isActive).map((u: any) => (
                        <SelectItem key={u.id} value={String(u.id)}>{u.firstName} {u.lastName}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>From year</Label>
                    <Select value={coYear} onValueChange={setCoYear}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {[String(currentYear - 2), String(currentYear - 1), String(currentYear)].map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Days to carry over</Label>
                    <Input type="number" min="0.5" max="25" step="0.5" value={coDays} onChange={(e) => setCoDays(e.target.value)} data-testid="input-co-days" />
                  </div>
                </div>
                <Button disabled={coMutation.isPending || !coUserId} onClick={() => coMutation.mutate()} data-testid="button-apply-carry-over">
                  {coMutation.isPending ? "Applying..." : "Apply Carry-Over"}
                </Button>
              </CardContent>
            </Card>

            {/* Edit allowances */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{new Date().getFullYear()} Allowances</CardTitle>
                <CardDescription>Adjust individual annual leave entitlements</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="divide-y divide-border">
                  {enrichedAllowances.map((a: any) => (
                    <div key={a.id} className="flex items-center justify-between py-3 gap-4">
                      <span className="text-sm font-medium">{a.user.firstName} {a.user.lastName}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-muted-foreground">{a.totalDays} days + {a.carriedOverDays} carried</span>
                        <Button variant="outline" size="sm" onClick={() => { setEditAllow(a); setEditDays(String(a.totalDays)); setEditCarried(String(a.carriedOverDays)); }}>
                          Edit
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>

      <Dialog open={!!editAllow} onOpenChange={(o) => !o && setEditAllow(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Allowance — {editAllow?.user?.firstName} {editAllow?.user?.lastName}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Annual days for {currentYear}</Label>
                <Input type="number" min="0" max="60" step="0.5" value={editDays} onChange={(e) => setEditDays(e.target.value)} data-testid="input-edit-days" />
              </div>
              <div className="space-y-2">
                <Label>Carried-over days</Label>
                <Input type="number" min="0" max="60" step="0.5" value={editCarried} onChange={(e) => setEditCarried(e.target.value)} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditAllow(null)}>Cancel</Button>
            <Button disabled={allowMutation.isPending} onClick={() => allowMutation.mutate()}>
              {allowMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
