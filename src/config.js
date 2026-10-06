// รวมค่าตั้งค่าทั้งหมดไว้ที่เดียว ไฟล์อื่นจะ require('./config') แทนการอ่าน process.env เอง
const path = require('node:path');

const token = process.env.DISCORD_TOKEN;

if (!token) {
  console.error('ไม่พบ DISCORD_TOKEN ในไฟล์ .env');
  process.exit(1);
}

module.exports = {
  token,
  clientId: process.env.CLIENT_ID,
  guildId: process.env.GUILD_ID,
  // ตำแหน่งไฟล์ yt-dlp เปลี่ยนได้ด้วย YTDLP_PATH ใน .env
  // ค่าเริ่มต้น: Windows = bin/yt-dlp/yt-dlp.exe (แบบโฟลเดอร์ บอทติดตั้ง/อัปเดตให้เอง) / Mac, Linux = bin/yt-dlp
  ytdlpPath:
    process.env.YTDLP_PATH ||
    (process.platform === 'win32'
      ? path.join(__dirname, '..', 'bin', 'yt-dlp', 'yt-dlp.exe')
      : path.join(__dirname, '..', 'bin', 'yt-dlp')),
  // true = บอทดูแล yt-dlp แบบโฟลเดอร์บน Windows เอง (ไม่ได้ตั้ง YTDLP_PATH)
  ytdlpManaged: process.platform === 'win32' && !process.env.YTDLP_PATH,
};
