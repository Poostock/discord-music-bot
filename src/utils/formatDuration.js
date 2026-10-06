// แปลงวินาทีเป็นข้อความ เช่น 296 -> "4:56", 3725 -> "1:02:05"
function formatDuration(seconds) {
  if (seconds == null) return 'Live';

  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const pad = (n) => String(n).padStart(2, '0');

  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

module.exports = formatDuration;
