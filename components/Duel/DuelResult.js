'use client';

import { useEffect, useState } from 'react';
import LivePlayback from '../Game/LivePlayback';
import ScoreBoard from '../Game/ScoreBoard';
import TeamBackground from '../TeamBackground';
import { groundLabel } from '../../lib/game/grounds';
import { TEAMS } from '../../data/teams';

const TARGET_REVEAL_MS = 2200;

// Replaying the live simulation every time the result page is opened (e.g. coming back from the
// dashboard) is noise - remember per room, per browser, that it's already been watched.
const watchedKey = (roomId) => `duelWatched:${roomId}`;
function hasWatched(roomId) {
    try {
        return localStorage.getItem(watchedKey(roomId)) === '1';
    } catch {
        return false;
    }
}
function markWatched(roomId) {
    try {
        localStorage.setItem(watchedKey(roomId), '1');
    } catch {
        // storage unavailable - worst case the replay plays again
    }
}

export default function DuelResult({ room, myUid }) {
    const [tab, setTab] = useState(null); // 'first' | 'second'; defaults to the viewer's own innings below
    const [stage, setStage] = useState(() => (hasWatched(room.id) ? 'final' : 'first')); // 'first' | 'targetReveal' | 'second' | 'final'

    const isHostFirst = room.firstPickerUid === room.hostUid;
    const firstUid = room.firstPickerUid;
    const secondUid = isHostFirst ? room.guestUid : room.hostUid;
    const firstName = isHostFirst ? room.hostName : room.guestName;
    const secondName = isHostFirst ? room.guestName : room.hostName;
    const firstTeam = isHostFirst ? room.hostTeam : room.guestTeam;
    const secondTeam = isHostFirst ? room.guestTeam : room.hostTeam;
    const firstResult = isHostFirst ? room.resultHost : room.resultGuest;
    const secondResult = isHostFirst ? room.resultGuest : room.resultHost;

    const firstOpeners = firstResult.batsmen.slice(0, 2).map((b) => ({ name: b.name }));
    const secondOpeners = secondResult.batsmen.slice(0, 2).map((b) => ({ name: b.name }));
    const firstOrder = firstResult.batsmen.map((b) => ({ name: b.name }));
    const secondOrder = secondResult.batsmen.map((b) => ({ name: b.name }));

    // The ground the match was actually simulated on (recorded in the result itself).
    const ground = groundLabel(firstResult.ground);
    const matchup = `${firstName}'s ${firstTeam} vs ${secondName}'s ${secondTeam}${ground ? ` · ${ground}` : ''}`;
    const target = firstResult.finalScore + 1;

    useEffect(() => {
        if (stage === 'final') markWatched(room.id);
    }, [stage, room.id]);

    useEffect(() => {
        if (stage !== 'targetReveal') return;
        const t = setTimeout(() => setStage('second'), TARGET_REVEAL_MS);
        return () => clearTimeout(t);
    }, [stage]);

    // Each innings is themed in its own team's colour (accent bar, score, progress), not the viewer's.
    const themeFor = (code) => {
        const t = TEAMS.find((x) => x.code === code);
        return t ? { '--accent': t.color, '--accent-hover': t.colorHover, '--accent-muted': t.colorMuted } : undefined;
    };

    if (stage === 'first') {
        return (
            <div style={themeFor(firstTeam)}>
            <TeamBackground code={firstTeam} vivid />
            <div className="relative z-10">
            <LivePlayback
                result={firstResult}
                battingOrder={firstOpeners}
                inningsLabel="First Innings"
                subtitle={`${firstName}'s ${firstTeam} — batting first${ground ? ` · ${ground}` : ''}`}
                canSkip={myUid === firstUid}
                isChase={false}
                parPause={false}
                onDone={() => setStage('targetReveal')}
            />
            </div>
            </div>
        );
    }

    if (stage === 'targetReveal') {
        return (
            <div style={themeFor(firstTeam)} className="flex flex-col items-center gap-3 bg-surface border border-border rounded-xl p-6 sm:p-10">
                <p className="text-xs text-textMuted uppercase tracking-wide">{matchup}</p>
                <p className="font-display text-text text-lg">
                    {firstName} posted <span className="text-accent">{firstResult.finalScore}/{firstResult.wickets}</span>
                </p>
                <p className="text-sm text-textMuted text-center">
                    Target for {secondName}'s innings is <span className="text-accent font-semibold">{target}</span>.
                </p>
            </div>
        );
    }

    if (stage === 'second') {
        return (
            <div style={themeFor(secondTeam)}>
            <TeamBackground code={secondTeam} vivid />
            <div className="relative z-10">
            <LivePlayback
                result={secondResult}
                battingOrder={secondOpeners}
                inningsLabel="Second Innings"
                subtitle={`${secondName}'s ${secondTeam} — bowling first, now chasing ${target}${ground ? ` · ${ground}` : ''}`}
                canSkip={myUid === secondUid}
                parPause={false}
                onDone={() => setStage('final')}
            />
            </div>
            </div>
        );
    }

    const winnerName = room.winnerUid === firstUid ? firstName : secondName;
    const secondWon = room.winnerUid === secondUid;
    const marginText = secondWon
        ? `${secondName} won by ${10 - secondResult.wickets} wicket${10 - secondResult.wickets === 1 ? '' : 's'}`
        : `${firstName} won by ${firstResult.finalScore - secondResult.finalScore} run${firstResult.finalScore - secondResult.finalScore === 1 ? '' : 's'}`;

    // The first innings has no target of its own (won is null) - derive it from the duel outcome
    // so the first side's scorecard color/copy matches who actually won.
    const firstDisplayResult = { ...firstResult, won: room.winnerUid === firstUid };

    const innings = [
        { key: 'first', uid: firstUid, name: firstName, team: firstTeam, result: firstDisplayResult, order: firstOrder,
          text: `Set a target of ${firstResult.finalScore}.`, label: 'Batted first' },
        { key: 'second', uid: secondUid, name: secondName, team: secondTeam, result: secondResult, order: secondOrder,
          text: secondResult.won ? `Chased down the target of ${target} to win.` : `Fell short of the ${target} target.`, label: `Chased ${target}` },
    ];
    const active = innings.find((i) => i.key === tab) || innings.find((i) => i.uid === myUid) || innings[0];
    const activeTeam = TEAMS.find((t) => t.code === active.team);
    const themeStyle = activeTeam
        ? { '--accent': activeTeam.color, '--accent-hover': activeTeam.colorHover, '--accent-muted': activeTeam.colorMuted }
        : undefined;

    return (
        <>
            <TeamBackground code={active.team} />
            <div className="relative z-10 flex flex-col gap-4" style={themeStyle}>
                <div className="flex flex-col items-center gap-1 bg-bg/70 backdrop-blur-sm border border-border rounded-2xl px-4 py-4 text-center">
                    <p className="text-xs text-white/70 uppercase tracking-wide">{matchup}</p>
                    <p className="font-display text-white uppercase tracking-wide text-xl">{winnerName} wins!</p>
                    <p className="text-sm text-white/80">{marginText}</p>
                </div>

                <div role="tablist" className="grid grid-cols-2 gap-2">
                    {innings.map((i) => {
                        const selected = i.key === active.key;
                        const color = TEAMS.find((t) => t.code === i.team)?.color || '#8b96a8';
                        return (
                            <button
                                key={i.key}
                                role="tab"
                                aria-selected={selected}
                                onClick={() => setTab(i.key)}
                                style={selected ? { borderColor: color } : undefined}
                                className={`text-left rounded-xl border-2 px-3 py-2.5 transition-colors backdrop-blur-sm ${
                                    selected ? 'bg-bg/85' : 'bg-bg/50 border-white/15 hover:border-white/40'
                                }`}
                            >
                                <span className="flex items-center justify-between gap-2">
                                    <span className="min-w-0">
                                        <span className="block text-sm font-semibold text-white truncate">
                                            {i.name}
                                            {i.uid === myUid && <span className="ml-1.5 text-[10px] uppercase tracking-wide" style={{ color }}>you</span>}
                                        </span>
                                        <span className="block text-[11px] text-white/70 truncate">{i.team} · {i.label}</span>
                                    </span>
                                    <span className="text-right shrink-0">
                                        <span className="block font-display text-lg text-white tabular-nums leading-none">
                                            {i.result.finalScore}/{i.result.wickets}
                                        </span>
                                        {room.winnerUid === i.uid && <span className="block text-[10px] uppercase tracking-wide text-win mt-0.5">Winner</span>}
                                    </span>
                                </span>
                            </button>
                        );
                    })}
                </div>

                <div role="tabpanel">
                    <ScoreBoard battingOrder={active.order} result={active.result} resultText={active.text} />
                </div>
            </div>
        </>
    );
}
