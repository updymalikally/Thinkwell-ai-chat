"use client";

import { useEffect, useState } from "react";
import { authClient } from "@/lib/auth-client";

export default function ResetPassword() {
  const [token, setToken] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const resetToken = params.get("token") || "";
    setToken(resetToken);
    if (!resetToken || params.has("error")) {
      setError("This reset link is invalid or has expired. Request a new one.");
    }
  }, []);

  async function submit(data: FormData) {
    const newPassword = String(data.get("password") || "");
    if (!token) return setError("This reset link is missing or invalid. Request a new one.");
    if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#]).{8,128}$/.test(newPassword)) {
      return setError("Use 8–128 characters with an uppercase letter, a lowercase letter, a number, and a symbol (@, $, !, %, *, ?, &, or #).");
    }
    if (newPassword !== String(data.get("confirm") || "")) return setError("The passwords do not match.");
    setBusy(true); setError(""); setNotice("");
    try {
      const result = await authClient.resetPassword({ newPassword, token });
      if (result.error) setError(result.error.message || "This reset link may have expired. Request a new one.");
      else setNotice("Your password has been updated. You can now sign in.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not update the password."); }
    finally { setBusy(false); }
  }

  return <main className="auth-page"><div className="auth-card"><div className="brand auth-brand"><span className="brand-mark"><i/><i/><i/></span><span>Thinkwell<span className="brand-dot">.</span></span></div><div className="auth-eyebrow">ACCOUNT RECOVERY</div><h1>Choose a new<br/><em>password.</em></h1><p>Use 8–128 characters with upper and lowercase letters, a number, and a symbol.</p><form action={(data) => void submit(data)} className="auth-form"><label>New password<input name="password" type="password" autoComplete="new-password" minLength={8} maxLength={128} required placeholder="New password"/></label><label>Confirm password<input name="confirm" type="password" autoComplete="new-password" minLength={8} maxLength={128} required placeholder="Repeat password"/></label>{error && <div className="error-note" role="alert">{error}</div>}{notice && <div className="success-note" role="status">{notice}</div>}<button className="auth-submit" disabled={busy || !token}>{busy ? "Updating…" : "Update password"}<span>→</span></button></form><div className="auth-switch"><a href="/">Back to sign in</a></div></div></main>;
}
