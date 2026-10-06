// สคริปต์นี้ใช้ลงทะเบียน Slash Commands กับ Discord
// รันเฉพาะตอนเพิ่ม/แก้คำสั่ง: npm run deploy
const fs = require('node:fs');
const path = require('node:path');
const { REST, Routes } = require('discord.js');
const config = require('./config');

if (!config.clientId || !config.guildId) {
  console.error('ไม่พบ CLIENT_ID หรือ GUILD_ID ในไฟล์ .env');
  process.exit(1);
}

// อ่านทุกไฟล์ใน src/commands แล้วแปลงเป็น JSON ที่ Discord เข้าใจ
const commands = [];
const commandsPath = path.join(__dirname, 'commands');
for (const file of fs.readdirSync(commandsPath).filter((f) => f.endsWith('.js'))) {
  const command = require(path.join(commandsPath, file));
  commands.push(command.data.toJSON());
}

const rest = new REST().setToken(config.token);

(async () => {
  try {
    // ลงทะเบียนแบบ Guild = เฉพาะ Server ของเรา เห็นผลทันที
    // put = แทนที่รายการคำสั่งเดิมทั้งหมดด้วยรายการนี้
    const data = await rest.put(
      Routes.applicationGuildCommands(config.clientId, config.guildId),
      { body: commands },
    );
    console.log(`ลงทะเบียนสำเร็จ ${data.length} คำสั่ง: ${data.map((c) => '/' + c.name).join(', ')}`);
  } catch (error) {
    console.error('ลงทะเบียนไม่สำเร็จ:', error);
    process.exitCode = 1;
  }
})();
