import { useState, type FormEvent } from "react";
import { lovable } from "@/integrations/lovable";
import { LovableMark } from "@lovable.dev/cloud-auth-js/react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type SkillSwapAuthDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAuthenticated: () => void;
};

export function SkillSwapAuthDialog({ open, onOpenChange, onAuthenticated }: SkillSwapAuthDialogProps) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  function finish() {
    onOpenChange(false);
    onAuthenticated();
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    setBusy(true);
    try {
      const result = mode === "signup"
        ? await supabase.auth.signUp({
          email,
          password,
          options: { data: { display_name: name.trim() || email.split("@")[0] } },
        })
        : await supabase.auth.signInWithPassword({ email, password });
      if (result.error) throw result.error;
      if (result.data.session) {
        finish();
      } else {
        setNotice("Check your email to confirm your account. You can sign in here once it is verified.");
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "We couldn't complete that. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function socialSignIn(provider: "google" | "lovable") {
    setBusy(true);
    setError("");
    try {
      const result = await lovable.auth.signInWithOAuth(provider, { redirect_uri: window.location.origin });
      if (result.error) throw result.error;
      if (result.redirected) return;
      finish();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Sign-in could not be started.");
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sw-auth-dialog">
        <DialogHeader className="sw-auth-header">
          <div className="sw-brand-mark sw-auth-mark" aria-hidden="true">↕</div>
          <DialogTitle>{mode === "signup" ? "Join SkillSwap" : "Welcome back"}</DialogTitle>
          <DialogDescription>Trade what you know for what you want to learn.</DialogDescription>
        </DialogHeader>
        <form className="sw-auth-form" onSubmit={submit}>
          {mode === "signup" && (
            <div className="sw-form-field">
              <Label htmlFor="skill-name">Your name</Label>
              <Input id="skill-name" autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Alex Morgan" />
            </div>
          )}
          <div className="sw-form-field">
            <Label htmlFor="skill-email">Email</Label>
            <Input id="skill-email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@school.edu" />
          </div>
          <div className="sw-form-field">
            <Label htmlFor="skill-password">Password</Label>
            <Input id="skill-password" type="password" autoComplete={mode === "signup" ? "new-password" : "current-password"} minLength={6} required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 6 characters" />
          </div>
          {notice && <p className="sw-auth-notice" role="status">{notice}</p>}
          {error && <p className="sw-auth-error" role="alert">{error}</p>}
          <Button className="sw-primary-button sw-auth-submit" disabled={busy} type="submit">
            {busy ? "Please wait…" : mode === "signup" ? "Create your account" : "Sign in"}
          </Button>
        </form>
        <div className="sw-auth-divider"><span>or continue with</span></div>
        <div className="sw-auth-socials">
          <Button variant="outline" className="sw-google-button" disabled={busy} onClick={() => void socialSignIn("google")} type="button">
            <svg aria-hidden="true" viewBox="0 0 24 24"><path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"/><path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"/><path fill="#FBBC05" d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z"/><path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z"/></svg>
            Continue with Google
          </Button>
          <Button variant="outline" className="sw-lovable-button" disabled={busy} onClick={() => void socialSignIn("lovable")} type="button">
            <LovableMark /> Continue with Lovable
          </Button>
        </div>
        <p className="sw-auth-switch">
          {mode === "signup" ? "Already have an account?" : "New to SkillSwap?"}{" "}
          <button type="button" onClick={() => { setMode(mode === "signup" ? "signin" : "signup"); setNotice(""); setError(""); }}>
            {mode === "signup" ? "Sign in" : "Create an account"}
          </button>
        </p>
      </DialogContent>
    </Dialog>
  );
}