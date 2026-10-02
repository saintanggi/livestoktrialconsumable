// Supabase Auth proxy — login/refresh/logout tanpa mengekspos service-role key.
const SUPABASE_URL = "https://qdljeibmnolizjprignz.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFkbGplaWJtbm9saXpqcHJpZ256Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYwMjcyMDEsImV4cCI6MjEwMTYwMzIwMX0.Z7Gw29C8r8fbg-FcvGVGsBUw1Drt6FXqMmYsVkkSjHk";

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method === 'GET') return res.status(200).json({ success: true, service: 'supabase-auth', mode: 'transition' });
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const action = String(req.body?.action || 'login');
  let url = '';
  let body = null;
  let token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');

  if (action === 'login') {
    url = `${SUPABASE_URL}/auth/v1/token?grant_type=password`;
    body = { email: String(req.body?.email || '').trim(), password: String(req.body?.password || '') };
    if (!body.email || !body.password) return res.status(400).json({ error: 'Email dan password wajib diisi' });
  } else if (action === 'refresh') {
    url = `${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`;
    body = { refresh_token: String(req.body?.refresh_token || '') };
    if (!body.refresh_token) return res.status(400).json({ error: 'Refresh token tidak tersedia' });
  } else if (action === 'logout') {
    url = `${SUPABASE_URL}/auth/v1/logout`;
    if (!token) return res.status(200).json({ success: true });
  } else {
    return res.status(400).json({ error: 'Action tidak dikenal' });
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${token || SUPABASE_ANON_KEY}`
      },
      body: body ? JSON.stringify(body) : undefined
    });
    const text = await response.text();
    let payload;
    try { payload = text ? JSON.parse(text) : {}; } catch { payload = { message: text }; }
    if (!response.ok) return res.status(response.status).json({ error: payload.error_description || payload.msg || payload.message || 'Autentikasi gagal' });
    return res.status(200).json(action === 'logout' ? { success: true } : payload);
  } catch (error) {
    console.error('Auth proxy error:', error);
    return res.status(500).json({ error: 'Layanan autentikasi tidak dapat dihubungi' });
  }
};
