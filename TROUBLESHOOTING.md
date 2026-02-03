## ⚠️ Backend Deployment Troubleshooting

### Lỗi 500 FUNCTION_INVOCATION_FAILED

**Nguyên nhân có thể:**

1. **Thiếu Environment Variables** ⭐ (Nguyên nhân phổ biến nhất)
2. Dependencies không đầy đủ
3. Code có lỗi runtime
4. vercel.json config sai

---

## 🔧 Các Bước Fix

### Bước 1: Kiểm tra Environment Variables

Vào **Vercel Dashboard** → Project → **Settings** → **Environment Variables**

**Cần có đầy đủ các biến:**

```
NODE_ENV=production
MONGODB_URI=mongodb+srv://thongha:123@cluster0.jko3n8c.mongodb.net/money_management
JWT_SECRET=your-jwt-secret-here
JWT_EXPIRE=7d
GMAIL_CLIENT_ID=751091962066-4019jld5obkujcnk5rk79qao41srtuc3.apps.googleusercontent.com
GMAIL_CLIENT_SECRET=your-google-client-secret
GMAIL_REDIRECT_URI=https://your-backend.vercel.app/api/gmail/callback
ENCRYPTION_KEY=74f9377d42049da429cd6eeb07f431f1
FRONTEND_URL=https://your-frontend.vercel.app
PORT=5000
```

**⚠️ LƯU Ý:**
- Sau khi thêm/sửa env vars, phải **Redeploy** project!
- Click **Deployments** tab → Chọn latest deployment → Click **⋯** → **Redeploy**

---

### Bước 2: Check Logs

1. Vào **Vercel Dashboard** → Project → **Deployments**
2. Click vào deployment mới nhất
3. Xem **Function Logs** để tìm lỗi cụ thể
4. Thường sẽ thấy lỗi như:
   - `MongooseError: URI malformed` → MongoDB URI sai
   - `Error: GMAIL_CLIENT_ID is required` → Thiếu env vars
   - `Cannot connect to MongoDB` → MongoDB whitelist IP chưa có 0.0.0.0/0

---

### Bước 3: Update vercel.json

File `vercel.json` mới đã được cập nhật (bỏ `env` section trong vercel.json, dùng Vercel Dashboard để add env vars thay vì).

Push code mới:
```bash
cd backend
git add .
git commit -m "Fix vercel.json config"
git push origin main
```

Vercel sẽ tự động redeploy.

---

### Bước 4: MongoDB Atlas Whitelist

1. Vào **MongoDB Atlas** → Cluster → **Network Access**
2. Click **Add IP Address**
3. Chọn **Allow Access from Anywhere** → `0.0.0.0/0`
4. Save

---

### Bước 5: Test Backend Health

Sau khi deploy xong, test endpoint:
```
https://your-backend.vercel.app/health
```

Nếu thấy response `{"success": true}` → Backend đã chạy!

---

## 📊 Check Deployment Status

### ✅ Deployment Successful Indicators:
- Status: **Ready** (màu xanh)
- Logs không có error
- Health endpoint trả về 200 OK

### ❌ Deployment Failed Indicators:
- Status: **Error** (màu đỏ)
- Logs có error messages
- Endpoints trả về 500

---

## 🔍 Debug Commands

### Check logs realtime:
```bash
npx vercel logs your-backend.vercel.app --follow
```

### Test locally trước khi deploy:
```bash
cd backend
npm install
npm start
# Test: http://localhost:5000/health
```

---

## 💡 Common Issues

### Issue 1: MongoDB Connection Failed
**Fix:** Whitelist 0.0.0.0/0 trong MongoDB Atlas Network Access

### Issue 2: Missing Environment Variables
**Fix:** Add tất cả env vars trong Vercel Dashboard, sau đó Redeploy

### Issue 3: crypto module error
**Fix:** `crypto` là built-in Node.js module, xóa `"crypto": "^1.0.1"` khỏi package.json dependencies

### Issue 4: Function timeout
**Fix:** Vercel free tier có limit 10s, check code có blocking operations không

---

## ✨ Sau khi fix xong:

1. **Health check:** `https://your-backend.vercel.app/health`
2. **Test API:** `https://your-backend.vercel.app/api/auth/register`
3. Update `FRONTEND_URL` với frontend deployment URL
4. Update Google OAuth redirect URI với backend URL
5. Test frontend connect với backend

Done! 🎉
