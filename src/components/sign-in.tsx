"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";

export default function SignIn() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(formData: FormData) {
    setBusy(true); setError("");
    const email = String(formData.get("email") || "");
    const password = String(formData.get("password") || "");
    const name = String(formData.get("name") || "");
    try {
      const result = mode === "signin"
        ? await authClient.signIn.email({ email, password })
        : await authClient.signUp.email({ email, password, name });
      if (result.error) {
        setError(result.error.code === "INVALID_EMAIL_OR_PASSWORD"
          ? "That email and password don't match. If you're new here, create an account first."
          : result.error.message || `The request failed (${result.error.status}). Please try again.`);
        setBusy(false);
        return;
      }
      window.location.reload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not reach the sign-in service. Please try again.");
      setBusy(false);
    }
  }
  return <main className="auth-page"><div className="auth-card"><div className="brand auth-brand"><span className="brand-mark"><i/><i/><i/></span><span>Thinkwell<span className="brand-dot">.</span></span></div><div className="auth-eyebrow">A LITTLE SPACE TO THINK</div><h1>{mode === "signin" ? <>Good to have<br/><em>you back.</em></> : <>A fresh start<br/><em>begins here.</em></>}</h1><p>Sign in to keep your conversations close.</p><form action={(data) => void submit(data)} className="auth-form">{mode === "signup" && <label>Your name<input name="name" autoComplete="name" required placeholder="How should we call you?"/></label>}<label>Email address<input name="email" type="email" autoComplete="email" required placeholder="you@example.com"/></label><label>Password<input name="password" type="password" autoComplete={mode === "signin" ? "current-password" : "new-password"} minLength={8} required placeholder="At least 8 characters"/></label>{error && <div className="error-note">{error}</div>}<button className="auth-submit" disabled={busy}>{busy ? "One moment…" : mode === "signin" ? "Sign in" : "Create account"}<span>→</span></button></form><div className="auth-switch">{mode === "signin" ? "New to Thinkwell?" : "Already have an account?"} <button onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setError(""); }}>{mode === "signin" ? "Create an account" : "Sign in"}</button></div><div className="auth-foot">Your conversations are private and saved to your account.</div></div></main>;
}
