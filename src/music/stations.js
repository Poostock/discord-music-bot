// สถานีวิทยุของ /lofi มี 2 แบบ:
//
// 1) สถานีไลฟ์ (ไม่มี type) = ไลฟ์ 24/7 บน YouTube
//    url   = ลิงก์หลัก (ลิงก์ไลฟ์ หรือ https://www.youtube.com/@ชื่อช่อง/live)
//    query = คำค้นสำรอง: ถ้าลิงก์หลักไม่ได้ไลฟ์อยู่ (ไลฟ์ถูกปิด/เปลี่ยนลิงก์) จะค้นหาไลฟ์ที่กำลังออนแอร์ด้วยคำนี้แทน
//
// 2) Mix Station (type: 'mix') = เพลงต้นฉบับต่อเนื่อง: สุ่มเพลงตั้งต้น 1 เพลง → ต่อด้วย Autoplay (YouTube Mix)
//    → ทุก 5 เพลงกลับไปเริ่มจากเพลงตั้งต้นตัวใหม่ (กันหลุดแนว)
//    seeds = เพลงตั้งต้น เขียนเป็นคำค้นได้เลย (เช่น 'YOASOBI Idol official music video') ไม่ต้องหาลิงก์
//
// เพิ่ม/ลบ/แก้สถานีได้ที่นี่ (เมนูของ Discord ใส่ได้สูงสุด 25 สถานี) แล้ว pm2 restart music-bot
// ไม่อยากได้สถานีไหน → ลบรายการนั้นทิ้งได้เลย
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

  // ── Anime / ญี่ปุ่น / K-pop / Pop (ช่องเล็กกว่า ไลฟ์อาจปิดบ่อยกว่า — คำค้นสำรองจะช่วยหาไลฟ์ใหม่) ──
  {
    key: 'anime',
    emoji: '🌸',
    label: 'Anime Lofi',
    description: 'Aiwee LoFi · anime lofi radio',
    url: 'https://www.youtube.com/watch?v=kKcU21Tsk78',
    query: 'Anime LoFi Radio 24/7 study focus sleep',
  },
  {
    key: 'pokemon',
    emoji: '🎮',
    label: 'Pokémon Lofi Cafe',
    description: 'chill alchemist · Pokémon lofi night-and-day cafe',
    url: 'https://www.youtube.com/watch?v=3OFe1NI-Eiw',
    query: 'Pokemon lofi cafe 24/7 radio',
  },
  {
    key: 'citypop',
    emoji: '🗾',
    label: 'Japanese City Pop',
    description: 'Neon Kissaten · late night drive city pop',
    url: 'https://www.youtube.com/watch?v=T2V-gKdXOqo',
    query: 'Japanese City Pop 24/7 live radio',
  },
  {
    key: 'jpopbox',
    emoji: '🎵',
    label: 'J-Pop Music Box',
    description: 'J-POP Music BGM · J-pop as relaxing music box',
    url: 'https://www.youtube.com/watch?v=mtXASss7EY0',
    query: 'J-POP Relaxing Music Box 24/7 Live',
  },
  {
    key: 'tokyocafe',
    emoji: '☕',
    label: 'Tokyo Cafe Jazz',
    description: 'Cafe Music BGM · relaxing jazz piano',
    url: 'https://www.youtube.com/watch?v=6uddGul0oAc',
    query: 'Cafe Music BGM channel Tokyo cafe jazz piano live',
  },
  {
    key: 'kpop',
    emoji: '💜',
    label: 'K-Pop 24/7',
    description: 'ALL THE K-POP · K-pop live stream',
    url: 'https://www.youtube.com/watch?v=GaccTXdeRRI',
    query: 'K-POP 24/7 Live Stream',
  },
  {
    key: 'pophits',
    emoji: '📻',
    label: 'Pop Hits Mix',
    description: 'Radio Mix · best pop hits 24/7',
    url: 'https://www.youtube.com/watch?v=b-bK2Vn3D38',
    query: 'Best Radio 1 POP Hits 24/7 Live',
  },

  // ── Mix Station: เพลงต้นฉบับ (ไม่ใช่ไลฟ์) ──
  {
    key: 'animehits',
    type: 'mix',
    emoji: '🌸',
    label: 'Anime Hits',
    description: 'Mix Station · original anime songs, non-stop',
    seeds: [
      'YOASOBI Idol official music video',
      'LiSA Gurenge official',
      'Kenshi Yonezu KICK BACK official',
      'King Gnu SPECIALZ official',
      'Aimer Zankyosanka official',
      'Eve Kaikai Kitan official',
      'RADWIMPS Zenzenzense official',
      'Creepy Nuts Bling-Bang-Bang-Born official',
      'Official髭男dism Mixed Nuts',
      'Ado New Genesis official',
    ],
  },
  {
    key: 'kpophits',
    type: 'mix',
    emoji: '💖',
    label: 'K-Pop Hits',
    description: 'Mix Station · original K-pop hits, non-stop',
    seeds: [
      'NewJeans Super Shy official MV',
      'BLACKPINK Pink Venom official MV',
      'IVE LOVE DIVE official MV',
      'aespa Supernova official MV',
      'BTS Dynamite official MV',
      'LE SSERAFIM ANTIFRAGILE official MV',
      'Stray Kids S-Class official MV',
      'TWICE Fancy official MV',
      '(G)I-DLE Queencard official MV',
      'SEVENTEEN Super official MV',
    ],
  },
];

function get(key) {
  return STATIONS.find((station) => station.key === key);
}

module.exports = { STATIONS, get };
