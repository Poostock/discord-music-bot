// สร้างไอคอนสำหรับ Music Panel แล้ว (ถ้าสั่ง) อัปโหลดเป็น Application Emoji ของบอท
// สไตล์: สัญลักษณ์ทึบขอบมน ไม่มีพื้นหลัง สีลาเวนเดอร์อมฟ้าไล่เฉด (อ่านง่ายบนพื้นมืดของ Discord)
//   npm run icons              → สร้าง PNG ใน assets/icons/ + preview.png (ยังไม่อัปโหลด)
//   npm run icons -- --upload  → สร้าง + อัปโหลด (ชื่อที่มีอยู่แล้วจะถูกแทนที่ด้วยไฟล์ใหม่)
// หลังอัปโหลด ให้ pm2 restart music-bot เพื่อให้บอทโหลดไอคอนใหม่
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { Resvg } = require('@resvg/resvg-js');

const OUT_DIR = path.join(__dirname, '..', 'assets', 'icons');
const PREFIX = 'mp_'; // ชื่อ Emoji = mp_<ชื่อไอคอน> (บอทโหลดเฉพาะชื่อที่ขึ้นต้นด้วยคำนี้)

// ── สีของธีม (แก้ตรงนี้ที่เดียวถ้าอยากเปลี่ยนโทน) ──
const TOP = '#C3C8FF'; // เฉดอ่อนด้านบน
const BOTTOM = '#8A93F5'; // เฉดหลักด้านล่าง
const INNER = '#2B2D31'; // สีรายละเอียดด้านใน (เท่าพื้นหลังของ Discord ทำให้ดูเหมือนเจาะรู)

const C = 'url(#g)';
const S = (width = 12) => `fill="none" stroke="${C}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"`; // เส้นปลายมน
const F = (round = 10) => `fill="${C}" stroke="${C}" stroke-width="${round}" stroke-linejoin="round"`; // รูปทึบขอบมน

function icon(glyph, id = 'g') {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">
  <defs><linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="0" y1="10" x2="0" y2="118">
    <stop offset="0" stop-color="${TOP}"/><stop offset="1" stop-color="${BOTTOM}"/>
  </linearGradient></defs>
  ${glyph.replace(/url\(#g\)/g, `url(#${id})`)}
</svg>`;
}

// จุดบนวงกลมรอบจุดศูนย์กลาง (64,64): องศา 0 = ด้านบน หมุนตามเข็มนาฬิกา
function pt(r, deg) {
  const a = ((deg - 90) * Math.PI) / 180;
  return `${(64 + r * Math.cos(a)).toFixed(2)} ${(64 + r * Math.sin(a)).toFixed(2)}`;
}
const arc = (r, from, to) => `M ${pt(r, from)} A ${r} ${r} 0 0 1 ${pt(r, to)}`;
// ชิ้นวงแหวน (ใช้ทำแสงเงาสะท้อนบนแผ่น)
const ringSlice = (r1, r2, from, to) => `${arc(r1, from, to)} L ${pt(r2, to)} A ${r2} ${r2} 0 0 0 ${pt(r2, from)} Z`;

// แผ่นไวนิลที่หมุนไป deg องศา: ตัวแผ่นดำ + ร่องเสียง + ฉลากม่วง
// ส่วนที่หมุน = แสงบนร่อง + ฉลาก / ส่วนที่นิ่ง = ร่อง + เงาสะท้อน + ขอบ (เหมือนแสงไฟที่ส่องแผ่นจริง)
function vinyl(deg) {
  const grooves = [52, 46, 40, 34].map((r) => `<circle cx="64" cy="64" r="${r}" fill="none" stroke="#3A3D47" stroke-width="1.6"/>`).join('');
  return `<circle cx="64" cy="64" r="60" fill="#16171B"/>${grooves}
  <path d="${ringSlice(57, 25, 300, 340)}" fill="#fff" fill-opacity="0.07"/><path d="${ringSlice(57, 25, 120, 160)}" fill="#fff" fill-opacity="0.07"/>
  <g transform="rotate(${deg} 64 64)">
    <path d="${arc(49, 300, 350)}" fill="none" stroke="#fff" stroke-opacity="0.45" stroke-width="3" stroke-linecap="round"/>
    <path d="${arc(43, 120, 165)}" fill="none" stroke="#fff" stroke-opacity="0.3" stroke-width="3" stroke-linecap="round"/>
    <path d="${arc(37, 200, 235)}" fill="none" stroke="${TOP}" stroke-opacity="0.55" stroke-width="2.5" stroke-linecap="round"/>
    <circle cx="64" cy="64" r="22" fill="url(#g)"/>
    <path d="${arc(15, 20, 110)}" fill="none" stroke="#fff" stroke-opacity="0.85" stroke-width="3" stroke-linecap="round"/>
  </g>
  <circle cx="64" cy="64" r="4.5" fill="#16171B"/>
  <circle cx="64" cy="64" r="59" fill="none" stroke="url(#g)" stroke-width="3"/>`;
}

// ไอคอนเคลื่อนไหว (ส่งออกเป็น GIF): frames เฟรม หมุนรอบละ 360°
const ANIMATED = {
  disc: { frames: 36, fps: 25, glyph: vinyl },
};

// ── สัญลักษณ์ของแต่ละไอคอน (พื้นที่ 128x128 เว้นขอบเล็กน้อย) ──
const GLYPHS = {
  play: `<path d="M40 26 L100 64 L40 102 Z" ${F(14)}/>`,
  pause: `<rect x="30" y="24" width="24" height="80" rx="9" fill="${C}"/><rect x="74" y="24" width="24" height="80" rx="9" fill="${C}"/>`,
  skip: `<path d="M24 28 L80 64 L24 100 Z" ${F(12)}/><rect x="88" y="24" width="18" height="80" rx="8" fill="${C}"/>`,
  back: `<path d="M104 28 L48 64 L104 100 Z" ${F(12)}/><rect x="22" y="24" width="18" height="80" rx="8" fill="${C}"/>`,
  stop: `<rect x="24" y="24" width="80" height="80" rx="20" fill="${C}"/>`,
  mute: `<path d="M16 48 H36 L64 24 V104 L36 80 H16 Z" ${F(10)}/>
         <line x1="80" y1="48" x2="110" y2="80" ${S(13)}/><line x1="110" y1="48" x2="80" y2="80" ${S(13)}/>`,
  unmute: `<path d="M14 48 H34 L62 24 V104 L34 80 H14 Z" ${F(10)}/>
           <path d="M80 46 Q92 64 80 82" ${S(11)}/><path d="M94 32 Q114 64 94 96" ${S(11)}/>`,
  queue: `<line x1="20" y1="34" x2="80" y2="34" ${S(13)}/><line x1="20" y1="64" x2="80" y2="64" ${S(13)}/><line x1="20" y1="94" x2="56" y2="94" ${S(13)}/>
          <path d="M96 92 V40 L112 46" ${S(9)}/><ellipse cx="88" cy="94" rx="13" ry="11" fill="${C}"/>`,
  autoplay: `<path d="M100 44 A42 42 0 1 0 104 76" ${S(13)}/><path d="M86 22 L106 44 L80 50 Z" ${F(6)}/>
             <path d="M54 46 L82 64 L54 82 Z" ${F(8)}/>`,
  user: `<circle cx="56" cy="40" r="22" fill="${C}"/><path d="M14 108 C14 80 32 70 56 70 C80 70 98 80 98 108 Z" ${F(6)}/>
         <path d="M108 70 V40 L120 44" ${S(7)}/><ellipse cx="102" cy="72" rx="9" ry="7.5" fill="${C}"/>`,
  clock: `<circle cx="64" cy="64" r="50" fill="${C}"/><path d="M64 34 V64 L84 76" fill="none" stroke="${INNER}" stroke-width="11" stroke-linecap="round" stroke-linejoin="round"/>`,
  mic: `<rect x="44" y="14" width="40" height="66" rx="20" fill="${C}"/><path d="M26 60 C26 84 42 96 64 96 C86 96 102 84 102 60" ${S(10)}/>
        <line x1="64" y1="96" x2="64" y2="114" ${S(10)}/><line x1="46" y1="114" x2="82" y2="114" ${S(10)}/>`,
  disc: vinyl(0), // ภาพนิ่งสำหรับ preview — ไฟล์จริงเป็น GIF จาก ANIMATED.disc
  note: `<path d="M46 92 V30 L104 18 V80" ${S(12)}/><ellipse cx="34" cy="94" rx="18" ry="15" fill="${C}"/><ellipse cx="92" cy="82" rx="18" ry="15" fill="${C}"/>`,
};

function render(svg, size = 128) {
  return new Resvg(svg, { fitTo: { mode: 'width', value: size } }).render().asPng();
}

// ภาพตัวอย่าง: แถวบน = ไอคอนขนาดใหญ่บนพื้น Discord / แถวล่าง = จำลองปุ่มจริงขนาดเล็ก (ไอคอน ~22px)
function previewSvg(names) {
  const inner = (name, i) => icon(GLYPHS[name], `g${i}`).replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '');
  const big = names.map((name, i) => {
    const x = (i % 7) * 120 + 20;
    const y = Math.floor(i / 7) * 130 + 16;
    return `<g transform="translate(${x} ${y}) scale(0.62)">${inner(name, i)}</g>
      <text x="${x + 40}" y="${y + 104}" fill="#B5BAC1" font-size="14" font-family="Segoe UI, sans-serif" text-anchor="middle">${name}</text>`;
  });
  const buttons = [['unmute', 'Mute'], ['back', 'Back'], ['pause', 'Pause'], ['skip', 'Skip'], ['queue', 'Queue'], ['stop', 'Stop'], ['autoplay', 'AutoPlay']];
  const btn = buttons.map(([name, label], i) => {
    const x = 20 + i * 118;
    const y = 296;
    return `<rect x="${x}" y="${y}" width="108" height="40" rx="8" fill="#4E5058"/>
      <g transform="translate(${x + 12} ${y + 9}) scale(0.172)">${inner(name, 100 + i)}</g>
      <text x="${x + 42}" y="${y + 26}" fill="#fff" font-size="15" font-family="Segoe UI, sans-serif">${label}</text>`;
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" width="860" height="356"><rect width="100%" height="100%" fill="#313338"/>${big.join('')}${btn.join('')}</svg>`;
}

async function upload(files) {
  const { REST, Routes } = require('discord.js');
  const { token, clientId } = require('../src/config');
  const rest = new REST().setToken(token);
  const existing = (await rest.get(Routes.applicationEmojis(clientId))).items;

  for (const { name, file } of files) {
    const emojiName = PREFIX + name;
    const old = existing.find((e) => e.name === emojiName);
    if (old) await rest.delete(Routes.applicationEmoji(clientId, old.id)); // แทนที่ด้วยไฟล์ใหม่
    const type = file.endsWith('.gif') ? 'image/gif' : 'image/png';
    const image = `data:${type};base64,${fs.readFileSync(file).toString('base64')}`;
    const created = await rest.post(Routes.applicationEmojis(clientId), { body: { name: emojiName, image } });
    console.log(`อัปโหลด ${emojiName} → ${created.id}${old ? ' (แทนที่ของเดิม)' : ''}`);
  }
}

// วาดทุกเฟรมเป็น PNG แล้วให้ FFmpeg รวมเป็น GIF วนไม่รู้จบ (พื้นโปร่งใส)
function makeGif(name, { frames, fps, glyph }) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), `mp-${name}-`));
  for (let i = 0; i < frames; i++) {
    const file = path.join(tmp, `f${String(i).padStart(3, '0')}.png`);
    fs.writeFileSync(file, render(icon(glyph((360 / frames) * i))));
  }
  const out = path.join(OUT_DIR, `${name}.gif`);
  const result = spawnSync('ffmpeg', [
    '-y', '-loglevel', 'error', '-framerate', String(fps), '-i', path.join(tmp, 'f%03d.png'),
    '-filter_complex', '[0:v]split[a][b];[a]palettegen=reserve_transparent=1[p];[b][p]paletteuse=alpha_threshold=128:dither=none',
    '-loop', '0', out,
  ], { encoding: 'utf8', windowsHide: true });
  fs.rmSync(tmp, { recursive: true, force: true });
  if (result.error || result.status !== 0) throw new Error(`FFmpeg สร้าง ${name}.gif ไม่ได้: ${result.error?.message ?? result.stderr}`);
  return out;
}

(async () => {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const names = Object.keys(GLYPHS);
  const files = names.map((name) => {
    if (ANIMATED[name]) return { name, file: makeGif(name, ANIMATED[name]) };
    const file = path.join(OUT_DIR, `${name}.png`);
    fs.writeFileSync(file, render(icon(GLYPHS[name])));
    return { name, file };
  });
  fs.writeFileSync(path.join(OUT_DIR, 'preview.png'), render(previewSvg(names), 860));
  console.log(`สร้างไอคอน ${files.length} ไฟล์ใน ${OUT_DIR} (ดูตัวอย่างที่ preview.png)`);

  if (process.argv.includes('--upload')) await upload(files);
})().catch((error) => {
  console.error('ผิดพลาด:', error.message);
  process.exitCode = 1;
});
