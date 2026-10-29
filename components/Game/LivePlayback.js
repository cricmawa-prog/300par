'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { FastForward, SkipForward } from 'lucide-react';
import FeedRow from './FeedRow';

const BALL_DELAY_MS = 45;
const HIGHLIGHT_DELAY_MS = 550;
const END_PAUSE_MS = 700;
const FULL_FEED_ROWS = 40; // newest balls rendered in "Full Commentary"; older ones are still in the final scorecard
const MOMENT_ROWS = 25;

function isHighlight(entry, fast) {
    return entry.isWicket || entry.runs === 6 || (!fast && entry.runs === 4);
}
// What counts as a "key moment" in the feed (independent of fast-forward pacing).
const isKeyMoment = (entry) => entry.isWicket || entry.runs === 4 || entry.runs === 6;

// Attaches each ball's batter with their cumulative runs(balls) at that point, so the "departs
// for X(Y)" line matches CommentaryFeed's ball-by-ball breakdown exactly.
function annotateBallLog(ballLog) {
    const tally = {};
    return ballLog.map((entry) => {
        if (!tally[entry.batter]) tally[entry.batter] = { runs: 0, balls: 0 };
        tally[entry.batter].balls++;
        if (!entry.isWicket) tally[entry.batter].runs += entry.runs;
        return { ...entry, batterRuns: tally[entry.batter].runs, batterBalls: tally[entry.batter].balls };
    });
}

// Replays the ball-by-ball log up to `uptoIndex` to derive live state (score, over, who is at the
// crease and their runs(balls)) - reconstructed from the log itself so it can never drift from
// what simulateChase actually produced.
function computeLiveState(ballLog, uptoIndex, openers) {
    const tally = {};
    const lastSeenIdx = {};
    for (let i = 0; i <= uptoIndex; i++) {
        const entry = ballLog[i];
        if (!entry) continue;
        if (!tally[entry.batter]) tally[entry.batter] = { runs: 0, balls: 0, out: false };
        tally[entry.batter].balls++;
        if (entry.isWicket) tally[entry.batter].out = true;
        else tally[entry.batter].runs += entry.runs;
        lastSeenIdx[entry.batter] = i;
    }
    const active = Object.keys(tally)
        .filter((name) => !tally[name].out)
        .sort((a, b) => lastSeenIdx[b] - lastSeenIdx[a]);
    const last = uptoIndex >= 0 ? ballLog[uptoIndex] : null;

    const striker = active[0] || openers[0] || null;
    const nonStriker = active[1] || openers[1] || null;
    const statFor = (name) => (name && tally[name]) || { runs: 0, balls: 0, out: false };

    return {
        score: last ? last.score : 0,
        wickets: last ? last.wickets : 0,
        over: last ? last.over : 0,
        ballInOver: last ? last.ballInOver : 0,
        striker,
        nonStriker,
        strikerStats: statFor(striker),
        nonStrikerStats: statFor(nonStriker),
    };
}

function StatBox({ label, value, className = '' }) {
    return (
        <div className={`rounded-xl border border-white/15 bg-black/30 px-3 py-2 ${className}`}>
            <p className="text-[10px] uppercase tracking-widest text-white/70">{label}</p>
            <p className="font-display text-lg sm:text-xl text-white tabular-nums">{value}</p>
        </div>
    );
}

export default function LivePlayback({ result, battingOrder, teamName, subtitle, inningsLabel, canSkip = true, isChase = true, parPause = true, onDone }) {
    const ballLog = useMemo(() => annotateBallLog(result.ballLog), [result.ballLog]);
    const [ballIdx, setBallIdx] = useState(-1);
    const [pausedAt300, setPausedAt300] = useState(false);
    const [fastMode, setFastMode] = useState(false);
    const [feedTab, setFeedTab] = useState('full'); // 'full' | 'moments'
    const hasPausedRef = useRef(false);

    const openers = [battingOrder?.[0]?.name, battingOrder?.[1]?.name];

    useEffect(() => {
        if (pausedAt300 && !canSkip) {
            const t = setTimeout(() => setPausedAt300(false), 1500);
            return () => clearTimeout(t);
        }
        if (pausedAt300) return;

        // Once the 300 par score is reached, pause for a celebratory checkpoint instead of
        // auto-continuing - only fires once (hasPausedRef), and only for an actual 300 chase
        // (not a duel guest chasing some other target).
        if (isChase && parPause && !hasPausedRef.current && result.target === 300 && ballIdx >= 0 && ballLog[ballIdx].score >= 300) {
            hasPausedRef.current = true;
            setPausedAt300(true);
            return;
        }

        if (ballIdx >= ballLog.length - 1) {
            const t = setTimeout(onDone, END_PAUSE_MS);
            return () => clearTimeout(t);
        }
        const prevIsHighlight = ballIdx >= 0 && isHighlight(ballLog[ballIdx], fastMode);
        const delay = ballIdx === -1 ? BALL_DELAY_MS : prevIsHighlight ? (fastMode ? HIGHLIGHT_DELAY_MS / 3 : HIGHLIGHT_DELAY_MS) : BALL_DELAY_MS;
        const t = setTimeout(() => setBallIdx((i) => i + 1), delay);
        return () => clearTimeout(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ballIdx, pausedAt300, fastMode]);

    const live = computeLiveState(ballLog, ballIdx, openers);
    const totalOvers = 20;
    const hasTarget = isChase && result.target != null;

    const ballsBowled = ballIdx + 1;
    const ballsRemaining = Math.max(0, 120 - ballsBowled);
    const runsRequired = hasTarget ? result.target - live.score : 0;
    const showChaseStats = hasTarget && ballIdx >= 0 && ballsRemaining > 0 && live.wickets < 10 && runsRequired > 0;
    const rrr = showChaseStats ? runsRequired / (ballsRemaining / 6) : null;
    const runRate = ballsBowled > 0 ? (live.score / ballsBowled) * 6 : 0;
    const projected = ballsBowled > 0 ? Math.round((live.score / ballsBowled) * 120) : 0;

    const progressPct = Math.min(100, ((ballIdx + 1) / ballLog.length) * 100);

    const fullRows = useMemo(
        () => ballLog.slice(Math.max(0, ballIdx + 1 - FULL_FEED_ROWS), ballIdx + 1).reverse(),
        [ballLog, ballIdx]
    );
    const momentRows = useMemo(
        () => ballLog.slice(0, ballIdx + 1).filter(isKeyMoment).reverse().slice(0, MOMENT_ROWS),
        [ballLog, ballIdx]
    );
    const rows = feedTab === 'full' ? fullRows : momentRows;

    return (
        <div className="flex flex-col gap-2 lg:h-[calc(100vh-10.5rem)] lg:min-h-[500px]">
            <div className="flex flex-col gap-0.5 px-1">
                <div className="flex items-center gap-2">
                    {inningsLabel && <span className="text-[11px] text-accent uppercase tracking-widest font-semibold">{inningsLabel}</span>}
                    <span className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-white/80">
                        <span className="w-1.5 h-1.5 rounded-full bg-loss animate-pulse" /> Live
                    </span>
                </div>
                <p className="text-xs sm:text-sm uppercase tracking-[0.25em] font-semibold text-white [text-shadow:0_1px_8px_rgba(0,0,0,0.8)]">
                    {subtitle || `${teamName} chasing ${result.target}`}
                </p>
            </div>

            <div className="rounded-3xl border border-white/15 bg-bg/70 backdrop-blur-md p-4 sm:p-5 flex flex-col gap-3 lg:flex-1 lg:min-h-0">
                <div className="grid gap-3 md:grid-cols-[auto_1fr] md:gap-8 items-center">
                    <div className="text-center md:text-left">
                        <p className="text-[11px] uppercase tracking-widest text-white/70">Current score</p>
                        <p className="font-display italic text-5xl sm:text-6xl leading-none tabular-nums mt-0.5">
                            <span className="text-transparent bg-clip-text bg-gradient-to-b from-yellow-200 via-accent to-accent drop-shadow-[0_0_14px_var(--accent-muted,rgba(255,107,26,0.4))] pr-1">
                                {live.score}
                            </span>
                            <span className="text-white">/{live.wickets}</span>
                        </p>
                        <p className="text-sm tracking-widest text-white/75 tabular-nums mt-1">
                            Over {live.over}.{live.ballInOver} / {totalOvers}.0
                        </p>
                    </div>

                    <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
                        {hasTarget ? (
                            <>
                                <StatBox label="Target" value={result.target} />
                                <StatBox label="Required run rate" value={rrr != null ? rrr.toFixed(2) : '—'} />
                                <div className="col-span-2 lg:col-span-1 rounded-xl border border-white/15 bg-black/30 px-3 py-2">
                                    <p className="text-[10px] uppercase tracking-widest text-white/70">Need</p>
                                    <p className="text-white mt-0.5">
                                        {showChaseStats ? (
                                            <>
                                                <span className="font-bold">{runsRequired}</span> runs off <span className="font-bold">{ballsRemaining}</span> balls
                                            </>
                                        ) : ballIdx < 0 ? (
                                            'Chase about to begin…'
                                        ) : runsRequired <= 0 ? (
                                            'Target reached!'
                                        ) : (
                                            'Innings over'
                                        )}
                                    </p>
                                </div>
                            </>
                        ) : (
                            <>
                                <StatBox label="Run rate" value={runRate.toFixed(2)} />
                                <StatBox label="Projected" value={projected} />
                                <div className="col-span-2 lg:col-span-1 rounded-xl border border-white/15 bg-black/30 px-3 py-2">
                                    <p className="text-[10px] uppercase tracking-widest text-white/70">Wickets</p>
                                    <p className="text-white mt-0.5"><span className="font-bold">{live.wickets}</span> down · {10 - live.wickets} left</p>
                                </div>
                            </>
                        )}
                    </div>
                </div>

                <div className="w-full h-1.5 rounded-full bg-border overflow-hidden">
                    <div className="h-full bg-accent transition-all duration-150" style={{ width: `${progressPct}%` }} />
                </div>

                <div className="grid grid-cols-2 gap-2">
                    {[
                        { name: live.striker, stats: live.strikerStats, strike: true },
                        { name: live.nonStriker, stats: live.nonStrikerStats, strike: false },
                    ].map((b, i) => (
                        <div key={i} className="rounded-xl border border-white/15 bg-black/30 px-3 py-1.5 flex items-center justify-between gap-2 text-sm">
                            <span className="truncate text-white font-semibold">
                                {b.name || 'Walking out…'} {b.strike && b.name && <span className="text-accent">*</span>}
                            </span>
                            <span className="tabular-nums text-white/80 shrink-0">{b.stats.runs}({b.stats.balls})</span>
                        </div>
                    ))}
                </div>

                <div className="rounded-2xl border border-white/15 bg-black/25 p-3 flex flex-col lg:flex-1 lg:min-h-0">
                    <div className="flex items-center justify-between gap-3 mb-2">
                        <div className="flex items-center gap-3">
                            <span className="w-1 h-6 rounded-full bg-accent" />
                            <h3 className="font-display text-white text-base sm:text-lg whitespace-nowrap">Ball by Ball</h3>
                        </div>
                        <div className="inline-flex rounded-xl bg-black/40 p-1">
                            {[
                                { key: 'full', label: 'Full Commentary', short: 'Full' },
                                { key: 'moments', label: 'Key Moments', short: 'Key' },
                            ].map((t) => (
                                <button
                                    key={t.key}
                                    type="button"
                                    onClick={() => setFeedTab(t.key)}
                                    className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                                        feedTab === t.key ? 'bg-accent text-white' : 'text-white/80 hover:text-white'
                                    }`}
                                >
                                    <span className="sm:hidden">{t.short}</span>
                                    <span className="hidden sm:inline">{t.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                    <ul className="flex flex-col gap-1.5 h-[15rem] sm:h-[17rem] lg:h-auto lg:flex-1 lg:min-h-0 overflow-y-auto no-scrollbar">
                        {rows.length === 0 && (
                            <li className="text-sm text-white/70 text-center py-6">
                                {feedTab === 'moments' ? 'No boundaries or wickets yet…' : hasTarget ? 'Quiet start to the chase…' : 'Quiet start to the innings…'}
                            </li>
                        )}
                        {rows.map((entry) => (
                            <FeedRow key={`${entry.over}.${entry.ballInOver}`} entry={entry} />
                        ))}
                    </ul>
                </div>

                {pausedAt300 ? (
                    <div className="flex flex-col items-center gap-3">
                        <p className="font-display text-win uppercase tracking-wide">300 completed!</p>
                        {canSkip ? (
                            <div className="flex flex-wrap justify-center gap-3">
                                <button
                                    onClick={onDone}
                                    className="py-2.5 px-6 rounded-xl text-white bg-accent hover:bg-accentHover transition-colors font-semibold text-sm"
                                >
                                    See Result
                                </button>
                                <button
                                    onClick={() => setPausedAt300(false)}
                                    className="py-2.5 px-6 rounded-xl border border-accent text-accent hover:bg-accentMuted transition-colors font-semibold text-sm"
                                >
                                    Want to Play More?
                                </button>
                            </div>
                        ) : (
                            <p className="text-xs text-white/70">Waiting for the other player…</p>
                        )}
                    </div>
                ) : canSkip ? (
                    <div className="flex flex-wrap justify-center gap-3">
                        <button
                            onClick={() => setFastMode((v) => !v)}
                            className={`inline-flex items-center gap-2 py-2 px-6 rounded-xl border font-semibold text-sm transition-colors ${
                                fastMode ? 'bg-accent text-white border-accent' : 'border-white/30 bg-black/40 text-white hover:border-accent'
                            }`}
                        >
                            <FastForward size={18} /> {fastMode ? 'Fast: On' : 'Fast Forward'}
                        </button>
                        <button
                            onClick={onDone}
                            className="inline-flex items-center gap-2 py-2 px-6 rounded-xl border border-accent bg-accentMuted text-accent hover:bg-accent hover:text-white font-semibold text-sm transition-colors"
                        >
                            <SkipForward size={18} /> Skip to Result
                        </button>
                    </div>
                ) : (
                    <p className="text-xs text-white/70 text-center">Watching…</p>
                )}
            </div>
        </div>
    );
}
