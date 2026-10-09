// ตัวกรองเพลงสำหรับ Autoplay: รับรายการจาก YouTube Mix แล้วเลือกเพลงที่ผ่านเงื่อนไข (ให้เพลงที่ Server เปิดบ่อยมาก่อน)
// เป็นฟังก์ชันล้วน ๆ (ไม่เรียก Discord / yt-dlp) จึงทดสอบแยกได้ง่าย

const VIDEO_ID = /^[\w-]{11}$/;
const MAX_DURATION_SEC = 10 * 60;
// live_status ที่ถือว่าเป็น Live / Stream / Premiere
const LIVE_STATUSES = new Set(['is_live', 'is_upcoming', 'was_live', 'post_live']);
// availability ที่เล่นไม่ได้แน่นอน
const UNPLAYABLE = new Set(['private', 'premium_only', 'subscriber_only', 'needs_auth']);

// คืนเหตุผลที่ปัดตก (string) หรือ null ถ้าผ่าน
function rejectReason(entry, { recentIds, queuedIds }) {
  if (!entry?.id || !VIDEO_ID.test(entry.id)) return 'invalid id';
  if (queuedIds.has(entry.id)) return 'already queued';
  if (recentIds.has(entry.id)) return 'recently played';
  if (LIVE_STATUSES.has(entry.live_status)) return `live/stream/premiere (${entry.live_status})`;
  if (!(entry.duration > 0)) return 'no reliable duration'; // ครอบไลฟ์ที่ไม่มี live_status ไว้อีกชั้น
  if (entry.duration > MAX_DURATION_SEC) return `longer than 10 min (${entry.duration}s)`;
  if (UNPLAYABLE.has(entry.availability)) return `not playable (${entry.availability})`;
  return null;
}

// คะแนนของ candidate:
// - ลำดับใน Mix: ยิ่งอยู่ต้นยิ่งเกี่ยวข้องกับเพลงที่กำลังเล่น (ลำดับ 1 = maxCandidates-1 แต้ม ... ลำดับสุดท้าย = 0)
// - เพลงที่ Server นี้เคยเปิดเอง: โบนัสใหญ่ (เปิดแม้ 1 ครั้งก็ชนะลำดับใน Mix ได้ / log ทำให้เพลงที่เปิด 100 ครั้งไม่กลบหมด)
// - ช่องที่เคยเปิดบ่อย: โบนัสเล็ก (ชื่อช่องอาจเป็นค่ายที่มีหลายศิลปิน)
function scoreOf(entry, index, maxCandidates, preferences) {
  const video = preferences?.video.get(entry.id) ?? 0;
  const channel = preferences?.channel.get(entry.channel) ?? 0;
  return (maxCandidates - index) + 10 * Math.log2(1 + video) + 2 * Math.log2(1 + channel);
}

// ตรวจ candidate ตามลำดับใน Mix (ข้ามเพลงต้นทาง ไม่นับ) สูงสุด maxCandidates รายการ
// แล้วเลือกตัวที่ผ่านตัวกรองและคะแนนสูงสุด want เพลง
// preferences = { video: Map, channel: Map } จาก stats.preferences() (ไม่ส่งมา = ใช้ลำดับใน Mix อย่างเดียว)
// คืน { picked: [{ entry, index, score, favorite }], rejected: [{ entry, reason, index }], checked }
function selectCandidates(entries, { seedId, recentIds, queuedIds, want, maxCandidates = 10, preferences }) {
  const passed = [];
  const rejected = [];
  const taken = new Set(queuedIds); // กันเลือกเพลงซ้ำกันเองในรอบเดียว
  let checked = 0;

  for (const entry of entries) {
    if (checked >= maxCandidates) break;
    if (entry?.id === seedId) continue;

    checked++;
    const reason = rejectReason(entry, { recentIds, queuedIds: taken });
    if (reason) {
      rejected.push({ entry, reason, index: checked });
    } else {
      const favorite = preferences?.video.get(entry.id) ?? 0;
      passed.push({ entry, index: checked, favorite, score: scoreOf(entry, checked, maxCandidates, preferences) });
      taken.add(entry.id);
    }
  }

  // คะแนนเท่ากัน → ตัวที่อยู่ต้น Mix ก่อน
  passed.sort((a, b) => b.score - a.score || a.index - b.index);
  return { picked: passed.slice(0, want), rejected, checked };
}

module.exports = { selectCandidates };
