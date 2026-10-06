const { MessageFlags } = require('discord.js');
const queueManager = require('./queueManager');
const { requireSameChannel } = require('./voice');
const panel = require('../utils/panel');
const embeds = require('../utils/embeds');
const UserError = require('../utils/UserError');

// จัดการการกดปุ่มบน Music Panel (เรียกจาก interactionCreate)
// UserError ที่ throw ในนี้ interactionCreate จะตอบผู้ใช้แบบเห็นคนเดียวให้เอง
async function handle(interaction) {
  const action = interaction.customId.slice(panel.PREFIX.length);
  const queue = queueManager.get(interaction.guildId);

  // Panel หมดอายุ: บอทออกจากห้อง / restart แล้ว / เป็น Panel ของเพลงที่จบไปแล้ว → ย่อเป็นบรรทัดเดียว
  if (!queue?.current || queue.panelMessage?.id !== interaction.message.id) {
    await interaction.update(panel.compactFromMessage(interaction.message));
    await interaction.followUp({ content: 'Panel นี้หมดอายุแล้ว ใช้ Panel ล่าสุด หรือ /play', flags: MessageFlags.Ephemeral });
    return;
  }

  // ดูคิว: ใครก็ดูได้ (เหมือน /queue) และเห็นคนเดียว
  if (action === 'queue') {
    await interaction.reply({ embeds: [embeds.queueList(queue)], flags: MessageFlags.Ephemeral });
    return;
  }

  // ปุ่มควบคุม: ต้องอยู่ห้องเดียวกับบอท (กติกาเดียวกับคำสั่ง /skip /stop ฯลฯ)
  requireSameChannel(interaction);
  const by = interaction.member.displayName; // ชื่อที่แสดงใน Server (แสดงในหัวข้อการ์ด เช่น "Skipped by Lara")

  switch (action) {
    // ── ปุ่มที่เปลี่ยนเพลง: Panel นี้จะถูกย่อเป็นการ์ดเล็ก (บอกว่าใครกด) และเพลงใหม่จะส่ง Panel ใหม่ ──
    // ไม่ส่งข้อความเพิ่ม เพื่อไม่ให้แชทรก
    case 'skip':
      await interaction.deferUpdate();
      queue.skip(by);
      return;
    case 'back':
      if (queue.backStack.length === 0) throw new UserError('ไม่มีเพลงก่อนหน้า');
      await interaction.deferUpdate();
      queue.back(by);
      return;
    case 'stop':
      await interaction.deferUpdate();
      queue.stop(by);
      return;

    // ── ปุ่มที่เปลี่ยนสถานะ: แก้ Panel เดิมให้แสดงสถานะใหม่ ──
    case 'mute':
      queue.toggleMute();
      break;
    case 'pause':
      if (queue.paused) queue.resume();
      else if (!queue.pause()) throw new UserError('เพลงยังโหลดไม่เสร็จ ลองใหม่อีกครั้ง');
      break;
    case 'autoplay':
      queue.setAutoplay(!queue.autoplay);
      break;
    default:
      await interaction.deferUpdate(); // ปุ่มที่ไม่รู้จัก: รับไว้เฉย ๆ
      return;
  }

  await interaction.update(panel.build(queue));
}

module.exports = { handle };
