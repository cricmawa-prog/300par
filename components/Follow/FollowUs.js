'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { X } from 'lucide-react';
import { LINKTREE_URL, SOCIAL_LINKS } from '../../lib/socialLinks';

const SEEN_KEY = 'srh:followCardSeen';
export const OPEN_EVENT = 'srh:open-follow'; // window.dispatchEvent(new Event(OPEN_EVENT)) opens the card
export const PROMPT_EVENT = 'srh:follow-prompt'; // opens it once, ever - first time someone finishes a game

// Pages laid out to exactly fill the screen (no room for a footer): a small floating button
// is shown there instead.
const FLOATING_ROUTES = ['/300par', '/dashboard'];

function hasSeen() {
    try {
        return localStorage.getItem(SEEN_KEY) === '1';
    } catch {
        return true; // storage blocked: never auto-open (it would repeat on every visit)
    }
}
function markSeen() {
    try {
        localStorage.setItem(SEEN_KEY, '1');
    } catch {}
}

function Card({ onClose, afterGame }) {
    return (
        <div
            role="dialog"
            aria-modal="true"
            aria-label="Follow Cricmawa"
            className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
            onMouseDown={(e) => e.target === e.currentTarget && onClose()}
        >
            <div className="relative w-full max-w-md max-h-[92vh] overflow-y-auto no-scrollbar rounded-3xl border border-white/15 bg-bg shadow-2xl">
                <div aria-hidden className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-accent/30 to-transparent pointer-events-none" />
                <button
                    onClick={onClose}
                    aria-label="Close"
                    className="absolute right-3 top-3 z-10 w-8 h-8 rounded-full bg-black/40 text-white/80 hover:text-white flex items-center justify-center"
                >
                    <X size={18} />
                </button>

                <div className="relative px-5 pt-7 pb-5 flex flex-col items-center text-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src="/images/cricmawa_logo.png"
                        alt="Cricmawa"
                        width={96}
                        height={96}
                        className="w-24 h-24 rounded-full ring-4 ring-accent/60 shadow-[0_0_28px_rgba(255,107,26,0.45)]"
                    />
                    <h2 className="font-display text-2xl text-white mt-4">{afterGame ? 'Loved this game?' : 'Follow Cricmawa'}</h2>
                    <p className="text-sm text-white/75 mt-1.5 max-w-xs">
                        For more cricket updates and content, follow <span className="text-white font-semibold">Cricmawa</span>.
                    </p>

                    <ul className="w-full mt-5 flex flex-col gap-2.5">
                        {SOCIAL_LINKS.map((l) => (
                            <li key={l.key}>
                                <a
                                    href={l.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="group flex items-center gap-3 rounded-xl border border-white/12 bg-white/5 hover:bg-white/10 hover:border-accent/60 px-3 py-2.5 text-left transition-colors"
                                >
                                    <span
                                        className="w-10 h-10 rounded-full flex items-center justify-center text-white text-lg shrink-0"
                                        style={{ background: l.bg }}
                                    >
                                        <i className={l.icon} aria-hidden />
                                    </span>
                                    <span className="min-w-0 flex-1">
                                        <span className="block text-sm font-semibold text-white">{l.label}</span>
                                        <span className="block text-xs text-white/60 truncate">{l.hint}</span>
                                    </span>
                                    <span className="text-white/50 group-hover:text-accent transition-colors" aria-hidden>
                                        <i className="fa-solid fa-arrow-up-right-from-square text-xs" />
                                    </span>
                                </a>
                            </li>
                        ))}
                    </ul>

                    <a
                        href={LINKTREE_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-4 text-xs text-white/60 hover:text-accent underline underline-offset-2"
                    >
                        All links on Linktree
                    </a>
                    <button onClick={onClose} className="mt-3 text-xs text-white/50 hover:text-white">
                        Maybe later
                    </button>
                </div>
            </div>
        </div>
    );
}

// Mounted once in the root layout. Owns the card; anything can open it with the OPEN_EVENT, and the
// PROMPT_EVENT opens it the first time only. On screen-filling pages it also shows a small
// floating "Follow us" button (the footer isn't visible there).
export default function FollowUs() {
    const pathname = usePathname();
    const [open, setOpen] = useState(false);
    const [afterGame, setAfterGame] = useState(false);

    const show = useCallback((fromGame = false) => {
        markSeen();
        setAfterGame(fromGame);
        setOpen(true);
    }, []);

    useEffect(() => {
        const onOpen = () => show(false);
        const onPrompt = () => {
            if (!hasSeen()) show(true);
        };
        window.addEventListener(OPEN_EVENT, onOpen);
        window.addEventListener(PROMPT_EVENT, onPrompt);
        return () => {
            window.removeEventListener(OPEN_EVENT, onOpen);
            window.removeEventListener(PROMPT_EVENT, onPrompt);
        };
    }, [show]);

    useEffect(() => {
        if (!open) return undefined;
        const onKey = (e) => e.key === 'Escape' && setOpen(false);
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [open]);

    const floating = FLOATING_ROUTES.some((r) => pathname === r || pathname.startsWith(`${r}/`));

    return (
        <>
            {floating && !open && (
                <button
                    onClick={() => show(false)}
                    aria-label="Follow Cricmawa"
                    className="fixed left-3 bottom-3 z-30 flex items-center gap-2 rounded-full border border-white/20 bg-bg/85 backdrop-blur-md pl-1 pr-1 sm:pr-3.5 py-1 shadow-lg hover:border-accent transition-colors"
                >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/images/cricmawa_logo.png" alt="" width={32} height={32} className="w-8 h-8 rounded-full" />
                    <span className="hidden sm:inline text-xs font-semibold text-white">Follow us</span>
                </button>
            )}
            {open && <Card afterGame={afterGame} onClose={() => setOpen(false)} />}
        </>
    );
}
