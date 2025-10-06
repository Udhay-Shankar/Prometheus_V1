# 🚀 Quick Start Guide

## Current Status: ✅ RUNNING

Both servers are currently active and ready to use:

- **Frontend (SvelteKit)**: http://localhost:5173
- **Backend (Express API)**: http://localhost:3001
- **Database**: MongoDB Atlas (Connected ✅)

## Immediate Next Steps

### 1. Open the Application

Click here or paste in browser: **http://localhost:5173**

You should see the premium royal-themed landing page.

### 2. Create Your Account

1. Click **"Login / Sign Up"** button (top right or hero section)
2. You'll be on the authentication page
3. Fill in the sign-up form:
   - Full Name: (e.g., "Priya Sharma")
   - Company Name: (e.g., "TechVentures India")
   - Email: (e.g., "priya@techventures.com")
   - Password: (at least 6 characters)
4. Click **"Create Account"**

### 3. Complete the Due Diligence Questionnaire

Once logged in:
1. You'll land on the **Dashboard Overview**
2. Click **"Begin Due Diligence Questionnaire"**
3. A full-screen modal will appear
4. Answer all **20 questions** about your startup:
   - Select from scale options (1-5)
   - Or enter numbers for financial questions
   - Progress bar shows your completion status
5. After the last question, your analysis will begin automatically

### 4. View Your Results

The system will generate:

**✅ Valuation Analysis**
- Navigate to **"Valuation"** tab in sidebar
- See your company's value in INR and USD
- View methodology breakdown (Berkus + Scorecard)

**✅ SWOT Analysis**
- Navigate to **"SWOT Analysis"** tab
- AI-generated strategic insights
- Strengths, Weaknesses, Opportunities, Threats

**✅ Funding Schemes**
- Navigate to **"Funding Schemes"** tab
- Personalized government program recommendations
- Central and State funding options

## If Servers Stop Running

### Restart Frontend
```powershell
cd "C:\Users\udhay\OneDrive\Desktop\AI Cofounder  Grok\ceo-insight-engine"
npm run dev
```

### Restart Backend
```powershell
cd "C:\Users\udhay\OneDrive\Desktop\AI Cofounder  Grok\ceo-insight-engine\server"
node server.js
```

## Testing Different Scenarios

### Scenario 1: High-Potential Startup
Answer DDQ with high scores (4-5) for:
- Team experience
- Product development stage
- Market size
- Competitive advantage

**Expected Result**: Valuation ₹8-12 Cr

### Scenario 2: Early-Stage Startup
Answer DDQ with moderate scores (2-3) for most questions

**Expected Result**: Valuation ₹3-6 Cr

### Scenario 3: Pre-Revenue Startup
- Low revenue (₹0 or minimal)
- High team and product scores
- Strong market opportunity

**Expected Result**: Focus on Berkus method, valuation ₹2-4 Cr

## Troubleshooting

### Issue: "Cannot connect to server"
**Solution**: 
```powershell
cd "C:\Users\udhay\OneDrive\Desktop\AI Cofounder  Grok\ceo-insight-engine\server"
node server.js
```

### Issue: "MongoDB connection failed"
**Solution**: 
- Check internet connection
- Credentials are already in `server/.env`
- MongoDB Atlas should auto-connect

### Issue: "Authentication failed"
**Solution**:
- Make sure backend is running on port 3001
- Check browser console for CORS errors
- Try signing up with a new email

### Issue: Frontend won't load
**Solution**:
```powershell
cd "C:\Users\udhay\OneDrive\Desktop\AI Cofounder  Grok\ceo-insight-engine"
npm run dev -- --open
```

## Key Features to Explore

### 🎨 Premium UI/UX
- Notice the royal purple and gold color scheme
- Smooth animations on hover
- Glassmorphism effects on cards
- Responsive design (try resizing browser)

### 🔐 Security
- JWT token authentication
- Encrypted password storage
- Secure API gateway
- Protected routes

### 💎 Valuation Engine
- Hybrid methodology (Berkus + Scorecard)
- Tailored for Indian startup ecosystem
- Real-time calculations
- Dual currency display (INR/USD)

### 🤖 AI Integration
- Grok API for market intelligence
- SWOT analysis generation
- Funding scheme recommendations
- Strategic insights

## Browser DevTools Tips

### Check API Calls
1. Open DevTools (F12)
2. Go to **Network** tab
3. Interact with the app
4. See all API requests/responses

### Check Console
1. Open DevTools (F12)
2. Go to **Console** tab
3. See any errors or logs

### Check Local Storage
1. Open DevTools (F12)
2. Go to **Application** tab
3. Expand **Local Storage**
4. See stored tokens and user data

## Demo Account

If you want to skip signup, you can use API directly:

```javascript
// In browser console at http://localhost:5173
const response = await fetch('http://localhost:3001/api/auth/signup', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'demo@ceoinsight.com',
    password: 'demo123',
    name: 'Demo CEO',
    companyName: 'Demo Ventures'
  })
});
const data = await response.json();
console.log(data);
```

## What's Next?

After exploring the current features, potential enhancements include:

- 📊 Interactive charts for valuation breakdown
- 💬 AI chatbot for "what-if" scenarios
- 📄 Export reports to PDF
- 📧 Email notifications
- 🔄 Save multiple companies
- 📈 Track valuation changes over time

## Support

Check these files for more information:

- **README.md** - Full project documentation
- **PROJECT_SUMMARY.md** - Complete feature list
- **API_TESTING.md** - API testing guide

## Enjoy! 🎉

The CEO Insight Engine is ready to transform your startup's potential into quantifiable value!

---

**Current Status**:
- ✅ Frontend Running
- ✅ Backend Running  
- ✅ Database Connected
- ✅ Ready to Use

**Access**: http://localhost:5173
