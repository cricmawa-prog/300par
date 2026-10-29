// Server-only Firebase Admin SDK init. Never import this from a client component -
// it reads server-only env vars (no NEXT_PUBLIC_ prefix) and must not be bundled to the browser.
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

function buildCredential() {
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    // Private keys are usually pasted with literal "\n" sequences in env files; convert them
    // back to real newlines or the PEM key fails to parse.
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

    if (!projectId || !clientEmail || !privateKey) {
        throw new Error(
            'Missing Firebase Admin credentials. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, ' +
            'and FIREBASE_PRIVATE_KEY (from a Firebase service account key) in your server env.'
        );
    }

    return cert({ projectId, clientEmail, privateKey });
}

function getAdminApp() {
    const existing = getApps();
    if (existing.length) return existing[0];
    return initializeApp({ credential: buildCredential() });
}

export function getAdminDb() {
    return getFirestore(getAdminApp());
}

export function getAdminAuth() {
    return getAuth(getAdminApp());
}
