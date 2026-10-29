'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Swords, Trophy, Users, Zap, ShieldCheck } from 'lucide-react';
import { useUser } from '../lib/auth/AuthProvider';
import { subscribeToMyInvites } from '../lib/tournament/client';
import WaitlistForm from '../components/Access/WaitlistForm';
import AccessPending from '../components/Access/AccessPending';
import Spinner from '../components/Duel/Spinner';

function Hero({ children }) {
    return (
        <section className="flex flex-col items-center gap-4 pt-10 md:pt-16 text-center">
            <h1 className="font-display italic leading-none flex items-end gap-3">
                <span className="pr-3 text-6xl sm:text-7xl text-transparent bg-clip-text bg-gradient-to-b from-yellow-300 via-accent to-red-600">300</span>
                <span className="text-4xl sm:text-5xl text-white pb-1">PAR</span>
            </h1>
            <p className="text-textMuted max-w-md">Draft an IPL XI from across a franchise&apos;s history, duel your friends, and now - run a full round-robin tournament.</p>
            {children}
        </section>
    );
}

function Tile({ href, icon: Icon, title, text, badge }) {
    return (
        <Link href={href} className="relative flex items-start gap-3 bg-surface border border-border rounded-xl p-4 hover:border-accent transition-colors">
            <Icon className="text-accent shrink-0 mt-0.5" size={24} />
            <div>
                <p className="font-display text-text">{title}</p>
                <p className="text-xs text-textMuted mt-1">{text}</p>
            </div>
            {badge ? <span className="absolute top-3 right-3 px-2 py-0.5 rounded-full bg-accent text-white text-[11px] font-semibold">{badge}</span> : null}
        </Link>
    );
}

function MemberHome({ uid, isAdmin }) {
    const [invites, setInvites] = useState([]);
    useEffect(() => subscribeToMyInvites(uid, setInvites, () => {}), [uid]);
    return (
        <div className="grid sm:grid-cols-2 gap-3 w-full max-w-2xl mt-4">
            <Tile href="/tournaments" icon={Trophy} title="Tournaments" text="Round robin with 4-10 friends, points table with NRR, then playoffs." badge={invites.length ? `${invites.length} invite${invites.length > 1 ? 's' : ''}` : null} />
            <Tile href="/300par/duel" icon={Swords} title="1v1 Duel" text="Draft turn by turn against a friend, then chase their score." />
            <Tile href="/300par" icon={Zap} title="Solo 300 Par" text="Draft an XI and try to chase 300." />
            <Tile href="/dashboard" icon={Users} title="Dashboard" text="Your duel history and record." />
            {isAdmin && <Tile href="/admin" icon={ShieldCheck} title="Admin" text="Waitlist approvals, invites, members." />}
        </div>
    );
}

export default function Home() {
    const { isLoaded, isSignedIn, user, member, isAdmin } = useUser();

    if (!isLoaded) {
        return (
            <div className="flex justify-center py-16">
                <Spinner label="Loading…" className="text-sm text-textMuted" />
            </div>
        );
    }
    if (isSignedIn && !member) return <AccessPending />;

    return (
        <div className="max-w-3xl mx-auto px-4 pb-16 flex flex-col items-center">
            <Hero>
                {isSignedIn ? (
                    <MemberHome uid={user.id} isAdmin={isAdmin} />
                ) : (
                    <div className="w-full max-w-sm flex flex-col gap-4 mt-4">
                        <div className="bg-surface border border-border rounded-xl p-5 flex flex-col gap-3">
                            <p className="font-display text-text">Private beta - join the waitlist</p>
                            <WaitlistForm />
                        </div>
                        <p className="text-sm text-textMuted">
                            Already approved?{' '}
                            <Link href="/signin" className="text-accent underline">
                                Sign in
                            </Link>
                        </p>
                    </div>
                )}
            </Hero>
        </div>
    );
}
