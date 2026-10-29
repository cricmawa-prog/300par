import { handle, optionalCaller, readJson } from '../../../lib/server/http';
import { joinWaitlist } from '../../../lib/server/access';

export const dynamic = 'force-dynamic';

// Public: anyone can ask to join the beta (a signed-in caller's own email is used instead of the form's).
export const POST = handle(async (req) => joinWaitlist(await readJson(req), await optionalCaller(req)));
