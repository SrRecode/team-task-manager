import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/useAuth';

/**
 * Shared layout for the sign in and sign up screens.
 */
export function AuthShell({ title, subtitle, children, footer }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-paper px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-plum-soft">
            Glacier Agency
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink">{title}</h1>
          <p className="mt-2 text-sm text-ink-muted">{subtitle}</p>
        </div>

        <div className="rounded-xl border border-line bg-surface p-6 shadow-sm">{children}</div>

        <p className="mt-6 text-center text-sm text-ink-muted">{footer}</p>
      </div>
    </main>
  );
}

/**
 * Renders a single field error, if the API reported one.
 */
export function FieldError({ error }) {
  if (!error) return null;
  return (
    <p role="alert" className="mt-1 text-sm text-coral">
      {error}
    </p>
  );
}

export function FormError({ error }) {
  if (!error) return null;
  return (
    <p
      role="alert"
      className="mb-4 rounded-lg border border-coral/40 bg-coral/10 px-3 py-2 text-sm text-plum"
    >
      {error}
    </p>
  );
}

export function SubmitButton({ pending, children }) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="mt-2 w-full rounded-lg bg-plum px-4 py-2.5 text-sm font-semibold text-paper transition hover:bg-plum-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-plum disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? 'Please wait…' : children}
    </button>
  );
}

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [pending, setPending] = useState(false);

  const destination = location.state?.from ?? '/';

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setFieldErrors({});
    setPending(true);

    try {
      await login({ email, password });
      navigate(destination, { replace: true });
    } catch (requestError) {
      setError(requestError.message);
      if (requestError.details) {
        setFieldErrors(
          Object.fromEntries(requestError.details.map((detail) => [detail.field, detail.message]))
        );
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthShell
      title="Sign in"
      subtitle="Manage your agency teams and their tasks in one place."
      footer={
        <>
          No account yet?{' '}
          <Link to="/register" className="font-semibold text-plum underline underline-offset-4">
            Create one
          </Link>
        </>
      }
    >
      <FormError error={error} />

      <form onSubmit={handleSubmit} noValidate>
        <div className="mb-4">
          <label htmlFor="email" className="block text-sm font-medium text-ink">
            Email address
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="mt-1 w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-plum"
          />
          <FieldError error={fieldErrors.email} />
        </div>

        <div className="mb-4">
          <label htmlFor="password" className="block text-sm font-medium text-ink">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="mt-1 w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-plum"
          />
          <FieldError error={fieldErrors.password} />
        </div>

        <SubmitButton pending={pending}>Sign in</SubmitButton>
      </form>
    </AuthShell>
  );
}

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [pending, setPending] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setFieldErrors({});
    setPending(true);

    try {
      await register({ name, email, password });
      navigate('/', { replace: true });
    } catch (requestError) {
      setError(requestError.message);
      if (requestError.details) {
        setFieldErrors(
          Object.fromEntries(requestError.details.map((detail) => [detail.field, detail.message]))
        );
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthShell
      title="Create your account"
      subtitle="You will be able to create teams and assign tasks straight away."
      footer={
        <>
          Already registered?{' '}
          <Link to="/login" className="font-semibold text-plum underline underline-offset-4">
            Sign in
          </Link>
        </>
      }
    >
      <FormError error={error} />

      <form onSubmit={handleSubmit} noValidate>
        <div className="mb-4">
          <label htmlFor="name" className="block text-sm font-medium text-ink">
            Full name
          </label>
          <input
            id="name"
            name="name"
            type="text"
            autoComplete="name"
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="mt-1 w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-plum"
          />
          <FieldError error={fieldErrors.name} />
        </div>

        <div className="mb-4">
          <label htmlFor="email" className="block text-sm font-medium text-ink">
            Email address
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="mt-1 w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-plum"
          />
          <FieldError error={fieldErrors.email} />
        </div>

        <div className="mb-4">
          <label htmlFor="password" className="block text-sm font-medium text-ink">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="mt-1 w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-plum"
          />
          <p className="mt-1 text-xs text-ink-muted">At least 8 characters.</p>
          <FieldError error={fieldErrors.password} />
        </div>

        <SubmitButton pending={pending}>Create account</SubmitButton>
      </form>
    </AuthShell>
  );
}
