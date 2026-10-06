const { spawnSync } = require('node:child_process');
const config = require('../config');

// ตรวจตอนเปิดบอทว่าโปรแกรมภายนอกที่ต้องใช้มีครบ
// ไม่ครบ = หยุดทันทีพร้อมบอกวิธีแก้ (ดีกว่าไปพังตอนมีคนใช้ /play)
function checkDependencies() {
  const problems = [];

  updateYtDlp();

  // windowsHide: ไม่ให้หน้าต่าง console เด้งขึ้นมาบน Windows
  const ytdlp = spawnSync(config.ytdlpPath, ['--version'], { encoding: 'utf8', windowsHide: true });
  if (ytdlp.error || ytdlp.status !== 0) {
    problems.push(`เรียก yt-dlp ไม่ได้ (${config.ytdlpPath}) → ดาวน์โหลดใหม่ หรือตั้งค่า YTDLP_PATH ใน .env`);
  }

  const ffmpeg = spawnSync('ffmpeg', ['-version'], { encoding: 'utf8', windowsHide: true });
  if (ffmpeg.error || ffmpeg.status !== 0) {
    problems.push('ไม่พบ FFmpeg ใน PATH → ติดตั้ง FFmpeg แล้วปิด/เปิด Terminal (หรือ VS Code) ใหม่');
  }

  if (problems.length > 0) {
    console.error(`ตรวจ dependency ไม่ผ่าน:\n- ${problems.join('\n- ')}`);
    process.exit(1);
  }

  console.log(`yt-dlp ${ytdlp.stdout.trim()} / ${ffmpeg.stdout.split('\n')[0].split(' Copyright')[0]}`);
}

// อัปเดต yt-dlp เป็นเวอร์ชันล่าสุดทุกครั้งที่เปิดบอท (YouTube เปลี่ยนระบบบ่อย yt-dlp เก่าจะเล่นไม่ได้)
// ไม่สำเร็จ (เช่น เน็ตยังไม่พร้อม) → แค่เตือน แล้วใช้เวอร์ชันเดิมต่อ
// (ทดสอบแล้ว: ทั้ง "อัปเดตแล้ว" และ "ล่าสุดอยู่แล้ว" ได้ exit code 0)
function updateYtDlp() {
  const result = spawnSync(config.ytdlpPath, ['-U'], { encoding: 'utf8', windowsHide: true, timeout: 30_000 });
  if (result.error || result.status !== 0) {
    const reason = result.error?.message ?? result.stderr.trim();
    console.warn(`[yt-dlp] อัปเดตอัตโนมัติไม่สำเร็จ ใช้เวอร์ชันเดิมต่อ: ${reason}`);
    return;
  }
  const updated = result.stdout.split('\n').find((line) => line.startsWith('Updated yt-dlp'));
  if (updated) console.log(`[yt-dlp] ${updated.trim()}`);
}

module.exports = checkDependencies;
