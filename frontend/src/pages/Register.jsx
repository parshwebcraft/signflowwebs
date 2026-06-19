import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { formatApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FileSignature } from "lucide-react";
import { toast } from "sonner";

const AUTH_IMAGE =
  "https://images.unsplash.com/photo-1656259145847-81bcdac8f0f3?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2ODh8MHwxfHNlYXJjaHwxfHxjbGVhbiUyMGVtcHR5JTIwZGVzayUyMHdvcmtzcGFjZSUyMHdoaXRlfGVufDB8fHx8MTc4MTg3Nzc1Nnww&ixlib=rb-4.1.0&q=85";

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const onSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await register(name, email, password);
      toast.success("Account created");
      navigate("/app", { replace: true });
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
            <h1 className="text-3xl tracking-tight font-semibold" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Create your account</h1>
            <p className="text-sm text-zinc-500">No credit card. Start signing in minutes.</p>
          </div>
          <form onSubmit={onSubmit} className="space-y-5" data-testid="register-form">
            <div className="space-y-2">
              <Label htmlFor="name">Full name</Label>
              <Input
                id="name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                data-testid="register-name-input"
                className="h-11"
                placeholder="Jane Doe"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                data-testid="register-email-input"
                className="h-11"
                placeholder="you@company.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                data-testid="register-password-input"
                className="h-11"
                placeholder="At least 6 characters"
              />
            </div>
            {error && <div className="text-sm text-red-600" data-testid="register-error">{error}</div>}
            <Button
              type="submit"
              disabled={loading}
              className="w-full h-11 bg-zinc-950 hover:bg-zinc-800 text-white shadow-none"
              data-testid="register-submit-button"
            >
              {loading ? "Creating…" : "Create account"}
            </Button>
          </form>
          <p className="text-sm text-zinc-500">
            Already have an account?{" "}
            <Link to="/login" className="text-zinc-950 font-medium underline underline-offset-4" data-testid="register-login-link">
              Sign in
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
