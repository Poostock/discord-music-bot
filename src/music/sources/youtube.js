const { spawn } = require('node:child_process');
const config = require('../../config');
const UserError = require('../../utils/UserError');

const ALLOWED_HOSTS = ['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtu.be'];
const TIMEOUT_MS = 30_000;

// windowsHide: ไม่ให้หน้าต่าง console เด้งขึ้นมาบน Windows (สำคัญตอนรันเบื้องหลังด้วย pm2)
const SPAWN_OPTIONS = { windowsHide: true };

// option ที่ใช้ทุกครั้งที่เรียก yt-dlp
const BASE_ARGS = [
  '--ignore-config', // ไม่อ่านไฟล์ตั้งค่า yt-dlp อื่นในเครื่อง
  '--no-warnings',
  '--js-runtimes', 'node', // ใช้ Node เป็น JS runtime (YouTube ต้องใช้)
];

// เรียก yt-dlp แล้วคืนข้อความที่มันพิมพ์ออกมา (stdout)
// ใช้ spawn แบบไม่ผ่าน shell: ข้อความของผู้ใช้เป็นแค่ "ข้อมูล" ไม่ถูกตีความเป็นคำสั่ง
function runYtDlp(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(config.ytdlpPath, [...BASE_ARGS, ...args], SPAWN_OPTIONS);

    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });

    const timer = setTimeout(() => {
      killProcess(child);
      reject(new Error(`yt-dlp ใช้เวลานานเกิน ${TIMEOUT_MS / 1000} วินาที`));
    }, TIMEOUT_MS);

    // error = เปิดโปรแกรมไม่ได้เลย เช่น หาไฟล์ yt-dlp ไม่เจอ (code: 'ENOENT')
    child.on('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });

    child.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) resolve(stdout);
      else reject(new Error(`yt-dlp จบด้วย code ${code}: ${stderr.trim()}`));
    });
  });
}

// อนุญาตเฉพาะลิงก์ YouTube
function assertAllowedUrl(text) {
  let url;
  try {
    url = new URL(text);
  } catch {
    throw new UserError('ลิงก์ไม่ถูกต้อง');
  }
  if (!ALLOWED_HOSTS.includes(url.hostname)) {
    throw new UserError('ตอนนี้รองรับเฉพาะลิงก์ YouTube');
  }
}

// รับชื่อเพลงหรือ URL แล้วคืนข้อมูลเพลง 1 เพลง
// รูปแบบผลลัพธ์ (ทุก source ในอนาคตควรคืนรูปแบบเดียวกัน):
// { id, title, url, duration (วินาที หรือ null), thumbnail, author }
async function resolve(query) {
  const isUrl = /^https?:\/\//i.test(query);
  if (isUrl) assertAllowedUrl(query);

  // "--" = จากตรงนี้ไปไม่ใช่ option แล้ว (กันข้อความที่ขึ้นต้นด้วย "-")
  const target = isUrl ? query : `ytsearch1:${query}`;
  let info;
  try {
    const output = await runYtDlp(['--dump-single-json', '--flat-playlist', '--no-playlist', '--', target]);
    info = JSON.parse(output);
  } catch (error) {
    if (error.code === 'ENOENT') throw error; // ไม่พบไฟล์ yt-dlp = ตั้งค่าผิด ให้แสดงใน Terminal
    console.error('[yt-dlp]', error.message);
    throw new UserError(isUrl ? 'เปิดลิงก์นี้ไม่ได้ (วิดีโออาจถูกลบหรือเป็นส่วนตัว)' : 'ค้นหาไม่สำเร็จ ลองใหม่อีกครั้ง');
  }

  if (isUrl && info._type === 'playlist') {
    throw new UserError('ยังไม่รองรับลิงก์ Playlist');
  }

  // ค้นหา: ผลอยู่ใน entries[0] / ลิงก์ตรง: ผลคือ info เลย
  const video = isUrl ? info : info.entries?.[0];
  if (!video) {
    throw new UserError(`ไม่พบเพลงจากคำค้น "${query}"`);
  }

  return toTrack(video);
}

// แปลงข้อมูลวิดีโอจาก yt-dlp เป็นรูปแบบเพลงที่ระบบใช้
// id = Video ID ของ YouTube (ใช้ตรวจเพลงซ้ำใน Autoplay)
function toTrack(video) {
  return {
    id: video.id,
    title: video.title,
    url: `https://www.youtube.com/watch?v=${video.id}`,
    duration: video.duration ?? null,
    thumbnail: `https://i.ytimg.com/vi/${video.id}/hqdefault.jpg`,
    author: video.channel ?? video.uploader ?? null, // ชื่อช่อง YouTube (แสดงใน Music Panel)
  };
}

// ดึง YouTube Mix ของเพลงต้นทาง (เพลย์ลิสต์ "RD<id>" ที่ YouTube สร้างจากอัลกอริทึมแนะนำ)
// คืนรายการดิบจาก yt-dlp: { id, title, duration, live_status, availability, ... } (รายการแรกมักเป็นเพลงต้นทาง)
// ใช้ runYtDlp เดิม → timeout 30 วินาที และรอจนโปรเซสปิดเสมอ ไม่มี yt-dlp ค้าง
async function getMix(videoId, limit) {
  if (!/^[\w-]{11}$/.test(videoId)) throw new Error(`Video ID ไม่ถูกต้อง: ${videoId}`);
  const url = `https://www.youtube.com/watch?v=${videoId}&list=RD${videoId}`;
  const output = await runYtDlp(['--dump-single-json', '--flat-playlist', '--playlist-end', String(limit), '--', url]);
  return JSON.parse(output).entries ?? [];
}

// เปิด yt-dlp ให้ดาวน์โหลดเสียงแล้วส่งออกทาง stdout ("-o -")
// คืน child process: เสียงอยู่ที่ child.stdout และต้อง child.kill() เมื่อเลิกใช้
function createStream(url) {
  const child = spawn(config.ytdlpPath, [
    ...BASE_ARGS,
    '-f', 'bestaudio/best', // เอาเสียงคุณภาพดีที่สุด (ถ้าไม่มีแบบเสียงล้วน ใช้แบบรวมวิดีโอ)
    '-o', '-',
    '--quiet', '--no-progress',
    '--', url,
  ], SPAWN_OPTIONS);

  let stderr = '';
  child.stderr.setEncoding('utf8');
  child.stderr.on('data', (chunk) => { stderr += chunk; });
  child.on('error', (error) => console.error('[yt-dlp stream]', error.message));
  child.on('close', (code) => {
    // ถูกเราปิดเอง (เพลงจบ/ออกจากห้อง) ไม่ถือเป็น Error
    if (code !== 0 && !child.stoppedByUs) {
      console.error(`[yt-dlp stream] จบด้วย code ${code}: ${stderr.trim()}`);
    }
  });

  return child;
}

// ปิดโปรเซส yt-dlp ให้หมด
// บน Windows yt-dlp.exe จะเปิด "โปรเซสลูก" อีกตัว child.kill() ปิดได้แค่ตัวแม่
// จึงต้องใช้ taskkill /T (ปิดทั้งแม่และลูก) /F (บังคับปิด)
function killProcess(child) {
  if (child.exitCode !== null || child.signalCode !== null) return; // จบไปแล้ว
  child.stoppedByUs = true;

  if (process.platform === 'win32') {
    spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], SPAWN_OPTIONS)
      .on('error', (error) => console.error('[taskkill]', error.message));
  } else {
    child.kill();
  }
}

module.exports = { resolve, toTrack, getMix, createStream, killProcess };
