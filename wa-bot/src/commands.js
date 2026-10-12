import { findItems, getStockAt, formatStockReply, formatItemList } from './stock.js';
import { todayJakarta, splitQueryDate, formatID } from './dates.js';

// State disambiguasi: from -> { items, dateISO, expires }. In-memory, cukup untuk v1.
const pending = new Map();
const PENDING_TTL_MS = 5 * 60 * 1000;

function setPending(from, items, dateISO) {
  pending.set(from, { items, dateISO, expires: Date.now() + PENDING_TTL_MS });
}
function getPending(from) {
  const p = pending.get(from);
  if (!p) return null;
  if (Date.now() > p.expires) { pending.delete(from); return null; }
  return p;
}

const HELP = [
  'BOT STOK — perintah yang tersedia:',
  '',
  'stok <nama barang> [tanggal]',
  '  Cek stok akhir. Contoh:',
  '  - stok lakban',
  '  - stok lakban 10/10/2026',
  '  - stok seal bag kemarin',
  '  - stok karung 10 okt 2026',
  '',
  'cari <nama barang>',
  '  Lihat daftar barang yang cocok.',
  '',
  'bantuan',
  '  Tampilkan pesan ini.',
].join('\n');

async function handleStok(from, rawQuery) {
  const today = todayJakarta();
  const { keyword, dateISO, dateToken } = splitQueryDate(rawQuery, today);
  if (!keyword) return 'Tulis nama barangnya. Contoh: stok lakban';

  let items;
  try {
    items = await findItems(keyword);
  } catch (e) {
    return `Gagal membaca data stok: ${e.message}`;
  }

  if (items.length === 0) {
    return `Barang "${keyword}" tidak ketemu di master data.\nCoba kata kunci lain atau ketik: cari ${keyword}`;
  }
  if (items.length === 1) {
    try {
      const s = await getStockAt(items[0].kode, dateISO);
      return formatStockReply(s);
    } catch (e) {
      return `Gagal hitung stok: ${e.message}`;
    }
  }
  // Banyak yang cocok -> minta user memilih
  setPending(from, items, dateISO);
  const when = dateToken ? ` (per ${formatID(dateISO)})` : '';
  return formatItemList(items.slice(0, 8), `Ketemu ${items.length} barang${when}:`);
}

async function handlePilih(from, n) {
  const p = getPending(from);
  if (!p) return null;
  if (n < 1 || n > p.items.length) {
    return `Pilih nomor 1-${p.items.length}.`;
  }
  pending.delete(from);
  try {
    const s = await getStockAt(p.items[n - 1].kode, p.dateISO);
    return formatStockReply(s);
  } catch (e) {
    return `Gagal hitung stok: ${e.message}`;
  }
}

async function handleCari(rawQuery) {
  const kw = rawQuery.trim();
  if (!kw) return 'Tulis kata kuncinya. Contoh: cari lakban';
  let items;
  try {
    items = await findItems(kw);
  } catch (e) {
    return `Gagal membaca data: ${e.message}`;
  }
  if (items.length === 0) return `Tidak ada barang cocok dengan "${kw}".`;
  return formatItemList(items.slice(0, 10), `Hasil cari "${kw}":`);
}

/** Router utama: teks masuk -> teks balasan (atau null bila diabaikan). */
export async function handleMessage(from, text) {
  const t = (text || '').trim();
  if (!t) return null;

  // Jawaban atas daftar pilihan (hanya angka)
  if (/^\d{1,2}$/.test(t)) {
    const r = await handlePilih(from, Number(t));
    if (r) return r;
    // bukan jawaban atas pilihan -> lanjutkan sebagai perintah biasa
  }

  const lower = t.toLowerCase();
  if (lower === 'bantuan' || lower === 'help' || lower === 'menu' || lower === 'halo' || lower === 'pagi' || lower === 'siang' || lower === 'sore' || lower === 'malam') {
    return HELP;
  }
  if (lower.startsWith('stok ')) return handleStok(from, t.slice(5));
  if (lower === 'stok') return 'Tulis nama barangnya. Contoh: stok lakban';
  if (lower.startsWith('cari ')) return handleCari(t.slice(5));

  // Fallback: anggap sebagai nama barang langsung ("lakban" == "stok lakban")
  return handleStok(from, t);
}
