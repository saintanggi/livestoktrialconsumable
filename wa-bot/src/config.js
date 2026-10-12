import 'dotenv/config';

function req(name) {
  const v = (process.env[name] || '').trim();
  if (!v) throw new Error(`ENV ${name} wajib diisi (lihat .env.example)`);
  return v;
}

export const config = {
  // digit saja, tanpa '+'. Contoh: "62812xxxx,62813yyyy"
  allowedSenders: (process.env.ALLOWED_SENDERS || '')
    .split(',')
    .map((s) => s.replace(/\D/g, ''))
    .filter(Boolean),
  // folder penyimpanan sesi login WA (hasil scan QR). Jangan dihapus/di-share.
  sessionDir: process.env.SESSION_DIR || './auth_info',
  supabase: {
    url: req('SUPABASE_URL'),
    anonKey: req('SUPABASE_ANON_KEY'),
  },
};
