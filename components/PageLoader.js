'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';

const MIN_VISIBLE_MS = 750;
const INITIAL_MIN_MS = 1400; // first load of the app: let the logo reveal play out, counted from navigation start // long enough for the animation to read, short enough not to drag
const FADE_OUT_MS = 380;
const SAFETY_MS = 8000; // never get stuck if a navigation fails

// Deterministic pseudo-random so the ember field is stable between renders.
const EMBERS = Array.from({ length: 30 }, (_, i) => {
    const r = (n) => {
        const x = Math.sin((i + 1) * 12.9898 + n * 78.233) * 43758.5453;
        return x - Math.floor(x);
    };
    return {
        left: `${Math.round(r(1) * 100)}%`,
        size: `${(2 + r(2) * 5).toFixed(1)}px`,
        dur: `${(2.4 + r(3) * 2.6).toFixed(2)}s`,
        delay: `${(-r(4) * 5).toFixed(2)}s`,
        drift: `${Math.round((r(5) - 0.5) * 120)}px`,
    };
});

// Full-screen branded transition shown while moving between pages. It starts the instant an
// internal link is clicked (the App Router has no navigation events), and hides once the new
// pathname has rendered and the animation has been visible for MIN_VISIBLE_MS.
// For programmatic navigation (router.push) dispatch: window.dispatchEvent(new Event('srh:navigate'))
export default function PageLoader() {
    const pathname = usePathname();
    // Starts visible so the server-rendered HTML already carries the loader (it is what you see on first load).
    const [phase, setPhase] = useState('in'); // 'hidden' | 'in' | 'out'
    const phaseRef = useRef('in');
    const startedAt = useRef(0);
    const minMs = useRef(INITIAL_MIN_MS);
    const timers = useRef([]);

    function setPhaseBoth(p) {
        phaseRef.current = p;
        setPhase(p);
    }
    function clearTimers() {
        timers.current.forEach(clearTimeout);
        timers.current = [];
    }
    function finish() {
        clearTimers();
        const wait = Math.max(0, minMs.current - (Date.now() - startedAt.current));
        timers.current.push(
            setTimeout(() => {
                setPhaseBoth('out');
                timers.current.push(setTimeout(() => setPhaseBoth('hidden'), FADE_OUT_MS));
            }, wait)
        );
    }
    function start() {
        if (phaseRef.current === 'in') return;
        clearTimers();
        startedAt.current = Date.now();
        minMs.current = MIN_VISIBLE_MS;
        setPhaseBoth('in');
        timers.current.push(setTimeout(finish, SAFETY_MS));
    }

    // New page rendered (or, on first mount, the app hydrated) -> wind the loader down.
    useEffect(() => {
        if (phaseRef.current !== 'in') return;
        if (!startedAt.current) {
            startedAt.current = Date.now() - performance.now(); // initial load: count from navigation start
            timers.current.push(setTimeout(finish, SAFETY_MS));
        }
        finish();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pathname]);

    useEffect(() => {
        function onClick(e) {
            if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
            const a = e.target instanceof Element ? e.target.closest('a[href]') : null;
            if (!a || (a.target && a.target !== '_self') || a.hasAttribute('download')) return;
            let url;
            try {
                url = new URL(a.href, window.location.href);
            } catch {
                return;
            }
            if (url.origin !== window.location.origin) return;
            if (url.pathname === window.location.pathname) return; // same page / hash / query-only change
            start();
        }
        window.addEventListener('click', onClick, true);
        window.addEventListener('srh:navigate', start);
        return () => {
            window.removeEventListener('click', onClick, true);
            window.removeEventListener('srh:navigate', start);
            clearTimers();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    if (phase === 'hidden') return null;

    return (
        <div className={`srh-loader ${phase === 'out' ? 'srh-loader--out' : ''}`} role="status" aria-label="Loading">
            <div className="srh-loader__glow" />

            <div className="srh-loader__flames" aria-hidden>
                <span style={{ left: '4%', '--d': '0s', '--h': '46vh' }} />
                <span style={{ left: '20%', '--d': '-0.7s', '--h': '58vh' }} />
                <span style={{ left: '36%', '--d': '-1.3s', '--h': '50vh' }} />
                <span style={{ left: '52%', '--d': '-0.4s', '--h': '62vh' }} />
                <span style={{ left: '68%', '--d': '-1.1s', '--h': '52vh' }} />
                <span style={{ left: '84%', '--d': '-0.2s', '--h': '60vh' }} />
            </div>

            <div className="srh-loader__embers" aria-hidden>
                {EMBERS.map((e, i) => (
                    <i
                        key={i}
                        style={{ left: e.left, width: e.size, height: e.size, animationDuration: e.dur, animationDelay: e.delay, '--drift': e.drift }}
                    />
                ))}
            </div>

            <div className="srh-loader__stage">
                <span className="srh-loader__word font-display" aria-hidden>SRH</span>
                <img className="srh-loader__logo" src="/images/srh_loader.webp" alt="" draggable={false} />
            </div>

            <div className="srh-loader__bar" aria-hidden><span /></div>
        </div>
    );
}
