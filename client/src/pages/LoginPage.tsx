import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

export default function LoginPage() {
  const { login, user } = useAuth();
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (user) {
    setLocation("/");
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
    } catch (err: any) {
      setError(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{
        background: "linear-gradient(135deg, #0d1a26 0%, #0f2233 40%, #0e1e1a 100%)",
      }}
    >
      <div className="w-full max-w-md space-y-8">
        {/* Lucent logo */}
        <div className="text-center space-y-4">
          <div className="flex justify-center">
            <svg viewBox="0 0 80 80" fill="none" className="w-20 h-20" aria-label="Lucent Renewables">
              <path d="M40 7 A33 33 0 1 1 7 40" stroke="#3a9ec2" strokeWidth="2.2" fill="none" strokeLinecap="round"/>
              <path d="M40 14 A26 26 0 1 1 14 40" stroke="#3a9ec2" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
              <path d="M40 21 A19 19 0 1 1 21 40" stroke="#3a9ec2" strokeWidth="2.8" fill="none" strokeLinecap="round"/>
              <path d="M40 28 A12 12 0 1 1 28 40" stroke="#3a9ec2" strokeWidth="3" fill="none" strokeLinecap="round"/>
              <path d="M40 35 A5 5 0 1 1 35 40" stroke="#3a9ec2" strokeWidth="3" fill="none" strokeLinecap="round"/>
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-[0.18em] uppercase" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
              Lucent <span className="text-[#3a9ec2]">Renewables</span>
            </h1>
            <p className="text-slate-400 text-xs tracking-[0.15em] uppercase mt-1">HR Leave Management</p>
          </div>
        </div>

        <Card className="border-0 shadow-2xl bg-white/5 backdrop-blur-sm border border-white/10 text-white">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg text-white">Sign in</CardTitle>
            <CardDescription className="text-slate-400">Enter your company email and password</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertCircle size={16} />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <div className="space-y-2">
                <Label htmlFor="email" className="text-slate-300">Email address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@lucentrenewables.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className="bg-white/10 border-white/20 text-white placeholder:text-slate-500 focus:border-cyan-400"
                  data-testid="input-email"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-slate-300">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="bg-white/10 border-white/20 text-white placeholder:text-slate-500 focus:border-cyan-400"
                  data-testid="input-password"
                />
              </div>
              <Button
                type="submit"
                className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-medium tracking-wide"
                disabled={loading}
                data-testid="button-login"
              >
                {loading ? "Signing in..." : "Sign in"}
              </Button>
            </form>
            <p className="text-center text-xs text-slate-500 mt-4">
              New to the platform? You'll receive an invite link from your administrator.
            </p>
            <p className="text-center text-xs text-slate-500 mt-2">
              Forgotten your password? Contact your administrator — they can generate a new access link for you from the People page.
            </p>
          </CardContent>
        </Card>


      </div>
    </div>
  );
}
