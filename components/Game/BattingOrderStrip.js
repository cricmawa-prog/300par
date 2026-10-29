'use client';

import { useEffect, useRef } from 'react';
import { Plus } from 'lucide-react';
import { TOTAL_SLOTS, slotLabel } from '../../lib/game/positions';

function initials(name) {
    return name
        .split(' ')
        .map((part) => part[0])
        .join('')
        .slice(0, 2)
        .toUpperCase();
}

// Batting-order list (slots 1-11). While a player is selected, the slots they can fill are
// highlighted and clickable; filled slots show avatar, name, season and ratings. `compact`
// is a two-column, name-only variant for read-only views (the opponent's XI in a duel).
export default function BattingOrderStrip({ filled, eligibleSlots, onSlotClick, compact = false }) {
    const slots = Array.from({ length: TOTAL_SLOTS }, (_, i) => i + 1);
    const eligible = new Set(eligibleSlots || []);
    const wrapRef = useRef(null);
    const eligibleKey = [...eligible].join(',');

    // When a player is selected, scroll the slot list so the open slots are visible (the list
    // scrolls inside its panel); when the selection clears, scroll back to the top.
    useEffect(() => {
        const wrap = wrapRef.current;
        const scroller = wrap?.parentElement;
        if (!scroller || scroller.scrollHeight <= scroller.clientHeight) return;
        let top = 0;
        if (eligibleKey) {
            const first = wrap.querySelector('[data-eligible="true"]');
            if (first) {
                const offset = first.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop;
                top = Math.max(0, offset - 8);
            }
        }
        scroller.scrollTo({ top, behavior: 'smooth' });
    }, [eligibleKey]);

    return (
        <div ref={wrapRef} className={compact ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-1.5' : 'flex flex-col gap-1.5'}>
            {slots.map((slot) => {
                const pick = filled[slot];
                const isEligible = eligible.has(slot) && !pick;
                return (
                    <button
                        key={slot}
                        type="button"
                        disabled={!isEligible}
                        data-eligible={isEligible}
                        onClick={() => onSlotClick(slot)}
                        className={`flex items-center rounded-xl border text-left transition-colors w-full
                            ${compact ? 'gap-2 px-2 py-1 min-h-[34px]' : 'gap-3 px-3 py-1.5 min-h-[44px]'}
                            ${pick ? 'border-border bg-bg/60' : 'border-border bg-bg/40'}
                            ${isEligible ? 'cursor-pointer border-win bg-win/10 hover:bg-win/20' : 'cursor-default'}
                            ${!isEligible && !pick ? 'opacity-70' : ''}`}
                    >
                        <span
                            className={`shrink-0 rounded-full bg-border text-text font-display flex items-center justify-center
                                ${compact ? 'w-5 h-5 text-[10px]' : 'w-6 h-6 text-xs'}`}
                        >
                            {slot}
                        </span>
                        {!compact && <span className="shrink-0 w-[4.5rem] text-[11px] leading-tight text-textMuted">{slotLabel(slot)}</span>}

                        {pick ? (
                            <>
                                <span
                                    className={`shrink-0 rounded-full bg-accentMuted border border-accent/30 text-accent font-display flex items-center justify-center
                                        ${compact ? 'w-6 h-6 text-[9px]' : 'w-8 h-8 text-[11px]'}`}
                                >
                                    {initials(pick.player.name)}
                                </span>
                                <span className="min-w-0 flex-1">
                                    <span className={`block font-semibold text-text truncate ${compact ? 'text-xs' : 'text-sm leading-tight'}`}>
                                        {pick.player.name}
                                    </span>
                                    {!compact && <span className="block text-[11px] leading-tight text-textMuted">{pick.year}</span>}
                                </span>
                                {!compact && (
                                    <span className="shrink-0 flex gap-2.5 text-xs font-display">
                                        <span className="text-sky-400">BAT {pick.player.BAT}</span>
                                        <span className="text-win">POW {pick.player.POW}</span>
                                    </span>
                                )}
                            </>
                        ) : (
                            <>
                                <span
                                    className={`shrink-0 rounded-full flex items-center justify-center
                                        ${compact ? 'w-6 h-6' : 'w-8 h-8'}
                                        ${isEligible ? 'bg-accent text-white' : 'bg-accentMuted text-accent'}`}
                                >
                                    <Plus size={compact ? 12 : 15} strokeWidth={3} />
                                </span>
                                <span className={`${compact ? 'text-xs' : 'text-sm'} ${isEligible ? 'text-win font-semibold' : 'text-textMuted'}`}>
                                    {isEligible ? 'Place here' : compact ? '—' : 'Select player'}
                                </span>
                            </>
                        )}
                    </button>
                );
            })}
        </div>
    );
}
