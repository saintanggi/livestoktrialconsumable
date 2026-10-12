import { startBot } from './wa-client.js';

console.log('Menyiapkan bot WA... scan QR yang muncul dengan WhatsApp di HP kamu.');
startBot().catch((e) => {
  console.error('Gagal menjalankan bot:', e.message);
  process.exit(1);
});
