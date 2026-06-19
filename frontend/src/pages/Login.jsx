import React, { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { formatApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FileSignature } from "lucide-react";
import { toast } from "sonner";

const AUTH_IMAGE =
  "https://images.unsplash.com/photo-1656259145847-81bcdac8f0f3?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2ODh8MHwxfHNlYXJjaHwxfHxjbGVhbiUyMGVtcHR5JTIwZGVzayUyMHdvcmtzcGFjZSUyMHdoaXRlfGVufDB8fHx8MTc4MTg3Nzc1Nnww&ixlib=rb-4.1.0&q=85";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const onSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await login(email, password);
      const to = location.state?.from?.pathname || "/app";
      toast.success("Welcome back");
      navigate(to, { replace: true });
    } catch (err) {
      const msg = formatApiError(err);
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid md:grid-cols-2 bg-white" style={{ fontFamily: "'Inter', sans-serif" }}>
      <div className="flex items-center justify-center px-6 py-12 md:py-0">
        <div className="w-full max-w-sm space-y-10">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-md bg-zinc-950 flex items-center justify-center">
              <FileSignature className="h-4 w-4 text-white" />
            </div>
            <span className="text-lg font-semibold tracking-tight" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Inksign</span>
          </div>
          <div className="space-y-2">
            <h1 className="text-3xl tracking-tight font-semibold" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Sign in</h1>
            <p className="text-sm text-zinc-500">Send and sign documents in seconds.</p>
          </div>
          <form onSubmit={onSubmit} className="space-y-5" data-testid="login-form">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm">Email</Label>
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                data-testid="login-email-input"
                className="h-11"
                placeholder="you@company.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm">Password</Label>
              <Input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                data-testid="login-password-input"
                className="h-11"
                placeholder="••••••••"
              />
            </div>
            {error && <div className="text-sm text-red-600" data-testid="login-error">{error}</div>}
            <Button
              type="submit"
              disabled={loading}
              className="w-full h-11 bg-zinc-950 hover:bg-zinc-800 text-white shadow-none"
              data-testid="login-submit-button"
            >
              {loading ? "Signing in…" : "Sign in"}
            </Button>
          </form>
          <p className="text-sm text-zinc-500">
            Don&apos;t have an account?{" "}
            <Link to="/register" className="text-zinc-950 font-medium underline underline-offset-4" data-testid="login-register-link">
              Create one
            </Link>
          </p>
        </div>
      </div>
      <div
        className="hidden md:block bg-cover bg-center"
        style={{ backgroundImage: `url(${AUTH_IMAGE})` }}
        aria-hidden="true"
      />
    </div>
  );
}
