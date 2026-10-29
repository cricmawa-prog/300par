'use client';

import { usePathname } from 'next/navigation';
import { SOCIAL_LINKS } from '../../lib/socialLinks';
import { OPEN_EVENT } from './FollowUs';

// Pages that fill the screen exactly (or are focused flows) skip the footer; they get the floating
// "Follow us" button from FollowUs instead.
const NO_FOOTER = ['/300par', '/dashboard', '/signin', '/signup'];

export default function Footer() {
    const pathname = usePathname();
    if (NO_FOOTER.some((r) => pathname === r || pathname.startsWith(`${r}/`))) return null;

    return (
        <footer className="border-t border-border bg-bg px-4 py-5">
            <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
                <p className="text-xs text-textMuted text-center sm:text-left">
                    SRH fan site · made by fans, for fans · Cricmawa
                </p>

                <div className="flex items-center gap-3">
                    <button
                        onClick={() => window.dispatchEvent(new Event(OPEN_EVENT))}
                        className="flex items-center gap-2 rounded-full border border-border bg-surface pl-1 pr-3.5 py-1 hover:border-accent transition-colors"
                    >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src="/images/cricmawa_logo.png" alt="" width={28} height={28} className="w-7 h-7 rounded-full" />
                        <span className="text-xs font-semibold text-text">Follow us</span>
                    </button>

                    <div className="flex items-center gap-1.5">
                        {SOCIAL_LINKS.map((l) => (
                            <a
                                key={l.key}
                                href={l.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                aria-label={l.label}
                                title={l.label}
                                className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm opacity-90 hover:opacity-100 hover:scale-110 transition"
                                style={{ background: l.bg }}
                            >
                                <i className={l.icon} aria-hidden />
                            </a>
                        ))}
                    </div>
                </div>
            </div>
        </footer>
    );
}
