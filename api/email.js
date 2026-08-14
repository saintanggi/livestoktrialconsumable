// api/email.js
const nodemailer = require('nodemailer');

module.exports = async (req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Prefer');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { item_name, kode_item, sisa_stok, buffer, status, target_email, smtp_user, smtp_pass } = req.body;

  if (!kode_item || !item_name) {
    return res.status(400).json({ error: 'Missing parameters' });
  }

  // --- KREDENSIAL SMTP EMAIL ---
  // Jika pengguna menyetel SMTP sendiri, gunakan itu. Jika tidak, gunakan default dummy / panduan.
  const SMTP_USER = smtp_user || "livestock.alerts@gmail.com";
  const SMTP_PASS = smtp_pass || "ganti-dengan-app-password-anda";

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS
    }
  });

  const category = status === 'crit' ? 'KRITIS' : 'WASPADA';
  const color = status === 'crit' ? '#f85149' : '#f2a93b';
  const subject = `⚠️ [PERINGATAN STOK ${category}] ${item_name} (${kode_item})`;

  const htmlContent = `
    <div style="font-family: 'Inter', Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #23203f; border-radius: 12px; overflow: hidden; background: #0c0a18; box-shadow: 0 8px 32px rgba(0,0,0,0.3); color: #e1dfec;">
      <div style="background: linear-gradient(135deg, #131024, ${color}44); border-bottom: 1px solid #23203f; padding: 28px; text-align: center;">
        <span style="font-size: 32px;">⚠️</span>
        <h1 style="margin: 10px 0 0 0; font-size: 22px; font-weight: 800; color: #fff; letter-spacing: -0.5px;">PERINGATAN STOK GUDANG</h1>
        <p style="margin: 4px 0 0 0; font-size: 13px; color: ${color}; font-weight: 700; letter-spacing: 0.5px;">STATUS KATEGORI: ${category}</p>
      </div>
      <div style="padding: 28px; background: #131024;">
        <p style="margin-top: 0; font-size: 15px; color: #fff; font-weight: 600;">Halo Administrator,</p>
        <p style="font-size: 13px; color: #a29dbd; line-height: 1.6;">Sistem mendeteksi bahwa tingkat persediaan barang berikut telah merosot di bawah tingkat batas aman (buffer stock):</p>
        
        <table style="width: 100%; border-collapse: collapse; margin: 24px 0; font-size: 13px;">
          <tr>
            <td style="padding: 12px; border-bottom: 1px solid #23203f; color: #a29dbd; font-weight: bold; width: 35%;">Kode Barang:</td>
            <td style="padding: 12px; border-bottom: 1px solid #23203f; font-family: monospace; font-weight: bold; color: #fff;">${kode_item}</td>
          </tr>
          <tr>
            <td style="padding: 12px; border-bottom: 1px solid #23203f; color: #a29dbd; font-weight: bold;">Nama Barang:</td>
            <td style="padding: 12px; border-bottom: 1px solid #23203f; font-weight: bold; color: #fff;">${item_name}</td>
          </tr>
          <tr>
            <td style="padding: 12px; border-bottom: 1px solid #23203f; color: #a29dbd; font-weight: bold;">Sisa Stok Akhir:</td>
            <td style="padding: 12px; border-bottom: 1px solid #23203f; font-weight: bold; color: ${color}; font-size: 15px;">${sisa_stok} unit</td>
          </tr>
          <tr>
            <td style="padding: 12px; border-bottom: 1px solid #23203f; color: #a29dbd; font-weight: bold;">Batas Buffer:</td>
            <td style="padding: 12px; border-bottom: 1px solid #23203f; font-weight: bold; color: #fff;">${buffer} unit</td>
          </tr>
        </table>

        <div style="background: rgba(248, 81, 73, 0.05); border-left: 4px solid ${color}; padding: 14px 18px; margin: 24px 0; font-size: 13px; color: #e1dfec; border-radius: 0 8px 8px 0; line-height: 1.5;">
          <strong>Rekomendasi Tindakan:</strong><br/>
          Harap segera melakukan pemesanan ulang (*re-order*) barang ini ke vendor terdaftar untuk mencegah kekosongan stok fisik di gudang.
        </div>

        <p style="font-size: 13px; color: #a29dbd; margin-bottom: 0;">Terima kasih,</p>
        <p style="font-weight: bold; font-size: 13px; margin-top: 4px; color: #ec407a;">Sistem LiveStockConsumable</p>
      </div>
      <div style="background: #0c0a18; padding: 16px; text-align: center; font-size: 11px; color: #8b949e; border-top: 1px solid #23203f;">
        Pesan otomatis digenerasi oleh LiveStockConsumable App. Harap jangan membalas email ini.
      </div>
    </div>
  `;

  try {
    const info = await transporter.sendMail({
      from: `"LiveStock Alerts" <${SMTP_USER}>`,
      to: target_email || "admin@livestock.id",
      subject: subject,
      html: htmlContent
    });
    res.status(200).json({ success: true, messageId: info.messageId });
  } catch (error) {
    console.error("Email send failed:", error);
    res.status(500).json({ error: error.message });
  }
};
