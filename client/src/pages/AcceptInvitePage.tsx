import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";

export default function AcceptInvitePage() {
  const [, setLocation] = useLocation();

  // With hash routing the URL is: https://host/#/accept-invite?token=xxx
  // The ?token=xxx is part of the hash fragment, NOT window.location.search.
  // wouter's useSearch() reads window.location.search which is empty here.
  // We must parse the token from window.location.hash directly.
  const hashQuery = window.location.hash.includes("?")
    ? window.location.hash.split("?")[1]
    : "";
  const token = new URLSearchParams(hashQuery).get("token") || "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) { setError("Passwords do not match"); return; }
    if (password.length < 8) { setError("Password must be at least 8 characters"); return; }
    setError(""); setLoading(true);
    try {
      const res = await apiRequest("POST", "/api/auth/accept-invite", { token, password });
      if (!res.ok) { const err = await res.json(); throw new Error(err.error || "Failed"); }
      queryClient.clear();
      setSuccess(true);
      setTimeout(() => setLocation("/"), 1500);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!token) return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-muted-foreground">Invalid invite link.</p>
    </div>
  );

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'linear-gradient(135deg, #0d1a26 0%, #0f2233 40%, #0e1e1a 100%)' }}>
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <svg viewBox="0 0 60 60" fill="none" className="w-16 h-16 mx-auto mb-2" aria-label="Lucent Renewables">
            <circle cx="30" cy="30" r="27" stroke="#2aa8c4" strokeWidth="1" fill="none" opacity="0.3"/>
            <circle cx="30" cy="30" r="21" stroke="#2aa8c4" strokeWidth="1.3" fill="none" opacity="0.5"/>
            <circle cx="30" cy="30" r="14" stroke="#2aa8c4" strokeWidth="1.6" fill="none" opacity="0.72"/>
            <circle cx="30" cy="30" r="7.5" stroke="#2aa8c4" strokeWidth="1.8" fill="none" opacity="0.92"/>
            <circle cx="30" cy="30" r="2.5" fill="#2aa8c4"/>
          </svg>
          <h1 className="text-xl font-semibold text-white tracking-[0.15em] uppercase" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>Lucent Renewables</h1>
          <p className="text-slate-400 text-sm">Welcome — set your password to get started</p>
        </div>
        <Card className="border-0 shadow-2xl">
          <CardHeader>
            <CardTitle>Create your password</CardTitle>
            <CardDescription>Choose a secure password for your account</CardDescription>
          </CardHeader>
          <CardContent>
            {success ? (
              <div className="flex flex-col items-center gap-3 py-4 text-center">
                <CheckCircle2 size={40} className="text-green-500" />
                <p className="font-medium">Account set up successfully!</p>
                <p className="text-sm text-muted-foreground">Redirecting to your dashboard...</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                  <Alert variant="destructive"><AlertCircle size={16} /><AlertDescription>{error}</AlertDescription></Alert>
                )}
                <div className="space-y-2">
                  <Label>New password</Label>
                  <Input type="password" placeholder="At least 8 characters" value={password} onChange={(e) => setPassword(e.target.value)} required data-testid="input-password" />
                </div>
                <div className="space-y-2">
                  <Label>Confirm password</Label>
                  <Input type="password" placeholder="Repeat your password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required data-testid="input-confirm-password" />
                </div>
                <Button type="submit" className="w-full" disabled={loading} data-testid="button-set-password">
                  {loading ? "Setting up..." : "Activate my account"}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
