'use client';

import { flavor } from '../../lib/game/commentaryText';

const EXTRA_LABELS = { wd: 'wide', nb: 'no-ball', b: 'bye', lb: 'leg-bye' };

// Extras / penalty riding on a delivery, as a short suffix.
function extrasNote(entry) {
    const extra = entry.extras ? ` (+${entry.extras} ${EXTRA_LABELS[entry.extraType] || 'extras'})` : '';
    return entry.penalty ? `${extra} (−${entry.penalty} penalty: no wicketkeeper)` : extra;
}

export function RunBadge({ entry }) {
    const cls = entry.isWicket
        ? 'bg-loss text-white'
        : entry.runs === 4 || entry.runs === 6
        ? 'bg-win text-black'
        : 'bg-white/10 text-white';
    return (
        <span className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-display text-sm ${cls}`}>
            {entry.isWicket ? 'W' : entry.runs === 0 ? '•' : entry.runs}
        </span>
    );
}

// One ball of commentary, shared by the live playback and the post-match feed. `entry` needs
// batterRuns/batterBalls (the batter's tally at that ball) for the "departs for X(Y)" line.
export default function FeedRow({ entry }) {
    const verb = entry.isWicket
        ? `OUT! ${entry.batter} departs for ${entry.batterRuns}(${entry.batterBalls}).`
        : entry.runs === 6
        ? 'SIX!'
        : entry.runs === 4
        ? 'FOUR!'
        : entry.runs === 0
        ? 'no run.'
        : `${entry.runs} run${entry.runs > 1 ? 's' : ''}.`;
    const strong = entry.isWicket ? 'text-loss' : entry.runs === 4 || entry.runs === 6 ? 'text-win' : 'text-white/90';
    return (
        <li className="flex items-center gap-3 rounded-lg border border-white/10 bg-black/30 px-3 py-1.5 text-sm">
            <span className="w-9 shrink-0 tabular-nums text-white/70">{entry.over}.{entry.ballInOver}</span>
            <RunBadge entry={entry} />
            <span className="flex-1 min-w-0 truncate text-white">
                {entry.isWicket ? (
                    <span className={`font-semibold ${strong}`}>{verb}</span>
                ) : (
                    <>
                        <span className="font-semibold">{entry.batter}</span> — <span className={`font-bold ${strong}`}>{verb}</span>
                    </>
                )}{' '}
                <span className="text-white/75 hidden sm:inline">{flavor(entry)}</span>
                <span className="text-white/60">{extrasNote(entry)}</span>
            </span>
            <span className="shrink-0 tabular-nums text-white/80">{entry.score}/{entry.wickets}</span>
        </li>
    );
}
