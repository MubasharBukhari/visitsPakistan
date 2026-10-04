'use client';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
export function PasswordRecoveryForm({ reset = false }: { reset?: boolean }) {
  const captured = useRef(false);
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  useEffect(() => {
    if (!reset || captured.current) return;
    captured.current = true;
    const value =
      new URLSearchParams(window.location.hash.slice(1)).get('token') ?? '';
    setToken(value);
    // Keep bearer proof out of URL history and subsequent referrers.
    window.history.replaceState(null, '', window.location.pathname);
  }, [reset]);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    const data = new FormData(e.currentTarget);
    if (reset && data.get('password') !== data.get('confirmation')) {
      setError('Passwords must match.');
      return;
    }
    setBusy(true);
    try {
      const body = reset
        ? { token, password: data.get('password'), otp: data.get('otp') }
        : { email: data.get('email') };
      const response = await fetch(
        `/cms-api/auth/${reset ? 'reset-password' : 'forgot-password'}/`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(15000),
        },
      );
      const result = await response.json();
      if (!response.ok)
        throw new Error(
          result.message ?? 'Recovery unavailable. Try again shortly.',
        );
      setMessage(result.message);
      setToken('');
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'Recovery unavailable. Try again shortly.',
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="login-form" style={{ minHeight: '100vh' }}>
      <div className="login-inner">
        <span className="kicker">STAFF ACCOUNT RECOVERY</span>
        <h1>{reset ? 'Set a new password' : 'Forgot your password?'}</h1>
        <p>
          {reset
            ? 'Use a new password of at least 12 characters and a fresh code from your enrolled authenticator.'
            : 'Enter your staff email to request a recovery link. Your authenticator remains required.'}
        </p>
        {message ? (
          <p className="alert alert-success" role="status">
            {message}
          </p>
        ) : (
          <form onSubmit={submit}>
            {reset ? (
              <>
                {!token && (
                  <p className="alert alert-warning" role="status">
                    Open a valid recovery link from your message. If you
                    refreshed this page, reopen that link.
                  </p>
                )}
                <label className="form-label">
                  New password
                  <input
                    className="form-control"
                    name="password"
                    type="password"
                    autoComplete="new-password"
                    minLength={12}
                    maxLength={128}
                    required
                  />
                </label>
                <label className="form-label">
                  Confirm new password
                  <input
                    className="form-control"
                    name="confirmation"
                    type="password"
                    autoComplete="new-password"
                    minLength={12}
                    maxLength={128}
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
                  />
                </label>
              </>
            ) : (
              <label className="form-label">
                Staff email
                <input
                  className="form-control"
                  name="email"
                  type="email"
                  autoComplete="username"
                  maxLength={200}
                  required
                />
              </label>
            )}
            {error && (
              <p className="alert alert-danger" role="alert">
                {error}
              </p>
            )}
            <button
              className="btn btn-primary w-100"
              disabled={busy || (reset && !token)}
            >
              {busy
                ? 'Please wait…'
                : reset
                  ? 'Update password'
                  : 'Send recovery link'}
            </button>
          </form>
        )}
        <p className="login-note">
          <Link href="/login/">Back to sign in</Link>
        </p>
        {reset && (
          <p>
            <Link href="/forgot-password/">Request a new recovery link</Link>
          </p>
        )}
        <p className="login-note">
          Lost access to your email or authenticator? Contact your platform
          administrator for identity verification.
        </p>
      </div>
    </main>
  );
}
