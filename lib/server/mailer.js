// Server-only email via nodemailer (SMTP). Email is always best-effort: every invite / approval
// is stored in Firestore first and shown in the app, so a mail failure never loses anything -
// callers get { sent: false } and the UI offers a resend. Unconfigured SMTP just logs.
import nodemailer from 'nodemailer';

let transporter = null;

function getTransporter() {
    if (transporter) return transporter;
    const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
    if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return null;
    const port = Number(SMTP_PORT || 465);
    transporter = nodemailer.createTransport({
        host: SMTP_HOST,
        port,
        secure: port === 465,
        auth: { user: SMTP_USER, pass: SMTP_PASS },
    });
    return transporter;
}

const escapeHtml = (s) =>
    String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

function layout({ heading, lines, ctaLabel, ctaUrl }) {
    const body = lines.map((l) => `<p style="margin:0 0 12px;color:#c9d1dc;font-size:15px;line-height:1.5">${escapeHtml(l)}</p>`).join('');
    return `<!doctype html><html><body style="margin:0;background:#0f1419;font-family:-apple-system,Segoe UI,Roboto,sans-serif">
<div style="max-width:480px;margin:0 auto;padding:28px 22px">
<p style="margin:0 0 18px;font-size:22px;font-weight:900;color:#ff6b1a;font-style:italic">300 <span style="color:#fff">PAR</span></p>
<h1 style="margin:0 0 14px;font-size:20px;color:#e8ecf1">${escapeHtml(heading)}</h1>
${body}
<a href="${escapeHtml(ctaUrl)}" style="display:inline-block;margin-top:8px;padding:11px 22px;border-radius:8px;background:#ff6b1a;color:#fff;font-weight:700;text-decoration:none">${escapeHtml(ctaLabel)}</a>
<p style="margin:26px 0 0;color:#8b96a8;font-size:12px">Private beta - you got this because someone added you on 300 Par.</p>
</div></body></html>`;
}

export async function sendMail({ to, subject, heading, lines, ctaLabel, ctaUrl }) {
    const t = getTransporter();
    if (!t) {
        console.warn(`[mail] SMTP not configured - skipped "${subject}" to ${to}`);
        return { sent: false };
    }
    try {
        await t.sendMail({
            from: process.env.MAIL_FROM || process.env.SMTP_USER,
            to,
            subject,
            text: [heading, '', ...lines, '', `${ctaLabel}: ${ctaUrl}`].join('\n'),
            html: layout({ heading, lines, ctaLabel, ctaUrl }),
        });
        return { sent: true };
    } catch (err) {
        console.error('[mail] send failed:', err?.message);
        return { sent: false };
    }
}

export const mails = {
    accessApproved: ({ to, url }) =>
        sendMail({
            to,
            subject: "You're in - 300 Par private beta",
            heading: "You've been approved",
            lines: ['Your spot in the 300 Par private beta is ready. Sign in with this email address (Google, or email + password) to start playing.'],
            ctaLabel: 'Sign in',
            ctaUrl: `${url}/signin`,
        }),
    tournamentInvite: ({ to, hostName, tournamentName, url }) =>
        sendMail({
            to,
            subject: `${hostName} invited you to "${tournamentName}"`,
            heading: `Tournament invite: ${tournamentName}`,
            lines: [
                `${hostName} wants you in a 300 Par round-robin tournament. Everyone plays everyone once, then the top sides go to the playoffs.`,
                'Accept or decline from your tournaments page.',
            ],
            ctaLabel: 'View invite',
            ctaUrl: `${url}/tournaments`,
        }),
    matchWaiting: ({ to, hostName, tournamentName, roomUrl }) =>
        sendMail({
            to,
            subject: `${hostName} is waiting for your ${tournamentName} match`,
            heading: 'Your match is ready',
            lines: [`${hostName} opened your ${tournamentName} fixture. The room stays open for 10 minutes - jump in to draft.`],
            ctaLabel: 'Join the match',
            ctaUrl: roomUrl,
        }),
};
