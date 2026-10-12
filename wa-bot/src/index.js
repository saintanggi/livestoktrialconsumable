import qrcode from 'qrcode-terminal';
import { startBot } from './wa-client.js';

// Mode pairing ada 2:
//  1. QR (default): scan QR yang tampil di terminal. Cocok untuk laptop sendiri.
//  2. Kode (PAIRING_PHONE diisi, cth "6289662730805"): bot menampilkan kode
//     8 digit di console — cocok untuk server/VPS/PaaS yang layarnya jauh.
//     Masukkan kode di HP: WhatsApp > Perangkat Tertaut > Tautkan Perangkat
//     > "Tautkan dengan nomor telepon".
const pairingPhone = (process.env.PAIRING_PHONE || '').replace(/\D/g, '');

if (pairingPhone) {
  console.log(`Mode kode pairing untuk ${pairingPhone}.`);
  console.log('Kode 8 digit akan tampil di bawah — masukkan di HP:');
  console.log('WhatsApp > Perangkat Tertaut > Tautkan Perangkat > Tautkan dengan nomor telepon.');
} else {
  console.log('Menyiapkan bot WA... scan QR yang muncul dengan WhatsApp di HP kamu.');
}

try {
  const sock = await startBot({
    onQR: async (qr) => {
      if (pairingPhone) return; // mode kode: QR tidak diperlukan
      qrcode.generate(qr, { small: true });
      console.log('QR baru dibuat (kedaluwarsa ±1 menit).');
    },
  });

  if (pairingPhone) {
    let requested = false;
    sock.ev.on('connection.update', async ({ qr }) => {
      if (qr && !requested) {
        requested = true;
        try {
          const code = await sock.requestPairingCode(pairingPhone);
          console.log('');
          console.log('==============================');
          console.log(`  KODE PAIRING: ${code}`);
          console.log('==============================');
          console.log('');
        } catch (e) {
          console.error('Gagal meminta kode pairing:', e.message);
          requested = false;
        }
      }
    });
  }
} catch (e) {
  console.error('Gagal menjalankan bot:', e.message);
  process.exit(1);
}
