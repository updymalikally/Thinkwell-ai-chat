export default function SetupRequired() {
  return <main className="auth-page"><section className="auth-card setup-card">
    <div className="brand auth-brand"><span className="brand-mark"><i/><i/><i/></span><span>Thinkwell<span className="brand-dot">.</span></span></div>
    <div className="auth-eyebrow">ONE QUICK SETUP</div>
    <h1>Connect your<br/><em>workspace.</em></h1>
    <p>Thinkwell needs your Neon database settings before you can sign in.</p>
    <ol className="setup-steps">
      <li>In the project folder, copy <code>.env.example</code> to <code>.env.local</code>.</li>
      <li>Paste your Neon connection string into <code>DATABASE_URL</code>.</li>
      <li>Add a long random value for <code>BETTER_AUTH_SECRET</code>.</li>
      <li>Stop and restart the dev server.</li>
    </ol>
    <div className="setup-code"><span>DATABASE_URL=</span>postgresql://…neon.tech/…</div>
    <p className="setup-note">Once configured, this page will take you to sign in or create an account.</p>
  </section></main>;
}
