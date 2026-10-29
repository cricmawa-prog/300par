// Small inline loader for the duel flow, where a Firestore round-trip can take a second or two.
// It fades in only after a short delay (pure CSS - no timers or extra renders), so quick
// updates never flash a spinner and a spinner never adds work to the fast path.
export default function Spinner({ label, size = 16, className = '' }) {
    return (
        <span
            role="status"
            style={{ opacity: 0, animation: 'spinner-in 0.2s ease 0.45s forwards' }}
            className={`inline-flex items-center gap-2 ${className}`}
        >
            <span
                aria-hidden
                style={{ width: size, height: size }}
                className="inline-block rounded-full border-2 border-accent/30 border-t-accent animate-spin"
            />
            {label && <span>{label}</span>}
        </span>
    );
}
