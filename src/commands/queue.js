const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const queueManager = require('../music/queueManager');
const embeds = require('../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('queue')
    .setDescription('ดูเพลงที่กำลังเล่นและเพลงในคิว'),

  async execute(interaction) {
    const queue = queueManager.get(interaction.guildId);
    if (!queue?.current) {
      await interaction.reply({ content: 'ไม่มีเพลงในคิว', flags: MessageFlags.Ephemeral });
      return;
    }

    await interaction.reply({ embeds: [embeds.queueList(queue)] });
  },
};
