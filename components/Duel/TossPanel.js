'use client';

import { useEffect, useState } from 'react';
import Spinner from './Spinner';

const FLIP_MS = 2600;

function CoinFace({ name, back = false }) {
    return (
        <div
            className="absolute inset-0 rounded-full flex flex-col items-center justify-center text-center px-3 border-4 border-yellow-200/80"
            style={{
                backfaceVisibility: 'hidden',
                transform: back ? 'rotateY(180deg)' : undefined,
                background: 'radial-gradient(circle at 30% 25%, #fff2b0 0%, #f6c445 45%, #b8860b 100%)',
                boxShadow: 'inset 0 0 18px rgba(120, 70, 0, 0.55)',
            }}
        >
            <span className="font-display text-3xl text-amber-950/90 leading-none">{(name || '?').slice(0, 2).toUpperCase()}</span>
            <span className="mt-1 text-[11px] font-bold uppercase tracking-wide text-amber-950/80 max-w-full truncate">{name}</span>
        </div>
    );
}

// The toss result is already decided when the room reaches this stage (room.tossWinnerUid);
// this plays it as a coin flip - host on one face, guest on the other - landing on the winner,
// and only then reveals the result / the bat-or-bowl choice.
export default function TossPanel({ room, myUid, onChoose }) {
    const [choosing, setChoosing] = useState(false);
    const [revealed, setRevealed] = useState(false);
    const iWonToss = room.tossWinnerUid === myUid;
    const hostWon = room.tossWinnerUid === room.hostUid;
    const winnerName = hostWon ? room.hostName : room.guestName;

    useEffect(() => {
        const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
        const t = setTimeout(() => setRevealed(true), reduce ? 0 : FLIP_MS + 350);
        return () => clearTimeout(t);
    }, []);

    async function choose(uid) {
        setChoosing(true);
        try {
            await onChoose(uid);
        } finally {
            setChoosing(false);
        }
    }

    return (
        <div className="flex flex-col items-center gap-5 bg-surface border border-border rounded-xl p-6 sm:p-10">
            <p className="font-display text-text uppercase tracking-wide text-sm">Toss</p>

            <div className="srh-coin-stage" style={{ '--coin-end': hostWon ? '1800deg' : '1980deg' }}>
                <div className="srh-coin-arc">
                    <div className="srh-coin">
                        <CoinFace name={room.hostName} />
                        <CoinFace name={room.guestName} back />
                    </div>
                </div>
                <div className="srh-coin-shadow" />
            </div>

            {!revealed && <p className="text-sm text-textMuted">Flipping the coin…</p>}

            {revealed && !iWonToss && (
                <div className="flex flex-col items-center gap-3">
                    <p className="text-text text-center">
                        <span className="text-accent font-semibold">{winnerName}</span> won the toss — waiting for their choice…
                    </p>
                    <Spinner className="text-textMuted" />
                </div>
            )}

            {revealed && iWonToss && (
                <div className="flex flex-col items-center gap-4">
                    <p className="font-display text-text uppercase tracking-wide text-sm">You won the toss!</p>
                    <p className="text-textMuted text-sm text-center">
                        Whoever drafts first also bats first in the simulation. Bat first, or bowl first?
                    </p>
                    <div className="flex gap-3">
                        <button
                            onClick={() => choose(myUid)}
                            disabled={choosing}
                            className="py-2 px-5 rounded-lg text-white bg-accent hover:bg-accentHover transition-colors font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                            I&apos;ll bat first
                        </button>
                        <button
                            onClick={() => choose(room.hostUid === myUid ? room.guestUid : room.hostUid)}
                            disabled={choosing}
                            className="py-2 px-5 rounded-lg text-text border border-border hover:bg-surfaceHover transition-colors font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                            I&apos;ll bowl first
                        </button>
                    </div>
                    {choosing && <Spinner label="Starting the draft…" className="text-sm text-textMuted" />}
                </div>
            )}
        </div>
    );
}
