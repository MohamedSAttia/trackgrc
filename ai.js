// Vercel serverless function — proxies the AI analysis to the Anthropic API.
// Set ANTHROPIC_API_KEY in Vercel → Project → Settings → Environment Variables.
// Optional: ANTHROPIC_MODEL (default claude-sonnet-5).
export default async function handler(req, res) {
  if (req.method === 'GET') return res.status(process.env.ANTHROPIC_API_KEY ? 200 : 503).json({ ok: !!process.env.ANTHROPIC_API_KEY });
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return res.status(503).json({ error: 'ANTHROPIC_API_KEY is not set' });
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const messages = (Array.isArray(body?.messages) ? body.messages : [])
      .filter(m => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
      .slice(-14).map(m => ({ role: m.role, content: m.content.slice(0, 60000) }));
    if (!messages.length || messages[messages.length - 1].role !== 'user') return res.status(400).json({ error: 'bad_messages' });
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-5', max_tokens: Math.min(Math.max(+body.max_tokens || 4000, 256), 8000), ...(typeof body.system === 'string' && body.system ? { system: body.system.slice(0, 20000) } : {}), messages }),
    });
    const d = await r.json();
    if (!r.ok) return res.status(r.status === 429 ? 429 : 502).json({ error: d?.error?.message || 'upstream_error' });
    const text = (d.content || []).filter(c => c.type === 'text').map(c => c.text).join('');
    return res.status(200).json({ text });
  } catch (e) {
    return res.status(500).json({ error: 'server_error' });
  }
}
