// api/daily-alert.js
const nodemailer = require('nodemailer');

module.exports = async (req, res) => {
  // Hanya jalankan jika dipanggil otomatis oleh Vercel Cron atau manual untuk testing
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const SUPABASE_URL = "https://qdljeibmnolizjprignz.supabase.co";
  const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFkbGplaWJtbm9saXpqcHJpZ256Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYwMjcyMDEsImV4cCI6MjEwMTYwMzIwMX0.Z7Gw29C8r8fbg-FcvGVGsBUw1Drt6FXqMmYsVkkSjHk";
  const headers = {
    "apikey": SUPABASE_ANON_KEY,
    "Authorization": `Bearer ${SUPABASE_ANON_KEY}`
  };

  try {
    // 1. Ambil Setelan Email Pengirim & Penerima dari Supabase
    const settingsUrl = `${SUPABASE_URL}/rest/v1/email_settings?select=*&limit=1`;
    const settingsRes = await fetch(settingsUrl, { headers });
    const settingsData = await settingsRes.json();

    if (!settingsData || settingsData.length === 0) {
      return res.status(200).json({ success: false, message: "Setelan email belum dikonfigurasi di database." });
    }

    const s = settingsData[0];
    if (!s.active || !s.target_email || !s.smtp_user || !s.smtp_pass) {
      return res.status(200).json({ success: false, message: "Pemberitahuan email dinonaktifkan atau setelan SMTP tidak lengkap." });
    }

    // 2. Tarik Data Master Barang dari Supabase
    const masterUrl = `${SUPABASE_URL}/rest/v1/master_barang?select=*`;
    const masterRes = await fetch(masterUrl, { headers });
    const dbMaster = await masterRes.json();

    // 3. Tarik Data Log Transaksi dari Supabase
    const logsUrl = `${SUPABASE_URL}/rest/v1/log_transaksi?select=*`;
    const logsRes = await fetch(logsUrl, { headers });
    const dbLogs = await logsRes.json();

    // --- REKALKULASI STOK SERVER-SIDE ---
    const ho = {}, agen = {}, ret = {};
    (dbMaster || []).forEach(m => {
      const obj = {
        kode: m.kode,
        item: m.item,
        satuan: m.satuan || 'PCS',
        buffer: parseInt(m.buffer) || 0,
        awal: parseInt(m.awal) || 0,
        akhir: parseInt(m.awal) || 0,
        status_item: m.status
      };
      if (m.status === 'HO') ho[m.kode] = obj;
      else if (m.status === 'AGEN') agen[m.kode] = obj;
      else if (m.status === 'RETURN') ret[m.kode] = obj;
    });

    (dbLogs || []).forEach(l => {
      let targetMap = ho;
      if (l.status_item === 'AGEN') targetMap = agen;
      else if (l.status_item === 'RETURN') targetMap = ret;
      
      const item = targetMap[l.kode_item];
      if (item) {
        if (l.in !== '-') item.akhir += parseInt(l.in) || 0;
        if (l.out !== '-') item.akhir -= parseInt(l.out) || 0;
      }
    });

    // Identifikasi barang yang Kritis & Waspada saat ini
    const riskItems = [];
    const checkRisk = (item) => {
      const s = item.akhir;
      const b = item.buffer;
      let status = 'ok';
      if (s < 0 || (b > 0 && s < b)) status = 'crit';
      else if (b > 0 && s < b * 1.2) status = 'warn';
      
      if (status === 'crit' || status === 'warn') {
        riskItems.push({ ...item, status });
      }
    };

    Object.values(ho).forEach(checkRisk);
    Object.values(agen).forEach(checkRisk);
    Object.values(ret).forEach(checkRisk);

    // 4. JIKA TIDAK ADA BARANG RISIKO: Tidak perlu mengirim email harian!
    if (riskItems.length === 0) {
      console.log("Semua barang aman. Tidak ada pengiriman email harian.");
      return res.status(200).json({ success: true, message: "Semua barang aman. Pengiriman email harian dilewati." });
    }

    // 5. JIKA ADA BARANG RISIKO: Susun dan kirim email Laporan Rangkuman Harian!
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: s.smtp_user,
        pass: s.smtp_pass
      }
    });

    const emailRowsHtml = riskItems.map((r, idx) => {
      const category = r.status === 'crit' ? 'KRITIS' : 'WASPADA';
      const color = r.status === 'crit' ? '#ff6b6b' : '#f2a93b';
      return `
        <tr style="border-bottom: 1px solid #23203f;">
          <td style="padding: 10px 8px; color: #fff; font-weight: 600;">${idx + 1}</td>
          <td style="padding: 10px 8px;">
            <div style="font-size: 13px; color: #fff; font-weight: bold;">${r.item}</div>
            <div style="font-size: 11px; color: #8b949e; font-family: monospace;">${r.kode}</div>
          </td>
          <td style="padding: 10px 8px; font-weight: bold; color: #58a6ff; text-align: center;">${r.status_item}</td>
          <td style="padding: 10px 8px; font-weight: bold; color: #fff; text-align: center;">${r.satuan}</td>
          <td style="padding: 10px 8px; font-weight: bold; color: #e1dfec; text-align: right;">${r.buffer.toLocaleString('id-ID')}</td>
          <td style="padding: 10px 8px; font-weight: bold; color: ${color}; text-align: right; font-size: 14px;">${r.akhir.toLocaleString('id-ID')}</td>
          <td style="padding: 10px 8px; text-align: center;">
            <span style="background: ${color}20; color: ${color}; border: 1px solid ${color}44; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: bold; display: inline-block;">${category}</span>
          </td>
        </tr>
      `;
    }).join('');

    const subject = `📋 [LAPORAN HARIAN GUDANG] Terdeteksi ${riskItems.length} Barang Membutuhkan Restock`;

    const htmlContent = `
      <div style="font-family: 'Inter', Helvetica, Arial, sans-serif; max-width: 650px; margin: 0 auto; border: 1px solid #23203f; border-radius: 12px; overflow: hidden; background: #0c0a18; box-shadow: 0 8px 32px rgba(0,0,0,0.3); color: #e1dfec;">
        <div style="background: linear-gradient(135deg, #131024, #7c3aed44); border-bottom: 1px solid #23203f; padding: 28px; text-align: center;">
          <span style="font-size: 36px;">📋</span>
          <h1 style="margin: 10px 0 0 0; font-size: 22px; font-weight: 800; color: #fff; letter-spacing: -0.5px;">LAPORAN STOK HARIAN GUDANG</h1>
          <p style="margin: 4px 0 0 0; font-size: 13px; color: #ff6b6b; font-weight: 700; letter-spacing: 0.5px;">⚠️ TERDETEKSI ${riskItems.length} BARANG MEMUTUHKAN RESTOCK SEGERA</p>
        </div>
        <div style="padding: 24px; background: #131024;">
          <p style="margin-top: 0; font-size: 15px; color: #fff; font-weight: 600;">Halo Administrator,</p>
          <p style="font-size: 13px; color: #a29dbd; line-height: 1.6;">Berikut adalah rangkuman harian otomatis untuk seluruh produk yang tingkat persediaannya telah berada di bawah batas aman (stok kritis atau waspada) per hari ini:</p>
          
          <table style="width: 100%; border-collapse: collapse; margin: 24px 0; font-size: 12px; text-align: left;">
            <thead>
              <tr style="border-bottom: 2px solid #23203f; background: #0c0a18;">
                <th style="padding: 10px 8px; color: #a29dbd; font-weight: bold;">NO</th>
                <th style="padding: 10px 8px; color: #a29dbd; font-weight: bold;">BARANG</th>
                <th style="padding: 10px 8px; color: #a29dbd; font-weight: bold; text-align: center;">GUDANG</th>
                <th style="padding: 10px 8px; color: #a29dbd; font-weight: bold; text-align: center;">SATUAN</th>
                <th style="padding: 10px 8px; color: #a29dbd; font-weight: bold; text-align: right;">BUFFER</th>
                <th style="padding: 10px 8px; color: #a29dbd; font-weight: bold; text-align: right;">SISA STOK</th>
                <th style="padding: 10px 8px; color: #a29dbd; font-weight: bold; text-align: center;">STATUS</th>
              </tr>
            </thead>
            <tbody>
              ${emailRowsHtml}
            </tbody>
          </table>

          <div style="background: rgba(248, 81, 73, 0.03); border-left: 4px solid #f2a93b; padding: 14px 18px; margin: 24px 0; font-size: 13px; color: #e1dfec; border-radius: 0 8px 8px 0; line-height: 1.5;">
            <strong>Catatan Pengadaan:</strong><br/>
            Harap segera berkoordinasi dengan tim vendor terkait untuk melakukan pemesanan ulang (*re-order*) produk di atas agar kelancaran operasional gudang tetap terjaga.
          </div>

          <p style="font-size: 13px; color: #a29dbd; margin-bottom: 0;">Terima kasih,</p>
          <p style="font-weight: bold; font-size: 13px; margin-top: 4px; color: #ec407a;">Sistem LiveStockConsumable</p>
        </div>
        <div style="background: #0c0a18; padding: 16px; text-align: center; font-size: 11px; color: #8b949e; border-top: 1px solid #23203f;">
          Pesan otomatis digenerasi harian oleh LiveStockConsumable App. Harap jangan membalas email ini.
        </div>
      </div>
    `;

    const cleanTarget = (s.target_email || "")
      .replace(/;/g, ',')
      .split(',')
      .map(email => email.trim())
      .filter(email => email.length > 0)
      .slice(0, 5)
      .join(', ');

    const finalTarget = cleanTarget || "admin@livestock.id";

    const info = await transporter.sendMail({
      from: `"LiveStock Daily Reports" <${s.smtp_user}>`,
      to: finalTarget,
      subject: subject,
      html: htmlContent
    });

    console.log("Daily report email sent successfully:", info.messageId);
    return res.status(200).json({ success: true, message: `Sukses mengirimkan email harian berisi ${riskItems.length} barang risiko.`, messageId: info.messageId });

  } catch (error) {
    console.error("Daily report cron failed:", error);
    return res.status(500).json({ error: error.message });
  }
};
