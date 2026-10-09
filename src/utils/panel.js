const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  StringSelectMenuBuilder,
  escapeMarkdown,
} = require('discord.js');
const { requester } = require('./embeds');
const icons = require('./icons');
const stations = require('../music/stations');

const COLOR = 0xa78bfa; // ม่วงลาเวนเดอร์ (ธีมเดียวกับไอคอน)
const PREFIX = 'music:'; // customId ของปุ่มทุกปุ่มขึ้นต้นด้วยคำนี้ (interactionCreate ใช้แยกปุ่มของเรา)

// แปลงวินาทีเป็นแบบ "3m 23s" / "1h 2m 5s"
function formatDurationLong(seconds) {
  if (seconds == null) return 'Live';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return h > 0 ? `${h}h ${m}m ${s}s` : `${m}m ${s}s`;
}

// active = true → ปุ่มสี Blurple (สีปุ่มที่ใกล้ม่วงที่สุดที่ Discord มีให้) ใช้บอกว่าสถานะนั้นเปิดอยู่
function button(id, label, icon, active = false) {
  return new ButtonBuilder()
    .setCustomId(PREFIX + id)
    .setLabel(label)
    .setEmoji(icons.button(icon))
    .setStyle(active ? ButtonStyle.Primary : ButtonStyle.Secondary);
}

// สร้างข้อความ Music Panel ของเพลงที่กำลังเล่น ตามสถานะปัจจุบันของคิว (กำลังเปิดวิทยุ → Radio Panel)
function build(queue) {
  if (queue.current?.live) return buildRadio(queue);
  const track = queue.current ?? queue.lastPlayed;
  const iconURL = icons.url('note') ?? queue.textChannel?.client?.user?.displayAvatarURL();

  const embed = new EmbedBuilder()
    .setColor(COLOR)
    .setAuthor({ name: 'MUSIC PANEL', iconURL })
    .setDescription(`${icons.text('disc')} **[${escapeMarkdown(track.title.replace(/[[\]]/g, ''))}](${track.url})**`)
    .setThumbnail(track.thumbnail)
    .addFields(
      { name: `${icons.text('user')} Requested By`, value: requester(track), inline: true },
      { name: `${icons.text('clock')} Music Duration`, value: `\`${formatDurationLong(track.duration)}\``, inline: true },
      { name: `${icons.text('mic')} Music Author`, value: `\`${track.author ?? '-'}\``, inline: true },
    );

  const row1 = new ActionRowBuilder().addComponents(
    queue.muted ? button('mute', 'Unmute', 'mute', true) : button('mute', 'Mute', 'unmute'),
    button('back', 'Back', 'back'),
    queue.paused ? button('pause', 'Resume', 'play', true) : button('pause', 'Pause', 'pause'),
    button('skip', 'Skip', 'skip'),
  );
  const row2 = new ActionRowBuilder().addComponents(
    button('queue', 'Queue', 'queue'),
    button('stop', 'Stop', 'stop'),
    button('autoplay', 'AutoPlay', 'autoplay', queue.autoplay),
  );

  return { content: '', embeds: [embed], components: [row1, row2] };
}

// ── การ์ดเล็ก (ใช้แทนการ์ดใหญ่ เพื่อไม่ให้แชทรก แต่ยังแยกจากพื้นแชทชัดเจน) ──

const GRAY = 0x4e5058; // แถบสีเทา = ข้อความที่ผ่านไปแล้ว/ข้อความประกาศ (ดูจางกว่า Panel ที่กำลังเล่น)

// ชื่อเพลงเป็น badge (ตัวอักษรแบบโค้ด) และกดเป็นลิงก์ได้ — ตัด ` [ ] ออกเพราะทำให้รูปแบบพัง
function badge(title, url) {
  return `[\`${title.replace(/[`[\]]/g, '')}\`](${url})`;
}

function smallCard(heading, description, color) {
  return new EmbedBuilder().setColor(color).setAuthor({ name: heading, iconURL: icons.url('note') }).setDescription(description);
}

// สาเหตุที่เพลงจบ → หัวข้อการ์ด
const ENDED = {
  finished: 'This song has been played',
  skipped: 'Skipped',
  back: 'Went back',
  stopped: 'Stopped',
  failed: "Couldn't play",
  left: 'Left the channel',
  switched: 'Switched station', // วิทยุ: เปลี่ยนสถานี
  interrupted: 'Radio paused for a song — it will come back after the queue', // วิทยุ: มีคน /play แทรก
};

// Panel ของเพลงที่จบแล้ว → การ์ดเล็ก ไม่มีปุ่ม
// ended = { reason: 'finished' | 'skipped' | ..., by: ชื่อที่แสดงของคนที่สั่ง (ถ้ามี) }
// (หัวข้อการ์ดแสดง @mention ไม่ได้ จึงใช้ชื่อที่แสดงแทน)
function compact(track, { reason = 'finished', by } = {}) {
  const heading = `${ENDED[reason] ?? ENDED.finished}${by ? ` by ${by}` : ''}`;
  const station = track.live ? stations.get(track.station) : null;
  const who = station
    ? `📻 ${station.label} Radio`
    : track.autoplay ? 'Autoplay' : `Requested by <@${track.requestedBy}>`;
  return { content: '', embeds: [smallCard(heading, `${badge(track.title, track.url)} · ${who}`, GRAY)], components: [] };
}

// Panel เก่าที่บอทจำไม่ได้แล้ว (เช่น หลัง restart) → ย่อจากข้อมูลในการ์ดเดิม (อ่านไม่ได้ = แค่เอาปุ่มออก)
function compactFromMessage(message) {
  const embed = message.embeds[0];
  const found = embed?.description?.match(/\[(.+?)\]\((.+?)\)/);
  if (!found) return { components: [] };
  const requestedBy = embed.fields[0]?.value ?? '';
  const who = requestedBy.startsWith('<@') ? `Requested by ${requestedBy}` : 'Autoplay';
  const title = found[1].replace(/\\/g, ''); // เอา \ ที่ใส่ไว้กัน Markdown ในการ์ดเดิมออก
  return { content: '', embeds: [smallCard(ENDED.finished, `${badge(title, found[2])} · ${who}`, GRAY)], components: [] };
}

// /play ตอนมีเพลงเล่นอยู่ → การ์ดเล็กแถบม่วง
function queued(track, position) {
  const description = `${badge(track.title, track.url)} [ ${formatDurationLong(track.duration)} ]`;
  return { content: '', embeds: [smallCard(`Song Added to Queue #${position}`, description, COLOR)] };
}

// ข้อความประกาศทั่วไป (ออกจากห้อง, Autoplay หาเพลงไม่ได้ ฯลฯ) → การ์ดเล็กแถบเทา
function notice(text) {
  return { embeds: [new EmbedBuilder().setColor(GRAY).setDescription(text)] };
}

// ── วิทยุ (/lofi) ──

// เมนูเลือกสถานี — current = key ของสถานีที่กำลังเล่น (ให้ขึ้นเป็นค่าที่เลือกไว้)
function stationMenu(customId, current) {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(PREFIX + customId)
      .setPlaceholder('🎵 Choose a station...')
      .addOptions(
        stations.STATIONS.map((s) => ({
          label: s.label,
          value: s.key,
          description: s.description,
          emoji: s.emoji,
          default: s.key === current,
        })),
      ),
  );
}

// แผงเลือกสถานีของ /lofi (ทุกคนเห็นและกดเลือกได้)
function picker() {
  const embed = new EmbedBuilder()
    .setColor(COLOR)
    .setAuthor({ name: 'LOFI RADIO', iconURL: icons.url('note') })
    .setDescription('Pick a station — I will join your voice channel and keep it playing.');
  return { embeds: [embed], components: [stationMenu('pick', null)] };
}

// หลังเลือกสถานีจากแผง /lofi → แผงย่อเป็นการ์ดเล็ก (Radio Panel ตัวจริงจะส่งเป็นข้อความใหม่)
function radioStarted(station, by) {
  return { content: '', embeds: [smallCard(`Lofi Radio started by ${by}`, `${station.emoji} **${station.label}** — ${station.description}`, COLOR)], components: [] };
}

// Radio Panel: สถานีที่กำลังเล่น + เมนูเปลี่ยนสถานี + Mute / Stop
// (ไม่มี Back/Skip/Pause: ไลฟ์ข้ามเพลงไม่ได้ และหยุดแล้วเล่นต่อเสียงจะช้ากว่าไลฟ์จริง)
function buildRadio(queue) {
  const track = queue.current;
  const station = stations.get(track.station);
  const embed = new EmbedBuilder()
    .setColor(COLOR)
    .setAuthor({ name: 'RADIO · 🔴 LIVE', iconURL: icons.url('note') })
    .setDescription(`${station.emoji} **${station.label}**\n${badge(track.title, track.url)}`)
    .setThumbnail(track.thumbnail)
    .addFields({ name: `${icons.text('mic')} Channel`, value: `\`${track.author ?? '-'}\``, inline: true });

  const buttons = new ActionRowBuilder().addComponents(
    queue.muted ? button('mute', 'Unmute', 'mute', true) : button('mute', 'Mute', 'unmute'),
    button('stop', 'Stop', 'stop'),
  );
  return { content: '', embeds: [embed], components: [stationMenu('station', station.key), buttons] };
}

module.exports = { build, compact, compactFromMessage, queued, notice, picker, radioStarted, PREFIX };
