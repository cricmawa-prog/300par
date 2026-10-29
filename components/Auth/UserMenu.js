'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { LogOut, LayoutDashboard } from 'lucide-react';
import { useUser } from '../../lib/auth/AuthProvider';
import { signOut } from '../../lib/auth/actions';

// Avatar button + small dropdown (name, dashboard, sign out) - replaces Clerk's <UserButton />.
export default function UserMenu() {
    const { user } = useUser();
    const [open, setOpen] = useState(false);
    const ref = useRef(null);

    useEffect(() => {
        if (!open) return undefined;
        const onDown = (e) => {
            if (ref.current && !ref.current.contains(e.target)) setOpen(false);
        };
        document.addEventListener('mousedown', onDown);
        return () => document.removeEventListener('mousedown', onDown);
    }, [open]);

    if (!user) return null;
    const name = user.username || user.fullName || user.primaryEmailAddress?.emailAddress || 'Player';

    return (
        <div ref={ref} className="relative">
            <button
                onClick={() => setOpen((o) => !o)}
                aria-label="Account menu"
                className="w-9 h-9 rounded-full overflow-hidden bg-accent text-white font-semibold flex items-center justify-center ring-2 ring-transparent hover:ring-accent/60 transition"
            >
                {user.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={user.imageUrl} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                    name.slice(0, 1).toUpperCase()
                )}
            </button>
            {open && (
                <div className="absolute right-0 mt-2 w-52 rounded-xl border border-border bg-surface shadow-2xl py-1 z-30">
                    <p className="px-4 py-2 text-sm font-semibold text-text truncate border-b border-border">{name}</p>
                    <Link
                        href="/dashboard"
                        onClick={() => setOpen(false)}
                        className="flex items-center gap-2 px-4 py-2 text-sm text-text hover:bg-surfaceHover"
                    >
                        <LayoutDashboard size={16} /> Dashboard
                    </Link>
                    <button
                        onClick={() => {
                            setOpen(false);
                            signOut();
                        }}
                        className="w-full flex items-center gap-2 px-4 py-2 text-sm text-text hover:bg-surfaceHover"
                    >
                        <LogOut size={16} /> Sign out
                    </button>
                </div>
            )}
        </div>
    );
}
