# 🎮 Discord Quiz Bot

บอท Quiz สำหรับ Discord แบบกดปุ่มแย่งตอบ

## ✅ Features
- Admin พิมพ์คำถามผ่าน `/question`
- ห้องล็อคอัตโนมัติ ไม่ให้ใครพิมพ์
- ปุ่ม **"🙋 ตอบ!"** — ใครกดทันได้สิทธิ์พิมพ์คนเดียว
- Admin กด **✅ ถูก** หรือ **❌ ผิด**
- ถ้าผิด → ล็อคใหม่ ให้คนอื่นแย่งตอบ
- ถ้าถูก → ประกาศผู้ชนะ ห้องเปิดปกติ
- `/endquiz` จบ Quiz ได้ตลอดเวลา

---

## 🚀 วิธีติดตั้ง

### 1. สร้าง Discord Bot
1. ไปที่ https://discord.com/developers/applications
2. กด **New Application** → ตั้งชื่อ
3. ไปที่แท็บ **Bot** → กด **Add Bot**
4. คัดลอก **Token** ไว้
5. ไปที่แท็บ **OAuth2 → General** → คัดลอก **Client ID**

### 2. เปิด Privileged Intents
ในแท็บ **Bot** เปิด:
- ✅ Server Members Intent
- ✅ Message Content Intent

### 3. Invite Bot เข้า Server
ไปที่ **OAuth2 → URL Generator**:
- Scopes: `bot`, `applications.commands`
- Bot Permissions:
  - `Send Messages`
  - `Manage Channels` (สำหรับล็อค/เปิดห้อง)
  - `Read Message History`
  - `View Channels`

คัดลอก URL แล้วเปิดในเบราว์เซอร์

### 4. ติดตั้งและรัน
```bash
# Clone หรือ copy ไฟล์ทั้งหมดมา
npm install

# สร้างไฟล์ .env
cp .env.example .env
# แล้วใส่ค่า DISCORD_TOKEN และ CLIENT_ID

# รัน bot
npm start
```

---

## 📋 วิธีใช้งาน

### ตั้งค่าห้อง Quiz
1. สร้างห้อง text channel ในดิส (เช่น `#quiz`)
2. ห้องนี้ไม่ต้องตั้งอะไรพิเศษ บอทจะจัดการ permission เอง

### เริ่ม Quiz
```
/question text:อะไรคือเมืองหลวงของประเทศไทย?
```

### Admin Commands
| Command | คำอธิบาย |
|---------|----------|
| `/question text:...` | โพสต์คำถามใหม่ |
| `/endquiz` | จบ Quiz ทันที |

### ปุ่มใน Quiz
| ปุ่ม | ใครกดได้ | ผล |
|------|----------|-----|
| 🙋 ตอบ! | ทุกคน | ห้องเปิดให้คนที่กดพิมพ์ได้ |
| ✅ ถูก! | Admin | ประกาศผู้ชนะ จบ Quiz |
| ❌ ผิด | Admin | ล็อคห้อง ให้คนอื่นแย่งกด |

---

## ⚙️ Requirements
- Node.js 18+
- discord.js v14
