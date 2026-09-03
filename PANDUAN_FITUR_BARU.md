# Fitur Baru LiveStockConsumable

Fitur ditambahkan secara **additive** agar dashboard HO, AGEN, RETURN, transaksi, Supabase, email, dan PO yang sudah berjalan tidak diganti.

## 1. Beranda Ringkasan Eksekutif
Menu: **🏠 Beranda**

Menampilkan total stok global, jumlah kritis/waspada, IN/OUT hari ini, prediksi mendesak, dan aktivitas terbaru.

## 2. Prediksi Stok Habis
Menu: **🔮 Prediksi Stok**

Rumus:
- Rata-rata OUT/hari = total OUT 30 hari terakhir / 30
- Estimasi hari habis = stok akhir / rata-rata OUT per hari
- Perkiraan tanggal = tanggal hari ini + estimasi hari

Barang tanpa transaksi OUT ditandai `Tidak ada OUT`. Prediksi dapat difilter dan diunduh ke Excel.

## 3. Preview Upload Massal
Menu: **📁 Upload**

Alur baru:
1. Pilih file Excel.
2. Klik **Preview & Validasi**.
3. Sistem memeriksa tanggal, ticket, kode master, jenis IN/OUT, QTY, duplikat, dan kemungkinan stok negatif.
4. Data belum disimpan pada tahap preview.
5. Klik **Konfirmasi & Proses Data Valid** untuk sinkronisasi.

## 4. Download Semua Stok
Menu: **📥 Download & Rekap**

Tombol **Semua Stok (3 Sheet)** menghasilkan satu workbook dengan sheet HO, AGEN, dan RETURN. Filter tanggal rekap tetap dapat digunakan.

## 5. Rekomendasi PO Otomatis
Menu: **🧮 Rekomendasi PO**

Rumus rekomendasi:
`maksimum(0, kebutuhan 30 hari + buffer - stok akhir)`

Fitur hanya memberi rekomendasi dan **tidak otomatis membuat PO**, sehingga alur PO yang lama tidak berubah.

## 6. Backup dan Pemulihan
Menu admin: **🛡️ Backup & Pemulihan**

- Backup JSON lengkap untuk pemulihan.
- Backup Excel multi-sheet untuk dokumentasi.
- Pemulihan hanya menerima JSON backup sistem.
- Sistem menampilkan preview jumlah data.
- Memerlukan login admin, dialog konfirmasi, dan mengetik `PULIHKAN`.
- Pemulihan menggunakan upsert/merge berdasarkan ID dan tidak menghapus data yang sudah ada.
- Salinan keselamatan lokal dibuat pada `stock_pre_restore_safety` sebelum pemulihan.

## 7. Supabase Auth dan RLS
File `supabase_auth_rls_persiapan.sql` disiapkan dalam mode aman.

Bagian A hanya membuat tabel profil dan role. Bagian B sengaja dinonaktifkan karena aplikasi produksi masih menggunakan proxy anon. Jangan mengaktifkan policy ketat sebelum frontend dan proxy mendukung JWT user; jika dipaksakan sekarang, koneksi aplikasi dapat terputus.

## Deployment
Upload ke GitHub:
- `index.html` (wajib)
- `index_supabase.html` (salinan sinkron)
- `supabase_auth_rls_persiapan.sql` (dokumentasi/persiapan)
- `PANDUAN_FITUR_BARU.md` (panduan)

Tidak perlu mengubah file API untuk fitur frontend ini. Setelah Vercel selesai deploy, gunakan `Ctrl + Shift + R`.
