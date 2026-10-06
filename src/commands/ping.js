const { SlashCommandBuilder } = require('discord.js');

// ทุกไฟล์คำสั่งต้อง export 2 อย่าง:
// - data: ชื่อและคำอธิบายของคำสั่ง (ใช้ตอนลงทะเบียนกับ Discord)
// - execute: สิ่งที่บอททำเมื่อมีคนใช้คำสั่ง
module.exports = {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('ทดสอบว่าบอทตอบสนองหรือไม่'),

  async execute(interaction) {
    await interaction.reply(`Pong! (${interaction.client.ws.ping} ms)`);
  },
};
