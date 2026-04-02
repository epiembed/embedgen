/**
 * Cloudflare Worker — GitHub OAuth token exchange proxy.
 *
 * Receives { code, code_verifier } from the browser,
 * exchanges it for an access token using the stored client secret,
 * and returns { access_token }.
 *
 * Required Worker environment variables (set in Cloudflare dashboard):
 *   GITHUB_CLIENT_ID     — OAuth App client ID
 *   GITHUB_CLIENT_SECRET — OAuth App client secret
 *
 * Deploy:
 *   npx wrangler deploy worker/index.js --name embedgen-oauth
 */

export default {
  async fetch(request, env) {
    // Allow the GitHub Pages origin
    const origin = request.headers.get('Origin') ?? '';
    const allowedOrigin = 'https://epiembed.github.io';

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: corsHeaders(allowedOrigin),
      });
    }

    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return new Response('Invalid JSON', { status: 400 });
    }

    const { code, code_verifier } = body;
    if (!code || !code_verifier) {
      return new Response('Missing code or code_verifier', { status: 400 });
    }

    const params = new URLSearchParams({
      client_id:     env.GITHUB_CLIENT_ID,
      client_secret: env.GITHUB_CLIENT_SECRET,
      code,
      code_verifier,
    });

    const ghResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
      body: params.toString(),
    });

    if (!ghResponse.ok) {
      return new Response('GitHub token exchange failed', { status: 502 });
    }

    const data = await ghResponse.json();

    if (data.error) {
      return new Response(JSON.stringify({ error: data.error_description ?? data.error }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders(allowedOrigin) },
      });
    }

    return new Response(JSON.stringify({ access_token: data.access_token }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders(allowedOrigin) },
    });
  },
};

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}
