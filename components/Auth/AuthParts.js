'use client';

import { useSearchParams } from 'next/navigation';
import { Eye, EyeOff } from 'lucide-react';
import { useState } from 'react';

// Where to go after signing in: ?redirect_url=/some/path (same-site paths only), default "/".
export function useRedirectTarget() {
    const params = useSearchParams();
    const raw = params.get('redirect_url') || params.get('redirect') || '/';
    return safeInternalPath(raw);
}

// Only ever redirect to a path on THIS site. A value like "//evil.com", "/\\evil.com" or "https://evil.com"
// would otherwise bounce someone to an attacker's page right after they sign in (phishing).
export function safeInternalPath(raw) {
    if (typeof raw !== 'string' || !raw.startsWith('/') || raw.startsWith('//') || raw.includes('\\')) return '/';
    try {
        const url = new URL(raw, window.location.origin);
        if (url.origin !== window.location.origin) return '/';
        return url.pathname + url.search + url.hash;
    } catch {
        return '/';
    }
}

export function GoogleButton({ onClick, disabled, label = 'Continue with Google' }) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            className="w-full flex items-center justify-center gap-3 py-2.5 rounded-lg border border-border bg-bg text-text font-semibold hover:border-accent transition-colors disabled:opacity-60"
        >
            <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
                <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.5l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z" />
                <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.6 5.9c4.4-4.1 7-10.1 7-17.6z" />
                <path fill="#FBBC05" d="M10.5 28.7c-.5-1.5-.8-3-.8-4.7s.3-3.2.8-4.7l-7.9-6.1C.9 16.4 0 20.1 0 24s.9 7.6 2.6 10.8l7.9-6.1z" />
                <path fill="#34A853" d="M24 48c6.3 0 11.6-2.1 15.5-5.7l-7.6-5.9c-2.1 1.4-4.8 2.3-7.9 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z" />
            </svg>
            {label}
        </button>
    );
}

export function Divider({ children = 'or' }) {
    return (
        <div className="flex items-center gap-3 text-xs text-textMuted uppercase tracking-widest my-1">
            <span className="flex-1 h-px bg-border" />
            {children}
            <span className="flex-1 h-px bg-border" />
        </div>
    );
}

export function Field({ label, type = 'text', value, onChange, autoComplete, placeholder, hint, required = true }) {
    const [show, setShow] = useState(false);
    const isPassword = type === 'password';
    return (
        <label className="flex flex-col gap-1 text-left">
            <span className="text-sm font-medium text-text">{label}</span>
            <span className="relative">
                <input
                    type={isPassword && show ? 'text' : type}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    autoComplete={autoComplete}
                    placeholder={placeholder}
                    required={required}
                    className="w-full bg-bg border border-border rounded-lg px-3 py-2.5 text-text placeholder:text-textMuted/60 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent"
                />
                {isPassword && (
                    <button
                        type="button"
                        onClick={() => setShow((s) => !s)}
                        aria-label={show ? 'Hide password' : 'Show password'}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-textMuted hover:text-text"
                    >
                        {show ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                )}
            </span>
            {hint && <span className="text-xs text-textMuted">{hint}</span>}
        </label>
    );
}

export function SubmitButton({ busy, children }) {
    return (
        <button
            type="submit"
            disabled={busy}
            className="w-full py-2.5 rounded-lg bg-accent hover:bg-accentHover text-white font-semibold transition-colors disabled:opacity-60"
        >
            {busy ? 'Please wait…' : children}
        </button>
    );
}
