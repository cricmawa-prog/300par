'use client';

import { useEffect, useRef, useState } from 'react';
import SeasonPlayerCard from './SeasonPlayerCard';

const FILTERS = [
    { key: 'all', label: 'All', test: () => true },
    { key: 'bat', label: 'Batsmen', test: (p) => p.role === 'Batsman' },
    { key: 'bowl', label: 'Bowlers', test: (p) => p.role === 'Bowler' },
    { key: 'ar', label: 'All-rounders', test: (p) => p.role === 'All-rounder' },
    { key: 'wk', label: 'WK', test: (p) => p.isKeeper || (p.role || '').includes('Wicketkeeper') },
];

// Role filter chips + the season's player grid. getState(player) returns { disabled, reason }
// so solo and duel can each apply their own pick rules.
export default function SquadPanel({ squad, year, selectedPlayer, getState, onSelect }) {
    const [filter, setFilter] = useState('all');
    const listRef = useRef(null);

    // New season / filter -> start the list from the top.
    useEffect(() => {
        listRef.current?.scrollTo({ top: 0 });
    }, [year, filter]);
    const active = FILTERS.find((f) => f.key === filter) || FILTERS[0];
    const visible = squad.filter(active.test);

    return (
        <>
            <div className="flex flex-wrap gap-2">
                {FILTERS.map((f) => (
                    <button
                        key={f.key}
                        type="button"
                        onClick={() => setFilter(f.key)}
                        className={`px-3.5 py-1.5 rounded-lg border text-[13px] font-semibold transition-colors
                            ${filter === f.key ? 'bg-accent text-white border-accent' : 'border-white/20 bg-bg/60 text-white/90 hover:text-white hover:border-accent/70'}`}
                    >
                        {f.label}
                    </button>
                ))}
            </div>

            {visible.length === 0 ? (
                <p className="text-sm text-textMuted text-center py-6">No players in this squad match that filter.</p>
            ) : (
                <div
                    ref={listRef}
                    className="grid gap-2.5 grid-cols-[repeat(auto-fill,minmax(210px,1fr))] content-start overflow-y-auto overscroll-contain no-scrollbar max-h-[50vh] lg:max-h-none lg:flex-1 lg:min-h-0"
                >
                    {visible.map((player) => {
                        const { disabled, reason } = getState(player);
                        return (
                            <SeasonPlayerCard
                                key={player.name}
                                player={player}
                                year={year}
                                selected={selectedPlayer?.name === player.name}
                                disabled={disabled}
                                disabledReason={reason}
                                onSelect={onSelect}
                            />
                        );
                    })}
                </div>
            )}
        </>
    );
}
