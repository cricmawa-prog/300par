'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useUser } from '../../lib/auth/AuthProvider';

// Any approved member without a username (e.g. a brand-new Google sign-up) is sent to pick one
// before using the app. Not-yet-approved accounts can't write a profile, so they are left alone
// (AccessGate shows them the waitlist screen). Renders nothing.
export default function ProfileGate() {
    const { isLoaded, isSignedIn, profile, member } = useUser();
    const pathname = usePathname();
    const router = useRouter();

    useEffect(() => {
        if (!isLoaded || !isSignedIn || !member || profile?.username) return;
        if (pathname.startsWith('/signup/username')) return;
        const back = pathname.startsWith('/sign') ? '/' : pathname;
        router.replace(`/signup/username?redirect_url=${encodeURIComponent(back)}`);
    }, [isLoaded, isSignedIn, member, profile?.username, pathname, router]);

    return null;
}
