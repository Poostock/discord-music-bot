const { Events } = require('discord.js');
const queueManager = require('../music/queueManager');

// ทำงานทุกครั้งที่มีคนเข้า/ออก/ย้ายห้องเสียง
// ใช้ตรวจว่าห้องที่บอทอยู่ยังมีคนฟังอยู่หรือไม่
module.exports = {
  name: Events.VoiceStateUpdate,
  execute(oldState, newState) {
    const queue = queueManager.get(newState.guild.id);
    const botChannel = newState.guild.members.me?.voice.channel;
    if (!queue || !botChannel) return;

    const listeners = botChannel.members.filter((member) => !member.user.bot).size;
    queue.setAlone(listeners === 0);
  },
};
