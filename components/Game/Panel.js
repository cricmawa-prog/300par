// Shared dark card with an accent bar + title, used by the draft screens (solo and duel).
export default function Panel({ title, badge, right, children, className = '', style, id }) {
    return (
        <section id={id} style={style} className={`bg-surface/85 backdrop-blur-sm border border-border rounded-2xl p-3 sm:p-4 flex flex-col gap-3 min-h-0 ${className}`}>
            <header className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                    <span className="w-1 h-6 rounded-full bg-accent shrink-0" />
                    <h2 className="font-display text-text text-base sm:text-lg truncate">{title}</h2>
                    {badge && (
                        <span className="px-3 py-1 rounded-full bg-accent text-white text-xs font-semibold tabular-nums shrink-0">
                            {badge}
                        </span>
                    )}
                </div>
                {right}
            </header>
            {children}
        </section>
    );
}
