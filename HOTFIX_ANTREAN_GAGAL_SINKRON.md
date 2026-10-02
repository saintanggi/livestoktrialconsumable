# Hotfix Antrean Gagal Sinkron

## Hasil pemeriksaan produksi
Pada 2 Oktober 2026:

- Internet dan endpoint baca Supabase normal (`HTTP 200`).
- `/api/supabase` dapat membaca data.
- `/api/health` masih `404`.
- `/api/auth` masih `404`.
- Proxy `/api/supabase` yang terpasang masih versi lama dan belum meneruskan header `Authorization` JWT.

Artinya pesan “Periksa internet” tidak akurat. Kegagalan dapat berasal dari retry data duplikat atau token Auth/RLS yang tidak diteruskan oleh API lama.

## Perbaikan

### 1. Retry dibuat idempotent
Antrean tidak lagi mengulang INSERT secara buta:
- Log transaksi menggunakan UPSERT berdasarkan ID.
- PO menggunakan UPSERT berdasarkan ID.
- Penerimaan PO menggunakan UPSERT berdasarkan ID.
- Master memeriksa kode terlebih dahulu; jika sudah ada maka UPDATE.
- Gerai memeriksa nama terlebih dahulu; jika sudah ada dianggap berhasil.

Jika transaksi sebenarnya sudah masuk pada percobaan pertama tetapi respons browser terputus, retry sekarang tidak gagal karena duplicate key.

### 2. Pesan error asli
Antrean sekarang menampilkan:
- Jenis aksi
- Target tabel
- Jumlah percobaan
- Pesan error Supabase sebenarnya

Sistem tidak lagi langsung menyebut internet bermasalah.

### 3. Antrean aman
- Item yang berhasil langsung dikeluarkan dari antrean.
- Item yang masih gagal tetap disimpan.
- Antrean tidak otomatis dihapus ketika gagal.
- Seluruh item diperiksa, tidak berhenti pada kegagalan pertama.

### 4. JWT/RLS
`api/supabase.js` terbaru meneruskan JWT Supabase Auth. File `api/auth.js` dan `api/health.js` juga harus di-upload karena saat pemeriksaan keduanya belum ada di deployment produksi.

## File wajib upload
- `index.html`
- `index_supabase.html`
- `api/supabase.js`
- `api/auth.js`
- `api/health.js`

File pendukung yang ikut paket:
- `api/daily-alert.js`
- `vercel.json`
- `package.json`

## Setelah deployment
1. Hard refresh `Ctrl + Shift + R`.
2. Jika RLS sudah diaktifkan, logout lalu login kembali menggunakan email Supabase, bukan username lama.
3. Klik tombol Sinkron satu kali.
4. Jika masih gagal, penyebab asli akan tertulis di kotak antrean dan dapat digunakan untuk diagnosis lanjutan.
