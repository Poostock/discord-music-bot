// ตัวกรองเพลงสำหรับ Autoplay: รับรายการจาก YouTube Mix แล้วเลือกเพลงที่ผ่านเงื่อนไข
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

// ไล่ตรวจตามลำดับใน Mix:
// - ข้ามเพลงต้นทาง (ไม่นับเป็น candidate)
// - ตรวจไม่เกิน maxCandidates รายการ, เลือกไม่เกิน want เพลง
// คืน { picked: [{ entry, index }], rejected: [{ entry, reason, index }], checked }
function selectCandidates(entries, { seedId, recentIds, queuedIds, want, maxCandidates = 10 }) {
  const picked = [];
  const rejected = [];
  const taken = new Set(queuedIds); // กันเลือกเพลงซ้ำกันเองในรอบเดียว
  let checked = 0;

  for (const entry of entries) {
    if (picked.length >= want || checked >= maxCandidates) break;
    if (entry?.id === seedId) continue;

    checked++;
    const reason = rejectReason(entry, { recentIds, queuedIds: taken });
    if (reason) {
      rejected.push({ entry, reason, index: checked });
    } else {
      picked.push({ entry, index: checked });
      taken.add(entry.id);
    }
  }

  return { picked, rejected, checked };
}

module.exports = { selectCandidates };
