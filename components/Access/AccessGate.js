'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useUser } from '../../lib/auth/AuthProvider';
import Spinner from '../Duel/Spinner';
import AccessPending from './AccessPending';

// Pages anyone may open. Everything else needs an approved member account (the home page shows
// its own signed-out / pending states).
const PUBLIC = ['/', '/signin', '/signup'];

// Private beta gate around every page: signed out -> sign in, signed in but not approved ->
// waitlist screen, /admin -> admins only. Firestore rules and the API enforce the same thing on
// the server; this just keeps people out of screens that would fail.
export default function AccessGate({ children }) {
    const pathname = usePathname();
    const router = useRouter();
    const { isLoaded, isSignedIn, member, isAdmin } = useUser();
    const open = PUBLIC.includes(pathname);

    useEffect(() => {
        if (!open && isLoaded && !isSignedIn) router.replace(`/signin?redirect_url=${encodeURIComponent(pathname)}`);
    }, [open, isLoaded, isSignedIn, pathname, router]);

    if (open) return children;
    if (!isLoaded || !isSignedIn) {
        return (
            <div className="flex justify-center py-16">
                <Spinner label="Loading…" className="text-sm text-textMuted" />
            </div>
        );
    }
    if (!member) return <AccessPending />;
    if (pathname.startsWith('/admin') && !isAdmin) {
        return <p className="text-center text-sm text-loss py-16">Admins only.</p>;
    }
    return children;
}
