const { EmbedBuilder, escapeMarkdown } = require('discord.js');
const formatDuration = require('./formatDuration');

const COLOR = 0xa78bfa; // ม่วงลาเวนเดอร์ (ธีมเดียวกับ Music Panel)
const BAR_LENGTH = 15;
const QUEUE_SHOW_LIMIT = 10;

// แถบความคืบหน้า เช่น ▬▬▬▬🔘▬▬▬▬▬▬▬▬▬▬
function progressBar(elapsedSec, totalSec) {
  const ratio = Math.min(elapsedSec / totalSec, 1);
  const pos = Math.round(ratio * (BAR_LENGTH - 1));
  return '▬'.repeat(pos) + '🔘' + '▬'.repeat(BAR_LENGTH - 1 - pos);
}

// ใครเป็นคนขอเพลงนี้: เพลงที่ระบบเลือกเองแสดง "🎵 Autoplay" (ไม่ให้เข้าใจผิดว่ามีคนสั่ง)
function requester(track) {
  return track.autoplay ? '🎵 Autoplay' : `<@${track.requestedBy}>`; // mention ใน embed ไม่ส่งแจ้งเตือน
}

// การ์ดพื้นฐานของ 1 เพลง: หัวข้อ + ชื่อเพลง (กดเป็นลิงก์) + ภาพปก + ความยาว + คนขอ
function trackEmbed(track, heading) {
  return new EmbedBuilder()
    .setColor(COLOR)
    .setAuthor({ name: track.autoplay ? `${heading} · 🎵 Autoplay` : heading })
    .setTitle(track.title)
    .setURL(track.url)
    .setThumbnail(track.thumbnail)
    .addFields(
      { name: 'Duration', value: formatDuration(track.duration), inline: true },
      { name: 'Requested By', value: requester(track), inline: true },
    );
}

// elapsedMs: ถ้าส่งมา จะแสดงแถบความคืบหน้า
function nowPlaying(track, { elapsedMs, paused = false } = {}) {
  const embed = trackEmbed(track, paused ? '⏸️ Paused' : '🎶 Now Playing');

  if (elapsedMs !== undefined && track.duration) {
    const elapsedSec = elapsedMs / 1000;
    embed.setDescription(
      `${progressBar(elapsedSec, track.duration)}\n${formatDuration(elapsedSec)} / ${formatDuration(track.duration)}`,
    );
  }
  return embed;
}


// ชื่อเพลงแบบกดเป็นลิงก์ได้ (ตัด [ ] ออกเพราะจะทำให้รูปแบบลิงก์ของ Discord พัง)
function trackLine(track) {
  const title = escapeMarkdown(track.title.replace(/[[\]]/g, ''));
  return `[${title}](${track.url}) \`${formatDuration(track.duration)}\` — ${requester(track)}`;
}

function queueList(queue) {
  const lines = ['**Now Playing**', trackLine(queue.current)];

  if (queue.tracks.length > 0) {
    lines.push('', '**Up Next**');
    queue.tracks.slice(0, QUEUE_SHOW_LIMIT).forEach((track, i) => lines.push(`${i + 1}. ${trackLine(track)}`));
    if (queue.tracks.length > QUEUE_SHOW_LIMIT) {
      lines.push(`...and ${queue.tracks.length - QUEUE_SHOW_LIMIT} more`);
    }
  }

  const totalSec = queue.tracks.reduce((sum, t) => sum + (t.duration ?? 0), 0);
  return new EmbedBuilder()
    .setColor(COLOR)
    .setAuthor({ name: '📜 Queue' })
    .setDescription(lines.join('\n'))
    .setFooter({
      text: `${queue.tracks.length} in queue • Total ${formatDuration(totalSec)} • Autoplay: ${queue.autoplay ? 'On' : 'Off'}`,
    });
}

module.exports = { nowPlaying, queueList, requester };
