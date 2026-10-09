const { SlashCommandBuilder, MessageFlags, PermissionFlagsBits } = require('discord.js');
const queueManager = require('../music/queueManager');
const stats = require('../music/stats');
const { requireSameChannel } = require('../music/voice');
const UserError = require('../utils/UserError');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('autoplay')
    .setDescription('เปิด/ปิด Autoplay (เล่นเพลงที่เกี่ยวข้องต่ออัตโนมัติเมื่อคิวหมด)')
    .addBooleanOption((option) =>
      option.setName('reset').setDescription('ล้างสถิติเพลงที่ Server นี้เปิดบ่อย (ต้องมีสิทธิ์ Manage Server)'),
    ),

  async execute(interaction) {
    // /autoplay reset:True → ล้างสถิติ (ไม่สลับเปิด/ปิด) — เป็นข้อมูลของทั้ง Server จึงให้เฉพาะคนที่จัดการ Server ได้
    if (interaction.options.getBoolean('reset')) {
      if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageGuild)) {
        throw new UserError('ล้างสถิติได้เฉพาะคนที่มีสิทธิ์ Manage Server');
      }
      const count = stats.reset(interaction.guildId);
      await interaction.reply({ content: `🧹 ล้างสถิติแล้ว (${count} เพลง) — Autoplay จะเริ่มเรียนรู้ใหม่`, flags: MessageFlags.Ephemeral });
      return;
    }

    requireSameChannel(interaction);
    const queue = queueManager.get(interaction.guildId);
    if (!queue) {
      await interaction.reply({ content: 'บอทไม่ได้อยู่ในห้องเสียง ใช้ /play ก่อน', flags: MessageFlags.Ephemeral });
      return;
    }

    const on = !queue.autoplay; // สลับสถานะ
    const removed = queue.setAutoplay(on);
    queue.refreshPanel(); // ปุ่ม AutoPlay บน Panel เปลี่ยนสีให้ทุกคนเห็น

    // เห็นคนเดียว: สถานะดูได้จากสีปุ่ม AutoPlay บน Panel
    if (on) {
      const note = queue.lastPlayed ? '' : '\nจะเริ่มหาเพลงหลังจากมีเพลงเล่นด้วย /play';
      await interaction.reply({
        content: `🎵 เปิด Autoplay แล้ว — เมื่อคิวหมด บอทจะเลือกเพลงที่เกี่ยวข้องมาเล่นต่อ${note}`,
        flags: MessageFlags.Ephemeral,
      });
    } else {
      const note = removed > 0 ? ` (ลบเพลง Autoplay ที่รออยู่ ${removed} เพลง)` : '';
      await interaction.reply({ content: `⏹️ ปิด Autoplay แล้ว${note}`, flags: MessageFlags.Ephemeral });
    }
  },
};
