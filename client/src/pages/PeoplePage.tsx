import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { UserPlus, Copy, CheckCircle2, Edit2, UserX, Link2, ShieldCheck, Clock, Search } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

// "none" is used as sentinel for Select — avoids wouter treating value="" as /# route
const NONE = "none";

const COUNTRY_OPTIONS = [
  { code: "CZ", label: "🇨🇿 Czech Republic" },
  { code: "PL", label: "🇵🇱 Poland" },
  { code: "MC", label: "🇲🇨 Monaco" },
  { code: "RO", label: "🇷🇴 Romania" },
  { code: "SK", label: "🇸🇰 Slovakia" },
  { code: "AT", label: "🇦🇹 Austria" },
  { code: "DE", label: "🇩🇪 Germany" },
  { code: "FR", label: "🇫🇷 France" },
  { code: "GB", label: "🇬🇧 United Kingdom" },
];

const COUNTRY_FLAG: Record<string, string> = {
  CZ: "🇨🇿", PL: "🇵🇱", MC: "🇲🇨", RO: "🇷🇴",
  SK: "🇸🇰", AT: "🇦🇹", DE: "🇩🇪", FR: "🇫🇷", GB: "🇬🇧",
};

const ROLE_COLOR: Record<string, string> = {
  admin: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  manager: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  employee: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
};

interface User {
  id: number; firstName: string; lastName: string; email: string;
  role: string; country: string; department: string | null;
  jobTitle: string | null; managerId: number | null; isActive: boolean;
  inviteToken?: string | null;
  hasPassword?: boolean;
  lastLoginAt?: string | null;
}

function UserFormFields({
  form, setForm, users, isInvite,
}: {
  form: any; setForm: (f: any) => void; users: User[]; isInvite?: boolean;
}) {
  const managers = users.filter((u) => u.role === "admin" || u.role === "manager");

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>First name</Label>
          <Input
            value={form.firstName ?? ""}
            onChange={(e) => setForm((f: any) => ({ ...f, firstName: e.target.value }))}
            placeholder="Jane" required data-testid="input-first-name"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Last name</Label>
          <Input
            value={form.lastName ?? ""}
            onChange={(e) => setForm((f: any) => ({ ...f, lastName: e.target.value }))}
            placeholder="Smith" required data-testid="input-last-name"
          />
        </div>
      </div>

      {isInvite && (
        <div className="space-y-1.5">
          <Label>Email address</Label>
          <Input
            type="email" value={form.email ?? ""}
            onChange={(e) => setForm((f: any) => ({ ...f, email: e.target.value }))}
            placeholder="jane@lucentrenewables.com" required data-testid="input-email"
          />
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Role</Label>
          <Select
            value={form.role ?? "employee"}
            onValueChange={(v) => setForm((f: any) => ({ ...f, role: v }))}
          >
            <SelectTrigger data-testid="select-role"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="employee">Employee</SelectItem>
              <SelectItem value="manager">Manager</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Country</Label>
          <Select
            value={form.country ?? "CZ"}
            onValueChange={(v) => setForm((f: any) => ({ ...f, country: v }))}
          >
            <SelectTrigger data-testid="select-country"><SelectValue /></SelectTrigger>
            <SelectContent>
              {COUNTRY_OPTIONS.map((c) => (
                <SelectItem key={c.code} value={c.code}>{c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Department</Label>
          <Input
            value={form.department ?? ""}
            onChange={(e) => setForm((f: any) => ({ ...f, department: e.target.value }))}
            placeholder="e.g. Operations"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Job title</Label>
          <Input
            value={form.jobTitle ?? ""}
            onChange={(e) => setForm((f: any) => ({ ...f, jobTitle: e.target.value }))}
            placeholder="e.g. Analyst"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Line manager (approves their leave)</Label>
        {/* Use NONE sentinel to avoid wouter treating value="" as a route */}
        <Select
          value={form.managerId ? String(form.managerId) : NONE}
          onValueChange={(v) => setForm((f: any) => ({ ...f, managerId: v === NONE ? null : v }))}
        >
          <SelectTrigger data-testid="select-manager"><SelectValue placeholder="None" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>— No manager —</SelectItem>
            {managers.map((m) => (
              <SelectItem key={m.id} value={String(m.id)}>
                {m.firstName} {m.lastName} ({m.role})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label>Employment start date <span className="text-muted-foreground font-normal">(for pro-rata calculation)</span></Label>
        <input
          type="date"
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          value={form.startDate ?? ""}
          onChange={(e) => setForm((f: any) => ({ ...f, startDate: e.target.value || null }))}
        />
        <p className="text-xs text-muted-foreground">Leave blank for full entitlement. If set, allowance is calculated pro-rata from this date.</p>
      </div>

      {isInvite && (
        <div className="space-y-1.5">
          <Label>Full-year annual leave entitlement ({new Date().getFullYear()})</Label>
          <Input
            type="number" min="0" max="60" step="1"
            value={form.totalDays ?? "25"}
            onChange={(e) => setForm((f: any) => ({ ...f, totalDays: e.target.value }))}
            data-testid="input-total-days"
          />
          <p className="text-xs text-muted-foreground">Full-year entitlement. If a start date is set above, the actual allowance will be pro-rated automatically.</p>
        </div>
      )}
    </div>
  );
}

export default function PeoplePage() {
  const { toast } = useToast();

  const [inviteOpen, setInviteOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [inviteResult, setInviteResult] = useState<any>(null);
  const [copied, setCopied] = useState(false);
  // Link dialog — for generating/showing access links for existing users
  const [linkDialog, setLinkDialog] = useState<{ user: User; token: string } | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  // Deactivate confirmation
  const [deactivateTarget, setDeactivateTarget] = useState<User | null>(null);
  // Search filter
  const [searchQuery, setSearchQuery] = useState("");
  // Allowance editing state (loaded when edit dialog opens)
  const [editAllowance, setEditAllowance] = useState<{
    usedDays: string; pendingDays: string; totalDays: string; carriedOverDays: string;
  } | null>(null);

  const emptyInvite = {
    email: "", firstName: "", lastName: "", role: "employee",
    country: "CZ", department: "", jobTitle: "", managerId: null, totalDays: "25",
    startDate: null as string | null,
  };
  const [inviteForm, setInviteForm] = useState(emptyInvite);
  const [editForm, setEditForm] = useState<any>({});

  const { data: users = [], isLoading } = useQuery<User[]>({ queryKey: ["/api/users/all"] });
  const active = users.filter((u) => u.isActive);
  const currentYear = new Date().getFullYear();

  const filteredActive = active.filter((u) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      `${u.firstName} ${u.lastName}`.toLowerCase().includes(q) ||
      u.country.toLowerCase().includes(q) ||
      (u.department || "").toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q)
    );
  });

  // Fetch allowance for the user being edited
  const { data: editUserAllowanceData } = useQuery<any>({
    queryKey: ["/api/allowances", editUser?.id, currentYear],
    enabled: !!editUser,
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/allowances?year=${currentYear}`);
      const all = await res.json();
      return all.find((a: any) => a.userId === editUser?.id) ?? null;
    },
  });

  const saveAllowanceMutation = useMutation({
    mutationFn: async () => {
      if (!editUser || !editAllowance) return;
      // Update total + carried (Settings-style endpoint)
      const res1 = await apiRequest("PUT", `/api/allowances/${editUser.id}/${currentYear}`, {
        totalDays: parseFloat(editAllowance.totalDays) || 0,
        carriedOverDays: parseFloat(editAllowance.carriedOverDays) || 0,
      });
      if (!res1.ok) { const e = await res1.json(); throw new Error(e.error); }
      // Update used + pending (People-style endpoint)
      const res2 = await apiRequest("PUT", `/api/allowances/${editUser.id}/${currentYear}/used`, {
        usedDays: parseFloat(editAllowance.usedDays) || 0,
        pendingDays: parseFloat(editAllowance.pendingDays) || 0,
      });
      if (!res2.ok) { const e = await res2.json(); throw new Error(e.error); }
      return res2.json();
    },
    onError: (e: any) => toast({ title: "Error saving allowance", description: e.message, variant: "destructive" }),
  });

  const inviteMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/users/invite", {
        ...inviteForm,
        managerId: inviteForm.managerId ? parseInt(String(inviteForm.managerId)) : null,
        totalDays: parseInt(String(inviteForm.totalDays)),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error); }
      return res.json();
    },
    onSuccess: (u) => {
      queryClient.invalidateQueries({ queryKey: ["/api/users/all"] });
      setInviteResult(u);
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const editMutation = useMutation({
    mutationFn: async () => {
      if (!editUser) return;
      const res = await apiRequest("PUT", `/api/users/${editUser.id}`, {
        firstName: editForm.firstName,
        lastName: editForm.lastName,
        role: editForm.role,
        country: editForm.country,
        department: editForm.department || null,
        jobTitle: editForm.jobTitle || null,
        managerId: editForm.managerId ? parseInt(String(editForm.managerId)) : null,
        isActive: true,
        startDate: editForm.startDate || null,
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error); }
      // Also save allowance adjustments if changed
      if (editAllowance) await saveAllowanceMutation.mutateAsync();
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users/all"] });
      queryClient.invalidateQueries({ queryKey: ["/api/allowances"] });
      setEditOpen(false);
      setEditUser(null);
      setEditAllowance(null);
      toast({ title: "Profile updated" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const resendInviteMutation = useMutation({
    mutationFn: async (userId: number) => {
      const res = await apiRequest("POST", `/api/users/${userId}/resend-invite`);
      if (!res.ok) { const e = await res.json(); throw new Error(e.error); }
      return res.json() as Promise<{ inviteToken: string }>;
    },
    onSuccess: (data, userId) => {
      queryClient.invalidateQueries({ queryKey: ["/api/users/all"] });
      const u = active.find((x) => x.id === userId);
      if (u) setLinkDialog({ user: u, token: data.inviteToken });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deactivateMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/users/${id}`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users/all"] });
      toast({ title: "User deactivated" });
    },
  });

  // Sync allowance data into edit form when it loads
  useEffect(() => {
    if (editUserAllowanceData && editOpen) {
      setEditAllowance({
        usedDays: String(editUserAllowanceData.usedDays ?? 0),
        pendingDays: String(editUserAllowanceData.pendingDays ?? 0),
        totalDays: String(editUserAllowanceData.totalDays ?? 25),
        carriedOverDays: String(editUserAllowanceData.carriedOverDays ?? 0),
      });
    }
  }, [editUserAllowanceData, editOpen]);

  const openEdit = (u: User) => {
    setEditUser(u);
    setEditForm({
      firstName: u.firstName,
      lastName: u.lastName,
      role: u.role,
      country: u.country,
      department: u.department || "",
      jobTitle: u.jobTitle || "",
      managerId: u.managerId ?? null,
      startDate: (u as any).startDate ?? null,
    });
    // Will be populated once editUserAllowanceData loads
    setEditAllowance(null);
    setEditOpen(true);
  };

  const openInvite = () => {
    setInviteResult(null);
    setInviteForm(emptyInvite);
    setInviteOpen(true);
  };

  const copyLink = (token: string) => {
    const url = `${window.location.origin}/#/accept-invite?token=${token}`;
    navigator.clipboard.writeText(url).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const copyLinkForDialog = (token: string) => {
    const url = `${window.location.origin}/#/accept-invite?token=${token}`;
    navigator.clipboard.writeText(url).catch(() => {});
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  const inviteLinkUrl = (token: string) =>
    `${window.location.origin}/#/accept-invite?token=${token}`;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">People</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage team members and invite new people</p>
        </div>
        <Button onClick={openInvite} data-testid="button-invite">
          <UserPlus size={16} className="mr-2" />
          Invite Person
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <CardTitle className="text-base">{active.length} Active Team Member{active.length !== 1 ? "s" : ""}</CardTitle>
            <div className="relative w-full sm:w-64">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search name, country, department…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-9 text-sm"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">{[1,2,3].map(i=><div key={i} className="h-14 bg-muted rounded-lg animate-pulse"/>)}</div>
          ) : filteredActive.length === 0 ? (
            <p className="text-muted-foreground text-sm py-4 text-center">
              {searchQuery ? "No team members match your search." : "No team members yet."}
            </p>
          ) : (
            <div className="divide-y divide-border">
              {filteredActive.map((u) => {
                const initials = `${u.firstName[0]}${u.lastName[0]}`.toUpperCase();
                const manager = users.find((m) => m.id === u.managerId);
                return (
                  <div key={u.id} className="py-3" data-testid={`people-row-${u.id}`}>
                    <div className="flex items-start gap-3">
                      <Avatar className="h-9 w-9 flex-shrink-0 mt-0.5">
                        <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">{initials}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-medium text-sm">{u.firstName} {u.lastName}</span>
                          <span className="text-base" title={u.country}>{COUNTRY_FLAG[u.country] || u.country}</span>
                          <span className={`status-badge ${ROLE_COLOR[u.role]}`}>{u.role}</span>
                          {u.inviteToken ? (
                            <span className="status-badge bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">Pending invite</span>
                          ) : u.hasPassword ? (
                            <span className="status-badge bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 flex items-center gap-1">
                              <ShieldCheck size={11} /> Active
                            </span>
                          ) : (
                            <span className="status-badge bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400">Not logged in</span>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5 break-all">
                          {u.email}
                          {u.jobTitle && ` · ${u.jobTitle}`}
                          {u.department && ` · ${u.department}`}
                          {manager && ` · Reports to ${manager.firstName} ${manager.lastName}`}
                        </div>
                      </div>
                      {/* Action buttons — always right-aligned, never wrapping to new line */}
                      <div className="flex gap-0.5 flex-shrink-0 items-center">
                        {u.inviteToken && (
                          <Button variant="outline" size="sm" onClick={() => copyLink(u.inviteToken!)} data-testid={`button-copy-${u.id}`} className="hidden sm:flex">
                            {copied ? <CheckCircle2 size={13} className="text-green-500 mr-1" /> : <Copy size={13} className="mr-1" />}
                            <span className="text-xs">Copy</span>
                          </Button>
                        )}
                        <Button
                          variant="ghost" size="sm"
                          className="text-muted-foreground hover:text-primary h-8 w-8 p-0"
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); resendInviteMutation.mutate(u.id); }}
                          disabled={resendInviteMutation.isPending}
                          data-testid={`button-link-${u.id}`}
                          title="Generate access / password-reset link"
                        >
                          <Link2 size={15} />
                        </Button>
                        <Button
                          variant="ghost" size="sm"
                          className="h-8 w-8 p-0"
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); openEdit(u); }}
                          data-testid={`button-edit-${u.id}`}
                          title="Edit user"
                        >
                          <Edit2 size={15} />
                        </Button>
                        <Button
                          variant="ghost" size="sm"
                          className="text-muted-foreground hover:text-destructive h-8 w-8 p-0"
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); setDeactivateTarget(u); }}
                          data-testid={`button-deactivate-${u.id}`}
                          title="Deactivate user"
                        >
                          <UserX size={15} />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Invite Dialog ─────────────────────────────────────────────────────── */}
      <Dialog open={inviteOpen} onOpenChange={(o) => { setInviteOpen(o); if (!o) setInviteResult(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Invite a new team member</DialogTitle>
          </DialogHeader>
          {inviteResult ? (
            <div className="space-y-4 pt-2">
              <Alert className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/20">
                <CheckCircle2 size={16} className="text-green-600" />
                <AlertDescription className="text-green-800 dark:text-green-300">
                  Invite created for <strong>{inviteResult.email}</strong>. Share the link below:
                </AlertDescription>
              </Alert>
              <div className="flex gap-2">
                <Input
                  readOnly
                  value={`${window.location.origin}/#/accept-invite?token=${inviteResult.inviteToken}`}
                  className="text-xs font-mono"
                />
                <Button size="sm" variant="outline" onClick={() => copyLink(inviteResult.inviteToken)}>
                  {copied ? <CheckCircle2 size={14} className="text-green-500" /> : <Copy size={14} />}
                </Button>
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <Button variant="outline" onClick={() => { setInviteResult(null); setInviteForm(emptyInvite); }}>
                  Invite another
                </Button>
                <Button onClick={() => setInviteOpen(false)}>Done</Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4 pt-2">
              <UserFormFields form={inviteForm} setForm={setInviteForm} users={active} isInvite />
              <div className="flex justify-end gap-2 pt-1">
                <Button variant="outline" onClick={() => setInviteOpen(false)}>Cancel</Button>
                <Button
                  onClick={() => inviteMutation.mutate()}
                  disabled={inviteMutation.isPending || !inviteForm.email || !inviteForm.firstName || !inviteForm.lastName}
                  data-testid="button-send-invite"
                >
                  {inviteMutation.isPending ? "Creating invite…" : "Create Invite"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Edit Dialog ───────────────────────────────────────────────────────── */}
      {/* ── Access Link Dialog ──────────────────────────────────────────────── */}
      <Dialog open={!!linkDialog} onOpenChange={(o) => { if (!o) { setLinkDialog(null); setLinkCopied(false); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Link2 size={16} className="text-primary" />
              Access link — {linkDialog?.user.firstName} {linkDialog?.user.lastName}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-1">
            <p className="text-sm text-muted-foreground">
              Share this link with <strong>{linkDialog?.user.firstName}</strong>. They can use it to set their password and log in for the first time (or reset a forgotten password). The link expires in 7 days.
            </p>
            <div className="flex gap-2">
              <input
                readOnly
                value={linkDialog ? inviteLinkUrl(linkDialog.token) : ""}
                className="flex-1 px-3 py-2 text-xs font-mono rounded-md border border-input bg-muted text-foreground focus:outline-none"
                onFocus={(e) => e.target.select()}
              />
              <Button size="sm" variant="outline" onClick={() => linkDialog && copyLinkForDialog(linkDialog.token)}>
                {linkCopied ? <CheckCircle2 size={14} className="text-green-500" /> : <Copy size={14} />}
              </Button>
            </div>
            <div className="flex justify-end">
              <Button onClick={() => { setLinkDialog(null); setLinkCopied(false); }}>Done</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Deactivate Confirmation ───────────────────────────────────────────── */}
      <AlertDialog open={!!deactivateTarget} onOpenChange={(o) => !o && setDeactivateTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate {deactivateTarget?.firstName} {deactivateTarget?.lastName}?</AlertDialogTitle>
            <AlertDialogDescription>
              They will be removed from the active team list and will no longer be able to log in. This can be reversed by contacting a database administrator.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90 text-white"
              onClick={() => { if (deactivateTarget) { deactivateMutation.mutate(deactivateTarget.id); setDeactivateTarget(null); } }}
            >
              Deactivate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={editOpen} onOpenChange={(o) => { setEditOpen(o); if (!o) { setEditUser(null); setEditAllowance(null); } }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Edit {editUser?.firstName} {editUser?.lastName}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            {/* Last login info */}
            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/40 rounded-md px-3 py-2">
              <Clock size={13} />
              {editUser?.lastLoginAt
                ? <span>Last login: <strong>{new Date(editUser.lastLoginAt).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</strong></span>
                : <span>This user has not logged in yet</span>
              }
            </div>

            <UserFormFields
              form={editForm}
              setForm={setEditForm}
              users={active.filter((u) => u.id !== editUser?.id)}
            />

            {/* Allowance override — admin only */}
            <div className="border rounded-md p-3 space-y-3 bg-muted/20">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Annual leave allowance ({new Date().getFullYear()}) — manual override</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Annual entitlement (days)</Label>
                  <Input
                    type="number" min="0" max="365" step="0.5"
                    value={editAllowance?.totalDays ?? (editUserAllowanceData?.totalDays ?? "")}
                    onChange={(e) => setEditAllowance((a) => ({
                      totalDays: e.target.value,
                      carriedOverDays: a?.carriedOverDays ?? String(editUserAllowanceData?.carriedOverDays ?? 0),
                      usedDays: a?.usedDays ?? String(editUserAllowanceData?.usedDays ?? 0),
                      pendingDays: a?.pendingDays ?? String(editUserAllowanceData?.pendingDays ?? 0),
                    }))}
                    placeholder="25"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Carried-over days</Label>
                  <Input
                    type="number" min="0" max="365" step="0.5"
                    value={editAllowance?.carriedOverDays ?? (editUserAllowanceData?.carriedOverDays ?? "")}
                    onChange={(e) => setEditAllowance((a) => ({
                      totalDays: a?.totalDays ?? String(editUserAllowanceData?.totalDays ?? 25),
                      carriedOverDays: e.target.value,
                      usedDays: a?.usedDays ?? String(editUserAllowanceData?.usedDays ?? 0),
                      pendingDays: a?.pendingDays ?? String(editUserAllowanceData?.pendingDays ?? 0),
                    }))}
                    placeholder="0"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Used days</Label>
                  <Input
                    type="number" min="0" max="365" step="0.5"
                    value={editAllowance?.usedDays ?? (editUserAllowanceData?.usedDays ?? "")}
                    onChange={(e) => setEditAllowance((a) => ({
                      totalDays: a?.totalDays ?? String(editUserAllowanceData?.totalDays ?? 25),
                      carriedOverDays: a?.carriedOverDays ?? String(editUserAllowanceData?.carriedOverDays ?? 0),
                      usedDays: e.target.value,
                      pendingDays: a?.pendingDays ?? String(editUserAllowanceData?.pendingDays ?? 0),
                    }))}
                    placeholder="0"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Pending days</Label>
                  <Input
                    type="number" min="0" max="365" step="0.5"
                    value={editAllowance?.pendingDays ?? (editUserAllowanceData?.pendingDays ?? "")}
                    onChange={(e) => setEditAllowance((a) => ({
                      totalDays: a?.totalDays ?? String(editUserAllowanceData?.totalDays ?? 25),
                      carriedOverDays: a?.carriedOverDays ?? String(editUserAllowanceData?.carriedOverDays ?? 0),
                      usedDays: a?.usedDays ?? String(editUserAllowanceData?.usedDays ?? 0),
                      pendingDays: e.target.value,
                    }))}
                    placeholder="0"
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">Directly overrides allowance counters. Use to correct figures that were seeded rather than booked through the platform.</p>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
              <Button
                onClick={() => editMutation.mutate()}
                disabled={editMutation.isPending}
                data-testid="button-save-edit"
              >
                {editMutation.isPending ? "Saving…" : "Save changes"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
