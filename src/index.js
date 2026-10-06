const fs = require('node:fs');
const path = require('node:path');
const { Client, Collection, Events, GatewayIntentBits } = require('discord.js');
const config = require('./config');
const checkDependencies = require('./utils/checkDependencies');

checkDependencies();

// Intents = บอกว่าบอทต้องการรับข้อมูลประเภทไหนจาก Discord
// - Guilds: ข้อมูล Server/Channel และใช้รับ Slash Commands
// - GuildVoiceStates: รู้ว่าใครอยู่ Voice Channel ไหน (จำเป็นสำหรับระบบเสียง)
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates],
  // ข้อความของบอทจะไม่แท็ก (ping) ใครเลย แม้ชื่อเพลงจะมี @everyone
  allowedMentions: { parse: [] },
});

// โหลดทุกคำสั่งใน src/commands เก็บไว้ใน client.commands (ชื่อคำสั่ง -> ไฟล์คำสั่ง)
client.commands = new Collection();
const commandsPath = path.join(__dirname, 'commands');
for (const file of fs.readdirSync(commandsPath).filter((f) => f.endsWith('.js'))) {
  const command = require(path.join(commandsPath, file));
  if ('data' in command && 'execute' in command) {
    client.commands.set(command.data.name, command);
  } else {
    console.warn(`[คำเตือน] ${file} ไม่มี data หรือ execute`);
  }
}

// โหลดทุก event ใน src/events แล้วผูกกับ client
const eventsPath = path.join(__dirname, 'events');
for (const file of fs.readdirSync(eventsPath).filter((f) => f.endsWith('.js'))) {
  const event = require(path.join(eventsPath, file));
  if (event.once) {
    client.once(event.name, (...args) => event.execute(...args));
  } else {
    client.on(event.name, (...args) => event.execute(...args));
  }
}

// ตาข่ายกันตก: Error ที่ไม่มีใครจับ → log ไว้ แทนที่จะปล่อยให้บอทล่มทั้งตัว
client.on(Events.Error, (error) => console.error('[client]', error));
process.on('unhandledRejection', (error) => console.error('[unhandledRejection]', error));

// login ไม่สำเร็จ (เช่น เน็ตยังไม่พร้อมตอนเปิดเครื่อง) → ปิดโปรแกรม ให้ pm2 เปิดใหม่และลองอีกครั้ง
// (ใช้ exitCode + destroy แทน process.exit() เพื่อให้ปิดการเชื่อมต่อให้เรียบร้อยก่อนจบโปรแกรม)
client.login(config.token).catch(async (error) => {
  console.error('Login ไม่สำเร็จ:', error.message);
  process.exitCode = 1;
  await client.destroy();
});
