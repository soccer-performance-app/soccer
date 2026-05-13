// api/generate.js
// Vercel serverless function — your API key lives in Vercel's environment variables, never in code.
//
// SETUP:
//   1. vercel env add ANTHROPIC_API_KEY   (paste your sk-ant-... key when prompted)
//   2. Deploy — Vercel injects the key at runtime, browsers never see it.

export const config = {
  runtime: 'edge', // Edge runtime for fastest cold starts and native streaming
};

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: 'ANTHROPIC_API_KEY not set in Vercel environment variables' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { system, messages, max_tokens } = body;

  // Call Anthropic and stream the response back to the browser
  const upstream = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type':       'application/json',
      'x-api-key':          apiKey,
      'anthropic-version':  '2023-06-01',
    },
    body: JSON.stringify({
      model:      'claude-opus-4-5',
      max_tokens: max_tokens || 8000,
      stream:     true,
      system,
      messages,
    }),
  });

  if (!upstream.ok) {
    const err = await upstream.text();
    return new Response(err, { status: upstream.status });
  }

  // Stream Anthropic's response directly to the client
  return new Response(upstream.body, {
    status: 200,
    headers: {
      'Content-Type':  'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection':    'keep-alive',
      // Allow your HTML file's origin — * is fine for a personal tool,
      // tighten to your exact domain for production (e.g. 'https://yourapp.vercel.app')
      'Access-Control-Allow-Origin': '*',
    },
  });
}
