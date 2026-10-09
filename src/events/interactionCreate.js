const { Events, MessageFlags } = require('discord.js');
const UserError = require('../utils/UserError');
const buttons = require('../music/buttons');
const { PREFIX: PANEL_PREFIX } = require('../utils/panel');

// เวลาที่แต่ละคนใช้คำสั่งได้อีกครั้ง: "ชื่อคำสั่ง:userId" -> เวลา (ms)
const cooldowns = new Map();

// ตอบแบบเห็นคนเดียว (Ephemeral) ไม่ว่าคำสั่งจะตอบไปแล้วหรือยัง
// การตอบเองก็พังได้ (เช่น interaction หมดอายุ) จึงต้องครอบ try
async function replyPrivately(interaction, content) {
  const message = { content, flags: MessageFlags.Ephemeral };
  try {
    // ปุ่ม/เมนูที่ deferUpdate แล้วต้องใช้ followUp (editReply จะเขียนทับการ์ด Panel)
    if (interaction.deferred && !interaction.replied && !interaction.isMessageComponent()) {
      // defer แล้ว: ข้อความ "thinking..." ทุกคนเห็น → ลบทิ้ง แล้วส่ง Error แบบเห็นคนเดียวแทน
      await interaction.deleteReply();
      await interaction.followUp(message);
    } else if (interaction.replied || interaction.deferred) {
      await interaction.followUp(message);
    } else {
      await interaction.reply(message);
    }
  } catch (error) {
    console.error('ตอบผู้ใช้ไม่ได้:', error.message);
  }
}

// ทำงานทุกครั้งที่มีคนใช้ Slash Command (หรือกดปุ่ม ฯลฯ)
module.exports = {
  name: Events.InteractionCreate,
  async execute(interaction) {
    // สนใจเฉพาะ Slash Command และปุ่ม/เมนูเลือกของบอท (Music Panel, Radio Panel, แผง /lofi)
    const isPanelButton =
      (interaction.isButton() || interaction.isStringSelectMenu()) && interaction.customId.startsWith(PANEL_PREFIX);
    if (!interaction.isChatInputCommand() && !isPanelButton) return;

    // ด่าน 1: ใช้ได้เฉพาะใน Server (ไม่รับจาก DM)
    if (!interaction.inCachedGuild()) {
      await replyPrivately(interaction, 'ใช้คำสั่งนี้ได้เฉพาะใน Server');
      return;
    }

    if (isPanelButton) {
      await run(interaction, `ปุ่ม ${interaction.customId}`, () => buttons.handle(interaction));
      return;
    }

    const command = interaction.client.commands.get(interaction.commandName);
    if (!command) {
      console.error(`ไม่พบคำสั่ง /${interaction.commandName}`);
      return;
    }

    // ด่าน 2: cooldown (เฉพาะคำสั่งที่กำหนด cooldown ไว้ หน่วยวินาที)
    if (command.cooldown) {
      const key = `${command.data.name}:${interaction.user.id}`;
      const readyAt = cooldowns.get(key) ?? 0;
      if (Date.now() < readyAt) {
        const seconds = Math.ceil((readyAt - Date.now()) / 1000);
        await replyPrivately(interaction, `ใช้ /${command.data.name} ได้อีกครั้งใน ${seconds} วินาที`);
        return;
      }
      cooldowns.set(key, Date.now() + command.cooldown * 1000);
    }

    await run(interaction, `/${interaction.commandName}`, () => command.execute(interaction));
  },
};

// เรียกคำสั่ง/ปุ่ม แล้วจัดการ Error แบบเดียวกันทั้งหมด
async function run(interaction, label, action) {
  try {
    await action();
  } catch (error) {
    // UserError = ข้อความที่ตั้งใจให้ผู้ใช้เห็น (เช่น "คุณต้องอยู่ห้องเดียวกับบอท")
    if (error instanceof UserError) {
      await replyPrivately(interaction, error.message);
      return;
    }
    // Error อื่น = บั๊ก → รายละเอียดอยู่ใน Terminal ผู้ใช้เห็นแค่ข้อความกลาง ๆ
    console.error(`เกิดข้อผิดพลาดใน ${label}:`, error);
    await replyPrivately(interaction, 'เกิดข้อผิดพลาดขณะทำคำสั่งนี้');
  }
}
