// Util tanggal: parsing input user (Indonesia) -> ISO YYYY-MM-DD.
// Semua "hari ini" memakai zona Asia/Jakarta agar selaras dengan operasional.

const MONTHS = {
  jan: '01', januari: '01',
  feb: '02', februari: '02',
  mar: '03', maret: '03',
  apr: '04', april: '04',
  mei: '05',
  jun: '06', juni: '06',
  jul: '07', juli: '07',
  agu: '08', agustus: '08',
  sep: '09', september: '09',
  okt: '10', oktober: '10',
  nov: '11', november: '11',
  des: '12', desember: '12',
};

export function todayJakarta() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function pad(n) {
  return String(n).padStart(2, '0');
}

function validISO(y, m, d) {
  const yy = Number(y), mm = Number(m), dd = Number(d);
  if (!(yy >= 2000 && yy <= 2100 && mm >= 1 && mm <= 12 && dd >= 1 && dd <= 31)) return null;
  const dt = new Date(Date.UTC(yy, mm - 1, dd));
  if (dt.getUTCFullYear() !== yy || dt.getUTCMonth() !== mm - 1 || dt.getUTCDate() !== dd) return null;
  return `${y}-${pad(m)}-${pad(d)}`;
}

export function addDays(iso, n) {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

/**
 * Coba parse satu token tanggal. Kembalikan ISO atau null.
 * Didukung: 2026-10-10 | 10/10/2026 | 10/10 | 10-10-2026 | 10 okt | 10 okt 2026 | kemarin | hari ini
 */
export function parseDateToken(token, todayISO) {
  if (!token) return todayISO;
  const t = token.trim().toLowerCase();
  if (t === 'hari ini' || t === 'today') return todayISO;
  if (t === 'kemarin' || t === 'yesterday') return addDays(todayISO, -1);

  let m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return validISO(m[1], m[2], m[3]);

  m = t.match(/^(\d{1,2})[/\-.](\d{1,2})(?:[/\-.](\d{2,4}))?$/);
  if (m) {
    const y = m[3] ? (m[3].length === 2 ? `20${m[3]}` : m[3]) : todayISO.slice(0, 4);
    return validISO(y, m[2], m[1]);
  }

  m = t.match(/^(\d{1,2})\s+([a-z]+)(?:\s+(\d{4}))?$/);
  if (m && MONTHS[m[2]]) {
    const y = m[3] || todayISO.slice(0, 4);
    return validISO(y, MONTHS[m[2]], m[1]);
  }

  return null;
}

/**
 * Pisahkan query "stok ..." menjadi { keyword, dateISO }.
 * Tanggal boleh ditulis di akhir query, contoh: "stok lakban 10/10/2026".
 */
export function splitQueryDate(raw, todayISO) {
  const s = raw.trim();
  const patterns = [
    /^(.*?)[\s]+(\d{4}-\d{1,2}-\d{1,2})\s*$/,
    /^(.*?)[\s]+(\d{1,2}[/\-.]\d{1,2}(?:[/\-.]\d{2,4})?)\s*$/,
    /^(.*?)[\s]+(\d{1,2}\s+[a-z]+(?:\s+\d{4})?)\s*$/i,
    /^(.*?)[\s]+(kemarin|hari ini)\s*$/i,
  ];
  for (const re of patterns) {
    const m = s.match(re);
    if (m) {
      const dateISO = parseDateToken(m[2], todayISO);
      if (dateISO) return { keyword: m[1].trim(), dateISO, dateToken: m[2].trim() };
    }
  }
  return { keyword: s, dateISO: todayISO, dateToken: null };
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

export function formatID(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} ${MONTH_NAMES[m - 1]} ${y}`;
}
