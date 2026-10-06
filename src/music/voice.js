const { PermissionFlagsBits } = require('discord.js');
const {
  joinVoiceChannel,
  getVoiceConnection,
  entersState,
  VoiceConnectionStatus,
} = require('@discordjs/voice');
const UserError = require('../utils/UserError');

// ใช้กับคำสั่งควบคุมเพลง: ถ้าบอทอยู่ในห้องเสียง ผู้ใช้ต้องอยู่ห้องเดียวกัน
// (กันคนที่ไม่ได้ฟังมา /skip /stop ใส่คนที่กำลังฟัง)
function requireSameChannel(interaction) {
  const botChannelId = interaction.guild.members.me.voice.channelId;
  if (botChannelId && interaction.member.voice.channelId !== botChannelId) {
    throw new UserError(`คุณต้องอยู่ในห้อง <#${botChannelId}> เดียวกับบอทถึงจะใช้คำสั่งนี้ได้`);
  }
}

// ตรวจว่าบอทเข้าห้องเสียงของผู้ใช้ได้หรือไม่ (ทำงานทันที ไม่ต้องรอ)
// คืนค่า { channel, connection } — connection จะมีค่าถ้าบอทอยู่ห้องนี้อยู่แล้ว
function validateUserChannel(interaction) {
  const channel = interaction.member.voice.channel;
  if (!channel) {
    throw new UserError('กรุณาเข้า Voice Channel ก่อน');
  }

  const existing = getVoiceConnection(interaction.guildId);
  if (existing) {
    if (existing.joinConfig.channelId === channel.id) {
      return { channel, connection: existing };
    }
    throw new UserError(`บอทกำลังใช้งานอยู่ในห้อง <#${existing.joinConfig.channelId}>`);
  }

  const permissions = channel.permissionsFor(interaction.guild.members.me);
  const required = { ViewChannel: 'View Channel', Connect: 'Connect', Speak: 'Speak' };
  const missing = Object.keys(required).filter((flag) => !permissions.has(PermissionFlagsBits[flag]));
  if (missing.length > 0) {
    throw new UserError(`บอทไม่มีสิทธิ์ในห้อง ${channel}: ${missing.map((f) => required[f]).join(', ')}`);
  }
  if (!channel.joinable) {
    throw new UserError(`บอทเข้าห้อง ${channel} ไม่ได้ (ห้องอาจเต็ม)`);
  }

  return { channel, connection: null };
}

// เข้าห้องเสียงและรอจนเชื่อมต่อสำเร็จ (อาจใช้เวลาหลายวินาที)
async function connect(channel) {
  const connection = joinVoiceChannel({
    channelId: channel.id,
    guildId: channel.guild.id,
    adapterCreator: channel.guild.voiceAdapterCreator,
    selfDeaf: true, // บอทไม่ต้องฟังเสียงในห้อง
  });

  // ถ้าหลุด (ถูกเตะ/เน็ตหลุด): ให้เวลา 5 วินาทีพยายามต่อใหม่ ถ้าไม่ได้ก็ปิดการเชื่อมต่อ
  connection.on(VoiceConnectionStatus.Disconnected, async () => {
    try {
      await Promise.race([
        entersState(connection, VoiceConnectionStatus.Signalling, 5_000),
        entersState(connection, VoiceConnectionStatus.Connecting, 5_000),
      ]);
    } catch {
      if (connection.state.status !== VoiceConnectionStatus.Destroyed) {
        connection.destroy();
      }
    }
  });

  try {
    await entersState(connection, VoiceConnectionStatus.Ready, 20_000);
  } catch {
    if (connection.state.status !== VoiceConnectionStatus.Destroyed) {
      connection.destroy();
    }
    throw new UserError('เชื่อมต่อ Voice Channel ไม่สำเร็จภายใน 20 วินาที ลองใหม่อีกครั้ง');
  }

  return connection;
}

module.exports = { validateUserChannel, connect, requireSameChannel };
