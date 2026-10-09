const { SlashCommandBuilder, MessageFlags, escapeMarkdown } = require('discord.js');
const queueManager = require('../music/queueManager');
const { requireSameChannel } = require('../music/voice');
const UserError = require('../utils/UserError');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('skip')
    .setDescription('ข้ามไปเพลงถัดไป'),

  async execute(interaction) {
    requireSameChannel(interaction);
    const queue = queueManager.get(interaction.guildId);
    if (queue?.current?.live) throw new UserError('วิทยุข้ามเพลงไม่ได้ — เปลี่ยนสถานีด้วยเมนูบน Radio Panel หรือ /lofi');
    const skipped = queue?.skip(interaction.member.displayName);
    if (!skipped) {
      await interaction.reply({ content: 'ไม่มีเพลงที่กำลังเล่นอยู่', flags: MessageFlags.Ephemeral });
      return;
    }

    // เห็นคนเดียว: ทุกคนเห็นผลจากการ์ด "Skipped by ..." ที่ Panel ถูกย่ออยู่แล้ว
    const after = queue.current ? '' : '\nไม่มีเพลงในคิวแล้ว';
    await interaction.reply({ content: `⏭️ ข้าม **${escapeMarkdown(skipped.title)}**${after}`, flags: MessageFlags.Ephemeral });
  },
};
