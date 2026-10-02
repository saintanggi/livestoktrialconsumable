// Health check non-destruktif untuk dashboard Status Sistem.
const SUPABASE_URL = "https://qdljeibmnolizjprignz.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFkbGplaWJtbm9saXpqcHJpZ256Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYwMjcyMDEsImV4cCI6MjEwMTYwMzIwMX0.Z7Gw29C8r8fbg-FcvGVGsBUw1Drt6FXqMmYsVkkSjHk";

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const started = Date.now();
  let database = { ok: false, latency_ms: null };
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/master_barang?select=id&limit=1&apikey=${encodeURIComponent(SUPABASE_ANON_KEY)}`, {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` }
    });
    database = { ok: response.ok, status: response.status, latency_ms: Date.now() - started };
  } catch (error) {
    database = { ok: false, latency_ms: Date.now() - started, error: 'unreachable' };
  }
  return res.status(database.ok ? 200 : 503).json({
    ok: database.ok,
    checked_at: new Date().toISOString(),
    database,
    auth_proxy: { ok: true, mode: 'dual-transition' },
    cron: { configured: true, schedule_utc: '0 1 * * *', schedule_wib: '08:00 WIB' },
    runtime: 'vercel-serverless'
  });
};
