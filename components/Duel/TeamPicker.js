'use client';

import { Check } from 'lucide-react';

// Four franchise tiles instead of a pre-filled dropdown, so nobody ends up on a team they
// didn't choose. Nothing is selected until the player taps one (value === null).
export default function TeamPicker({ teams, value, onChange, label = 'Pick your franchise' }) {
    return (
        <div className="flex flex-col gap-2">
            <p className="text-xs text-textMuted uppercase tracking-wide">{label}</p>
            <div role="radiogroup" aria-label={label} className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {teams.map((t) => {
                    const selected = value === t.code;
                    return (
                        <button
                            key={t.code}
                            type="button"
                            role="radio"
                            aria-checked={selected}
                            onClick={() => onChange(t.code)}
                            style={{ borderColor: selected ? t.color : undefined, backgroundColor: selected ? t.colorMuted : undefined }}
                            className={`relative flex flex-col items-start gap-1 rounded-xl border-2 px-3 py-2.5 text-left transition-colors
                                ${selected ? '' : 'border-border bg-bg/50 hover:bg-surfaceHover'}`}
                        >
                            <span className="flex items-center gap-2">
                                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: t.color }} />
                                <span className="font-display text-text text-lg leading-none">{t.code}</span>
                            </span>
                            <span className="text-[11px] leading-tight text-textMuted">{t.name}</span>
                            {selected && (
                                <span
                                    className="absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center text-white"
                                    style={{ backgroundColor: t.color }}
                                >
                                    <Check size={12} strokeWidth={3} />
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
