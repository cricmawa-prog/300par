// Server-only helpers shared by the API routes: verify the caller's Firebase ID token, check
// membership / admin, and turn thrown HttpErrors into JSON responses. Never import from a client
// component (it pulls in firebase-admin).
import { NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '../firebaseAdmin';

export class HttpError extends Error {
    constructor(status, message) {
        super(message);
        this.status = status;
    }
}

// Comma-separated in ADMIN_EMAILS; these two are the defaults for the private beta.
const DEFAULT_ADMINS = ['rishikeshdevarashetty@gmail.com', 'cricmawa@gmail.com'];

export function adminEmails() {
    const raw = process.env.ADMIN_EMAILS;
    const list = raw ? raw.split(',') : DEFAULT_ADMINS;
    return list.map((e) => e.trim().toLowerCase()).filter(Boolean);
}

// Only a VERIFIED email counts: an email+password account can type any address, so an unverified
// one must never unlock admin or an allow-listed invite.
export function verifiedEmail(authUser) {
    return authUser?.email && authUser.emailVerified ? authUser.email.toLowerCase() : null;
}

export function isAdminUser(authUser) {
    const email = verifiedEmail(authUser);
    return !!email && adminEmails().includes(email);
}

export async function optionalCaller(req) {
    const header = req.headers.get('authorization') || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return null;
    try {
        const decoded = await getAdminAuth().verifyIdToken(token);
        // Read the account itself (not just the token) so a just-verified email counts right away.
        const authUser = await getAdminAuth().getUser(decoded.uid);
        return { uid: decoded.uid, authUser };
    } catch {
        throw new HttpError(401, 'Your sign-in has expired. Refresh the page and try again.');
    }
}

export async function requireCaller(req) {
    const caller = await optionalCaller(req);
    if (!caller) throw new HttpError(401, 'Sign in first.');
    return caller;
}

export async function requireMember(req) {
    const caller = await requireCaller(req);
    const snap = await getAdminDb().doc(`members/${caller.uid}`).get();
    if (!snap.exists) throw new HttpError(403, 'Your account has not been approved yet.');
    return { ...caller, member: snap.data() };
}

export async function requireAdmin(req) {
    const caller = await requireCaller(req);
    if (!isAdminUser(caller.authUser)) throw new HttpError(403, 'Admins only.');
    return caller;
}

export async function readJson(req) {
    try {
        return await req.json();
    } catch {
        return {};
    }
}

// Wraps a route handler: HttpErrors become { error } with their status, anything else a 500.
export function handle(fn) {
    return async (req, ctx) => {
        try {
            const out = await fn(req, ctx);
            return NextResponse.json(out ?? { ok: true });
        } catch (err) {
            if (err instanceof HttpError) return NextResponse.json({ error: err.message }, { status: err.status });
            console.error('[api]', err);
            return NextResponse.json({ error: 'Something went wrong on the server.' }, { status: 500 });
        }
    };
}

export function appUrl(req) {
    return (process.env.APP_URL || new URL(req.url).origin).replace(/\/$/, '');
}
