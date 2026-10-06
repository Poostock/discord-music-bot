const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const queueManager = require('../music/queueManager');
const { requireSameChannel } = require('../music/voice');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('stop')
    .setDescription('หยุดเพลงและล้างคิว (บอทยังอยู่ในห้อง)'),

  async execute(interaction) {
    requireSameChannel(interaction);
    const queue = queueManager.get(interaction.guildId);
    if (!queue?.current) {
      await interaction.reply({ content: 'ไม่มีเพลงที่กำลังเล่นอยู่', flags: MessageFlags.Ephemeral });
      return;
    }

    // เห็นคนเดียว: ทุกคนเห็นผลจากการ์ด "Stopped by ..." ที่ Panel ถูกย่ออยู่แล้ว
    const wasAutoplay = queue.stop(interaction.member.displayName);
    await interaction.reply({
      content: `⏹️ หยุดเพลงและล้างคิวแล้ว${wasAutoplay ? ' (ปิด Autoplay ด้วย)' : ''}`,
      flags: MessageFlags.Ephemeral,
    });
  },
};
