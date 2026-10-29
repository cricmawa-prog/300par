import { HttpError, appUrl, handle, readJson, requireMember } from '../../../../lib/server/http';
import {
    cancelTournament,
    inviteMore,
    leaveTournament,
    playFixture,
    reportFixture,
    resendInvites,
    respondToInvite,
    settleFixture,
    startTournament,
} from '../../../../lib/server/tournaments';

export const dynamic = 'force-dynamic';

const FIXTURE_ID = /^(L\d{2}|SF|SF1|SF2|F)$/;

function fixtureId(body) {
    if (!FIXTURE_ID.test(body.fixtureId || '')) throw new HttpError(400, 'Unknown match.');
    return body.fixtureId;
}

// One endpoint, one `action` per tournament step. Each action is a single transaction server side.
export const POST = handle(async (req, { params }) => {
    const caller = await requireMember(req);
    const body = await readJson(req);
    const tid = params.id;
    switch (body.action) {
        case 'invite':
            return inviteMore(caller, tid, body, appUrl(req));
        case 'resend':
            return resendInvites(caller, tid, appUrl(req));
        case 'respond': {
            const out = await respondToInvite(caller, tid, body.accept === true);
            if (out.error) throw new HttpError(409, out.error);
            return out;
        }
        case 'leave':
            return leaveTournament(caller, tid);
        case 'start':
            return startTournament(caller, tid);
        case 'cancel':
            return cancelTournament(caller, tid);
        case 'play':
            return playFixture(caller, tid, fixtureId(body), body, appUrl(req));
        case 'report':
            return reportFixture(caller, tid, fixtureId(body));
        case 'settle':
            return settleFixture(caller, tid, fixtureId(body), body);
        default:
            throw new HttpError(400, 'Unknown action.');
    }
});
