'use client';

import { useMemo, useState } from 'react';
import FeedRow from './FeedRow';

// Single forward pass to attach each ball's batter with their cumulative runs(balls) at that
// point (for the "departs for X(Y)" line) and to snapshot the score + not-out batters at the
// end of every over (for the over-header line) - both need running tallies as the log plays
// out, which the raw ballLog doesn't carry on its own.
function annotate(ballLog) {
    const tally = {};
    const annotated = [];
    const overSnapshots = {};

    ballLog.forEach((entry, i) => {
        if (!tally[entry.batter]) tally[entry.batter] = { runs: 0, balls: 0, out: false };
        tally[entry.batter].balls++;
        if (entry.isWicket) tally[entry.batter].out = true;
        else tally[entry.batter].runs += entry.runs;

        annotated.push({ ...entry, batterRuns: tally[entry.batter].runs, batterBalls: tally[entry.batter].balls });

        const next = ballLog[i + 1];
        const isLastBallOfOver = !next || next.over !== entry.over;
        if (isLastBallOfOver) {
            const notOut = Object.entries(tally)
                .filter(([, t]) => !t.out)
                .map(([name, t]) => ({ name, runs: t.runs, balls: t.balls }));
            overSnapshots[entry.over] = { score: entry.score, wickets: entry.wickets, batters: notOut.slice(-2) };
        }
    });

    return { annotated, overSnapshots };
}

// Groups the flat ballLog into overs, newest over (and newest ball within it) first,
// matching how a live commentary feed reads.
function groupByOver(annotated) {
    const overs = [];
    for (const entry of annotated) {
        let group = overs[entry.over];
        if (!group) {
            group = { over: entry.over, balls: [] };
            overs[entry.over] = group;
        }
        group.balls.push(entry);
    }
    return overs.filter(Boolean).reverse();
}

const isKeyMoment = (e) => e.isWicket || e.runs === 4 || e.runs === 6;

export default function CommentaryFeed({ ballLog }) {
    const [tab, setTab] = useState('full'); // 'full' | 'moments'
    const { annotated, overSnapshots } = useMemo(() => annotate(ballLog), [ballLog]);
    const overs = useMemo(() => groupByOver(annotated), [annotated]);
    const moments = useMemo(() => annotated.filter(isKeyMoment).reverse(), [annotated]);

    return (
        <div className="flex flex-col gap-3">
            <div className="inline-flex self-start rounded-xl bg-black/40 p-1">
                {[
                    { key: 'full', label: 'Full Commentary' },
                    { key: 'moments', label: 'Key Moments' },
                ].map((t) => (
                    <button
                        key={t.key}
                        type="button"
                        onClick={() => setTab(t.key)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                            tab === t.key ? 'bg-accent text-white' : 'text-white/80 hover:text-white'
                        }`}
                    >
                        {t.label}
                    </button>
                ))}
            </div>

            <div className="max-h-[28rem] no-scrollbar overflow-y-auto flex flex-col gap-4 pr-1">
                {tab === 'moments' ? (
                    moments.length === 0 ? (
                        <p className="text-sm text-white/70 text-center py-4">No boundaries or wickets.</p>
                    ) : (
                        <ul className="flex flex-col gap-1.5">
                            {moments.map((entry) => (
                                <FeedRow key={`${entry.over}.${entry.ballInOver}`} entry={entry} />
                            ))}
                        </ul>
                    )
                ) : (
                    overs.map((group) => {
                        const snap = overSnapshots[group.over];
                        return (
                            <div key={group.over}>
                                <div className="flex justify-between items-baseline mb-1.5 px-1">
                                    <p className="text-xs text-white/70 uppercase tracking-widest">Over {group.over + 1}</p>
                                    {snap && (
                                        <p className="text-xs text-white/70 tabular-nums">
                                            {snap.score}/{snap.wickets}
                                            {snap.batters.length > 0 && (
                                                <span className="ml-2 hidden sm:inline">
                                                    {snap.batters.map((b) => `${b.name} ${b.runs}(${b.balls})`).join(', ')}
                                                </span>
                                            )}
                                        </p>
                                    )}
                                </div>
                                <ul className="flex flex-col gap-1.5">
                                    {group.balls.slice().reverse().map((entry) => (
                                        <FeedRow key={entry.ballInOver} entry={entry} />
                                    ))}
                                </ul>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}
