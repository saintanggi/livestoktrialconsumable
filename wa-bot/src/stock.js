import { supabase } from './supabase.js';
import { formatID } from './dates.js';

// Konversi angka PERSIS seperti aplikasi web (function num() di frontend):
// "-" / null / "" -> 0, selain itu Number(v).
function num(v) {
  if (v === null || v === undefined || v === '' || v === '-') return 0;
  return Number(v) || 0;
}

function fmtQty(v) {
  const n = Math.round((Number(v) + Number.EPSILON) * 1000) / 1000;
  return n.toLocaleString('id-ID');
}

function escapeLike(s) {
  return s.replace(/[%_\\]/g, (c) => `\\${c}`);
}

/** Cari barang di master_barang berdasarkan nama atau kode (case-insensitive). */
export async function findItems(keyword) {
  const kw = escapeLike(keyword.trim());
  if (!kw) return [];
  const { data, error } = await supabase
    .from('master_barang')
    .select('kode,item,satuan,status,awal')
    .or(`item.ilike.%${kw}%,kode.ilike.%${kw}%`)
    .limit(10);
  if (error) throw new Error(`Gagal cari barang: ${error.message}`);
  return data || [];
}

/**
 * Hitung stok akhir SATU barang per tanggal (inklusif).
 * Rumus = stok awal (master_barang.awal) + total masuk - total keluar
 * dari log_transaksi dengan tanggal <= dateISO. Sama persis dengan web.
 */
export async function getStockAt(kode, dateISO) {
  const { data: item, error: itemErr } = await supabase
    .from('master_barang')
    .select('kode,item,satuan,status,awal')
    .eq('kode', kode)
    .single();
  if (itemErr) throw new Error(`Barang ${kode} tidak ditemukan`);

  let totalIn = 0, totalOut = 0, nIn = 0, nOut = 0;
  const outPerGerai = new Map();
  const PAGE = 1000;
  let from = 0;

  for (;;) {
    const { data, error } = await supabase
      .from('log_transaksi')
      .select('in,out,nama_gerai,tanggal')
      .eq('kode_item', kode)
      .lte('tanggal', dateISO)
      .order('tanggal', { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`Gagal baca transaksi: ${error.message}`);
    if (!data || data.length === 0) break;
    for (const r of data) {
      const vIn = num(r.in), vOut = num(r.out);
      if (vIn > 0) { totalIn += vIn; nIn++; }
      if (vOut > 0) {
        totalOut += vOut; nOut++;
        const g = (r.nama_gerai || '-').trim() || '-';
        outPerGerai.set(g, (outPerGerai.get(g) || 0) + vOut);
      }
    }
    if (data.length < PAGE) break;
    from += PAGE;
  }

  const awal = num(item.awal);
  return {
    item,
    dateISO,
    awal,
    totalIn,
    totalOut,
    nIn,
    nOut,
    akhir: awal + totalIn - totalOut,
    outPerGerai: [...outPerGerai.entries()].sort((a, b) => b[1] - a[1]),
  };
}

/** Format jawaban WhatsApp: plain text, tanpa markdown berat. */
export function formatStockReply(s) {
  const lines = [];
  lines.push(`STOK: ${s.item.item}`);
  lines.push(`Kode: ${s.item.kode} | Satuan: ${s.item.satuan || '-'} | Status: ${s.item.status || '-'}`);
  lines.push(`Per tanggal: ${formatID(s.dateISO)}`);
  lines.push('');
  lines.push(`Stok akhir: ${fmtQty(s.akhir)}`);
  lines.push('');
  lines.push('Rincian:');
  lines.push(`- Stok awal : ${fmtQty(s.awal)}`);
  lines.push(`- Masuk     : ${fmtQty(s.totalIn)} (${s.nIn} trx)`);
  lines.push(`- Keluar    : ${fmtQty(s.totalOut)} (${s.nOut} trx)`);
  if (s.outPerGerai.length > 0) {
    lines.push('');
    lines.push('Keluar per gerai (teratas):');
    for (const [g, q] of s.outPerGerai.slice(0, 5)) {
      lines.push(`- ${g}: ${fmtQty(q)}`);
    }
    if (s.outPerGerai.length > 5) lines.push(`- ... +${s.outPerGerai.length - 5} gerai lain`);
  }
  return lines.join('\n');
}

export function formatItemList(items, title = 'Barang ditemukan:') {
  const lines = [title, ''];
  items.forEach((it, i) => {
    lines.push(`${i + 1}. ${it.item} (${it.kode})`);
  });
  lines.push('');
  lines.push('Balas dengan nomornya, atau ketik nama yang lebih spesifik.');
  return lines.join('\n');
}
