// สถานีวิทยุของ /lofi = ไลฟ์ 24/7 บน YouTube
// url   = ลิงก์หลัก (ลิงก์ไลฟ์ หรือ https://www.youtube.com/@ชื่อช่อง/live)
// query = คำค้นสำรอง: ถ้าลิงก์หลักไม่ได้ไลฟ์อยู่ (ไลฟ์ถูกปิด/เปลี่ยนลิงก์) จะค้นหาไลฟ์ที่กำลังออนแอร์ด้วยคำนี้แทน
// เพิ่ม/ลบ/แก้สถานีได้ที่นี่ (เมนูของ Discord ใส่ได้สูงสุด 25 สถานี) แล้ว pm2 restart music-bot
const STATIONS = [
  {
    key: 'study',
    emoji: '📚',
    label: 'Study',
    description: 'Lofi Girl · beats to relax/study to',
    url: 'https://www.youtube.com/watch?v=rFZHOHl-L8A',
    query: 'Lofi Girl lofi hip hop radio beats to relax study to',
  },
  {
    key: 'sleep',
    emoji: '💤',
    label: 'Sleep',
    description: 'Lofi Girl · beats to sleep/chill to',
    url: 'https://www.youtube.com/watch?v=JD-kMIpDfnY',
    query: 'Lofi Girl lofi hip hop radio beats to sleep chill to',
  },
  {
    key: 'jazz',
    emoji: '🎷',
    label: 'Jazz',
    description: 'Lofi Girl · jazz lofi radio',
    url: 'https://www.youtube.com/watch?v=E2vONfzoyRI',
    query: 'Lofi Girl jazz lofi radio',
  },
  {
    key: 'synthwave',
    emoji: '🌆',
    label: 'Synthwave',
    description: 'Lofi Girl · synthwave radio',
    url: 'https://www.youtube.com/watch?v=4xDzrJKXOOY',
    query: 'Lofi Girl synthwave radio',
  },
  {
    key: 'chillhop',
    emoji: '🍂',
    label: 'Chillhop',
    description: 'Chillhop Music · Essentials Radio',
    url: 'https://www.youtube.com/@ChillhopMusic/live',
    query: 'Chillhop Music radio live',
  },
  {
    key: 'sad',
    emoji: '🌧️',
    label: 'Sad & Sleepy',
    description: 'the bootleg boy · sad & sleepy beats',
    url: 'https://www.youtube.com/@thebootlegboy/live',
    query: 'the bootleg boy lofi hip hop radio sad sleepy beats',
  },
];

function get(key) {
  return STATIONS.find((station) => station.key === key);
}

module.exports = { STATIONS, get };
