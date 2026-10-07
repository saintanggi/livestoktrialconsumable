// Manajemen user Supabase Auth permanen.
// WAJIB: SUPABASE_SERVICE_ROLE_KEY disimpan di Vercel Environment Variables.
const SUPABASE_URL = "https://qdljeibmnolizjprignz.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFkbGplaWJtbm9saXpqcHJpZ256Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYwMjcyMDEsImV4cCI6MjEwMTYwMzIwMX0.Z7Gw29C8r8fbg-FcvGVGsBUw1Drt6FXqMmYsVkkSjHk";
const ALLOWED_ROLES = ['admin', 'operator', 'approver', 'viewer'];

async function parseResponse(response) {
  const text = await response.text();
  let body;
  try { body = text ? JSON.parse(text) : {}; } catch { body = { message: text }; }
  if (!response.ok) throw new Error(body.msg || body.message || body.error_description || body.error || `HTTP ${response.status}`);
  return body;
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) return res.status(503).json({ error: 'SUPABASE_SERVICE_ROLE_KEY belum dipasang di Vercel.' });
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return res.status(401).json({ error: 'Sesi login Supabase diperlukan.' });

  try {
    // Validasi JWT pemanggil.
    const caller = await parseResponse(await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` }
    }));
    const profileRows = await parseResponse(await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(caller.id)}&select=*`, {
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` }
    }));
    const callerProfile = profileRows[0];
    if (!callerProfile || callerProfile.active === false || callerProfile.role !== 'super_admin') {
      return res.status(403).json({ error: 'Hanya Super Admin yang dapat mengelola akun permanen.' });
    }

    const serviceHeaders = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' };

    if (req.method === 'GET') {
      const authData = await parseResponse(await fetch(`${SUPABASE_URL}/auth/v1/admin/users?page=1&per_page=1000`, { headers: serviceHeaders }));
      const profiles = await parseResponse(await fetch(`${SUPABASE_URL}/rest/v1/profiles?select=*`, { headers: serviceHeaders }));
      const profileMap = new Map((profiles || []).map(p => [p.id, p]));
      const users = (authData.users || []).map(u => {
        const p = profileMap.get(u.id) || {};
        return {
          id: u.id, email: u.email, login_name: p.login_name || u.user_metadata?.login_name || null, display_name: p.display_name || u.user_metadata?.display_name || u.email?.split('@')[0],
          role: p.role || 'viewer', active: p.active !== false,
          created_at: u.created_at, last_sign_in_at: u.last_sign_in_at || null,
          is_owner: u.id === caller.id
        };
      });
      return res.status(200).json({ success: true, users });
    }

    if (req.method === 'POST') {
      const loginType = String(req.body?.login_type || 'email');
      const rawLogin = String(req.body?.login || req.body?.email || '').trim().toLowerCase();
      const password = String(req.body?.password || '');
      const role = String(req.body?.role || 'viewer');
      let email = rawLogin;
      let loginName = null;
      if (loginType === 'username') {
        if (!/^[a-z0-9._-]{3,30}$/.test(rawLogin)) return res.status(400).json({ error: 'Username 3–30 karakter: huruf kecil, angka, titik, garis bawah, atau minus.' });
        loginName = rawLogin;
        email = `${rawLogin}@internal.livestock.local`;
        const existingLogin = await parseResponse(await fetch(`${SUPABASE_URL}/rest/v1/profiles?login_name=eq.${encodeURIComponent(loginName)}&select=id`, { headers: serviceHeaders }));
        if (existingLogin.length) return res.status(409).json({ error: 'Username sudah digunakan.' });
      } else if (!/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ error: 'Format email tidak valid.' });
      const displayName = String(req.body?.display_name || '').trim() || loginName || email.split('@')[0];
      if (password.length < 8) return res.status(400).json({ error: 'Password sementara minimal 8 karakter.' });
      if (!ALLOWED_ROLES.includes(role)) return res.status(400).json({ error: 'Role tidak diizinkan.' });
      const created = await parseResponse(await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
        method: 'POST', headers: serviceHeaders,
        body: JSON.stringify({ email, password, email_confirm: true, user_metadata: { display_name: displayName, login_name: loginName, login_type: loginType } })
      }));
      await parseResponse(await fetch(`${SUPABASE_URL}/rest/v1/profiles?on_conflict=id`, {
        method: 'POST', headers: { ...serviceHeaders, Prefer: 'resolution=merge-duplicates,return=representation' },
        body: JSON.stringify({ id: created.id, email, login_name: loginName, display_name: displayName, role, active: true, updated_at: new Date().toISOString() })
      }));
      return res.status(201).json({ success: true, id: created.id, email: loginName ? null : email, login_name: loginName, role });
    }

    const userId = String(req.body?.id || req.query?.id || '');
    if (!userId) return res.status(400).json({ error: 'ID user wajib diisi.' });
    if (userId === caller.id && req.method === 'DELETE') return res.status(400).json({ error: 'Super Admin tidak dapat menghapus akun sendiri.' });

    if (req.method === 'PATCH') {
      const updates = {};
      if (req.body?.role !== undefined) {
        if (!ALLOWED_ROLES.includes(String(req.body.role))) return res.status(400).json({ error: 'Role tidak diizinkan.' });
        updates.role = String(req.body.role);
      }
      if (req.body?.active !== undefined) updates.active = req.body.active === true;
      if (req.body?.display_name !== undefined) updates.display_name = String(req.body.display_name).trim();
      updates.updated_at = new Date().toISOString();
      await parseResponse(await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}`, {
        method: 'PATCH', headers: { ...serviceHeaders, Prefer: 'return=representation' }, body: JSON.stringify(updates)
      }));
      if (req.body?.password) {
        const password = String(req.body.password);
        if (password.length < 8) return res.status(400).json({ error: 'Password minimal 8 karakter.' });
        await parseResponse(await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${encodeURIComponent(userId)}`, {
          method: 'PUT', headers: serviceHeaders, body: JSON.stringify({ password })
        }));
      }
      return res.status(200).json({ success: true });
    }

    if (req.method === 'DELETE') {
      const targetProfiles = await parseResponse(await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}&select=role`, { headers: serviceHeaders }));
      if (targetProfiles[0]?.role === 'super_admin') return res.status(400).json({ error: 'Akun Super Admin tidak dapat dihapus dari aplikasi.' });
      await parseResponse(await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${encodeURIComponent(userId)}`, { method: 'DELETE', headers: serviceHeaders }));
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Admin users API error:', error);
    return res.status(500).json({ error: error.message || 'Gagal mengelola user.' });
  }
};
