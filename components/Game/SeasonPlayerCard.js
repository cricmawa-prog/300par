import { Plus } from 'lucide-react';
import images from '../images.js';

function initials(name) {
    return name
        .split(' ')
        .map((part) => part[0])
        .join('')
        .slice(0, 2)
        .toUpperCase();
}

export default function SeasonPlayerCard({ player, year, selected, disabled, disabledReason, onSelect }) {
    return (
        <button
            type="button"
            disabled={disabled}
            onClick={() => onSelect(player)}
            className={`text-left card relative bg-bg/60 border rounded-xl p-2.5 flex items-center gap-3 transition-colors w-full
                ${disabled ? 'opacity-40 cursor-not-allowed border-border' : 'cursor-pointer hover:border-accent/50 hover:bg-surfaceHover'}
                ${selected ? 'border-accent bg-surfaceHover ring-1 ring-accent' : 'border-border'}`}
        >
            <div className="relative shrink-0 w-12 h-12 rounded-full bg-accentMuted border border-accent/30 text-accent font-display flex items-center justify-center text-sm">
                {initials(player.name)}
                {player.country !== 'India' && (
                    <img src={images.foreign} alt="" className="absolute -top-1 -right-1 w-4 h-4" />
                )}
            </div>

            <div className="min-w-0 flex-1 flex flex-col gap-0.5 pr-6">
                <p className="font-semibold text-text truncate">{player.name}</p>
                <p className="text-xs text-textMuted truncate">{year != null ? `${year} · ` : ''}{player.role}</p>
                <div className="flex gap-3 text-xs mt-1 font-display">
                    <span className="text-sky-400">BAT {player.BAT}</span>
                    <span className="text-win">POW {player.POW}</span>
                    {player.BWL > 0 && <span className="text-accent">BWL {player.BWL}</span>}
                </div>
                {disabled && <p className="text-[11px] text-loss mt-1">{disabledReason || 'No open slot left for this role'}</p>}
            </div>

            <span
                className={`absolute top-2.5 right-2.5 w-6 h-6 rounded-full flex items-center justify-center
                    ${disabled ? 'bg-border text-textMuted' : 'bg-accent text-white'}`}
            >
                <Plus size={14} strokeWidth={3} />
            </span>
        </button>
    );
}
