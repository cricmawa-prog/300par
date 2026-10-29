// Private-beta access, server side. Three collections, none writable from a browser:
//   members/{uid}        - who may use the app (role 'admin' | 'player'). Firestore rules check it.
//   allowlist/{email}    - verified emails an admin has let in (from the waitlist or a direct invite).
//   waitlist/{email}     - requests to join, waiting for an admin.
// A signed-in user becomes a member by calling /api/access: admins (ADMIN_EMAILS) and allow-listed
// emails are let in, but only once the email is verified.
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb, getAdminAuth } from '../firebaseAdmin';
import { HttpError, isAdminUser, verifiedEmail } from './http';
import { mails } from './mailer';

const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/;

export function normaliseEmail(email) {
    const e = String(email || '').trim().toLowerCase();
    if (!EMAIL_RE.test(e)) throw new HttpError(400, `"${email}" doesn't look like an email address.`);
    return e;
}

const clean = (s, max) => String(s || '').trim().slice(0, max);

export async function claimAccess({ uid, authUser }) {
    const db = getAdminDb();
    const memberRef = db.doc(`members/${uid}`);
    const existing = await memberRef.get();
    if (existing.exists) return { member: true, role: existing.data().role };

    const email = verifiedEmail(authUser);
    const base = { uid, email: email || authUser.email || null, approvedAt: FieldValue.serverTimestamp() };
    if (isAdminUser(authUser)) {
        await memberRef.set({ ...base, role: 'admin', via: 'admin-email' });
        return { member: true, role: 'admin' };
    }
    if (email) {
        const allowed = await db.doc(`allowlist/${email}`).get();
        if (allowed.exists) {
            await memberRef.set({ ...base, role: 'player', via: allowed.data().source || 'allowlist' });
            return { member: true, role: 'player' };
        }
    }
    const wait = authUser.email ? await db.doc(`waitlist/${authUser.email.toLowerCase()}`).get() : null;
    return {
        member: false,
        emailVerified: !!authUser.emailVerified,
        waitlist: wait?.exists ? wait.data().status : null,
    };
}

// Public (no account needed). A signed-in caller's own verified email wins over the form field,
// so nobody can queue someone else's address from their account. Re-joining never resets a
// decision: an approved or rejected entry just reports its status.
export async function joinWaitlist(body, caller) {
    const db = getAdminDb();
    const email = normaliseEmail(caller ? verifiedEmail(caller.authUser) || caller.authUser.email : body.email);
    const name = clean(body.name, 40);
    if (name.length < 2) throw new HttpError(400, 'Tell us your name.');
    if (await db.doc(`allowlist/${email}`).get().then((s) => s.exists)) return { status: 'approved' };
    const ref = db.doc(`waitlist/${email}`);
    const out = await db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        if (snap.exists) return snap.data().status;
        tx.set(ref, {
            email,
            name,
            note: clean(body.note, 280),
            uid: caller?.uid || null,
            status: 'pending',
            createdAt: FieldValue.serverTimestamp(),
        });
        return 'pending';
    });
    return { status: out };
}

async function allow(email, adminUid, source) {
    await getAdminDb().doc(`allowlist/${email}`).set({ email, source, addedBy: adminUid, addedAt: FieldValue.serverTimestamp() }, { merge: true });
}

export async function adminOverview() {
    const db = getAdminDb();
    const [waitlist, members] = await Promise.all([
        db.collection('waitlist').where('status', '==', 'pending').limit(200).get(),
        db.collection('members').limit(500).get(),
    ]);
    const ts = (t) => (t?.toMillis ? t.toMillis() : null);
    const users = members.docs.length
        ? await db.getAll(...members.docs.map((d) => db.doc(`users/${d.id}`)))
        : [];
    const usernames = Object.fromEntries(users.map((u) => [u.id, u.exists ? u.data().username : null]));
    return {
        waitlist: waitlist.docs
            .map((d) => ({ email: d.id, name: d.data().name, note: d.data().note, createdAt: ts(d.data().createdAt) }))
            .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0)),
        members: members.docs
            .map((d) => ({ uid: d.id, email: d.data().email, role: d.data().role, username: usernames[d.id] || null, approvedAt: ts(d.data().approvedAt) }))
            .sort((a, b) => (b.approvedAt || 0) - (a.approvedAt || 0)),
    };
}

export async function approveWaitlist(adminUid, emailRaw, url) {
    const email = normaliseEmail(emailRaw);
    const ref = getAdminDb().doc(`waitlist/${email}`);
    const snap = await ref.get();
    if (!snap.exists) throw new HttpError(404, 'That request is gone.');
    await allow(email, adminUid, 'waitlist');
    await ref.update({ status: 'approved', decidedBy: adminUid, decidedAt: FieldValue.serverTimestamp() });
    const mail = await mails.accessApproved({ to: email, url });
    return { emailSent: mail.sent };
}

export async function rejectWaitlist(adminUid, emailRaw) {
    const email = normaliseEmail(emailRaw);
    await getAdminDb().doc(`waitlist/${email}`).update({ status: 'rejected', decidedBy: adminUid, decidedAt: FieldValue.serverTimestamp() });
    return {};
}

// Admin invites people directly by email (no waitlist step).
export async function inviteEmails(adminUid, emailsRaw, url) {
    const list = [...new Set((Array.isArray(emailsRaw) ? emailsRaw : String(emailsRaw || '').split(/[\s,;]+/)).filter(Boolean).map(normaliseEmail))];
    if (!list.length) throw new HttpError(400, 'Add at least one email.');
    if (list.length > 25) throw new HttpError(400, 'Up to 25 emails at a time.');
    const results = [];
    for (const email of list) {
        await allow(email, adminUid, 'admin-invite');
        const wait = getAdminDb().doc(`waitlist/${email}`);
        if ((await wait.get()).exists) await wait.update({ status: 'approved', decidedBy: adminUid, decidedAt: FieldValue.serverTimestamp() });
        const mail = await mails.accessApproved({ to: email, url });
        results.push({ email, emailSent: mail.sent });
    }
    return { results };
}

// Removes a player's access (admins can't be revoked here - they come from ADMIN_EMAILS).
export async function revokeMember(adminUid, uid) {
    const db = getAdminDb();
    const ref = db.doc(`members/${uid}`);
    const snap = await ref.get();
    if (!snap.exists) return {};
    if (snap.data().role === 'admin') throw new HttpError(400, "Admins can't be removed here.");
    if (uid === adminUid) throw new HttpError(400, "You can't remove yourself.");
    const email = snap.data().email;
    await ref.delete();
    if (email) await db.doc(`allowlist/${email}`).delete();
    // Revoke refresh tokens so the next token refresh signs them out of Firestore access too.
    await getAdminAuth().revokeRefreshTokens(uid).catch(() => {});
    return {};
}
