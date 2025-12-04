# ⚡ Quick Deployment Checklist

## What You Have Now
- ✅ **Backend**: NestJS running on `localhost:3008` 
- ✅ **Database**: PostgreSQL on Supabase (already cloud-hosted)
- ✅ **Frontend**: Deployed on Vercel

## What's Running on localhost:3008
**NestJS** is your backend API server. It uses:
- **Prisma** → database connection layer (talks to Supabase)
- **Supabase** → your PostgreSQL database (cloud-hosted)

Think of it as:
```
Frontend (Vercel) → Backend (localhost:3008) → Database (Supabase)
                        ↑
                    Need to deploy this!
```

---

## 🎯 Your Mission: Deploy the Backend

### Option A: Railway (Recommended - 5 minutes)

1. **Push to GitHub**
   ```bash
   git add .
   git commit -m "Ready for deployment"
   git push
   ```

2. **Go to Railway**
   - Visit [railway.app](https://railway.app)
   - Sign up with GitHub
   - Click "New Project" → "Deploy from GitHub"
   - Select your repo

3. **Add Environment Variables**
   Copy these from your local `.env` to Railway:
   - `DATABASE_URL` (from Supabase)
   - `DIRECT_URL` (from Supabase)
   - `NODE_ENV=production`
   - `CORS_ORIGIN=https://your-vercel-app.vercel.app`
   - All your blockchain RPC URLs
   - JWT secrets

4. **Deploy!** 🚀
   Railway gives you a URL like:
   ```
   https://piron-backend-production.up.railway.app
   ```

5. **Update Frontend**
   In your Vercel frontend environment variables:
   ```
   NEXT_PUBLIC_API_URL=https://piron-backend-production.up.railway.app/api/v1
   ```

### Option B: Render (Free tier, but slower)

Same steps as Railway, but at [render.com](https://render.com)

---

## 🧪 Test Your Deployment

```bash
# Replace with your Railway URL
curl https://piron-backend-production.up.railway.app/api/v1/pools
```

---

## 📝 Files I Created for You

1. ✅ `railway.json` - Railway deployment config
2. ✅ `DEPLOYMENT_GUIDE.md` - Complete deployment guide
3. ✅ `DEPLOYMENT_QUICK_START.md` - This file!
4. ✅ Updated `src/main.ts` - Better logging + network access

---

## 🔧 Environment Variables You Need

Essential ones to copy from your `.env` to Railway:

```bash
# Database (get from Supabase dashboard)
DATABASE_URL=postgresql://...
DIRECT_URL=postgresql://...

# App Config
NODE_ENV=production
PORT=3000

# CORS (your Vercel frontend URL)
CORS_ORIGIN=https://your-app.vercel.app

# Blockchain (from your current .env)
BASE_SEPOLIA_RPC=https://sepolia.base.org
BASE_MAINNET_RPC=https://mainnet.base.org
MORPH_TESTNET_RPC=...
MORPH_MAINNET_RPC=...

# Security (generate NEW secrets for production!)
JWT_SECRET=<generate-new-one>
JWT_EXPIRY=15m
JWT_REFRESH_SECRET=<generate-new-one>
JWT_REFRESH_EXPIRY=7d

# Admin
ADMIN_PRIVATE_KEY=...
```

**Generate new JWT secrets:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## 💰 Cost Estimate

| What | Cost |
|------|------|
| Supabase (database) | Free tier (up to 500MB) |
| Railway (backend) | $5 free credit/month, then ~$5-10/month |
| Vercel (frontend) | Free tier (already using) |
| **Total** | **Free to start, ~$5-10/month later** |

---

## 🐛 Common Issues

### "CORS error"
→ Update `CORS_ORIGIN` in Railway to your Vercel URL

### "Database connection failed"
→ Check `DATABASE_URL` is correct in Railway

### "Build failed"
→ Check Railway logs, usually missing env variables

---

## ✨ After Deployment

Your architecture will be:

```
┌─────────────────┐
│ Vercel Frontend │ (your-app.vercel.app)
└────────┬────────┘
         │ HTTPS
         ↓
┌─────────────────┐
│ Railway Backend │ (piron-backend.up.railway.app)
└────────┬────────┘
         │ PostgreSQL
         ↓
┌─────────────────┐
│ Supabase DB     │ (database.supabase.com)
└─────────────────┘
```

All in the cloud! ☁️

---

## 📞 Need Help?

1. Read full guide: `DEPLOYMENT_GUIDE.md`
2. Railway docs: [docs.railway.app](https://docs.railway.app)
3. Railway Discord: Great community support

---

## 🎉 You're Almost There!

The hard work is done. Just:
1. Push to GitHub
2. Deploy on Railway
3. Update frontend URL
4. **Ship it!** 🚀

