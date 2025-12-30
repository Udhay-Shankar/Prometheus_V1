import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { MongoClient, ObjectId } from 'mongodb';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import cluster from 'node:cluster';
import os from 'node:os';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import mongoSanitize from 'express-mongo-sanitize';
import hpp from 'hpp';
import validator from 'validator';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env file from the server directory
dotenv.config({ path: path.join(__dirname, '.env') });

const app = express();
const PORT = process.env.PORT || 3001;

// ============================================
// SECURITY MIDDLEWARE
// ============================================

// Security HTTP headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      connectSrc: ["'self'", "https://generativelanguage.googleapis.com", "https://api.x.ai"],
    },
  },
  crossOriginEmbedderPolicy: false, // Allow embedding for development
}));

// CORS configuration - more restrictive
const allowedOrigins = new Set([
  'http://localhost:5173', 
  'http://localhost:5174', 
  'http://localhost:5175', 
  'http://localhost:5176',
  'https://prometheus-v1.onrender.com',
  'https://prometheus-v1-1.onrender.com',
  'https://prometheus-frontend.onrender.com'
]);

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    
    // In production, allow same-origin requests (no CORS needed for same domain)
    if (process.env.NODE_ENV === 'production') {
      // Allow all onrender.com subdomains
      if (/^https:\/\/[\w-]+\.onrender\.com$/.test(origin)) {
        return callback(null, true);
      }
    }
    
    // Check exact match or Vercel deployment pattern
    if (allowedOrigins.has(origin) || /^https:\/\/[\w-]+\.vercel\.app$/.test(origin)) {
      return callback(null, true);
    }
    
    return callback(new Error('Not allowed by CORS'), false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Request body size limit (increased for chat context)
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// NoSQL injection sanitization
app.use(mongoSanitize({
  replaceWith: '_',
  onSanitize: ({ req, key }) => {
    console.warn(`🛡️ Sanitized potential NoSQL injection in ${key}`);
  }
}));

// HTTP Parameter Pollution protection
app.use(hpp());

// General rate limiter for all requests - INCREASED FOR DEMO/PRESENTATION
// Rate limit for 10 TPS = 600 req/min, set to 1200 for buffer
const generalLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute window
  max: 1200, // 1200 requests per minute (supports 20 TPS with buffer)
  message: { error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', generalLimiter);

// Auth rate limiter - increased for testing (10 TPS = 600/min auth)
const authLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute window
  max: 300, // 300 auth requests per minute (supports batch testing)
  message: { error: 'Too many login attempts. Please try again after 1 minute.' },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false, // Count all requests for testing
});

// ============================================
// VALIDATION HELPERS
// ============================================

// Password validation: min 8 chars, uppercase, lowercase, special char
function validatePassword(password) {
  const errors = [];
  
  if (!password || password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>?]/.test(password)) {
    errors.push('Password must contain at least one special character (!@#$%^&*...)');
  }
  if (!/\d/.test(password)) {
    errors.push('Password must contain at least one number');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

// Email validation
function validateEmail(email) {
  if (!email) return { valid: false, error: 'Email is required' };
  
  // Use validator library for robust email validation
  if (!validator.isEmail(email)) {
    return { valid: false, error: 'Please enter a valid email address' };
  }
  
  // Additional checks for common fake domains
  const disposableDomains = ['tempmail.com', 'throwaway.com', 'mailinator.com', 'guerrillamail.com', 'fakeinbox.com'];
  const domain = email.split('@')[1]?.toLowerCase();
  if (disposableDomains.includes(domain)) {
    return { valid: false, error: 'Disposable email addresses are not allowed' };
  }
  
  return { valid: true };
}

// Sanitize string input (XSS prevention)
function sanitizeInput(input) {
  if (typeof input !== 'string') return input;
  return validator.escape(validator.trim(input));
}

// Validate MongoDB ObjectId
function isValidObjectId(id) {
  if (!id) return false;
  try {
    return ObjectId.isValid(id) && new ObjectId(id).toString() === id;
  } catch {
    return false;
  }
}

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
    message: '🚀 Singularity CEO Insight Engine API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    endpoints: {
      auth: ['/api/auth/signup', '/api/auth/login', '/api/auth/refresh'],
      assessment: ['/api/ddq/submit', '/api/ddq/latest'],
      analysis: ['/api/analysis/swot', '/api/analysis/funding', '/api/analysis/competitors'],
      chat: ['/api/chat/grok'],
      infinity: ['/api/infinity/stats']
    }
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ============================================
// INFINITY STATS API
// ============================================

// Helper function to fetch InFinity user data by email
async function fetchInfinityUserByEmail(email) {
  const INFINITY_API_URL = process.env.INFINITY_API_URL || 'https://strat-mu-finagent.onrender.com';
  const INFINITY_API_KEY = process.env.INFINITY_API_KEY;

  if (!INFINITY_API_KEY) {
    console.log('⚠️ InFinity API key not configured');
    return null;
  }

  try {
    const encodedEmail = encodeURIComponent(email);
    console.log(`📊 Looking up InFinity user by email: ${email}`);

    // Try to fetch stats using email as identifier
    const response = await fetch(
      `${INFINITY_API_URL}/api/stats/summary/by-email/${encodedEmail}`,
      {
        headers: {
          'x-api-key': INFINITY_API_KEY,
          'Content-Type': 'application/json'
        }
      }
    );

    if (response.ok) {
      const result = await response.json();
      console.log('✅ InFinity user found by email');
      return result;
    }

    // Fallback: try the public stats endpoint with email
    const fallbackResponse = await fetch(
      `${INFINITY_API_URL}/api/stats/summary/public/${encodedEmail}`,
      {
        headers: {
          'x-api-key': INFINITY_API_KEY
        }
      }
    );

    if (fallbackResponse.ok) {
      const result = await fallbackResponse.json();
      console.log('✅ InFinity user found via public endpoint');
      return result;
    }

    console.log('⚠️ User not found in InFinity DB');
    return null;
  } catch (error) {
    console.error('❌ Error fetching InFinity user:', error);
    return null;
  }
}

// Fetch InFinity stats for a user by userId or email
app.get('/api/infinity/stats/:identifier', async (req, res) => {
  try {
    const { identifier } = req.params;
    const INFINITY_API_URL = process.env.INFINITY_API_URL || 'https://strat-mu-finagent.onrender.com';
    const INFINITY_API_KEY = process.env.INFINITY_API_KEY;

    if (!INFINITY_API_KEY) {
      return res.status(500).json({ error: 'InFinity API key not configured' });
    }

    // Check if identifier looks like an email
    const isEmail = identifier.includes('@') || identifier.includes('%40');
    const decodedIdentifier = decodeURIComponent(identifier);
    
    console.log(`📊 Fetching InFinity stats for ${isEmail ? 'email' : 'userId'}: ${decodedIdentifier}`);

    // Use email-based lookup if identifier is an email
    const endpoint = isEmail 
      ? `${INFINITY_API_URL}/api/stats/summary/by-email/${encodeURIComponent(decodedIdentifier)}`
      : `${INFINITY_API_URL}/api/stats/summary/public/${identifier}`;

    const response = await fetch(endpoint, {
      headers: {
        'x-api-key': INFINITY_API_KEY
      }
    });

    if (!response.ok) {
      // If email lookup fails, try public endpoint as fallback
      if (isEmail) {
        const fallbackResponse = await fetch(
          `${INFINITY_API_URL}/api/stats/summary/public/${encodeURIComponent(decodedIdentifier)}`,
          {
            headers: {
              'x-api-key': INFINITY_API_KEY
            }
          }
        );
        
        if (fallbackResponse.ok) {
          const result = await fallbackResponse.json();
          console.log('✅ InFinity stats fetched via fallback');
          return res.json(result);
        }
      }
      
      console.error(`❌ InFinity API error: ${response.status}`);
      return res.status(response.status).json({ 
        error: 'Failed to fetch InFinity stats',
        status: response.status 
      });
    }

    const result = await response.json();
    console.log('✅ InFinity stats fetched successfully');
    res.json(result);

  } catch (error) {
    console.error('❌ InFinity API error:', error);
    res.status(500).json({ error: 'Failed to fetch InFinity stats' });
  }
});

// Lookup user in InFinity DB by email (for data population)
app.post('/api/infinity/lookup', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const infinityData = await fetchInfinityUserByEmail(email);
    
    if (infinityData) {
      res.json({
        success: true,
        found: true,
        data: infinityData
      });
    } else {
      res.json({
        success: true,
        found: false,
        message: 'User not found in InFinity DB'
      });
    }
  } catch (error) {
    console.error('❌ InFinity lookup error:', error);
    res.status(500).json({ error: 'Failed to lookup user in InFinity' });
  }
});

// Get InFinity stats for authenticated user (uses email as primary identifier)
app.get('/api/infinity/stats', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const INFINITY_API_KEY = process.env.INFINITY_API_KEY;

    if (!INFINITY_API_KEY) {
      return res.status(500).json({ error: 'InFinity API key not configured' });
    }

    // Fetch user from database to get their email (EMAIL is the PRIMARY identifier for InFinity)
    const user = await usersCollection.findOne({ _id: new ObjectId(userId) });
    if (!user || !user.email) {
      return res.status(400).json({ error: 'User email not found' });
    }
    
    // EMAIL is the primary identifier for InFinity DB lookup
    const userEmail = user.email;
    console.log(`📊 Fetching InFinity stats using email as primary identifier: ${userEmail}`);

    // Use the helper function to fetch by email
    const infinityData = await fetchInfinityUserByEmail(userEmail);
    
    if (infinityData && infinityData.success !== false) {
      console.log('✅ InFinity stats fetched successfully via email lookup');
      
      // If we got InFinity data and it has additional user info, sync it locally
      if (infinityData.data && infinityData.data.companyName && !user.companyName) {
        // Update local user record with InFinity data
        await usersCollection.updateOne(
          { _id: new ObjectId(userId) },
          { 
            $set: { 
              infinityLinked: true,
              infinityData: {
                lastSynced: new Date(),
                companyName: infinityData.data.companyName || user.companyName,
                totalRevenue: infinityData.data.totalRevenue || 0,
                totalInvestment: infinityData.data.totalInvestment || 0
              }
            }
          }
        );
        console.log('✅ Local user synced with InFinity data');
      }
      
      return res.json({
        success: true,
        data: infinityData.data || infinityData,
        linkedByEmail: userEmail
      });
    }

    // Return default data if InFinity lookup fails or user doesn't exist there
    console.log('⚠️ User not found in InFinity DB, returning default data');
    return res.json({
      success: true,
      data: {
        totalRevenue: 0,
        totalInvestment: 0,
        monthlyRevenue: 0,
        monthlyBurn: 0,
        runway: 0,
        status: 'Not Connected',
        revenueGrowth: 0
      },
      linkedByEmail: null,
      message: 'User not found in InFinity - connect your InFinity account with same email'
    });

  } catch (error) {
    console.error('❌ InFinity API error:', error);
    res.status(500).json({ error: 'Failed to fetch InFinity stats' });
  }
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

// Connect to MongoDB with optimized connection pool
async function connectDB() {
  try {
    const client = new MongoClient(MONGO_URI, {
      maxPoolSize: 100,           // Increased from default 10
      minPoolSize: 10,            // Keep minimum connections ready
      maxIdleTimeMS: 30000,       // Close idle connections after 30s
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      compressors: ['zlib'],      // Enable compression
    });
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
  maxRequests: 500, // Max requests per user per window (high for testing 25 products)
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

// Helper function to call Gemini API with timeout and retry
async function callGemini(prompt, systemContext = '', retries = 2) {
  const TIMEOUT_MS = 30000; // 30 second timeout
  
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
      
      console.log(`🤖 Gemini API call attempt ${attempt}/${retries}...`);
      
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        signal: controller.signal,
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

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error(`❌ Gemini API Error (attempt ${attempt}):`, response.status, errorData);
        
        // If rate limited or server error, retry
        if ((response.status === 429 || response.status >= 500) && attempt < retries) {
          console.log(`⏳ Retrying in ${attempt * 2} seconds...`);
          await new Promise(r => setTimeout(r, attempt * 2000));
          continue;
        }
        throw new Error(`Gemini API error: ${response.status} - ${JSON.stringify(errorData)}`);
      }

      const data = await response.json();
      if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
        console.error('❌ Invalid Gemini response structure:', JSON.stringify(data));
        throw new Error('Invalid Gemini API response structure');
      }
      
      console.log(`✅ Gemini API response received (attempt ${attempt})`);
      return data.candidates[0].content.parts[0].text;
      
    } catch (error) {
      if (error.name === 'AbortError') {
        console.error(`❌ Gemini API timeout (attempt ${attempt}/${retries})`);
        if (attempt < retries) {
          console.log(`⏳ Retrying...`);
          continue;
        }
        throw new Error('Gemini API timeout - please try again');
      }
      
      console.error(`Gemini API error (attempt ${attempt}):`, error.message);
      if (attempt >= retries) throw error;
    }
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

    // Validate email format
    const emailValidation = validateEmail(email);
    if (!emailValidation.valid) {
      return res.status(400).json({ error: emailValidation.error });
    }

    // Validate password strength
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      return res.status(400).json({ 
        error: 'Password does not meet requirements',
        details: passwordValidation.errors 
      });
    }

    // Sanitize inputs
    const sanitizedName = sanitizeInput(name);
    const sanitizedCompanyName = sanitizeInput(companyName);
    const sanitizedEmail = validator.normalizeEmail(email) || email.toLowerCase().trim();

    // Check if user exists locally
    const existingUser = await usersCollection.findOne({ email: sanitizedEmail });
    if (existingUser) {
      return res.status(409).json({ error: 'Account already exists with this email' });
    }

    // ============================================
    // CHECK INFINITY DB FOR EXISTING USER BY EMAIL (Primary Identifier)
    // If user exists in InFinity, pre-populate their data
    // ============================================
    let infinityData = null;
    let infinityLinked = false;
    let infinityCompanyName = sanitizedCompanyName;
    
    try {
      console.log(`🔍 Checking InFinity DB for new signup email: ${sanitizedEmail}`);
      infinityData = await fetchInfinityUserByEmail(sanitizedEmail);
      
      if (infinityData && (infinityData.success !== false || infinityData.data)) {
        infinityLinked = true;
        console.log('✅ Existing user found in InFinity DB, will link account');
        
        const infinityUserData = infinityData.data || infinityData;
        // Use InFinity company name if user didn't provide one or it's different
        if (infinityUserData.companyName) {
          infinityCompanyName = infinityUserData.companyName;
        }
      }
    } catch (infinityError) {
      console.log('⚠️ Could not check InFinity DB (non-blocking):', infinityError.message);
    }

    // Hash password with higher cost factor for security
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create user with sanitized inputs and InFinity data if available
    const user = {
      email: sanitizedEmail,
      password: hashedPassword,
      name: sanitizedName,
      companyName: infinityCompanyName,
      socials: {
        linkedIn: sanitizeInput(socials?.linkedIn || ''),
        website: sanitizeInput(socials?.website || ''),
        instagram: sanitizeInput(socials?.instagram || ''),
        other: sanitizeInput(socials?.other || '')
      },
      createdAt: new Date(),
      role: 'founder',
      loginAttempts: 0,
      lockUntil: null,
      // InFinity linking fields
      infinityLinked: infinityLinked,
      infinityLastSync: infinityLinked ? new Date() : null,
      infinityData: infinityLinked ? {
        totalRevenue: (infinityData?.data || infinityData)?.totalRevenue || 0,
        totalInvestment: (infinityData?.data || infinityData)?.totalInvestment || 0,
        monthlyRevenue: (infinityData?.data || infinityData)?.monthlyRevenue || 0,
        monthlyBurn: (infinityData?.data || infinityData)?.monthlyBurn || 0,
        runway: (infinityData?.data || infinityData)?.runway || 0,
        revenueGrowth: (infinityData?.data || infinityData)?.revenueGrowth || 0,
        status: (infinityData?.data || infinityData)?.status || 'Connected',
        lastSynced: new Date()
      } : null
    };

    const result = await usersCollection.insertOne(user);

    // Generate tokens
    const accessToken = jwt.sign(
      { userId: result.insertedId, email: sanitizedEmail },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    const refreshToken = jwt.sign(
      { userId: result.insertedId, email: sanitizedEmail },
      JWT_REFRESH_SECRET,
      { expiresIn: '7d' }
    );

    // Return response with InFinity link status
    res.json({
      accessToken,
      refreshToken,
      user: { 
        id: result.insertedId, 
        email: sanitizedEmail, 
        name: sanitizedName, 
        companyName: infinityCompanyName, 
        socials: user.socials,
        infinityLinked: infinityLinked,
        infinityData: infinityLinked ? user.infinityData : null
      }
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Login with rate limiting and account lockout
app.post('/api/auth/login', authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate inputs
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Normalize email
    const normalizedEmail = validator.normalizeEmail(email) || email.toLowerCase().trim();

    // Find user
    const user = await usersCollection.findOne({ email: normalizedEmail });
    if (!user) {
      // Don't reveal whether email exists (timing attack prevention)
      await new Promise(resolve => setTimeout(resolve, 100));
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Check if account is locked
    if (user.lockUntil && user.lockUntil > Date.now()) {
      const remainingTime = Math.ceil((user.lockUntil - Date.now()) / 1000 / 60);
      return res.status(423).json({ 
        error: `Account temporarily locked. Try again in ${remainingTime} minutes.`,
        lockedUntil: user.lockUntil
      });
    }

    // Verify password
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      // Increment failed login attempts
      const loginAttempts = (user.loginAttempts || 0) + 1;
      const updateData = { loginAttempts };
      
      // Lock account after 5 failed attempts for 30 minutes
      if (loginAttempts >= 5) {
        updateData.lockUntil = new Date(Date.now() + 30 * 60 * 1000);
        updateData.loginAttempts = 0; // Reset counter
        await usersCollection.updateOne({ _id: user._id }, { $set: updateData });
        return res.status(423).json({ 
          error: 'Too many failed attempts. Account locked for 30 minutes.',
          lockedUntil: updateData.lockUntil
        });
      }
      
      await usersCollection.updateOne({ _id: user._id }, { $set: updateData });
      return res.status(401).json({ 
        error: 'Invalid email or password',
        attemptsRemaining: 5 - loginAttempts
      });
    }

    // Reset login attempts on successful login
    await usersCollection.updateOne(
      { _id: user._id }, 
      { $set: { loginAttempts: 0, lockUntil: null, lastLogin: new Date() } }
    );

    // ============================================
    // INFINITY CHECK IS NOW ASYNC (NON-BLOCKING)
    // Login returns immediately, InFinity data loads separately via /api/infinity/stats
    // This prevents 30-60s delays when Render server is cold/sleeping
    // ============================================
    
    // Check if user has cached InFinity data from previous sync
    const infinityLinked = user.infinityLinked || false;
    const cachedInfinityData = user.infinityData || null;
    
    // Fire-and-forget: Async background sync with InFinity (non-blocking)
    // This updates the user record for future logins without blocking this request
    if (process.env.INFINITY_API_KEY) {
      setImmediate(async () => {
        try {
          console.log(`🔄 [Background] Syncing InFinity data for: ${user.email}`);
          const infinityData = await fetchInfinityUserByEmail(user.email);
          
          if (infinityData && (infinityData.success !== false || infinityData.data)) {
            const infinityUserData = infinityData.data || infinityData;
            
            await usersCollection.updateOne(
              { _id: user._id },
              { 
                $set: {
                  infinityLinked: true,
                  infinityLastSync: new Date(),
                  infinityData: {
                    totalRevenue: infinityUserData.totalRevenue || 0,
                    totalInvestment: infinityUserData.totalInvestment || 0,
                    monthlyRevenue: infinityUserData.monthlyRevenue || 0,
                    monthlyBurn: infinityUserData.monthlyBurn || 0,
                    runway: infinityUserData.runway || 0,
                    revenueGrowth: infinityUserData.revenueGrowth || 0,
                    status: infinityUserData.status || 'Connected',
                    companyName: infinityUserData.companyName || user.companyName,
                    lastSynced: new Date()
                  }
                }
              }
            );
            console.log(`✅ [Background] InFinity sync complete for: ${user.email}`);
          }
        } catch (err) {
          console.log(`⚠️ [Background] InFinity sync failed (non-critical): ${err.message}`);
        }
      });
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

    // Return user data with cached InFinity status (fresh data loads via dashboard)
    res.json({
      accessToken,
      refreshToken,
      user: { 
        id: user._id, 
        email: user.email, 
        name: user.name, 
        companyName: user.companyName,
        infinityLinked: infinityLinked,
        infinityData: cachedInfinityData, // Use cached data, dashboard will fetch fresh
        infinityNote: infinityLinked ? 'Cached data - refreshing in background' : 'Not linked'
      }
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
    const { scores, companyStage, revenue, category, totalInvestment, monthlyExpenses, userValuation } = req.body;

    // INDIAN MARKET - Realistic revenue multiples based on 2024-2025 Indian startup ecosystem
    // These are conservative, grounded in actual Indian deals (not US/Global inflated multiples)
    const indianIndustryMultiples = {
      'SaaS': { min: 4, max: 12, avg: 7 },         // Indian SaaS: Freshworks, Zoho benchmarks
      'Mobile App': { min: 2, max: 6, avg: 4 },    // Indian app ecosystem
      'E-commerce': { min: 1.5, max: 5, avg: 3 },  // Indian e-commerce (lower margins)
      'Marketplace': { min: 2, max: 8, avg: 4 },   // Indian marketplaces
      'AI/ML': { min: 5, max: 15, avg: 8 },        // Indian AI premium but realistic
      'FinTech': { min: 3, max: 10, avg: 6 },      // Indian FinTech (regulated sector)
      'EdTech': { min: 2, max: 8, avg: 4 },        // Post-2022 correction
      'HealthTech': { min: 3, max: 10, avg: 5 },   // Indian healthtech
      'Hardware': { min: 1.5, max: 4, avg: 2.5 },  // Hardware lower in India
      'Consulting': { min: 2, max: 5, avg: 3 },    // Services business
      'AgriTech': { min: 2, max: 6, avg: 3.5 },    // Indian agritech
      'FoodTech': { min: 1.5, max: 5, avg: 3 },    // Food delivery/tech
      'Logistics': { min: 2, max: 6, avg: 3.5 },   // Indian logistics
      'CleanTech': { min: 3, max: 10, avg: 5 },    // Green premium
      'D2C': { min: 1.5, max: 5, avg: 3 },         // Direct-to-consumer
      'FMCG': { min: 1.5, max: 4, avg: 2.5 },      // FMCG lower multiples
      'Other': { min: 2, max: 6, avg: 3.5 }
    };

    // Stage-based valuation caps for Indian market (realistic ceiling based on stage)
    const stageValuationCaps = {
      'Idea': 10000000,        // ₹1 Cr max for idea stage
      'MVP': 30000000,         // ₹3 Cr max for MVP
      'Beta': 50000000,        // ₹5 Cr max for beta
      'Launched': 150000000,   // ₹15 Cr max for launched
      'Growing': 500000000,    // ₹50 Cr max for growing
      'Established': 2000000000 // ₹200 Cr max for established
    };

    // Stage-based base valuations for Indian market (without revenue)
    const stageBaseValuations = {
      'Idea': 5000000,         // ₹50 Lakhs base
      'MVP': 15000000,         // ₹1.5 Cr base
      'Beta': 30000000,        // ₹3 Cr base
      'Launched': 50000000,    // ₹5 Cr base
      'Growing': 100000000,    // ₹10 Cr base
      'Established': 250000000 // ₹25 Cr base
    };

    const categoryMultiple = indianIndustryMultiples[category] || indianIndustryMultiples['Other'];
    const stageCap = stageValuationCaps[companyStage] || stageValuationCaps['Launched'];
    const stageBase = stageBaseValuations[companyStage] || stageBaseValuations['Launched'];

    // Berkus Method calculation (for pre-revenue/early stage) - INDIAN ADJUSTED
    // Max ₹50L per factor (Indian seed stage reality)
    const berkusFactors = {
      soundIdea: Math.min(scores.productScore * 100000, 500000),         // Max ₹5L
      qualityTeam: Math.min(scores.teamScore * 100000, 500000),          // Max ₹5L
      prototype: Math.min(scores.productScore * 100000, 500000),         // Max ₹5L
      strategicRelationships: Math.min(scores.marketScore * 100000, 500000), // Max ₹5L
      productRollout: Math.min(scores.salesScore * 80000, 400000)        // Max ₹4L
    };

    const berkusValuation = Object.values(berkusFactors).reduce((a, b) => a + b, 0);

    // Scorecard Method calculation - INDIAN BENCHMARK
    const baseValuation = stageBase; // Use stage-appropriate base
    
    const scorecardMultipliers = {
      team: 0.25 * (scores.teamScore / 5),
      market: 0.2 * (scores.marketScore / 5),
      product: 0.18 * (scores.productScore / 5),
      sales: 0.15 * (scores.salesScore / 5),
      financing: 0.1 * (scores.financingScore / 5),
      competitive: 0.12 * (scores.competitiveScore / 5)
    };

    const totalMultiplier = Object.values(scorecardMultipliers).reduce((a, b) => a + b, 0);
    const scorecardValuation = baseValuation * (0.5 + totalMultiplier * 1.5);

    // Revenue Multiple Method (if revenue exists) - INDIAN MARKET REALISTIC
    let revenueMultipleValuation = 0;
    let annualRevenue = 0;
    if (revenue && revenue > 0) {
      annualRevenue = revenue * 12; // Convert monthly to annual
      
      // Use conservative Indian multiples based on stage
      let adjustedMultiple = categoryMultiple.avg;
      
      // Stage-based multiple adjustment (Indian realistic)
      if (companyStage === 'Established') {
        adjustedMultiple = categoryMultiple.max * 0.9; // 90% of max for established
      } else if (companyStage === 'Growing') {
        adjustedMultiple = categoryMultiple.avg * 1.2; // Slight premium for growth
      } else if (companyStage === 'Launched') {
        adjustedMultiple = categoryMultiple.avg; // Average multiple
      } else {
        adjustedMultiple = categoryMultiple.min * 1.2; // Lower for early stage
      }
      
      // Score-based adjustment (conservative)
      const avgScore = (scores.teamScore + scores.productScore + scores.marketScore + scores.salesScore + scores.financingScore + scores.competitiveScore) / 6;
      if (avgScore >= 4.5) adjustedMultiple *= 1.3;      // Good scores = 30% premium max
      else if (avgScore >= 4) adjustedMultiple *= 1.2; // 20% premium
      else if (avgScore >= 3.5) adjustedMultiple *= 1.1; // 10% premium
      else if (avgScore >= 3) adjustedMultiple *= 1; // No adjustment
      else adjustedMultiple *= 0.8;                       // Below average = discount
      
      revenueMultipleValuation = annualRevenue * adjustedMultiple;
    }

    // Final valuation logic based on stage and revenue
    let finalValuationINR;
    let valuationMethod;
    
    if (revenue && revenue > 0 && (companyStage === 'Growing' || companyStage === 'Established' || companyStage === 'Launched')) {
      // Revenue-based companies: weighted combination
      finalValuationINR = (revenueMultipleValuation * 0.7 + scorecardValuation * 0.3);
      valuationMethod = 'Revenue Multiple + Scorecard (Indian Benchmark)';
    } else if (companyStage === 'Idea' || companyStage === 'MVP') {
      // Pre-revenue: Use Berkus + Scorecard
      finalValuationINR = (berkusValuation * 0.6 + scorecardValuation * 0.4);
      valuationMethod = 'Berkus + Scorecard (Pre-Revenue)';
    } else {
      // Beta/early launched without revenue
      finalValuationINR = (berkusValuation * 0.4 + scorecardValuation * 0.6);
      valuationMethod = 'Scorecard + Berkus (Early Stage)';
    }

    // CRITICAL: Apply stage-based cap (Indian market reality)
    const stageCappedValuation = Math.min(finalValuationINR, stageCap);
    
    // CRITICAL: If user provided their own valuation, respect it as upper bound
    // The user's self-assessment based on their phase should not be exceeded
    let userCappedValuation = stageCappedValuation;
    let userValuationApplied = false;
    
    if (userValuation && userValuation > 0) {
      // User's valuation acts as a ceiling - we should not exceed their own assessment
      // Allow 20% variance above user valuation max for market adjustment
      const userCeiling = userValuation * 1.2;
      if (stageCappedValuation > userCeiling) {
        userCappedValuation = userCeiling;
        userValuationApplied = true;
      }
    }

    // Final valuation after all caps
    finalValuationINR = userCappedValuation;
    
    const finalValuationUSD = finalValuationINR / 83; // Current exchange rate

    // Calculate TAM, SAM, SOM (INDIAN MARKET SPECIFIC)
    const indianMarketSizeEstimates = {
      'SaaS': { tam: 2500000000000, samPercent: 3, somPercent: 0.5 },    // ₹25,000 Cr TAM (India SaaS)
      'Mobile App': { tam: 1000000000000, samPercent: 2, somPercent: 0.3 },
      'E-commerce': { tam: 8000000000000, samPercent: 1, somPercent: 0.1 }, // Large but low capture
      'Marketplace': { tam: 4000000000000, samPercent: 2, somPercent: 0.3 },
      'AI/ML': { tam: 500000000000, samPercent: 5, somPercent: 1 },      // Growing but smaller
      'FinTech': { tam: 3000000000000, samPercent: 2, somPercent: 0.3 },
      'EdTech': { tam: 2000000000000, samPercent: 2, somPercent: 0.3 },
      'HealthTech': { tam: 1500000000000, samPercent: 3, somPercent: 0.5 },
      'Hardware': { tam: 2000000000000, samPercent: 2, somPercent: 0.2 },
      'Consulting': { tam: 800000000000, samPercent: 3, somPercent: 0.5 },
      'AgriTech': { tam: 1000000000000, samPercent: 3, somPercent: 0.5 },
      'FoodTech': { tam: 2000000000000, samPercent: 2, somPercent: 0.3 },
      'FMCG': { tam: 10000000000000, samPercent: 0.5, somPercent: 0.05 },
      'Other': { tam: 1000000000000, samPercent: 2, somPercent: 0.3 }
    };

    const marketEstimate = indianMarketSizeEstimates[category] || indianMarketSizeEstimates['Other'];
    const TAM = marketEstimate.tam;
    const SAM = TAM * (marketEstimate.samPercent / 100);
    const SOM = SAM * (marketEstimate.somPercent / 100);

    // Calculate CAGR (estimate based on stage and sales performance) - INDIAN REALISTIC
    let CAGR = 0;
    
    // Base CAGR on stage (Indian startup growth rates)
    if (companyStage === 'Idea' || companyStage === 'MVP') CAGR = 100; // 100% for early stage
    else if (companyStage === 'Launched') CAGR = 80;  // 80% for launched
    else if (companyStage === 'Beta') CAGR = 90;      // 90% for beta
    else if (companyStage === 'Growing') CAGR = 60;   // 60% for growing
    else if (companyStage === 'Established') CAGR = 30; // 30% for established
    
    // Adjust based on sales score
    CAGR *= (scores.salesScore / 5);
    
    // Revenue traction boost
    if (revenue && revenue > 0) {
      CAGR *= 1.1; // 10% boost for having actual revenue
    }

    // Calculate Runway (months of operation remaining)
    let runway = 0;
    let burnRate = monthlyExpenses || 0;
    
    if (revenue && revenue > 0 && burnRate === 0) {
      burnRate = revenue * 0.7; // Assume 70% expense ratio
    }
    
    if (totalInvestment && burnRate > 0) {
      const netBurn = burnRate - (revenue || 0);
      if (netBurn > 0) {
        runway = Math.floor(totalInvestment / netBurn);
      } else {
        runway = 999; // Profitable
      }
    } else if (revenue && revenue > burnRate) {
      runway = 999; // Profitable
    }

    // Return comprehensive valuation data with Indian context
    res.json({
      // Valuation methods
      berkusValuation,
      scorecardValuation,
      revenueMultipleValuation: revenueMultipleValuation || null,
      finalValuationINR,
      finalValuationUSD,
      valuationMethod,
      
      // Caps applied
      stageCap,
      userValuationApplied,
      userValuationProvided: userValuation || null,
      
      // Breakdown
      scorecardMultipliers,
      berkusFactors,
      industryMultiple: categoryMultiple,
      
      // Market metrics (Indian)
      TAM,
      SAM,
      SOM,
      marketPenetration: annualRevenue > 0 ? ((annualRevenue / SOM) * 100).toFixed(2) : 0,
      marketContext: 'Indian Market',
      
      // Growth metrics
      CAGR,
      annualRevenue,
      
      // Financial health
      runway,
      burnRate,
      monthlyRevenue: revenue || 0,
      isProfitable: revenue > burnRate,
      
      // Methodology notes
      notes: `Valuation based on Indian market benchmarks for ${category} sector at ${companyStage} stage. ${userValuationApplied ? 'Capped to respect user-provided valuation ceiling.' : ''} Revenue multiple of ${categoryMultiple.avg}x used (Indian ${category} average).`,
      
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

    // Parse and clean the industry - detect actual industry from context
    let actualIndustry = industry || 'Technology';
    const competitorStr = (Array.isArray(competitors) ? competitors.join(' ') : competitors || '').toLowerCase();
    const productDesc = (companyData?.productDescription || '').toLowerCase();
    
    // Detect real industry from competitors and product description
    if (competitorStr.includes('casa') || competitorStr.includes('hiranandani') || competitorStr.includes('dlf') || 
        competitorStr.includes('godrej') || competitorStr.includes('prestige') || productDesc.includes('real estate') ||
        productDesc.includes('property') || productDesc.includes('construction') || productDesc.includes('housing')) {
      actualIndustry = 'Real Estate & Construction';
    } else if (competitorStr.includes('zomato') || competitorStr.includes('swiggy') || productDesc.includes('food') || productDesc.includes('restaurant')) {
      actualIndustry = 'Food & Hospitality';
    } else if (competitorStr.includes('zerodha') || competitorStr.includes('razorpay') || productDesc.includes('fintech') || productDesc.includes('payment')) {
      actualIndustry = 'FinTech';
    } else if (productDesc.includes('saas') || productDesc.includes('software')) {
      actualIndustry = 'SaaS';
    } else if (actualIndustry.toLowerCase().includes('hardware') || actualIndustry.toLowerCase().includes('other')) {
      // If it still says "Hardware, Other", try to infer from product description
      if (productDesc.includes('house') || productDesc.includes('apartment') || productDesc.includes('plot')) {
        actualIndustry = 'Real Estate & Construction';
      } else {
        actualIndustry = 'Technology';
      }
    }

    // Get company name and product details
    const companyName = companyData?.companyName || 'Your startup';
    const productName = companyData?.productName || companyData?.flagshipProduct || 'your product';
    const targetCustomer = companyData?.targetCustomer || 'customers';
    const uniqueValue = companyData?.uniqueValue || 'unique value proposition';
    const competitorList = Array.isArray(competitors) ? competitors.filter(c => c && c.trim()).join(', ') : (competitors || 'market players');

    // Use Google Search grounded prompt for real-time market data - HIGHLY SPECIFIC
    const prompt = `You are a Senior Business Strategy Consultant. Provide a HIGHLY SPECIFIC and TAILORED SWOT analysis.

## COMPANY DETAILS (USE THESE SPECIFICALLY):
- Company Name: ${companyName}
- Product/Service: ${productName}
- Industry: ${actualIndustry}
- Stage: ${companyData?.stage || 'Early Stage'}
- Target Customer: ${targetCustomer}
- Unique Value: ${uniqueValue}
- Product Description: ${companyData?.productDescription || 'Not provided'}
- Key Competitors: ${competitorList}
- Has Revenue: ${companyData?.hasRevenue ? 'Yes' : 'No'}
- Team Size: ${companyData?.teamSize || 'Small team'}

## CRITICAL INSTRUCTIONS:
1. DO NOT use generic phrases like "Growing industry" or "market potential"
2. DO NOT mention the category name directly (e.g., don't say "Hardware, Other")
3. EVERY point must be SPECIFIC to this company's actual product and market
4. Reference the ACTUAL competitors by name (${competitorList})
5. Use the ACTUAL product description to craft insights

## SEARCH FOR CURRENT DATA:
- Search: "${actualIndustry} India market trends 2024 2025"
- Search: "${competitorList} company news funding"
- Search: "India ${actualIndustry} government schemes policies 2024"

## REQUIRED OUTPUT FORMAT - BE SPECIFIC:

STRENGTHS (specific to ${companyName}):
- What specific advantages does ${productName} have?
- What makes their approach to ${targetCustomer} unique?
- What operational strengths at ${companyData?.stage || 'current'} stage?

WEAKNESSES (specific to ${companyName}):
- What specific challenges for a ${companyData?.stage || 'early'} stage ${actualIndustry} company?
- What resources are lacking?
- What competitive disadvantages vs ${competitorList}?

OPPORTUNITIES (based on REAL market data):
- Specific government schemes for ${actualIndustry} in India
- Specific market trends with numbers (e.g., "₹X crore market growing at Y%")
- Specific news about ${actualIndustry} sector expansion

THREATS (based on REAL market data):
- Specific competitive pressure from ${competitorList}
- Specific regulatory challenges in ${actualIndustry}
- Specific economic factors affecting ${actualIndustry}

Return ONLY valid JSON:
{
  "strengths": [
    "Specific strength about ${productName} and ${targetCustomer}",
    "Specific operational advantage",
    "Specific team/technology strength",
    "Specific market positioning strength"
  ],
  "weaknesses": [
    "Specific challenge at ${companyData?.stage || 'current'} stage",
    "Specific resource constraint",
    "Specific competitive gap vs ${competitorList}",
    "Specific market/brand weakness"
  ],
  "opportunities": [
    "Specific government scheme/policy with name and amount (search for real data)",
    "Specific market growth trend with numbers",
    "Specific partnership/expansion opportunity",
    "Specific technology/consumer trend opportunity"
  ],
  "threats": [
    "Specific threat from ${competitorList} with recent news",
    "Specific regulatory/policy threat in ${actualIndustry}",
    "Specific market/economic threat",
    "Specific operational/scaling threat"
  ]
}`;

    // Use Google Search grounded Gemini for real-time market data
    try {
      const systemContext = `You are a Senior Business Strategy Consultant specializing in ${actualIndustry}. 
Your analysis must be HIGHLY SPECIFIC to ${companyName} and their product ${productName}. 
DO NOT use generic industry phrases. Every point must reference specific details from the company profile.
Search for real, current market data about ${actualIndustry} in India and the competitors: ${competitorList}.
Return ONLY valid JSON.`;
      
      const geminiResponse = await callGeminiWithSearch(prompt, systemContext);
      
      // Clean and parse
      let content = geminiResponse.replaceAll(/```json\n?/g, '').replaceAll(/```\n?/g, '').trim();
      
      // Extract JSON if there's extra text
      const firstBrace = content.indexOf('{');
      const lastBrace = content.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace !== -1) {
        content = content.substring(firstBrace, lastBrace + 1);
      }
      
      const analysis = JSON.parse(content);
      
      console.log('✅ SWOT analysis with market news from Gemini for', actualIndustry);
      return res.json(analysis);
      
    } catch (geminiError) {
      console.warn('Gemini Search failed for SWOT, trying regular Gemini:', geminiError.message);
      
      // Fallback to regular Gemini without search
      const fallbackResponse = await callGemini(prompt, 'Return ONLY valid JSON, no markdown.');
      let content = fallbackResponse.replaceAll(/```json\n?/g, '').replaceAll(/```\n?/g, '').trim();
      const firstBrace = content.indexOf('{');
      const lastBrace = content.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace !== -1) {
        content = content.substring(firstBrace, lastBrace + 1);
      }
      const analysis = JSON.parse(content);
      return res.json(analysis);
    }

  } catch (error) {
    console.error('AI backend failed for SWOT:', error.message);
    // Return personalized fallback data based on inputs
    const { companyData, industry, competitors } = req.body;
    const competitorList = Array.isArray(competitors) ? competitors.filter(c => c).join(', ') : (competitors || 'established players');
    const productName = companyData?.productName || companyData?.flagshipProduct || 'your product';
    const targetCustomer = companyData?.targetCustomer || 'target customers';
    
    // Detect actual industry for fallback too
    let actualIndustry = 'your industry';
    const competitorStr = competitorList.toLowerCase();
    if (competitorStr.includes('casa') || competitorStr.includes('hiranandani') || competitorStr.includes('dlf')) {
      actualIndustry = 'Real Estate';
    } else if (competitorStr.includes('zomato') || competitorStr.includes('swiggy')) {
      actualIndustry = 'Food Tech';
    }
    
    res.json({
      strengths: [
        `${productName} addresses key pain points for ${targetCustomer}`,
        `${companyData?.stage || 'Early'} stage with lean operational structure`,
        companyData?.hasRevenue ? 'Demonstrated product-market fit with paying customers' : 'Focused product development approach',
        `Clear value proposition differentiating from ${competitorList}`
      ],
      weaknesses: [
        companyData?.hasRevenue ? 'Revenue scale requires acceleration for market leadership' : 'Pre-revenue stage requiring customer validation',
        `Brand awareness gap compared to established players like ${competitorList}`,
        'Resource constraints typical of current funding stage',
        'Geographic or market segment coverage limitations'
      ],
      opportunities: [
        `India ${actualIndustry} market projected to grow significantly by 2030`,
        'Government startup schemes like Startup India, state-specific grants available',
        `Strategic partnerships with complementary ${actualIndustry} players`,
        'Digital adoption trends creating new customer acquisition channels'
      ],
      threats: [
        `Direct competition from well-funded players: ${competitorList}`,
        `Regulatory changes in ${actualIndustry} sector requiring compliance adaptation`,
        'Market saturation increasing customer acquisition costs',
        'Economic conditions affecting customer spending and investment climate'
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

    // State-specific schemes database (major startup states) - COMPREHENSIVE & VERIFIED
    const stateSchemes = {
      'Karnataka': [
        { name: 'Karnataka Startup Cell - Idea2PoC', amount: '₹50 Lakhs', eligibility: 'DPIIT recognized, Karnataka-based, Idea to Prototype stage', benefits: 'Grant for proof of concept development, no equity dilution', type: 'Grant' },
        { name: 'Karnataka Elevate Program', amount: 'Up to ₹50 Lakhs', eligibility: 'Tech startups, post-revenue, Karnataka-based', benefits: 'Funding + mentorship for scaling, ecosystem connect', type: 'Grant' },
        { name: 'KBITS Innovation Fund', amount: '₹25-50 Lakhs', eligibility: 'Bio-IT, AI/ML, IoT startups in Karnataka', benefits: 'Seed funding for innovative tech ventures', type: 'Equity' },
        { name: 'Karnataka Startup Policy Grant', amount: 'Up to ₹30 Lakhs', eligibility: 'DPIIT recognized startups registered in Karnataka', benefits: 'Reimbursement of patent filing, quality certification costs', type: 'Grant' },
        { name: 'NASSCOM 10K Startups - Karnataka', amount: '₹10-25 Lakhs', eligibility: 'Tech startups, early stage, innovative product', benefits: 'Incubation, mentorship, investor connect', type: 'Grant' }
      ],
      'Maharashtra': [
        { name: 'Maharashtra Start-up Week Funding', amount: '₹10-25 Lakhs', eligibility: 'Maharashtra-based, innovative startups, early stage', benefits: 'Seed funding and ecosystem support, networking', type: 'Grant' },
        { name: 'MahaIT Innovation Fund', amount: 'Up to ₹1 Crore', eligibility: 'IT/Tech startups, Maharashtra-based, post-revenue', benefits: 'Scaling support, infrastructure access', type: 'Equity' },
        { name: 'Maharashtra State Innovation Society Grant', amount: '₹15-50 Lakhs', eligibility: 'DPIIT recognized, innovative solutions', benefits: 'Prototype development, market validation', type: 'Grant' },
        { name: 'Fintech Fund Mumbai', amount: '₹25-75 Lakhs', eligibility: 'FinTech startups in Maharashtra', benefits: 'Specialized funding for fintech innovation', type: 'Grant' }
      ],
      'Tamil Nadu': [
        { name: 'Tamil Nadu Startup Seed Grant Fund', amount: 'Up to ₹5 Lakhs', eligibility: 'Startups registered in Tamil Nadu, recognized by StartupTN, early stages (Idea to MVP), viable business model', benefits: 'Seed funding to support product development, market validation, and initial operations', type: 'Grant' },
        { name: 'TANSEED (Tamil Nadu Startup and Innovation Mission)', amount: 'Up to ₹10 Lakhs', eligibility: 'DPIIT recognized, TN-based, innovative tech product, early stage', benefits: 'Seed grant for product development, no equity dilution', type: 'Grant' },
        { name: 'StartupTN Innovation Challenge Grant', amount: '₹5-25 Lakhs', eligibility: 'Startups solving specific industry challenges, TN-registered', benefits: 'Problem-solving grants, access to industry partners', type: 'Grant' },
        { name: 'TIDCO Venture Capital Fund', amount: '₹25 Lakhs - ₹2 Crores', eligibility: 'TN-based startups, past MVP stage, scalable business model', benefits: 'Equity investment for scaling, government-backed VC', type: 'Equity' },
        { name: 'TANSIM (Tamil Nadu Startup and Innovation Mission) Manufacturing Grant', amount: 'Up to ₹15 Lakhs', eligibility: 'Manufacturing/hardware/deep-tech startups in TN', benefits: 'Infrastructure support, testing facilities, prototyping grants', type: 'Grant' },
        { name: 'Tamil Nadu Women Entrepreneur Fund', amount: 'Up to ₹10 Lakhs', eligibility: 'Women-led startups registered in Tamil Nadu', benefits: 'Special seed funding, mentorship, networking support', type: 'Grant' },
        { name: 'IIT Madras Research Park Incubation Grant', amount: '₹10-50 Lakhs', eligibility: 'Deep-tech, research-based startups, willing to incubate at IITMRP', benefits: 'R&D funding, lab access, expert mentorship, IP support', type: 'Grant' },
        { name: 'Anna University Innovation Hub Grant', amount: 'Up to ₹5 Lakhs', eligibility: 'Student/faculty startups, innovative tech solutions', benefits: 'Seed funding, incubation space, mentorship', type: 'Grant' },
        { name: 'TNIFMC (TN Industrial Investment Corporation) Startup Loan', amount: '₹10-50 Lakhs', eligibility: 'TN-registered startups, viable business model, collateral available', benefits: 'Low-interest loans for working capital and expansion', type: 'Loan' },
        { name: 'Atal Incubation Centre - TN Grants', amount: '₹5-15 Lakhs', eligibility: 'Startups incubated at AIC centers in Tamil Nadu', benefits: 'Seed funding, mentorship, co-working space', type: 'Grant' },
        { name: 'MSME-TN Startup Support Scheme', amount: 'Up to ₹10 Lakhs', eligibility: 'MSME registered startups in Tamil Nadu', benefits: 'Subsidy on machinery, technology acquisition, market development', type: 'Grant' },
        { name: 'Rural Innovation Fund - Tamil Nadu', amount: '₹2-10 Lakhs', eligibility: 'Startups working on rural/agri-tech solutions in TN', benefits: 'Seed funding for rural innovation, field testing support', type: 'Grant' }
      ],
      'Telangana': [
        { name: 'T-Hub Seed Fund', amount: '₹25 Lakhs', eligibility: 'Tech startups incubated at T-Hub, Telangana-based', benefits: 'Seed funding, mentorship, ecosystem access', type: 'Grant' },
        { name: 'WE Hub Women Entrepreneur Fund', amount: '₹15-30 Lakhs', eligibility: 'Women-led startups, Telangana-based', benefits: 'Funding, incubation, women-focused support', type: 'Grant' },
        { name: 'Telangana Innovation Fund', amount: '₹50 Lakhs - ₹2 Crores', eligibility: 'High-growth tech startups, Telangana-based', benefits: 'Growth capital, scaling support', type: 'Equity' },
        { name: 'T-Works Hardware Grant', amount: '₹10-25 Lakhs', eligibility: 'Hardware/IoT startups in Telangana', benefits: 'Prototyping support, manufacturing assistance', type: 'Grant' }
      ],
      'Gujarat': [
        { name: 'Gujarat Startup Fund', amount: 'Up to ₹50 Lakhs', eligibility: 'Gujarat-based, DPIIT recognized, early-stage', benefits: 'Seed capital, mentorship, infrastructure', type: 'Grant' },
        { name: 'iCreate Seed Fund', amount: '₹10-25 Lakhs', eligibility: 'Product/hardware startups, Gujarat-based', benefits: 'Prototype development, market testing', type: 'Grant' },
        { name: 'Gujarat Venture Finance Ltd', amount: '₹25 Lakhs - ₹5 Crores', eligibility: 'Scalable startups with revenue potential', benefits: 'Equity funding, government-backed investment', type: 'Equity' }
      ],
      'Delhi NCR': [
        { name: 'Delhi Startup Policy Fund', amount: '₹20-50 Lakhs', eligibility: 'Delhi-registered startups, innovative business model', benefits: 'Seed funding, subsidy on patent filing, office space', type: 'Grant' },
        { name: 'Delhi Innovation Fund', amount: 'Up to ₹1 Crore', eligibility: 'Tech startups, post-revenue, Delhi-based', benefits: 'Growth capital, ecosystem access', type: 'Equity' },
        { name: 'Startup India Hub - Delhi Chapter', amount: '₹10-30 Lakhs', eligibility: 'DPIIT recognized startups in Delhi NCR', benefits: 'Incubation, mentorship, investor connect', type: 'Grant' }
      ],
      'Haryana': [
        { name: 'Haryana Enterprise Promotion Center Fund', amount: '₹15-30 Lakhs', eligibility: 'Haryana-based startups, early stage', benefits: 'Seed funding, subsidy benefits', type: 'Grant' },
        { name: 'Haryana Startup Policy Grant', amount: '₹10-25 Lakhs', eligibility: 'Startups registered in Haryana', benefits: 'Reimbursement on patent, quality certification', type: 'Grant' }
      ],
      'Kerala': [
        { name: 'Kerala Startup Mission Fund (KSUM)', amount: '₹25-50 Lakhs', eligibility: 'Kerala-based, DPIIT recognized, innovative product', benefits: 'Seed funding, incubation facilities, mentorship', type: 'Grant' },
        { name: 'Women Startup Fund - Kerala', amount: 'Up to ₹20 Lakhs', eligibility: 'Women-led startups in Kerala', benefits: 'Interest-free loans, mentorship', type: 'Loan' },
        { name: 'KSUM Innovation Grant', amount: '₹5-15 Lakhs', eligibility: 'Tech startups in early stage', benefits: 'Product development, market validation support', type: 'Grant' },
        { name: 'Kerala Financial Corporation Startup Loan', amount: '₹10-50 Lakhs', eligibility: 'Kerala-based startups with viable business model', benefits: 'Low-interest startup loans', type: 'Loan' }
      ],
      'Rajasthan': [
        { name: 'Rajasthan Startup Fest Funding', amount: '₹10-25 Lakhs', eligibility: 'Rajasthan-based, early stage startups', benefits: 'Seed grant, ecosystem support', type: 'Grant' },
        { name: 'iStart Rajasthan', amount: 'Up to ₹25 Lakhs', eligibility: 'DPIIT recognized, Rajasthan-registered', benefits: 'Seed funding, incubation, mentorship', type: 'Grant' }
      ],
      'Uttar Pradesh': [
        { name: 'UP Startup Fund', amount: '₹25-50 Lakhs', eligibility: 'UP-based startups, DPIIT recognized', benefits: 'Seed funding, infrastructure support', type: 'Grant' },
        { name: 'UP Startup Policy Grant', amount: '₹10-30 Lakhs', eligibility: 'Startups in priority sectors in UP', benefits: 'Sector-specific funding, subsidy benefits', type: 'Grant' }
      ],
      'West Bengal': [
        { name: 'WB Startup Policy Fund', amount: '₹15-40 Lakhs', eligibility: 'West Bengal registered startups', benefits: 'Seed funding, incubation support', type: 'Grant' },
        { name: 'Webel (WB Electronics Industry Development Corporation)', amount: '₹10-25 Lakhs', eligibility: 'Tech/Electronics startups in WB', benefits: 'Infrastructure, prototyping support', type: 'Grant' }
      ],
      'Punjab': [
        { name: 'Punjab Startup Fund', amount: '₹10-25 Lakhs', eligibility: 'Punjab-registered startups, early stage', benefits: 'Seed grant, mentorship', type: 'Grant' },
        { name: 'Punjab Infotech Startup Grant', amount: '₹5-15 Lakhs', eligibility: 'IT/Tech startups in Punjab', benefits: 'Tech-focused seed funding', type: 'Grant' }
      ],
      'Andhra Pradesh': [
        { name: 'AP Innovation Society Grant', amount: '₹10-30 Lakhs', eligibility: 'AP-registered startups, innovative solutions', benefits: 'Seed funding, incubation', type: 'Grant' },
        { name: 'Fintech Valley Fund', amount: '₹25-75 Lakhs', eligibility: 'FinTech startups in Andhra Pradesh', benefits: 'Specialized fintech funding', type: 'Equity' },
        { name: 'AP State Startup Support', amount: 'Varies by state', eligibility: 'Startups registered in Andhra Pradesh', benefits: 'Seed funding, mentorship, incubation support - check state startup portal', type: 'Grant' },
        { name: 'APSFC Startup Loan Scheme', amount: 'Up to ₹50 Lakhs', eligibility: 'Andhra Pradesh registered MSMEs and startups', benefits: 'Low-interest loans, working capital support', type: 'Loan' },
        { name: 'AP IT & Electronics Policy Support', amount: 'Up to ₹25 Lakhs', eligibility: 'IT/Electronics startups in Andhra Pradesh', benefits: 'Infrastructure subsidies, power tariff concession, stamp duty exemption', type: 'Grant' },
        { name: 'TIDE Andhra Pradesh', amount: 'Up to ₹15 Lakhs', eligibility: 'Tech startups in tier-2 cities of AP', benefits: 'Technology incubation, mentorship, market access', type: 'Grant' },
        { name: 'AP Skill Development Startup Grant', amount: 'Up to ₹10 Lakhs', eligibility: 'Startups in skill development and education sector in AP', benefits: 'Seed grant, partnership with skill development centers', type: 'Grant' }
      ],
      'Odisha': [
        { name: 'Startup Odisha Fund', amount: '₹10-25 Lakhs', eligibility: 'Odisha-registered startups', benefits: 'Seed funding, ecosystem support', type: 'Grant' }
      ]
    };

    // Personalized eligibility logic
    const userState = state || location || 'Other';

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

Focus on Central schemes (include ALL applicable based on category and stage):

SEED/EARLY STAGE FUNDING:
- SISFS (Startup India Seed Fund) - up to ₹50L for idea/prototype stage
- NIDHI-PRAYAS - up to ₹10L for prototype development
- NIDHI-SSS (Seed Support System) - up to ₹1Cr through incubators
- NIDHI-EIR (Entrepreneur in Residence) - ₹30K/month fellowship
- Atal Innovation Mission (ANIC) - up to ₹1Cr for societal challenges

GROWTH STAGE FUNDING:
- CGSS (Credit Guarantee) - up to ₹10Cr for growing startups
- Fund of Funds for Startups (FFS) - ₹50L-₹10Cr through SEBI AIFs
- CGTMSE - up to ₹5Cr collateral-free credit

TECH/INNOVATION FUNDING:
- GENESIS (GenNext Support) - ₹10L-₹1Cr for deep tech/AI-ML
- SAMRIDH - up to ₹40L for IT/Electronics/Deep tech
- TIDE 2.0 - up to ₹15L for tech startups in Tier-2/3 cities

SECTOR-SPECIFIC:
- BIRAC BIG - up to ₹50L for biotech/healthtech/agritech
- BIRAC SEED Fund - up to ₹30L for early biotech
- Ed-AII - up to ₹50L for EdTech/Education
- ASPIRE - up to ₹1Cr for agri-business/rural innovation
- NABARD - for agri-startups and rural enterprises
- SFURTI - for traditional industries/artisan clusters
- PLI Scheme - for manufacturing at scale

LOANS & SUBSIDIES:
- MUDRA Shishu/Kishor/Tarun - ₹50K to ₹10L based on stage
- Stand-Up India - ₹10L-₹1Cr for SC/ST/Women entrepreneurs
- PMEGP - up to ₹25L with 15-35% subsidy

OTHER BENEFITS:
- Patent/IP Rebate - 80% rebate on patent filing
- Tax exemption under Section 80-IAC

For State Schemes in ${userState}, research and include ALL applicable state government programs:
${userState === 'Tamil Nadu' ? `
TAMIL NADU SPECIFIC SCHEMES (include all applicable):
- Tamil Nadu Startup Seed Grant Fund (Up to ₹5 Lakhs) - StartupTN recognized, early stage
- TANSEED - TN Startup and Innovation Mission (Up to ₹10 Lakhs)
- StartupTN Innovation Challenge Grant (₹5-25 Lakhs)
- TIDCO Venture Capital Fund (₹25L - ₹2Cr) - for post-MVP startups
- TANSIM Manufacturing Grant (Up to ₹15 Lakhs) - hardware/manufacturing
- Tamil Nadu Women Entrepreneur Fund (Up to ₹10 Lakhs)
- IIT Madras Research Park Incubation Grant (₹10-50 Lakhs) - deep tech
- Anna University Innovation Hub Grant (Up to ₹5 Lakhs)
- TNIFMC Startup Loan (₹10-50 Lakhs)
- Atal Incubation Centre - TN Grants (₹5-15 Lakhs)
- MSME-TN Startup Support Scheme (Up to ₹10 Lakhs)
- Rural Innovation Fund - Tamil Nadu (₹2-10 Lakhs) - agri-tech/rural
` : ''}
${userState === 'Andhra Pradesh' ? `
ANDHRA PRADESH SPECIFIC SCHEMES (include all applicable):
- AP Innovation Society Grant (₹10-30 Lakhs) - AP-registered startups, innovative solutions
- Fintech Valley Fund (₹25-75 Lakhs) - FinTech startups in Andhra Pradesh
- APSFC Startup Loan Scheme (Up to ₹50 Lakhs) - AP registered MSMEs and startups
- AP IT & Electronics Policy Support (Up to ₹25 Lakhs) - IT/Electronics startups
- TIDE Andhra Pradesh (Up to ₹15 Lakhs) - Tech startups in tier-2 cities
- AP Skill Development Startup Grant (Up to ₹10 Lakhs) - EdTech/skill development
- AP State Startup Support - Seed funding, mentorship, incubation support
- APIIC Industrial Subsidy - Capital subsidy for manufacturing startups
- JNTU Kakinada Innovation Hub Grant - Deep tech startups
- Andhra University Incubation Support - Early stage startups
` : ''}

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
      let content = geminiResponse.replaceAll(/```json\n?/g, '').replaceAll(/```\n?/g, '').trim();
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
    
    // State schemes database (same as above) - COMPREHENSIVE FALLBACK
    const stateSchemes = {
      'Karnataka': [
        { name: 'Karnataka Startup Cell - Idea2PoC', amount: '₹50 Lakhs', eligibility: 'DPIIT recognized, Karnataka-based, Idea to Prototype stage', benefits: 'Grant for proof of concept development', type: 'Grant', eligible: stage === 'Idea' || stage === 'MVP' || stage === 'Beta', eligibilityStatus: (stage === 'Idea' || stage === 'MVP' || stage === 'Beta') ? 'eligible' : 'partial', reasoning: 'Karnataka-based startups in early stage qualify for PoC funding' },
        { name: 'Karnataka Elevate Program', amount: 'Up to ₹50 Lakhs', eligibility: 'Tech startups, post-revenue, Karnataka-based', benefits: 'Funding + mentorship for scaling', type: 'Grant', eligible: hasRevenue, eligibilityStatus: hasRevenue ? 'eligible' : 'not-eligible', reasoning: 'Requires revenue generation for eligibility' }
      ],
      'Maharashtra': [
        { name: 'Maharashtra Start-up Week Funding', amount: '₹10-25 Lakhs', eligibility: 'Maharashtra-based, innovative startups', benefits: 'Seed funding and ecosystem support', type: 'Grant', eligible: true, eligibilityStatus: 'eligible', reasoning: 'Maharashtra-based startups with innovative ideas qualify' },
        { name: 'MahaIT Innovation Fund', amount: 'Up to ₹1 Crore', eligibility: 'IT/Tech startups, Maharashtra-based, post-revenue', benefits: 'Scaling support, infrastructure access', type: 'Equity', eligible: hasRevenue, eligibilityStatus: hasRevenue ? 'eligible' : 'partial', reasoning: 'Post-revenue startups preferred' }
      ],
      'Tamil Nadu': [
        { name: 'Tamil Nadu Startup Seed Grant Fund', amount: 'Up to ₹5 Lakhs', eligibility: 'Startups registered in Tamil Nadu, recognized by StartupTN, early stages (Idea to MVP)', benefits: 'Seed funding for product development, market validation, initial operations', type: 'Grant', eligible: stage === 'Idea' || stage === 'MVP' || stage === 'Beta', eligibilityStatus: (stage === 'Idea' || stage === 'MVP' || stage === 'Beta') ? 'eligible' : 'partial', reasoning: 'Early-stage TN startups qualify for seed grant' },
        { name: 'TANSEED (Tamil Nadu Startup and Innovation Mission)', amount: 'Up to ₹10 Lakhs', eligibility: 'DPIIT recognized, TN-based, innovative tech product', benefits: 'Seed grant for product development, no equity dilution', type: 'Grant', eligible: true, eligibilityStatus: 'eligible', reasoning: 'TN-based innovative startups qualify' },
        { name: 'StartupTN Innovation Challenge Grant', amount: '₹5-25 Lakhs', eligibility: 'Startups solving specific industry challenges, TN-registered', benefits: 'Problem-solving grants, industry partner access', type: 'Grant', eligible: true, eligibilityStatus: 'eligible', reasoning: 'Innovation-focused startups in TN qualify' },
        { name: 'TIDCO Venture Capital Fund', amount: '₹25 Lakhs - ₹2 Crores', eligibility: 'TN-based startups, past MVP stage, scalable business model', benefits: 'Equity investment for scaling', type: 'Equity', eligible: stage !== 'Idea' && stage !== 'MVP', eligibilityStatus: (stage !== 'Idea' && stage !== 'MVP') ? 'eligible' : 'partial', reasoning: 'Requires post-MVP stage for equity funding' },
        { name: 'TANSIM Manufacturing Grant', amount: 'Up to ₹15 Lakhs', eligibility: 'Manufacturing/hardware/deep-tech startups in TN', benefits: 'Infrastructure, testing facilities, prototyping', type: 'Grant', eligible: category === 'Hardware' || category === 'Manufacturing', eligibilityStatus: (category === 'Hardware' || category === 'Manufacturing') ? 'eligible' : 'partial', reasoning: 'Manufacturing/hardware focus required' },
        { name: 'Tamil Nadu Women Entrepreneur Fund', amount: 'Up to ₹10 Lakhs', eligibility: 'Women-led startups registered in Tamil Nadu', benefits: 'Special seed funding, mentorship, networking', type: 'Grant', eligible: true, eligibilityStatus: 'partial', reasoning: 'Women-led startups qualify - verify founder gender' },
        { name: 'IIT Madras Research Park Incubation Grant', amount: '₹10-50 Lakhs', eligibility: 'Deep-tech, research-based startups, willing to incubate at IITMRP', benefits: 'R&D funding, lab access, expert mentorship, IP support', type: 'Grant', eligible: category === 'AI/ML' || category === 'SaaS' || category === 'Hardware', eligibilityStatus: (category === 'AI/ML' || category === 'SaaS' || category === 'Hardware') ? 'eligible' : 'partial', reasoning: 'Deep-tech startups preferred for IITMRP' },
        { name: 'Atal Incubation Centre - TN Grants', amount: '₹5-15 Lakhs', eligibility: 'Startups incubated at AIC centers in Tamil Nadu', benefits: 'Seed funding, mentorship, co-working space', type: 'Grant', eligible: true, eligibilityStatus: 'eligible', reasoning: 'AIC incubated startups in TN qualify' },
        { name: 'MSME-TN Startup Support Scheme', amount: 'Up to ₹10 Lakhs', eligibility: 'MSME registered startups in Tamil Nadu', benefits: 'Subsidy on machinery, technology, market development', type: 'Grant', eligible: true, eligibilityStatus: 'partial', reasoning: 'Requires MSME registration' }
      ],
      'Telangana': [
        { name: 'T-Hub Seed Fund', amount: '₹25 Lakhs', eligibility: 'Tech startups incubated at T-Hub', benefits: 'Seed funding, mentorship', type: 'Grant', eligible: category === 'SaaS' || category === 'AI/ML', eligibilityStatus: (category === 'SaaS' || category === 'AI/ML') ? 'eligible' : 'partial', reasoning: 'Tech-focused startups preferred for T-Hub incubation' },
        { name: 'WE Hub Women Entrepreneur Fund', amount: '₹15-30 Lakhs', eligibility: 'Women-led startups, Telangana-based', benefits: 'Funding, incubation, women-focused support', type: 'Grant', eligible: true, eligibilityStatus: 'partial', reasoning: 'Women-led startups in Telangana qualify' }
      ],
      'Gujarat': [
        { name: 'Gujarat Startup Fund', amount: 'Up to ₹50 Lakhs', eligibility: 'Gujarat-based, DPIIT recognized', benefits: 'Seed capital, mentorship', type: 'Grant', eligible: true, eligibilityStatus: 'eligible', reasoning: 'Gujarat-based startups qualify for state seed funding' },
        { name: 'iCreate Seed Fund', amount: '₹10-25 Lakhs', eligibility: 'Product/hardware startups, Gujarat-based', benefits: 'Prototype development, market testing', type: 'Grant', eligible: true, eligibilityStatus: 'eligible', reasoning: 'Product-focused startups in Gujarat qualify' }
      ],
      'Delhi NCR': [
        { name: 'Delhi Startup Policy Fund', amount: '₹20-50 Lakhs', eligibility: 'Delhi-registered startups', benefits: 'Seed funding, subsidy on patents', type: 'Grant', eligible: true, eligibilityStatus: 'eligible', reasoning: 'Delhi-registered startups with innovative business models qualify' },
        { name: 'Delhi Innovation Fund', amount: 'Up to ₹1 Crore', eligibility: 'Tech startups, post-revenue, Delhi-based', benefits: 'Growth capital, ecosystem access', type: 'Equity', eligible: hasRevenue, eligibilityStatus: hasRevenue ? 'eligible' : 'partial', reasoning: 'Post-revenue requirement for equity funding' }
      ],
      'Kerala': [
        { name: 'Kerala Startup Mission Fund (KSUM)', amount: '₹25-50 Lakhs', eligibility: 'Kerala-based, DPIIT recognized', benefits: 'Seed funding, incubation', type: 'Grant', eligible: true, eligibilityStatus: 'eligible', reasoning: 'Kerala-based startups with innovative products qualify' },
        { name: 'Women Startup Fund - Kerala', amount: 'Up to ₹20 Lakhs', eligibility: 'Women-led startups in Kerala', benefits: 'Interest-free loans, mentorship', type: 'Loan', eligible: true, eligibilityStatus: 'partial', reasoning: 'Women-led startups qualify' }
      ],
      'Rajasthan': [
        { name: 'iStart Rajasthan', amount: 'Up to ₹25 Lakhs', eligibility: 'DPIIT recognized, Rajasthan-registered', benefits: 'Seed funding, incubation, mentorship', type: 'Grant', eligible: true, eligibilityStatus: 'eligible', reasoning: 'Rajasthan-based startups qualify' }
      ],
      'Uttar Pradesh': [
        { name: 'UP Startup Fund', amount: '₹25-50 Lakhs', eligibility: 'UP-based startups, DPIIT recognized', benefits: 'Seed funding, infrastructure support', type: 'Grant', eligible: true, eligibilityStatus: 'eligible', reasoning: 'UP-based startups qualify' }
      ],
      'Andhra Pradesh': [
        { name: 'AP Innovation Society Grant', amount: '₹10-30 Lakhs', eligibility: 'AP-registered startups, innovative solutions', benefits: 'Seed funding, incubation support', type: 'Grant', eligible: true, eligibilityStatus: 'eligible', reasoning: 'Andhra Pradesh-based startups with innovative solutions qualify' },
        { name: 'Fintech Valley Fund', amount: '₹25-75 Lakhs', eligibility: 'FinTech startups in Andhra Pradesh', benefits: 'Specialized fintech funding, ecosystem connect', type: 'Equity', eligible: category === 'FinTech', eligibilityStatus: category === 'FinTech' ? 'eligible' : 'partial', reasoning: 'FinTech startups in AP qualify for specialized funding' },
        { name: 'AP State Startup Support', amount: 'Varies by state', eligibility: 'Startups registered in Andhra Pradesh', benefits: 'Seed funding, mentorship, incubation support - check state startup portal', type: 'Grant', eligible: true, eligibilityStatus: 'eligible', reasoning: 'Andhra Pradesh-based startups may qualify for state programs - verify with state startup cell' },
        { name: 'APSFC Startup Loan Scheme', amount: 'Up to ₹50 Lakhs', eligibility: 'Andhra Pradesh registered MSMEs and startups', benefits: 'Low-interest loans, working capital support', type: 'Loan', eligible: true, eligibilityStatus: 'eligible', reasoning: 'AP-registered startups qualify for state financial corporation loans' },
        { name: 'AP IT & Electronics Policy Support', amount: 'Up to ₹25 Lakhs', eligibility: 'IT/Electronics startups in Andhra Pradesh', benefits: 'Infrastructure subsidies, power tariff concession, stamp duty exemption', type: 'Grant', eligible: category === 'SaaS' || category === 'AI/ML' || category === 'Hardware', eligibilityStatus: (category === 'SaaS' || category === 'AI/ML' || category === 'Hardware') ? 'eligible' : 'partial', reasoning: 'IT and tech startups in AP qualify for policy benefits' },
        { name: 'TIDE Andhra Pradesh', amount: 'Up to ₹15 Lakhs', eligibility: 'Tech startups in tier-2 cities of AP', benefits: 'Technology incubation, mentorship, market access', type: 'Grant', eligible: true, eligibilityStatus: 'partial', reasoning: 'Tech startups in tier-2 cities of AP qualify' },
        { name: 'AP Skill Development Startup Grant', amount: 'Up to ₹10 Lakhs', eligibility: 'Startups in skill development and education sector in AP', benefits: 'Seed grant, partnership with skill development centers', type: 'Grant', eligible: category === 'EdTech' || category === 'Education', eligibilityStatus: (category === 'EdTech' || category === 'Education') ? 'eligible' : 'partial', reasoning: 'EdTech and skill development startups in AP qualify' }
      ]
    };
    
    const userStateSchemes = stateSchemes[userState] || [];
    
    const centralSchemes = [
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
          name: 'Fund of Funds for Startups (FFS) - SIDBI',
          amount: '₹50 Lakhs - ₹10 Crores',
          eligibility: 'DPIIT recognized startups, through SEBI registered AIFs',
          benefits: 'Access to VC funding through government-backed fund of funds',
          eligible: stage !== 'Idea',
          eligibilityStatus: stage === 'Idea' ? 'partial' : 'eligible',
          reasoning: stage === 'Idea' ? 'Move past idea stage to access FFS' : 'Post-idea stage startups can access FFS through AIFs',
          type: 'Equity'
        },
        {
          name: 'NIDHI-PRAYAS (Promoting and Accelerating Young and Aspiring Innovators)',
          amount: 'Up to ₹10 Lakhs',
          eligibility: 'Innovators with proof of concept, prototyping stage',
          benefits: 'Prototype development, mentorship, access to TBI facilities',
          eligible: stage === 'Idea' || stage === 'MVP',
          eligibilityStatus: (stage === 'Idea' || stage === 'MVP') ? 'eligible' : 'partial',
          reasoning: (stage === 'Idea' || stage === 'MVP') ? 'Early-stage innovators qualify for NIDHI-PRAYAS' : 'Best suited for idea/prototype stage',
          type: 'Grant'
        },
        {
          name: 'NIDHI-SSS (Seed Support System)',
          amount: 'Up to ₹1 Crore',
          eligibility: 'Startups incubated at DST-recognized incubators',
          benefits: 'Seed funding for scaling, technology development',
          eligible: true,
          eligibilityStatus: 'partial',
          reasoning: 'Apply through DST-recognized incubator for NIDHI-SSS funding',
          type: 'Grant'
        },
        {
          name: 'NIDHI-EIR (Entrepreneur-in-Residence)',
          amount: 'Up to ₹30,000/month for 12-18 months',
          eligibility: 'Aspiring entrepreneurs working on innovative ideas',
          benefits: 'Monthly fellowship, mentorship, incubation support',
          eligible: stage === 'Idea',
          eligibilityStatus: stage === 'Idea' ? 'eligible' : 'not-eligible',
          reasoning: stage === 'Idea' ? 'Idea-stage entrepreneurs qualify for EIR fellowship' : 'EIR is for aspiring entrepreneurs with ideas',
          type: 'Fellowship'
        },
        {
          name: 'Atal Innovation Mission (AIM) - ANIC',
          amount: 'Up to ₹1 Crore',
          eligibility: 'Startups solving national/societal challenges',
          benefits: 'Grant funding, mentorship, access to Atal Incubation Centers',
          eligible: true,
          eligibilityStatus: 'eligible',
          reasoning: 'Startups addressing societal challenges can apply to ANIC',
          type: 'Grant'
        },
        {
          name: 'BIRAC BIG (Biotechnology Ignition Grant)',
          amount: 'Up to ₹50 Lakhs',
          eligibility: 'Biotech, HealthTech, AgriTech, MedTech startups',
          benefits: 'Proof of concept funding, mentorship, industry connect',
          eligible: category === 'HealthTech' || category === 'AgriTech' || category === 'Biotech',
          eligibilityStatus: (category === 'HealthTech' || category === 'AgriTech' || category === 'Biotech') ? 'eligible' : 'not-eligible',
          reasoning: (category === 'HealthTech' || category === 'AgriTech' || category === 'Biotech') ? 'Biotech/HealthTech category qualifies for BIRAC BIG' : 'BIRAC is for life sciences startups',
          type: 'Grant'
        },
        {
          name: 'BIRAC SEED Fund',
          amount: 'Up to ₹30 Lakhs',
          eligibility: 'Early-stage biotech/healthtech startups',
          benefits: 'Seed capital for R&D, prototype development',
          eligible: category === 'HealthTech' || category === 'Biotech',
          eligibilityStatus: (category === 'HealthTech' || category === 'Biotech') ? 'eligible' : 'not-eligible',
          reasoning: (category === 'HealthTech' || category === 'Biotech') ? 'HealthTech/Biotech startups qualify' : 'BIRAC SEED is for life sciences',
          type: 'Grant'
        },
        {
          name: 'MUDRA Loan - Shishu',
          amount: 'Up to ₹50,000',
          eligibility: 'Micro enterprises, small business owners',
          benefits: 'Collateral-free business loan for starting operations',
          eligible: stage === 'Idea' || stage === 'MVP',
          eligibilityStatus: (stage === 'Idea' || stage === 'MVP') ? 'eligible' : 'partial',
          reasoning: 'Early-stage micro enterprises qualify for Shishu loans',
          type: 'Loan'
        },
        {
          name: 'MUDRA Loan - Kishor',
          amount: '₹50,000 - ₹5 Lakhs',
          eligibility: 'Growing micro enterprises with some track record',
          benefits: 'Working capital, equipment purchase, business expansion',
          eligible: stage === 'MVP' || stage === 'Beta',
          eligibilityStatus: (stage === 'MVP' || stage === 'Beta') ? 'eligible' : 'partial',
          reasoning: 'Growing small businesses qualify for Kishor category',
          type: 'Loan'
        },
        {
          name: 'MUDRA Loan - Tarun',
          amount: '₹5 Lakhs - ₹10 Lakhs',
          eligibility: 'Established micro enterprises looking to scale',
          benefits: 'Higher loan amount for scaling operations',
          eligible: hasRevenue || stage === 'Growing',
          eligibilityStatus: (hasRevenue || stage === 'Growing') ? 'eligible' : 'partial',
          reasoning: hasRevenue ? 'Revenue-generating businesses qualify for Tarun' : 'Generate revenue to qualify for higher MUDRA limit',
          type: 'Loan'
        },
        {
          name: 'Stand-Up India Scheme',
          amount: '₹10 Lakhs - ₹1 Crore',
          eligibility: 'SC/ST/Women entrepreneurs, greenfield enterprise',
          benefits: 'Bank loans for manufacturing/services/trading sector',
          eligible: true,
          eligibilityStatus: 'partial',
          reasoning: 'SC/ST/Women entrepreneurs setting up new enterprise qualify',
          type: 'Loan'
        },
        {
          name: 'ASPIRE (Scheme for Promotion of Innovation and Rural Entrepreneurs)',
          amount: 'Up to ₹1 Crore',
          eligibility: 'Agri-business, rural innovation, food processing startups',
          benefits: 'Livelihood business incubator support, technology business incubator',
          eligible: category === 'AgriTech' || category === 'FoodTech',
          eligibilityStatus: (category === 'AgriTech' || category === 'FoodTech') ? 'eligible' : 'not-eligible',
          reasoning: (category === 'AgriTech' || category === 'FoodTech') ? 'AgriTech/FoodTech qualifies for ASPIRE' : 'ASPIRE is for agri/rural innovation',
          type: 'Grant'
        },
        {
          name: 'PMEGP (Prime Minister Employment Generation Programme)',
          amount: 'Up to ₹25 Lakhs (Manufacturing) / ₹10 Lakhs (Service)',
          eligibility: 'New manufacturing/service enterprises, 8th pass education',
          benefits: '15-35% subsidy on project cost, collateral-free loans',
          eligible: true,
          eligibilityStatus: 'eligible',
          reasoning: 'New enterprises in manufacturing/service sector qualify for PMEGP',
          type: 'Subsidy + Loan'
        },
        {
          name: 'CGTMSE (Credit Guarantee Trust for Micro and Small Enterprises)',
          amount: 'Up to ₹5 Crores',
          eligibility: 'MSMEs without collateral security',
          benefits: 'Collateral-free credit facility from banks',
          eligible: true,
          eligibilityStatus: 'eligible',
          reasoning: 'MSMEs can avail collateral-free credit under CGTMSE',
          type: 'Credit Guarantee'
        },
        {
          name: 'SAMRIDH (Startup Accelerators of MeitY for Product Innovation)',
          amount: 'Up to ₹40 Lakhs',
          eligibility: 'Tech startups in IT/Electronics/Deep tech',
          benefits: 'Acceleration support, funding, mentorship through MeitY accelerators',
          eligible: category === 'SaaS' || category === 'AI/ML' || category === 'Hardware' || category === 'FinTech',
          eligibilityStatus: (category === 'SaaS' || category === 'AI/ML' || category === 'Hardware' || category === 'FinTech') ? 'eligible' : 'partial',
          reasoning: (category === 'SaaS' || category === 'AI/ML' || category === 'Hardware' || category === 'FinTech') ? 'Tech startups qualify for SAMRIDH' : 'SAMRIDH is for IT/Electronics startups',
          type: 'Grant'
        },
        {
          name: 'TIDE 2.0 (Technology Incubation and Development of Entrepreneurs)',
          amount: 'Up to ₹7 Lakhs (EiR) / ₹15 Lakhs (Startup)',
          eligibility: 'Tech startups, preferably in Tier-2/3 cities',
          benefits: 'Incubation support, prototype funding, mentorship',
          eligible: category === 'SaaS' || category === 'AI/ML' || category === 'Hardware',
          eligibilityStatus: (category === 'SaaS' || category === 'AI/ML' || category === 'Hardware') ? 'eligible' : 'partial',
          reasoning: 'Tech startups in non-metro locations preferred for TIDE 2.0',
          type: 'Grant'
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
        },
        {
          name: 'NABARD (National Bank for Agriculture and Rural Development)',
          amount: 'Varies based on project',
          eligibility: 'Agri-startups, rural enterprises, agritech companies',
          benefits: 'Refinance, direct lending, grants for agri-innovation',
          eligible: category === 'AgriTech' || category === 'FoodTech',
          eligibilityStatus: (category === 'AgriTech' || category === 'FoodTech') ? 'eligible' : 'not-eligible',
          reasoning: (category === 'AgriTech' || category === 'FoodTech') ? 'Agri/FoodTech qualifies for NABARD support' : 'NABARD is for agriculture sector',
          type: 'Loan/Grant'
        },
        {
          name: 'SFURTI (Scheme of Fund for Regeneration of Traditional Industries)',
          amount: 'Up to ₹2.5 Crores per cluster',
          eligibility: 'Traditional industry clusters, artisan groups, khadi/coir/bamboo',
          benefits: 'Cluster development, skill upgradation, market access',
          eligible: category === 'Manufacturing' || category === 'Handicrafts',
          eligibilityStatus: (category === 'Manufacturing' || category === 'Handicrafts') ? 'eligible' : 'not-eligible',
          reasoning: 'Traditional industry clusters qualify for SFURTI',
          type: 'Grant'
        },
        {
          name: 'PLI Scheme (Production Linked Incentive)',
          amount: '4-6% of incremental sales',
          eligibility: 'Manufacturing companies in eligible sectors (electronics, pharma, auto, etc.)',
          benefits: 'Incentives based on production/sales, boost domestic manufacturing',
          eligible: category === 'Hardware' || category === 'Manufacturing',
          eligibilityStatus: (category === 'Hardware' || category === 'Manufacturing') ? 'partial' : 'not-eligible',
          reasoning: 'Manufacturing at scale required for PLI benefits',
          type: 'Incentive'
        },
        {
          name: 'Patent/IP Rebate for Startups',
          amount: '80% rebate on patent filing fees',
          eligibility: 'DPIIT recognized startups filing patents',
          benefits: 'Reduced patent filing costs, expedited examination',
          eligible: true,
          eligibilityStatus: 'eligible',
          reasoning: 'All DPIIT recognized startups qualify for IP rebate',
          type: 'Rebate'
        }
      ];
      
      // Sort schemes by eligibility: eligible first, then partial, then not-eligible
      const sortByEligibility = (schemes) => {
        const eligibilityOrder = { 'eligible': 0, 'partial': 1, 'not-eligible': 2 };
        return schemes.sort((a, b) => {
          const orderA = eligibilityOrder[a.eligibilityStatus] ?? 2;
          const orderB = eligibilityOrder[b.eligibilityStatus] ?? 2;
          return orderA - orderB;
        });
      };
      
      const sortedCentralSchemes = sortByEligibility(centralSchemes);
      const sortedStateSchemes = sortByEligibility(userStateSchemes.length > 0 ? userStateSchemes : [{
        name: `${userState} State Startup Support`,
        amount: 'Varies by state',
        eligibility: `Startups registered in ${userState}`,
        benefits: 'Seed funding, mentorship, incubation support - check state startup portal',
        eligible: true,
        eligibilityStatus: 'partial',
        reasoning: `${userState}-based startups may qualify for state programs - verify with state startup cell`,
        type: 'Grant'
      }]);
      
      console.log('📊 Sorted schemes by eligibility - Central:', sortedCentralSchemes.map(s => `${s.name}: ${s.eligibilityStatus}`).slice(0, 5));
      
      // Build priority message without nested template literals
      let priorityMsg = 'For ' + stage + ' stage ' + category + ' startup in ' + userState + ': ';
      if (totalInvestment < 5000000) {
        priorityMsg += 'SISFS is recommended as primary scheme for early-stage funding support. ';
      }
      if (userStateSchemes.length > 0) {
        priorityMsg += 'Also explore ' + userStateSchemes[0].name + ' for state-specific benefits. ';
      }
      if (hasRevenue) {
        priorityMsg += 'CGSS can provide collateral-free working capital for growth.';
      }
      
      res.json({
        centralSchemes: sortedCentralSchemes,
        stateSchemes: sortedStateSchemes,
        priority: priorityMsg
      });
    }
  });

// In-memory cache for competitor data - reduced to 5 mins for fresher data
const competitorCache = new Map();
const CACHE_DURATION = 0; // Disabled - always fetch fresh data

// Market Trends & Competitor Analysis endpoint
app.post('/api/analysis/competitors', authenticateToken, async (req, res) => {
  try {
    const { category, userMentionedCompetitors, stage, revenue, productDescription } = req.body;
    const userId = req.user.userId;
    const productStage = stage || 'Idea'; // Default stage if not provided

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
    
    // Determine the actual industry from user-mentioned competitors or category
    let industry = category;
    // Detect industry from user-mentioned competitors
    const competitorStr = mentionedComps.join(' ').toLowerCase();
    if (competitorStr.includes('casa') || competitorStr.includes('hiranandani') || competitorStr.includes('godrej') || 
        competitorStr.includes('dlf') || competitorStr.includes('prestige') || competitorStr.includes('sobha') ||
        competitorStr.includes('lodha') || competitorStr.includes('mahindra life') || competitorStr.includes('brigade')) {
      industry = 'Real Estate & Construction';
    } else if (competitorStr.includes('zomato') || competitorStr.includes('swiggy') || competitorStr.includes('rebel')) {
      industry = 'FoodTech';
    } else if (competitorStr.includes('zerodha') || competitorStr.includes('groww') || competitorStr.includes('razorpay')) {
      industry = 'FinTech';
    }
    
    // Create cache key based on industry and user-mentioned competitors
    const cacheKey = `${industry}_${mentionedComps.sort().join('_')}`;
    
    // Check if we have a recent cached result
    const cachedResult = competitorCache.get(cacheKey);
    if (cachedResult && (Date.now() - cachedResult.timestamp) < CACHE_DURATION) {
      console.log('📦 Returning cached competitor data for:', industry);
      return res.json(cachedResult.data);
    }

    console.log('📊 Fetching DYNAMIC competitor data for:', industry, 'User mentioned:', mentionedComps);

    // Build the search query based on user context
    const userCompCount = mentionedComps.length;
    
    // Create specific search query for Google
    let searchQuery = `${industry} companies India valuation revenue 2024`;
    if (mentionedComps.length > 0) {
      searchQuery = `${mentionedComps.join(' ')} company valuation revenue funding market cap 2024`;
    }
    
    const searchPrompt = `You are a financial research analyst with access to Google Search. Search for REAL, CURRENT data about companies.

SEARCH QUERIES TO EXECUTE:
1. "${searchQuery}"
${mentionedComps.map(c => `2. "${c} company valuation revenue 2024"`).join('\n')}

## CRITICAL RULES:
1. Return ONLY real company names from search results - NO placeholders like "Startup A", "Company B", "Industry Leader", "Other Startup", "Hardware,Other Startup A"
2. NEVER use generic names - each company MUST be a verifiable real company that exists
3. DO NOT include the category/industry in the company name (e.g., use "Casagrand" not "Real Estate,Casagrand")
4. All monetary values must be in INR (Indian Rupees)
5. Search for actual market cap, revenue, funding data from news articles, company websites, Crunchbase, etc.
6. If you cannot find a real company, DO NOT make up a placeholder name - simply omit that entry
7. If exact data not found, provide reasonable estimates based on company stage and industry benchmarks

## FORBIDDEN COMPANY NAMES (never use these patterns):
- "Startup A", "Startup B", "Company A", "Company B"
- "Industry Leader", "Market Leader", "Global Leader"
- "Other Startup", "Hardware,Other Startup A"
- Any name with comma followed by generic term
- Any name ending with single letter (A, B, C, etc.)

## COMPANIES TO RESEARCH:
${mentionedComps.length > 0 ? `### USER'S COMPETITORS (MUST INCLUDE - mark as "region": "user-pick", "isUserMentioned": true):
${mentionedComps.map((c, i) => `${i + 1}. ${c} - Search: "${c} company India valuation revenue funding"`).join('\n')}` : ''}

### ADDITIONAL COMPETITORS TO FIND:
- 2 GLOBAL market leaders in ${industry} (mark as "region": "global") - USE REAL COMPANY NAMES ONLY
- 2 INDIAN market leaders in ${industry} (mark as "region": "local") - USE REAL COMPANY NAMES ONLY
- 1 Emerging Indian competitor/rival (mark as "region": "rival") - USE REAL COMPANY NAME ONLY

## DATA REQUIREMENTS (search for each company - ALL FIELDS REQUIRED):
- currentValuation: Market cap or last valuation in INR (e.g., ₹5000 Cr = 50000000000)
- revenue: Annual revenue in INR (REQUIRED - search for actual revenue figures)
- growthRate: Year-over-year revenue/valuation growth percentage (REQUIRED - calculate from available data, e.g., if revenue grew from 100Cr to 150Cr, growth = 50%)
- customers: Number of customers/users/subscribers (REQUIRED - search for user base numbers)
- foundedYear: When company was established
- stage: Private/Public/Series A/B/C etc.
- flagshipProduct: Main product or service

IMPORTANT: For growthRate, if exact data is not available, estimate based on:
- Funding round progression (e.g., Series A to Series B typically 2-3x growth)
- Industry average growth rates (FoodTech: 25-40%, FinTech: 30-50%, SaaS: 20-35%)
- Company stage (early stage: 50-100%, growth stage: 20-50%, mature: 10-20%)

## OUTPUT FORMAT (JSON only, no markdown, no explanation):
{
  "competitors": [
    {
      "name": "Real Company Name",
      "category": "${industry}",
      "stage": "Public",
      "region": "user-pick",
      "headquarters": "City, India",
      "foundedYear": 2000,
      "currentValuation": 50000000000,
      "flagshipProduct": "Main Product/Service",
      "products": ["Product 1", "Product 2"],
      "valuationTimeline": [
        {"year": 2000, "valuation": 10000000, "event": "Founded"},
        {"year": 2015, "valuation": 10000000000, "event": "Growth"},
        {"year": 2024, "valuation": 50000000000, "event": "Current"}
      ],
      "revenue": 35000000000,
      "growthRate": 22,
      "customers": 25000,
      "fundingRaised": 5000000000,
      "visible": true,
      "isUserMentioned": true,
      "isDataPublic": true
    }
  ],
  "marketTrends": [
    {"title": "${industry} Market Size", "value": "$X Billion", "description": "Market description"},
    {"title": "Growth Rate", "value": "X%", "description": "Industry CAGR"}
  ]
}

IMPORTANT: Every company in the response MUST be a real, verifiable company. Search Google for each one.`;

    try {
      // Use Google Search grounded Gemini for real data
      const searchResponse = await callGeminiWithSearch(searchPrompt, 
        `You are a financial data analyst specializing in ${industry}. Return ONLY real company names with verified data. Never use placeholder names like "Startup A" or "Industry Leader". All companies must be real and verifiable.`);
      
      // Clean and parse response - more robust cleaning
      let content = searchResponse;
      
      // Remove markdown code blocks
      content = content.replaceAll(/```json\s*/gi, '');
      content = content.replaceAll(/```\s*/gi, '');
      
      // Remove any text before the first { and after the last }
      const firstBrace = content.indexOf('{');
      const lastBrace = content.lastIndexOf('}');
      
      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        content = content.substring(firstBrace, lastBrace + 1);
      }
      
      // Fix common JSON issues
      content = content.trim();
      content = content.replaceAll(/,\s*}/g, '}'); // Remove trailing commas before }
      content = content.replaceAll(/,\s*]/g, ']'); // Remove trailing commas before ]
      content = content.replaceAll(/[\u201C\u201D]/g, '"'); // Replace fancy quotes
      content = content.replaceAll(/[\u2018\u2019]/g, "'"); // Replace fancy apostrophes
      
      let analysis;
      try {
        analysis = JSON.parse(content);
      } catch (parseError) {
        console.error('JSON parse failed, trying to extract competitors array:', parseError.message);
        
        // Try to extract just the competitors array
        const competitorsMatch = content.match(/"competitors"\s*:\s*\[([\s\S]*?)\]/);
        if (competitorsMatch) {
          try {
            const competitorsJson = '[' + competitorsMatch[1] + ']';
            const competitors = JSON.parse(competitorsJson.replaceAll(/,\s*]/g, ']'));
            analysis = { competitors };
          } catch (extractError) {
            console.error('Failed to extract competitors:', extractError.message);
            throw parseError; // Re-throw original error
          }
        } else {
          throw parseError;
        }
      }
      
      // Validate that competitors array exists and has data
      if (!analysis.competitors || !Array.isArray(analysis.competitors) || analysis.competitors.length === 0) {
        console.warn('No competitors in API response, falling back to defaults');
        throw new Error('No competitors returned from API');
      }
      
      // Filter out any generic/placeholder names
      const genericPatterns = [
        /^(startup|company|business|competitor|industry|leader|rival|player)\s*[a-z0-9]*$/i,
        /^(other|generic|unknown|sample|example|test)\s/i,
        /hardware.*startup/i,
        /other.*startup/i,
        /startup\s*[a-z]$/i,
        /company\s*[a-z]$/i,
        /^[a-z]\s+(company|startup|business)$/i,
        /^(new|emerging|local|global)\s+(startup|company|player)/i,
        /^industry\s+leader$/i,
        /,\s*other/i,
        /hardware\s*,/i,  // Catches "Hardware," prefix
        /,\s*hardware/i,  // Catches ", Hardware" suffix
        /other\s+startup\s*[a-z]?$/i, // Catches "Other Startup A/B/C"
        /startup\s+[a-e]$/i,  // Catches "Startup A", "Startup B" etc.
        /^[a-z]+,\s*(other|startup|company)/i, // Catches "Category, Other" patterns
        /^(real estate|software|hardware|fintech|edtech|healthtech)\s*,/i // Catches category prefixes
      ];
      
      analysis.competitors = analysis.competitors.filter(comp => {
        if (!comp.name || typeof comp.name !== 'string') return false;
        const name = comp.name.trim().toLowerCase();
        
        // Check if name contains comma with generic terms (e.g., "Hardware,Other Startup A")
        if (comp.name.includes(',') && (name.includes('startup') || name.includes('other') || name.includes('company'))) {
          console.warn('⚠️ Filtering out combined generic name:', comp.name);
          return false;
        }
        
        // Check if name starts with a category followed by comma (e.g., "Hardware,Other Startup")
        if (/^[a-zA-Z\s]+,/.test(comp.name.trim()) && (name.includes('startup') || name.includes('other') || name.includes('leader'))) {
          console.warn('⚠️ Filtering out category-prefixed generic name:', comp.name);
          return false;
        }
        
        // Check if name ends with single letter like "Startup A", "Company B"
        if (/\s[a-e]$/i.test(comp.name.trim())) {
          console.warn('⚠️ Filtering out letter-suffixed name:', comp.name);
          return false;
        }
        
        // Check if name contains "Other Startup" pattern anywhere
        if (/other\s+startup/i.test(comp.name.trim())) {
          console.warn('⚠️ Filtering out "Other Startup" pattern:', comp.name);
          return false;
        }
        
        // Check for generic patterns
        for (const pattern of genericPatterns) {
          if (pattern.test(comp.name.trim())) {
            console.warn('⚠️ Filtering out generic competitor name:', comp.name);
            return false;
          }
        }
        // Name should be at least 2 characters and not just letters like "A", "B"
        if (comp.name.trim().length < 3 || /^[a-zA-Z]$/.test(comp.name.trim())) {
          console.warn('⚠️ Filtering out invalid competitor name:', comp.name);
          return false;
        }
        return true;
      });
      
      console.log(`📊 Parsed ${analysis.competitors.length} valid competitors from API response`);
      
      // Post-process competitors to ensure all required fields exist with valid data
      // and categorize into verified vs potential competitors
      const verifiedCompetitors = [];
      const potentialCompetitors = [];
      
      if (analysis.competitors) {
        analysis.competitors.forEach(comp => {
          // Skip invalid entries
          if (!comp.name || typeof comp.name !== 'string') {
            console.warn('Skipping invalid competitor entry:', comp);
            return;
          }
          
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
          
          // If still no growth rate, estimate based on company stage and category
          if (!growthRate || growthRate === 0) {
            const stageGrowthEstimates = {
              'Seed': 80,
              'Series A': 60,
              'Series B': 45,
              'Series C': 35,
              'Series D': 28,
              'Series E': 22,
              'Series F': 18,
              'Series G': 15,
              'Series H': 12,
              'Series I': 10,
              'Series J': 8,
              'Public': 15,
              'Private': 25,
              'Acquired': 10,
              'Growth': 35,
              'Late Stage': 20,
              'Pre-IPO': 25
            };
            
            // Category-based growth multipliers
            const categoryMultipliers = {
              'FoodTech': 1.3,
              'Food Delivery': 1.3,
              'FinTech': 1.4,
              'SaaS': 1.2,
              'E-commerce': 1.25,
              'EdTech': 1.15,
              'HealthTech': 1.2,
              'AI/ML': 1.5,
              'Marketplace': 1.3,
              'Real Estate': 0.8,
              'Hardware': 0.9
            };
            
            const stage = comp.stage || 'Private';
            const baseGrowth = stageGrowthEstimates[stage] || 20;
            const categoryMultiplier = categoryMultipliers[category] || 1.0;
            
            // Add some variation based on company characteristics
            let estimatedGrowth = Math.round(baseGrowth * categoryMultiplier);
            
            // If company has high revenue/customers, they're likely growing
            if (comp.revenue > 100000000000) { // > 1000 Cr revenue
              estimatedGrowth = Math.max(estimatedGrowth, 15);
            }
            if (comp.customers > 1000000) { // > 1M customers
              estimatedGrowth = Math.max(estimatedGrowth, 20);
            }
            
            growthRate = estimatedGrowth;
            console.log(`📈 Estimated growth rate for ${comp.name}: ${growthRate}% (stage: ${stage}, category: ${category})`);
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
            region: comp.region || 'local', // global, local, rival, or user-pick
            isDataPublic: (comp.revenue && comp.revenue > 0) || (comp.customers && comp.customers > 0) || (currentValuation > 0),
            isUserMentioned: comp.isUserMentioned || comp.region === 'user-pick' || mentionedComps.some(m => 
              comp.name.toLowerCase().includes(m.toLowerCase()) || 
              m.toLowerCase().includes(comp.name.toLowerCase())
            )
          };
          
          // Update region to user-pick if it's a user-mentioned competitor
          if (processedComp.isUserMentioned && processedComp.region !== 'user-pick') {
            processedComp.region = 'user-pick';
          }
          
          if (isVerified) {
            verifiedCompetitors.push(processedComp);
          } else {
            potentialCompetitors.push(processedComp);
          }
        });
      }
      
      // Categorize by region type
      const allCompetitors = [...verifiedCompetitors, ...potentialCompetitors];
      const userPickCompetitors = allCompetitors.filter(c => c.isUserMentioned || c.region === 'user-pick');
      const globalCompetitors = allCompetitors.filter(c => (c.region === 'global' || c.region === 'international') && !c.isUserMentioned);
      const localCompetitors = allCompetitors.filter(c => c.region === 'local' && !c.isUserMentioned);
      const rivalCompetitors = allCompetitors.filter(c => c.region === 'rival' && !c.isUserMentioned);
      
      // Return categorized competitors
      const result = {
        ...analysis,
        competitors: allCompetitors, // All competitors
        verifiedCompetitors: verifiedCompetitors,
        potentialCompetitors: potentialCompetitors,
        userPickCompetitors: userPickCompetitors,
        globalCompetitors: globalCompetitors,
        localCompetitors: localCompetitors,
        rivalCompetitors: rivalCompetitors,
        summary: {
          totalCompetitors: allCompetitors.length,
          userPickCount: userPickCompetitors.length,
          globalCount: globalCompetitors.length,
          localCount: localCompetitors.length,
          rivalCount: rivalCompetitors.length,
          verifiedCount: verifiedCompetitors.length,
          potentialCount: potentialCompetitors.length,
          userMentionedCount: userPickCompetitors.length
        }
      };
      
      // Cache successful result
      competitorCache.set(cacheKey, {
        timestamp: Date.now(),
        data: result
      });
      
      console.log('✅ Valuation timeline data fetched via Google Search for', category);
      console.log(`   - User picks: ${userPickCompetitors.length}, Global: ${globalCompetitors.length}, Local: ${localCompetitors.length}, Rival: ${rivalCompetitors.length}`);
      return res.json(result);
      
    } catch (searchError) {
      console.warn('Google Search grounding failed:', searchError.message);
      // Return error - no fallback, let AI always search
      return res.status(503).json({ 
        error: 'Competitor analysis temporarily unavailable. Please try again in a few seconds.',
        retryAfter: 5
      });
    }

  } catch (error) {
    console.error('Competitor analysis error:', error.message);
    
    // Return error response - no static fallback
    return res.status(500).json({
      error: 'Failed to fetch competitor data. Please try again.',
      message: error.message
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
      let cleanText = text.replaceAll(/```json\n?/g, '').replaceAll(/```\n?/g, '').trim();
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
    let systemPrompt = `You are Daddy, an AI Strategic Advisor for startups and entrepreneurs. You have analyzed the user's business data and help them with strategic planning, market analysis, financial projections, growth strategies, and funding guidance.

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

${context.competitorAnalysis ? `
Competitor Analysis:
${context.competitorAnalysis.userMentionedCompetitors ? `User-Mentioned Competitors: ${context.competitorAnalysis.userMentionedCompetitors}` : ''}
${context.competitorAnalysis.verifiedCompetitors?.length > 0 ? `Verified Competitors:
${context.competitorAnalysis.verifiedCompetitors.map(c => `- ${c.name}: Stage=${c.stage || 'N/A'}, Valuation=₹${c.currentValuation ? (c.currentValuation/10000000).toFixed(1) + ' Cr' : 'N/A'}, Revenue=₹${c.revenue ? (c.revenue/10000000).toFixed(1) + ' Cr' : 'N/A'}, Customers=${c.customers || 'N/A'}, Funding=₹${c.fundingRaised ? (c.fundingRaised/10000000).toFixed(1) + ' Cr' : 'N/A'}, Product=${c.flagshipProduct || 'N/A'}, Region=${c.region || 'N/A'}`).join('\n')}` : ''}
${context.competitorAnalysis.globalCompetitors?.length > 0 ? `Global Competitors:
${context.competitorAnalysis.globalCompetitors.map(c => `- ${c.name}: Stage=${c.stage || 'N/A'}, Valuation=₹${c.currentValuation ? (c.currentValuation/10000000).toFixed(1) + ' Cr' : 'N/A'}, Product=${c.flagshipProduct || 'N/A'}`).join('\n')}` : ''}
${context.competitorAnalysis.localCompetitors?.length > 0 ? `Local/Indian Competitors:
${context.competitorAnalysis.localCompetitors.map(c => `- ${c.name}: Stage=${c.stage || 'N/A'}, Valuation=₹${c.currentValuation ? (c.currentValuation/10000000).toFixed(1) + ' Cr' : 'N/A'}, Product=${c.flagshipProduct || 'N/A'}`).join('\n')}` : ''}
${context.competitorAnalysis.rivalCompetitors?.length > 0 ? `Direct Rivals:
${context.competitorAnalysis.rivalCompetitors.map(c => `- ${c.name}: Stage=${c.stage || 'N/A'}, Valuation=₹${c.currentValuation ? (c.currentValuation/10000000).toFixed(1) + ' Cr' : 'N/A'}, Product=${c.flagshipProduct || 'N/A'}`).join('\n')}` : ''}
${context.competitorAnalysis.potentialCompetitors?.length > 0 ? `Potential Competitors:
${context.competitorAnalysis.potentialCompetitors.map(c => `- ${c.name}: Stage=${c.stage || 'N/A'}, Valuation=₹${c.currentValuation ? (c.currentValuation/10000000).toFixed(1) + ' Cr' : 'N/A'}, Product=${c.flagshipProduct || 'N/A'}`).join('\n')}` : ''}
${context.competitorAnalysis.allCompetitors?.length > 0 && !context.competitorAnalysis.verifiedCompetitors?.length && !context.competitorAnalysis.globalCompetitors?.length ? `All Competitors:
${context.competitorAnalysis.allCompetitors.slice(0, 5).map(c => `- ${c.name}: Stage=${c.stage || 'N/A'}, Valuation=₹${c.currentValuation ? (c.currentValuation/10000000).toFixed(1) + ' Cr' : 'N/A'}, Growth=${c.growthRate || 'N/A'}%`).join('\n')}` : ''}
${context.competitorAnalysis.summary ? `Summary: ${context.competitorAnalysis.summary}` : ''}` : ''}

Your role:
1. Provide strategic, data-driven insights based on the company's actual data
2. Answer questions about valuation methodologies, scores, and metrics
3. Help with "what-if" scenarios (e.g., impact of revenue growth, team expansion)
4. Offer actionable advice for growth, funding, and competitive positioning
5. Explain SWOT analysis, market trends, and funding schemes
6. When asked about competitors, use the Competitor Analysis data above to provide detailed insights about market positioning, competitive threats, and differentiation strategies

Keep responses concise, actionable, and personalized to ${context.company?.name || 'this business'}.`;

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
      const goal = context.company?.primaryGoal || 'your goals';
      const stage = context.company?.stage || 'current stage';
      const valDisplay = context.valuation ? '₹' + (context.valuation.finalValuationINR / 10000000).toFixed(2) + ' Cr' : 'TBD';
      fallbackResponse = 'You\'re looking to raise ' + needed + ' for ' + goal + '. Based on your ' + stage + ', consider approaching angel investors or early-stage VCs. Your valuation of ' + valDisplay + ' will help determine equity dilution.';
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

// Create a new note (alternative endpoint for direct note creation)
app.post('/api/notes', authenticateToken, async (req, res) => {
  try {
    const { chatMessage, response, noteTitle, category } = req.body;
    const userId = req.user.userId;

    console.log('📝 Creating note for user:', userId, { noteTitle, category });

    if (!noteTitle || !response) {
      console.error('❌ Note creation failed: Missing title or content');
      return res.status(400).json({ error: 'Note title and content are required' });
    }

    const note = {
      userId,
      chatMessage: chatMessage || 'Manual Note',
      response,
      noteTitle: noteTitle,
      category: category || 'General',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await notesCollection.insertOne(note);
    
    console.log('✅ Note created successfully:', result.insertedId);
    
    // Return the full note with its ID
    res.json({ 
      success: true, 
      noteId: result.insertedId,
      note: { ...note, _id: result.insertedId },
      message: 'Note created successfully' 
    });
  } catch (error) {
    console.error('❌ Error creating note:', error);
    res.status(500).json({ error: 'Failed to create note', details: error.message });
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
      .limit(Number.parseInt(limit))
      .skip(Number.parseInt(skip))
      .toArray();

    const total = await notesCollection.countDocuments(query);

    res.json({ 
      notes, 
      total,
      hasMore: total > (Number.parseInt(skip) + notes.length)
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

    // Validate ObjectId to prevent crashes
    if (!isValidObjectId(id)) {
      return res.status(400).json({ error: 'Invalid note ID format' });
    }

    const updateFields = {
      updatedAt: new Date()
    };

    // Sanitize inputs
    if (noteTitle) updateFields.noteTitle = sanitizeInput(noteTitle);
    if (category) updateFields.category = sanitizeInput(category);

    const result = await notesCollection.updateOne(
      { _id: new ObjectId(id), userId },
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

    // Validate ObjectId to prevent crashes
    if (!isValidObjectId(id)) {
      return res.status(400).json({ error: 'Invalid note ID format' });
    }

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
    actionsText = actionsText.replaceAll(/```json\n?/g, '').replaceAll(/```\n?/g, '').trim();
    
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
    
    const newAIActions = parsedActions.actions.map((action, index) => ({
      id: `${Date.now()}-${index}`,
      text: action.text,
      priority: action.priority || 'medium',
      status: 'pending',
      progress: null,
      isCustom: false,
      createdAt: new Date()
    }));

    // Check for existing document to preserve custom actions
    const existingDoc = await actionsCollection.findOne({ userId, date: today });
    let customActions = [];
    if (existingDoc && existingDoc.actions) {
      customActions = existingDoc.actions.filter(a => a.isCustom === true);
    }

    const allActions = [...newAIActions, ...customActions];
    
    const actionsDoc = {
      userId,
      date: today,
      sixMonthGoal,
      actions: allActions,
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

    // Get backlog items (accepted items from previous days not marked green)
    const backlogDocs = await actionsCollection.find({
      userId,
      date: { $lt: today }
    }).sort({ date: -1 }).limit(30).toArray();

    const backlog = [];
    backlogDocs.forEach(doc => {
      doc.actions.forEach(action => {
        // Include accepted actions that are not completed (green)
        if (action.status === 'accepted' && action.progress !== 'green') {
          backlog.push({
            ...action,
            originalDate: doc.date,
            movedToBacklogAt: doc.date
          });
        }
      });
    });

    // Sort backlog by date (oldest first)
    backlog.sort((a, b) => new Date(a.originalDate).getTime() - new Date(b.originalDate).getTime());

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

// Update action progress (red/amber/green) - works for today's actions and backlog
app.put('/api/actions/:actionId/progress', authenticateToken, async (req, res) => {
  try {
    const { actionId } = req.params;
    const { progress } = req.body;
    const userId = req.user.userId;

    // Try to update in any document (today or previous days for backlog)
    const result = await actionsCollection.updateOne(
      { userId, 'actions.id': actionId },
      { $set: { 'actions.$.progress': progress } }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ error: 'Action not found' });
    }

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

// Add custom action
app.post('/api/actions/custom', authenticateToken, async (req, res) => {
  try {
    const { text } = req.body;
    const userId = req.user.userId;

    if (!text || text.trim().length === 0) {
      return res.status(400).json({ error: 'Action text is required' });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const newAction = {
      id: `custom-${Date.now()}`,
      text: text.trim(),
      priority: 'medium',
      status: 'accepted',
      progress: 'red',
      isCustom: true,
      createdAt: new Date()
    };

    // Check if there's an existing actions document for today
    const existingDoc = await actionsCollection.findOne({ userId, date: today });

    if (existingDoc) {
      // Add to existing actions array
      await actionsCollection.updateOne(
        { userId, date: today },
        { $push: { actions: newAction } }
      );
    } else {
      // Create new document for today
      await actionsCollection.insertOne({
        userId,
        date: today,
        actions: [newAction],
        createdAt: new Date()
      });
    }

    res.json({ success: true, action: newAction });
  } catch (error) {
    console.error('Error adding custom action:', error);
    res.status(500).json({ error: 'Failed to add custom action' });
  }
});

// Delete custom action
app.delete('/api/actions/:actionId', authenticateToken, async (req, res) => {
  try {
    const { actionId } = req.params;
    const userId = req.user.userId;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    await actionsCollection.updateOne(
      { userId, date: today },
      { $pull: { actions: { id: actionId } } }
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting action:', error);
    res.status(500).json({ error: 'Failed to delete action' });
  }
});

// =====================================================
// PROPOSAL GENERATION ENDPOINT
// =====================================================

// Generate funding proposal using AI
app.post('/api/proposal/generate', authenticateToken, async (req, res) => {
  try {
    const { scheme, company, valuation } = req.body;
    const userId = req.user.userId;

    // Check rate limit
    const rateLimitCheck = geminiRateLimiter.checkLimit(userId);
    if (!rateLimitCheck.allowed) {
      return res.status(429).json({ 
        error: `Rate limit exceeded. Please try again in ${rateLimitCheck.resetIn} minutes.`
      });
    }

    console.log('📝 Generating proposal for:', scheme.name, 'by', company.name);

    const prompt = `You are an expert grant proposal writer with deep knowledge of Indian government startup funding schemes. Generate a professional funding proposal for the following:

SCHEME DETAILS:
- Name: ${scheme.name}
- Amount Available: ${scheme.amount || 'As per guidelines'}
- Type: ${scheme.type || 'Grant'}
- Eligibility: ${scheme.eligibility}
- Benefits: ${scheme.benefits}

COMPANY DETAILS:
- Company Name: ${company.name}
- Description: ${company.description || 'Technology startup'}
- Category: ${company.category || 'Technology'}
- Stage: ${company.stage || 'Growth'}
- Location: ${company.state || 'India'}
- Unique Value Proposition: ${company.uniqueValue || 'Innovative solution'}
- Target Customer: ${company.targetCustomer || 'B2B/B2C customers'}
- Team Size: ${company.teamSize || 'Small team'}
- Founder Background: ${company.founderBackground || 'Experienced entrepreneur'}
- Monthly Revenue: ₹${company.monthlyRevenue || 0}
- Total Investment: ₹${company.totalInvestment || 0}
- Customers: ${company.customers || 0}
- Primary Goal: ${company.primaryGoal || 'Growth and scaling'}
- Funding Needed For: ${company.fundingNeeded || 'Business expansion'}
${valuation ? `- Current Valuation: ₹${(valuation.finalValuationINR / 10000000).toFixed(2)} Crores` : ''}

PROVEN SUCCESS FACTORS FOR ${scheme.name}:
1. Clear problem-solution fit demonstration
2. Scalable business model with defined metrics
3. Strong team with relevant experience
4. Realistic financial projections
5. Clear use of funds aligned with scheme objectives
6. Innovation quotient and market differentiation
7. Social/economic impact potential
8. Exit strategy or sustainability plan

Generate a comprehensive proposal with these sections in JSON format:
{
  "executiveSummary": "2-3 paragraph compelling summary highlighting key strengths and alignment with scheme objectives",
  "companyOverview": "Detailed description of the company, its mission, and achievements",
  "problem": "Clear articulation of the market problem being solved",
  "solution": "How the company's product/service solves this problem uniquely",
  "marketOpportunity": "Market size, growth potential, and target segment analysis",
  "traction": ["List of 4-5 key traction metrics and achievements"],
  "useOfFunds": ["5-6 specific ways the funding will be utilized with percentages"],
  "whyThisScheme": "Why this company is an ideal candidate for this specific scheme",
  "teamDescription": "Description of team strengths and relevant experience",
  "conclusion": "Strong closing statement reinforcing the value proposition"
}

Make the proposal:
1. Professional and formal in tone
2. Specific to the ${scheme.name} scheme requirements
3. Highlight innovation and impact potential
4. Include realistic and achievable milestones
5. Align with government's startup ecosystem goals

Return ONLY valid JSON, no markdown or code blocks.`;

    try {
      const response = await callGemini(prompt, 'You are an expert grant proposal writer. Return only valid JSON.');
      
      // Clean and parse response
      let content = response.replaceAll(/```json\n?/g, '').replaceAll(/```\n?/g, '').trim();
      
      // Try to extract JSON
      const firstBrace = content.indexOf('{');
      const lastBrace = content.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace !== -1) {
        content = content.substring(firstBrace, lastBrace + 1);
      }
      
      const proposal = JSON.parse(content);
      
      console.log('✅ Proposal generated successfully for:', company.name);
      res.json({ success: true, proposal });
      
    } catch (aiError) {
      console.warn('AI proposal generation failed:', aiError.message);
      
      // Return a template-based fallback
      res.json({
        success: true,
        proposal: {
          executiveSummary: `${company.name} is a ${company.stage || 'growing'} ${company.category || 'technology'} company seeking funding under ${scheme.name}. Our innovative solution addresses critical market needs and demonstrates strong potential for growth and impact. With a clear vision and experienced team, we are well-positioned to utilize this funding effectively to achieve our milestones and contribute to India's startup ecosystem.`,
          companyOverview: company.description || `${company.name} is an innovative company in the ${company.category} space.`,
          problem: `The market faces significant challenges that ${company.name} is uniquely positioned to solve through its innovative approach.`,
          solution: company.uniqueValue || `Our solution provides a unique value proposition that differentiates us from competitors.`,
          marketOpportunity: `Our target market of ${company.targetCustomer || 'customers'} represents a significant opportunity with strong growth potential.`,
          traction: [
            company.customers ? `${company.customers}+ customers acquired` : 'Building strong customer pipeline',
            company.monthlyRevenue ? `₹${Number(company.monthlyRevenue).toLocaleString('en-IN')} monthly revenue` : 'Pre-revenue with strong interest',
            'Positive customer feedback and retention',
            'Strategic partnerships in development',
            'Technology platform validated and scalable'
          ],
          useOfFunds: [
            '40% - Product Development & Enhancement',
            '25% - Market Expansion & Customer Acquisition',
            '20% - Team Building & Operations',
            '10% - Technology Infrastructure',
            '5% - Legal & Compliance'
          ],
          whyThisScheme: `${company.name} aligns perfectly with ${scheme.name} objectives due to our innovative approach, scalable model, and commitment to creating impact in the ${company.category} sector.`,
          teamDescription: `Led by ${company.founderBackground || 'experienced founders'}, our team of ${company.teamSize || 'dedicated professionals'} brings together diverse expertise to execute our vision.`,
          conclusion: `We believe ${scheme.name} funding will be instrumental in accelerating our growth trajectory and achieving our mission. We are committed to maximizing the impact of this investment and contributing to India's innovation ecosystem.`
        }
      });
    }
    
  } catch (error) {
    console.error('Proposal generation error:', error);
    res.status(500).json({ error: 'Failed to generate proposal' });
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
    newsText = newsText.replaceAll(/```json\n?/g, '').replaceAll(/```\n?/g, '').trim();

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

// Start server with optional clustering
const numCPUs = os.cpus().length;
const ENABLE_CLUSTERING = process.env.ENABLE_CLUSTERING === 'true' && process.env.NODE_ENV === 'production';

if (ENABLE_CLUSTERING && cluster.isPrimary) {
  console.log(`🔧 Primary process ${process.pid} starting ${numCPUs} workers...`);
  
  // Fork workers for each CPU core
  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }
  
  cluster.on('exit', (worker, code, signal) => {
    console.log(`⚠️ Worker ${worker.process.pid} died (${signal || code}). Restarting...`);
    cluster.fork();
  });
  
  cluster.on('online', (worker) => {
    console.log(`✅ Worker ${worker.process.pid} is online`);
  });
} else {
  // Single process mode (development) or worker process (production)
  connectDB().then(() => {
    app.listen(PORT, () => {
      const workerId = ENABLE_CLUSTERING ? `Worker ${process.pid}` : 'Server';
      console.log(`🚀 ${workerId} running on http://localhost:${PORT}`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`💪 CPU Cores: ${numCPUs} | Clustering: ${ENABLE_CLUSTERING ? 'ENABLED' : 'DISABLED'}`);
      if (process.env.NODE_ENV === 'production') {
        console.log(`✅ Static file serving enabled`);
        console.log(`📂 Serving from: ${path.join(__dirname, '../build')}`);
      }
    });
  }).catch((error) => {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  });
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});
