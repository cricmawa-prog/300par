import { handle, requireCaller } from '../../../lib/server/http';
import { claimAccess } from '../../../lib/server/access';

export const dynamic = 'force-dynamic';

// Signed-in user asks to be let in: admins and allow-listed (verified) emails become members.
export const POST = handle(async (req) => claimAccess(await requireCaller(req)));
