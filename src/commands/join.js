const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { validateUserChannel, connect } = require('../music/voice');
const queueManager = require('../music/queueManager');
const panel = require('../utils/panel');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('join')
    .setDescription('ให้บอทเข้า Voice Channel ที่คุณอยู่'),

  // UserError ที่ถูก throw ในนี้ interactionCreate จะตอบผู้ใช้ให้เอง
  async execute(interaction) {
    // ขั้นที่ 1: ตรวจเงื่อนไข (เร็ว)
    const { channel, connection: existing } = validateUserChannel(interaction);
    if (existing) {
      await interaction.reply({ content: `บอทอยู่ในห้อง ${channel} แล้ว`, flags: MessageFlags.Ephemeral });
      return;
    }

    // ขั้นที่ 2: บอก Discord ว่ากำลังทำงาน (ต้องตอบภายใน 3 วินาที) แล้วค่อยเข้าห้อง
    await interaction.deferReply();
    const connection = await connect(channel);
    // สร้างคิวไว้เลย เพื่อให้ระบบออกจากห้องอัตโนมัติทำงาน (ไม่มีเพลง 3 นาที / ไม่มีคน 1 นาที)
    queueManager.create(interaction.guildId, connection, interaction.channel).startIdleTimer();
    await interaction.editReply(panel.notice(`🎧 Joined ${channel}`));
  },
};
