import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
} from '@whiskeysockets/baileys';
import { handleMessage } from './commands.js';
import { config } from './config.js';

function senderOf(jid) {
  return (jid || '').split('@')[0].replace(/\D/g, '');
}

function textOf(m) {
  return (
    m.message?.conversation ||
    m.message?.extendedTextMessage?.text ||
    m.message?.imageMessage?.caption ||
    ''
  ).trim();
}

/**
 * Pasang handler ke sebuah socket Baileys. Dipisah agar bisa di-test
 * tanpa koneksi WhatsApp asli (cukup socket palsu).
 */
export function attachHandlers(sock) {
  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;
    for (const m of messages) {
      try {
        if (!m.message || m.key.fromMe) continue;
        const jid = m.key.remoteJid || '';
        if (!jid.endsWith('@s.whatsapp.net')) continue; // abaikan grup & channel

        const sender = senderOf(jid);
        if (config.allowedSenders.length > 0 && !config.allowedSenders.includes(sender)) {
          console.log(`[in] pengirim tidak diizinkan: ${sender} (diabaikan)`);
          continue;
        }

        const text = textOf(m);
        if (!text) continue;
        console.log(`[in] ${sender}: ${text.slice(0, 80)}`);

        try {
          await sock.readMessages([m.key]);
        } catch { /* non-kritis */ }

        const reply = await handleMessage(sender, text);
        if (reply) {
          await sock.sendMessage(jid, { text: reply });
          console.log(`[out] -> ${sender} (${reply.length} char)`);
        }
      } catch (e) {
        console.error('[msg] error:', e.message);
      }
    }
  });

  sock.ev.on('connection.update', (u) => {
    const { connection, lastDisconnect } = u;
    if (connection === 'open') console.log('[wa] bot online, siap menerima chat');
    if (connection === 'close') {
      const code = lastDisconnect?.error?.output?.statusCode;
      const loggedOut = code === DisconnectReason.loggedOut;
      console.log(`[wa] koneksi putus (code: ${code}). ${loggedOut ? 'Sesi logout — hapus folder auth & scan ulang.' : 'Mencoba sambung ulang...'}`);
      if (!loggedOut) setTimeout(startBot, 5000);
    }
  });

  sock.ev.on('creds.update', () => {});
}

/** Jalankan bot: pairing via QR di terminal, lalu standby. */
export async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState(config.sessionDir);
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: true, // scan QR ini dengan WhatsApp di HP kamu
    browser: ['WA Stok Bot', 'Chrome', '1.0'],
  });

  sock.ev.on('creds.update', saveCreds);
  attachHandlers(sock);
  return sock;
}
