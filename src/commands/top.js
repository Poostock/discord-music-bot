const { SlashCommandBuilder, MessageFlags, EmbedBuilder } = require('discord.js');
const stats = require('../music/stats');
const icons = require('../utils/icons');

const COLOR = 0xa78bfa; // ม่วงลาเวนเดอร์ (ธีมเดียวกับ Music Panel)

module.exports = {
  data: new SlashCommandBuilder()
    .setName('top')
    .setDescription('ดู 10 เพลงที่ Server นี้เปิดบ่อยที่สุด (Autoplay ใช้ข้อมูลนี้เลือกเพลง)'),

  async execute(interaction) {
    const list = stats.top(interaction.guildId, 10);
    if (list.length === 0) {
      await interaction.reply({ content: 'ยังไม่มีสถิติ — เปิดเพลงด้วย /play ก่อน', flags: MessageFlags.Ephemeral });
      return;
    }

    // ชื่อเพลงเป็น badge กดเป็นลิงก์ได้ (ตัด ` [ ] ออกเพราะทำให้รูปแบบพัง)
    const lines = list.map((t, i) => {
      const title = t.title.replace(/[`[\]]/g, '');
      return `**${i + 1}.** [\`${title}\`](${t.url}) · played ${t.plays} ${t.plays === 1 ? 'time' : 'times'}`;
    });

    const embed = new EmbedBuilder()
      .setColor(COLOR)
      .setAuthor({ name: 'Top Songs in this Server', iconURL: icons.url('note') })
      .setDescription(lines.join('\n'))
      .setFooter({ text: 'Only songs played with /play are counted • Recent plays count more' });
    await interaction.reply({ embeds: [embed] });
  },
};
