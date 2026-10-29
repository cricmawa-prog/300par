'use client';

import { useEffect, useState } from 'react';
import { slotLabel } from '../../lib/game/positions';
import CommentaryFeed from './CommentaryFeed';
import LeaderboardSave from './LeaderboardSave';
import { PROMPT_EVENT } from '../Follow/FollowUs';

// Glass card shared with the live playback so the result reads as part of the same screen.
const GLASS = 'rounded-2xl border border-white/15 bg-bg/70 backdrop-blur-md';

export default function ScoreBoard({ battingOrder, result, bestScore, onPlayAgain, resultText, leaderboardEntry }) {
    const [showCommentary, setShowCommentary] = useState(false);

    // The first time anyone reaches a result screen, offer the "Loved this game? Follow us" card
    // (FollowUs shows it once ever, tracked in localStorage). A short pause lets the result land first.
    useEffect(() => {
        const t = setTimeout(() => window.dispatchEvent(new Event(PROMPT_EVENT)), 2500);
        return () => clearTimeout(t);
    }, []);

    return (
        <div className="flex flex-col gap-4">
            <div
                className={`relative overflow-hidden text-center p-5 sm:p-6 ${GLASS} ${
                    result.won ? 'border-win/70' : 'border-loss/70'
                }`}
            >
                <span aria-hidden className={`absolute inset-0 ${result.won ? 'bg-win/10' : 'bg-loss/10'}`} />
                <div className="relative">
                    <p className="text-[11px] text-white/70 uppercase tracking-widest mb-1">Final Score</p>
                    <p className={`font-display text-5xl sm:text-6xl leading-none ${result.won ? 'text-win' : 'text-loss'}`}>
                        {result.finalScore}/{result.wickets} <span className="text-lg text-white/70">({result.oversUsed} ov)</span>
                    </p>
                    <p className="mt-3 font-semibold text-white">
                        {resultText ||
                            (result.won
                                ? `Impossible? Not for this XI. ${result.target} chased down.`
                                : `Fell short of the ${result.target} par score.`)}
                    </p>
                    {bestScore != null && <p className="text-xs text-white/70 mt-2">Your best: {bestScore}/300</p>}
                </div>
            </div>

            {leaderboardEntry && <LeaderboardSave entry={leaderboardEntry} />}

            <div className={`${GLASS} p-3 sm:p-5`}>
                <div className="flex items-center gap-3 mb-3">
                    <span className="w-1 h-6 rounded-full bg-accent" />
                    <h3 className="font-display text-white text-base sm:text-lg">Scorecard</h3>
                </div>
                <div className="flex flex-col divide-y divide-white/10">
                    {result.batsmen.map((b, i) => (
                        <div key={i} className="flex justify-between items-center py-2 text-sm">
                            <div className="flex items-center gap-2 min-w-0">
                                <span className="text-white/60 text-xs w-16 shrink-0">#{i + 1} {slotLabel(i + 1)}</span>
                                <span className="text-white truncate">{battingOrder[i].name}</span>
                            </div>
                            <span className="text-white/80 tabular-nums shrink-0">
                                {b.dnb ? 'DNB' : `${b.runs}(${b.balls})${b.out ? '' : '*'}`}
                            </span>
                        </div>
                    ))}
                    <div className="flex justify-between items-center py-2 text-sm">
                        <span className="text-white/70">Extras</span>
                        <span className="text-white/80 shrink-0">{result.extras ?? 0}</span>
                    </div>
                    {result.oppositionBowling != null && (
                        <div className="flex justify-between items-center py-2 text-sm">
                            <span className="text-white/70">Opposition bowling attack</span>
                            <span className="text-white/80 shrink-0">
                                {result.oppositionEffect >= 0.4 ? 'Strong' : result.oppositionEffect <= -0.4 ? 'Weak' : 'Average'} ({result.oppositionBowling})
                            </span>
                        </div>
                    )}
                    {result.penalty > 0 && (
                        <div className="flex justify-between items-center py-2 text-sm">
                            <span className="text-loss">Penalty (no wicketkeeper)</span>
                            <span className="text-loss shrink-0">−{result.penalty}</span>
                        </div>
                    )}
                    <div className="flex justify-between items-center py-2 text-sm font-semibold">
                        <span className="text-white">Total</span>
                        <span className="text-white shrink-0 tabular-nums">
                            {result.finalScore}/{result.wickets} ({Math.floor(result.ballsFaced / 6)}.{result.ballsFaced % 6} ov)
                        </span>
                    </div>
                </div>
            </div>

            <div className={`${GLASS} p-3 sm:p-5`}>
                <button
                    onClick={() => setShowCommentary((v) => !v)}
                    className="w-full flex justify-between items-center"
                >
                    <span className="flex items-center gap-3">
                        <span className="w-1 h-6 rounded-full bg-accent" />
                        <span className="font-display text-white text-base sm:text-lg">Ball by Ball</span>
                    </span>
                    <span className="text-white/70 text-xs">{showCommentary ? 'Hide' : 'Show'}</span>
                </button>
                {showCommentary && (
                    <div className="mt-3">
                        <CommentaryFeed ballLog={result.ballLog} />
                    </div>
                )}
            </div>

            {onPlayAgain && (
                <div className="flex justify-center">
                    <button
                        onClick={onPlayAgain}
                        className="py-2.5 px-6 rounded-xl text-white bg-accent hover:bg-accentHover transition-colors font-semibold"
                    >
                        Play Again
                    </button>
                </div>
            )}
        </div>
    );
}
