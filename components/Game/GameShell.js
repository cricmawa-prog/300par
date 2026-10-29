'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Trophy, Users, Zap } from 'lucide-react';
import DraftGame from './DraftGame';

function StatChip({ icon: Icon, value, label }) {
    return (
        <div className="flex items-center gap-3 rounded-xl border border-border bg-black/40 backdrop-blur-sm px-4 py-3">
            <Icon className="text-accent shrink-0" size={26} />
            <div>
                <p className="font-display text-text text-lg leading-none">{value}</p>
                <p className="text-xs text-textMuted mt-1">{label}</p>
            </div>
        </div>
    );
}

// Full-screen background + hero. Once a franchise is picked the big hero collapses to a slim
// title bar so the two draft panels (and the score screens) start near the top of the page.
export default function GameShell({ teams, seasonSquadsByTeam, seasonCount }) {
    const [activeTeam, setActiveTeam] = useState(null);
    const [vivid, setVivid] = useState(false); // brighter backdrop while the live simulation plays
    const active = !!activeTeam;

    // Team backgrounds live in /public/images/background as {code}_bg_desktop.png / {code}_bg_mobile.png.
    // The SRH image is layered underneath, so a team whose image isn't added yet falls back to it.
    const code = (activeTeam || 'srh').toLowerCase();
    const bgVars = {
        '--bg-d': `url('/images/background/${code}_bg_desktop.png'), url('/images/background/srh_bg_desktop.png')`,
        '--bg-m': `url('/images/background/${code}_bg_mobile.png'), url('/images/background/srh_bg_mobile.png')`,
    };

    useEffect(() => {
        document.documentElement.classList.add('no-scrollbar');
        return () => document.documentElement.classList.remove('no-scrollbar');
    }, []);

    return (
        <div className="relative min-h-[calc(100vh-4rem)]">
            <div
                aria-hidden
                style={bgVars}
                className="fixed inset-0 z-0 bg-cover bg-no-repeat bg-[position:70%_center] md:bg-[position:88%_center] bg-[image:var(--bg-m)] md:bg-[image:var(--bg-d)]"
            />
            <div
                aria-hidden
                className={`fixed inset-0 z-0 bg-gradient-to-b ${
                    vivid ? 'from-black/15 via-black/20 to-bg/60' : 'from-black/50 via-bg/60 to-bg/90'
                }`}
            />

            <div className="relative z-10 max-w-6xl mx-auto px-3 sm:px-6 pb-8">
                {active ? (
                    <div className="flex items-center justify-between gap-3 py-3">
                        <h1 className="font-display italic leading-none flex items-end gap-2">
                            <span className="text-3xl pr-1.5 text-transparent bg-clip-text bg-gradient-to-b from-yellow-300 via-accent to-red-600">300</span>
                            <span className="text-xl text-white pb-0.5">PAR</span>
                        </h1>
                        <div className="flex items-center gap-2">
                            <Link
                                href="/300par/leaderboard"
                                className="px-3 py-2 rounded-lg border border-white/25 bg-bg/60 text-white text-sm font-semibold hover:border-accent transition-colors"
                            >
                                🏆 Leaderboard
                            </Link>
                            <Link
                                href="/300par/duel"
                                className="px-4 py-2 rounded-lg bg-accent hover:bg-accentHover text-white text-sm font-semibold transition-colors"
                            >
                                Try 1v1 Duel →
                            </Link>
                        </div>
                    </div>
                ) : (
                    <section className="flex flex-col gap-5 pt-8 md:pt-12 mb-8 md:mb-10">
                        <h1 className="font-display italic leading-none flex items-end gap-3 sm:gap-4">
                            <span className="pr-3 sm:pr-4 text-6xl sm:text-7xl md:text-8xl text-transparent bg-clip-text bg-gradient-to-b from-yellow-300 via-accent to-red-600 drop-shadow-[0_0_18px_rgba(255,107,26,0.45)]">
                                300
                            </span>
                            <span className="text-4xl sm:text-5xl md:text-6xl text-white pb-1">PAR</span>
                        </h1>
                        <p className="text-sm sm:text-base md:text-lg font-semibold text-white max-w-xl [text-shadow:0_1px_10px_rgba(0,0,0,0.85)]">
                            Pick a franchise, draft its best XI from across its history, one season at a time. Fill all 11
                            spots, then simulate the chase. No team has ever scored 300 in a T20 innings — can yours?
                        </p>

                        <div className="flex flex-wrap items-center justify-between gap-4">
                            <div className="flex flex-wrap gap-3">
                                <StatChip icon={Trophy} value={teams.length} label={teams.length === 1 ? 'Franchise' : 'Franchises'} />
                                <StatChip icon={Users} value={seasonCount} label="Seasons of Players" />
                                <StatChip icon={Zap} value={300} label="The Target" />
                            </div>
                            <div className="flex flex-wrap items-center gap-3">
                                <Link
                                    href="/300par/leaderboard"
                                    className="px-6 py-3 rounded-xl border border-white/25 bg-bg/60 text-white font-semibold hover:border-accent transition-colors"
                                >
                                    🏆 Leaderboard
                                </Link>
                                <Link
                                    href="/300par/duel"
                                    className="px-6 py-3 rounded-xl bg-accent hover:bg-accentHover text-white font-semibold transition-colors shadow-lg shadow-accent/30"
                                >
                                    Try 1v1 Duel →
                                </Link>
                            </div>
                        </div>
                    </section>
                )}

                <DraftGame teams={teams} seasonSquadsByTeam={seasonSquadsByTeam} onActiveChange={(code, playing) => {
                        setActiveTeam(code);
                        setVivid(!!playing);
                    }} />
            </div>
        </div>
    );
}
