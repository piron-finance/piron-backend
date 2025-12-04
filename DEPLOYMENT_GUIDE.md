# 🚀 Deployment Guide - Piron Backend

## Current Setup

- **Backend**: NestJS (currently localhost:3008)
- **Database**: PostgreSQL on Supabase ✅ (already cloud-hosted)
- **Frontend**: Vercel ✅ (already deployed)

## Goal

Deploy the NestJS backend to Railway so your Vercel frontend can connect to it.

---

## 📦 Option 1: Railway (Recommended - Easiest)

### Why Railway?

- ✅ Free tier available
- ✅ Auto-deploys from GitHub
- ✅ Built-in environment variables
- ✅ Zero configuration needed
- ✅ Great for NestJS/Node.js apps

### Steps:

#### 1. Push Code to GitHub (if not already done)

```bash
# Initialize git (if needed)
git init

# Add all files
git add .

# Commit
git commit -m "Prepare for deployment"

# Create GitHub repo and push
# (Create a new repo on github.com first)
git remote add origin https://github.com/YOUR_USERNAME/piron-backend.git
git branch -M main
git push -u origin main
```

#### 2. Deploy to Railway

1. Go to [railway.app](https://railway.app)
2. Sign up with GitHub
3. Click **"New Project"**
4. Select **"Deploy from GitHub repo"**
5. Select your `piron-backend` repository
6. Railway will auto-detect NestJS and start building

#### 3. Add Environment Variables

In Railway dashboard:

1. Go to your project → **Variables** tab
2. Add these variables:

```bash
# Required
DATABASE_URL=your_supabase_pooling_connection_string
DIRECT_URL=your_supabase_direct_connection_string
NODE_ENV=production
PORT=3000

# CORS - Update with your Vercel frontend URL
CORS_ORIGIN=https://your-app.vercel.app

# Blockchain RPC URLs (from your .env)
BASE_SEPOLIA_RPC=https://sepolia.base.org
BASE_MAINNET_RPC=https://mainnet.base.org
MORPH_TESTNET_RPC=your_morph_testnet_rpc
MORPH_MAINNET_RPC=your_morph_mainnet_rpc

# Admin Wallet (from your .env)
ADMIN_PRIVATE_KEY=your_admin_private_key

# JWT Secrets (generate new ones for production!)
JWT_SECRET=your_production_jwt_secret
JWT_EXPIRY=15m
JWT_REFRESH_SECRET=your_production_refresh_secret
JWT_REFRESH_EXPIRY=7d
```

#### 4. Deploy!

Railway will automatically:

- Install dependencies
- Run `npm run build`
- Run `npx prisma generate`
- Start the server with `npm run start:prod`

#### 5. Get Your Backend URL

After deployment, Railway gives you a URL like:

```
https://piron-backend-production.up.railway.app
```

#### 6. Update Your Frontend

In your Vercel frontend, update the API base URL:

```typescript
// Before (local)
const API_BASE_URL = 'http://localhost:3008/api/v1';

// After (production)
const API_BASE_URL = 'https://piron-backend-production.up.railway.app/api/v1';
```

Or use environment variables in Vercel:

```bash
NEXT_PUBLIC_API_URL=https://piron-backend-production.up.railway.app/api/v1
```

---

## 📦 Option 2: Render

### Steps:

1. Go to [render.com](https://render.com)
2. Sign up and click **"New +"** → **"Web Service"**
3. Connect your GitHub repository
4. Configure:
   - **Name**: piron-backend
   - **Runtime**: Node
   - **Build Command**: `npm install && npm run build && npx prisma generate`
   - **Start Command**: `npm run start:prod`
   - **Instance Type**: Free tier available
5. Add environment variables (same as Railway list above)
6. Deploy!

**Free Tier Limitations**: Spins down after 15 minutes of inactivity (cold starts)

---

## 📦 Option 3: DigitalOcean App Platform

More traditional cloud hosting, $5/month minimum.

1. Go to [digitalocean.com/products/app-platform](https://www.digitalocean.com/products/app-platform)
2. Create account
3. Click **"Create App"**
4. Select GitHub repository
5. DigitalOcean auto-detects Node.js
6. Add environment variables
7. Deploy

**Cost**: Starts at $5/month

---

## 🔐 Important Security Notes

### 1. Generate New JWT Secrets for Production

```bash
# Generate random secrets
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Use these for `JWT_SECRET` and `JWT_REFRESH_SECRET` in production.

### 2. Update CORS Origin

Make sure `CORS_ORIGIN` points to your actual Vercel frontend URL:

```bash
CORS_ORIGIN=https://your-app.vercel.app
```

Or allow multiple origins in `src/main.ts`:

```typescript
app.enableCors({
  origin: [
    'https://your-app.vercel.app',
    'https://your-app-staging.vercel.app',
    process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : '',
  ].filter(Boolean),
  credentials: true,
});
```

### 3. Keep Your .env File Secret

**Never commit `.env` to git!** ✅ Already in your `.gitignore`

---

## 🧪 Testing Your Deployment

After deployment, test your endpoints:

```bash
# Replace with your Railway URL
export API_URL=https://piron-backend-production.up.railway.app

# Test public endpoints
curl $API_URL/api/v1/platform/metrics
curl $API_URL/api/v1/pools
curl $API_URL/api/v1/pools/featured
```

---

## 🔄 Continuous Deployment

Railway (and Render) automatically redeploy when you push to GitHub:

```bash
git add .
git commit -m "Update feature"
git push
# Railway automatically deploys! 🚀
```

---

## 📊 Monitoring

### Railway Dashboard

- View logs in real-time
- Monitor CPU/Memory usage
- Set up alerts

### Add Health Check Endpoint

Add to `src/main.ts` or create a health controller:

```typescript
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
```

---

## 💰 Cost Estimate

| Service                 | Free Tier            | Paid Tier                    |
| ----------------------- | -------------------- | ---------------------------- |
| **Railway**             | $5 free credit/month | Pay per usage (~$5-20/month) |
| **Render**              | 750 hours free       | $7/month (no sleep)          |
| **DigitalOcean**        | No free tier         | $5/month minimum             |
| **Supabase** (database) | Free up to 500MB     | $25/month Pro                |

**Recommended for starting**: Railway (free tier + your existing Supabase free tier)

---

## 🐛 Troubleshooting

### Build Fails

Check Railway logs. Common issues:

- Missing environment variables
- Prisma schema errors
- TypeScript compilation errors

### Database Connection Fails

- Verify `DATABASE_URL` is correct
- Check Supabase is allowing connections (it should)
- Ensure `DIRECT_URL` is set

### CORS Errors

Update `CORS_ORIGIN` in Railway to match your Vercel URL.

---

## 🎉 Summary

1. ✅ Database already on Supabase (cloud)
2. ✅ Frontend already on Vercel
3. 🚀 Deploy backend to Railway (or Render)
4. 🔄 Update frontend to use new backend URL
5. 🎊 You're live!

**Next Steps After Deployment:**

- Set up monitoring
- Configure backup strategy
- Add rate limiting
- Implement logging (Sentry, LogRocket)
- Set up staging environment

---

## 📞 Need Help?

- Railway: [docs.railway.app](https://docs.railway.app)
- Render: [render.com/docs](https://render.com/docs)
- Join Railway Discord for support
