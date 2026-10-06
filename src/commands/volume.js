const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const queueManager = require('../music/queueManager');
const { requireSameChannel } = require('../music/voice');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('volume')
    .setDescription('ปรับหรือดูระดับเสียง')
    .addIntegerOption((option) =>
      option
        .setName('level')
        .setDescription('ระดับเสียง 0-150 (ไม่ใส่ = ดูระดับปัจจุบัน)')
        .setMinValue(0) // Discord จะไม่ยอมให้พิมพ์ค่านอกช่วงนี้
        .setMaxValue(150),
    ),

  async execute(interaction) {
    const queue = queueManager.get(interaction.guildId);
    if (!queue?.current) {
      await interaction.reply({ content: 'ไม่มีเพลงที่กำลังเล่นอยู่', flags: MessageFlags.Ephemeral });
      return;
    }

    const level = interaction.options.getInteger('level'); // ไม่ใส่ = null
    if (level === null) {
      await interaction.reply({ content: `🔊 ระดับเสียงตอนนี้: **${queue.volume}%**`, flags: MessageFlags.Ephemeral });
      return;
    }

    requireSameChannel(interaction); // ดูได้ทุกคน แต่ปรับได้เฉพาะคนที่อยู่ห้องเดียวกับบอท
    const wasMuted = queue.muted;
    queue.setVolume(level); // เลิก Mute ไปด้วย
    if (wasMuted) queue.refreshPanel(); // ปุ่ม Unmute บน Panel กลับเป็น Mute
    await interaction.reply({ content: `${level === 0 ? '🔇' : '🔊'} ปรับระดับเสียงเป็น **${level}%**`, flags: MessageFlags.Ephemeral });
  },
};
