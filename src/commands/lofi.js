const { SlashCommandBuilder } = require('discord.js');
const panel = require('../utils/panel');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('lofi')
    .setDescription('เปิดวิทยุ lofi 24/7 — เลือกสถานีจากเมนู'),

  // ส่งแผงเลือกสถานี (ทุกคนเห็นและกดเลือกได้) — การเลือกจัดการใน music/buttons.js (pickStation)
  async execute(interaction) {
    await interaction.reply(panel.picker());
  },
};
