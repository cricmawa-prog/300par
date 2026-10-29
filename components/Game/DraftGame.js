'use client';

import { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import Panel from './Panel';
import SquadPanel from './SquadPanel';
import BattingOrderStrip from './BattingOrderStrip';
import ScoreBoard from './ScoreBoard';
import LivePlayback from './LivePlayback';
import {
    TOTAL_SLOTS,
    eligibleEmptySlots,
    isPlayerPickable,
    pickPlayableYear,
    slotLabel,
} from '../../lib/game/positions';
import { simulateChase, NO_KEEPER_PENALTY } from '../../lib/game/simulate';
import { getBestScore, saveResult } from '../../lib/game/localHistory';

const MAX_FOREIGNERS = 4;

export default function DraftGame({ teams, seasonSquadsByTeam, onActiveChange }) {
    const [teamCode, setTeamCode] = useState(teams.length === 1 ? teams[0].code : null);
    const seasonSquads = teamCode ? seasonSquadsByTeam[teamCode] : {};
    const years = useMemo(() => Object.keys(seasonSquads).map(Number).sort(), [seasonSquads]);
    const team = teams.find((t) => t.code === teamCode);

    const [currentYear, setCurrentYear] = useState(null);
    const [filled, setFilled] = useState({});
    const [pickedNames, setPickedNames] = useState(new Set());
    const [selectedPlayer, setSelectedPlayer] = useState(null);
    const [phase, setPhase] = useState('drafting');
    const [simResult, setSimResult] = useState(null);
    const [skipUsed, setSkipUsed] = useState(false);
    const [difficulty, setDifficulty] = useState('hard');
    const [pendingDifficulty, setPendingDifficulty] = useState(null);

    const themeStyle = team
        ? { '--accent': team.color, '--accent-hover': team.colorHover, '--accent-muted': team.colorMuted }
        : undefined;

    useEffect(() => {
        onActiveChange?.(teamCode, phase === 'playback');
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [teamCode, phase]);


    const pickedCount = Object.keys(filled).length;

    // A season is rolled automatically at the start and after every pick (year is cleared to null
    // whenever a pick lands or the draft resets, which re-triggers this).
    useEffect(() => {
        if (teamCode && years.length && !currentYear && pickedCount < TOTAL_SLOTS && phase === 'drafting') {
            setCurrentYear(pickPlayableYear(years, seasonSquads, pickedNames, filledSlots, foreignersLocked));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [teamCode, currentYear, pickedCount, phase]);

    const currentSquad = seasonSquads[String(currentYear)] || [];
    const filledSlots = useMemo(() => new Set(Object.keys(filled).map(Number)), [filled]);
    const battingOrder = useMemo(
        () => Array.from({ length: TOTAL_SLOTS }, (_, i) => filled[i + 1]?.player).filter(Boolean),
        [filled]
    );
    const bowlersPicked = battingOrder.filter((p, i) => i >= 7).length;
    const keeperPicked = Object.values(filled).some((f) => f.player.isKeeper);
    const foreignersPicked = battingOrder.filter((p) => p.country !== 'India').length;
    const foreignersLocked = foreignersPicked >= MAX_FOREIGNERS;

    function isForeignLocked(player) {
        return player.country !== 'India' && foreignersLocked;
    }

    function handleSelectPlayer(player) {
        if (pickedNames.has(player.name) || isForeignLocked(player)) return;
        setSelectedPlayer(selectedPlayer?.name === player.name ? null : player);
    }

    function handleSlotClick(slot) {
        if (!selectedPlayer) return;
        if (filled[slot]) return;
        if (!selectedPlayer.slots.includes(slot)) return;

        const nextFilled = { ...filled, [slot]: { player: selectedPlayer, year: currentYear } };
        const nextPickedNames = new Set([...pickedNames, selectedPlayer.name]);
        setFilled(nextFilled);
        setPickedNames(nextPickedNames);
        setSelectedPlayer(null);

        setCurrentYear(null); // next season is rolled by the effect above
    }

    function handleSimulate() {
        const result = simulateChase(battingOrder, Math.random, 300, difficulty);
        setSimResult(result);
        saveResult({
            score: result.finalScore,
            wickets: result.wickets,
            won: result.won,
            team: teamCode,
            xi: battingOrder.map((p) => p.name),
        });
        setPhase('playback');
    }

    function handlePlaybackDone() {
        setPhase('result');
    }

    function handleSkipYear() {
        if (skipUsed || !currentYear) return;
        setSkipUsed(true);
        setSelectedPlayer(null);
        setCurrentYear(pickPlayableYear(years, seasonSquads, pickedNames, filledSlots, foreignersLocked, currentYear));
    }

    function resetDraft() {
        setFilled({});
        setPickedNames(new Set());
        setSelectedPlayer(null);
        setSimResult(null);
        setPhase('drafting');
        setSkipUsed(false);
    }

    function handlePlayAgain() {
        resetDraft();
        setCurrentYear(null);
    }

    function handleChangeTeam() {
        resetDraft();
        setCurrentYear(null);
        setTeamCode(null);
    }

    function handleDifficultyChange(next) {
        if (next === difficulty) return;
        if (pickedCount === 0) {
            setDifficulty(next);
        } else {
            setPendingDifficulty(next);
        }
    }

    function confirmDifficultyChange() {
        setDifficulty(pendingDifficulty);
        setPendingDifficulty(null);
        resetDraft();
        setCurrentYear(null);
    }

    if (!teamCode) {
        return (
            <div className="flex flex-col gap-4 bg-surface/90 backdrop-blur-sm border border-border rounded-2xl p-4 sm:p-8 max-w-2xl mx-auto w-full">
                <div className="text-center">
                    <p className="font-display text-white text-xl sm:text-2xl uppercase tracking-wide">Choose a franchise</p>
                    <p className="text-sm text-text/80 mt-1">Pick the team whose history you want to draft from.</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {teams.map((t) => (
                        <button
                            key={t.code}
                            type="button"
                            onClick={() => setTeamCode(t.code)}
                            style={{ '--tc': t.color }}
                            className="group relative overflow-hidden text-left rounded-xl border border-border bg-bg/70 px-4 py-3.5 pl-5 transition-all
                                hover:border-[var(--tc)] hover:-translate-y-0.5 hover:bg-bg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--tc)] active:scale-[0.99]"
                        >
                            <span className="absolute left-0 top-0 h-full w-1.5" style={{ background: t.color }} />
                            <span className="flex items-center justify-between gap-3">
                                <span className="min-w-0">
                                    <span className="block font-display text-2xl leading-none text-white">{t.code}</span>
                                    <span className="block mt-1 text-sm font-medium text-white/90 truncate">{t.name}</span>
                                    <span className="block mt-0.5 text-xs text-text/70">{t.founded}–{t.lastYear}</span>
                                </span>
                                <span
                                    className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-white text-lg transition-transform group-hover:translate-x-0.5"
                                    style={{ background: t.color }}
                                >
                                    →
                                </span>
                            </span>
                        </button>
                    ))}
                </div>
            </div>
        );
    }

    if (phase === 'playback' && simResult) {
        return (
            <div style={themeStyle}>
                <LivePlayback
                    result={simResult}
                    battingOrder={battingOrder}
                    teamName={team.name}
                    onDone={handlePlaybackDone}
                />
            </div>
        );
    }

    if (phase === 'result' && simResult) {
        return (
            <div style={themeStyle}>
                <ScoreBoard
                    battingOrder={battingOrder}
                    result={simResult}
                    bestScore={getBestScore()}
                    onPlayAgain={handlePlayAgain}
                    leaderboardEntry={{
                        score: simResult.finalScore,
                        wickets: simResult.wickets,
                        balls: simResult.ballsFaced,
                        team: teamCode,
                        difficulty,
                    }}
                />
            </div>
        );
    }


    const eligibleSlotsForSelection = selectedPlayer ? eligibleEmptySlots(selectedPlayer, filledSlots) : [];
    const draftComplete = pickedCount === TOTAL_SLOTS;

    function getCardState(player) {
        const alreadyPicked = pickedNames.has(player.name);
        const noSlot = !isPlayerPickable(player, filledSlots);
        const foreignLocked = isForeignLocked(player);
        let reason = null;
        if (foreignLocked && !alreadyPicked && !noSlot) {
            reason = `Foreigner limit reached (${MAX_FOREIGNERS}/${MAX_FOREIGNERS})`;
        }
        return { disabled: alreadyPicked || noSlot || foreignLocked, reason };
    }

    const statPills = [
        `Bowlers ${bowlersPicked}/4`,
        `Keeper: ${keeperPicked ? 'Yes' : 'No'}`,
        `Foreigners ${foreignersPicked}/${MAX_FOREIGNERS}`,
    ];

    return (
        <div className="flex flex-col gap-5" style={themeStyle}>
            {selectedPlayer && (
                <div className="fixed inset-x-0 bottom-0 z-30 flex justify-center px-4 pb-4 sm:pb-6 pointer-events-none">
                    <div className="pointer-events-auto w-full max-w-md bg-surface border-2 border-accent rounded-xl shadow-2xl px-4 py-3 flex flex-col items-center gap-3">
                        <div className="flex items-center gap-3 w-full">
                            <p className="text-sm text-text flex-1">
                                Select a position for <span className="text-white font-semibold">{selectedPlayer.name}</span>
                            </p>
                            <button
                                onClick={() => setSelectedPlayer(null)}
                                className="text-textMuted hover:text-text transition-colors shrink-0"
                                aria-label="Cancel selection"
                            >
                                <X size={16} />
                            </button>
                        </div>
                        <div className="flex flex-wrap justify-center gap-2">
                            {eligibleSlotsForSelection.map((slot) => (
                                <button
                                    key={slot}
                                    onClick={() => handleSlotClick(slot)}
                                    className="flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg bg-accent text-white hover:bg-accentHover transition-colors"
                                >
                                    <span className="font-display text-sm">{slot}</span>
                                    <span className="text-[10px] leading-none">{slotLabel(slot)}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {pendingDifficulty && (
                <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4">
                    <div className="bg-surface border border-border rounded-xl p-5 max-w-sm w-full flex flex-col gap-3">
                        <p className="text-text text-sm">
                            Switching difficulty will start a new draft and discard your current picks. Continue?
                        </p>
                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => setPendingDifficulty(null)}
                                className="text-xs px-3 py-1.5 rounded-lg border border-border text-textMuted hover:text-text transition-colors font-semibold"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmDifficultyChange}
                                className="text-xs px-3 py-1.5 rounded-lg bg-accent hover:bg-accentHover text-white transition-colors font-semibold"
                            >
                                Start New Draft
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="grid gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:h-[calc(100vh-9.5rem)] lg:min-h-[520px]">
                <Panel title="Your XI" badge={`${pickedCount} / ${TOTAL_SLOTS}`} className="order-2 lg:order-1">
                    <div className="flex flex-wrap gap-2">
                        {statPills.map((label) => (
                            <span key={label} className="px-3 py-1 rounded-full border border-border bg-bg/50 text-xs text-textMuted">
                                {label}
                            </span>
                        ))}
                    </div>
                    {!keeperPicked && (
                        <p className="text-[13px] text-amber-300">
                            No wicketkeeper yet — an XI without one is docked {NO_KEEPER_PENALTY} runs.
                        </p>
                    )}

                    <div className="lg:flex-1 lg:min-h-0 lg:overflow-y-auto no-scrollbar">
                        <BattingOrderStrip filled={filled} eligibleSlots={eligibleSlotsForSelection} onSlotClick={handleSlotClick} />
                    </div>

                    {draftComplete ? (
                        <button
                            onClick={handleSimulate}
                            className="w-full py-3 rounded-xl font-semibold text-lg transition-colors bg-accent hover:bg-accentHover text-white cursor-pointer"
                        >
                            Simulate the Chase
                        </button>
                    ) : (
                        <button
                            disabled
                            className="w-full py-3 rounded-xl font-semibold text-lg bg-border text-textMuted cursor-not-allowed"
                        >
                            {`Fill all ${TOTAL_SLOTS} spots to simulate`}
                        </button>
                    )}
                </Panel>

                <Panel
                    className="order-1 lg:order-2"
                    title={
                        <>
                            Pick from <span className="text-accent">{team.code}</span> Players
                        </>
                    }
                    right={
                        <div className="flex flex-wrap items-center gap-2">
                            {teams.length > 1 && (
                                <button
                                    onClick={handleChangeTeam}
                                    className="text-[13px] px-3 py-1.5 rounded-lg border border-white/25 bg-bg/60 text-white hover:border-accent transition-colors font-semibold"
                                >
                                    Change Team
                                </button>
                            )}
                            <label className="flex items-center gap-2 text-[13px] font-medium text-white/85">
                                Difficulty
                                <select
                                    value={difficulty}
                                    onChange={(e) => handleDifficultyChange(e.target.value)}
                                    className="bg-bg border border-white/25 rounded-lg px-2 py-1.5 text-[13px] text-white font-semibold cursor-pointer"
                                >
                                    <option value="hard">Hard</option>
                                    <option value="easy">Easy</option>
                                </select>
                            </label>
                        </div>
                    }
                >
                    {draftComplete ? (
                        <p className="text-center text-textMuted py-10">
                            Squad complete — hit <span className="text-accent font-semibold">Simulate the Chase</span> to see how your XI does.
                        </p>
                    ) : (
                        !currentYear ? null : (
                        <>
                            <div className="flex flex-wrap items-center gap-3">
                                <span className="px-4 py-1.5 rounded-full bg-accentMuted border border-accent/40 text-accent font-display">
                                    {currentYear} Squad
                                </span>
                                <button
                                    onClick={handleSkipYear}
                                    disabled={skipUsed}
                                    className={`text-xs px-3 py-1.5 rounded-lg border transition-colors font-semibold
                                        ${skipUsed ? 'border-border text-textMuted opacity-40 cursor-not-allowed' : 'border-accent text-accent hover:bg-accentMuted cursor-pointer'}`}
                                >
                                    {skipUsed ? 'Skip Used' : 'Skip Year'}
                                </button>
                                <span className="text-[13px] font-medium text-white/85">{team.name} · Turn {pickedCount + 1} / {TOTAL_SLOTS}</span>
                            </div>
                            <SquadPanel
                                squad={currentSquad}
                                year={currentYear}
                                selectedPlayer={selectedPlayer}
                                getState={getCardState}
                                onSelect={handleSelectPlayer}
                            />
                        </>
                        )
                    )}
                </Panel>
            </div>
        </div>
    );
}
