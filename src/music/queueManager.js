const { VoiceConnectionStatus } = require('@discordjs/voice');
const GuildQueue = require('./GuildQueue');

// เก็บ GuildQueue ของแต่ละ Server: guildId -> GuildQueue
const queues = new Map();

function get(guildId) {
  return queues.get(guildId);
}

function create(guildId, connection, textChannel) {
  const queue = new GuildQueue(connection, textChannel);
  queues.set(guildId, queue);

  // เมื่อ connection ถูกปิด (/leave, ถูกเตะ, หลุดถาวร, ออกเอง): หยุดเพลง ล้าง timer และลบคิวทิ้ง
  connection.once(VoiceConnectionStatus.Destroyed, () => {
    queue.destroy();
    queues.delete(guildId);
  });

  return queue;
}

module.exports = { get, create };
