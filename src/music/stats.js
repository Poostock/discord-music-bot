// สถิติ "เพลงที่คนเปิดเอง" ของแต่ละ Server — ใช้ให้ Autoplay เลือกเพลงที่ Server นี้ชอบก่อน
// เก็บในไฟล์ data/stats.json (อยู่ในเครื่องเท่านั้น ไม่ขึ้น GitHub) จำข้ามการ restart ได้
const fs = require('node:fs');
const path = require('node:path');

const FILE = path.join(__dirname, '..', '..', 'data', 'stats.json');
const HALF_LIFE_DAYS = 30; // การเปิดเมื่อ 30 วันก่อน มีน้ำหนักครึ่งหนึ่งของการเปิดวันนี้
const MAX_TRACKS = 500; // เก็บสูงสุดต่อ Server (เกินแล้วตัดเพลงคะแนนต่ำสุดทิ้ง)
const DAY_MS = 86_400_000;

// รูปแบบ: { [guildId]: { [videoId]: { title, url, channel, plays, score, updatedAt } } }
// score = จำนวนครั้งที่ค่อย ๆ ลดน้ำหนักตามเวลา (ณ เวลา updatedAt)
let data = load();

function load() {
  try {
    return JSON.parse(fs.readFileSync(FILE, 'utf8'));
  } catch (error) {
    if (error.code !== 'ENOENT') console.warn('[stats] อ่านไฟล์สถิติไม่ได้ เริ่มนับใหม่:', error.message);
    return {};
  }
}

// เขียนลงไฟล์ชั่วคราวก่อนแล้วค่อยแทนที่ — ถ้าบอทดับกลางคัน ไฟล์เดิมยังไม่เสีย
function save() {
  try {
    fs.mkdirSync(path.dirname(FILE), { recursive: true });
    fs.writeFileSync(`${FILE}.tmp`, JSON.stringify(data));
    fs.renameSync(`${FILE}.tmp`, FILE);
  } catch (error) {
    console.error('[stats] บันทึกสถิติไม่ได้:', error.message);
  }
}

// คะแนน ณ ตอนนี้ (หลังลดน้ำหนักตามเวลาที่ผ่านไป)
function currentScore(entry, now = Date.now()) {
  return entry.score * 0.5 ** ((now - entry.updatedAt) / (HALF_LIFE_DAYS * DAY_MS));
}

// เพลงที่คนสั่งเอง (/play) เริ่มเล่น → +1
function recordPlay(guildId, track) {
  if (!guildId || !track?.id) return;
  const now = Date.now();
  const tracks = (data[guildId] ??= {});
  const entry = tracks[track.id];
  tracks[track.id] = {
    title: track.title,
    url: track.url,
    channel: track.author ?? null,
    plays: (entry?.plays ?? 0) + 1,
    score: (entry ? currentScore(entry, now) : 0) + 1,
    updatedAt: now,
  };

  const ids = Object.keys(tracks);
  if (ids.length > MAX_TRACKS) {
    ids.sort((a, b) => currentScore(tracks[a], now) - currentScore(tracks[b], now));
    for (const id of ids.slice(0, ids.length - MAX_TRACKS)) delete tracks[id];
  }
  save();
}

// คะแนนความชอบของ Server นี้: { video: Map(videoId → คะแนน), channel: Map(ชื่อช่อง → คะแนนรวม) }
function preferences(guildId) {
  const now = Date.now();
  const video = new Map();
  const channel = new Map();
  for (const [id, entry] of Object.entries(data[guildId] ?? {})) {
    const score = currentScore(entry, now);
    video.set(id, score);
    if (entry.channel) channel.set(entry.channel, (channel.get(entry.channel) ?? 0) + score);
  }
  return { video, channel };
}

// เพลงที่ Server นี้เปิดบ่อยที่สุด (เรียงตามคะแนนปัจจุบัน)
function top(guildId, limit = 10) {
  const now = Date.now();
  return Object.values(data[guildId] ?? {})
    .map((entry) => ({ ...entry, current: currentScore(entry, now) }))
    .sort((a, b) => b.current - a.current)
    .slice(0, limit);
}

// ล้างสถิติของ Server นี้ — คืนจำนวนเพลงที่ถูกลบ
function reset(guildId) {
  const count = Object.keys(data[guildId] ?? {}).length;
  delete data[guildId];
  save();
  return count;
}

module.exports = { recordPlay, preferences, top, reset };
