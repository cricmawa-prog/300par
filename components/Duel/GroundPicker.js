'use client';

import { GROUND_LIST } from '../../lib/game/grounds';

// Optional ground for a duel (beta). Only the host sees this; the joiner just sees the name.
// Tapping the selected ground again clears it = the standard duel logic.
export default function GroundPicker({ value, onChange }) {
    return (
        <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
                <p className="text-xs text-textMuted uppercase tracking-widest">Ground (optional)</p>
                <span className="px-1.5 py-0.5 rounded bg-accent text-white text-[10px] font-bold uppercase tracking-wide">Beta</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {GROUND_LIST.map((g) => {
                    const selected = value === g.key;
                    return (
                        <button
                            key={g.key}
                            type="button"
                            onClick={() => onChange(selected ? null : g.key)}
                            aria-pressed={selected}
                            className={`group relative overflow-hidden rounded-xl border-2 text-left transition-all ${
                                selected ? 'border-accent shadow-[0_0_14px_var(--accent-muted,rgba(255,107,26,0.35))]' : 'border-border hover:border-accent/60'
                            }`}
                        >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                                src={g.image}
                                alt=""
                                loading="lazy"
                                className={`w-full h-24 sm:h-20 object-cover transition-transform duration-300 ${selected ? 'scale-105' : 'group-hover:scale-105'}`}
                            />
                            <span aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent" />
                            <span className="absolute inset-x-0 bottom-0 p-2">
                                <span className="block text-sm font-display text-white leading-tight">{g.city}</span>
                                <span className="block text-[10px] leading-tight text-white/80 truncate">{g.name}</span>
                            </span>
                            {selected && (
                                <span className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-accent text-white text-[11px] flex items-center justify-center" aria-hidden>
                                    ✓
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>

            <p className="text-[11px] leading-snug text-textMuted">
                {value
                    ? `${GROUND_LIST.find((g) => g.key === value)?.blurb} `
                    : 'No ground = the standard duel scoring. '}
                <span className="text-white/70">
                    Beta: a ground changes how many runs are scored and how much the bowling attack counts. The numbers are
                    still being tuned, so matches may feel different from the standard duel.
                </span>
            </p>
        </div>
    );
}
