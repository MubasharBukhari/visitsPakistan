'use client';
import { useState, type FormEvent } from 'react';
import Image from 'next/image';
import { IconArrowRight, IconShieldLock } from '@tabler/icons-react';
export function LoginForm() {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const form = new FormData(e.currentTarget);
    try {
      const res = await fetch('/cms-api/auth/login/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(Object.fromEntries(form)),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? 'Sign-in failed');
      window.location.assign('/');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sign-in unavailable');
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="login-layout">
      <section className="login-story">
        <Image
          src="/brand/logo.svg"
          width={300}
          height={64}
          alt="VisitsPakistan"
          priority
        />
        <div>
          <span className="kicker">THE EDITORIAL STUDIO</span>
          <h1>
            Stories worth
            <br />
            discovering.
          </h1>
          <p>
            One shared knowledge graph.
            <br />A thousand ways to tell Pakistan’s story.
          </p>
        </div>
        <small>VisitsPakistan · Discover. Experience.</small>
      </section>
      <main className="login-form">
        <div className="login-inner">
          <IconShieldLock size={36} stroke={1.4} />
          <span className="kicker">STAFF ACCESS</span>
          <h2>Welcome to the studio</h2>
          <p>Sign in to write, review and shape what comes next.</p>
          <form onSubmit={submit}>
            <label className="form-label">
              Email
              <input
                className="form-control"
                type="email"
                name="email"
                autoComplete="username"
                required
              />
            </label>
            <label className="form-label">
              Password
              <input
                className="form-control"
                type="password"
                name="password"
                autoComplete="current-password"
                required
              />
            </label>
            <label className="form-label">
              Authenticator code
              <input
                className="form-control"
                name="otp"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                maxLength={6}
                required
                placeholder="6-digit code"
              />
            </label>
            {error && (
              <p className="alert alert-danger" role="alert">
                {error}
              </p>
            )}
            <button className="btn btn-primary w-100" disabled={busy}>
              {busy ? 'Signing in…' : 'Enter the studio'}{' '}
              <IconArrowRight size={18} />
            </button>
          </form>
          <p className="login-note">
            Access is invitation only. Contact your platform administrator if
            you need an account.
          </p>
        </div>
      </main>
    </div>
  );
}
