'use client';

import { useState } from 'react';
import { MoreHorizontal } from 'lucide-react';
import { TEAMS } from '../../data/teams';
import { isSettled } from '../../lib/tournament/format';

const oversText = (balls) => `${Math.floor(balls / 6)}.${balls % 6}`;
const teamColor = (code) => TEAMS.find((t) => t.code === code)?.color || '#8b96a8';

function Side({ name, innings, winner, me }) {
    return (
        <div className={`flex items-center justify-between gap-2 ${winner ? 'text-text font-semibold' : 'text-textMuted'}`}>
            <span className="flex items-center gap-2 min-w-0">
                {innings?.team && <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: teamColor(innings.team) }} />}
                <span className="truncate">{name}</span>
                {me && <span className="text-[10px] uppercase tracking-wide text-accent">you</span>}
                {innings?.team && <span className="text-[10px] text-textMuted">{innings.team}</span>}
            </span>
            {innings && (
                <span className="tabular-nums shrink-0">
                    {innings.runs}/{innings.wickets} <span className="text-xs font-normal text-textMuted">({oversText(innings.balls)})</span>
                </span>
            )}
        </div>
    );
}

function marginText(f, names) {
    const r = f.result;
    if (f.status === 'walkover') return `${names[r.winnerUid]} wins by walkover`;
    if (f.status === 'no_result') return 'No result - 1 point each';
    if (!r?.innings) return null;
    const winner = r.innings[r.winnerUid];
    const loserUid = r.winnerUid === f.homeUid ? f.awayUid : f.homeUid;
    const loser = r.innings[loserUid];
    if (r.battedFirstUid === r.winnerUid) {
        const runs = winner.runs - loser.runs;
        return `${names[r.winnerUid]} won by ${runs} run${runs === 1 ? '' : 's'}`;
    }
    const w = 10 - winner.wickets;
    return `${names[r.winnerUid]} won by ${w} wicket${w === 1 ? '' : 's'}`;
}

// One match. Players see Play / Join; the host also gets walkover / no-result for matches that
// can't be played.
export default function FixtureCard({ fixture: f, names, myUid, isHost, running, busy, onPlay, onSettle }) {
    const [menu, setMenu] = useState(false);
    const settled = isSettled(f);
    const mine = [f.homeUid, f.awayUid].includes(myUid);
    const r = f.result;
    const iHostRoom = f.roomHostUid === myUid;

    let action = null;
    if (!settled && mine && running) {
        const label = f.status === 'live' ? (iHostRoom ? 'Back to room' : 'Join match') : 'Play';
        action = (
            <button
                onClick={() => onPlay(f)}
                disabled={busy}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors disabled:opacity-60 ${
                    f.status === 'live' && !iHostRoom ? 'bg-win text-bg animate-pulse' : 'bg-accent hover:bg-accentHover text-white'
                }`}
            >
                {busy ? '…' : label}
            </button>
        );
    }

    return (
        <div className={`bg-bg border rounded-xl px-3 py-2.5 flex flex-col gap-1.5 ${mine && !settled ? 'border-accent/50' : 'border-border'}`}>
            <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] uppercase tracking-wide text-textMuted">
                    {f.label || f.id}
                    {f.status === 'live' && <span className="ml-2 text-win">● live</span>}
                </span>
                <span className="flex items-center gap-2">
                    {action}
                    {isHost && running && !settled && (
                        <span className="relative">
                            <button onClick={() => setMenu((m) => !m)} className="p-1 text-textMuted hover:text-text" aria-label="Host options">
                                <MoreHorizontal size={16} />
                            </button>
                            {menu && (
                                <div className="absolute right-0 mt-1 z-20 w-52 bg-surface border border-border rounded-lg shadow-2xl py-1 text-sm">
                                    {[f.homeUid, f.awayUid].map((u) => (
                                        <button
                                            key={u}
                                            onClick={() => {
                                                setMenu(false);
                                                onSettle(f, { type: 'walkover', winnerUid: u });
                                            }}
                                            className="w-full text-left px-3 py-2 hover:bg-surfaceHover text-text"
                                        >
                                            Walkover to {names[u]}
                                        </button>
                                    ))}
                                    {f.stage === 'league' && (
                                        <button
                                            onClick={() => {
                                                setMenu(false);
                                                onSettle(f, { type: 'no_result' });
                                            }}
                                            className="w-full text-left px-3 py-2 hover:bg-surfaceHover text-text"
                                        >
                                            No result (1 pt each)
                                        </button>
                                    )}
                                </div>
                            )}
                        </span>
                    )}
                </span>
            </div>
            <Side name={names[f.homeUid] || 'TBD'} innings={r?.innings?.[f.homeUid]} winner={r?.winnerUid === f.homeUid} me={f.homeUid === myUid} />
            <Side name={names[f.awayUid] || 'TBD'} innings={r?.innings?.[f.awayUid]} winner={r?.winnerUid === f.awayUid} me={f.awayUid === myUid} />
            {settled && <p className="text-xs text-accent">{marginText(f, names)}</p>}
        </div>
    );
}
