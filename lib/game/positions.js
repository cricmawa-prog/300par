export const SLOT_LABELS = {
    1: 'Opener',
    2: 'Opener',
    3: 'One-down',
    4: 'Middle order',
    5: 'Middle order',
    6: 'Finisher',
    7: 'Finisher',
    8: 'Bowling all-rounder',
    9: 'Bowler',
    10: 'Bowler',
    11: 'Bowler',
};

export const TOTAL_SLOTS = 11;

export function slotLabel(slot) {
    return SLOT_LABELS[slot] || `Slot ${slot}`;
}

export function eligibleEmptySlots(player, filledSlots) {
    return player.slots.filter((slot) => !filledSlots.has(slot));
}

export function isPlayerPickable(player, filledSlots) {
    return eligibleEmptySlots(player, filledSlots).length > 0;
}

// A year is "playable" if at least one of its players can still legally be picked
// (not already drafted, has an empty eligible slot, and isn't blocked by the foreigner cap).
// Shared by solo mode (components/Game/DraftGame.js) and 1v1 duels
// (components/Duel/DuelDraftBoard.js) - both need the exact same "don't offer a dead year" logic.
export function yearIsPlayable(squad, pickedNames, filledSlots, foreignersLocked) {
    return squad.some(
        (p) => !pickedNames.has(p.name) && isPlayerPickable(p, filledSlots) && !(p.country !== 'India' && foreignersLocked)
    );
}

export function pickPlayableYear(years, seasonSquads, pickedNames, filledSlots, foreignersLocked, exclude) {
    const pool = exclude != null && years.length > 1 ? years.filter((y) => y !== exclude) : years;
    const playable = pool.filter((y) => yearIsPlayable(seasonSquads[String(y)] || [], pickedNames, filledSlots, foreignersLocked));
    const source = playable.length ? playable : pool;
    return source[Math.floor(Math.random() * source.length)];
}
