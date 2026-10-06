const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const queueManager = require('../music/queueManager');
const { requireSameChannel } = require('../music/voice');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('resume')
    .setDescription('เล่นเพลงที่หยุดชั่วคราวต่อ'),

  async execute(interaction) {
    requireSameChannel(interaction);
    const queue = queueManager.get(interaction.guildId);
    if (!queue?.resume()) {
      await interaction.reply({ content: 'ไม่มีเพลงที่หยุดชั่วคราวอยู่', flags: MessageFlags.Ephemeral });
      return;
    }
    queue.refreshPanel(); // ปุ่มบน Panel กลับเป็น Pause ให้ทุกคนเห็น
    await interaction.reply({ content: '▶️ เล่นต่อ', flags: MessageFlags.Ephemeral });
  },
};
