// ไอคอนธีมม่วงของ Music Panel = Application Emoji ของบอท (ชื่อ mp_*, สร้าง/อัปโหลดด้วย npm run icons -- --upload)
// โหลดครั้งเดียวตอนบอทเปิด ถ้าโหลดไม่ได้หรือไอคอนไหนหายไป จะใช้ Emoji มาตรฐานแทน (บอทไม่พัง)

const PREFIX = 'mp_';
const FALLBACK = {
  play: '▶️', pause: '⏸️', skip: '⏭️', back: '⏮️', stop: '⏹️', mute: '🔇', unmute: '🔊',
  queue: '📜', autoplay: '📻', user: '👤', clock: '⏱️', mic: '🎤', disc: '💿', note: '🎵',
};
const loaded = {}; // ชื่อไอคอน → { id, name, animated }

async function load(client) {
  try {
    const emojis = await client.application.emojis.fetch();
    for (const emoji of emojis.values()) {
      if (emoji.name.startsWith(PREFIX)) {
        loaded[emoji.name.slice(PREFIX.length)] = { id: emoji.id, name: emoji.name, animated: Boolean(emoji.animated) };
      }
    }
    console.log(`โหลดไอคอน ${Object.keys(loaded).length}/${Object.keys(FALLBACK).length} ตัว`);
  } catch (error) {
    console.warn('[icons] โหลดไอคอนไม่ได้ ใช้ Emoji มาตรฐานแทน:', error.message);
  }
}

// สำหรับปุ่ม: setEmoji() รับได้ทั้ง { id, name } และ Emoji มาตรฐาน
function button(name) {
  return loaded[name] ?? FALLBACK[name];
}

// สำหรับข้อความ/การ์ด: <:ชื่อ:id> หรือ <a:ชื่อ:id> ถ้าเป็น Emoji เคลื่อนไหว (เช่น แผ่นไวนิลหมุน)
function text(name) {
  const emoji = loaded[name];
  return emoji ? `<${emoji.animated ? 'a' : ''}:${emoji.name}:${emoji.id}>` : FALLBACK[name];
}

// URL รูปภาพ (ใช้เป็นไอคอนหัวการ์ด) — ไม่มีก็คืน undefined
function url(name) {
  const emoji = loaded[name];
  return emoji ? `https://cdn.discordapp.com/emojis/${emoji.id}.${emoji.animated ? 'gif' : 'png'}` : undefined;
}

module.exports = { load, button, text, url };
