import { createClient } from '@supabase/supabase-js';
import { config } from './config.js';

// Anon key cukup: tabel master_barang & log_transaksi sudah bisa dibaca publik
// (sesuai RLS project Live Stock). Bot hanya SELECT, tidak pernah menulis.
export const supabase = createClient(config.supabase.url, config.supabase.anonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
