import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../shared/context/AuthContext';

type Mode = 'login' | 'register';

function firstApiError(details: unknown) {
  if (!details || typeof details !== 'object') return null;
  const first = Object.values(details as Record<string, unknown>)[0];
  if (Array.isArray(first)) return String(first[0]);
  return typeof first === 'string' ? first : null;
}

export default function AuthPage() {
  const [mode, setMode] = useState<Mode>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { login, register } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const redirectTo = (location.state as { from?: string } | null)?.from || '/';

  const inputCls = 'w-full border border-gray-200 bg-gray-50 rounded-xl px-4 py-2.5 text-sm text-gray-800 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!email || !password) {
      setError('Please fill in all fields.');
      return;
    }
    if (mode === 'register' && !name) {
      setError('Please enter your name.');
      return;
    }

    setLoading(true);
    try {
      if (mode === 'register') await register({ name, email, password });
      else await login(email, password);
      navigate(redirectTo, { replace: true });
    } catch (err) {
      const apiMessage = firstApiError((err as { details?: unknown }).details);
      setError(apiMessage || 'Could not connect to your account. Please check your details and try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-full bg-gray-50 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
        <div className="flex items-center gap-2 text-blue-500 font-bold text-lg mb-6">
          <span>Sahayog Hub</span>
        </div>

        <div className="flex gap-1 border-b border-gray-200 mb-6">
          {(['login', 'register'] as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => {
                setMode(m);
                setError('');
              }}
              className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px transition-colors capitalize cursor-pointer ${
                mode === m
                  ? 'text-blue-500 border-blue-500'
                  : 'text-gray-400 border-transparent hover:text-gray-600'
              }`}
            >
              {m}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {mode === 'register' && (
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-gray-700">Full Name</label>
              <input
                type="text"
                placeholder="Full name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={inputCls}
              />
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-700">Email</label>
            <input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputCls}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-700">Password</label>
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputCls}
            />
          </div>

          {error && (
            <p className="text-xs text-red-500 font-medium">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-500 hover:bg-blue-600 active:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white text-sm font-semibold py-2.5 rounded-xl transition-colors duration-150 mt-1 cursor-pointer"
          >
            {loading ? 'Please wait...' : mode === 'login' ? 'Log In' : 'Create Account'}
          </button>
        </form>

        <p className="text-xs text-gray-400 text-center mt-5">
          {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}
          {' '}
          <button
            onClick={() => {
              setMode(mode === 'login' ? 'register' : 'login');
              setError('');
            }}
            className="text-blue-500 font-medium hover:underline cursor-pointer"
          >
            {mode === 'login' ? 'Register' : 'Log In'}
          </button>
        </p>
      </div>
    </div>
  );
}
