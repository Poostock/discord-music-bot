const { SlashCommandBuilder } = require('discord.js');
const youtube = require('../music/sources/youtube');
const queueManager = require('../music/queueManager');
const { validateUserChannel, connect } = require('../music/voice');
const panel = require('../utils/panel');

module.exports = {
  cooldown: 3, // วินาที: กันสแปม (แต่ละครั้งต้องเปิด yt-dlp ใหม่)

  data: new SlashCommandBuilder()
    .setName('play')
    .setDescription('เล่นเพลงจากชื่อเพลงหรือลิงก์ YouTube')
    .addStringOption((option) =>
      option
        .setName('query')
        .setDescription('ชื่อเพลง หรือ URL ของ YouTube')
        .setRequired(true)
        .setMaxLength(200),
    ),

  // UserError ที่ถูก throw ในนี้ interactionCreate จะตอบผู้ใช้ให้เอง
  async execute(interaction) {
    const query = interaction.options.getString('query', true).trim();

    // 1) ตรวจว่าผู้ใช้อยู่ห้องเสียง และบอทเข้าได้ (เร็ว ตอบเตือนแบบเห็นคนเดียวได้)
    const { channel, connection: existing } = validateUserChannel(interaction);

    // 2) การค้นหา/เข้าห้องใช้เวลาหลายวินาที ต้อง defer ก่อน (Discord ให้เวลาตอบแค่ 3 วินาที)
    await interaction.deferReply();

    // 3) ค้นหาก่อนเข้าห้อง: ถ้าหาไม่เจอ บอทจะได้ไม่เข้าห้องเปล่า ๆ
    const track = { ...(await youtube.resolve(query)), requestedBy: interaction.user.id };
    const connection = existing ?? (await connect(channel));

    // 4) เล่นทันที หรือเพิ่มเข้าคิว
    const queue =
      queueManager.get(interaction.guildId) ??
      queueManager.create(interaction.guildId, connection, interaction.channel);
    queue.textChannel = interaction.channel; // ประกาศ Now Playing ในช่องที่ /play ล่าสุด
    const position = queue.add(track);

    if (position === 0) {
      // เล่นทันที → ตอบเป็น Music Panel และให้คิวจำข้อความนี้ไว้ (เพื่อย่อเป็นบรรทัดเดียวเมื่อเพลงจบ)
      queue.setPanelMessage(await interaction.editReply(panel.build(queue)), track);
    } else {
      await interaction.editReply(panel.queued(track, position)); // บรรทัดเดียว ไม่ใช้การ์ด
    }
  },
};
