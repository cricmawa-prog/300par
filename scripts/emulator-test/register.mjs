// Lets plain Node run the app's extensionless ESM imports (`../firebaseAdmin`, `next/server`) the
// way webpack does: if a relative or package-subpath import fails, retry it with ".js".
import { register } from 'node:module';

register(
    'data:text/javascript,' +
        encodeURIComponent(`export async function resolve(spec, ctx, next) {
  try { return await next(spec, ctx); }
  catch (e) { if (!spec.endsWith('.js') && !spec.startsWith('node:')) return next(spec + '.js', ctx); throw e; }
}`)
);
