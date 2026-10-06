const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { getVoiceConnection } = require('@discordjs/voice');
const { requireSameChannel } = require('../music/voice');
const panel = require('../utils/panel');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('leave')
    .setDescription('ให้บอทออกจาก Voice Channel'),

  async execute(interaction) {
    requireSameChannel(interaction);
    const connection = getVoiceConnection(interaction.guildId);
    if (!connection) {
      await interaction.reply({ content: 'บอทไม่ได้อยู่ใน Voice Channel', flags: MessageFlags.Ephemeral });
      return;
    }

    connection.destroy();
    await interaction.reply(panel.notice('👋 Left the voice channel'));
  },
};
