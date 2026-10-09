const { MessageFlags } = require('discord.js');
const queueManager = require('./queueManager');
const { requireSameChannel, validateUserChannel, connect } = require('./voice');
const panel = require('../utils/panel');
const embeds = require('../utils/embeds');
const UserError = require('../utils/UserError');

// เลือกสถานีจากแผง /lofi: เข้าห้องเสียงของคนที่เลือก แล้วเปิดวิทยุ
async function pickStation(interaction) {
  const { channel, connection: existing } = validateUserChannel(interaction); // ไม่ได้อยู่ห้องเสียง ฯลฯ → เตือนเห็นคนเดียว
  await interaction.deferUpdate(); // หาไลฟ์ใช้เวลาหลายวินาที (Discord ให้ตอบภายใน 3 วินาที)

  const connection = existing ?? (await connect(channel));
  const queue = queueManager.get(interaction.guildId) ?? queueManager.create(interaction.guildId, connection, interaction.channel);
  queue.textChannel = interaction.channel;
  const by = { id: interaction.user.id, name: interaction.member.displayName };
  try {
    const station = await queue.startRadio(interaction.values[0], by);
    await interaction.editReply(panel.radioStarted(station, by.name)); // แผงเลือก → การ์ดเล็ก
  } catch (error) {
    if (!queue.current) queue.startIdleTimer(); // เปิดไม่ได้และไม่มีอะไรเล่น → ไม่ให้บอทค้างในห้อง
    throw error;
  }
}

// จัดการการกดปุ่ม/เลือกเมนูบน Music Panel, Radio Panel และแผง /lofi (เรียกจาก interactionCreate)
// UserError ที่ throw ในนี้ interactionCreate จะตอบผู้ใช้แบบเห็นคนเดียวให้เอง
async function handle(interaction) {
  const action = interaction.customId.slice(panel.PREFIX.length);
  if (action === 'pick') return pickStation(interaction); // แผง /lofi ใช้ได้เสมอ ไม่ผูกกับเพลงที่กำลังเล่น

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
    case 'station': // เมนูเปลี่ยนสถานีบน Radio Panel
      await interaction.deferUpdate();
      if (queue.radio?.key === interaction.values[0]) return; // เลือกสถานีเดิม → ไม่ต้องทำอะไร
      await queue.startRadio(interaction.values[0], { id: interaction.user.id, name: by });
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
