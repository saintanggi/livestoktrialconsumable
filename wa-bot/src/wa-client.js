import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
} from '@whiskeysockets/baileys';
import { handleMessage } from './commands.js';
import { config } from './config.js';

function senderOf(jid) {
  // "6289662730805:6@s.whatsapp.net" -> "6289662730805" (buang suffix device ":6")
  return (jid || '').split('@')[0].split(':')[0].replace(/\D/g, '');
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
 * Pasang handler pesan ke sebuah socket Baileys. Dipisah agar bisa di-test
 * tanpa koneksi WhatsApp asli (cukup socket palsu).
 * (Siklus koneksi/reconnect ditangani startBot, bukan di sini.)
 */
export function attachHandlers(sock) {
  // ID pesan yang dikirim bot sendiri -> jangan dibalas (anti loop),
  // penting untuk mode "chat dengan diri sendiri".
  const botSentIds = new Set();

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (process.env.DEBUG_BOT) {
      for (const m of messages || []) {
        console.log('[dbg] upsert', JSON.stringify({
          type,
          fromMe: m.key?.fromMe,
          remoteJid: m.key?.remoteJid,
          senderPn: m.key?.senderPn,
          id: m.key?.id,
          msgType: m.message ? Object.keys(m.message).filter((k) => !k.endsWith('ContextInfo')) : null,
          hasText: !!textOf(m),
        }));
      }
    }
    if (type !== 'notify') return;
    for (const m of messages) {
      try {
        if (!m.message || !m.key?.id) continue;
        if (botSentIds.has(m.key.id)) continue; // balasan bot sendiri
        const jid = m.key.remoteJid || '';
        // Terima chat personal via nomor (@s.whatsapp.net) maupun LID (@lid).
        // Grup (@g.us), channel, status tetap diabaikan.
        const isChatJid = jid.endsWith('@s.whatsapp.net') || jid.endsWith('@lid');
        if (!isChatJid) continue;

        const myLid = senderOf(sock.user?.lid);
        const myPn = senderOf(sock.user?.id);
        const remoteNum = senderOf(jid);
        const senderPn = senderOf(m.key.senderPn);

        // Chat dengan diri sendiri: pesan fromMe yang tujuannya nomor/LID sendiri.
        const isSelfChat = m.key.fromMe && !!remoteNum && (remoteNum === myLid || remoteNum === myPn);
        if (m.key.fromMe && !isSelfChat) continue;

        // Identitas pengirim untuk whitelist: utamakan nomor HP.
        // (@lid orang lain -> pakai senderPn bila ada; LID sendiri -> nomor sendiri)
        let sender = remoteNum;
        if (jid.endsWith('@lid')) {
          if (senderPn) sender = senderPn;
          else if (remoteNum === myLid && myPn) sender = myPn;
        }
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
          const sent = await sock.sendMessage(jid, { text: reply });
          const sid = sent?.key?.id;
          if (sid) {
            botSentIds.add(sid);
            setTimeout(() => botSentIds.delete(sid), 120000);
          }
          console.log(`[out] -> ${sender} (${reply.length} char)`);
        }
      } catch (e) {
        console.error('[msg] error:', e.message);
      }
    }
  });
}

/**
 * Jalankan bot.
 * opts:
 *   - agent: proxy agent untuk WebSocket (opsional; perlu kalau di balik proxy)
 *   - onQR(qrString): dipanggil tiap ada QR baru (untuk render QR sendiri,
 *     karena printQRInTerminal sudah deprecated di Baileys)
 */
export async function startBot(opts = {}) {
  const { state, saveCreds } = await useMultiFileAuthState(config.sessionDir);
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: state,
    agent: opts.agent,
    printQRInTerminal: false,
    browser: ['WA Stok Bot', 'Chrome', '1.0'],
  });

  sock.ev.on('creds.update', saveCreds);
  attachHandlers(sock);

  sock.ev.on('connection.update', (u) => {
    if (u.qr && typeof opts.onQR === 'function') {
      opts.onQR(u.qr).catch((e) => console.error('[qr] error:', e.message));
    }
    const { connection, lastDisconnect } = u;
    if (connection === 'open') console.log('[wa] bot online, siap menerima chat');
    if (connection === 'close') {
      const code = lastDisconnect?.error?.output?.statusCode;
      const loggedOut = code === DisconnectReason.loggedOut;
      console.log(`[wa] koneksi putus (code: ${code}). ${loggedOut ? 'Sesi logout — hapus folder auth & pairing ulang.' : 'Mencoba sambung ulang...'}`);
      if (loggedOut) {
        if (typeof opts.onLoggedOut === 'function') opts.onLoggedOut();
      } else {
        setTimeout(() => startBot(opts), 5000); // opts diteruskan!
      }
    }
  });

  return sock;
}
