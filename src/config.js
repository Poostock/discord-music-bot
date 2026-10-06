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
  // ตำแหน่งไฟล์ yt-dlp (ค่าเริ่มต้น: bin/ ในโปรเจกต์) เปลี่ยนได้ด้วย YTDLP_PATH ใน .env
  ytdlpPath:
    process.env.YTDLP_PATH ||
    path.join(__dirname, '..', 'bin', process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp'),
};
