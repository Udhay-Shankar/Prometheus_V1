import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { MongoClient } from 'mongodb';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

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
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'AIzaSyDcY9141cL410LdqNDlgo8zonwmT4IAQ9Y';
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'your-refresh-secret-key-change-in-production';

let db;
let usersCollection;
let ddqCollection;

// Connect to MongoDB
async function connectDB() {
  try {
    const client = new MongoClient(MONGO_URI);
    await client.connect();
    db = client.db('ceo-insight-engine');
    usersCollection = db.collection('users');
    ddqCollection = db.collection('ddq-responses');
    
    // Create unique index on email field to prevent duplicate signups
    await usersCollection.createIndex({ email: 1 }, { unique: true });
    
    console.log('✅ Connected to MongoDB Atlas');
    console.log('✅ Email uniqueness index created');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
}

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
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${GEMINI_API_KEY}`, {
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
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const data = await response.json();
    return data.candidates[0].content.parts[0].text;
  } catch (error) {
    console.error('Gemini API error:', error);
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
    const { scores, companyStage, revenue, fundingNeeded, category, totalInvestment, monthlyExpenses, customerCount } = req.body;

    // Industry-specific revenue multiples (based on 2024-25 data)
    const industryMultiples = {
      'SaaS': { min: 5, max: 15, avg: 10 },
      'Mobile App': { min: 2, max: 3, avg: 2.5 },
      'E-commerce': { min: 1, max: 5, avg: 3 },
      'Marketplace': { min: 2, max: 6, avg: 4 },
      'AI/ML': { min: 8, max: 15, avg: 11.5 },
      'Hardware': { min: 2.7, max: 4.2, avg: 3.5 },
      'Consulting': { min: 2.2, max: 4.4, avg: 3.3 },
      'FMCG': { min: 1.5, max: 2.5, avg: 2 },
      'Other': { min: 2, max: 4, avg: 3 }
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
      
      // Adjust multiple based on stage and growth potential
      let adjustedMultiple = categoryMultiple.avg;
      if (companyStage === 'Growing' || companyStage === 'Established') {
        adjustedMultiple = categoryMultiple.max * 0.9; // Use higher multiple for growth stage
      } else if (companyStage === 'Launched') {
        adjustedMultiple = categoryMultiple.avg;
      } else {
        adjustedMultiple = categoryMultiple.min * 1.2; // Lower for early stage
      }
      
      // Further adjust based on scores
      const avgScore = (scores.teamScore + scores.productScore + scores.marketScore + scores.salesScore + scores.financingScore + scores.competitiveScore) / 6;
      if (avgScore >= 4.5) adjustedMultiple *= 1.3;
      else if (avgScore >= 4.0) adjustedMultiple *= 1.15;
      else if (avgScore >= 3.5) adjustedMultiple *= 1.0;
      else if (avgScore >= 3.0) adjustedMultiple *= 0.9;
      else adjustedMultiple *= 0.75;
      
      revenueMultipleValuation = annualRevenue * adjustedMultiple;
    }

    // Final valuation logic based on stage and revenue
    let finalValuationINR;
    let valuationMethod;
    
    if (revenue && revenue > 0 && (companyStage === 'Growing' || companyStage === 'Established' || companyStage === 'Launched')) {
      // Use revenue multiple method with scorecard adjustment
      finalValuationINR = (revenueMultipleValuation * 0.6 + scorecardValuation * 0.4);
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
    res.json({
      strengths: [
        `${companyData.stage} stage ${industry} company with operational foundation`,
        `Team expertise in ${industry} domain`,
        companyData.hasRevenue ? 'Proven revenue generation capability' : 'Early product development focus',
        `Product addressing ${companyData.targetCustomer || 'target market'} needs`
      ],
      weaknesses: [
        companyData.hasRevenue ? 'Revenue scale still developing' : 'Pre-revenue stage with market validation needed',
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
    const { companyProfile, category, stage, totalInvestment, location } = req.body;

    // Personalized eligibility logic
    const isEligibleForSISFS = totalInvestment < 5000000; // < ₹50L
    const isEducationTech = category === 'Education' || category === 'E-learning';
    const isStateBased = location && location !== 'Pan India';

    const prompt = `As an expert on Indian Government funding schemes for startups, analyze eligibility for a ${category} startup:

Company Profile:
- Category: ${category}
- Stage: ${stage}
- Total Investment Needed: ₹${totalInvestment}
- Location: ${location || 'Pan India'}
- Description: ${companyProfile}

Provide recommendations in JSON format with eligibility status:
{
  "centralSchemes": [
    {
      "name": "scheme name",
      "amount": "funding amount",
      "eligibility": "eligibility criteria",
      "benefits": "key benefits",
      "eligible": true/false,
      "eligibilityStatus": "eligible" or "partial" or "not-eligible"
    }
  ],
  "stateSchemes": [similar structure],
  "priority": "recommended priority scheme with reasoning"
}

Focus on schemes like SISFS, CGSS, GENESIS, Ed-AII (for education), state-level funds, and IP reimbursement programs. Mark eligibilityStatus as "eligible" (green) if all criteria met, "partial" (amber) if some criteria met, "not-eligible" (grey) otherwise.`;

    // Use Gemini API directly (Grok deprecated)
    try {
      const systemContext = 'You are an expert on Indian Government funding schemes for startups with detailed knowledge of eligibility criteria. Return ONLY valid JSON, no markdown.';
      const geminiResponse = await callGemini(prompt, systemContext);
      
      // Clean and parse
      let content = geminiResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const schemes = JSON.parse(content);
      
      console.log('✅ Funding schemes from Gemini API for', category);
      return res.json(schemes);
      
    } catch (geminiError) {
      console.warn('Gemini failed for funding schemes:', geminiError.message);
      throw geminiError;
    }

  } catch (error) {
    console.error('Funding schemes analysis error:', error);
    
    // Return personalized mock data on error
    const { category, stage, totalInvestment, location } = req.body;
    const isEligibleForSISFS = totalInvestment < 5000000;
    const isEducationTech = category === 'Education' || category === 'E-learning';
    
    res.json({
      centralSchemes: [
        {
          name: 'Startup India Seed Fund Scheme (SISFS)',
          amount: 'Up to ₹50 Lakhs',
          eligibility: 'DPIIT recognized startups, incorporated < 2 years, working on innovative products',
          benefits: 'Validation of proof of concept, prototype development, product trials, market entry',
          eligible: isEligibleForSISFS,
          eligibilityStatus: isEligibleForSISFS ? 'eligible' : 'partial'
        },
        {
          name: 'Credit Guarantee Scheme for Startups (CGSS)',
          amount: 'Up to ₹10 Crores',
          eligibility: 'DPIIT recognized startups, valid business model, revenue generation potential',
          benefits: 'Collateral-free credit guarantee, easier access to working capital loans',
          eligible: stage === 'Growing' || stage === 'Established',
          eligibilityStatus: (stage === 'Growing' || stage === 'Established') ? 'eligible' : 'partial'
        }
      ],
      stateSchemes: location ? [{
        name: `${location} Startup Fund`,
        amount: 'Up to ₹25 Lakhs',
        eligibility: `State-registered startups in ${location}`,
        benefits: 'Seed funding, mentorship, incubation support',
        eligible: true,
        eligibilityStatus: 'eligible'
      }] : [],
      priority: 'SISFS is recommended as primary scheme due to its comprehensive support for early-stage startups with prototype development and market validation needs.'
    });
  }
});

// Market Trends & Competitor Analysis endpoint
app.post('/api/analysis/competitors', authenticateToken, async (req, res) => {
  try {
    const { category, stage, revenue } = req.body;

    const prompt = `As a Market Research Analyst, identify 5 REAL competitors in the ${category} industry for a ${stage} stage startup with monthly revenue of ₹${revenue || 0}.

Requirements:
- Provide ONLY 5 competitors
- Start with the NEXT ACHIEVABLE stage competitor (closest to user's current stage)
- Progress to mid-level competitors
- End with the SUMMIT/BIG COMPANY (industry leader like Google, Microsoft, Amazon equivalent in this space)
- Use REAL company names and data
- Focus on companies relevant to ${category}

Return ONLY valid JSON (no markdown, no code blocks):
{
  "competitors": [
    {
      "name": "actual company name",
      "category": "${category}",
      "stage": "funding stage (Seed/Series A/Series B/Series C/Public)",
      "currentValuation": current_valuation_in_rupees,
      "earlyValuation": early_stage_valuation_in_rupees,
      "growthRate": percentage_growth,
      "revenue": annual_revenue_in_rupees,
      "customers": customer_count,
      "fundingRaised": total_funding_in_rupees,
      "investments": ["investor1 - $XM", "investor2 - $XM"],
      "products": ["product1", "product2", "product3"],
      "visible": true
    }
  ]
}

Order: Next Achievable → Mid-tier → Mid-tier → Established → Summit/Big Company`;

    let analysis;
    
    // Use Gemini API directly (Grok deprecated)
    try {
      const systemContext = 'You are a Market Research Analyst with expertise in competitive analysis and startup ecosystems. Return ONLY valid JSON, no markdown.';
      const geminiResponse = await callGemini(prompt, systemContext);
      
      // Clean and parse response
      let content = geminiResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      analysis = JSON.parse(content);
      
      console.log('✅ Competitors from Gemini API for', category);
      return res.json(analysis);
      
    } catch (geminiError) {
      console.warn('Gemini failed for competitors:', geminiError.message);
      throw geminiError;
    }

  } catch (error) {
    console.error('Competitor analysis error:', error.message);
    
    // Return smart mock data based on category
    const { category, stage } = req.body;
    
    // Category-specific competitor mapping
    const categoryCompetitors = {
      'Marketplace': [
        { name: 'Dunzo', stage: 'Series F', valuation: 23000000000, early: 800000000, growth: 420, revenue: 35000000, customers: 3000000 },
        { name: 'Meesho', stage: 'Series F', valuation: 49000000000, early: 2000000000, growth: 500, revenue: 55000000, customers: 13000000 },
        { name: 'BigBasket', stage: 'Acquired', valuation: 200000000000, early: 5000000000, growth: 450, revenue: 1800000000, customers: 20000000 },
        { name: 'Zomato', stage: 'Public', valuation: 650000000000, early: 20000000000, growth: 480, revenue: 4800000000, customers: 80000000 },
        { name: 'Swiggy', stage: 'Series J', valuation: 1050000000000, early: 25000000000, growth: 520, revenue: 6500000000, customers: 120000000 }
      ],
      'SaaS': [
        { name: 'Freshworks', stage: 'Public', valuation: 350000000000, early: 10000000000, growth: 450, revenue: 500000000, customers: 50000 },
        { name: 'Chargebee', stage: 'Series G', valuation: 145000000000, early: 5000000000, growth: 380, revenue: 80000000, customers: 18000 },
        { name: 'Zoho', stage: 'Private/Profitable', valuation: 250000000000, early: 2000000000, growth: 400, revenue: 350000000, customers: 80000 },
        { name: 'Postman', stage: 'Series D', valuation: 58000000000, early: 3500000000, growth: 420, revenue: 45000000, customers: 25000 },
        { name: 'Salesforce', stage: 'Public', valuation: 20000000000000, early: 50000000000, growth: 350, revenue: 3100000000000, customers: 150000 }
      ],
      'E-commerce': [
        { name: 'Meesho', stage: 'Series F', valuation: 49000000000, early: 2000000000, growth: 500, revenue: 35000000, customers: 13000000 },
        { name: 'Snapdeal', stage: 'Series K', valuation: 65000000000, early: 5000000000, growth: 280, revenue: 120000000, customers: 50000000 },
        { name: 'Shopify', stage: 'Public', valuation: 8000000000000, early: 100000000000, growth: 320, revenue: 580000000000, customers: 4200000 },
        { name: 'Flipkart', stage: 'Acquired', valuation: 2000000000000, early: 50000000000, growth: 450, revenue: 850000000000, customers: 450000000 },
        { name: 'Amazon India', stage: 'Public', valuation: 15000000000000, early: 500000000000, growth: 380, revenue: 2500000000000, customers: 500000000 }
      ],
      'FinTech': [
        { name: 'Razorpay', stage: 'Series F', valuation: 75000000000, early: 5000000000, growth: 480, revenue: 95000000, customers: 8000000 },
        { name: 'Paytm', stage: 'Public', valuation: 450000000000, early: 20000000000, growth: 420, revenue: 250000000, customers: 350000000 },
        { name: 'PhonePe', stage: 'Series E', valuation: 850000000000, early: 15000000000, growth: 520, revenue: 180000000, customers: 450000000 },
        { name: 'CRED', stage: 'Series F', valuation: 66000000000, early: 8000000000, growth: 400, revenue: 22000000, customers: 9000000 },
        { name: 'PayPal', stage: 'Public', valuation: 7500000000000, early: 150000000000, growth: 350, revenue: 2750000000000, customers: 435000000 }
      ],
      'EdTech': [
        { name: 'Unacademy', stage: 'Series H', valuation: 37000000000, early: 3000000000, growth: 390, revenue: 28000000, customers: 50000000 },
        { name: 'UpGrad', stage: 'Series E', valuation: 28000000000, early: 2500000000, growth: 360, revenue: 35000000, customers: 4000000 },
        { name: 'Byju\'s', stage: 'Series F', valuation: 220000000000, early: 10000000000, growth: 480, revenue: 120000000, customers: 150000000 },
        { name: 'Coursera', stage: 'Public', valuation: 350000000000, early: 15000000000, growth: 420, revenue: 200000000, customers: 118000000 },
        { name: 'Udemy', stage: 'Public', valuation: 280000000000, early: 12000000000, growth: 400, revenue: 150000000, customers: 62000000 }
      ],
      'HealthTech': [
        { name: 'Practo', stage: 'Series E', valuation: 19000000000, early: 2000000000, growth: 340, revenue: 18000000, customers: 30000000 },
        { name: 'PharmEasy', stage: 'Series F', valuation: 58000000000, early: 5000000000, growth: 410, revenue: 55000000, customers: 15000000 },
        { name: '1mg', stage: 'Acquired', valuation: 16500000000, early: 1500000000, growth: 380, revenue: 25000000, customers: 20000000 },
        { name: 'Teladoc', stage: 'Public', valuation: 850000000000, early: 50000000000, growth: 360, revenue: 250000000, customers: 54000000 },
        { name: 'Zocdoc', stage: 'Series D', valuation: 18000000000, early: 3000000000, growth: 320, revenue: 12000000, customers: 8000000 }
      ]
    };

    // Get competitors for this category or use SaaS as default
    const competitors = categoryCompetitors[category] || categoryCompetitors['SaaS'];
    
    // Select 5 competitors
    const selectedCompetitors = competitors.slice(0, 5).map(comp => ({
      name: comp.name,
      category: category || 'SaaS',
      stage: comp.stage,
      currentValuation: comp.valuation,
      earlyValuation: comp.early,
      growthRate: comp.growth,
      revenue: comp.revenue,
      customers: comp.customers,
      fundingRaised: comp.early,
      investments: ['Series Funding - Multiple Rounds'],
      products: [`${comp.name} Platform`, `${comp.name} Analytics`, `${comp.name} API`],
      visible: true
    }));

    console.log(`Returning ${selectedCompetitors.length} competitors for ${category}`);
    res.json({ competitors: selectedCompetitors });
  }
});

// Chat endpoint with Grok
app.post('/api/chat/grok', authenticateToken, async (req, res) => {
  try {
    const { message, context, conversationHistory } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

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
