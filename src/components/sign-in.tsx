"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";

export default function SignIn() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function signInWithGoogle() {
    setBusy(true); setError("");
    try {
      const result = await authClient.signIn.social({ provider: "google", callbackURL: "/" });
      if (result.error) {
        setError(result.error.message || "Google sign-in failed. Please try again.");
        setBusy(false);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not start Google sign-in. Please try again.");
      setBusy(false);
    }
  }
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
  return <main className="auth-page"><div className="auth-card"><div className="brand auth-brand"><span className="brand-mark"><i/><i/><i/></span><span>Thinkwell<span className="brand-dot">.</span></span></div><div className="auth-eyebrow">A LITTLE SPACE TO THINK</div><h1>{mode === "signin" ? <>Good to have<br/><em>you back.</em></> : <>A fresh start<br/><em>begins here.</em></>}</h1><p>Sign in to keep your conversations close.</p><button className="google-submit" type="button" onClick={() => void signInWithGoogle()} disabled={busy}><svg aria-hidden="true" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.67 9.5 24 9.5Z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.25 5.48-4.73 7.17l7.56 5.87c4.41-4.07 7.21-10.07 7.21-17.51Z"/><path fill="#FBBC05" d="M10.53 28.59a14.36 14.36 0 0 1 0-9.18l-7.98-6.19a23.95 23.95 0 0 0 0 21.56l7.98-6.19Z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.91-5.78l-7.56-5.87c-2.1 1.41-4.78 2.25-8.35 2.25-6.33 0-11.57-4.22-13.46-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48Z"/></svg>{busy ? "Connecting to Google…" : "Continue with Google"}</button><div className="auth-divider"><span>or continue with email</span></div><form action={(data) => void submit(data)} className="auth-form">{mode === "signup" && <label>Your name<input name="name" autoComplete="name" required placeholder="How should we call you?"/></label>}<label>Email address<input name="email" type="email" autoComplete="email" required placeholder="you@example.com"/></label><label>Password<input name="password" type="password" autoComplete={mode === "signin" ? "current-password" : "new-password"} minLength={8} required placeholder="At least 8 characters"/></label>{error && <div className="error-note">{error}</div>}<button className="auth-submit" disabled={busy}>{busy ? "One moment…" : mode === "signin" ? "Sign in" : "Create account"}<span>→</span></button></form><div className="auth-switch">{mode === "signin" ? "New to Thinkwell?" : "Already have an account?"} <button onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setError(""); }}>{mode === "signin" ? "Create an account" : "Sign in"}</button></div><div className="auth-foot">Your conversations are private and saved to your account.</div></div></main>;
}
