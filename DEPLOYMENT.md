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
  npm install; cd server && npm install
  ```

- **Start Command**:
  ```bash
  cd server && npm start
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
```

**⚠️ IMPORTANT:** For production, generate strong secrets:
```bash
# Run this in your terminal to generate random secrets:
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

### 4. Deploy Backend

1. Click **"Create Web Service"**
2. Wait for deployment (5-10 minutes)
3. Once deployed, you'll get a URL like: `https://prometheus-ceo-insight-engine.onrender.com`

---

### 5. Deploy Frontend (Separate Service)

#### Option A: Deploy Frontend on Render (Recommended)

1. Click **"New +"** → **"Static Site"**
2. Select same repository: `Prometheus_V1`
3. Configure:
   - **Name**: `prometheus-frontend`
   - **Branch**: `main`
   - **Build Command**: 
     ```bash
     npm install; npm run build
     ```
   - **Publish Directory**: `build`

4. **Environment Variables** (for frontend):
   ```bash
   # Point to your backend URL
   VITE_API_URL=https://prometheus-ceo-insight-engine.onrender.com
   ```

#### Option B: Deploy Frontend on Vercel (Alternative)

1. Go to https://vercel.com
2. Import `Prometheus_V1` repository
3. Configure:
   - Framework: SvelteKit
   - Build Command: `npm run build`
   - Environment Variable: 
     ```
     VITE_API_URL=https://prometheus-ceo-insight-engine.onrender.com
     ```

---

### 6. Update Frontend API Calls

You need to update your frontend to use environment variables instead of localhost. Let me update the dashboard component:

**In `src/routes/dashboard/+page.svelte`**, replace all instances of:
```javascript
'http://localhost:3001/api/...'
```

With:
```javascript
`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/...`
```

This allows it to work both locally and in production.

---

### 7. Update CORS Settings

Your backend needs to allow requests from your frontend domain. In `server/server.js`, update the CORS configuration:

```javascript
app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://localhost:5174',
    'https://prometheus-frontend.onrender.com',  // Add your frontend URL
    'https://your-custom-domain.com'  // If you have a custom domain
  ],
  credentials: true
}));
```

---

## 🔧 Post-Deployment Configuration

### Update MongoDB Whitelist
1. Go to MongoDB Atlas
2. **Network Access** → **Add IP Address**
3. Add: `0.0.0.0/0` (Allow from anywhere) - for Render's dynamic IPs
   - Or add specific Render IP ranges if available

### Test Your Deployment
1. Visit your backend: `https://prometheus-ceo-insight-engine.onrender.com`
2. Visit your frontend: `https://prometheus-frontend.onrender.com`
3. Test login and assessment flow
4. Check MongoDB for data persistence

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

- [ ] Backend deployed on Render
- [ ] Frontend deployed (Render/Vercel)
- [ ] Environment variables set
- [ ] MongoDB whitelist updated
- [ ] CORS configured correctly
- [ ] JWT secrets changed from defaults
- [ ] Test complete user flow
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
