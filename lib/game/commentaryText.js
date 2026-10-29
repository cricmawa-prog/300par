// Short flavour lines for the live ball-by-ball feed. Picked deterministically from the ball's
// over/ball position, so the same ball always reads the same and the log itself is untouched.
const LINES = {
    six: ['Over long-on!', 'Clears the ropes again!', 'Straight down the ground!', 'Massively hit!', 'Into the stands!', 'Smoked over midwicket!'],
    four: ['Driven through covers beautifully!', 'Brilliant timing!', 'Races away to the fence!', 'Pierces the gap!', 'Cracked past point!', 'Perfectly placed!'],
    wicket: ['Big breakthrough!', 'The bowler strikes!', 'Walks back to the pavilion.', 'Gone! A massive wicket.', 'Caught in the deep!', 'Beaten all ends up!'],
    dot: ['Dot ball, good defence.', 'Beaten outside off.', 'Straight to the fielder.', 'Tight line, no run.', 'Solid forward defence.'],
    run: ['Pushed into the gap.', 'Works it away.', 'Quick single taken.', 'Nudged to the leg side.', 'Good running between the wickets.'],
};

export function flavor(entry) {
    const pool = entry.isWicket ? LINES.wicket : entry.runs === 6 ? LINES.six : entry.runs === 4 ? LINES.four : entry.runs === 0 ? LINES.dot : LINES.run;
    return pool[(entry.over * 7 + entry.ballInOver * 3) % pool.length];
}
