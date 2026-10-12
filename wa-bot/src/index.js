import qrcode from 'qrcode-terminal';
import { startBot } from './wa-client.js';

console.log('Menyiapkan bot WA... scan QR yang muncul dengan WhatsApp di HP kamu.');

// printQRInTerminal sudah deprecated di Baileys -> render manual via onQR.
startBot({
  onQR: async (qr) => {
    qrcode.generate(qr, { small: true });
    console.log('QR baru dibuat (kedaluwarsa ±1 menit).');
  },
}).catch((e) => {
  console.error('Gagal menjalankan bot:', e.message);
  process.exit(1);
});
