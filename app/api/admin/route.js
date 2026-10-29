import { HttpError, appUrl, handle, readJson, requireAdmin } from '../../../lib/server/http';
import { adminOverview, approveWaitlist, inviteEmails, rejectWaitlist, revokeMember } from '../../../lib/server/access';

export const dynamic = 'force-dynamic';

export const GET = handle(async (req) => {
    await requireAdmin(req);
    return adminOverview();
});

export const POST = handle(async (req) => {
    const admin = await requireAdmin(req);
    const body = await readJson(req);
    switch (body.action) {
        case 'approve':
            return approveWaitlist(admin.uid, body.email, appUrl(req));
        case 'reject':
            return rejectWaitlist(admin.uid, body.email);
        case 'invite':
            return inviteEmails(admin.uid, body.emails, appUrl(req));
        case 'revoke':
            return revokeMember(admin.uid, body.uid);
        default:
            throw new HttpError(400, 'Unknown action.');
    }
});
