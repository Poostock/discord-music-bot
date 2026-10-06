const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const queueManager = require('../music/queueManager');
const embeds = require('../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('nowplaying')
    .setDescription('ดูเพลงที่กำลังเล่นอยู่'),

  async execute(interaction) {
    const queue = queueManager.get(interaction.guildId);
    if (!queue?.current) {
      await interaction.reply({ content: 'ไม่มีเพลงที่กำลังเล่นอยู่', flags: MessageFlags.Ephemeral });
      return;
    }

    const embed = embeds.nowPlaying(queue.current, { elapsedMs: queue.elapsedMs, paused: queue.paused });
    await interaction.reply({ embeds: [embed] });
  },
};
