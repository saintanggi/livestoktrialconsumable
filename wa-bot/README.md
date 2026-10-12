# Bot WA Cek Stok — Live Stock (Baileys)

Bot WhatsApp untuk menanyakan sisa stok barang langsung dari database
Live Stock (Supabase), termasuk **stok akhir per tanggal**.
Berjalan sebagai **sesi WhatsApp biasa** (seperti WhatsApp Web) — cukup
scan QR sekali dari HP kamu.

Contoh chat:

```
kamu : stok lakban
bot  : STOK: LAKBAN (BENING)
       Kode: HO_LAKB0001 | Satuan: ROLL | Status: HO
       Per tanggal: 12 Okt 2026

       Stok akhir: 7.862
       ...

kamu : stok seal bag 10/10/2026
bot  : STOK: SEAL BAG LIGHT YELLOW
       ...
       Per tanggal: 10 Okt 2026
       Stok akhir: 20
```

## Arsitektur

```
WhatsApp HP kamu ──> sesi Baileys (proses ini, Node.js)
                                │
                                ├─> baca master_barang (Supabase)
                                └─> baca log_transaksi (Supabase)
                                │
WhatsApp HP kamu <── balasan teks
```

Rumus stok **sama persis** dengan aplikasi web:
`stok akhir = stok awal (master_barang.awal) + total masuk − total keluar`
dari `log_transaksi` dengan `tanggal <= tanggal_diminta`.

## Cara menjalankan (5 menit)

```bash
cd wa-inventory-bot
cp .env.example .env
# isi SUPABASE_ANON_KEY dan ALLOWED_SENDERS di .env
npm install
npm start
```

1. QR code muncul di terminal.
2. Di HP: WhatsApp → **Perangkat Tertaut** → **Tautkan Perangkat** → scan QR.
3. Tunggu tulisan `bot online, siap menerima chat`.
4. Chat ke **nomor yang di-scan** dari nomor yang terdaftar di
   `ALLOWED_SENDERS`. (Catatan: kamu chat ke nomor bot itu sendiri —
   jadi butuh 2 nomor, atau chat dari HP lain. Lihat FAQ di bawah.)

Sesi login tersimpan di folder `./auth_info`. Selama folder itu ada dan
proses jalan, tidak perlu scan ulang.

## Env vars

| Var | Wajib | Keterangan |
|---|---|---|
| `SUPABASE_URL` | ya | Sudah terisi default project Live Stock |
| `SUPABASE_ANON_KEY` | ya | Anon key (publik, aman di server) |
| `ALLOWED_SENDERS` | disarankan | `62812xxxx` — nomor yang boleh memakai bot. Kosongkan = semua bisa chat |
| `SESSION_DIR` | tidak | Default `./auth_info` |

## Perintah bot

| Perintah | Contoh | Fungsi |
|---|---|---|
| `stok <nama> [tanggal]` | `stok lakban 10/10/2026` | Stok akhir per tanggal |
| `cari <nama>` | `cari seal bag` | Daftar barang yang cocok |
| `bantuan` | `bantuan` | Daftar perintah |

Format tanggal: `10/10/2026`, `10-10-2026`, `2026-10-10`, `10 okt`,
`10 okt 2026`, `kemarin`, `hari ini`. Tanpa tanggal = hari ini (WIB).

Kalau nama barang cocok dengan banyak item, bot menampilkan daftar
bernomor — balas dengan angkanya.

## Menjalankan 24/7

Bot harus **terus jalan**. Pilihan dari termudah:

1. **Komputer/laptop yang selalu nyala** — termudah & gratis.
   Di Windows bisa pakai `pm2` (`npm i -g pm2`, `pm2 start src/index.js`).
2. **VPS murah** (±Rp 60–90rb/bln) — ada `Dockerfile` siap pakai.
   Pastikan folder `auth_info` persisten (jangan dihapus tiap deploy).
3. **Railway/Fly.io dengan volume** — bisa, tapi butuh setting volume
   untuk `auth_info`. Render free tier **tidak cocok** (tidur otomatis
   → sesi putus).

## Hal yang perlu kamu tahu (jujur)

- Baileys itu **library tidak resmi** (meniru WhatsApp Web). Untuk
  pemakaian pribadi 1 orang volume wajar, risikonya kecil — tapi bukan
  nol. Kalau WhatsApp memutus sesi, cukup `npm start` + scan ulang QR.
- Jangan hapus folder `auth_info` kecuali mau pairing ulang.
- Jangan share isi `auth_info` ke siapa pun — itu sama dengan akses
  ke akun WhatsApp tersebut.
- Bot mengabaikan: pesan grup, pesan dari nomor tak terdaftar, dan
  pesan selain teks.

## FAQ

**Harus 2 nomor WA?**
Iya, idealnya. Bot login sebagai satu nomor (mis. nomor cadangan),
kamu chat ke nomor itu dari nomor utamamu. Satu HP bisa 2 nomor
dengan fitur multi-akun / dual SIM.

**QR tidak muncul / sesi sering logout?**
Pastikan jam sistem benar, koneksi stabil, dan HP tidak mematikan
WhatsApp (battery optimization). Kalau logout: hapus folder
`auth_info`, `npm start`, scan ulang.

## Roadmap v2 (kalau nanti butuh)

- Alert otomatis stok menipis (bandingkan dengan `master_barang.buffer`)
- Filter per gerai: `stok lakban gerai bekasi`
- Rekap stok otomatis tiap pagi via cron
