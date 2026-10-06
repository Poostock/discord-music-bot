// Error ที่ "ตั้งใจ" ให้ผู้ใช้เห็นข้อความ เช่น "กรุณาเข้า Voice Channel ก่อน"
// แยกจาก Error ทั่วไป (บั๊กในโค้ด) ที่ควรแสดงแค่ใน Terminal
class UserError extends Error {}

module.exports = UserError;
