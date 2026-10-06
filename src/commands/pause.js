const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const queueManager = require('../music/queueManager');
const { requireSameChannel } = require('../music/voice');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('pause')
    .setDescription('หยุดเพลงชั่วคราว'),

  async execute(interaction) {
    requireSameChannel(interaction);
    const queue = queueManager.get(interaction.guildId);
    if (!queue?.pause()) {
      await interaction.reply({ content: 'ไม่มีเพลงที่กำลังเล่นอยู่', flags: MessageFlags.Ephemeral });
      return;
    }
    queue.refreshPanel(); // ปุ่มบน Panel เปลี่ยนเป็น Resume ให้ทุกคนเห็น
    await interaction.reply({ content: '⏸️ หยุดชั่วคราว (ใช้ /resume เพื่อเล่นต่อ)', flags: MessageFlags.Ephemeral });
  },
};
