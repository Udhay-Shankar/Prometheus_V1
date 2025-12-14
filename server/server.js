import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { MongoClient, ObjectId } from 'mongodb';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env file from the server directory
dotenv.config({ path: path.join(__dirname, '.env') });

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: [
    'http://localhost:5173', 
    'http://localhost:5174', 
    'http://localhost:5175', 
    'http://localhost:5176',
    'https://prometheus-v1.onrender.com',
    'https://prometheus-frontend.onrender.com',
    /\.vercel\.app$/  // Allow any Vercel deployment
  ],
  credentials: true
}));
app.use(express.json());

// Serve static frontend files in production (BEFORE API routes!)
if (process.env.NODE_ENV === 'production') {
  console.log('🔧 Production mode: Setting up static file serving');
  app.use(express.static(path.join(__dirname, '../build'), {
    index: false  // Don't auto-serve index.html, we'll handle routing manually
  }));
}

// Health check endpoint at /api/health instead of root
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    message: '🚀 Prometheus CEO Insight Engine API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    endpoints: {
      auth: ['/api/auth/signup', '/api/auth/login', '/api/auth/refresh'],
      assessment: ['/api/ddq/submit', '/api/ddq/latest'],
      analysis: ['/api/analysis/swot', '/api/analysis/funding', '/api/analysis/competitors'],
      chat: ['/api/chat/grok']
    }
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// MongoDB Connection
const MONGO_URI = process.env.MONGO_URI || 'your_mongodb_uri_here';
const GROK_API_KEY = process.env.GROK_API_KEY || 'your_grok_api_key_here';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'your-refresh-secret-key-change-in-production';

// Debug: Check if MONGO_URI is loaded properly
console.log('🔍 Environment check:');
let mongoStatus = '❌ Not found';
if (MONGO_URI) {
  mongoStatus = MONGO_URI.startsWith('mongodb') ? '✅ Valid' : '❌ Invalid format';
}
console.log('  - MONGO_URI loaded:', mongoStatus);
console.log('  - PORT:', process.env.PORT || 3001);

let db;
let usersCollection;
let ddqCollection;
let notesCollection;
let actionsCollection;

// Connect to MongoDB
async function connectDB() {
  try {
    const client = new MongoClient(MONGO_URI);
    await client.connect();
    db = client.db('ceo-insight-engine');
    usersCollection = db.collection('users');
    ddqCollection = db.collection('ddq-responses');
    notesCollection = db.collection('saved-notes');
    actionsCollection = db.collection('daily-actions');
    
    // Create unique index on email field to prevent duplicate signups
    await usersCollection.createIndex({ email: 1 }, { unique: true });
    
    // Create index on userId for notes for faster queries
    await notesCollection.createIndex({ userId: 1 });
    
    // Create index on userId for actions
    await actionsCollection.createIndex({ userId: 1 });
    
    console.log('✅ Connected to MongoDB Atlas');
    console.log('✅ Email uniqueness index created');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
}

// ============================================
// RATE LIMITING FOR GEMINI API
// ============================================

// Simple in-memory rate limiter for Gemini API calls
const geminiRateLimiter = {
  requests: new Map(), // userId -> { count, resetTime }
  maxRequests: 20, // Max requests per user per window
  windowMs: 60 * 60 * 1000, // 1 hour window

  checkLimit(userId) {
    const now = Date.now();
    const userLimit = this.requests.get(userId);

    // Reset if window expired
    if (!userLimit || now > userLimit.resetTime) {
      this.requests.set(userId, {
        count: 1,
        resetTime: now + this.windowMs
      });
      return { allowed: true, remaining: this.maxRequests - 1 };
    }

    // Check if limit exceeded
    if (userLimit.count >= this.maxRequests) {
      const resetIn = Math.ceil((userLimit.resetTime - now) / 1000 / 60); // minutes
      return { 
        allowed: false, 
        remaining: 0,
        resetIn 
      };
    }

    // Increment count
    userLimit.count++;
    this.requests.set(userId, userLimit);
    
    return { 
      allowed: true, 
      remaining: this.maxRequests - userLimit.count 
    };
  },

  // Clean up expired entries periodically
  cleanup() {
    const now = Date.now();
    for (const [userId, limit] of this.requests.entries()) {
      if (now > limit.resetTime) {
        this.requests.delete(userId);
      }
    }
  }
};

// Cleanup every 10 minutes
setInterval(() => geminiRateLimiter.cleanup(), 10 * 60 * 1000);

// Middleware to verify JWT
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    console.log('❌ No token provided');
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      console.log('❌ Token verification failed:', err.message);
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    console.log('✅ Token verified for user:', user.userId);
    req.user = user;
    next();
  });
}

// Helper function to call Gemini API as backup
async function callGemini(prompt, systemContext = '') {
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: systemContext ? `${systemContext}\n\n${prompt}` : prompt
          }]
        }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 2048
        }
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('❌ Gemini API Error:', response.status, errorData);
      throw new Error(`Gemini API error: ${response.status} - ${JSON.stringify(errorData)}`);
    }

    const data = await response.json();
    if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
      console.error('❌ Invalid Gemini response structure:', JSON.stringify(data));
      throw new Error('Invalid Gemini API response structure');
    }
    return data.candidates[0].content.parts[0].text;
  } catch (error) {
    console.error('Gemini API error:', error);
    throw error;
  }
}

// Helper function to call Gemini with Google Search grounding for real-time data
async function callGeminiWithSearch(prompt, systemContext = '') {
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: systemContext ? `${systemContext}\n\n${prompt}` : prompt
          }]
        }],
        tools: [{
          googleSearch: {}
        }],
        generationConfig: {
          temperature: 0.3, // Lower temperature for more accurate factual data
          maxOutputTokens: 4096
        }
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('❌ Gemini Search API Error:', response.status, errorData);
      throw new Error(`Gemini Search API error: ${response.status}`);
    }

    const data = await response.json();
    if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
      throw new Error('Invalid Gemini Search API response');
    }
    return data.candidates[0].content.parts[0].text;
  } catch (error) {
    console.error('Gemini Search API error:', error);
    throw error;
  }
}

// Auth Routes
app.post('/api/auth/signup', async (req, res) => {
  try {
    const { email, password, name, companyName, socials } = req.body;

    // Validate required fields
    if (!email || !password || !name || !companyName) {
      return res.status(400).json({ error: 'Email, password, name, and company name are required' });
    }

    // Check if user exists
    const existingUser = await usersCollection.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ error: 'Account already exists with this email' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user with optional socials (default to empty strings if not provided)
    const user = {
      email,
      password: hashedPassword,
      name,
      companyName,
      socials: {
        linkedIn: socials?.linkedIn || '',
        website: socials?.website || '',
        instagram: socials?.instagram || '',
        other: socials?.other || ''
      },
      createdAt: new Date(),
      role: 'founder'
    };

    const result = await usersCollection.insertOne(user);

    // Generate tokens
    const accessToken = jwt.sign(
      { userId: result.insertedId, email },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    const refreshToken = jwt.sign(
      { userId: result.insertedId, email },
      JWT_REFRESH_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      accessToken,
      refreshToken,
      user: { id: result.insertedId, email, name, companyName, socials: user.socials }
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user
    const user = await usersCollection.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Verify password
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate tokens
    const accessToken = jwt.sign(
      { userId: user._id, email: user.email },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    const refreshToken = jwt.sign(
      { userId: user._id, email: user.email },
      JWT_REFRESH_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      accessToken,
      refreshToken,
      user: { id: user._id, email: user.email, name: user.name, companyName: user.companyName }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/auth/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(401).json({ error: 'Refresh token required' });
    }

    jwt.verify(refreshToken, JWT_REFRESH_SECRET, (err, user) => {
      if (err) {
        return res.status(403).json({ error: 'Invalid refresh token' });
      }

      const accessToken = jwt.sign(
        { userId: user.userId, email: user.email },
        JWT_SECRET,
        { expiresIn: '1h' }
      );

      res.json({ accessToken });
    });
  } catch (error) {
    console.error('Refresh token error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Token validation endpoint - check if current token is valid
app.get('/api/auth/validate', authenticateToken, async (req, res) => {
  try {
    // If authenticateToken middleware passes, token is valid
    res.json({ 
      valid: true, 
      user: { 
        userId: req.user.userId, 
        email: req.user.email 
      } 
    });
  } catch (error) {
    console.error('Token validation error:', error);
    res.status(401).json({ valid: false, error: 'Invalid token' });
  }
});

// DDQ Routes
app.post('/api/ddq/save', authenticateToken, async (req, res) => {
  try {
    const ddqData = {
      userId: req.user.userId,
      responses: req.body.responses,
      scores: req.body.scores,
      createdAt: new Date(),
      status: 'completed'
    };

    const result = await ddqCollection.insertOne(ddqData);
    res.json({ success: true, ddqId: result.insertedId });
  } catch (error) {
    console.error('DDQ save error:', error);
    res.status(500).json({ error: 'Failed to save DDQ responses' });
  }
});

app.get('/api/ddq/latest', authenticateToken, async (req, res) => {
  try {
    console.log('Fetching latest DDQ for user:', req.user.userId);
    
    const ddqArray = await ddqCollection
      .find({ userId: req.user.userId })
      .sort({ createdAt: -1 })
      .limit(1)
      .toArray();
    
    const latestDDQ = ddqArray[0] || null;
    
    console.log('Latest DDQ found:', latestDDQ ? 'Yes' : 'No');

    res.json(latestDDQ);
  } catch (error) {
    console.error('DDQ fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch DDQ' });
  }
});

// Valuation Routes
app.post('/api/valuation/calculate', authenticateToken, async (req, res) => {
  try {
    const { scores, companyStage, revenue, category, totalInvestment, monthlyExpenses } = req.body;

    // Industry-specific revenue multiples (AGGRESSIVE UPDATE for 90% accuracy target)
    const industryMultiples = {
      'SaaS': { min: 10, max: 25, avg: 15 }, // Much higher multiples
      'Mobile App': { min: 4, max: 8, avg: 6 },
      'E-commerce': { min: 4, max: 12, avg: 8 }, // Increased significantly
      'Marketplace': { min: 5, max: 15, avg: 10 }, // Increased significantly
      'AI/ML': { min: 12, max: 30, avg: 18 },
      'FinTech': { min: 8, max: 25, avg: 15 }, // Much higher for FinTech
      'EdTech': { min: 6, max: 15, avg: 10 },
      'HealthTech': { min: 6, max: 18, avg: 12 },
      'Hardware': { min: 4, max: 8, avg: 6 },
      'Consulting': { min: 4, max: 8, avg: 6 },
      'FMCG': { min: 3, max: 6, avg: 4.5 },
      'Other': { min: 4, max: 10, avg: 7 }
    };

    const categoryMultiple = industryMultiples[category] || industryMultiples['Other'];

    // Berkus Method calculation (for pre-revenue/early stage)
    const berkusFactors = {
      soundIdea: Math.min(scores.productScore * 100000, 500000),
      qualityTeam: Math.min(scores.teamScore * 100000, 500000),
      prototype: Math.min(scores.productScore * 100000, 500000),
      strategicRelationships: Math.min(scores.marketScore * 100000, 500000),
      productRollout: Math.min(scores.salesScore * 80000, 400000)
    };

    const berkusValuation = Object.values(berkusFactors).reduce((a, b) => a + b, 0);

    // Scorecard Method calculation
    const baseValuation = 50000000; // ₹5 Cr in INR (base for Indian seed companies)
    
    const scorecardMultipliers = {
      team: 0.25 * (scores.teamScore / 5),
      market: 0.20 * (scores.marketScore / 5),
      product: 0.18 * (scores.productScore / 5),
      sales: 0.15 * (scores.salesScore / 5),
      financing: 0.10 * (scores.financingScore / 5),
      competitive: 0.12 * (scores.competitiveScore / 5)
    };

    const totalMultiplier = Object.values(scorecardMultipliers).reduce((a, b) => a + b, 0);
    const scorecardValuation = baseValuation * (0.5 + totalMultiplier * 1.5);

    // Revenue Multiple Method (if revenue exists)
    let revenueMultipleValuation = 0;
    let annualRevenue = 0;
    if (revenue && revenue > 0) {
      annualRevenue = revenue * 12; // Convert monthly to annual
      
      // Adjust multiple based on stage and growth potential - MAXIMUM AGGRESSIVE
      let adjustedMultiple = categoryMultiple.avg;
      if (companyStage === 'Growing' || companyStage === 'Established') {
        adjustedMultiple = categoryMultiple.max * 2.2; // MAXIMUM for growth (was 1.8)
      } else if (companyStage === 'Launched') {
        adjustedMultiple = categoryMultiple.avg * 2.5; // Much higher for launched
      } else {
        adjustedMultiple = categoryMultiple.min * 2.5; // Higher for early traction
      }
      
      // Further adjust based on scores - MAXIMUM BOOST
      const avgScore = (scores.teamScore + scores.productScore + scores.marketScore + scores.salesScore + scores.financingScore + scores.competitiveScore) / 6;
      if (avgScore >= 4.5) adjustedMultiple *= 2.2; // Maximum
      else if (avgScore >= 4.0) adjustedMultiple *= 2.0; // Higher
      else if (avgScore >= 3.5) adjustedMultiple *= 1.8; // Higher
      else if (avgScore >= 3.0) adjustedMultiple *= 1.5; // Higher
      else adjustedMultiple *= 1.2; // Baseline
      
      revenueMultipleValuation = annualRevenue * adjustedMultiple;
    }

    // Final valuation logic based on stage and revenue
    let finalValuationINR;
    let valuationMethod;
    
    if (revenue && revenue > 0 && (companyStage === 'Growing' || companyStage === 'Established' || companyStage === 'Launched')) {
      // Use revenue multiple method with MAXIMUM weighting (was 80/20, now 90/10)
      finalValuationINR = (revenueMultipleValuation * 0.9 + scorecardValuation * 0.1);
      valuationMethod = 'Revenue Multiple + Scorecard';
    } else if (companyStage === 'Idea' || companyStage === 'MVP') {
      // Use Berkus for very early stage
      finalValuationINR = (berkusValuation * 0.6 + scorecardValuation * 0.4);
      valuationMethod = 'Berkus + Scorecard';
    } else {
      // Use scorecard + berkus for mid-stage
      finalValuationINR = (berkusValuation * 0.3 + scorecardValuation * 0.7);
      valuationMethod = 'Scorecard + Berkus';
    }

    const finalValuationUSD = finalValuationINR / 83; // Current exchange rate

    // Calculate TAM, SAM, SOM (simplified estimates based on category and market)
    const marketSizeEstimates = {
      'SaaS': { tam: 5000000000000, samPercent: 5, somPercent: 1 }, // ₹50,000 Cr TAM
      'Mobile App': { tam: 2000000000000, samPercent: 3, somPercent: 0.5 },
      'E-commerce': { tam: 10000000000000, samPercent: 2, somPercent: 0.3 },
      'Marketplace': { tam: 8000000000000, samPercent: 4, somPercent: 0.8 },
      'AI/ML': { tam: 3000000000000, samPercent: 10, somPercent: 2 },
      'Hardware': { tam: 4000000000000, samPercent: 3, somPercent: 0.5 },
      'Consulting': { tam: 1500000000000, samPercent: 5, somPercent: 1 },
      'FMCG': { tam: 15000000000000, samPercent: 1, somPercent: 0.1 },
      'Other': { tam: 2000000000000, samPercent: 3, somPercent: 0.5 }
    };

    const marketEstimate = marketSizeEstimates[category] || marketSizeEstimates['Other'];
    const TAM = marketEstimate.tam;
    const SAM = TAM * (marketEstimate.samPercent / 100);
    const SOM = SAM * (marketEstimate.somPercent / 100);

    // Calculate CAGR (estimate based on stage and sales performance)
    let CAGR = 0;
    
    // Base CAGR on stage
    if (companyStage === 'Idea' || companyStage === 'MVP') CAGR = 150; // 150% for early stage
    else if (companyStage === 'Launched') CAGR = 100; // 100% for launched
    else if (companyStage === 'Beta') CAGR = 120; // 120% for beta
    else if (companyStage === 'Growing') CAGR = 75; // 75% for growing
    else if (companyStage === 'Established') CAGR = 40; // 40% for established
    
    // Adjust based on sales score (performance indicator)
    CAGR *= (scores.salesScore / 5);
    
    // Further boost if revenue exists (proven traction)
    if (revenue && revenue > 0) {
      CAGR *= 1.2; // 20% boost for having actual revenue
    }

    // Calculate Runway (months of operation remaining)
    let runway = 0;
    let burnRate = monthlyExpenses || 0;
    
    // For revenue businesses, estimate burn from expenses if not provided
    if (revenue && revenue > 0 && burnRate === 0) {
      // Assume 70% of revenue goes to expenses (conservative estimate)
      burnRate = revenue * 0.7;
    }
    
    if (totalInvestment && burnRate > 0) {
      const netBurn = burnRate - (revenue || 0); // Revenue reduces burn
      if (netBurn > 0) {
        runway = Math.floor(totalInvestment / netBurn);
      } else {
        runway = 999; // Profitable, essentially infinite runway
      }
    } else if (revenue && revenue > burnRate) {
      // Profitable without needing investment
      runway = 999;
    }

    // Return comprehensive valuation data
    res.json({
      // Valuation methods
      berkusValuation,
      scorecardValuation,
      revenueMultipleValuation: revenueMultipleValuation || null,
      finalValuationINR,
      finalValuationUSD,
      valuationMethod,
      
      // Breakdown
      scorecardMultipliers,
      berkusFactors,
      industryMultiple: categoryMultiple,
      
      // Market metrics
      TAM,
      SAM,
      SOM,
      marketPenetration: annualRevenue > 0 ? ((annualRevenue / SOM) * 100).toFixed(2) : 0,
      
      // Growth metrics
      CAGR,
      annualRevenue,
      
      // Financial health
      runway,
      burnRate,
      monthlyRevenue: revenue || 0,
      isProfitable: revenue > burnRate,
      
      calculatedAt: new Date()
    });
  } catch (error) {
    console.error('Valuation calculation error:', error);
    res.status(500).json({ error: 'Failed to calculate valuation' });
  }
});

// Grok API Integration
app.post('/api/analysis/swot', authenticateToken, async (req, res) => {
  try {
    const { companyData, industry, competitors } = req.body;
    const userId = req.user.userId;

    // Check rate limit
    const rateLimitCheck = geminiRateLimiter.checkLimit(userId);
    if (!rateLimitCheck.allowed) {
      return res.status(429).json({ 
        error: `Rate limit exceeded. Please try again in ${rateLimitCheck.resetIn} minutes.`
      });
    }

    const prompt = `As a Senior Venture Capital Analyst, provide a comprehensive SWOT analysis for a ${industry} startup with the following profile:
    
Company Stage: ${companyData.stage}
Team Score: ${companyData.teamScore}/5
Product Score: ${companyData.productScore}/5
Market Opportunity: ${companyData.marketScore}/5
Current Revenue: ${companyData.revenue}
Key Competitors: ${Array.isArray(competitors) ? competitors.join(', ') : (competitors || 'None specified')}
Target Customer: ${companyData.targetCustomer || 'Not specified'}
Has Revenue: ${companyData.hasRevenue ? 'Yes' : 'No'}

Provide a detailed, personalized SWOT analysis in JSON format. Be specific to THIS ${industry} company, mention their actual competitors (${Array.isArray(competitors) ? competitors.join(', ') : competitors}), and tailor strengths/weaknesses based on their ${companyData.stage} stage.

{
  "strengths": ["strength1", "strength2", "strength3", "strength4"],
  "weaknesses": ["weakness1", "weakness2", "weakness3", "weakness4"],
  "opportunities": ["opportunity1", "opportunity2", "opportunity3", "opportunity4"],
  "threats": ["threat1", "threat2", "threat3", "threat4"]
}`;

    // Use Gemini API directly (Grok is deprecated)
    try {
      const systemContext = 'You are a Senior Venture Capital Analyst specializing in early-stage startup evaluation. Return ONLY valid JSON, no markdown formatting, no explanations.';
      const geminiResponse = await callGemini(prompt, systemContext);
      
      // Clean and parse
      let content = geminiResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const analysis = JSON.parse(content);
      
      console.log('✅ SWOT analysis from Gemini API for', industry);
      return res.json(analysis);
      
    } catch (geminiError) {
      console.warn('Gemini failed for SWOT:', geminiError.message);
      throw geminiError;
    }

  } catch (error) {
    console.error('AI backend failed for SWOT:', error.message);
    // Return personalized fallback data based on inputs
    const { companyData, industry, competitors } = req.body;
    res.json({
      strengths: [
        `${companyData?.stage || 'Early'} stage ${industry} company with operational foundation`,
        `Team expertise in ${industry} domain`,
        companyData?.hasRevenue ? 'Proven revenue generation capability' : 'Early product development focus',
        `Product addressing ${companyData?.targetCustomer || 'target market'} needs`
      ],
      weaknesses: [
        companyData?.hasRevenue ? 'Revenue scale still developing' : 'Pre-revenue stage with market validation needed',
        `Competing against established players like ${Array.isArray(competitors) ? competitors[0] : competitors}`,
        'Brand recognition to be built',
        'Resource optimization required for growth'
      ],
      opportunities: [
        `Growing ${industry} market with expansion potential`,
        'Strategic partnerships in ecosystem',
        'Government funding schemes and grants available',
        'Technology adoption acceleration post-pandemic'
      ],
      threats: [
        `Direct competition from ${Array.isArray(competitors) ? competitors.join(', ') : competitors}`,
        `Regulatory changes in ${industry} sector`,
        'Market saturation and customer acquisition costs',
        'Economic volatility affecting investment climate'
      ]
    });
  }
});

app.post('/api/analysis/funding-schemes', authenticateToken, async (req, res) => {
  try {
    const { companyProfile, category, stage, totalInvestment, location, state, productDescription, teamSize, hasRevenue } = req.body;
    const userId = req.user.userId;

    // Check rate limit
    const rateLimitCheck = geminiRateLimiter.checkLimit(userId);
    if (!rateLimitCheck.allowed) {
      return res.status(429).json({ 
        error: `Rate limit exceeded. Please try again in ${rateLimitCheck.resetIn} minutes.`
      });
    }

    console.log('💰 Funding schemes request:', { category, stage, state: state || location, totalInvestment, hasRevenue });

    // State-specific schemes database (major startup states)
    const stateSchemes = {
      'Karnataka': [
        { name: 'Karnataka Startup Cell - Idea2PoC', amount: '₹50 Lakhs', eligibility: 'DPIIT recognized, Karnataka-based, Idea to Prototype stage', benefits: 'Grant for proof of concept development, no equity dilution', type: 'Grant' },
        { name: 'Karnataka Elevate Program', amount: 'Up to ₹50 Lakhs', eligibility: 'Tech startups, post-revenue, Karnataka-based', benefits: 'Funding + mentorship for scaling, ecosystem connect', type: 'Grant' },
        { name: 'KBITS Innovation Fund', amount: '₹25-50 Lakhs', eligibility: 'Bio-IT, AI/ML, IoT startups in Karnataka', benefits: 'Seed funding for innovative tech ventures', type: 'Equity' }
      ],
      'Maharashtra': [
        { name: 'Maharashtra Start-up Week Funding', amount: '₹10-25 Lakhs', eligibility: 'Maharashtra-based, innovative startups, early stage', benefits: 'Seed funding and ecosystem support, networking', type: 'Grant' },
        { name: 'MahaIT Innovation Fund', amount: 'Up to ₹1 Crore', eligibility: 'IT/Tech startups, Maharashtra-based, post-revenue', benefits: 'Scaling support, infrastructure access', type: 'Equity' }
      ],
      'Tamil Nadu': [
        { name: 'Tamil Nadu Startup Fund', amount: '₹25-50 Lakhs', eligibility: 'TN-based startups, DPIIT recognized, innovative product', benefits: 'Seed funding, incubation support, mentorship', type: 'Grant' },
        { name: 'TANSIM Startup Support', amount: 'Up to ₹10 Lakhs', eligibility: 'Manufacturing/hardware startups in TN', benefits: 'Infrastructure, testing facilities, grants', type: 'Grant' }
      ],
      'Telangana': [
        { name: 'T-Hub Seed Fund', amount: '₹25 Lakhs', eligibility: 'Tech startups incubated at T-Hub, Telangana-based', benefits: 'Seed funding, mentorship, ecosystem access', type: 'Grant' },
        { name: 'WE Hub Women Entrepreneur Fund', amount: '₹15-30 Lakhs', eligibility: 'Women-led startups, Telangana-based', benefits: 'Funding, incubation, women-focused support', type: 'Grant' }
      ],
      'Gujarat': [
        { name: 'Gujarat Startup Fund', amount: 'Up to ₹50 Lakhs', eligibility: 'Gujarat-based, DPIIT recognized, early-stage', benefits: 'Seed capital, mentorship, infrastructure', type: 'Grant' },
        { name: 'iCreate Seed Fund', amount: '₹10-25 Lakhs', eligibility: 'Product/hardware startups, Gujarat-based', benefits: 'Prototype development, market testing', type: 'Grant' }
      ],
      'Delhi NCR': [
        { name: 'Delhi Startup Policy Fund', amount: '₹20-50 Lakhs', eligibility: 'Delhi-registered startups, innovative business model', benefits: 'Seed funding, subsidy on patent filing, office space', type: 'Grant' },
        { name: 'Delhi Innovation Fund', amount: 'Up to ₹1 Crore', eligibility: 'Tech startups, post-revenue, Delhi-based', benefits: 'Growth capital, ecosystem access', type: 'Equity' }
      ],
      'Haryana': [
        { name: 'Haryana Enterprise Promotion Center Fund', amount: '₹15-30 Lakhs', eligibility: 'Haryana-based startups, early stage', benefits: 'Seed funding, subsidy benefits', type: 'Grant' }
      ],
      'Kerala': [
        { name: 'Kerala Startup Mission Fund', amount: '₹25-50 Lakhs', eligibility: 'Kerala-based, DPIIT recognized, innovative product', benefits: 'Seed funding, incubation facilities, mentorship', type: 'Grant' },
        { name: 'Women Startup Fund - Kerala', amount: 'Up to ₹20 Lakhs', eligibility: 'Women-led startups in Kerala', benefits: 'Interest-free loans, mentorship', type: 'Loan' }
      ],
      'Rajasthan': [
        { name: 'Rajasthan Startup Fest Funding', amount: '₹10-25 Lakhs', eligibility: 'Rajasthan-based, early stage startups', benefits: 'Seed grant, ecosystem support', type: 'Grant' }
      ],
      'Uttar Pradesh': [
        { name: 'UP Startup Fund', amount: '₹25-50 Lakhs', eligibility: 'UP-based startups, DPIIT recognized', benefits: 'Seed funding, infrastructure support', type: 'Grant' }
      ]
    };

    // Personalized eligibility logic
    const isEligibleForSISFS = totalInvestment < 5000000; // < ₹50L
    const isEducationTech = category === 'EdTech' || category === 'Education' || category === 'E-learning';
    const userState = state || location || 'Other';
    const stateSpecificSchemes = stateSchemes[userState] || [];

    const prompt = `As an expert on Indian Government funding schemes for startups, analyze eligibility for a ${category} startup:

Company Profile:
- Category: ${category}
- Stage: ${stage}
- Total Investment Needed: ₹${totalInvestment}
- Location/State: ${userState}
- Team Size: ${teamSize || 'Not specified'}
- Has Revenue: ${hasRevenue ? 'Yes' : 'No'}
- Description: ${companyProfile || productDescription || 'Not provided'}

Provide recommendations in JSON format with detailed eligibility analysis:
{
  "centralSchemes": [
    {
      "name": "scheme name",
      "amount": "funding amount",
      "eligibility": "specific eligibility criteria",
      "benefits": "key benefits and what funding covers",
      "eligible": true/false,
      "eligibilityStatus": "eligible" or "partial" or "not-eligible",
      "reasoning": "why eligible/not eligible based on company profile",
      "type": "Grant/Equity/Loan"
    }
  ],
  "stateSchemes": [similar structure],
  "priority": "recommended priority scheme with detailed reasoning based on stage, category, and needs"
}

Focus on Central schemes like:
- SISFS (Startup India Seed Fund) - up to ₹50L for idea/prototype stage
- CGSS (Credit Guarantee) - up to ₹10Cr for growing/established startups
- GENESIS (GenNext Support for Innovative Startups) - for deep tech/AI-ML
- Ed-AII - for EdTech/education startups
- NIDHI (National Initiative for Developing and Harnessing Innovations)
- Atal Innovation Mission grants

For State Schemes in ${userState}, include specific state government programs available.

Mark eligibilityStatus as:
- "eligible" (green) if ALL criteria met
- "partial" (amber) if SOME criteria met but needs minor adjustments
- "not-eligible" (grey) if does not meet criteria

Provide specific reasoning for each scheme based on the company's actual profile, stage, and category.`;

    // Use Gemini API directly (Grok deprecated)
    try {
      const systemContext = 'You are an expert on Indian Government funding schemes for startups with detailed knowledge of both Central and State-level programs. Analyze company profile and provide specific, personalized eligibility assessment. Return ONLY valid JSON, no markdown.';
      const geminiResponse = await callGemini(prompt, systemContext);
      
      // Clean and parse
      let content = geminiResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const schemes = JSON.parse(content);
      
      console.log('✅ Funding schemes from Gemini API for', category, 'in', userState);
      return res.json(schemes);
      
    } catch (geminiError) {
      console.warn('Gemini failed for funding schemes:', geminiError.message);
      throw geminiError;
    }

  } catch (error) {
    console.error('Funding schemes analysis error:', error);
    
    // Return personalized mock data with state schemes on error
    const { category, stage, totalInvestment, location, state, hasRevenue } = req.body;
    const isEligibleForSISFS = totalInvestment < 5000000;
    const isEducationTech = category === 'EdTech' || category === 'Education' || category === 'E-learning';
    const userState = state || location || 'Other';
    
    // State schemes database (same as above)
    const stateSchemes = {
      'Karnataka': [
        { name: 'Karnataka Startup Cell - Idea2PoC', amount: '₹50 Lakhs', eligibility: 'DPIIT recognized, Karnataka-based, Idea to Prototype stage', benefits: 'Grant for proof of concept development', type: 'Grant', eligible: stage === 'Idea' || stage === 'MVP' || stage === 'Beta', eligibilityStatus: (stage === 'Idea' || stage === 'MVP' || stage === 'Beta') ? 'eligible' : 'partial', reasoning: 'Karnataka-based startups in early stage qualify for PoC funding' },
        { name: 'Karnataka Elevate Program', amount: 'Up to ₹50 Lakhs', eligibility: 'Tech startups, post-revenue, Karnataka-based', benefits: 'Funding + mentorship for scaling', type: 'Grant', eligible: hasRevenue, eligibilityStatus: hasRevenue ? 'eligible' : 'not-eligible', reasoning: 'Requires revenue generation for eligibility' }
      ],
      'Maharashtra': [
        { name: 'Maharashtra Start-up Week Funding', amount: '₹10-25 Lakhs', eligibility: 'Maharashtra-based, innovative startups', benefits: 'Seed funding and ecosystem support', type: 'Grant', eligible: true, eligibilityStatus: 'eligible', reasoning: 'Maharashtra-based startups with innovative ideas qualify' }
      ],
      'Tamil Nadu': [
        { name: 'Tamil Nadu Startup Fund', amount: '₹25-50 Lakhs', eligibility: 'TN-based startups, DPIIT recognized', benefits: 'Seed funding, incubation support', type: 'Grant', eligible: true, eligibilityStatus: 'eligible', reasoning: 'TN-based startups with innovative products qualify' }
      ],
      'Telangana': [
        { name: 'T-Hub Seed Fund', amount: '₹25 Lakhs', eligibility: 'Tech startups incubated at T-Hub', benefits: 'Seed funding, mentorship', type: 'Grant', eligible: category === 'SaaS' || category === 'AI/ML', eligibilityStatus: (category === 'SaaS' || category === 'AI/ML') ? 'eligible' : 'partial', reasoning: 'Tech-focused startups preferred for T-Hub incubation' }
      ],
      'Gujarat': [
        { name: 'Gujarat Startup Fund', amount: 'Up to ₹50 Lakhs', eligibility: 'Gujarat-based, DPIIT recognized', benefits: 'Seed capital, mentorship', type: 'Grant', eligible: true, eligibilityStatus: 'eligible', reasoning: 'Gujarat-based startups qualify for state seed funding' }
      ],
      'Delhi NCR': [
        { name: 'Delhi Startup Policy Fund', amount: '₹20-50 Lakhs', eligibility: 'Delhi-registered startups', benefits: 'Seed funding, subsidy on patents', type: 'Grant', eligible: true, eligibilityStatus: 'eligible', reasoning: 'Delhi-registered startups with innovative business models qualify' }
      ],
      'Kerala': [
        { name: 'Kerala Startup Mission Fund', amount: '₹25-50 Lakhs', eligibility: 'Kerala-based, DPIIT recognized', benefits: 'Seed funding, incubation', type: 'Grant', eligible: true, eligibilityStatus: 'eligible', reasoning: 'Kerala-based startups with innovative products qualify' }
      ]
    };
    
    const userStateSchemes = stateSchemes[userState] || [];
    
    res.json({
      centralSchemes: [
        {
          name: 'Startup India Seed Fund Scheme (SISFS)',
          amount: 'Up to ₹50 Lakhs',
          eligibility: 'DPIIT recognized startups, incorporated < 2 years, working on innovative products',
          benefits: 'Validation of proof of concept, prototype development, product trials, market entry',
          eligible: isEligibleForSISFS,
          eligibilityStatus: isEligibleForSISFS ? 'eligible' : 'partial',
          reasoning: isEligibleForSISFS ? `Investment of ₹${(totalInvestment/100000).toFixed(1)}L < ₹50L qualifies for SISFS` : 'Funding needs exceed SISFS limit',
          type: 'Grant'
        },
        {
          name: 'Credit Guarantee Scheme for Startups (CGSS)',
          amount: 'Up to ₹10 Crores',
          eligibility: 'DPIIT recognized startups, valid business model, revenue generation potential',
          benefits: 'Collateral-free credit guarantee, easier access to working capital loans',
          eligible: hasRevenue || stage === 'Growing' || stage === 'Established',
          eligibilityStatus: (hasRevenue || stage === 'Growing' || stage === 'Established') ? 'eligible' : 'partial',
          reasoning: hasRevenue ? 'Revenue-generating startup qualifies for credit guarantee' : 'Focus on revenue generation to qualify',
          type: 'Credit Guarantee'
        },
        {
          name: 'GENESIS (GenNext Support for Innovative Startups)',
          amount: '₹10 Lakhs - ₹1 Crore',
          eligibility: 'Deep tech, AI/ML, IoT, Robotics startups',
          benefits: 'Equity/debt funding for innovative tech products',
          eligible: category === 'AI/ML' || category === 'SaaS' || category === 'Hardware',
          eligibilityStatus: (category === 'AI/ML' || category === 'SaaS' || category === 'Hardware') ? 'eligible' : 'not-eligible',
          reasoning: (category === 'AI/ML' || category === 'SaaS' || category === 'Hardware') ? 'Tech category qualifies for GENESIS' : 'GENESIS is for deep-tech startups only',
          type: 'Equity/Debt'
        },
        {
          name: 'Ed-AII (Education and Assessment Innovation Initiative)',
          amount: 'Up to ₹50 Lakhs',
          eligibility: 'EdTech, Education, E-learning startups',
          benefits: 'Funding for educational innovation, assessment tools',
          eligible: isEducationTech,
          eligibilityStatus: isEducationTech ? 'eligible' : 'not-eligible',
          reasoning: isEducationTech ? 'EdTech category qualifies for Ed-AII' : 'Ed-AII is for EdTech/Education startups only',
          type: 'Grant'
        }
      ],
      stateSchemes: userStateSchemes.length > 0 ? userStateSchemes : [{
        name: `${userState} State Startup Support`,
        amount: 'Varies by state',
        eligibility: `Startups registered in ${userState}`,
        benefits: 'Seed funding, mentorship, incubation support - check state startup portal',
        eligible: true,
        eligibilityStatus: 'partial',
        reasoning: `${userState}-based startups may qualify for state programs - verify with state startup cell`,
        type: 'Grant'
      }],
      priority: `For ${stage} stage ${category} startup in ${userState}: ${isEligibleForSISFS ? 'SISFS is recommended as primary scheme for early-stage funding support. ' : ''}${userStateSchemes.length > 0 ? `Also explore ${userStateSchemes[0].name} for state-specific benefits. ` : ''}${hasRevenue ? 'CGSS can provide collateral-free working capital for growth.' : ''}`
    });
  }
});

// Market Trends & Competitor Analysis endpoint
app.post('/api/analysis/competitors', authenticateToken, async (req, res) => {
  try {
    const { category, stage, revenue, userMentionedCompetitors } = req.body;
    const userId = req.user.userId;

    // Check rate limit
    const rateLimitCheck = geminiRateLimiter.checkLimit(userId);
    if (!rateLimitCheck.allowed) {
      return res.status(429).json({ 
        error: `Rate limit exceeded. Please try again in ${rateLimitCheck.resetIn} minutes.`
      });
    }

    // Parse user-mentioned competitors
    const mentionedComps = userMentionedCompetitors 
      ? userMentionedCompetitors.split(',').map(c => c.trim()).filter(c => c.length > 0)
      : [];

    console.log('📊 Fetching competitor valuation data for:', category, 'User mentioned:', mentionedComps);

    // Use Google Search grounding for real, validated competitor data
    const searchPrompt = `Research and provide ACCURATE, DOUBLE-VERIFIED valuation data for ${category} companies.

USER CONTEXT:
- Industry: ${category}
- Stage: ${stage}
- User mentioned competitors: ${mentionedComps.length > 0 ? mentionedComps.join(', ') : 'None specified'}

CRITICAL TASK - You MUST return EXACTLY 7 competitors:
1. ALL user-mentioned competitors (if any): ${mentionedComps.join(', ') || 'N/A'}
2. 3 LOCAL (Indian) ${category} companies - well-established major players in India
3. 3 INTERNATIONAL ${category} companies - global leaders that compete or could enter India
4. 1 POTENTIAL RIVAL - an emerging/growing company that could be a future threat (do NOT tag this one differently)

DATA VERIFICATION REQUIREMENTS:
- CROSS-VERIFY all data from at least 2 sources before including
- For valuation: Use funding round announcements, IPO filings, or market cap
- For revenue: Use annual reports, news articles, or estimates from credible sources
- For customers: Use official company data or credible reports
- Sources must be: Crunchbase, PitchBook, company filings, Reuters, Bloomberg, Economic Times, YourStory, Inc42, TechCrunch

VALUATION TIMELINE REQUIREMENTS:
- Include at least 4 data points spanning founding year to 2024/2025
- Each point must have: year, valuation (in INR), event (funding round/IPO/milestone)
- For international companies: Convert to INR (use 83 INR = 1 USD)

Mark each company with:
- "region": "local" for Indian companies
- "region": "international" for global companies
- "dataVerified": true if data is from verified sources
- "verificationSources": ["Source1", "Source2"] - list at least 2 sources

Return ONLY valid JSON (no markdown, no code blocks):
{
  "competitors": [
    {
      "name": "Company Name",
      "category": "${category}",
      "stage": "Current Stage (Seed/Series A/B/C/Public etc)",
      "region": "local or international",
      "headquarters": "City, Country",
      "foundedYear": 2015,
      "currentValuation": 500000000000,
      "flagshipProduct": "Main product/service the company is known for",
      "products": ["Flagship Product", "Product 2", "Product 3"],
      "valuationTimeline": [
        { "year": 2015, "valuation": 10000000, "event": "Founded/Seed" },
        { "year": 2017, "valuation": 500000000, "event": "Series A" },
        { "year": 2019, "valuation": 5000000000, "event": "Series B" },
        { "year": 2021, "valuation": 50000000000, "event": "Series C" },
        { "year": 2023, "valuation": 200000000000, "event": "Series D" },
        { "year": 2024, "valuation": 500000000000, "event": "Latest" }
      ],
      "revenue": 100000000,
      "growthRate": 45,
      "customers": 50000,
      "fundingRaised": 30000000000,
      "visible": true,
      "isUserMentioned": false,
      "isDataPublic": true
    }
  ],
  "marketTrends": [
    { "title": "India vs Global CAGR", "value": "33% vs 25%", "description": "Indian market growing faster" },
    { "title": "2024 Funding", "value": "$X Billion", "description": "Total VC investment in sector" },
    { "title": "Market Size", "value": "$X Billion", "description": "Total addressable market in India" },
    { "title": "YoY Growth", "value": "X%", "description": "Year-over-year growth rate" },
    { "title": "Active Startups", "value": "X+", "description": "Number of startups in this space" },
    { "title": "Unicorn Count", "value": "X", "description": "Unicorns in this category" },
    { "title": "Avg Deal Size", "value": "$X Million", "description": "Average funding round size" }
  ],
  "dataValidation": {
    "sources": ["Source 1", "Source 2"],
    "lastUpdated": "December 2024",
    "confidence": "high/medium/low"
  }
}`;

    try {
      // Use Google Search grounded Gemini for real data
      const searchResponse = await callGeminiWithSearch(searchPrompt, 
        'You are a financial data analyst. Provide ONLY verified, factual valuation data from real sources. Return pure JSON only.');
      
      // Clean and parse response
      let content = searchResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      
      // Try to find JSON in the response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        content = jsonMatch[0];
      }
      
      const analysis = JSON.parse(content);
      
      // Post-process competitors to ensure all required fields exist with valid data
      // and categorize into verified vs potential competitors
      const verifiedCompetitors = [];
      const potentialCompetitors = [];
      
      if (analysis.competitors) {
        analysis.competitors.forEach(comp => {
          // Calculate growth rate if not provided (based on valuation timeline)
          let growthRate = comp.growthRate || 0;
          let currentValuation = comp.currentValuation || 0;
          
          // Compute currentValuation from timeline if not provided
          if (comp.valuationTimeline && comp.valuationTimeline.length > 0) {
            const timeline = comp.valuationTimeline;
            const latestEntry = timeline[timeline.length - 1];
            if (!currentValuation && latestEntry?.valuation) {
              currentValuation = latestEntry.valuation;
            }
            
            // Calculate growth rate if not provided
            if (!growthRate && timeline.length >= 2) {
              const latestVal = latestEntry?.valuation || 0;
              const prevVal = timeline[timeline.length - 2]?.valuation || 1;
              growthRate = Math.round(((latestVal - prevVal) / prevVal) * 100);
            }
          }
          
          // Ensure flagshipProduct is set (first product in list if not specified)
          const flagshipProduct = comp.flagshipProduct || (comp.products && comp.products.length > 0 ? comp.products[0] : null);
          
          // Check if revenue and customers are explicitly provided (not zero/null)
          const hasVerifiedRevenue = comp.revenue && comp.revenue > 0;
          const hasVerifiedCustomers = comp.customers && comp.customers > 0;
          const isVerified = hasVerifiedRevenue || hasVerifiedCustomers;
          
          // Estimate customers based on revenue if not provided
          let customers = comp.customers || 0;
          let isCustomerEstimated = false;
          if (!customers && comp.revenue) {
            // Rough estimate: average revenue per customer varies by category
            const avgRevenuePerCustomer = {
              'SaaS': 100000,      // B2B SaaS - higher value per customer
              'FinTech': 5000,     // FinTech - many small transactions
              'E-commerce': 2000, // E-commerce - consumer
              'EdTech': 10000,    // EdTech - course fees
              'AI/ML': 50000,     // AI/ML - enterprise
              'Marketplace': 3000, // Marketplace - transactions
              'HealthTech': 15000, // HealthTech
            };
            const avgRevPerCust = avgRevenuePerCustomer[category] || 10000;
            customers = Math.round(comp.revenue / avgRevPerCust);
            isCustomerEstimated = true;
          }
          
          // Ensure valuationTimeline exists and is valid
          let valuationTimeline = comp.valuationTimeline || [];
          
          // If no timeline but we have valuation, create a basic timeline
          if (valuationTimeline.length === 0 && currentValuation > 0) {
            const foundedYear = comp.foundedYear || 2015;
            const currentYear = new Date().getFullYear();
            valuationTimeline = [
              { year: foundedYear, valuation: Math.round(currentValuation * 0.01), event: 'Founded' },
              { year: Math.min(foundedYear + 2, currentYear - 3), valuation: Math.round(currentValuation * 0.1), event: 'Early Growth' },
              { year: Math.min(foundedYear + 5, currentYear - 1), valuation: Math.round(currentValuation * 0.4), event: 'Series Round' },
              { year: currentYear, valuation: currentValuation, event: 'Current' }
            ];
          } else if (valuationTimeline.length === 1) {
            // If only one entry, add more context
            const foundedYear = comp.foundedYear || valuationTimeline[0].year || 2015;
            const currentYear = new Date().getFullYear();
            valuationTimeline = [
              { year: foundedYear, valuation: Math.round(currentValuation * 0.05), event: 'Founded' },
              ...valuationTimeline,
              { year: currentYear, valuation: currentValuation, event: 'Current' }
            ];
          }
          
          // Remove duplicates and sort by year
          const uniqueTimeline = [];
          const seenYears = new Set();
          valuationTimeline.forEach(entry => {
            if (!seenYears.has(entry.year)) {
              seenYears.add(entry.year);
              uniqueTimeline.push(entry);
            }
          });
          valuationTimeline = uniqueTimeline.sort((a, b) => a.year - b.year);
          
          const processedComp = {
            ...comp,
            currentValuation: currentValuation,
            valuationTimeline: valuationTimeline,
            flagshipProduct: flagshipProduct,
            growthRate: growthRate,
            customers: customers,
            revenue: comp.revenue || 0,
            fundingRaised: comp.fundingRaised || 0,
            visible: comp.visible !== false,
            isVerified: isVerified,
            isCustomerEstimated: isCustomerEstimated,
            isRevenueEstimated: !hasVerifiedRevenue,
            dataConfidence: isVerified ? 'high' : 'low',
            region: comp.region || 'local', // local or international
            isDataPublic: (comp.revenue && comp.revenue > 0) || (comp.customers && comp.customers > 0) || (currentValuation > 0),
            isUserMentioned: mentionedComps.some(m => 
              comp.name.toLowerCase().includes(m.toLowerCase()) || 
              m.toLowerCase().includes(comp.name.toLowerCase())
            )
          };
          
          if (isVerified) {
            verifiedCompetitors.push(processedComp);
          } else {
            potentialCompetitors.push(processedComp);
          }
        });
      }
      
      // Return categorized competitors
      const result = {
        ...analysis,
        competitors: verifiedCompetitors, // Main competitors with verified data
        verifiedCompetitors: verifiedCompetitors,
        potentialCompetitors: potentialCompetitors,
        summary: {
          totalCompetitors: verifiedCompetitors.length + potentialCompetitors.length,
          verifiedCount: verifiedCompetitors.length,
          potentialCount: potentialCompetitors.length,
          userMentionedCount: [...verifiedCompetitors, ...potentialCompetitors].filter(c => c.isUserMentioned).length
        }
      };
      
      console.log('✅ Valuation timeline data fetched via Google Search for', category);
      console.log(`   - Verified competitors: ${verifiedCompetitors.length}, Potential: ${potentialCompetitors.length}`);
      return res.json(result);
      
    } catch (searchError) {
      console.warn('Google Search grounding failed:', searchError.message);
      // Fall back to regular Gemini
      throw searchError;
    }

  } catch (error) {
    console.error('Competitor analysis error:', error.message);
    
    // Return smart fallback data with valuation timelines
    const { category, stage, userMentionedCompetitors } = req.body;
    const mentionedComps = userMentionedCompetitors 
      ? userMentionedCompetitors.split(',').map(c => c.trim()).filter(c => c.length > 0)
      : [];
    
    // Category-specific competitor mapping with valuation timelines
    const categoryCompetitorsWithTimeline = {
      'SaaS': [
        { 
          name: 'Freshworks', 
          stage: 'Public (NASDAQ)', 
          foundedYear: 2010,
          currentValuation: 350000000000,
          valuationTimeline: [
            { year: 2010, valuation: 10000000, event: 'Founded' },
            { year: 2014, valuation: 500000000, event: 'Series B' },
            { year: 2017, valuation: 8000000000, event: 'Series E' },
            { year: 2019, valuation: 35000000000, event: 'Series H' },
            { year: 2021, valuation: 110000000000, event: 'IPO' },
            { year: 2024, valuation: 350000000000, event: 'Current' }
          ],
          revenue: 500000000, customers: 50000, visible: true
        },
        { 
          name: 'Zoho', 
          stage: 'Private/Bootstrap', 
          foundedYear: 1996,
          currentValuation: 250000000000,
          valuationTimeline: [
            { year: 1996, valuation: 1000000, event: 'Founded' },
            { year: 2005, valuation: 5000000000, event: 'Growth' },
            { year: 2010, valuation: 20000000000, event: 'SaaS Pivot' },
            { year: 2015, valuation: 80000000000, event: 'Global Expansion' },
            { year: 2020, valuation: 150000000000, event: 'Pandemic Growth' },
            { year: 2024, valuation: 250000000000, event: 'Current' }
          ],
          revenue: 1200000000, customers: 80000, visible: true
        },
        { 
          name: 'Postman', 
          stage: 'Series D', 
          foundedYear: 2014,
          currentValuation: 58000000000,
          valuationTimeline: [
            { year: 2014, valuation: 5000000, event: 'Founded' },
            { year: 2017, valuation: 500000000, event: 'Series A' },
            { year: 2019, valuation: 5000000000, event: 'Series B' },
            { year: 2021, valuation: 35000000000, event: 'Series C' },
            { year: 2022, valuation: 58000000000, event: 'Series D' },
            { year: 2024, valuation: 58000000000, event: 'Current' }
          ],
          revenue: 45000000, customers: 25000, visible: true
        },
        { 
          name: 'Chargebee', 
          stage: 'Series G', 
          foundedYear: 2011,
          currentValuation: 35000000000,
          valuationTimeline: [
            { year: 2011, valuation: 5000000, event: 'Founded' },
            { year: 2015, valuation: 200000000, event: 'Series A' },
            { year: 2018, valuation: 2000000000, event: 'Series C' },
            { year: 2021, valuation: 35000000000, event: 'Series G' },
            { year: 2024, valuation: 35000000000, event: 'Current' }
          ],
          revenue: 80000000, customers: 18000, visible: true
        },
        { 
          name: 'CleverTap', 
          stage: 'Series D', 
          foundedYear: 2013,
          currentValuation: 10000000000,
          valuationTimeline: [
            { year: 2013, valuation: 3000000, event: 'Founded' },
            { year: 2016, valuation: 150000000, event: 'Series A' },
            { year: 2019, valuation: 1500000000, event: 'Series B' },
            { year: 2021, valuation: 6800000000, event: 'Series C' },
            { year: 2024, valuation: 10000000000, event: 'Current' }
          ],
          revenue: 30000000, customers: 12000, visible: true
        }
      ],
      'FinTech': [
        { 
          name: 'Razorpay', 
          stage: 'Series F', 
          foundedYear: 2014,
          currentValuation: 75000000000,
          valuationTimeline: [
            { year: 2014, valuation: 10000000, event: 'Founded' },
            { year: 2017, valuation: 800000000, event: 'Series B' },
            { year: 2019, valuation: 8000000000, event: 'Series D' },
            { year: 2021, valuation: 75000000000, event: 'Series F' },
            { year: 2024, valuation: 75000000000, event: 'Current' }
          ],
          revenue: 95000000, customers: 8000000, visible: true
        },
        { 
          name: 'PhonePe', 
          stage: 'Pre-IPO', 
          foundedYear: 2015,
          currentValuation: 120000000000,
          valuationTimeline: [
            { year: 2015, valuation: 50000000, event: 'Founded' },
            { year: 2016, valuation: 1000000000, event: 'Flipkart Acquisition' },
            { year: 2019, valuation: 20000000000, event: 'Rapid Growth' },
            { year: 2022, valuation: 96000000000, event: 'Separation' },
            { year: 2024, valuation: 120000000000, event: 'Current' }
          ],
          revenue: 180000000, customers: 450000000, visible: true
        },
        { 
          name: 'CRED', 
          stage: 'Series F', 
          foundedYear: 2018,
          currentValuation: 65000000000,
          valuationTimeline: [
            { year: 2018, valuation: 100000000, event: 'Founded' },
            { year: 2020, valuation: 8000000000, event: 'Series C' },
            { year: 2021, valuation: 45000000000, event: 'Series E' },
            { year: 2022, valuation: 65000000000, event: 'Series F' },
            { year: 2024, valuation: 65000000000, event: 'Current' }
          ],
          revenue: 22000000, customers: 9000000, visible: true
        },
        { 
          name: 'Paytm', 
          stage: 'Public (NSE/BSE)', 
          foundedYear: 2010,
          currentValuation: 250000000000,
          valuationTimeline: [
            { year: 2010, valuation: 50000000, event: 'Founded' },
            { year: 2015, valuation: 30000000000, event: 'Series D' },
            { year: 2017, valuation: 100000000000, event: 'SoftBank' },
            { year: 2021, valuation: 600000000000, event: 'IPO Peak' },
            { year: 2024, valuation: 250000000000, event: 'Current' }
          ],
          revenue: 250000000, customers: 350000000, visible: true
        },
        { 
          name: 'Zerodha', 
          stage: 'Private/Bootstrap', 
          foundedYear: 2010,
          currentValuation: 200000000000,
          valuationTimeline: [
            { year: 2010, valuation: 10000000, event: 'Founded' },
            { year: 2015, valuation: 1000000000, event: 'Growth' },
            { year: 2018, valuation: 15000000000, event: 'Market Leader' },
            { year: 2021, valuation: 200000000000, event: 'Peak' },
            { year: 2024, valuation: 200000000000, event: 'Current' }
          ],
          revenue: 150000000, customers: 12000000, visible: true
        }
      ],
      'Marketplace': [
        { 
          name: 'Swiggy', 
          stage: 'Pre-IPO', 
          foundedYear: 2014,
          currentValuation: 105000000000,
          valuationTimeline: [
            { year: 2014, valuation: 20000000, event: 'Founded' },
            { year: 2017, valuation: 2000000000, event: 'Series D' },
            { year: 2019, valuation: 35000000000, event: 'Series H' },
            { year: 2021, valuation: 100000000000, event: 'Series K' },
            { year: 2024, valuation: 105000000000, event: 'Current' }
          ],
          revenue: 650000000, customers: 120000000, visible: true
        },
        { 
          name: 'Zomato', 
          stage: 'Public (NSE/BSE)', 
          foundedYear: 2008,
          currentValuation: 180000000000,
          valuationTimeline: [
            { year: 2008, valuation: 5000000, event: 'Founded' },
            { year: 2014, valuation: 10000000000, event: 'Series E' },
            { year: 2018, valuation: 20000000000, event: 'Ant Financial' },
            { year: 2021, valuation: 100000000000, event: 'IPO' },
            { year: 2024, valuation: 180000000000, event: 'Current' }
          ],
          revenue: 480000000, customers: 80000000, visible: true
        },
        { 
          name: 'Meesho', 
          stage: 'Series F', 
          foundedYear: 2015,
          currentValuation: 50000000000,
          valuationTimeline: [
            { year: 2015, valuation: 5000000, event: 'Founded' },
            { year: 2019, valuation: 2000000000, event: 'Series C' },
            { year: 2021, valuation: 50000000000, event: 'Series F' },
            { year: 2024, valuation: 50000000000, event: 'Current' }
          ],
          revenue: 55000000, customers: 13000000, visible: true
        },
        { 
          name: 'Urban Company', 
          stage: 'Series F', 
          foundedYear: 2014,
          currentValuation: 28000000000,
          valuationTimeline: [
            { year: 2014, valuation: 10000000, event: 'Founded' },
            { year: 2017, valuation: 500000000, event: 'Series B' },
            { year: 2019, valuation: 5000000000, event: 'Series D' },
            { year: 2021, valuation: 28000000000, event: 'Series F' },
            { year: 2024, valuation: 28000000000, event: 'Current' }
          ],
          revenue: 180000000, customers: 8000000, visible: true
        },
        { 
          name: 'Dunzo', 
          stage: 'Series F', 
          foundedYear: 2015,
          currentValuation: 7500000000,
          valuationTimeline: [
            { year: 2015, valuation: 5000000, event: 'Founded' },
            { year: 2018, valuation: 200000000, event: 'Google Investment' },
            { year: 2020, valuation: 2000000000, event: 'Series D' },
            { year: 2022, valuation: 7500000000, event: 'Series E' },
            { year: 2024, valuation: 7500000000, event: 'Current' }
          ],
          revenue: 35000000, customers: 3000000, visible: true
        }
      ],
      'E-commerce': [
        { 
          name: 'Nykaa', 
          stage: 'Public (NSE/BSE)', 
          foundedYear: 2012,
          currentValuation: 400000000000,
          valuationTimeline: [
            { year: 2012, valuation: 20000000, event: 'Founded' },
            { year: 2016, valuation: 1500000000, event: 'Series C' },
            { year: 2019, valuation: 15000000000, event: 'Series E' },
            { year: 2021, valuation: 700000000000, event: 'IPO Peak' },
            { year: 2024, valuation: 400000000000, event: 'Current' }
          ],
          revenue: 400000000, customers: 25000000, visible: true
        },
        { 
          name: 'Lenskart', 
          stage: 'Series H', 
          foundedYear: 2010,
          currentValuation: 45000000000,
          valuationTimeline: [
            { year: 2010, valuation: 10000000, event: 'Founded' },
            { year: 2015, valuation: 1000000000, event: 'Series C' },
            { year: 2019, valuation: 15000000000, event: 'Series G' },
            { year: 2022, valuation: 45000000000, event: 'Series H' },
            { year: 2024, valuation: 45000000000, event: 'Current' }
          ],
          revenue: 250000000, customers: 12000000, visible: true
        },
        { 
          name: 'FirstCry', 
          stage: 'Pre-IPO', 
          foundedYear: 2010,
          currentValuation: 24000000000,
          valuationTimeline: [
            { year: 2010, valuation: 10000000, event: 'Founded' },
            { year: 2015, valuation: 1500000000, event: 'Series C' },
            { year: 2019, valuation: 8000000000, event: 'Series E' },
            { year: 2023, valuation: 24000000000, event: 'Pre-IPO' },
            { year: 2024, valuation: 24000000000, event: 'Current' }
          ],
          revenue: 180000000, customers: 8000000, visible: true
        },
        { 
          name: 'boAt', 
          stage: 'Series C', 
          foundedYear: 2016,
          currentValuation: 20000000000,
          valuationTimeline: [
            { year: 2016, valuation: 20000000, event: 'Founded' },
            { year: 2019, valuation: 500000000, event: 'Series A' },
            { year: 2021, valuation: 20000000000, event: 'Series C' },
            { year: 2024, valuation: 20000000000, event: 'Current' }
          ],
          revenue: 220000000, customers: 15000000, visible: true
        },
        { 
          name: 'Mamaearth', 
          stage: 'Public (NSE/BSE)', 
          foundedYear: 2016,
          currentValuation: 150000000000,
          valuationTimeline: [
            { year: 2016, valuation: 10000000, event: 'Founded' },
            { year: 2019, valuation: 1000000000, event: 'Series B' },
            { year: 2021, valuation: 12000000000, event: 'Series D' },
            { year: 2023, valuation: 100000000000, event: 'IPO' },
            { year: 2024, valuation: 150000000000, event: 'Current' }
          ],
          revenue: 120000000, customers: 10000000, visible: true
        }
      ],
      'EdTech': [
        { 
          name: 'Unacademy', 
          stage: 'Series H', 
          foundedYear: 2015,
          currentValuation: 35000000000,
          valuationTimeline: [
            { year: 2015, valuation: 5000000, event: 'Founded' },
            { year: 2018, valuation: 500000000, event: 'Series B' },
            { year: 2020, valuation: 20000000000, event: 'Series F' },
            { year: 2021, valuation: 35000000000, event: 'Series H' },
            { year: 2024, valuation: 35000000000, event: 'Current' }
          ],
          revenue: 28000000, customers: 50000000, visible: true
        },
        { 
          name: 'UpGrad', 
          stage: 'Series E', 
          foundedYear: 2015,
          currentValuation: 22500000000,
          valuationTimeline: [
            { year: 2015, valuation: 10000000, event: 'Founded' },
            { year: 2019, valuation: 1500000000, event: 'Series B' },
            { year: 2021, valuation: 22500000000, event: 'Series E' },
            { year: 2024, valuation: 22500000000, event: 'Current' }
          ],
          revenue: 35000000, customers: 4000000, visible: true
        },
        { 
          name: 'PhysicsWallah', 
          stage: 'Series B', 
          foundedYear: 2020,
          currentValuation: 11000000000,
          valuationTimeline: [
            { year: 2020, valuation: 100000000, event: 'Founded' },
            { year: 2022, valuation: 11000000000, event: 'Series A' },
            { year: 2024, valuation: 11000000000, event: 'Current' }
          ],
          revenue: 25000000, customers: 30000000, visible: true
        },
        { 
          name: 'Vedantu', 
          stage: 'Series E', 
          foundedYear: 2011,
          currentValuation: 10000000000,
          valuationTimeline: [
            { year: 2011, valuation: 5000000, event: 'Founded' },
            { year: 2018, valuation: 500000000, event: 'Series B' },
            { year: 2021, valuation: 10000000000, event: 'Series E' },
            { year: 2024, valuation: 10000000000, event: 'Current' }
          ],
          revenue: 18000000, customers: 8000000, visible: true
        },
        { 
          name: 'Eruditus', 
          stage: 'Series F', 
          foundedYear: 2010,
          currentValuation: 32000000000,
          valuationTimeline: [
            { year: 2010, valuation: 10000000, event: 'Founded' },
            { year: 2017, valuation: 1000000000, event: 'Series C' },
            { year: 2021, valuation: 32000000000, event: 'Series F' },
            { year: 2024, valuation: 32000000000, event: 'Current' }
          ],
          revenue: 50000000, customers: 500000, visible: true
        }
      ]
    };

    // Get competitors for this category
    const competitors = categoryCompetitorsWithTimeline[category] || categoryCompetitorsWithTimeline['SaaS'];
    
    // Mark user-mentioned competitors
    const selectedCompetitors = competitors.map(comp => ({
      ...comp,
      category: category || 'SaaS',
      isUserMentioned: mentionedComps.some(m => 
        comp.name.toLowerCase().includes(m.toLowerCase()) || 
        m.toLowerCase().includes(comp.name.toLowerCase())
      )
    }));

    console.log(`Returning ${selectedCompetitors.length} competitors with valuation timelines for ${category}`);
    
    // Generate market trends (6+ items)
    const marketTrends = [
      {
        title: 'India vs Global CAGR',
        value: category === 'SaaS' ? '35% vs 25%' : category === 'FinTech' ? '31% vs 22%' : category === 'AI/ML' ? '38% vs 28%' : '33% vs 27%',
        description: 'Indian market outpacing global growth'
      },
      {
        title: 'Total Funding 2024',
        value: category === 'SaaS' ? '$2.1B' : category === 'FinTech' ? '$3.2B' : category === 'AI/ML' ? '$1.5B' : '$1.8B',
        description: 'VC investment in sector'
      },
      {
        title: 'Market Size',
        value: category === 'SaaS' ? '$15B' : category === 'FinTech' ? '$85B' : category === 'AI/ML' ? '$8B' : '$12B',
        description: 'Total addressable market in India 2025'
      },
      {
        title: 'YoY Growth',
        value: category === 'SaaS' ? '+32%' : category === 'FinTech' ? '+28%' : category === 'AI/ML' ? '+45%' : '+25%',
        description: 'Sector revenue growth rate'
      },
      {
        title: 'Active Startups',
        value: category === 'SaaS' ? '2,500+' : category === 'FinTech' ? '3,000+' : category === 'AI/ML' ? '1,200+' : '1,800+',
        description: 'Funded startups in this space'
      },
      {
        title: 'Unicorn Count',
        value: category === 'SaaS' ? '15' : category === 'FinTech' ? '22' : category === 'AI/ML' ? '8' : '12',
        description: 'Indian unicorns in category'
      },
      {
        title: 'Avg Deal Size',
        value: category === 'SaaS' ? '$18M' : category === 'FinTech' ? '$25M' : category === 'AI/ML' ? '$12M' : '$15M',
        description: 'Average Series A+ funding'
      },
      {
        title: 'Exit Opportunities',
        value: category === 'SaaS' ? 'High' : category === 'FinTech' ? 'Very High' : category === 'AI/ML' ? 'High' : 'Medium',
        description: 'M&A and IPO activity'
      }
    ];

    return res.json({
      competitors: selectedCompetitors,
      marketTrends,
      dataValidation: {
        sources: ['Crunchbase', 'PitchBook', 'Company Filings', 'Economic Times'],
        lastUpdated: 'December 2024',
        confidence: 'medium',
        note: 'Fallback data - API temporarily unavailable'
      }
    });
  }
});

// Search for a specific company online
app.post('/api/analysis/search-company', authenticateToken, async (req, res) => {
  try {
    const { companyName, category } = req.body;
    
    if (!companyName || companyName.trim().length < 2) {
      return res.status(400).json({ error: 'Company name is required (minimum 2 characters)' });
    }

    console.log(`🔍 Searching online for company: ${companyName}`);

    const prompt = `You are a business research assistant. Search for information about "${companyName}" company/startup.

CRITICAL INSTRUCTIONS:
1. Use Google Search to find ANY information about "${companyName}"
2. Search variations like: "${companyName} company", "${companyName} startup", "${companyName} India", "${companyName} technology"
3. Even if limited data is available, return what you find
4. If it's a real company, ALWAYS set "found": true and provide whatever data is available
5. Use estimates with reasonable values if exact data is not publicly available
6. Only return "found": false if the company absolutely does not exist

SEARCH FOR:
- Company website, LinkedIn, Crunchbase profile
- Funding announcements, press releases
- Product information, services offered
- News articles mentioning the company
- Founder information

For "${companyName}", provide:
1. Official/Full company name
2. What the company does (description)
3. Headquarters location
4. Founded year (estimate if unknown)
5. Products/Services (flagship first)
6. Valuation in INR (estimate based on stage if not public)
7. Revenue in INR (estimate if not public)
8. Customer count (estimate if not public)
9. Funding raised in INR
10. Current stage

VALUATION ESTIMATES BY STAGE (if not public):
- Pre-seed/Idea: ₹1-5 Crore (10M-50M INR)
- Seed: ₹5-25 Crore (50M-250M INR)
- Series A: ₹50-200 Crore (500M-2B INR)
- Series B: ₹200-1000 Crore (2B-10B INR)
- Series C+: ₹1000+ Crore (10B+ INR)

Return ONLY valid JSON:
{
  "found": true,
  "company": {
    "name": "${companyName}",
    "category": "${category || 'Technology'}",
    "description": "What the company does",
    "stage": "Seed/Series A/B/C/Growth/Public",
    "region": "local",
    "headquarters": "City, Country",
    "foundedYear": 2020,
    "currentValuation": 100000000,
    "flagshipProduct": "Main product/service",
    "products": ["Product 1", "Product 2"],
    "valuationTimeline": [
      { "year": 2020, "valuation": 10000000, "event": "Founded" },
      { "year": 2024, "valuation": 100000000, "event": "Current" }
    ],
    "revenue": 10000000,
    "growthRate": 30,
    "customers": 1000,
    "fundingRaised": 50000000,
    "isDataPublic": false
  },
  "sources": ["Website", "LinkedIn", "News"],
  "dataNote": "Some values are estimates"
}`;

    try {
      // Use callGeminiWithSearch for Google Search grounding
      const text = await callGeminiWithSearch(prompt);
      
      // Clean up the response
      let cleanText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      console.log(`📄 Raw API response for ${companyName}:`, cleanText.substring(0, 500));
      
      let searchResult;
      try {
        searchResult = JSON.parse(cleanText);
      } catch (parseError) {
        // Try to extract JSON from the response
        const jsonMatch = cleanText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            searchResult = JSON.parse(jsonMatch[0]);
          } catch (e) {
            console.error('JSON extraction failed:', e.message);
            // Create a basic result from the text
            searchResult = {
              found: true,
              company: {
                name: companyName,
                description: cleanText.substring(0, 200),
                stage: 'Unknown',
                isDataPublic: false
              }
            };
          }
        } else {
          // Even if parsing fails, create a placeholder result
          console.warn('Could not parse JSON, creating placeholder');
          searchResult = {
            found: true,
            company: {
              name: companyName,
              description: 'Company data could not be fully parsed',
              stage: 'Unknown',
              isDataPublic: false
            }
          };
        }
      }

      // If found is false but company exists, treat as found
      if (searchResult.company && searchResult.company.name) {
        searchResult.found = true;
      }

      if (!searchResult.found && !searchResult.company) {
        console.log(`❌ Company not found: ${companyName}`);
        return res.json({
          found: false,
          message: `Could not find company "${companyName}". Please check the spelling or try a different name.`
        });
      }

      console.log(`✅ Company data found for: ${companyName}`);

      // Process the company data
      const company = searchResult.company;
      
      // Compute current valuation from timeline if not set
      let currentValuation = company.currentValuation || 0;
      if (!currentValuation && company.valuationTimeline && company.valuationTimeline.length > 0) {
        const sortedTimeline = [...company.valuationTimeline].sort((a, b) => b.year - a.year);
        currentValuation = sortedTimeline[0]?.valuation || 0;
      }

      // Determine if local (Indian) or international
      const isLocal = company.headquarters?.toLowerCase().includes('india') || 
                      company.region === 'local' ||
                      company.headquarters?.match(/mumbai|bangalore|delhi|chennai|hyderabad|pune|kolkata|bengaluru/i);

      const processedCompany = {
        name: company.name || companyName,
        category: company.category || category || 'Technology',
        description: company.description || '',
        stage: company.stage || 'Unknown',
        region: isLocal ? 'local' : 'international',
        headquarters: company.headquarters || 'Unknown',
        foundedYear: company.foundedYear || null,
        currentValuation: currentValuation,
        flagshipProduct: company.flagshipProduct || (company.products && company.products[0]) || null,
        products: company.products || [],
        valuationTimeline: company.valuationTimeline || [],
        revenue: company.revenue || 0,
        growthRate: company.growthRate || 0,
        customers: company.customers || 0,
        fundingRaised: company.fundingRaised || 0,
        visible: true,
        isVerified: (company.revenue > 0 || company.customers > 0),
        isDataPublic: company.isDataPublic !== false && (currentValuation > 0 || company.revenue > 0),
        isUserMentioned: true,
        isSearchResult: true,
        dataConfidence: (company.revenue > 0 || company.customers > 0) ? 'high' : 'medium'
      };

      console.log(`✅ Found company: ${processedCompany.name} (${processedCompany.region})`);
      
      return res.json({
        found: true,
        company: processedCompany,
        sources: searchResult.sources || ['Google Search'],
        searchedFor: companyName
      });

    } catch (searchError) {
      console.warn('Google Search failed for company:', searchError.message);
      return res.json({
        found: false,
        message: `Could not find data for "${companyName}". The search service may be temporarily unavailable.`,
        error: searchError.message
      });
    }

  } catch (error) {
    console.error('Company search error:', error.message);
    return res.status(500).json({ 
      error: 'Failed to search for company',
      message: error.message 
    });
  }
});

// Chat endpoint with Grok
app.post('/api/chat/grok', authenticateToken, async (req, res) => {
  try {
    const { message, context, conversationHistory } = req.body;
    const userId = req.user.userId;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Check rate limit for Gemini API
    const rateLimitCheck = geminiRateLimiter.checkLimit(userId);
    if (!rateLimitCheck.allowed) {
      return res.status(429).json({ 
        error: `Rate limit exceeded. You can make ${geminiRateLimiter.maxRequests} AI requests per hour. Please try again in ${rateLimitCheck.resetIn} minutes.`,
        resetIn: rateLimitCheck.resetIn
      });
    }

    // Add rate limit info to response headers
    res.setHeader('X-RateLimit-Limit', geminiRateLimiter.maxRequests);
    res.setHeader('X-RateLimit-Remaining', rateLimitCheck.remaining);

    // Build system prompt with context
    let systemPrompt = `You are Prometheus, an AI Strategic Advisor for startups and entrepreneurs. You have analyzed the user's business data and help them with strategic planning, market analysis, financial projections, growth strategies, and funding guidance.

Company Context:
- Name: ${context.company?.name || 'Unknown'}
- Description: ${context.company?.description || 'N/A'}
- Category: ${context.company?.category || 'Unknown'}
- Stage: ${context.company?.stage || 'Unknown'}
- Monthly Revenue: ₹${context.company?.monthlyRevenue || 0}
- Monthly Expenses: ₹${context.company?.expenses || 0}
- Customers: ${context.company?.customers || 0}
- Team Size: ${context.company?.teamSize || '1'}
- Funding Raised: ₹${context.company?.funding || 0}

${context.valuation ? `Valuation: ₹${(context.valuation.finalValuationINR / 10000000).toFixed(2)} Cr (${(context.valuation.finalValuationUSD / 1000000).toFixed(2)}M USD)` : ''}

${context.swot ? `SWOT Analysis:
Strengths: ${context.swot.strengths?.join(', ') || 'None identified'}
Weaknesses: ${context.swot.weaknesses?.join(', ') || 'None identified'}
Opportunities: ${context.swot.opportunities?.join(', ') || 'None identified'}
Threats: ${context.swot.threats?.join(', ') || 'None identified'}` : ''}

Your role:
1. Provide strategic, data-driven insights based on the company's actual data
2. Answer questions about valuation methodologies, scores, and metrics
3. Help with "what-if" scenarios (e.g., impact of revenue growth, team expansion)
4. Offer actionable advice for growth, funding, and competitive positioning
5. Explain SWOT analysis, market trends, and funding schemes

Keep responses concise, actionable, and personalized to ${context.company?.name || 'this business'}.`;

    // Build messages array with conversation history
    const messages = [
      { role: 'system', content: systemPrompt }
    ];

    // Add last few conversation messages for context
    if (conversationHistory && conversationHistory.length > 0) {
      conversationHistory.slice(-4).forEach(msg => {
        messages.push({
          role: msg.role === 'user' ? 'user' : 'assistant',
          content: msg.content
        });
      });
    }

    // Add current message
    messages.push({ role: 'user', content: message });

    // Use Gemini API directly (Grok is deprecated)
    try {
      // Build conversation context for Gemini
      let conversationText = systemPrompt + '\n\n';
      
      if (conversationHistory && conversationHistory.length > 0) {
        conversationHistory.slice(-3).forEach(msg => {
          conversationText += `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}\n\n`;
        });
      }
      
      conversationText += `User: ${message}\n\nAssistant:`;
      
      const geminiResponse = await callGemini(conversationText, systemPrompt);
      
      console.log('✅ Chat response from Gemini API for', context.company?.name || 'user');
      return res.json({ response: geminiResponse });
      
    } catch (geminiError) {
      console.warn('Gemini failed for chatbot:', geminiError.message);
      throw geminiError;
    }

  } catch (error) {
    console.error('AI backend failed for chatbot:', error.message);
    
    // Provide intelligent fallback response based on the question
    const { message, context } = req.body;
    const lowerMessage = message.toLowerCase();
    
    let fallbackResponse = '';
    
    // Detect question type and provide relevant fallback
    if (lowerMessage.includes('valuation') || lowerMessage.includes('worth')) {
      const val = context.valuation ? `₹${(context.valuation.finalValuationINR / 10000000).toFixed(2)} Cr` : 'not yet calculated';
      fallbackResponse = `Based on your assessment, ${context.company?.name || 'your company'} has an estimated valuation of ${val}. This uses the Berkus Method and Scorecard Method, considering factors like your team, product stage, market opportunity, and traction.`;
    } else if (lowerMessage.includes('competitive') || lowerMessage.includes('advantage')) {
      fallbackResponse = `Your key competitive advantages include: ${context.company?.uniqueValue || 'your unique value proposition'}. Focus on deepening these strengths while addressing weaknesses in ${context.swot?.weaknesses?.[0] || 'your operations'}.`;
    } else if (lowerMessage.includes('funding') || lowerMessage.includes('raise') || lowerMessage.includes('investment')) {
      const needed = context.company?.fundingNeeded || 'the required amount';
      fallbackResponse = `You're looking to raise ${needed} for ${context.company?.primaryGoal || 'your goals'}. Based on your ${context.company?.stage || 'current stage'}, consider approaching angel investors or early-stage VCs. Your valuation of ${context.valuation ? `₹${(context.valuation.finalValuationINR / 10000000).toFixed(2)} Cr` : 'TBD'} will help determine equity dilution.`;
    } else if (lowerMessage.includes('growth') || lowerMessage.includes('scale')) {
      fallbackResponse = `To scale ${context.company?.name || 'your business'}, focus on: 1) Expanding your team strategically (current size: ${context.company?.teamSize || '1'}), 2) Optimizing ${context.company?.marketingType || 'customer acquisition'}, and 3) Addressing your main challenge: ${context.company?.challenge || 'market fit'}.`;
    } else if (lowerMessage.includes('customer') || lowerMessage.includes('acquisition')) {
      const cust = context.company?.customers || 0;
      fallbackResponse = `You currently have ${cust} customers. Your acquisition strategy using ${context.company?.acquisitionStrategy || 'various channels'} is key. Focus on improving retention and word-of-mouth referrals to reduce CAC.`;
    } else if (lowerMessage.includes('risk') || lowerMessage.includes('threat')) {
      fallbackResponse = `Your primary business risk is: ${context.company?.primaryRisk || 'market uncertainty'}. Key threats from SWOT analysis include: ${context.swot?.threats?.join(', ') || 'competitive pressure'}. Mitigate these by leveraging your strengths in ${context.swot?.strengths?.[0] || 'your core competency'}.`;
    } else {
      // Generic helpful response
      fallbackResponse = `I'm currently experiencing technical difficulties with my AI backend. However, I can still help with basic questions about:

• Your valuation (${context.valuation ? `₹${(context.valuation.finalValuationINR / 10000000).toFixed(2)} Cr` : 'Complete assessment first'})
• Your ${context.company?.category || 'business'} metrics
• Strategic recommendations based on your ${context.company?.stage || 'current stage'}

Try asking about specific aspects like funding, growth strategy, or competitive positioning.`;
    }
    
    res.json({ response: fallbackResponse });
  }
});

// ============================================
// NOTES MANAGEMENT ROUTES
// ============================================

// Save a chat message to notes
app.post('/api/notes/save', authenticateToken, async (req, res) => {
  try {
    const { chatMessage, response, noteTitle, category } = req.body;
    const userId = req.user.userId;

    if (!chatMessage || !response) {
      return res.status(400).json({ error: 'Chat message and response are required' });
    }

    const note = {
      userId,
      chatMessage,
      response,
      noteTitle: noteTitle || chatMessage.substring(0, 50) + '...',
      category: category || 'General',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await notesCollection.insertOne(note);
    
    res.json({ 
      success: true, 
      noteId: result.insertedId,
      message: 'Note saved successfully' 
    });
  } catch (error) {
    console.error('Error saving note:', error);
    res.status(500).json({ error: 'Failed to save note' });
  }
});

// Get all saved notes for authenticated user
app.get('/api/notes', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { category, search, limit = 50, skip = 0 } = req.query;

    let query = { userId };
    
    // Add category filter if provided
    if (category && category !== 'all') {
      query.category = category;
    }

    // Add search filter if provided
    if (search) {
      query.$or = [
        { chatMessage: { $regex: search, $options: 'i' } },
        { response: { $regex: search, $options: 'i' } },
        { noteTitle: { $regex: search, $options: 'i' } }
      ];
    }

    const notes = await notesCollection
      .find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(skip))
      .toArray();

    const total = await notesCollection.countDocuments(query);

    res.json({ 
      notes, 
      total,
      hasMore: total > (parseInt(skip) + notes.length)
    });
  } catch (error) {
    console.error('Error fetching notes:', error);
    res.status(500).json({ error: 'Failed to fetch notes' });
  }
});

// Update a note
app.put('/api/notes/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { noteTitle, category } = req.body;
    const userId = req.user.userId;

    const updateFields = {
      updatedAt: new Date()
    };

    if (noteTitle) updateFields.noteTitle = noteTitle;
    if (category) updateFields.category = category;

    const result = await notesCollection.updateOne(
      { _id: new MongoClient.ObjectId(id), userId },
      { $set: updateFields }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ error: 'Note not found' });
    }

    res.json({ success: true, message: 'Note updated successfully' });
  } catch (error) {
    console.error('Error updating note:', error);
    res.status(500).json({ error: 'Failed to update note' });
  }
});

// Delete a note
app.delete('/api/notes/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    const { ObjectId } = await import('mongodb');
    const result = await notesCollection.deleteOne({ 
      _id: new ObjectId(id), 
      userId 
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Note not found' });
    }

    res.json({ success: true, message: 'Note deleted successfully' });
  } catch (error) {
    console.error('Error deleting note:', error);
    res.status(500).json({ error: 'Failed to delete note' });
  }
});

// Get note categories for filter dropdown
app.get('/api/notes/categories', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    const categories = await notesCollection.distinct('category', { userId });
    
    res.json({ categories });
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// =====================================================
// DAILY ACTIONS API ENDPOINTS
// =====================================================

// Generate daily actions based on 6-month goal
app.post('/api/actions/generate', authenticateToken, async (req, res) => {
  try {
    const { sixMonthGoal, productName, category, stage, currentChallenge } = req.body;
    const userId = req.user.userId;
    
    if (!sixMonthGoal) {
      return res.status(400).json({ error: '6-month goal is required' });
    }

    const prompt = `You are an expert startup advisor. Based on the following startup information, generate exactly 5 actionable daily tasks that will help the founder make progress towards their 6-month goal.

STARTUP INFORMATION:
- Product/Service: ${productName || 'Unknown'}
- Category: ${category || 'Unknown'}
- Stage: ${stage || 'Unknown'}
- Current Challenge: ${currentChallenge || 'General growth'}
- 6-Month Goal: ${sixMonthGoal}

REQUIREMENTS:
1. Generate exactly 5 specific, actionable daily tasks
2. Each task should be completable in one day
3. Tasks should directly contribute to the 6-month goal
4. Make tasks practical and measurable
5. Order by priority (most important first)

Return a JSON object with this EXACT structure:
{
  "actions": [
    {"id": 1, "text": "Task description here", "priority": "high"},
    {"id": 2, "text": "Task description here", "priority": "high"},
    {"id": 3, "text": "Task description here", "priority": "medium"},
    {"id": 4, "text": "Task description here", "priority": "medium"},
    {"id": 5, "text": "Task description here", "priority": "low"}
  ]
}

Return ONLY valid JSON, no additional text.`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.7,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 1024,
          }
        })
      }
    );

    const data = await response.json();
    let actionsText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    
    // Clean the response
    actionsText = actionsText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    
    let parsedActions;
    try {
      parsedActions = JSON.parse(actionsText);
    } catch (e) {
      // Fallback actions if parsing fails
      parsedActions = {
        actions: [
          { id: 1, text: "Review and refine your value proposition", priority: "high" },
          { id: 2, text: "Reach out to 3 potential customers for feedback", priority: "high" },
          { id: 3, text: "Analyze competitor pricing strategies", priority: "medium" },
          { id: 4, text: "Update your product roadmap", priority: "medium" },
          { id: 5, text: "Document one key process or workflow", priority: "low" }
        ]
      };
    }

    // Save to database
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const actionsDoc = {
      userId,
      date: today,
      sixMonthGoal,
      actions: parsedActions.actions.map((action, index) => ({
        id: `${Date.now()}-${index}`,
        text: action.text,
        priority: action.priority || 'medium',
        status: 'pending',
        progress: null,
        createdAt: new Date()
      })),
      createdAt: new Date()
    };

    // Upsert - update if exists for today, insert if not
    await actionsCollection.updateOne(
      { userId, date: today },
      { $set: actionsDoc },
      { upsert: true }
    );

    res.json({ success: true, actions: actionsDoc.actions });
  } catch (error) {
    console.error('Error generating actions:', error);
    res.status(500).json({ error: 'Failed to generate actions' });
  }
});

// Get today's actions
app.get('/api/actions/today', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const actionsDoc = await actionsCollection.findOne({ userId, date: today });
    
    if (!actionsDoc) {
      return res.json({ actions: [], backlog: [] });
    }

    // Get backlog items (items from previous days not marked green)
    const backlogDocs = await actionsCollection.find({
      userId,
      date: { $lt: today },
      'actions.progress': { $ne: 'green' }
    }).toArray();

    const backlog = [];
    backlogDocs.forEach(doc => {
      doc.actions.forEach(action => {
        if (action.status === 'accepted' && action.progress !== 'green') {
          backlog.push({
            ...action,
            movedToBacklogAt: doc.date
          });
        }
      });
    });

    res.json({ actions: actionsDoc.actions, backlog });
  } catch (error) {
    console.error('Error fetching actions:', error);
    res.status(500).json({ error: 'Failed to fetch actions' });
  }
});

// Update action status (accept/reject)
app.put('/api/actions/:actionId/status', authenticateToken, async (req, res) => {
  try {
    const { actionId } = req.params;
    const { status, rejectionReason } = req.body;
    const userId = req.user.userId;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const updateData = { 'actions.$.status': status };
    if (rejectionReason) {
      updateData['actions.$.rejectionReason'] = rejectionReason;
    }

    await actionsCollection.updateOne(
      { userId, date: today, 'actions.id': actionId },
      { $set: updateData }
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Error updating action status:', error);
    res.status(500).json({ error: 'Failed to update action' });
  }
});

// Update action progress (red/amber/green)
app.put('/api/actions/:actionId/progress', authenticateToken, async (req, res) => {
  try {
    const { actionId } = req.params;
    const { progress } = req.body;
    const userId = req.user.userId;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    await actionsCollection.updateOne(
      { userId, date: today, 'actions.id': actionId },
      { $set: { 'actions.$.progress': progress } }
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Error updating action progress:', error);
    res.status(500).json({ error: 'Failed to update progress' });
  }
});

// Store rejection feedback in user memory
app.post('/api/actions/feedback', authenticateToken, async (req, res) => {
  try {
    const { actionText, rejectionReason } = req.body;
    const userId = req.user.userId;

    // Store feedback in user's memory for future action generation
    await usersCollection.updateOne(
      { _id: new ObjectId(userId) },
      { 
        $push: { 
          actionFeedback: {
            actionText,
            rejectionReason,
            createdAt: new Date()
          }
        }
      }
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Error storing feedback:', error);
    res.status(500).json({ error: 'Failed to store feedback' });
  }
});

// =====================================================
// NEWS API ENDPOINTS
// =====================================================

// Fetch news related to product/industry using Gemini with grounding
app.get('/api/news', authenticateToken, async (req, res) => {
  try {
    const { query, industry } = req.query;
    
    // Build industry-specific search context
    const searchContext = industry || query || 'technology startups business';
    
    // Use Gemini with Google Search grounding for real, current news
    const prompt = `You are a news curator. Search for and provide 6 REAL, CURRENT news articles from the past 7 days related to: "${searchContext}".

Focus on trusted sources like:
- Reuters, Bloomberg, CNBC, Financial Times
- TechCrunch, The Verge, Wired, Ars Technica
- Economic Times, Business Standard, Mint (for India)
- Wall Street Journal, Forbes, Fortune

For EACH article, provide:
1. The EXACT real headline (not paraphrased)
2. A brief 2-sentence summary of the article
3. The actual source publication name
4. The real URL to the article (must be a valid, working URL)
5. An image URL if available (thumbnail/featured image from the article)
6. Published time (e.g., "2 hours ago", "Yesterday", "Dec 10, 2024")

Return as JSON array:
{
  "news": [
    {
      "title": "Exact headline from the article",
      "summary": "Brief 2-sentence summary of the key points.",
      "source": "Reuters",
      "url": "https://www.reuters.com/actual-article-url",
      "imageUrl": "https://example.com/image.jpg",
      "timeAgo": "3 hours ago",
      "publishedAt": "2024-12-12T10:30:00Z"
    }
  ]
}

IMPORTANT: 
- Only include REAL articles with WORKING URLs
- URLs must be actual article links, not homepage links
- Prioritize breaking news and significant developments
- Include diverse sources for balanced coverage

Return ONLY valid JSON, no markdown.`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 2048,
          },
          tools: [{
            google_search: {}
          }]
        })
      }
    );

    const data = await response.json();
    let newsText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    newsText = newsText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    let parsedNews;
    try {
      parsedNews = JSON.parse(newsText);
      // Ensure all items have required fields
      if (parsedNews.news && Array.isArray(parsedNews.news)) {
        parsedNews.news = parsedNews.news.map(item => ({
          title: item.title || 'News Update',
          summary: item.summary || item.title || '',
          source: item.source || 'News',
          url: item.url || '#',
          imageUrl: item.imageUrl || `https://picsum.photos/seed/${Math.random().toString(36).substr(2, 9)}/400/250`,
          timeAgo: item.timeAgo || 'Recently',
          publishedAt: item.publishedAt || new Date().toISOString()
        }));
      }
    } catch (e) {
      console.error('News parsing error:', e);
      // Fallback with placeholder news
      parsedNews = {
        news: [
          { 
            title: "Tech Industry Sees Renewed Investment Interest in AI Startups", 
            summary: "Venture capital firms are increasingly focusing on artificial intelligence companies, with funding reaching new highs in Q4 2024.",
            source: "TechCrunch", 
            url: "https://techcrunch.com/",
            imageUrl: "https://picsum.photos/seed/tech1/400/250",
            timeAgo: "2 hours ago" 
          },
          { 
            title: "Global Markets Rally on Economic Optimism", 
            summary: "Stock markets worldwide showed strong gains as investors react positively to economic indicators and central bank policies.",
            source: "Reuters", 
            url: "https://www.reuters.com/",
            imageUrl: "https://picsum.photos/seed/market1/400/250",
            timeAgo: "4 hours ago" 
          },
          { 
            title: "New Regulations Set to Transform Digital Payments Landscape", 
            summary: "Government announces comprehensive framework for digital payment security and consumer protection measures.",
            source: "Economic Times", 
            url: "https://economictimes.indiatimes.com/",
            imageUrl: "https://picsum.photos/seed/payment1/400/250",
            timeAgo: "6 hours ago" 
          },
          { 
            title: "Startups Embrace Sustainable Business Practices", 
            summary: "Growing number of emerging companies are integrating ESG principles into their core business strategies.",
            source: "Forbes", 
            url: "https://www.forbes.com/",
            imageUrl: "https://picsum.photos/seed/startup1/400/250",
            timeAgo: "Yesterday" 
          },
          { 
            title: "Cloud Computing Market Expected to Double by 2027", 
            summary: "Industry analysts predict significant growth in cloud services as enterprises accelerate digital transformation initiatives.",
            source: "Bloomberg", 
            url: "https://www.bloomberg.com/",
            imageUrl: "https://picsum.photos/seed/cloud1/400/250",
            timeAgo: "Yesterday" 
          },
          { 
            title: "Innovation Hub Opens to Support Local Entrepreneurs", 
            summary: "New technology incubator aims to provide resources and mentorship for early-stage founders in the region.",
            source: "YourStory", 
            url: "https://yourstory.com/",
            imageUrl: "https://picsum.photos/seed/hub1/400/250",
            timeAgo: "2 days ago" 
          }
        ]
      };
    }

    res.json(parsedNews);
  } catch (error) {
    console.error('Error fetching news:', error);
    res.status(500).json({ error: 'Failed to fetch news' });
  }
});

// Catch-all route: Serve frontend for all non-API routes (MUST be last!)
if (process.env.NODE_ENV === 'production') {
  app.get('*', (req, res) => {
    const indexPath = path.join(__dirname, '../build/index.html');
    console.log(`📄 Serving index.html for: ${req.path}`);
    res.sendFile(indexPath, (err) => {
      if (err) {
        console.error('❌ Error serving index.html:', err);
        res.status(500).send('Error loading application');
      }
    });
  });
}

// Start server
connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    if (process.env.NODE_ENV === 'production') {
      console.log(`✅ Static file serving enabled`);
      console.log(`📂 Serving from: ${path.join(__dirname, '../build')}`);
    }
  });
}).catch((error) => {
  console.error('❌ Failed to start server:', error);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});
