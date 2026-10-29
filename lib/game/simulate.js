import { getGround } from './grounds.js';

const TOTAL_BALLS = 120;
const TARGET = 300;

// Hard = the original calibration, tuned up slightly (~20% -> ~25% win rate for an elite
// draft) and narrowed (dismissMult/dismissFloor/dismissCeil closer together = less pure-luck
// swing between a tail-ender and a star). Easy roughly doubles that to ~45% by cutting
// dismissal chance and boosting boundary power - same mechanic, just softer.
const DIFFICULTY = {
    hard: { dismissMult: 0.8, dismissFloor: 0.017, dismissCeil: 0.064, powerBoost: 1.06 },
    easy: { dismissMult: 0.56, dismissFloor: 0.012, dismissCeil: 0.047, powerBoost: 1.17 },
    // Duels are about beating the other side, not 300 - so scores sit closer to a modern big-T20
    // total (~240 first-innings median for a typical draft, vs ~265 on Hard). Same wicket rate as
    // Hard; less boundary power and a few more dots pull the middle down, while a 300 still turns
    // up roughly once every 50 duels.
    duel: { dismissMult: 0.8, dismissFloor: 0.017, dismissCeil: 0.064, powerBoost: 0.88, dotBias: 0.035 },
};

// Struggle: a genuinely terrible batting side (top 7 averaging well below any real draft) scores
// even less - more dots and a few more wickets, scaled from 0 at the threshold to full strength at
// the floor (about the worst XI the real franchise data can produce). Quality = mean (BAT + POW) / 2 over slots 1-7. A self-drafted XI
// lands around 66-83, so any normal team sits far above the threshold and is completely untouched
// (struggle 0 changes no probability and draws no extra random numbers).
const STRUGGLE = { threshold: 45, floor: 20, dotBias: 0.45, dismissBoost: 0.2 };

export function battingQuality(order) {
    const top = order.slice(0, 7);
    return top.reduce((sum, p) => sum + (p.BAT + p.POW) / 2, 0) / (top.length || 1);
}

function struggleFactor(order) {
    return clamp((STRUGGLE.threshold - battingQuality(order)) / (STRUGGLE.threshold - STRUGGLE.floor), 0, 1);
}

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

// Higher BAT = lower per-ball dismissal chance. Tail-enders (BAT ~20) get out roughly
// every ~11 balls on average; elite batters (BAT ~90+) survive far longer.
function dismissalChance(BAT, config) {
    return clamp((0.078 - (BAT / 100) * 0.058) * config.dismissMult, config.dismissFloor, config.dismissCeil);
}

// Runs-per-ball distribution shaped by POW (boundary/strike-rate power) and a small
// partnership-synergy multiplier from the current batting pair's combined quality.
// Weighted-bucket pick so the ceiling (maxed POW + synergy) can realistically clear
// 300 in rare, high-variance runs, while an average lineup sits well below it.
// dotBias (duel scoring / struggle) adds extra weight to the dot ball; 0 leaves it unchanged.
function ballRuns(POW, pairFactor, rng, powerBoost, dotBias = 0) {
    const t = clamp((POW / 100) * pairFactor * powerBoost, 0, 1.3);
    const weights = [
        [0, 0.33 - 0.15 * t + dotBias],
        [1, 0.36],
        [2, 0.10],
        [3, 0.015],
        [4, 0.11 + 0.14 * t],
        [6, 0.035 + 0.11 * t],
    ];
    const total = weights.reduce((sum, [, w]) => sum + Math.max(w, 0.01), 0);
    let roll = rng() * total;
    for (const [runs, w] of weights) {
        roll -= Math.max(w, 0.01);
        if (roll <= 0) return runs;
    }
    return 1;
}

// A good bowling unit earns extras (wides, no-balls, byes, leg-byes) - the old end-of-innings
// "bowler morale" bonus, now scattered through the innings like real extras. Floored at 0
// because extras can't be negative; elite units (the only ones that win) are unaffected.
function extrasBudget(bowlers) {
    const avgBWL = bowlers.reduce((sum, p) => sum + p.BWL, 0) / (bowlers.length || 1);
    return Math.max(0, Math.round(((avgBWL - 50) / 50) * 15));
}

// Splits the budget into small chunks and drops each on a random ball (balls 8-105, so
// they land mid-innings and mostly survive an early finish). Returns { ballNumber: { runs, type } }.
function scheduleExtras(total, rng) {
    const schedule = {};
    let remaining = total;
    while (remaining > 0) {
        const size = Math.min(remaining, [1, 1, 1, 2, 4][Math.floor(rng() * 5)]);
        const type =
            size === 1 ? ['wd', 'nb', 'lb'][Math.floor(rng() * 3)] : size === 4 ? 'b' : ['b', 'lb'][Math.floor(rng() * 2)];
        let ballNumber = 8 + Math.floor(rng() * 98);
        while (schedule[ballNumber]) ballNumber = 8 + Math.floor(rng() * 98);
        schedule[ballNumber] = { runs: size, type };
        remaining -= size;
    }
    return schedule;
}

// A side with no wicketkeeper in the XI is docked runs instead of being blocked from simulating
// (blocking would add dead-end cases to the draft). Dropped as two chunks on random mid-innings
// balls, so the ball-by-ball score and the final score still agree. Returns { ballNumber: runs }.
export const NO_KEEPER_PENALTY = 15;
function schedulePenalty(battingOrder, rng) {
    const schedule = {};
    if (battingOrder.some((p) => p.isKeeper)) return schedule;
    const chunks = [Math.ceil(NO_KEEPER_PENALTY / 2), Math.floor(NO_KEEPER_PENALTY / 2)];
    for (const runs of chunks) {
        let ballNumber = 30 + Math.floor(rng() * 71);
        while (schedule[ballNumber]) ballNumber = 30 + Math.floor(rng() * 71);
        schedule[ballNumber] = runs;
    }
    return schedule;
}

// Opposition bowling (duels only): the batting side faces the other XI's bowlers, so their
// quality nudges this innings. Strength = mean BWL of the XI's five best bowlers (a typical
// drafted XI lands around 70). The nudge is deliberately small - a few runs either way.
const BOWL_NEUTRAL = 70;
const BOWL_SPREAD = 12;
const OPPOSITION_DISMISSAL_SWING = 0.1; // +-10% dismissal chance at the extremes
const OPPOSITION_SCORING_SWING = 0.035; // +-3.5% scoring power at the extremes

export function bowlingStrength(order) {
    const top = order.map((p) => p.BWL).sort((a, b) => b - a).slice(0, 5);
    return top.reduce((sum, v) => sum + v, 0) / (top.length || 1);
}

function pairSynergy(a, b) {
    const combined = (a.BAT + a.POW + b.BAT + b.POW) / 4;
    return clamp(combined / 75, 0.85, 1.2);
}

/**
 * Simulates a 20-over T20 chase for an 11-player batting order (index 0 = slot 1 ... index 10 = slot 11).
 * Pure function, no DOM/React - safe to call from client components.
 */
// stopAtTarget ends the innings the moment the target is reached (a real chase) - used for a
// duel's second innings. Default false keeps solo mode and first innings playing out fully.
// oppositionBowling (optional, duels): the other XI's bowlingStrength(); omit for solo play.
// ground (optional, duels, beta): a key from lib/game/grounds.js - shifts the scoring level and how
// much the bowling attack counts. Omitted / unknown = the default logic, byte for byte.
export function simulateChase(battingOrder, rng = Math.random, target = TARGET, difficulty = 'hard', stopAtTarget = false, oppositionBowling = null, ground = null) {
    const config = DIFFICULTY[difficulty] || DIFFICULTY.hard;
    const z = oppositionBowling == null ? 0 : clamp((oppositionBowling - BOWL_NEUTRAL) / BOWL_SPREAD, -1, 1);
    const g = getGround(ground);
    const bowlWeight = g ? g.bowlWeight : 1; // how much the attack counts on this ground
    let dismissScale = 1 + OPPOSITION_DISMISSAL_SWING * bowlWeight * z;
    const powerBoost = config.powerBoost * (g ? g.powerScale : 1) * (1 - OPPOSITION_SCORING_SWING * bowlWeight * z);
    if (g) dismissScale *= g.dismissScale;
    const struggle = struggleFactor(battingOrder);
    if (struggle > 0) dismissScale *= 1 + STRUGGLE.dismissBoost * struggle;
    const dotBias = (config.dotBias || 0) + (g ? g.dotBias : 0) + STRUGGLE.dotBias * struggle;
    const stats = battingOrder.map((player) => ({
        name: player.name,
        runs: 0,
        balls: 0,
        out: false,
        dnb: true,
    }));

    let strikerIdx = 0;
    let nonStrikerIdx = 1;
    let nextInIdx = 2;
    let wickets = 0;
    let totalRuns = 0;
    const extrasSchedule = scheduleExtras(extrasBudget(battingOrder.slice(7, 11)), rng);
    let pendingExtra = null;
    let extrasTotal = 0;
    const penaltySchedule = schedulePenalty(battingOrder, rng);
    let penaltyRemaining = Object.values(penaltySchedule).reduce((a, c) => a + c, 0);
    let pendingPenalty = 0;
    let penaltyTotal = 0;
    const overSummaries = [];
    const ballLog = [];

    stats[0].dnb = false;
    stats[1].dnb = false;

    let ball = 0;
    outer: for (let over = 0; over < 20; over++) {
        let overRuns = 0;
        for (let b = 0; b < 6; b++) {
            if (wickets >= 10) break outer;
            ball++;
            if (penaltySchedule[ball]) pendingPenalty += penaltySchedule[ball];
            if (extrasSchedule[ball]) pendingExtra = pendingExtra ? { runs: pendingExtra.runs + extrasSchedule[ball].runs, type: pendingExtra.type } : extrasSchedule[ball];

            const striker = battingOrder[strikerIdx];
            const nonStriker = battingOrder[nonStrikerIdx];
            const synergy = pairSynergy(striker, nonStriker);

            const outThisBall = rng() < dismissalChance(striker.BAT, config) * dismissScale;
            stats[strikerIdx].balls++;

            if (outThisBall) {
                stats[strikerIdx].out = true;
                wickets++;
                totalRuns += 0;
                ballLog.push({ over, ballInOver: b + 1, batter: striker.name, runs: 0, isWicket: true, score: totalRuns, wickets });
                if (wickets >= 10 || nextInIdx > 10) break outer;
                strikerIdx = nextInIdx;
                stats[strikerIdx].dnb = false;
                nextInIdx++;
                continue;
            }

            const runs = ballRuns(striker.POW, synergy, rng, powerBoost, dotBias);
            stats[strikerIdx].runs += runs;
            totalRuns += runs;
            overRuns += runs;
            const entry = { over, ballInOver: b + 1, batter: striker.name, runs, isWicket: false, score: totalRuns, wickets };
            // Extras ride on a normal ball (not credited to the batter) so every log entry is
            // still exactly one legal delivery. Deferred past wicket balls via pendingExtra.
            if (pendingExtra) {
                totalRuns += pendingExtra.runs;
                overRuns += pendingExtra.runs;
                extrasTotal += pendingExtra.runs;
                entry.score = totalRuns;
                entry.extras = pendingExtra.runs;
                entry.extraType = pendingExtra.type;
                pendingExtra = null;
            }
            if (pendingPenalty) {
                totalRuns -= pendingPenalty;
                overRuns -= pendingPenalty;
                penaltyTotal += pendingPenalty;
                penaltyRemaining -= pendingPenalty;
                entry.score = totalRuns;
                entry.penalty = pendingPenalty;
                pendingPenalty = 0;
            }
            ballLog.push(entry);

            // A chase only ends once the target is reached even after any penalty still to come.
            if (stopAtTarget && totalRuns - penaltyRemaining >= target) break outer;

            if (runs % 2 === 1) {
                [strikerIdx, nonStrikerIdx] = [nonStrikerIdx, strikerIdx];
            }
        }
        overSummaries.push(overRuns);
        [strikerIdx, nonStrikerIdx] = [nonStrikerIdx, strikerIdx];
    }

    // Innings ended before every scheduled penalty landed (e.g. all out early): dock the rest
    // on the last delivery so the ball log and final score still agree.
    const leftover = penaltyRemaining + pendingPenalty;
    if (leftover > 0 && ballLog.length) {
        const last = ballLog[ballLog.length - 1];
        totalRuns -= leftover;
        penaltyTotal += leftover;
        last.score = totalRuns;
        last.penalty = (last.penalty || 0) + leftover;
    }

    const finalScore = totalRuns;
    const oversUsed = Math.min(20, Math.ceil(ball / 6));

    return {
        batsmen: stats,
        overSummaries,
        ballLog,
        totalRuns,
        extras: extrasTotal,
        penalty: penaltyTotal,
        oppositionBowling: oppositionBowling == null ? null : Math.round(oppositionBowling),
        ground: g ? g.key : null,
        oppositionEffect: z, // -1 (weak attack, helps the batters) .. +1 (strong attack)
        finalScore,
        wickets,
        oversUsed,
        ballsFaced: ball,
        target,
        won: target == null ? null : finalScore >= target,
    };
}
