// Full-screen team backdrop: /public/images/background/{code}_bg_desktop.png and _bg_mobile.png.
// The SRH image is layered underneath so a team without its own image falls back to it.
// Render inside a `relative` page and put the content in a `relative z-10` wrapper.
export default function TeamBackground({ code = 'srh', vivid = false }) {
    const c = code.toLowerCase();
    const vars = {
        '--bg-d': `url('/images/background/${c}_bg_desktop.png'), url('/images/background/srh_bg_desktop.png')`,
        '--bg-m': `url('/images/background/${c}_bg_mobile.png'), url('/images/background/srh_bg_mobile.png')`,
        animation: 'srh-fade-in 0.5s ease both',
    };
    return (
        <>
            <div
                key={c}
                aria-hidden
                style={vars}
                className="fixed inset-0 z-0 bg-cover bg-no-repeat bg-[position:70%_center] md:bg-[position:88%_center] bg-[image:var(--bg-m)] md:bg-[image:var(--bg-d)]"
            />
            <div
                aria-hidden
                className={`fixed inset-0 z-0 bg-gradient-to-b ${
                    vivid ? 'from-black/15 via-black/20 to-bg/60' : 'from-black/50 via-bg/65 to-bg/90'
                }`}
            />
        </>
    );
}
