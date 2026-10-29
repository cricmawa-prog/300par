// Duel grounds (beta). A ground changes two things, nothing else - ratings and the batting logic
// are untouched, so a great batter is still a great batter everywhere:
//   1. how many runs are scored: every batter hits fewer/more boundaries (powerScale, dotBias) and
//      gets out a little less/more often (dismissScale), so all scores move together;
//   2. how much the bowling attack matters (bowlWeight): the existing opposition-bowling effect
//      (a strong vs weak attack) is multiplied, so on a bowler-friendly pitch the attack counts for more.
// "No ground picked" = the default duel logic (no ground passed to the simulation at all).
//
// Tuned with scripts/ground-calibrate.mjs against the target team averages below.

// Master switch. Set NEXT_PUBLIC_STADIUMS_ENABLED=true to turn the feature on; anything else
// (unset, "false") keeps it closed: no picker, no ground on rooms, default logic everywhere.
export function groundsEnabled() {
    return process.env.NEXT_PUBLIC_STADIUMS_ENABLED === 'true';
}

export const GROUNDS = {
    hyderabad: {
        key: 'hyderabad',
        city: 'Hyderabad',
        name: 'Rajiv Gandhi International Stadium',
        image: '/stadiums/hyderabad.jpg',
        blurb: 'High-scoring. Bowlers matter a little.',
        // ~240 average, attack worth ~10-15 runs
        powerScale: 1.0,
        dotBias: 0,
        dismissScale: 1.0,
        bowlWeight: 1.25,
    },
    mumbai: {
        key: 'mumbai',
        city: 'Mumbai',
        name: 'Wankhede Stadium',
        image: '/stadiums/mumbai.jpg',
        blurb: 'Fair to batters, but bowlers get help.',
        // ~220 average, attack worth ~15-20 runs
        powerScale: 0.89,
        dotBias: 0.035,
        dismissScale: 1.1,
        bowlWeight: 1.8,
    },
    chennai: {
        key: 'chennai',
        city: 'Chennai',
        name: 'Chepauk Stadium',
        image: '/stadiums/chennai.jpeg',
        blurb: 'Slow and low-scoring. Bowlers rule.',
        // ~170 average, attack worth ~25-30 runs
        powerScale: 0.58,
        dotBias: 0.13,
        dismissScale: 1.45,
        bowlWeight: 3.2,
    },
    bengaluru: {
        key: 'bengaluru',
        city: 'Bengaluru',
        name: 'M. Chinnaswamy Stadium',
        image: '/stadiums/bengaluru.webp',
        blurb: 'Small boundaries, run-fest.',
        // ~255 average, attack worth ~10-15 runs
        powerScale: 1.1,
        dotBias: -0.015,
        dismissScale: 0.93,
        bowlWeight: 1.25,
    },
};

export const GROUND_LIST = Object.values(GROUNDS);

// Safe lookup: unknown / missing keys (old rooms, feature off) mean "no ground".
export function getGround(key) {
    return (key && GROUNDS[key]) || null;
}

// "Wankhede Stadium, Mumbai" - how a ground is written in a match.
export function groundLabel(key) {
    const g = getGround(key);
    return g ? `${g.name}, ${g.city}` : null;
}
