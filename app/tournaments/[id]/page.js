'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Trophy, X } from 'lucide-react';
import { useUser } from '../../../lib/auth/AuthProvider';
import { STATUS_LABEL, subscribeToFixtures, subscribeToTournament } from '../../../lib/tournament/client';
import { tournamentAction } from '../../../lib/api/client';
import { MAX_PLAYERS, MIN_PLAYERS, computeStandings, qualifierCount } from '../../../lib/tournament/format';
import { getTeams } from '../../../lib/data/seasonSquads';
import { friendlyError } from '../../../lib/firebaseErrors';
import Spinner from '../../../components/Duel/Spinner';
import TeamPicker from '../../../components/Duel/TeamPicker';
import PointsTable from '../../../components/Tournament/PointsTable';
import FixtureCard from '../../../components/Tournament/FixtureCard';
import PlayerPicker from '../../../components/Tournament/PlayerPicker';

const INVITE_STYLE = {
    pending: 'text-textMuted',
    accepted: 'text-win',
    declined: 'text-loss',
    expired: 'text-loss',
    left: 'text-loss',
    closed: 'text-textMuted',
};

function Lobby({ t, myUid, isHost, run, busy }) {
    const [adding, setAdding] = useState([]);
    const playerCount = Object.keys(t.players || {}).length;
    const invites = Object.entries(t.invites || {});
    const pending = invites.filter(([, i]) => i.status === 'pending').length;
    const seats = MAX_PLAYERS - playerCount - pending;
    const canStart = playerCount >= MIN_PLAYERS;

    return (
        <div className="flex flex-col gap-4">
            <div className="bg-surface border border-border rounded-xl p-4 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                    <h2 className="font-display text-text">Players</h2>
                    <span className={`text-xs tabular-nums ${canStart ? 'text-win' : 'text-textMuted'}`}>
                        {playerCount} in · {pending} waiting · need {MIN_PLAYERS}+
                    </span>
                </div>
                <ul className="flex flex-col divide-y divide-border text-sm">
                    <li className="flex justify-between py-2">
                        <span className="text-text">{t.hostName}</span>
                        <span className="text-accent text-xs">host</span>
                    </li>
                    {invites.map(([uid, i]) => (
                        <li key={uid} className="flex justify-between py-2">
                            <span className="text-text">
                                {i.name}
                                {uid === myUid && <span className="ml-1.5 text-[10px] uppercase text-accent">you</span>}
                            </span>
                            <span className={`text-xs ${INVITE_STYLE[i.status] || 'text-textMuted'}`}>{i.status}</span>
                        </li>
                    ))}
                </ul>
                <p className="text-xs text-textMuted">
                    {pending
                        ? `Starts automatically once everyone has answered${canStart ? '' : ` and ${MIN_PLAYERS}+ players are in`}.`
                        : canStart
                          ? 'Everyone has answered.'
                          : `Not enough players yet - invite ${MIN_PLAYERS - playerCount} more.`}
                </p>
            </div>

            {isHost && (
                <>
                    <div className="flex flex-wrap gap-2">
                        <button
                            onClick={() => run('start', {}, `Start now with ${playerCount} players? Pending invites will be closed.`)}
                            disabled={!canStart || busy}
                            className="flex-1 py-2.5 rounded-lg bg-accent hover:bg-accentHover text-white font-semibold disabled:bg-border disabled:text-textMuted"
                        >
                            Start with {playerCount} players
                        </button>
                        {pending > 0 && (
                            <button onClick={() => run('resend')} disabled={busy} className="px-4 py-2.5 rounded-lg border border-border text-text text-sm">
                                Resend emails
                            </button>
                        )}
                        <button onClick={() => run('cancel', {}, 'Cancel this tournament for everyone?')} disabled={busy} className="px-4 py-2.5 rounded-lg border border-loss/50 text-loss text-sm">
                            Cancel
                        </button>
                    </div>
                    {seats > 0 && (
                        <div className="bg-surface border border-border rounded-xl p-4 flex flex-col gap-3">
                            <h2 className="font-display text-text text-sm">Invite more ({seats} seat{seats === 1 ? '' : 's'} left)</h2>
                            <PlayerPicker
                                currentUid={myUid}
                                selected={adding}
                                onChange={setAdding}
                                max={seats}
                                excludeUids={invites.filter(([, i]) => ['pending', 'accepted'].includes(i.status)).map(([u]) => u)}
                            />
                            {adding.length > 0 && (
                                <button
                                    onClick={() => run('invite', { inviteeUids: adding.map((a) => a.uid) }).then((ok) => ok && setAdding([]))}
                                    disabled={busy}
                                    className="py-2 rounded-lg bg-accent hover:bg-accentHover text-white text-sm font-semibold"
                                >
                                    Send {adding.length} invite{adding.length > 1 ? 's' : ''}
                                </button>
                            )}
                        </div>
                    )}
                </>
            )}
            {!isHost && t.players?.[myUid] && (
                <button onClick={() => run('leave', {}, 'Leave this tournament?')} disabled={busy} className="self-start text-xs text-loss underline">
                    Leave tournament
                </button>
            )}
            {!isHost && t.invites?.[myUid]?.status === 'pending' && (
                <div className="flex gap-2">
                    <button onClick={() => run('respond', { accept: true })} disabled={busy} className="flex-1 py-2.5 rounded-lg bg-accent text-white font-semibold">
                        Accept invite
                    </button>
                    <button onClick={() => run('respond', { accept: false })} disabled={busy} className="flex-1 py-2.5 rounded-lg border border-border text-text">
                        Decline
                    </button>
                </div>
            )}
        </div>
    );
}

export default function TournamentPage({ params }) {
    const { id } = params;
    const router = useRouter();
    const search = useSearchParams();
    const { user } = useUser();
    const myUid = user?.id;
    const [t, setT] = useState(undefined);
    const [fixtures, setFixtures] = useState([]);
    const [loadError, setLoadError] = useState(null);
    const [busy, setBusy] = useState(null);
    const [notice, setNotice] = useState(search.get('mailfail') ? "Created - some invite emails couldn't be sent, but everyone can still see the invite in the app." : null);
    const [teamFor, setTeamFor] = useState(null); // fixture waiting for a franchise pick
    const [team, setTeam] = useState(null);
    const [onlyMine, setOnlyMine] = useState(false);
    const reported = useRef(new Set());

    useEffect(() => {
        const onErr = (err) => setLoadError(err?.code === 'permission-denied' ? "This tournament is private - you weren't invited." : friendlyError(err));
        const a = subscribeToTournament(id, setT, onErr);
        const b = subscribeToFixtures(id, setFixtures, onErr);
        return () => {
            a();
            b();
        };
    }, [id]);

    // Self-healing: a duel that finished while nobody was on this page (both players closed the
    // tab right after) still has its result in duelResults - report my live matches once per visit.
    useEffect(() => {
        for (const f of fixtures) {
            if (f.status !== 'live' || ![f.homeUid, f.awayUid].includes(myUid) || reported.current.has(f.id)) continue;
            reported.current.add(f.id);
            tournamentAction(id, 'report', { fixtureId: f.id }).catch(() => {});
        }
    }, [fixtures, myUid, id]);

    useEffect(() => {
        if (!notice) return undefined;
        const tm = setTimeout(() => setNotice(null), 9000);
        return () => clearTimeout(tm);
    }, [notice]);

    // Runs an API action; resolves true on success.
    async function run(action, extra = {}, confirmText = null) {
        if (confirmText && !window.confirm(confirmText)) return false;
        setBusy(action);
        try {
            const out = await tournamentAction(id, action, extra);
            if (out?.emailsFailed?.length) setNotice(`Couldn't email: ${out.emailsFailed.join(', ')} - they can still accept in the app.`);
            else if (action === 'resend') setNotice('Invite emails sent again.');
            return true;
        } catch (err) {
            setNotice(err.message);
            return false;
        } finally {
            setBusy(null);
        }
    }

    async function play(f, chosenTeam = null) {
        setBusy(f.id);
        try {
            const out = await tournamentAction(id, 'play', { fixtureId: f.id, ...(chosenTeam ? { team: chosenTeam } : {}) });
            if (out.needTeam) {
                setTeamFor(f);
                setTeam(null);
            } else if (out.finished) {
                setNotice('That match already finished - result recorded.');
            } else if (out.roomId) {
                setTeamFor(null);
                window.dispatchEvent(new Event('srh:navigate'));
                router.push(`/300par/duel/${out.roomId}`);
            }
        } catch (err) {
            setNotice(err.message);
        } finally {
            setBusy(null);
        }
    }

    function settle(f, body) {
        const names = nameMap;
        const text = body.type === 'walkover' ? `Give ${names[body.winnerUid]} a walkover in ${f.label || f.id}?` : `Mark ${f.label || f.id} as no result?`;
        run('settle', { fixtureId: f.id, ...body }, text);
    }

    const nameMap = useMemo(() => Object.fromEntries(Object.entries(t?.players || {}).map(([u, p]) => [u, p.name])), [t?.players]);
    const playerCount = Object.keys(t?.players || {}).length;
    const table = useMemo(() => (t ? computeStandings(t.players || {}, fixtures, t.id) : []), [t, fixtures]);
    const league = fixtures.filter((f) => f.stage === 'league');
    const playoffs = fixtures.filter((f) => f.stage !== 'league');
    const running = t && ['league', 'playoffs'].includes(t.status);
    const isHost = t?.hostUid === myUid;
    const settledCount = league.filter((f) => ['complete', 'walkover', 'no_result'].includes(f.status)).length;
    const shownLeague = onlyMine ? league.filter((f) => [f.homeUid, f.awayUid].includes(myUid)) : league;
    const rounds = [...new Set(shownLeague.map((f) => f.round))].sort((a, b) => a - b);

    if (loadError) return <p className="text-center text-sm text-loss py-16 px-4">{loadError}</p>;
    if (t === undefined) return <div className="flex justify-center py-16"><Spinner label="Loading tournament…" className="text-sm text-textMuted" /></div>;
    if (t === null) return <p className="text-center text-sm text-textMuted py-16">Tournament not found. <Link href="/tournaments" className="text-accent underline">Back</Link></p>;

    return (
        <div className="max-w-5xl mx-auto p-4 sm:p-6 md:p-10 flex flex-col gap-6">
            <div className="flex flex-wrap items-end justify-between gap-2">
                <div>
                    <Link href="/tournaments" className="text-xs text-textMuted hover:text-accent">← Tournaments</Link>
                    <h1 className="text-2xl sm:text-3xl font-display text-text uppercase tracking-wide">{t.name}</h1>
                    <p className="text-xs text-textMuted">
                        Hosted by {isHost ? 'you' : t.hostName} · {playerCount} players · {STATUS_LABEL[t.status]}
                        {t.status === 'league' && ` · ${settledCount}/${league.length} played`}
                    </p>
                </div>
                {running && isHost && (
                    <button onClick={() => run('cancel', {}, 'Abandon this tournament for everyone? This cannot be undone.')} className="text-xs text-loss underline">
                        Abandon tournament
                    </button>
                )}
            </div>

            {notice && <p className="text-sm text-center bg-surface border border-border rounded-lg px-3 py-2 text-text">{notice}</p>}

            {t.status === 'complete' && t.championUid && (
                <div className="flex flex-col items-center gap-2 bg-gradient-to-b from-accent/30 to-surface border border-accent rounded-xl p-6 text-center">
                    <Trophy className="text-accent" size={36} />
                    <p className="font-display text-2xl text-text">{nameMap[t.championUid]} wins the tournament</p>
                    <p className="text-sm text-textMuted">Runner-up: {nameMap[t.runnerUpUid]}</p>
                </div>
            )}
            {t.status === 'cancelled' && <p className="text-sm text-center text-loss">This tournament was cancelled by the host.</p>}

            {t.status === 'inviting' && <Lobby t={t} myUid={myUid} isHost={isHost} run={run} busy={!!busy} />}

            {t.status !== 'inviting' && fixtures.length > 0 && (
                <div className="grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,4fr)]">
                    <div className="flex flex-col gap-6 lg:order-2">
                        {playoffs.length > 0 && (
                            <section className="flex flex-col gap-2">
                                <h2 className="font-display text-text">Playoffs</h2>
                                {playoffs.map((f) => (
                                    <FixtureCard key={f.id} fixture={f} names={nameMap} myUid={myUid} isHost={isHost} running={running} busy={busy === f.id} onPlay={(x) => play(x)} onSettle={settle} />
                                ))}
                                {t.status === 'playoffs' && !playoffs.some((f) => f.id === 'F') && <p className="text-xs text-textMuted">Final: decided after the semi{playoffs.length > 1 ? 's' : ''}.</p>}
                            </section>
                        )}
                        <section className="flex flex-col gap-2">
                            <h2 className="font-display text-text">{t.status === 'league' ? 'Points table' : 'Final league table'}</h2>
                            <PointsTable table={table} qualifiers={qualifierCount(playerCount)} myUid={myUid} />
                        </section>
                    </div>

                    <section className="flex flex-col gap-3 lg:order-1">
                        <div className="flex items-center justify-between">
                            <h2 className="font-display text-text">League matches</h2>
                            <label className="flex items-center gap-2 text-xs text-textMuted">
                                <input type="checkbox" checked={onlyMine} onChange={(e) => setOnlyMine(e.target.checked)} /> Only mine
                            </label>
                        </div>
                        <p className="text-xs text-textMuted -mt-2">Play in any order - press Play when you and your opponent are both around.</p>
                        {rounds.map((round) => (
                            <div key={round} className="flex flex-col gap-2">
                                <p className="text-[11px] uppercase tracking-widest text-textMuted">Round {round}</p>
                                {shownLeague
                                    .filter((f) => f.round === round)
                                    .map((f) => (
                                        <FixtureCard key={f.id} fixture={f} names={nameMap} myUid={myUid} isHost={isHost} running={running} busy={busy === f.id} onPlay={(x) => play(x)} onSettle={settle} />
                                    ))}
                            </div>
                        ))}
                    </section>
                </div>
            )}

            {teamFor && (
                <div className="fixed inset-0 z-40 bg-black/70 flex items-end sm:items-center justify-center p-4">
                    <div className="w-full max-w-lg bg-surface border border-border rounded-xl p-4 flex flex-col gap-4">
                        <div className="flex items-center justify-between">
                            <p className="font-display text-text">
                                {teamFor.label}: you vs {nameMap[teamFor.homeUid === myUid ? teamFor.awayUid : teamFor.homeUid]}
                            </p>
                            <button onClick={() => setTeamFor(null)} aria-label="Close" className="text-textMuted">
                                <X size={18} />
                            </button>
                        </div>
                        <TeamPicker teams={getTeams()} value={team} onChange={setTeam} />
                        <p className="text-xs text-textMuted">Your opponent gets an email and a live “Join match” button here. The room waits 10 minutes.</p>
                        <button
                            onClick={() => play(teamFor, team)}
                            disabled={!team || busy === teamFor.id}
                            className="py-2.5 rounded-lg bg-accent hover:bg-accentHover text-white font-semibold disabled:bg-border disabled:text-textMuted"
                        >
                            {busy === teamFor.id ? 'Opening room…' : 'Open match room'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
