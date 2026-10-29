import {
    GoogleAuthProvider,
    createUserWithEmailAndPassword,
    sendEmailVerification,
    sendPasswordResetEmail,
    signInWithEmailAndPassword,
    signInWithPopup,
    signInWithRedirect,
    signOut as fbSignOut,
    updateProfile,
} from 'firebase/auth';
import { doc, getDoc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebase';

// Usernames: letters, digits, underscore, dot, dash. Unique case-insensitively; the lower-cased
// name is the document id of `usernames/{lower}`, which is what enforces uniqueness (a
// transaction claims it) and lets the sign-up form check availability with a single read.
export const USERNAME_PATTERN = /^[a-zA-Z0-9_.-]{3,30}$/;

export function validateUsername(username) {
    if (!USERNAME_PATTERN.test(username || '')) {
        return 'Username must be 3-30 characters: letters, numbers, _ . -';
    }
    return null;
}

export async function isUsernameAvailable(username, uid = null) {
    const snap = await getDoc(doc(db, 'usernames', username.toLowerCase()));
    return !snap.exists() || snap.data().uid === uid;
}

// Claims `username` for `uid` and writes/updates users/{uid}. Releases the user's previous
// username if they had one. Throws Error('USERNAME_TAKEN') if somebody else owns it.
export async function claimUsername(uid, username, { photoURL } = {}) {
    const problem = validateUsername(username);
    if (problem) throw new Error(problem);
    const lower = username.toLowerCase();
    await runTransaction(db, async (tx) => {
        const nameRef = doc(db, 'usernames', lower);
        const userRef = doc(db, 'users', uid);
        const [nameSnap, userSnap] = await Promise.all([tx.get(nameRef), tx.get(userRef)]);
        if (nameSnap.exists() && nameSnap.data().uid !== uid) throw new Error('USERNAME_TAKEN');
        const prev = userSnap.exists() ? userSnap.data() : null;
        if (prev?.usernameLower && prev.usernameLower !== lower) tx.delete(doc(db, 'usernames', prev.usernameLower));
        tx.set(nameRef, { uid, username });
        tx.set(
            userRef,
            {
                username,
                usernameLower: lower,
                displayName: username,
                photoURL: photoURL ?? prev?.photoURL ?? null,
                // createdAt orders the opponent list - never drop it for existing users.
                createdAt: prev?.createdAt ?? serverTimestamp(),
            },
            { merge: true }
        );
    });
}

export async function signInWithGoogle() {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    try {
        return await signInWithPopup(auth, provider);
    } catch (err) {
        // Popups can be blocked (some mobile browsers / in-app browsers): fall back to a redirect.
        if (err.code === 'auth/popup-blocked' || err.code === 'auth/operation-not-supported-in-this-environment') {
            await signInWithRedirect(auth, provider);
            return null;
        }
        throw err;
    }
}

// Accounts that signed up with just a username + password (Clerk allowed that) have no real
// email; the migration gave them a placeholder one derived from the username, and typing a
// username (no "@") in the sign-in form maps to it.
export const USERNAME_EMAIL_DOMAIN = 'srh-username.local';

export function signInWithEmail(identifier, password) {
    const id = identifier.trim();
    const email = id.includes('@') ? id : `${id.toLowerCase()}@${USERNAME_EMAIL_DOMAIN}`;
    return signInWithEmailAndPassword(auth, email, password);
}

export async function signUpWithEmail({ email, password, username }) {
    const problem = validateUsername(username);
    if (problem) throw new Error(problem);
    if (!(await isUsernameAvailable(username))) throw new Error('USERNAME_TAKEN');
    const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
    await updateProfile(cred.user, { displayName: username });
    // If somebody grabbed the name in the instant since the check above, the profile gate sends
    // the new user to the username screen instead of leaving them stuck.
    await claimUsername(cred.user.uid, username).catch(() => {});
    sendEmailVerification(cred.user).catch(() => {});
    return cred;
}

export function sendPasswordReset(email) {
    return sendPasswordResetEmail(auth, email.trim());
}

export function signOut() {
    return fbSignOut(auth);
}

// Firebase error codes -> plain language.
export function friendlyAuthError(err) {
    const code = err?.code || '';
    const map = {
        'auth/invalid-credential': 'Wrong email or password.',
        'auth/wrong-password': 'Wrong email or password.',
        'auth/user-not-found': 'No account with that email.',
        'auth/invalid-email': 'That email address does not look right.',
        'auth/email-already-in-use': 'An account with this email already exists - try signing in (or "Continue with Google").',
        'auth/weak-password': 'Password must be at least 6 characters.',
        'auth/too-many-requests': 'Too many attempts. Wait a minute and try again.',
        'auth/popup-closed-by-user': 'Sign-in was cancelled.',
        'auth/cancelled-popup-request': 'Sign-in was cancelled.',
        'auth/network-request-failed': 'Network problem - check your connection and try again.',
        'auth/account-exists-with-different-credential': 'This email is already registered with a different sign-in method.',
        'auth/unauthorized-domain': 'This domain is not authorised for sign-in yet (add it under Firebase Authentication -> Settings -> Authorized domains).',
        'auth/operation-not-allowed': 'This sign-in method is not enabled in Firebase yet.',
    };
    if (map[code]) return map[code];
    if (err?.message === 'USERNAME_TAKEN') return 'That username is already taken.';
    return err?.message || 'Something went wrong. Please try again.';
}
