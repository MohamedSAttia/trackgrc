// Track Ford GRC — temporary-access gate (Vercel Routing Middleware, no dependencies)
// Anyone with the link gets ONE hour from their first visit; after that the platform is closed for them.
// Env var (optional): LINK_SECRET — any long random text.
export const config = { matcher: ['/((?!robots\\.txt|favicon\\.ico).*)'] };

const AI_BOTS = /(GPTBot|ChatGPT|OAI-SearchBot|ClaudeBot|Claude-Web|anthropic-ai|Claude-User|CCBot|Google-Extended|PerplexityBot|Perplexity-User|Bytespider|Amazonbot|Applebot-Extended|cohere-ai|Diffbot|YouBot|meta-externalagent|FacebookBot|Timpibot|Omgili|ImagesiftBot|PetalBot|DuckAssistBot|MistralAI|AI2Bot)/i;
const enc = new TextEncoder();
const b64u = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

async function valid(token, secret) {
  if (!token || !secret) return 0;
  const [exp, sig] = String(token).split('.');
  const e = Number(exp);
  if (!e || !sig || e * 1000 < Date.now()) return 0;
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const good = b64u(await crypto.subtle.sign('HMAC', key, enc.encode(exp)));
  if (good.length !== sig.length) return 0;
  let d = 0; for (let i = 0; i < good.length; i++) d |= good.charCodeAt(i) ^ sig.charCodeAt(i);
  return d === 0 ? e : 0;
}
const cookieOf = (req, name) => (req.headers.get('cookie') || '').split(/;\s*/).map(c => c.split('=')).find(([k]) => k === name)?.slice(1).join('=');

const PAGE = (title, msg) => `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow,noai,noimageai"><title>${title}</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0A1B3D;color:#fff;font-family:Tahoma,Arial,sans-serif;padding:16px}
.c{max-width:480px;text-align:center;border:2px solid #C9973B;border-radius:18px;padding:28px;background:#06122B}
h1{color:#E2B85A;font-size:24px;margin:0 0 10px}p{color:#D6DCE8;line-height:1.8;margin:0 0 8px}small{color:#9AA3B4}</style></head>
<body><div class="c"><h1>${title}</h1><p>${msg}</p><p style="color:#E2B85A;font-weight:700">احضر الكورس من يوم الأحد 11 أكتوبر 2026 حتى الخميس 15 أكتوبر 2026 واحصل مع تراكفورد على الشهادة الدولية GRCP</p><p><a href="https://trackford.sa/class-details/%D8%A7%D9%84%D8%AA%D8%A7%D9%87%D9%8A%D9%84-%D9%84%D8%B4%D9%87%D8%A7%D8%AF%D8%A9-%D9%85%D8%AD%D8%AA%D8%B1%D9%81-%D8%A7%D9%84%D8%AD%D9%88%D9%83%D9%85%D8%A9-%D9%88%D8%A7%D9%84%D9%85%D8%AE%D8%A7%D8%B7%D8%B1-%D9%88%D8%A7%D9%84%D8%A7%D9%85%D8%AA%D8%AB%D8%A7%D9%84-GRCP" style="display:inline-block;background:#E2B85A;color:#0A1B3D;border-radius:999px;padding:9px 18px;font-weight:800;text-decoration:none">سجّل الآن</a></p><p>info@trackford.com · trackford.sa</p><small>تحت إشراف شركة تراكفورد العالمية · جميع الحقوق محفوظة لمحمد عطية</small></div></body></html>`;
const deny = (status, t, m) => new Response(PAGE(t, m), { status, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex, nofollow, noai, noimageai' } });

async function sign(v, secret) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return v + '.' + b64u(await crypto.subtle.sign('HMAC', key, enc.encode(v)));
}
const SESSION = 60 * 60; // each visitor: one hour from first visit

export default async function middleware(req) {
  const ua = req.headers.get('user-agent') || '';
  if (AI_BOTS.test(ua)) return deny(403, 'الوصول غير مسموح', 'هذا المحتوى محمي ولا يُسمح لأدوات الذكاء الاصطناعي أو الزواحف بالوصول إليه.');
  const secret = process.env.LINK_SECRET || 'tf-grc-default-secret-2026';
  const url = new URL(req.url);
  if (await valid(cookieOf(req, 'tf_access'), secret)) return; // active hour → continue
  // first visit gets one hour; a returning visitor whose hour has passed is blocked
  const first = cookieOf(req, 'tf_first');
  if (first && (await valid(first, secret))) {
    return deny(403, 'انتهت مدة الوصول', 'هذه المنصّة متاحة لكل زائر لمدة ساعة واحدة فقط، وقد انتهت مدتك.');
  }
  if (url.pathname.startsWith('/api/')) return new Response(JSON.stringify({ error: 'expired' }), { status: 401, headers: { 'content-type': 'application/json' } });
  const now = Math.floor(Date.now() / 1000);
  const access = await sign(String(now + SESSION), secret);
  const firstTok = await sign(String(now + 60 * 60 * 24 * 365), secret);
  const h = new Headers({ location: url.pathname + url.search, 'cache-control': 'no-store' });
  h.append('set-cookie', `tf_access=${access}; Path=/; Max-Age=${SESSION}; Secure; SameSite=Lax`);
  h.append('set-cookie', `tf_first=${firstTok}; Path=/; Max-Age=${60 * 60 * 24 * 365}; Secure; SameSite=Lax`);
  return new Response(null, { status: 302, headers: h });
}
