interface Env { API?: { fetch(request: Request): Promise<Response> } }
export async function onRequest(context: { request: Request; env: Env }) {
  if (!context.env.API) return Response.json({ error: 'API service binding is not configured.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  // Preserve the browser origin and Secure Set-Cookie on the Pages host.
  return context.env.API.fetch(context.request);
}
