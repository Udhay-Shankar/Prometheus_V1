# 🔄 Update Your Render Deployment

## Your backend is already deployed. Now update it to serve the frontend too!

### Step 1: Go to Render Dashboard
- Visit: https://dashboard.render.com
- Click on your `prometheus-v1` service

### Step 2: Update Build Command
1. Click **"Settings"** (left sidebar)
2. Scroll to **"Build & Deploy"** section
3. Click **"Edit"** next to "Build Command"
4. **Replace with**:
   ```bash
   npm install && npm run build && cd server && npm install
   ```
5. Click **"Save Changes"**

### Step 3: Update Start Command
1. Still in **"Build & Deploy"** section
2. Click **"Edit"** next to "Start Command"
3. **Replace with**:
   ```bash
   cd server && NODE_ENV=production npm start
   ```
4. Click **"Save Changes"**

### Step 4: Add Environment Variable
1. Click **"Environment"** (left sidebar)
2. Click **"Add Environment Variable"**
3. **Key**: `NODE_ENV`
4. **Value**: `production`
5. Click **"Save Changes"**

### Step 5: Manual Deploy (Trigger Rebuild)
1. Click **"Manual Deploy"** (top right)
2. Select **"Deploy latest commit"**
3. Click **"Deploy"**

### Step 6: Wait for Deployment
- Watch the **Logs** tab
- You should see:
  ```
  Installing dependencies...
  Building frontend...
  Installing server dependencies...
  Starting server...
  🚀 Server running on http://localhost:10000
  ✅ Serving frontend from /build directory
  ```

### Step 7: Test Your App! 🎉
- Visit: https://prometheus-v1.onrender.com
- You should see your beautiful landing page
- Try signing up and completing an assessment
- Everything works from ONE URL!

---

## 🎯 What Changed?

**Before:**
- Backend only (JSON API responses)
- "Cannot GET /" error when visiting root

**After:**
- ✅ Backend API at `/api/*` endpoints
- ✅ Frontend UI at `/` (landing page)
- ✅ Everything from one URL
- ✅ SvelteKit routing works perfectly

---

## 🚨 Troubleshooting

### Build fails?
- Check Render logs
- Make sure `npm run build` script exists in root `package.json`

### Site shows "Cannot GET /"?
- Verify `NODE_ENV=production` is set in Environment variables
- Check that Start Command includes `NODE_ENV=production`

### API calls fail?
- Frontend uses relative URLs in production (no CORS issues)
- Check MongoDB connection in logs

---

## ✅ Success Indicators

When deployment works, you'll see:
1. ✅ Landing page loads at https://prometheus-v1.onrender.com
2. ✅ Can sign up and login
3. ✅ Assessment flow works
4. ✅ Valuation displays correctly
5. ✅ Chatbot responds
6. ✅ No CORS errors in browser console

---

**You're almost there! Update those settings and your app will be fully live!** 🚀
