# 🚀 Deploying CEO Insight Engine to Render

## Prerequisites
- GitHub repository: https://github.com/Udhay-Shankar/Prometheus_V1
- Render account: https://render.com (sign up with GitHub)
- MongoDB Atlas database (already set up)

---

## 📋 Deployment Steps

### 1. Create Web Service on Render

1. **Go to Render Dashboard**: https://dashboard.render.com
2. Click **"New +"** → **"Web Service"**
3. **Connect Repository**: 
   - Connect your GitHub account
   - Select `Udhay-Shankar/Prometheus_V1`
   - Click **"Connect"**

---

### 2. Configure Web Service Settings

#### **Basic Settings:**
- **Name**: `prometheus-ceo-insight-engine` (or any name you prefer)
- **Region**: Choose closest to your users (e.g., Singapore for Asia)
- **Branch**: `main`
- **Root Directory**: Leave empty (uses repository root)

#### **Build & Deploy:**
- **Runtime**: `Node`
- **Build Command**: 
  ```bash
  npm install && npm run build && cd server && npm install
  ```

- **Start Command**:
  ```bash
  cd server && NODE_ENV=production npm start
  ```

#### **Plan:**
- Select **Free** tier (for testing) or **Starter** ($7/month for production)

---

### 3. Set Environment Variables

Click **"Advanced"** → **"Add Environment Variable"** and add these:

```bash
# MongoDB Connection (use your actual MongoDB URI)
MONGO_URI=your_mongodb_connection_string_here

# API Keys (use your actual API keys)
GROK_API_KEY=your_grok_api_key_here
GEMINI_API_KEY=your_gemini_api_key_here

# JWT Secrets (Generate new ones for production!)
JWT_SECRET=your-production-jwt-secret-change-this
JWT_REFRESH_SECRET=your-production-jwt-refresh-secret-change-this

# Server Port (Render sets this automatically)
PORT=3001

# Node Environment (IMPORTANT!)
NODE_ENV=production
```

**⚠️ IMPORTANT:** For production, generate strong secrets:
```bash
# Run this in your terminal to generate random secrets:
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

### 4. Deploy Full Application

1. Click **"Create Web Service"**
2. Wait for deployment (5-10 minutes)
3. Once deployed, you'll get a URL like: `https://prometheus-v1.onrender.com`
4. **Test it**: 
   - Visit your URL - you should see your beautiful landing page! 🎉
   - The backend API is also accessible at `/api/*` endpoints
   - Everything runs from ONE service!

**Note:** Render automatically redeploys when you push to GitHub!

---

## 🎯 How It Works

Your single Web Service now:
- ✅ **Builds the frontend** during deployment (`npm run build`)
- ✅ **Runs the backend** Express server
- ✅ **Serves the frontend** from the `/build` directory
- ✅ **Handles API calls** at `/api/*` endpoints
- ✅ **Routes everything else** to the SvelteKit app

All from **ONE URL**: https://prometheus-v1.onrender.com

---

## ❌ Skip These Sections (Not Needed Anymore)

~~### 5. Deploy Frontend (Separate Service)~~ - **NOT NEEDED**  
~~### 6. Update Frontend API Calls~~ - **ALREADY DONE**  
~~### 7. Update CORS Settings~~ - **ALREADY CONFIGURED**

---

## 🔧 Post-Deployment Configuration

### Update MongoDB Whitelist
1. Go to MongoDB Atlas
2. **Network Access** → **Add IP Address**
3. Add: `0.0.0.0/0` (Allow from anywhere) - for Render's dynamic IPs
   - Or add specific Render IP ranges if available

### Test Your Deployment
1. Visit your URL: `https://prometheus-v1.onrender.com`
2. You should see the landing page with the royal theme
3. Click "Get Started" and create an account
4. Complete the assessment
5. Test valuation, SWOT analysis, competitors, and chatbot
6. Check MongoDB Atlas to verify data is being saved

---

## 📊 Monitoring & Logs

### View Logs on Render:
1. Go to your service dashboard
2. Click **"Logs"** tab
3. Monitor for errors

### Common Issues:
- **Build fails**: Check `package.json` scripts
- **App crashes**: Check environment variables
- **CORS errors**: Update CORS origins
- **Database connection fails**: Check MongoDB whitelist

---

## 🎯 Production Checklist

- [ ] Web Service deployed on Render
- [ ] Environment variables set (including NODE_ENV=production)
- [ ] MongoDB whitelist updated (0.0.0.0/0)
- [ ] CORS configured correctly
- [ ] JWT secrets changed from defaults
- [ ] Test complete user flow (signup → assessment → results)
- [ ] Chatbot working with Gemini API
- [ ] Monitor logs for errors
- [ ] Set up custom domain (optional)

---

## 💰 Pricing

### Render Free Tier:
- ✅ Good for testing
- ⚠️ Spins down after 15 minutes of inactivity
- ⚠️ First request takes ~30 seconds to wake up

### Render Starter ($7/month):
- ✅ Always running
- ✅ Faster performance
- ✅ Better for production

### Vercel Free Tier:
- ✅ Great for frontend
- ✅ Fast CDN
- ✅ Automatic deployments

---

## 🔗 Useful Links

- Render Dashboard: https://dashboard.render.com
- Render Docs: https://render.com/docs
- MongoDB Atlas: https://cloud.mongodb.com
- Your Repository: https://github.com/Udhay-Shankar/Prometheus_V1

---

## 🆘 Need Help?

If deployment fails, check:
1. Render build logs
2. Environment variables are set correctly
3. MongoDB is accessible
4. All dependencies are in package.json

Good luck with your deployment! 🚀
