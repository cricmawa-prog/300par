import { appUrl, handle, readJson, requireMember } from '../../../lib/server/http';
import { createTournament } from '../../../lib/server/tournaments';

export const dynamic = 'force-dynamic';

export const POST = handle(async (req) => createTournament(await requireMember(req), await readJson(req), appUrl(req)));
