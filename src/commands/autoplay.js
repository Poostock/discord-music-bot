const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const queueManager = require('../music/queueManager');
const { requireSameChannel } = require('../music/voice');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('autoplay')
    .setDescription('เปิด/ปิด Autoplay (เล่นเพลงที่เกี่ยวข้องต่ออัตโนมัติเมื่อคิวหมด)'),

  async execute(interaction) {
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
