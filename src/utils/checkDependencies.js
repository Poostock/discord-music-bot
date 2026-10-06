const { spawnSync } = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const config = require('../config');

const RELEASES = 'https://github.com/yt-dlp/yt-dlp/releases';
// curl/tar ของ Windows แบบระบุ path เต็ม — ถ้าปล่อยให้หาจาก PATH อาจเจอ tar ของ Git Bash ที่แตก zip ไม่ได้
const SYSTEM32 = path.join(process.env.SystemRoot ?? 'C:\\Windows', 'System32');
const CURL = path.join(SYSTEM32, 'curl.exe');
const TAR = path.join(SYSTEM32, 'tar.exe');

// เรียกโปรแกรมแบบรอผล (windowsHide: ไม่ให้หน้าต่าง console เด้งขึ้นมาบน Windows)
function run(cmd, args, timeout = 60_000) {
  return spawnSync(cmd, args, { encoding: 'utf8', windowsHide: true, timeout });
}

// ตรวจตอนเปิดบอทว่าโปรแกรมภายนอกที่ต้องใช้มีครบ
// ไม่ครบ = หยุดทันทีพร้อมบอกวิธีแก้ (ดีกว่าไปพังตอนมีคนใช้ /play)
function checkDependencies() {
  const problems = [];

  updateYtDlp();

  const ytdlp = run(config.ytdlpPath, ['--version']);
  if (ytdlp.error || ytdlp.status !== 0) {
    problems.push(`เรียก yt-dlp ไม่ได้ (${config.ytdlpPath}) → ดาวน์โหลดใหม่ หรือตั้งค่า YTDLP_PATH ใน .env`);
  }

  const ffmpeg = run('ffmpeg', ['-version']);
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
function updateYtDlp() {
  if (config.ytdlpManaged) {
    try {
      updateYtDlpFolder();
    } catch (error) {
      console.warn(`[yt-dlp] ติดตั้ง/อัปเดตอัตโนมัติไม่สำเร็จ ใช้เวอร์ชันเดิมต่อ: ${error.message}`);
    }
    return;
  }

  // Mac / Linux / ตั้ง YTDLP_PATH เอง: ใช้ระบบอัปเดตของ yt-dlp
  // (ทดสอบแล้ว: ทั้ง "อัปเดตแล้ว" และ "ล่าสุดอยู่แล้ว" ได้ exit code 0)
  const result = run(config.ytdlpPath, ['-U'], 30_000);
  if (result.error || result.status !== 0) {
    const reason = result.error?.message ?? result.stderr.trim();
    console.warn(`[yt-dlp] อัปเดตอัตโนมัติไม่สำเร็จ ใช้เวอร์ชันเดิมต่อ: ${reason}`);
    return;
  }
  const updated = result.stdout.split('\n').find((line) => line.startsWith('Updated yt-dlp'));
  if (updated) console.log(`[yt-dlp] ${updated.trim()}`);
}

// ย้ายโฟลเดอร์ ถ้า Windows ยังจับไฟล์อยู่ชั่วครู่ (เช่น Windows Defender สแกน .exe ที่เพิ่งแตกออกมา) → รอแล้วลองใหม่
function renameWithRetry(from, to, tries = 10) {
  for (let i = 1; ; i++) {
    try {
      fs.renameSync(from, to);
      return;
    } catch (error) {
      if (i >= tries || !['EPERM', 'EBUSY', 'EACCES'].includes(error.code)) throw error;
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 300); // รอ 0.3 วินาที
    }
  }
}

// Windows: ใช้ yt-dlp แบบโฟลเดอร์ (yt-dlp_win.zip) — เปิดเร็วกว่าแบบไฟล์เดียวประมาณ 1 วินาที
// แต่ "yt-dlp -U" จะแปลงกลับเป็นแบบไฟล์เดียว จึงติดตั้ง/อัปเดตเองด้วย curl + tar ที่มีใน Windows 10/11:
// เช็กเวอร์ชันล่าสุด → ดาวน์โหลด zip → ตรวจ SHA-256 → แตกไฟล์ลงโฟลเดอร์ชั่วคราว → ทดสอบ → สลับแทนของเดิม
function updateYtDlpFolder() {
  const dir = path.dirname(config.ytdlpPath); // bin/yt-dlp
  const current = run(config.ytdlpPath, ['--version']).stdout?.trim(); // ยังไม่ได้ติดตั้ง = undefined

  // หน้า releases/latest จะ redirect ไปที่ .../tag/<เวอร์ชันล่าสุด>
  const redirect = run(CURL, ['-sSLf', '--max-time', '30', '-o', 'NUL', '-w', '%{url_effective}', `${RELEASES}/latest`]);
  const latest = redirect.stdout?.split('/tag/')[1]?.trim();
  if (!latest) throw new Error(`หาเวอร์ชันล่าสุดไม่ได้ (${redirect.stderr?.trim() || redirect.error?.message})`);
  if (current === latest) return;

  const download = `${RELEASES}/download/${latest}`;
  const tmp = `${dir}-update`;
  fs.rmSync(tmp, { recursive: true, force: true });
  fs.mkdirSync(tmp, { recursive: true });
  try {
    const zip = path.join(tmp, 'yt-dlp_win.zip');
    const got = run(CURL, ['-sSLf', '--max-time', '180', '-o', zip, `${download}/yt-dlp_win.zip`], 200_000);
    if (got.status !== 0) throw new Error(`ดาวน์โหลดไม่สำเร็จ (${got.stderr?.trim()})`);

    // ตรวจว่าไฟล์ตรงกับ checksum ทางการ (กันไฟล์เสียหรือถูกดัดแปลง)
    const sums = run(CURL, ['-sSLf', '--max-time', '30', `${download}/SHA2-256SUMS`]).stdout ?? '';
    const expected = sums.split('\n').find((line) => line.trim().endsWith(' yt-dlp_win.zip'))?.split(/\s+/)[0];
    const actual = crypto.createHash('sha256').update(fs.readFileSync(zip)).digest('hex');
    if (!expected || expected !== actual) throw new Error('checksum ไม่ตรง ไม่ติดตั้งไฟล์นี้');

    const unpacked = path.join(tmp, 'yt-dlp');
    fs.mkdirSync(unpacked);
    const tar = run(TAR, ['-xf', zip, '-C', unpacked]);
    if (tar.status !== 0) throw new Error(`แตกไฟล์ไม่สำเร็จ (${tar.stderr?.trim()})`);
    if (run(path.join(unpacked, 'yt-dlp.exe'), ['--version']).status !== 0) throw new Error('ไฟล์ใหม่รันไม่ได้');

    // สลับ: ของเดิม → .old, ของใหม่ → bin/yt-dlp แล้วค่อยลบของเดิม (ถ้าพังก่อนหน้านี้ ของเดิมยังอยู่ครบ)
    const old = `${dir}-old`;
    fs.rmSync(old, { recursive: true, force: true });
    if (fs.existsSync(dir)) renameWithRetry(dir, old);
    renameWithRetry(unpacked, dir);
    fs.rmSync(old, { recursive: true, force: true });
    console.log(`[yt-dlp] ${current ? `อัปเดต ${current} →` : 'ติดตั้ง'} ${latest} (แบบโฟลเดอร์)`);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

module.exports = checkDependencies;
