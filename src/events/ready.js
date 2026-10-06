const { Events } = require('discord.js');
const icons = require('../utils/icons');

// ทุกไฟล์ event ต้อง export: name (ชื่อ event), execute (ฟังก์ชันที่จะทำ)
// once: true = ทำครั้งเดียว
module.exports = {
  name: Events.ClientReady,
  once: true,
  async execute(client) {
    console.log(`Online แล้วในชื่อ ${client.user.tag}`);
    await icons.load(client); // ไอคอนธีมม่วงของ Music Panel
  },
};
