// ไฟล์ตั้งค่า pm2 (ตัวจัดการโปรเซสที่ให้บอทรันเบื้องหลังและเปิดใหม่เองเมื่อล่ม)
// เริ่มใช้งาน: pm2 start ecosystem.config.js
module.exports = {
  apps: [
    {
      name: 'music-bot',
      script: 'src/index.js',
      cwd: __dirname, // ให้หา .env และ bin/ เจอเสมอ ไม่ว่าจะสั่ง pm2 จากโฟลเดอร์ไหน
      node_args: '--env-file=.env',
      autorestart: true,
      // ล่มติดกันหลายครั้ง: รอนานขึ้นเรื่อย ๆ ก่อนเปิดใหม่ (กันเปิด-ล่มรัว ๆ เช่นตอนเน็ตหลุด)
      exp_backoff_restart_delay: 1000,
      time: true, // ใส่เวลาหน้าทุกบรรทัดใน log
    },
  ],
};
