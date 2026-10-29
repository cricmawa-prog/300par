// Route-level fallback. The branded loader lives in components/PageLoader.js (mounted in the
// root layout, covers first load and every page change), so this stays intentionally blank.
export default function Loading() {
    return <div className="min-h-[40vh]" aria-hidden />;
}
