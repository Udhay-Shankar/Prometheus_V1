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

// General rate limiter for all requests - CONFIGURED FOR 50 TPS
// Rate limit for 50 TPS = 3000 req/min, set to 3600 for 20% buffer
const generalLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute window
  max: 3600, // 3600 requests per minute (supports 50 TPS with 20% buffer)
  message: { error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', generalLimiter);

// Auth rate limiter - supports 50 TPS for auth endpoints
const authLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute window
  max: 600, // 600 auth requests per minute (10 TPS auth capacity)
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
let gtmTasksCollection;
let gtmFollowupsCollection;

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
    gtmTasksCollection = db.collection('gtm-tasks');
    gtmFollowupsCollection = db.collection('gtm-followups');
    
    // Create unique index on email field to prevent duplicate signups
    await usersCollection.createIndex({ email: 1 }, { unique: true });
    
    // Create index on userId for notes for faster queries
    await notesCollection.createIndex({ userId: 1 });
    
    // Create index on userId for actions
    await actionsCollection.createIndex({ userId: 1 });
    
    // Create indexes for GTM tasks
    await gtmTasksCollection.createIndex({ userId: 1 });
    await gtmTasksCollection.createIndex({ userId: 1, status: 1 });
    await gtmTasksCollection.createIndex({ nextFollowup: 1 });
    
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
// Configured for 50 TPS system capacity
const geminiRateLimiter = {
  requests: new Map(), // userId -> { count, resetTime }
  maxRequests: 1000, // Max requests per user per hour (higher for production)
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
      valuation: req.body.valuation || null, // Store calculated valuation
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

// Update DDQ with valuation after calculation
app.post('/api/ddq/update-valuation', authenticateToken, async (req, res) => {
  try {
    const { valuation } = req.body;
    
    // Update the latest DDQ record for this user with the calculated valuation
    const result = await ddqCollection.updateOne(
      { userId: req.user.userId },
      { $set: { valuation: valuation, valuationUpdatedAt: new Date() } },
      { sort: { createdAt: -1 } }
    );
    
    // If no document was updated with the simple query, find the latest and update it
    if (result.matchedCount === 0) {
      const latestDDQ = await ddqCollection.findOne(
        { userId: req.user.userId },
        { sort: { createdAt: -1 } }
      );
      
      if (latestDDQ) {
        await ddqCollection.updateOne(
          { _id: latestDDQ._id },
          { $set: { valuation: valuation, valuationUpdatedAt: new Date() } }
        );
      }
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('DDQ valuation update error:', error);
    res.status(500).json({ error: 'Failed to update valuation' });
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

// In-memory cache for news (6-hour expiry)
const newsCache = new Map();

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
      
      console.log(`📊 Step 1 filter: ${analysis.competitors.length} competitors passed basic validation`);
      
      // ====== 2-STEP VALIDATION ======
      // Step 2: Verify each competitor name is a real company by checking for key indicators
      const validatedCompetitors = [];
      
      for (const comp of analysis.competitors) {
        // Known real companies that pass immediately (India-specific)
        const knownRealCompanies = [
          // Real Estate
          'dlf', 'godrej properties', 'godrej', 'prestige', 'sobha', 'sobha developers', 'brigade', 'mahindra lifespaces',
          'lodha', 'l&t realty', 'l&t construction', 'tata housing', 'sunteck', 'puravankara', 'emaar', 'hiranandani',
          'casagrand', 'casa grand', 'aparna constructions', 'ramky', 'my home', 'provident', 'embassy', 'k raheja',
          'oberoi realty', 'shapoorji pallonji', 'indiabulls', 'omaxe', 'parsvnath', 'unitech', 'ansal', 'supertech',
          // FinTech
          'paytm', 'phonepe', 'razorpay', 'cred', 'zerodha', 'groww', 'bharatpe', 'mobikwik', 'slice', 'jupiter',
          'lendingkart', 'capital float', 'niyo', 'khatabook', 'smallcase', 'coin', 'policybazaar', 'digit insurance',
          // FoodTech
          'zomato', 'swiggy', 'rebel foods', 'faasos', 'box8', 'eatclub', 'eatsure', 'dominos', 'pizza hut', 'mcdonald',
          'burger king', 'dunzo', 'zepto', 'blinkit', 'bigbasket', 'grofers', 'instamart',
          // EdTech
          'byju', 'byjus', 'unacademy', 'vedantu', 'toppr', 'doubtnut', 'physicswallah', 'upgrad', 'simplilearn',
          'great learning', 'scaler', 'interviewbit', 'coding ninjas', 'whitehat jr',
          // E-commerce
          'flipkart', 'amazon', 'myntra', 'ajio', 'meesho', 'nykaa', 'purplle', 'mamaearth', 'sugar cosmetics',
          'boat', 'noise', 'fire-boltt', 'lenskart', 'firstcry', 'pepperfry', 'urban ladder', 'urbanclap', 'urban company',
          // SaaS
          'zoho', 'freshworks', 'postman', 'chargebee', 'browserstack', 'druva', 'icertis', 'mindtickle', 'clevertap',
          'leadsquared', 'webengage', 'moengage', 'yellow.ai', 'zetwerk', 'ofbusiness',
          // Others
          'ola', 'uber', 'rapido', 'oyo', 'make my trip', 'makemytrip', 'yatra', 'cleartrip', 'redbus', 'cure.fit', 'curefit',
          'practo', 'pharmeasy', 'netmeds', 'medlife', 'tata 1mg', 'licious', 'country delight', 'milkbasket',
          // Global Tech
          'google', 'microsoft', 'amazon', 'apple', 'meta', 'facebook', 'tesla', 'nvidia', 'salesforce', 'oracle', 'sap',
          'adobe', 'ibm', 'intel', 'cisco', 'dell', 'hp', 'lenovo', 'samsung', 'sony', 'lg', 'huawei', 'xiaomi',
          'oppo', 'vivo', 'realme', 'oneplus', 'airbnb', 'uber', 'lyft', 'doordash', 'instacart', 'shopify', 'stripe',
          'square', 'block', 'coinbase', 'robinhood', 'webull', 'etoro', 'revolut', 'monzo', 'n26', 'chime',
          // Global Real Estate/PropTech
          'zillow', 'redfin', 'opendoor', 'compass', 'realogy', 'cbre', 'jll', 'cushman wakefield', 'colliers',
          'savills', 'knight frank', 'brookfield', 'blackstone', 'prologis'
        ];
        
        const compNameLower = comp.name.toLowerCase().trim();
        
        // Check if it's a known real company
        const isKnownReal = knownRealCompanies.some(known => 
          compNameLower.includes(known) || known.includes(compNameLower)
        );
        
        if (isKnownReal) {
          comp.validationStatus = 'verified';
          comp.validationSource = 'known_company_database';
          validatedCompetitors.push(comp);
          console.log(`✅ Verified (known): ${comp.name}`);
          continue;
        }
        
        // For user-mentioned competitors, trust them but mark as user-provided
        if (comp.isUserMentioned || comp.region === 'user-pick') {
          comp.validationStatus = 'user_provided';
          comp.validationSource = 'user_input';
          validatedCompetitors.push(comp);
          console.log(`✅ Verified (user-provided): ${comp.name}`);
          continue;
        }
        
        // Additional heuristics for real companies:
        // - Has specific location/headquarters
        // - Has a founded year that makes sense
        // - Has specific products mentioned
        // - Name doesn't contain suspicious patterns
        
        const hasSpecificData = (
          (comp.headquarters && comp.headquarters.length > 3 && !comp.headquarters.toLowerCase().includes('unknown')) ||
          (comp.foundedYear && comp.foundedYear >= 1900 && comp.foundedYear <= new Date().getFullYear()) ||
          (comp.flagshipProduct && comp.flagshipProduct.length > 3) ||
          (comp.products && comp.products.length > 0 && comp.products[0].length > 3)
        );
        
        // Check for suspicious name patterns (more lenient for companies with data)
        const suspiciousPatterns = [
          /^(company|startup|business|enterprise|firm|corp)\s/i,
          /\s(company|startup|business|enterprise|firm|corp)$/i,
          /^(the|a|an)\s+(company|startup|business)/i,
          /^new\s/i,
          /\s(pvt|private|ltd|limited|llp|inc)$/i // These might be okay but need checking
        ];
        
        const hasSuspiciousName = suspiciousPatterns.some(p => p.test(compNameLower));
        
        if (hasSpecificData && !hasSuspiciousName) {
          comp.validationStatus = 'validated';
          comp.validationSource = 'data_heuristics';
          validatedCompetitors.push(comp);
          console.log(`✅ Validated (heuristics): ${comp.name}`);
        } else if (hasSpecificData) {
          // Has data but suspicious name - include with warning
          comp.validationStatus = 'unverified';
          comp.validationSource = 'needs_review';
          validatedCompetitors.push(comp);
          console.log(`⚠️ Included (unverified): ${comp.name}`);
        } else {
          // No specific data and not known - reject
          console.log(`❌ Rejected (no validation): ${comp.name}`);
        }
      }
      
      analysis.competitors = validatedCompetitors;
      console.log(`📊 Step 2 validation: ${validatedCompetitors.length} competitors passed 2-step validation`);
      
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
      
      // Return error - no static fallbacks, user should retry for real competitor data
      return res.status(503).json({ 
        error: 'Competitor analysis temporarily unavailable. Please try again in a few seconds.',
        retryAfter: 5,
        message: 'Real-time competitor data requires AI analysis. Please retry for accurate, relevant results.'
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

// Chat endpoint with Grok - GUARANTEED RESPONSE
app.post('/api/chat/grok', authenticateToken, async (req, res) => {
  // Ensure we ALWAYS send a response - wrap everything in ultimate try-catch
  const sendFallbackResponse = (msg = 'I apologize, but I encountered an issue. Please try again or rephrase your question.') => {
    if (!res.headersSent) {
      res.json({ response: msg });
    }
  };

  try {
    const { message, context = {}, conversationHistory } = req.body;
    const userId = req.user.userId;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    console.log(`💬 Chat request from user ${userId}: "${message.substring(0, 50)}..."`);

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

    // Safely extract context with defaults
    const company = context.company || {};
    const valuation = context.valuation || null;
    const swot = context.swot || null;
    const competitorAnalysis = context.competitorAnalysis || {};
    const topActions = context.topActions || [];
    const infinityStats = context.infinityStats || {};

    // Build system prompt with context
    let systemPrompt = `You are Daddy, an AI Strategic Advisor for startups and entrepreneurs. You have COMPLETE ACCESS to the user's business data shown on their dashboard. When they ask about ANY section or data, you MUST reference the specific data below - never say "data not provided" if it's listed here.

IMPORTANT: The user can see their dashboard. If they ask about "Daily Actions", "Top Actions", "Actions", or similar - they mean the Top Actions list below. Always use the actual data.

Company Context:
- Name: ${company.name || 'Unknown'}
- Description: ${company.description || 'N/A'}
- Category: ${company.category || 'Unknown'}
- Stage: ${company.stage || 'Unknown'}
- Monthly Revenue: ₹${company.monthlyRevenue || 0}
- Monthly Expenses: ₹${company.expenses || 0}
- Customers: ${company.customers || 0}
- Team Size: ${company.teamSize || '1'}
- Funding Raised: ₹${company.funding || 0}

${valuation ? `Valuation: ₹${(valuation.finalValuationINR / 10000000).toFixed(2)} Cr (${(valuation.finalValuationUSD / 1000000).toFixed(2)}M USD)` : ''}

${swot ? `SWOT Analysis:
Strengths: ${swot.strengths?.join(', ') || 'None identified'}
Weaknesses: ${swot.weaknesses?.join(', ') || 'None identified'}
Opportunities: ${swot.opportunities?.join(', ') || 'None identified'}
Threats: ${swot.threats?.join(', ') || 'None identified'}` : ''}

${competitorAnalysis ? `
Competitor Analysis:
${competitorAnalysis.userMentionedCompetitors ? `User-Mentioned Competitors: ${competitorAnalysis.userMentionedCompetitors}` : ''}
${competitorAnalysis.verifiedCompetitors?.length > 0 ? `Verified Competitors:
${competitorAnalysis.verifiedCompetitors.map(c => `- ${c.name}: Stage=${c.stage || 'N/A'}, Valuation=₹${c.currentValuation ? (c.currentValuation/10000000).toFixed(1) + ' Cr' : 'N/A'}, Revenue=₹${c.revenue ? (c.revenue/10000000).toFixed(1) + ' Cr' : 'N/A'}, Customers=${c.customers || 'N/A'}, Funding=₹${c.fundingRaised ? (c.fundingRaised/10000000).toFixed(1) + ' Cr' : 'N/A'}, Product=${c.flagshipProduct || 'N/A'}, Region=${c.region || 'N/A'}`).join('\n')}` : ''}
${competitorAnalysis.globalCompetitors?.length > 0 ? `Global Competitors:
${competitorAnalysis.globalCompetitors.map(c => `- ${c.name}: Stage=${c.stage || 'N/A'}, Valuation=₹${c.currentValuation ? (c.currentValuation/10000000).toFixed(1) + ' Cr' : 'N/A'}, Product=${c.flagshipProduct || 'N/A'}`).join('\n')}` : ''}
${competitorAnalysis.localCompetitors?.length > 0 ? `Local/Indian Competitors:
${competitorAnalysis.localCompetitors.map(c => `- ${c.name}: Stage=${c.stage || 'N/A'}, Valuation=₹${c.currentValuation ? (c.currentValuation/10000000).toFixed(1) + ' Cr' : 'N/A'}, Product=${c.flagshipProduct || 'N/A'}`).join('\n')}` : ''}
${competitorAnalysis.rivalCompetitors?.length > 0 ? `Direct Rivals:
${competitorAnalysis.rivalCompetitors.map(c => `- ${c.name}: Stage=${c.stage || 'N/A'}, Valuation=₹${c.currentValuation ? (c.currentValuation/10000000).toFixed(1) + ' Cr' : 'N/A'}, Product=${c.flagshipProduct || 'N/A'}`).join('\n')}` : ''}
${competitorAnalysis.potentialCompetitors?.length > 0 ? `Potential Competitors:
${competitorAnalysis.potentialCompetitors.map(c => `- ${c.name}: Stage=${c.stage || 'N/A'}, Valuation=₹${c.currentValuation ? (c.currentValuation/10000000).toFixed(1) + ' Cr' : 'N/A'}, Product=${c.flagshipProduct || 'N/A'}`).join('\n')}` : ''}
${competitorAnalysis.allCompetitors?.length > 0 && !competitorAnalysis.verifiedCompetitors?.length && !competitorAnalysis.globalCompetitors?.length ? `All Competitors:
${competitorAnalysis.allCompetitors.slice(0, 5).map(c => `- ${c.name}: Stage=${c.stage || 'N/A'}, Valuation=₹${c.currentValuation ? (c.currentValuation/10000000).toFixed(1) + ' Cr' : 'N/A'}, Growth=${c.growthRate || 'N/A'}%`).join('\n')}` : ''}
${competitorAnalysis.summary ? `Summary: ${competitorAnalysis.summary}` : ''}
` : ''}

${topActions.length > 0 ? `
TOP ACTIONS (Daily Strategic Recommendations):
These are AI-generated strategic actions for the business. When user asks about "Daily Actions", "Top Actions", "Actions", or "what should I do" - refer to these:
${topActions.map((action, i) => `${i + 1}. ${action.text} ${action.completed ? '✅ COMPLETED' : '⏳ PENDING'}`).join('\n')}
` : ''}

${infinityStats.totalRevenue ? `
INFINITY STATS (Financial Data from InFinity Sync):
- Total Revenue: ₹${(infinityStats.totalRevenue / 100000).toFixed(1)}L
- Monthly Revenue: ₹${(infinityStats.monthlyRevenue / 100000).toFixed(1)}L
- Runway: ${infinityStats.runway || 'N/A'}
- Sync Status: ${infinityStats.status}
` : ''}

GTM CO-FOUNDER METRICS (Go-To-Market Dashboard):
The GTM section helps founders with Go-To-Market execution. Here's how metrics are calculated:

1. **Founder GTM Bandwidth** (hours/week the founder can dedicate to GTM activities):
   - Team size ≤ 2 people: 15 hours/week (founders do everything)
   - Team size 3-5 people: 10 hours/week (some delegation possible)
   - Team size > 5 people: 5 hours/week (founders focus on strategy)
   - Current team size: ${company.teamSize || 1} → Bandwidth: ${Number(company.teamSize) <= 2 ? '15' : Number(company.teamSize) <= 5 ? '10' : '5'} hrs/week

2. **Runway** (months of operating cash remaining):
   - Based on funding needed: <₹10L = 6 months, ₹10-50L = 12 months, >₹50L = 18 months
   
3. **GTM Stage**:
   - Pre-Revenue: No revenue yet
   - Early Traction: Has revenue but <20 customers
   - Scaling: Has revenue and 20+ customers

4. **Current Traction**: Combination of monthly revenue and customer count

5. **Decision Cycle**: 14 days max - every GTM experiment must show signal within 14 days

6. **Cost per Learning**: The key metric - how much money/time spent to learn if a channel works

Your role:
1. Provide strategic, data-driven insights based on the company's actual data
2. Answer questions about valuation methodologies, scores, and metrics
3. Help with "what-if" scenarios (e.g., impact of revenue growth, team expansion)
4. Offer actionable advice for growth, funding, and competitive positioning
5. Explain SWOT analysis, market trends, and funding schemes
6. When asked about competitors, use the Competitor Analysis data above to provide detailed insights about market positioning, competitive threats, and differentiation strategies

RESPONSE GUIDELINES:
- NEVER give generic responses that could apply to any business
- ALWAYS reference specific data from the context above (company name, revenue, customers, etc.)
- If the user asks about something and data exists above, USE IT
- Be specific with numbers and actionable with advice
- Responses should be personalized to ${company.name || 'this business'}

Keep responses concise, actionable, and personalized to ${company.name || 'this business'}.`;

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
      
      // Step 1: Get initial response from Gemini
      let geminiResponse = await callGemini(conversationText, systemPrompt);
      
      // ====== 2-STEP VALIDATION FOR AI RESPONSES ======
      // Step 2: Validate the response is contextual and not generic
      
      const validationPrompt = `You are a response quality validator. Check if this response is appropriate and contextual.

ORIGINAL USER QUESTION: "${message}"

COMPANY CONTEXT:
- Company Name: ${company.name || 'Unknown'}
- Category: ${company.category || 'Unknown'}
- Stage: ${company.stage || 'Unknown'}
- Revenue: ₹${company.monthlyRevenue || 0}/month
- Customers: ${company.customers || 0}

GENERATED RESPONSE:
"${geminiResponse}"

VALIDATION CHECKLIST:
1. Does the response mention the company name "${company.name}" or refer to their specific situation?
2. Does it use specific numbers from the context (revenue, customers, valuation)?
3. Is it actionable and specific (not vague platitudes)?
4. Does it actually answer the user's question?
5. Is it free from hallucinated facts not in the context?

If the response passes validation (score > 70%), return:
{ "valid": true, "score": <0-100>, "response": "<original or slightly improved response>" }

If the response is too generic or incorrect, return:
{ "valid": false, "score": <0-100>, "reason": "<why it failed>", "response": "<improved response using the actual context above>" }

Return ONLY valid JSON.`;

      try {
        const validationResult = await callGemini(validationPrompt);
        const jsonMatch = validationResult.match(/\{[\s\S]*\}/);
        
        if (jsonMatch) {
          const validation = JSON.parse(jsonMatch[0]);
          
          if (validation.valid === false || validation.score < 70) {
            console.log(`⚠️ Response validation failed (score: ${validation.score}), using improved response`);
            geminiResponse = validation.response || geminiResponse;
          } else {
            console.log(`✅ Response validation passed (score: ${validation.score})`);
            // Use improved response if provided
            if (validation.response && validation.response.length > geminiResponse.length * 0.5) {
              geminiResponse = validation.response;
            }
          }
        }
      } catch (validationError) {
        console.warn('Response validation step failed, using original response:', validationError.message);
        // Continue with original response if validation fails
      }
      
      console.log('✅ Chat response from Gemini API for', company.name || 'user');
      return res.json({ response: geminiResponse });
      
    } catch (geminiError) {
      console.warn('⚠️ Gemini failed for chatbot:', geminiError.message);
      throw geminiError;
    }

  } catch (error) {
    console.error('❌ AI backend failed for chatbot:', error.message);
    
    // Return error - no static fallbacks, user should retry for dynamic response
    if (!res.headersSent) {
      return res.status(503).json({
        error: 'AI advisor temporarily unavailable. Please try again in a few seconds.',
        retryAfter: 5,
        message: 'Our AI is processing many requests. Your question will receive a personalized response when you retry.'
      });
    }
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
    const { sixMonthGoal, productName, category, stage, currentChallenge, gtmTasks, requestCount } = req.body;
    const userId = req.user.userId;
    
    if (!sixMonthGoal) {
      return res.status(400).json({ error: '6-month goal is required' });
    }

    // Fetch user's rejection feedback to avoid similar tasks
    const user = await usersCollection.findOne({ _id: new ObjectId(userId) });
    const rejectionFeedback = user?.actionFeedback || [];
    
    // Build rejection context for AI
    let rejectionContext = '';
    if (rejectionFeedback.length > 0) {
      const recentFeedback = rejectionFeedback.slice(-10); // Last 10 rejections
      rejectionContext = `\n\nIMPORTANT - AVOID THESE TYPES OF TASKS (user has rejected similar tasks before):
${recentFeedback.map(f => `- "${f.actionText}" - Reason: ${f.rejectionReason || 'Not specified'}`).join('\n')}

Learn from these rejections and avoid suggesting similar tasks or tasks with similar patterns.`;
    }

    // Determine how many actions to generate (excluding GTM tasks that come from frontend)
    const numActionsNeeded = requestCount || 5;

    const prompt = `You are an expert startup advisor. Based on the following startup information, generate exactly ${numActionsNeeded} actionable daily tasks that will help the founder make progress towards their 6-month goal.

STARTUP INFORMATION:
- Product/Service: ${productName || 'Unknown'}
- Category: ${category || 'Unknown'}
- Stage: ${stage || 'Unknown'}
- Current Challenge: ${currentChallenge || 'General growth'}
- 6-Month Goal: ${sixMonthGoal}
${rejectionContext}

REQUIREMENTS:
1. Generate exactly ${numActionsNeeded} specific, actionable daily tasks
2. Each task should be completable in one day
3. Tasks should directly contribute to the 6-month goal
4. Make tasks practical and measurable
5. Order by priority (most important first)
6. Focus on different ways to reach the 6-month goal (marketing, sales, product, partnerships, etc.)

Return a JSON object with this EXACT structure:
{
  "actions": [
    {"id": 1, "text": "Task description here", "priority": "high", "source": "goal"},
    {"id": 2, "text": "Task description here", "priority": "high", "source": "goal"},
    {"id": 3, "text": "Task description here", "priority": "medium", "source": "goal"}
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
    const userId = req.user.userId;
    
    // Build industry-specific search context
    const cleanedIndustry = Array.isArray(industry) ? industry[0] : industry || '';
    const searchContext = cleanedIndustry || query || 'technology startups business';
    
    // Create cache key based on industry and user
    const cacheKey = `news_${userId}_${searchContext.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
    
    // Check for cached news (6-hour expiry)
    const SIX_HOURS = 6 * 60 * 60 * 1000;
    const cachedNews = newsCache.get(cacheKey);
    if (cachedNews && (Date.now() - cachedNews.timestamp) < SIX_HOURS) {
      console.log('📰 Returning cached news for:', searchContext);
      return res.json(cachedNews.data);
    }
    
    // Map industry categories to specific news search terms
    const industryNewsKeywords = {
      'Real Estate': 'real estate housing property construction India market',
      'Real Estate & Construction': 'real estate property housing construction India developers builders',
      'Construction': 'construction infrastructure building materials India projects',
      'SaaS': 'SaaS software B2B cloud enterprise technology India startups',
      'Mobile App': 'mobile apps app store India tech consumer apps',
      'E-commerce': 'ecommerce online shopping retail D2C India market',
      'Marketplace': 'marketplace platform gig economy India aggregator',
      'AI/ML': 'artificial intelligence machine learning AI India tech startups',
      'FinTech': 'fintech digital payments UPI banking India RBI',
      'EdTech': 'edtech online learning education India students skilling',
      'HealthTech': 'healthtech digital health telemedicine India healthcare',
      'Hardware': 'hardware electronics manufacturing India make in India',
      'Consulting': 'consulting professional services India business advisory',
      'AgriTech': 'agritech agriculture farming India rural technology',
      'FoodTech': 'foodtech food delivery cloud kitchen India zomato swiggy',
      'Logistics': 'logistics supply chain delivery India ecommerce warehousing',
      'CleanTech': 'cleantech renewable energy solar EV India green technology',
      'D2C': 'D2C direct to consumer brands India online retail',
      'FMCG': 'FMCG consumer goods retail India market brands'
    };
    
    // Get industry-specific keywords or use the search context
    const newsKeywords = industryNewsKeywords[searchContext] || `${searchContext} India business startup market`;
    
    // Use Gemini with Google Search grounding for real, current news
    const prompt = `You are a news curator specializing in ${searchContext} industry. Search Google for REAL, CURRENT news articles from the past 7 days that are SPECIFICALLY relevant to the ${searchContext} industry in India.

SEARCH FOR: "${newsKeywords}"

## CRITICAL REQUIREMENTS:
1. News MUST be directly related to ${searchContext} industry - NOT generic business news
2. Prioritize India-focused news or news with Indian market relevance
3. Include news about major players, market trends, regulations, and innovations in ${searchContext}
4. Each article must be from the PAST 7 DAYS (recent news only)

Focus on trusted sources like:
- For ${searchContext}: Industry-specific publications, trade journals
- Indian business: Economic Times, Business Standard, Mint, LiveMint, MoneyControl
- Global business: Reuters, Bloomberg, CNBC, Financial Times
- Tech: TechCrunch, The Verge, YourStory, Inc42
- Industry-specific trade publications

For EACH article, provide:
1. The EXACT real headline (not paraphrased) - MUST be about ${searchContext}
2. A brief 2-sentence summary explaining relevance to ${searchContext} industry
3. The actual source publication name
4. The real URL to the article (must be a valid, working URL)
5. Published time (e.g., "2 hours ago", "Yesterday", "Jan 9, 2026")

Return as JSON array:
{
  "news": [
    {
      "title": "Exact headline about ${searchContext}",
      "summary": "Brief 2-sentence summary explaining the ${searchContext} industry impact.",
      "source": "Publication Name",
      "url": "https://actual-article-url.com",
      "imageUrl": "https://example.com/image.jpg",
      "timeAgo": "3 hours ago",
      "industry": "${searchContext}",
      "relevanceScore": 95
    }
  ]
}

IMPORTANT: 
- ONLY include news that is DIRECTLY relevant to ${searchContext} - reject generic business news
- All 6 articles should be about ${searchContext} industry specifically
- If you cannot find 6 relevant articles, return fewer but ensure quality
- URLs must be actual article links, not homepage links
- Include relevanceScore (0-100) indicating how relevant the news is to ${searchContext}

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
      // Ensure all items have required fields and filter by relevance
      if (parsedNews.news && Array.isArray(parsedNews.news)) {
        parsedNews.news = parsedNews.news
          .filter(item => !item.relevanceScore || item.relevanceScore >= 60) // Only highly relevant news
          .map(item => ({
            title: item.title || 'News Update',
            summary: item.summary || item.title || '',
            source: item.source || 'News',
            url: item.url || '#',
            imageUrl: item.imageUrl || `https://picsum.photos/seed/${Math.random().toString(36).substr(2, 9)}/400/250`,
            timeAgo: item.timeAgo || 'Recently',
            publishedAt: item.publishedAt || new Date().toISOString(),
            industry: item.industry || searchContext,
            relevanceScore: item.relevanceScore || 80
          }));
      }
      
      // Cache the successful response for 6 hours
      newsCache.set(cacheKey, {
        data: parsedNews,
        timestamp: Date.now()
      });
      
    } catch (e) {
      console.error('News parsing error:', e);
      // Industry-specific fallback news
      const industryFallbacks = {
        'Real Estate & Construction': [
          { title: "Indian Real Estate Market Shows Strong Recovery in 2025", summary: "Property sales surge across major Indian cities as developers launch new projects and buyer sentiment improves.", source: "Economic Times", url: "https://economictimes.indiatimes.com/industry/services/property-/-cstruction", timeAgo: "Today" },
          { title: "Construction Sector Growth Driven by Infrastructure Push", summary: "Government infrastructure projects and housing schemes continue to boost the construction industry.", source: "Business Standard", url: "https://www.business-standard.com/", timeAgo: "Yesterday" },
          { title: "New Real Estate Regulations to Protect Homebuyers", summary: "RERA compliance drives transparency in property transactions across Indian states.", source: "LiveMint", url: "https://www.livemint.com/", timeAgo: "2 days ago" }
        ],
        'FinTech': [
          { title: "UPI Transactions Hit New Record in December 2025", summary: "Digital payments continue exponential growth as more Indians adopt mobile banking.", source: "Economic Times", url: "https://economictimes.indiatimes.com/", timeAgo: "Today" },
          { title: "RBI Announces New Guidelines for Digital Lending", summary: "New regulations aim to protect consumers while fostering fintech innovation.", source: "Business Standard", url: "https://www.business-standard.com/", timeAgo: "Yesterday" }
        ]
      };
      
      const fallbackNews = industryFallbacks[searchContext] || [
        { title: `${searchContext} Industry Sees Growth in 2025`, summary: `The ${searchContext} sector shows positive momentum with new investments and market expansion.`, source: "Economic Times", url: "https://economictimes.indiatimes.com/", timeAgo: "Today" },
        { title: `Innovation Drives ${searchContext} Transformation`, summary: `Technology adoption accelerates change across the ${searchContext} industry in India.`, source: "YourStory", url: "https://yourstory.com/", timeAgo: "Yesterday" }
      ];
      
      parsedNews = {
        news: fallbackNews.map(item => ({
          ...item,
          imageUrl: `https://picsum.photos/seed/${Math.random().toString(36).substr(2, 9)}/400/250`,
          industry: searchContext
        }))
      };
    }

    res.json(parsedNews);
  } catch (error) {
    console.error('Error fetching news:', error);
    res.status(500).json({ error: 'Failed to fetch news' });
  }
});

// ============================================
// DAILY MANTHANAM & FOUNDER REFLECTION ROUTES
// ============================================

// Save Manthanam Reflection
app.post('/api/manthanam/save', authenticateToken, async (req, res) => {
  try {
    const { reflection, decisions, challenges, insights, mood, date } = req.body;
    const userId = req.userId;
    
    // Generate AI-powered insights based on reflection
    let aiInsights = null;
    if (reflection && reflection.length > 50) {
      try {
        const insightPrompt = `As a founder coach, analyze this reflection and provide 3 actionable insights:
        
Reflection: "${reflection}"
Decisions being considered: ${decisions?.join(', ') || 'None mentioned'}
Current challenges: ${challenges?.join(', ') || 'None mentioned'}
Founder mood: ${mood || 'Not specified'}

Provide exactly 3 brief, actionable insights (1-2 sentences each) that can help this founder today. Format as JSON array of strings.`;

        const result = await geminiModel.generateContent(insightPrompt);
        const responseText = result.response.text();
        
        // Try to parse as JSON array
        const jsonMatch = responseText.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          aiInsights = JSON.parse(jsonMatch[0]);
        } else {
          // Fallback: split by newlines/numbers
          aiInsights = responseText.split(/\d\.\s*/).filter(s => s.trim().length > 10).slice(0, 3);
        }
      } catch (aiError) {
        console.error('AI insight generation error:', aiError);
        aiInsights = [
          "Take time to reflect on your core mission today.",
          "Consider which decision aligns most with your long-term vision.",
          "Remember that challenges are opportunities for growth."
        ];
      }
    }
    
    // Store in database or return for client-side storage
    const manthanamEntry = {
      userId,
      date: date || new Date().toISOString().split('T')[0],
      reflection,
      decisions,
      challenges,
      insights,
      mood,
      aiInsights,
      createdAt: new Date()
    };
    
    // If using MongoDB, save to collection
    if (db) {
      const collection = db.collection('manthanam');
      await collection.updateOne(
        { userId, date: manthanamEntry.date },
        { $set: manthanamEntry },
        { upsert: true }
      );
    }
    
    res.json({ 
      success: true, 
      entry: manthanamEntry,
      message: 'Manthanam reflection saved successfully'
    });
  } catch (error) {
    console.error('Error saving manthanam:', error);
    res.status(500).json({ error: 'Failed to save reflection' });
  }
});

// Get Manthanam History
app.get('/api/manthanam/history', authenticateToken, async (req, res) => {
  try {
    const userId = req.userId;
    const { limit = 30, startDate, endDate } = req.query;
    
    let history = [];
    
    if (db) {
      const collection = db.collection('manthanam');
      const query = { userId };
      
      if (startDate || endDate) {
        query.date = {};
        if (startDate) query.date.$gte = startDate;
        if (endDate) query.date.$lte = endDate;
      }
      
      history = await collection
        .find(query)
        .sort({ date: -1 })
        .limit(parseInt(limit))
        .toArray();
    }
    
    // Calculate streak and insights
    const streak = calculateManthanamStreak(history);
    const moodTrend = analyzeMoodTrend(history);
    
    res.json({
      success: true,
      history,
      stats: {
        totalEntries: history.length,
        streak,
        moodTrend,
        lastEntry: history[0]?.date || null
      }
    });
  } catch (error) {
    console.error('Error fetching manthanam history:', error);
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

// Helper function to calculate streak
function calculateManthanamStreak(history) {
  if (!history || history.length === 0) return 0;
  
  let streak = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  for (let i = 0; i < history.length; i++) {
    const entryDate = new Date(history[i].date);
    entryDate.setHours(0, 0, 0, 0);
    
    const expectedDate = new Date(today);
    expectedDate.setDate(expectedDate.getDate() - i);
    
    if (entryDate.getTime() === expectedDate.getTime()) {
      streak++;
    } else {
      break;
    }
  }
  
  return streak;
}

// Helper function to analyze mood trend
function analyzeMoodTrend(history) {
  if (!history || history.length < 3) return 'neutral';
  
  const moodValues = { 
    'energized': 5, 'confident': 4, 'focused': 4, 
    'neutral': 3, 'uncertain': 2, 'stressed': 1 
  };
  
  const recentMoods = history.slice(0, 7).map(h => moodValues[h.mood] || 3);
  const avgMood = recentMoods.reduce((a, b) => a + b, 0) / recentMoods.length;
  
  if (avgMood >= 4) return 'positive';
  if (avgMood >= 3) return 'stable';
  return 'needs-attention';
}

// ============================================
// DECISION SIMULATION ROUTES
// ============================================

// Run Decision Simulation - AI-Powered with Full User Context
app.post('/api/simulation/run', authenticateToken, async (req, res) => {
  try {
    const { decision, context, companyData, timeframe = '6 months' } = req.body;
    
    if (!decision || decision.length < 10) {
      return res.status(400).json({ error: 'Please provide a detailed decision to simulate' });
    }
    
    // Fetch full DDQ data for rich context
    let fullUserContext = '';
    let ddq = {};
    try {
      const ddqData = await ddqCollection
        .find({ userId: req.user.userId })
        .sort({ createdAt: -1 })
        .limit(1)
        .toArray();
      
      if (ddqData && ddqData.length > 0) {
        ddq = ddqData[0].responses || {};
        
        // Build comprehensive context from DDQ responses
        fullUserContext = `
DETAILED COMPANY PROFILE FROM QUESTIONNAIRE:
- Company Name: ${ddq[0] || 'N/A'}
- Founder Name: ${ddq[1] || 'N/A'}
- Business Description: ${ddq[2] || 'N/A'}
- Industry/Vertical: ${Array.isArray(ddq[3]) ? ddq[3].join(', ') : ddq[3] || 'N/A'}
- Target Customer: ${ddq[4] || 'N/A'}
- Company Stage: ${ddq[5] || 'N/A'}
- Team Size: ${ddq[6] || 'N/A'}
- Founded Year: ${ddq[7] || 'N/A'}
- Location: ${ddq[8] || 'N/A'}
- Monthly Revenue (DDQ): ${ddq[9] || 'Pre-revenue'}
- Revenue Model: ${ddq[10] || 'N/A'}
- Growth Rate: ${ddq[11] || 'N/A'}
- Funding Raised: ${ddq[12] || 'N/A'}
- Monthly Expenses (DDQ): ${ddq[13] || 'N/A'}
- Runway (DDQ): ${ddq[14] || 'N/A'}
- User/Customer Count: ${ddq[15] || 'N/A'}
- Unique Value Proposition: ${ddq[16] || 'N/A'}
- Competitors: ${ddq[17] || 'N/A'}
- Competitive Advantage: ${ddq[18] || 'N/A'}
- Biggest Challenge: ${Array.isArray(ddq[19]) ? ddq[19].join(', ') : ddq[19] || 'N/A'}
- 12-Month Goal: ${ddq[20] || 'N/A'}
- Current Priorities: ${ddq[21] || 'N/A'}
- Team Strengths: ${ddq[22] || 'N/A'}
- Team Gaps: ${ddq[23] || 'N/A'}
- Tech Stack: ${ddq[24] || 'N/A'}
- Target Market Size: ${ddq[25] || 'N/A'}
- Customer Acquisition: ${ddq[26] || 'N/A'}
- Customer Retention: ${ddq[27] || 'N/A'}
- Key Metrics Tracked: ${ddq[28] || 'N/A'}
- Board/Advisors: ${ddq[29] || 'N/A'}`;
      }
    } catch (ddqError) {
      console.log('Could not fetch DDQ data:', ddqError.message);
    }
    
    // Fetch REAL InFinity financial data for accurate simulation
    let infinityContext = '';
    try {
      const user = await usersCollection.findOne({ _id: new ObjectId(req.user.userId) });
      if (user?.email) {
        const infinityData = await fetchInfinityUserByEmail(user.email);
        if (infinityData && infinityData.data) {
          const stats = infinityData.data;
          const totalRevenue = stats.totalRevenue || 0;
          const totalInvestment = stats.totalInvestment || 0;
          const monthlyRevenue = stats.monthlyRevenue || 0;
          const monthlyBurn = stats.monthlyBurn || stats.monthlyExpenses || 0;
          const runway = monthlyBurn > 0 ? Math.round((totalInvestment - totalRevenue + monthlyRevenue) / monthlyBurn) : 'N/A';
          
          infinityContext = `
=== REAL-TIME FINANCIAL DATA FROM INFINITY (USE THIS FOR CALCULATIONS) ===
- Total Revenue to Date: ₹${(totalRevenue / 100000).toFixed(2)} Lakhs (₹${totalRevenue.toLocaleString()})
- Total Investment Raised: ₹${(totalInvestment / 100000).toFixed(2)} Lakhs (₹${totalInvestment.toLocaleString()})
- Current Monthly Revenue: ₹${(monthlyRevenue / 100000).toFixed(2)} Lakhs/month (₹${monthlyRevenue.toLocaleString()}/month)
- Current Monthly Burn Rate: ₹${(monthlyBurn / 100000).toFixed(2)} Lakhs/month (₹${monthlyBurn.toLocaleString()}/month)
- Calculated Runway: ${typeof runway === 'number' ? runway + ' months' : runway}
- Net Monthly Cash Flow: ₹${((monthlyRevenue - monthlyBurn) / 100000).toFixed(2)} Lakhs/month
- Available Cash (estimated): ₹${((totalInvestment + totalRevenue - (monthlyBurn * 6)) / 100000).toFixed(2)} Lakhs

CRITICAL: Use these EXACT numbers when calculating financial impacts. If the decision involves:
- Hiring: Calculate exact cost increase against their ₹${(monthlyBurn / 100000).toFixed(2)}L/month burn
- Revenue targets: Base on their current ₹${(monthlyRevenue / 100000).toFixed(2)}L/month revenue
- Runway impact: Calculate against their current ${typeof runway === 'number' ? runway : 'limited'} months runway`;
          
          console.log(`📊 InFinity data loaded for simulation: Revenue ₹${totalRevenue}, Burn ₹${monthlyBurn}/month`);
        }
      }
    } catch (infinityError) {
      console.log('Could not fetch InFinity data:', infinityError.message);
    }
    
    // Detect business type for industry-specific simulation
    const businessDesc = (companyData?.industry || '').toLowerCase() + ' ' + fullUserContext.toLowerCase();
    const isFoodDelivery = businessDesc.includes('food') || businessDesc.includes('delivery') || businessDesc.includes('restaurant') || businessDesc.includes('meal') || businessDesc.includes('kitchen');
    const isEcommerce = businessDesc.includes('ecommerce') || businessDesc.includes('e-commerce') || businessDesc.includes('online store') || businessDesc.includes('retail') || businessDesc.includes('marketplace');
    const isFintech = businessDesc.includes('fintech') || businessDesc.includes('payment') || businessDesc.includes('banking') || businessDesc.includes('lending') || businessDesc.includes('insurance');
    const isHealthtech = businessDesc.includes('health') || businessDesc.includes('medical') || businessDesc.includes('doctor') || businessDesc.includes('patient') || businessDesc.includes('wellness');
    const isEdtech = businessDesc.includes('education') || businessDesc.includes('learning') || businessDesc.includes('course') || businessDesc.includes('student') || businessDesc.includes('school');
    const isSaaS = businessDesc.includes('saas') || businessDesc.includes('software') || businessDesc.includes('platform') || businessDesc.includes('subscription');
    
    // Get industry-specific context for the simulation
    let industryContext = '';
    if (isFoodDelivery) {
      industryContext = `
INDUSTRY-SPECIFIC CONSIDERATIONS FOR FOOD DELIVERY:
- Unit economics matter: CAC, AOV, delivery cost per order, kitchen utilization
- Operational leverage: Fleet management, delivery zones, peak hour optimization
- Key metrics: Orders per day, repeat rate, delivery time, restaurant partner count
- Common challenges: Rider retention, food quality during delivery, restaurant onboarding
- Typical decision tradeoffs: Geographic expansion vs. density, dark kitchens vs. restaurant partnerships`;
    } else if (isEcommerce) {
      industryContext = `
INDUSTRY-SPECIFIC CONSIDERATIONS FOR E-COMMERCE:
- Unit economics: CAC, LTV, AOV, return rate, inventory turnover
- Key metrics: Conversion rate, cart abandonment, repeat purchase rate
- Common challenges: Inventory management, logistics, customer acquisition cost
- Typical decision tradeoffs: Private label vs. marketplace, fast delivery vs. margin`;
    } else if (isFintech) {
      industryContext = `
INDUSTRY-SPECIFIC CONSIDERATIONS FOR FINTECH:
- Regulatory compliance is critical: RBI guidelines, KYC requirements, data protection
- Key metrics: AUM, transaction volume, default rates, user activation
- Common challenges: Trust building, regulatory changes, fraud prevention
- Typical decision tradeoffs: Growth vs. risk management, UX vs. compliance`;
    } else if (isHealthtech) {
      industryContext = `
INDUSTRY-SPECIFIC CONSIDERATIONS FOR HEALTHTECH:
- Regulatory compliance: CDSCO, telemedicine guidelines, data privacy
- Key metrics: Patient outcomes, consultation completion, repeat visits
- Common challenges: Doctor onboarding, trust building, insurance integration
- Typical decision tradeoffs: Scale vs. quality of care, B2C vs. B2B2C`;
    } else if (isEdtech) {
      industryContext = `
INDUSTRY-SPECIFIC CONSIDERATIONS FOR EDTECH:
- Key metrics: Course completion rate, student outcomes, NPS, renewal rate
- Common challenges: Engagement, outcome measurement, content quality
- Typical decision tradeoffs: Live vs. recorded, B2C vs. B2B, breadth vs. depth`;
    } else if (isSaaS) {
      industryContext = `
INDUSTRY-SPECIFIC CONSIDERATIONS FOR SAAS:
- Key metrics: MRR/ARR, churn rate, NRR, CAC payback period, LTV:CAC
- Common challenges: Product-market fit, enterprise sales cycles, feature bloat
- Typical decision tradeoffs: Self-serve vs. sales-led, horizontal vs. vertical`;
    }
    
    const simulationPrompt = `You are an expert startup strategist and decision simulator. You have deep knowledge of the Indian startup ecosystem, unit economics, and strategic decision-making.

A founder is asking you to simulate the impact of a specific decision they're considering. Use ALL the context provided - especially the REAL FINANCIAL DATA - to give a highly personalized, data-informed simulation with ACTUAL NUMBERS.

=== THE DECISION TO SIMULATE ===
"${decision}"

=== BASIC COMPANY DATA ===
- Industry: ${companyData?.industry || 'Technology'}
- Stage: ${companyData?.stage || 'Early-stage'}
- Team Size: ${companyData?.teamSize || '1-5'}
- Current Revenue: ${companyData?.revenue || 'Pre-revenue'}
- Main Challenge: ${companyData?.challenge || 'Growth'}
${context ? `- Founder's Additional Context: ${context}` : ''}

${infinityContext}

${fullUserContext}

${industryContext}

=== SIMULATION TIMEFRAME ===
${timeframe}

=== YOUR TASK ===
Simulate this decision with EXTREME SPECIFICITY to this founder's actual situation. 

IMPORTANT: 
1. Use the REAL FINANCIAL DATA from InFinity above to calculate exact impacts
2. Do NOT give generic advice - use their ACTUAL numbers
3. If they have ₹X monthly burn and are hiring 2 people at ₹Y stipend, calculate: new burn = ₹X + (2 × ₹Y)
4. Calculate runway impact using their real runway data
5. Reference their specific industry, challenges, and context

Respond in this exact JSON structure:
{
  "summary": "2-3 sentence summary that references their SPECIFIC situation and numbers",
  "probability": {
    "success": <number 0-100 - be realistic based on their stage/resources>,
    "partial": <number>,
    "failure": <number - these should sum to 100>
  },
  "impactAnalysis": {
    "runway": {
      "value": "e.g., '-2 to -4 months' or '+6 months' - be specific based on their expenses",
      "direction": "positive" or "negative" or "neutral"
    },
    "growth": {
      "value": "e.g., '+15-20% capacity' or '+25% revenue potential' - specific to their metrics",
      "direction": "positive" or "negative" or "neutral"
    },
    "valuation": {
      "value": "e.g., '+10-15%' or 'Neutral' - based on how this affects fundability/metrics",
      "direction": "positive" or "negative" or "neutral"
    },
    "riskLevel": "low" or "medium" or "high"
  },
  "bestCase": {
    "description": "Specific best case scenario with their actual numbers/metrics",
    "metrics": ["Specific metric improvement 1", "Specific metric improvement 2", "Specific metric improvement 3"],
    "timeline": "Realistic timeline for their stage"
  },
  "worstCase": {
    "description": "Specific worst case scenario with their actual numbers/metrics",
    "risks": ["Specific risk 1 for their situation", "Specific risk 2", "Specific risk 3"],
    "mitigation": ["Specific mitigation 1", "Specific mitigation 2"]
  },
  "keyFactors": [
    {"factor": "Critical factor for THIS decision in THEIR context", "impact": "high", "controllable": true/false},
    {"factor": "Another factor", "impact": "medium", "controllable": true/false}
  ],
  "financialImpact": {
    "costChange": "Specific cost impact (e.g., +₹16,000/month for 2 interns at ₹8000 each)",
    "revenueChange": "Specific revenue impact based on their current revenue",
    "runwayChange": "CALCULATE: if burn was X and increases by Y, new runway = (cash) / (X+Y)",
    "breakeven": "Time to breakeven on this decision"
  },
  "recommendation": "Clear, specific recommendation with reasoning based on THEIR situation - not generic advice",
  "detailedExplanation": "A 3-4 paragraph detailed explanation of WHY this recommendation was made, including: 1) How the decision aligns with their current stage and resources, 2) The key assumptions behind the probability calculations, 3) What success looks like and how to measure it, 4) The biggest risk and how to mitigate it. This should be a thorough explanation a founder can share with advisors.",
  "alternativeApproaches": [
    {"approach": "Alternative approach specific to their context", "tradeoff": "What they gain/lose"},
    {"approach": "Another alternative", "tradeoff": "Tradeoff"}
  ],
  "nextSteps": ["Specific step 1 they should take", "Step 2", "Step 3"],
  "redFlags": ["Warning sign to watch for", "Another red flag"],
  "confidenceExplanation": "Why you have this confidence level based on their data completeness",
  "calculationBreakdown": "Show the math: If current burn is ₹X/month and this adds ₹Y, new burn = ₹Z. If runway was N months, new runway = M months. Revenue potential = customers × conversion × price."
}

REMEMBER: Use the ACTUAL financial numbers provided above. Do not make up generic numbers.`;

    // Call Gemini API using the helper function
    console.log('🤖 Running decision simulation with Gemini...');
    const responseText = await callGemini(simulationPrompt);
    
    // Parse JSON response
    let simulation;
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        simulation = JSON.parse(jsonMatch[0]);
        console.log('✅ Simulation generated successfully');
        
        // ====== 2-STEP VALIDATION FOR SIMULATION ======
        // Step 2: Validate the simulation is contextual and uses actual data
        const validationPrompt = `Validate this decision simulation for quality and specificity.

DECISION: "${decision}"
COMPANY: ${companyData?.name || 'Unknown'} (${companyData?.industry || 'Unknown'} industry)
STAGE: ${companyData?.stage || 'Unknown'}
REVENUE: ${companyData?.revenue || 'Pre-revenue'}

SIMULATION RESULT:
${JSON.stringify(simulation, null, 2)}

VALIDATION CHECKLIST:
1. Does the summary reference the specific decision and company situation?
2. Are the probability numbers reasonable for the context (not too optimistic/pessimistic)?
3. Does the recommendation include specific, actionable advice (not generic platitudes)?
4. Are financial impacts calculated with actual numbers where available?
5. Does the detailed explanation provide real reasoning?

If the simulation passes (score > 70%), return:
{ "valid": true, "score": <0-100>, "improvements": null }

If the simulation needs improvement, return:
{ "valid": false, "score": <0-100>, "improvements": { "summary": "Better summary if needed", "recommendation": "Better recommendation if needed", "detailedExplanation": "Better explanation if needed" } }

Return ONLY valid JSON.`;

        try {
          const validationResult = await callGemini(validationPrompt);
          const valJsonMatch = validationResult.match(/\{[\s\S]*\}/);
          
          if (valJsonMatch) {
            const validation = JSON.parse(valJsonMatch[0]);
            
            if (validation.valid === false && validation.improvements) {
              console.log(`⚠️ Simulation validation score: ${validation.score}, applying improvements`);
              // Merge improvements into simulation
              if (validation.improvements.summary) simulation.summary = validation.improvements.summary;
              if (validation.improvements.recommendation) simulation.recommendation = validation.improvements.recommendation;
              if (validation.improvements.detailedExplanation) simulation.detailedExplanation = validation.improvements.detailedExplanation;
            } else {
              console.log(`✅ Simulation validation passed (score: ${validation.score})`);
            }
          }
        } catch (validationError) {
          console.warn('Simulation validation step failed, using original:', validationError.message);
        }
        
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      console.error('Parse error:', parseError);
      // Create structured fallback with context-aware data
      simulation = {
        summary: `Based on the decision "${decision}" and available context, this requires careful financial analysis.`,
        probability: { success: 55, partial: 30, failure: 15 },
        impactAnalysis: {
          runway: { value: "Requires calculation based on actual financials", direction: "neutral" },
          growth: { value: "Potential for positive impact", direction: "neutral" },
          valuation: { value: "Depends on execution", direction: "neutral" },
          riskLevel: "medium"
        },
        bestCase: {
          description: "The decision leads to positive outcomes with proper execution",
          metrics: ["Revenue growth", "Market expansion", "Team capability"],
          timeline: timeframe
        },
        worstCase: {
          description: "Challenges arise that slow progress",
          risks: ["Resource constraints", "Market timing", "Execution gaps"],
          mitigation: ["Build contingency plans", "Maintain flexibility"]
        },
        keyFactors: [
          { factor: "Execution capability", impact: "high", controllable: true },
          { factor: "Market conditions", impact: "medium", controllable: false }
        ],
        recommendation: "Review the specific numbers and proceed with clear milestones.",
        detailedExplanation: `This simulation for "${decision}" requires more specific financial data to provide accurate projections. The recommendation is based on general best practices for ${companyData?.stage || 'early-stage'} companies in ${companyData?.industry || 'technology'}. Key factors to consider include your current runway, team capacity, and market conditions.`,
        alternativeApproaches: [
          { approach: "Phased implementation", tradeoff: "Slower progress but lower risk" }
        ],
        nextSteps: ["Define success metrics", "Set review checkpoints", "Prepare contingency plans"]
      };
    }
    
    // Store simulation for future reference
    if (db) {
      const collection = db.collection('simulations');
      await collection.insertOne({
        userId: req.userId,
        decision,
        context,
        companyData,
        timeframe,
        result: simulation,
        createdAt: new Date()
      });
    }
    
    res.json({
      success: true,
      simulation,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error running simulation:', error);
    
    // Return error - no static fallbacks, user should retry for product-specific simulation
    return res.status(503).json({
      error: 'Decision simulation temporarily unavailable. Please try again in a few seconds.',
      retryAfter: 5,
      message: 'Accurate simulations require AI analysis of your specific business data. Please retry for relevant results.'
    });
  }
});

// Get Simulation History
app.get('/api/simulation/history', authenticateToken, async (req, res) => {
  try {
    const userId = req.userId;
    const { limit = 10 } = req.query;
    
    let history = [];
    
    if (db) {
      const collection = db.collection('simulations');
      history = await collection
        .find({ userId })
        .sort({ createdAt: -1 })
        .limit(parseInt(limit))
        .toArray();
    }
    
    res.json({
      success: true,
      history,
      count: history.length
    });
  } catch (error) {
    console.error('Error fetching simulation history:', error);
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

// ============================================
// GTM STRATEGY ROUTE - COMPREHENSIVE DYNAMIC GENERATION
// ============================================

// Generate comprehensive GTM Strategy based on user's DDQ data
app.post('/api/gtm/generate', authenticateToken, async (req, res) => {
  try {
    const { ddqResponses, valuation, swotAnalysis } = req.body;
    const userId = req.user.userId;

    // Check rate limit
    const rateLimitCheck = geminiRateLimiter.checkLimit(userId);
    if (!rateLimitCheck.allowed) {
      return res.status(429).json({ 
        error: `Rate limit exceeded. Please try again in ${rateLimitCheck.resetIn} minutes.`
      });
    }

    // Extract all relevant data from DDQ responses
    const productName = ddqResponses[1] || 'Your Product';
    const productDescription = ddqResponses[2] || '';
    const businessCategory = Array.isArray(ddqResponses[3]) ? ddqResponses[3].join(', ') : ddqResponses[3] || 'Technology';
    const customCategory = ddqResponses['3_other'] || '';
    const location = ddqResponses[4] || 'India';
    const stage = ddqResponses[5] || 'Idea';
    const competitors = ddqResponses[6] || 'None specified';
    const differentiation = ddqResponses[7] || '';
    const targetCustomer = ddqResponses[8] || 'Not specified';
    const marketType = ddqResponses[9] || 'B2B';
    const customerInterviews = ddqResponses[10] || '0';
    const totalInvestment = Number(ddqResponses[11]) || 0;
    const pricingModel = ddqResponses['11b'] || 'Monthly Recurring';
    const hasRevenue = ddqResponses[12] === 'Yes';
    const monthlyRevenue = hasRevenue ? Number(ddqResponses[13]) || 0 : 0;
    const customerCount = Number(ddqResponses[15]) || 0;
    const teamSize = Number(ddqResponses[17]) || 1;
    const founderBackground = Array.isArray(ddqResponses[18]) ? ddqResponses[18].join(', ') : ddqResponses[18] || 'Technical';
    const challenges = Array.isArray(ddqResponses[19]) ? ddqResponses[19] : [ddqResponses[19] || 'Customer Acquisition'];
    const acquisitionChannels = Array.isArray(ddqResponses[20]) ? ddqResponses[20] : [ddqResponses[20] || 'Online marketing'];
    const sixMonthGoal = ddqResponses[21] || 'Growth';
    const fundingNeeded = ddqResponses[22] || 'Less than ₹10 Lakhs';
    const risks = Array.isArray(ddqResponses[23]) ? ddqResponses[23] : [ddqResponses[23] || 'Competition'];

    // Calculate derived values
    const runwayMonths = fundingNeeded === 'Less than ₹10 Lakhs' ? 6 : 
                         fundingNeeded === '₹10-25 Lakhs' ? 9 :
                         fundingNeeded === '₹25-50 Lakhs' ? 12 :
                         fundingNeeded === '₹50 Lakhs - ₹1 Crore' ? 15 : 18;
    
    const gtmStage = !hasRevenue ? 'Pre-Revenue' : 
                     customerCount < 10 ? 'Early Traction' : 
                     customerCount < 50 ? 'Growth' : 'Scaling';
    
    const founderBandwidth = teamSize <= 2 ? 15 : teamSize <= 5 ? 10 : 5;
    const arpc = hasRevenue && customerCount > 0 ? Math.round(monthlyRevenue / customerCount) : 0;
    const estimatedValuation = valuation?.estimatedValuation || 0;

    // Build comprehensive prompt for Gemini
    const gtmPrompt = `You are an elite GTM (Go-To-Market) Strategy Consultant creating an investor-grade, execution-ready GTM plan. Generate a COMPREHENSIVE and HIGHLY SPECIFIC GTM strategy.

## COMPANY PROFILE:
- Product: ${productName}
- Description: ${productDescription}
- Category: ${businessCategory}${customCategory ? ` (${customCategory})` : ''}
- Location: ${location}, India
- Stage: ${stage}
- Competitors: ${competitors}
- Differentiation: ${differentiation}
- Target Customer: ${targetCustomer}
- Market Type: ${marketType}
- Customer Interviews Done: ${customerInterviews}
- Total Investment: ₹${totalInvestment.toLocaleString('en-IN')}
- Pricing Model: ${pricingModel}
- Has Revenue: ${hasRevenue ? 'Yes' : 'No'}
${hasRevenue ? `- Monthly Revenue: ₹${monthlyRevenue.toLocaleString('en-IN')}` : ''}
- Customer Count: ${customerCount}
- Team Size: ${teamSize}
- Founder Background: ${founderBackground}
- Current Challenges: ${challenges.join(', ')}
- Acquisition Channels: ${acquisitionChannels.join(', ')}
- 6-Month Goal: ${sixMonthGoal}
- Funding Needed: ${fundingNeeded}
- Key Risks: ${risks.join(', ')}
- Estimated Valuation: ₹${estimatedValuation.toLocaleString('en-IN')}
- GTM Stage: ${gtmStage}
- Runway: ~${runwayMonths} months
- Founder GTM Bandwidth: ${founderBandwidth} hrs/week

## SWOT CONTEXT:
${swotAnalysis ? JSON.stringify(swotAnalysis, null, 2) : 'Not available'}

## GENERATE COMPREHENSIVE GTM STRATEGY:

Return ONLY valid JSON with this exact structure:

{
  "productOverview": {
    "oneLineDescription": "Concise value proposition for ${productName}",
    "category": "${businessCategory}",
    "primaryProblem": "The specific problem solved",
    "whyNow": {
      "marketShift": "What market change makes this urgent",
      "timing": "Why this moment is right"
    }
  },
  "targetMarket": {
    "icp": {
      "industry": "Target industry",
      "companySize": "SMB/Mid-Market/Enterprise or consumer type",
      "geography": "${location} and expansion targets",
      "decisionMaker": "Who makes buying decision"
    },
    "personas": [
      {
        "name": "Primary Persona",
        "role": "Job title/profile",
        "painPoints": ["Pain 1", "Pain 2", "Pain 3"],
        "buyingTrigger": "What event triggers purchase decision",
        "objections": ["Common objection 1", "Common objection 2"]
      },
      {
        "name": "Secondary Persona",
        "role": "Job title/profile",
        "painPoints": ["Pain 1", "Pain 2"],
        "buyingTrigger": "What triggers them",
        "objections": ["Objection 1"]
      }
    ],
    "earlyAdopters": {
      "who": "Description of early adopter segment",
      "why": "Why they adopt first",
      "whereToFind": "Specific places/channels to find them"
    },
    "massMarket": {
      "who": "Description of mass market",
      "timeline": "When to target them",
      "requirements": "What's needed before mass market"
    }
  },
  "valueProposition": {
    "statement": "For [target user], who struggle with [problem], ${productName} [core benefit], unlike [alternatives].",
    "keyBenefits": [
      {"type": "functional", "benefit": "Specific functional benefit", "proof": "Evidence/metric"},
      {"type": "emotional", "benefit": "Emotional benefit", "proof": "Evidence"},
      {"type": "strategic", "benefit": "Strategic benefit", "proof": "Evidence"}
    ],
    "proofPoints": [
      "Metric or case study 1",
      "Metric or case study 2",
      "Certification or benchmark"
    ]
  },
  "positioning": {
    "categoryPosition": "New category / Replacement / Alternative",
    "positioningStatement": "We are the [category] that [unique benefit] for [specific user segment] by [how you do it differently].",
    "whyUs": {
      "headline": "One powerful sentence about what makes you different (NO competitor mentions)",
      "subheadline": "Supporting statement that reinforces the main message",
      "proofPoint": "One metric or fact that proves your claim"
    },
    "differentiationAxes": [
      {"axis": "Speed", "yourPosition": "What you offer", "why": "Why this matters to customer"},
      {"axis": "Ease of Use", "yourPosition": "Your UX advantage", "why": "Customer benefit"},
      {"axis": "Price/Value", "yourPosition": "Your pricing position", "why": "Value delivered"},
      {"axis": "Trust/Safety", "yourPosition": "Trust factors", "why": "Why customers feel safe"},
      {"axis": "Unique Capability", "yourPosition": "What only you can do", "why": "Why this is valuable"}
    ],
    "competitorComparison": {
      "disclaimer": "Use this ONLY when prospects ask about competitors, never proactively mention them",
      "competitors": [
        {"name": "Competitor 1", "theirStrength": "What they're good at", "yourAdvantage": "Where you win", "whenToUse": "Scenario when you're better choice"}
      ],
      "battleCards": [
        {"scenario": "When prospect mentions competitor X", "response": "How to respond without badmouthing"}
      ]
    }
  },
  "pricing": {
    "model": "${pricingModel}",
    "tiers": [
      {"name": "Starter/Free", "price": "Price or Free", "features": ["Feature 1", "Feature 2"], "targetUser": "Who this is for"},
      {"name": "Pro/Core", "price": "Price point", "features": ["Feature 1", "Feature 2", "Feature 3"], "targetUser": "Primary target"},
      {"name": "Enterprise", "price": "Custom/Quote", "features": ["All Pro features", "Enterprise feature 1"], "targetUser": "Large organizations"}
    ],
    "pricingLogic": {
      "approach": "Value-based / Cost-plus / Competitive",
      "rationale": "Why this pricing makes sense",
      "expansionPath": "How to upsell/cross-sell"
    },
    "recommendations": [
      "Specific pricing recommendation 1",
      "Specific pricing recommendation 2"
    ]
  },
  "distribution": {
    "primaryChannels": [
      {"channel": "Channel 1", "priority": 1, "rationale": "Why this channel", "expectedCac": "Estimated CAC"},
      {"channel": "Channel 2", "priority": 2, "rationale": "Why this channel", "expectedCac": "Estimated CAC"},
      {"channel": "Channel 3", "priority": 3, "rationale": "Why this channel", "expectedCac": "Estimated CAC"}
    ],
    "salesMotion": {
      "type": "${customerCount < 20 ? 'Founder-led' : 'Inside sales'} / Self-serve / Field sales / Hybrid",
      "rationale": "Why this motion for your stage",
      "transitionPlan": "How to evolve sales motion as you scale"
    },
    "channelOwnership": {
      "leadGeneration": "Who owns lead gen",
      "qualification": "Who qualifies leads",
      "closing": "Who closes deals",
      "onboarding": "Who handles onboarding"
    }
  },
  "marketing": {
    "demandGeneration": {
      "content": ["Specific content strategy 1", "Strategy 2"],
      "paidAds": ["Platform 1 strategy", "Platform 2 strategy"],
      "community": ["Community tactic 1", "Tactic 2"],
      "events": ["Event type 1", "Event type 2"]
    },
    "brandMessaging": {
      "coreNarrative": "The story you tell",
      "channelMessages": [
        {"channel": "LinkedIn", "message": "LinkedIn-specific message"},
        {"channel": "Website", "message": "Website hero message"},
        {"channel": "Email", "message": "Email pitch"}
      ],
      "objectionHandling": [
        {"objection": "Common objection 1", "response": "How to handle"},
        {"objection": "Common objection 2", "response": "How to handle"}
      ]
    },
    "growthLoops": [
      {"type": "Referral", "mechanism": "How referral works", "incentive": "What's the incentive"},
      {"type": "Virality", "mechanism": "How product spreads", "kFactor": "Expected viral coefficient"},
      {"type": "Integration", "mechanism": "Partner/integration growth", "partners": "Target partners"}
    ]
  },
  "launchPlan": {
    "preLaunch": {
      "timeline": "X weeks before launch",
      "activities": [
        {"activity": "Beta program", "goal": "Target number of beta users", "timeline": "When"},
        {"activity": "Feedback collection", "goal": "What feedback to gather", "timeline": "When"},
        {"activity": "Waitlist building", "goal": "Target waitlist size", "timeline": "When"}
      ]
    },
    "launch": {
      "day1Channels": ["Channel 1", "Channel 2", "Channel 3"],
      "prAnnouncements": ["PR activity 1", "PR activity 2"],
      "promotions": ["Launch offer 1", "Launch offer 2"]
    },
    "postLaunch": {
      "iterationCycles": "How often to iterate",
      "featureRollouts": ["Feature 1 timeline", "Feature 2 timeline"],
      "expansionPlan": ["Segment expansion 1", "Geographic expansion"]
    }
  },
  "customerSuccess": {
    "firstValueMoment": {
      "definition": "What user experiences in first 5-10 minutes",
      "metric": "How to measure first value",
      "timeline": "Target time to first value"
    },
    "onboarding": {
      "tools": ["Onboarding tool 1", "Tool 2"],
      "milestones": ["Milestone 1", "Milestone 2", "Milestone 3"],
      "supportLevel": "Self-serve / Assisted / High-touch"
    },
    "retention": {
      "nudges": ["Nudge strategy 1", "Strategy 2"],
      "checkpoints": ["30-day checkpoint", "60-day checkpoint", "90-day checkpoint"],
      "expansionTriggers": ["When to upsell", "Cross-sell opportunity"]
    }
  },
  "metrics": {
    "northStar": {
      "metric": "The ONE metric that defines success",
      "target": "30/60/90 day targets",
      "rationale": "Why this metric"
    },
    "acquisition": {
      "cac": {"current": "Current or estimated CAC", "target": "Target CAC"},
      "conversionRate": {"current": "Current rate", "target": "Target rate"},
      "cpl": {"current": "Cost per lead", "target": "Target CPL"}
    },
    "activation": {
      "timeToFirstValue": {"current": "Current", "target": "Target"},
      "activationRate": {"current": "Current", "target": "Target"},
      "featureAdoption": {"key features": ["Feature 1", "Feature 2"]}
    },
    "revenue": {
      "arpu": {"current": "₹${arpc || 'TBD'}", "target": "Target ARPU"},
      "ltv": {"current": "Current LTV", "target": "Target LTV"},
      "churn": {"current": "Current churn", "target": "Target churn"},
      "expansionRevenue": {"current": "Current", "target": "Target"}
    }
  },
  "risks": [
    {"risk": "Adoption risk", "impact": "High/Medium/Low", "mitigation": "Specific mitigation strategy"},
    {"risk": "Pricing risk", "impact": "High/Medium/Low", "mitigation": "Specific mitigation"},
    {"risk": "Channel risk", "impact": "High/Medium/Low", "mitigation": "Specific mitigation"},
    {"risk": "Operational risk", "impact": "High/Medium/Low", "mitigation": "Specific mitigation"},
    {"risk": "Competitive risk", "impact": "High/Medium/Low", "mitigation": "Specific mitigation"}
  ],
  "executionPlan": {
    "month1": {
      "theme": "Validation & Readiness",
      "objectives": ["Objective 1", "Objective 2", "Objective 3"],
      "keyActions": [
        {"action": "Action 1", "owner": "Founder/Team", "deliverable": "Output", "timeline": "Week X"},
        {"action": "Action 2", "owner": "Founder/Team", "deliverable": "Output", "timeline": "Week X"}
      ],
      "successMetrics": ["Metric 1", "Metric 2"]
    },
    "month2": {
      "theme": "Launch & Optimization",
      "objectives": ["Objective 1", "Objective 2", "Objective 3"],
      "keyActions": [
        {"action": "Action 1", "owner": "Founder/Team", "deliverable": "Output", "timeline": "Week X"},
        {"action": "Action 2", "owner": "Founder/Team", "deliverable": "Output", "timeline": "Week X"}
      ],
      "successMetrics": ["Metric 1", "Metric 2"]
    },
    "month3": {
      "theme": "Scale & Expansion",
      "objectives": ["Objective 1", "Objective 2", "Objective 3"],
      "keyActions": [
        {"action": "Action 1", "owner": "Founder/Team", "deliverable": "Output", "timeline": "Week X"},
        {"action": "Action 2", "owner": "Founder/Team", "deliverable": "Output", "timeline": "Week X"}
      ],
      "successMetrics": ["Metric 1", "Metric 2"]
    }
  },
  "hypotheses": [
    {
      "id": "H1",
      "hypothesis": "Specific testable hypothesis about ${targetCustomer}",
      "channel": "Channel to test",
      "message": "Core message to test",
      "successSignal": "What success looks like",
      "timebox": "14 days",
      "cost": "₹0 + X hours",
      "confidence": "High/Medium/Low",
      "status": "Active"
    },
    {
      "id": "H2",
      "hypothesis": "Second hypothesis to test",
      "channel": "Channel",
      "message": "Message",
      "successSignal": "Success metric",
      "timebox": "21 days",
      "cost": "Cost estimate",
      "confidence": "Medium",
      "status": "Queued"
    }
  ],
  "decisions": {
    "H1_doubleDown": {
      "title": "What to double down on based on ${gtmStage} stage",
      "description": "Detailed explanation of why this deserves more resources",
      "currentState": "Where you are now with this",
      "targetState": "Where you should be in 30 days",
      "targetMetric": "Specific metric to track",
      "targetValue": "Specific number to hit",
      "weeklyMilestones": ["Week 1 goal", "Week 2 goal", "Week 3 goal", "Week 4 goal"],
      "actions": [
        {"action": "Specific action 1", "timeline": "This week", "owner": "Founder"},
        {"action": "Specific action 2", "timeline": "Week 2", "owner": "Founder"}
      ],
      "successSignals": ["Signal 1 that indicates it's working", "Signal 2"],
      "pivotTrigger": "If you see this, reconsider the approach"
    },
    "H2_pause": {
      "title": "What to pause for now",
      "description": "Why pausing this makes sense at your stage",
      "currentEffort": "How much time/money you're spending on this",
      "opportunityCost": "What you could do instead with those resources",
      "reviewDate": "When to reconsider (specific date or trigger)",
      "resumeTrigger": "What needs to happen before resuming this",
      "actions": [
        {"action": "How to gracefully pause", "timeline": "This week"}
      ]
    },
    "H3_kill": {
      "placeholder": true,
      "instruction": "This section is for YOU to add things that aren't working. Be honest with yourself about what to stop.",
      "examples": ["Feature nobody uses", "Channel with high CAC and low conversion", "Partnership that's draining resources"],
      "userItems": []
    }
  },
  "launchPlan": {
    "warmLeads": {
      "definition": "People who already know about ${productName} or have shown interest",
      "sources": ["Source 1 of warm leads", "Source 2"],
      "outreachSequence": [
        {"day": 1, "action": "Initial personalized reach out", "channel": "Email/WhatsApp/LinkedIn"},
        {"day": 3, "action": "Follow up with value add", "channel": "Same channel"},
        {"day": 7, "action": "Soft close or ask for referral", "channel": "Call preferred"}
      ],
      "targetCount": "Number of warm leads to contact",
      "expectedConversion": "Expected conversion rate"
    },
    "geoMarketing": {
      "primaryArea": "${location} - specific neighborhoods/areas to focus",
      "targetDensity": "How concentrated your initial marketing should be",
      "localChannels": [
        {"channel": "Local channel 1", "how": "How to use it", "budget": "Budget allocation"},
        {"channel": "Local channel 2", "how": "How to use it", "budget": "Budget allocation"}
      ],
      "offlineActivities": ["Local activity 1", "Local activity 2"],
      "onlineGeoTargeting": {
        "platforms": ["Instagram", "Google Ads"],
        "radius": "X km around target area",
        "budget": "Daily budget"
      }
    },
    "preLaunch": {
      "timeline": "X weeks before launch",
      "activities": [
        {"activity": "Beta program", "goal": "Target number of beta users", "timeline": "When", "trackingMetric": "What to measure"},
        {"activity": "Feedback collection", "goal": "What feedback to gather", "timeline": "When", "trackingMetric": "What to measure"},
        {"activity": "Waitlist building", "goal": "Target waitlist size", "timeline": "When", "trackingMetric": "What to measure"}
      ]
    },
    "launch": {
      "day1Channels": ["Channel 1", "Channel 2", "Channel 3"],
      "prAnnouncements": ["PR activity 1", "PR activity 2"],
      "promotions": ["Launch offer 1", "Launch offer 2"]
    },
    "postLaunch": {
      "iterationCycles": "How often to iterate",
      "featureRollouts": ["Feature 1 timeline", "Feature 2 timeline"],
      "expansionPlan": ["Segment expansion 1", "Geographic expansion"]
    }
  },
  "partners": {
    "targetCount": ${customerCount < 10 ? 20 : 50},
    "partnerTypes": [
      {"type": "Primary partner type", "count": "How many", "value": "What they bring"},
      {"type": "Secondary partner type", "count": "How many", "value": "What they bring"}
    ],
    "specificTargets": [
      {"name": "Specific partner/type to pursue in ${location}", "why": "Why good fit", "approach": "How to approach them"},
      {"name": "Another specific target", "why": "Why good fit", "approach": "How to approach them"}
    ],
    "partnerValue": {
      "whatYouOffer": "Value proposition for partners",
      "whatTheyGet": ["Benefit 1", "Benefit 2", "Benefit 3"],
      "revenueShare": "If applicable, suggested revenue share model"
    },
    "outreachPlan": {
      "week1": {"target": "X partners", "actions": ["Action 1", "Action 2"]},
      "week2": {"target": "X partners", "actions": ["Action 1", "Action 2"]},
      "week3": {"target": "X partners", "actions": ["Action 1", "Action 2"]},
      "week4": {"target": "X partners", "actions": ["Action 1", "Action 2"]}
    },
    "qualificationCriteria": ["Criterion 1", "Criterion 2", "Criterion 3"]
  },
  "cac": {
    "currentEstimate": "₹X per customer (estimate if pre-revenue)",
    "targetCAC": "₹X (what it should be for unit economics to work)",
    "channels": [
      {
        "channel": "Channel name",
        "estimatedCAC": "₹X",
        "volume": "Customers per month",
        "tactics": ["Specific tactic 1", "Specific tactic 2"],
        "budget": "₹X per month",
        "trackingMethod": "How to track attribution"
      }
    ],
    "optimizationPlan": [
      {"week": 1, "focus": "Test channels", "budget": "₹X", "target": "Learn which channel works"},
      {"week": 2, "focus": "Double down on winner", "budget": "₹X", "target": "Reduce CAC by X%"},
      {"week": 3, "focus": "Optimize creatives/copy", "budget": "₹X", "target": "Improve conversion by X%"},
      {"week": 4, "focus": "Scale what works", "budget": "₹X", "target": "Reach X customers"}
    ],
    "unitEconomics": {
      "ltv": "Estimated LTV",
      "ltvCacRatio": "Target ratio (should be > 3:1)",
      "paybackPeriod": "Months to recover CAC"
    }
  },
  "vcSlides": {
    "slide1": {
      "title": "GTM Philosophy",
      "points": [
        "How ${productName} decides on GTM investments",
        "The decision framework used",
        "Cost per learning benchmark"
      ]
    },
    "slide2": {
      "title": "Current GTM Focus",
      "points": [
        "Primary channel and why",
        "Current traction metrics",
        "What's working and what's not"
      ]
    },
    "slide3": {
      "title": "GTM Roadmap",
      "points": [
        "30-day milestones",
        "Channel evolution plan",
        "Scale triggers"
      ]
    }
  }
}`;

    try {
      const systemContext = `You are an elite GTM Strategy Consultant. Generate a HIGHLY SPECIFIC, ACTIONABLE GTM strategy for ${productName}. 
Every recommendation must be tailored to their specific:
- Stage: ${stage}
- Market: ${marketType}
- Category: ${businessCategory}
- Team size: ${teamSize}
- Runway: ${runwayMonths} months
- Current traction: ${hasRevenue ? `₹${monthlyRevenue}/mo, ${customerCount} customers` : 'Pre-revenue'}

DO NOT use generic advice. Every point must be specific to this company.
Return ONLY valid JSON.`;

      const geminiResponse = await callGemini(gtmPrompt, systemContext);
      
      // Clean and parse JSON
      let content = geminiResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const firstBrace = content.indexOf('{');
      const lastBrace = content.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace !== -1) {
        content = content.substring(firstBrace, lastBrace + 1);
      }
      
      const gtmStrategy = JSON.parse(content);
      
      // Store GTM strategy in database
      if (db) {
        const collection = db.collection('gtm_strategies');
        await collection.updateOne(
          { userId },
          { 
            $set: { 
              userId,
              strategy: gtmStrategy,
              ddqSnapshot: ddqResponses,
              updatedAt: new Date()
            },
            $setOnInsert: { createdAt: new Date() }
          },
          { upsert: true }
        );
      }
      
      console.log('✅ GTM Strategy generated for:', productName);
      res.json({
        success: true,
        strategy: gtmStrategy,
        metadata: {
          productName,
          stage,
          gtmStage,
          generatedAt: new Date().toISOString()
        }
      });
      
    } catch (parseError) {
      console.error('GTM generation parse error:', parseError);
      // Return structured fallback based on user data
      res.json({
        success: true,
        strategy: generateFallbackGTM(ddqResponses, gtmStage, runwayMonths, hasRevenue, monthlyRevenue, customerCount, targetCustomer, productName, businessCategory, pricingModel, competitors, marketType, founderBandwidth, teamSize),
        metadata: {
          productName,
          stage,
          gtmStage,
          generatedAt: new Date().toISOString(),
          fallback: true
        }
      });
    }
    
  } catch (error) {
    console.error('GTM Strategy generation error:', error);
    res.status(500).json({ error: 'Failed to generate GTM strategy', details: error.message });
  }
});

// Fallback GTM generator when AI fails - Context-aware version
function generateFallbackGTM(ddqResponses, gtmStage, runwayMonths, hasRevenue, monthlyRevenue, customerCount, targetCustomer, productName, businessCategory, pricingModel, competitors, marketType, founderBandwidth, teamSize) {
  
  // Detect business type from category and product description
  const productDesc = (ddqResponses[2] || '').toLowerCase();
  const categoryLower = businessCategory.toLowerCase();
  const differentiation = ddqResponses[7] || '';
  const location = ddqResponses[4] || 'India';
  
  // Context detection for intelligent responses
  const isFoodDelivery = categoryLower.includes('food') || categoryLower.includes('restaurant') || productDesc.includes('food') || productDesc.includes('delivery') || productDesc.includes('restaurant');
  const isEcommerce = categoryLower.includes('e-commerce') || categoryLower.includes('ecommerce') || categoryLower.includes('retail') || productDesc.includes('shop') || productDesc.includes('store');
  const isFintech = categoryLower.includes('fintech') || categoryLower.includes('finance') || categoryLower.includes('payment') || productDesc.includes('payment') || productDesc.includes('loan');
  const isHealthtech = categoryLower.includes('health') || categoryLower.includes('medical') || productDesc.includes('health') || productDesc.includes('doctor');
  const isEdtech = categoryLower.includes('education') || categoryLower.includes('edtech') || productDesc.includes('learn') || productDesc.includes('course');
  const isSaaS = categoryLower.includes('saas') || categoryLower.includes('software') || marketType === 'B2B';
  
  // Generate context-specific content
  const getContextualPainPoints = () => {
    if (isFoodDelivery) return ["Long wait times for food delivery", "Limited restaurant options in their area", "Inconsistent food quality and delivery experience", "High delivery fees eating into their budget"];
    if (isEcommerce) return ["Finding quality products at good prices", "Trust issues with online sellers", "Slow or unreliable delivery", "Complicated return processes"];
    if (isFintech) return ["Complex loan/payment processes", "High transaction fees", "Lack of transparency in financial products", "Poor customer support from traditional banks"];
    if (isHealthtech) return ["Long wait times for appointments", "Difficulty finding the right specialist", "Managing health records across providers", "High cost of quality healthcare"];
    if (isEdtech) return ["Boring or outdated learning content", "Lack of personalized learning paths", "No practical skill application", "Expensive courses with uncertain outcomes"];
    return ["Time-consuming manual processes", "Lack of visibility and control", "Scaling challenges as they grow", "Integration with existing tools"];
  };

  const getContextualChannels = () => {
    if (isFoodDelivery) return ["App Store optimization", "Local food blogger partnerships", "Restaurant partner referrals", "Social media food content"];
    if (isEcommerce) return ["Instagram/Facebook shops", "Influencer marketing", "Google Shopping ads", "WhatsApp commerce"];
    if (isFintech) return ["Referral programs", "Content marketing on financial literacy", "Partnerships with employers/businesses", "App store presence"];
    if (isHealthtech) return ["Doctor/clinic partnerships", "Health insurance tie-ups", "Corporate wellness programs", "Pharmacy channel"];
    if (isEdtech) return ["SEO for learning queries", "YouTube educational content", "School/college partnerships", "LinkedIn for professional courses"];
    return ["LinkedIn for B2B", "Content marketing", "Referral programs", "Direct outreach"];
  };

  const getContextualValueProp = () => {
    if (isFoodDelivery) return `For ${targetCustomer || 'food lovers'} who want delicious meals delivered fast, ${productName} provides quick, reliable food delivery with great restaurant choices, unlike ${competitors || 'traditional food ordering'} where wait times are unpredictable and options limited.`;
    if (isEcommerce) return `For ${targetCustomer || 'online shoppers'} tired of unreliable e-commerce experiences, ${productName} delivers quality products with fast shipping and easy returns, unlike ${competitors || 'typical online stores'} where trust and delivery are concerns.`;
    if (isFintech) return `For ${targetCustomer || 'users seeking financial solutions'} frustrated with complex traditional finance, ${productName} makes ${productDesc.includes('payment') ? 'payments' : 'financial services'} simple and transparent, unlike ${competitors || 'traditional banks'} with hidden fees and paperwork.`;
    if (isHealthtech) return `For ${targetCustomer || 'patients'} struggling to access quality healthcare, ${productName} provides convenient, affordable health solutions, unlike ${competitors || 'traditional healthcare'} with long waits and high costs.`;
    if (isEdtech) return `For ${targetCustomer || 'learners'} seeking practical skills that matter, ${productName} delivers engaging, outcome-focused education, unlike ${competitors || 'traditional courses'} that are boring and theoretical.`;
    return `For ${targetCustomer} seeking better solutions, ${productName} provides ${differentiation || 'a modern, efficient approach'}, unlike ${competitors || 'traditional alternatives'} that fail to meet evolving needs.`;
  };

  const getContextualMetrics = () => {
    if (isFoodDelivery) return { northStar: "Orders per Day", secondary: ["Avg Delivery Time", "Customer Repeat Rate", "Restaurant Partner NPS"] };
    if (isEcommerce) return { northStar: "Gross Merchandise Value (GMV)", secondary: ["Conversion Rate", "Repeat Purchase Rate", "Customer Acquisition Cost"] };
    if (isFintech) return { northStar: "Transaction Volume", secondary: ["User Activation Rate", "Default Rate", "Customer LTV"] };
    if (isHealthtech) return { northStar: "Consultations/Appointments Booked", secondary: ["Patient Satisfaction", "Doctor Utilization", "Repeat Visits"] };
    if (isEdtech) return { northStar: "Course Completion Rate", secondary: ["Student Enrollment", "Learning Outcomes", "NPS Score"] };
    return { northStar: hasRevenue ? "Monthly Recurring Revenue" : "Weekly Active Users", secondary: ["Activation Rate", "Retention", "Referral Rate"] };
  };

  const getContextualRisks = () => {
    if (isFoodDelivery) return [
      { risk: "Restaurant supply - not enough quality partners", impact: "High", mitigation: "Build strong restaurant relations team; offer favorable commission initially" },
      { risk: "Delivery logistics - poor delivery experience", impact: "High", mitigation: "Invest in delivery fleet management; implement real-time tracking" },
      { risk: "Unit economics - high CAC and delivery costs", impact: "Critical", mitigation: "Focus on dense areas first; optimize delivery routes; increase order frequency" },
      { risk: "Competition from " + (competitors || "Swiggy/Zomato"), impact: "High", mitigation: differentiation ? `Leverage: ${differentiation}` : "Focus on niche cuisine or underserved areas" }
    ];
    if (isEcommerce) return [
      { risk: "Inventory and fulfillment challenges", impact: "High", mitigation: "Start with marketplace model or dropship; add inventory strategically" },
      { risk: "Customer trust and returns", impact: "Medium", mitigation: "Easy returns policy; customer reviews; quality checks" },
      { risk: "Competition on price", impact: "High", mitigation: "Focus on unique products or superior service; avoid pure price war" }
    ];
    return [
      { risk: "Product-market fit uncertainty", impact: "High", mitigation: "Rapid iteration based on user feedback; kill features that don't work" },
      { risk: "Customer acquisition cost too high", impact: "Medium", mitigation: "Focus on organic channels first; optimize conversion before scaling paid" },
      { risk: "Competition from " + competitors, impact: "Medium", mitigation: differentiation ? `Differentiate on: ${differentiation}` : "Find underserved niche" }
    ];
  };

  const contextMetrics = getContextualMetrics();
  const contextChannels = getContextualChannels();
  
  return {
    productOverview: {
      oneLineDescription: ddqResponses[2] || `${productName} - ${isFoodDelivery ? 'Food delivery platform' : isEcommerce ? 'E-commerce platform' : isFintech ? 'Fintech solution' : 'Technology solution'} for ${location}`,
      category: businessCategory,
      primaryProblem: isFoodDelivery ? "Getting delicious food delivered quickly and reliably" : isEcommerce ? "Finding and buying quality products online with trust" : `Solving ${targetCustomer}'s core challenges`,
      whyNow: {
        marketShift: isFoodDelivery ? "Post-pandemic food delivery habits are permanent; convenience is the new normal" : isEcommerce ? "Digital-first shopping behavior accelerating across India" : "Market conditions creating demand for better solutions",
        timing: isFoodDelivery ? "Food delivery market in India growing 25%+ annually" : isEcommerce ? "E-commerce penetration still low in India - huge headroom" : "Early movers in this segment can capture market share"
      }
    },
    targetMarket: {
      icp: {
        industry: businessCategory,
        companySize: marketType === 'B2B' ? 'SMB to Mid-Market' : 'Individual consumers',
        geography: location,
        decisionMaker: isFoodDelivery ? "Urban consumers aged 18-45" : isEcommerce ? "Online-savvy shoppers" : marketType === 'B2B' ? "Department head or founder" : "End user"
      },
      personas: [
        {
          name: isFoodDelivery ? "Busy Professional" : isEcommerce ? "Value-Conscious Shopper" : "Primary User",
          role: targetCustomer || (isFoodDelivery ? "Working professionals, students, families" : "Target customer segment"),
          painPoints: getContextualPainPoints(),
          buyingTrigger: isFoodDelivery ? "Hungry, short on time, or craving variety" : isEcommerce ? "Need for product, good deal found" : "Acute need or frustration with current solution",
          objections: isFoodDelivery ? ["Delivery fees too high", "Will food arrive fresh?", "Limited healthy options"] : ["Is this trustworthy?", "What's the return policy?", "Will this work for me?"]
        }
      ],
      earlyAdopters: {
        who: isFoodDelivery ? "Food enthusiasts, busy professionals in urban areas" : isEcommerce ? "Tech-savvy early adopters, deal hunters" : "Innovation-focused " + targetCustomer,
        why: isFoodDelivery ? "They order food frequently and try new apps" : isEcommerce ? "They actively seek new platforms for better deals" : "They actively seek better solutions",
        whereToFind: isFoodDelivery ? "Food Instagram/YouTube, office complexes, college areas" : isEcommerce ? "Deal forums, social media, tech communities" : "LinkedIn, industry forums, conferences"
      },
      massMarket: {
        who: isFoodDelivery ? "General urban population who occasionally order food" : isEcommerce ? "Mainstream online shoppers" : "Mainstream " + targetCustomer,
        timeline: "After 1000+ orders/transactions and strong reviews",
        requirements: isFoodDelivery ? "Fast delivery, good prices, quality food, wide selection" : isEcommerce ? "Trust signals, competitive prices, reliable delivery" : "Proven ROI, smooth onboarding, customer success stories"
      }
    },
    valueProposition: {
      statement: getContextualValueProp(),
      keyBenefits: isFoodDelivery ? [
        {type: "functional", benefit: "Get food delivered in under 30 minutes", proof: "Real-time tracking, optimized delivery routes"},
        {type: "emotional", benefit: "Never worry about what to eat - variety at your fingertips", proof: "Wide restaurant selection"},
        {type: "economic", benefit: "Better prices through exclusive deals and no minimum order", proof: "Daily offers and loyalty rewards"}
      ] : isEcommerce ? [
        {type: "functional", benefit: "Find exactly what you need, delivered fast", proof: "Smart search and quick delivery"},
        {type: "emotional", benefit: "Shop with confidence - quality guaranteed", proof: "Verified sellers and easy returns"},
        {type: "economic", benefit: "Best prices with price match guarantee", proof: "Competitive pricing algorithms"}
      ] : [
        {type: "functional", benefit: differentiation || "Solve your core problem efficiently", proof: "Based on user feedback"},
        {type: "emotional", benefit: "Feel confident and in control", proof: "Customer testimonials"},
        {type: "strategic", benefit: "Scale and grow without friction", proof: "Platform capabilities"}
      ],
      proofPoints: hasRevenue ? [`${customerCount} active users`, `₹${monthlyRevenue.toLocaleString('en-IN')} monthly revenue`] : ["Beta users actively using the product", "Strong engagement and repeat usage"]
    },
    positioning: {
      categoryPosition: isFoodDelivery ? `The ${differentiation || 'faster, more reliable'} food delivery app for ${location}` : isEcommerce ? `The ${differentiation || 'trusted'} shopping destination` : `Modern ${businessCategory} solution`,
      positioningStatement: getContextualValueProp(),
      differentiationAxes: [
        {axis: isFoodDelivery ? "Delivery Speed" : "Core Value", position: differentiation || "Better than alternatives", vsCompetitors: competitors ? `Faster/better than ${competitors}` : "Superior experience"},
        {axis: isFoodDelivery ? "Restaurant Quality" : "Reliability", position: "Curated and verified", vsCompetitors: "Higher quality standards"},
        {axis: "Price Value", position: "Competitive with added value", vsCompetitors: "Better value proposition"}
      ],
      competitiveResponse: {
        vsMainCompetitor: differentiation || `Focus on what ${competitors || 'competitors'} can't match`,
        keyTalkingPoints: isFoodDelivery ? ["Faster delivery", "Better restaurant partners", "Lower fees"] : ["Better experience", "More trustworthy", "Better value"]
      }
    },
    pricing: {
      model: pricingModel || (isFoodDelivery ? "Transaction fee per order" : isEcommerce ? "Marketplace commission" : "Subscription"),
      tiers: isFoodDelivery ? [
        {name: "Standard", price: "Free to download", features: ["Access to all restaurants", "Standard delivery"], targetUser: "All users"},
        {name: "Pro/Premium", price: "₹99-199/month", features: ["Free delivery", "Priority support", "Exclusive deals"], targetUser: "Frequent orderers"}
      ] : [
        {name: "Starter", price: "Free to try", features: ["Core features", "Standard support"], targetUser: "New users"},
        {name: "Pro", price: "Based on usage/value", features: ["Full features", "Priority support"], targetUser: "Power users"},
        {name: "Enterprise", price: "Custom", features: ["Custom integrations", "Dedicated support"], targetUser: "Large organizations"}
      ],
      pricingLogic: {
        approach: isFoodDelivery ? "Transaction-based with subscription upsell" : "Value-based",
        rationale: isFoodDelivery ? "Low barrier to first order; make money on volume and subscriptions" : "Priced based on value delivered",
        expansionPath: isFoodDelivery ? "Increase order frequency, add grocery/essentials" : "Upsell to premium tiers, add adjacent services"
      },
      recommendations: isFoodDelivery ? ["Keep first order friction low", "Build subscription for retention", "Add delivery fee only after trust is built"] : ["Start simple, add complexity later", "Test price elasticity with different segments"]
    },
    distribution: {
      primaryChannels: isFoodDelivery ? [
        {channel: "App Store Optimization (ASO)", priority: 1, rationale: "Food apps are searched directly in app stores", expectedCac: "Low - organic discovery"},
        {channel: "Local food influencer partnerships", priority: 2, rationale: "Food content performs well on Instagram/YouTube", expectedCac: "₹500-2000 per influencer post"},
        {channel: "Restaurant partner co-marketing", priority: 3, rationale: "Restaurants promote to their existing customers", expectedCac: "Revenue share model"}
      ] : isEcommerce ? [
        {channel: "Instagram/Facebook Shopping", priority: 1, rationale: "Visual product discovery", expectedCac: "₹50-200 per customer"},
        {channel: "Google Shopping Ads", priority: 2, rationale: "High intent searches", expectedCac: "₹100-300 per customer"},
        {channel: "Influencer marketing", priority: 3, rationale: "Trust-building for new brands", expectedCac: "Variable - performance based"}
      ] : [
        {channel: hasRevenue ? "Customer referrals" : "Direct outreach", priority: 1, rationale: gtmStage === 'Pre-Revenue' ? "Fastest feedback loop" : "Highest conversion rate", expectedCac: "Low (time-based)"},
        {channel: "Content marketing", priority: 2, rationale: "Builds trust and authority", expectedCac: "Medium (time investment)"},
        {channel: "Partnerships", priority: 3, rationale: "Leverage existing trust", expectedCac: "Variable"}
      ],
      salesMotion: {
        type: isFoodDelivery ? "Product-led growth (app-first)" : isEcommerce ? "Self-serve with chat support" : customerCount < 20 ? "Founder-led sales" : "Inside sales with founder involvement",
        rationale: isFoodDelivery ? "Users download app and order without sales touch" : `At ${gtmStage} stage, ${isFoodDelivery ? 'focus on product experience' : 'founder involvement ensures product feedback loop'}`,
        transitionPlan: isFoodDelivery ? "Add corporate sales for office catering once B2C proven" : "Hire first sales rep after consistent 10+ demos/month"
      },
      channelOwnership: {
        leadGeneration: isFoodDelivery ? "Performance marketing + ASO team" : "Founder + Content",
        qualification: isFoodDelivery ? "Automated (app onboarding)" : "Founder",
        closing: isFoodDelivery ? "Self-serve (first order)" : "Founder",
        onboarding: isFoodDelivery ? "In-app experience" : teamSize > 2 ? "Team member" : "Founder"
      }
    },
    marketing: {
      demandGeneration: {
        content: isFoodDelivery ? ["Food photography and videos", "Restaurant spotlight stories", "Local food guides and recommendations"] : isEcommerce ? ["Product showcases", "User reviews and unboxing", "Deal alerts and guides"] : ["LinkedIn posts on industry problems", "Case studies from early customers"],
        paidAds: isFoodDelivery ? ["App install campaigns on Facebook/Instagram", "Google App campaigns", "YouTube pre-roll for food content"] : isEcommerce ? ["Google Shopping", "Facebook/Instagram product ads", "Retargeting campaigns"] : gtmStage === 'Pre-Revenue' ? ["Not recommended yet - validate organically first"] : ["LinkedIn ads for B2B", "Google search ads for intent"],
        community: isFoodDelivery ? ["Food blogger WhatsApp groups", "Local foodie communities", "Office lunch groups"] : isEcommerce ? ["Deal hunting forums", "Product review communities", "Social shopping groups"] : ["Industry Slack groups", "Reddit communities", "WhatsApp groups"],
        events: isFoodDelivery ? ["Food festivals and pop-ups", "Restaurant launch events", "Corporate lunch partnerships"] : isEcommerce ? ["Flash sales events", "Festival shopping campaigns", "Influencer live sessions"] : ["Webinars on industry topics", "Local meetups"]
      },
      brandMessaging: {
        coreNarrative: isFoodDelivery ? `${productName}: Your favorite food, delivered fast. Because hunger can't wait.` : isEcommerce ? `${productName}: Shop smart. Get more.` : `Empowering ${targetCustomer} to achieve more with less effort`,
        channelMessages: isFoodDelivery ? [
          {channel: "Instagram", message: "Drool-worthy food content and quick delivery proofs"},
          {channel: "Push notifications", message: "Personalized meal suggestions and exclusive deals"},
          {channel: "In-app", message: "Seamless ordering with real-time tracking"}
        ] : [
          {channel: "LinkedIn", message: "Problem-focused thought leadership"},
          {channel: "Website", message: "Clear value proposition with social proof"},
          {channel: "Email", message: "Personalized outreach showing understanding of their challenges"}
        ],
        objectionHandling: isFoodDelivery ? [
          {objection: "Delivery fee is too high", response: "Subscribe to Pro for free unlimited delivery - pays for itself in 3-4 orders"},
          {objection: "Food arrives cold", response: "Our insulated bags and fast delivery ensure your food arrives fresh. Plus, we have a freshness guarantee."},
          {objection: "Why not order from Swiggy/Zomato?", response: differentiation || "We focus on [niche] with faster delivery and exclusive restaurants they don't have"}
        ] : [
          {objection: "We already have a solution", response: "What's the one thing you wish it did better?"},
          {objection: "Budget is tight", response: "Let's calculate the ROI together - most customers see payback in X months"}
        ]
      },
      growthLoops: isFoodDelivery ? [
        {type: "Referral", mechanism: "Give ₹100, Get ₹100 on referral's first order", incentive: "Double-sided referral credits", kFactor: "0.3-0.5 for food apps"},
        {type: "Frequency", mechanism: "Rewards program - earn points on every order", incentive: "Free delivery, discounts on milestone orders"},
        {type: "Social", mechanism: "Share your order/review to earn credits", incentive: "₹25 credit for reviews with photos"}
      ] : [
        {type: "Referral", mechanism: "Happy customers refer peers", incentive: "Extended trial or discount for referrer", kFactor: "0.3-0.5 expected"},
        {type: "Content", mechanism: "Users share insights from product", incentive: "Feature in case study", kFactor: "0.2-0.3 expected"}
      ]
    },
    launchPlan: {
      preLaunch: {
        timeline: "2-4 weeks",
        activities: [
          {activity: "Beta program", goal: "10-20 beta users", timeline: "Week 1-2"},
          {activity: "Feedback collection", goal: "Identify top 3 improvements", timeline: "Week 2-3"},
          {activity: "Case study creation", goal: "1-2 detailed case studies", timeline: "Week 3-4"}
        ]
      },
      launch: {
        day1Channels: ["LinkedIn announcement", "Email to waitlist", "Direct outreach to warm leads"],
        prAnnouncements: ["Product Hunt if applicable", "Industry newsletter features"],
        promotions: ["Early adopter pricing", "Extended trial for first 50 customers"]
      },
      postLaunch: {
        iterationCycles: "Weekly based on user feedback",
        featureRollouts: ["Priority features from beta feedback", "Integration requests"],
        expansionPlan: ["Adjacent customer segments", "Geographic expansion within India"]
      }
    },
    customerSuccess: {
      firstValueMoment: {
        definition: "User completes core action and sees immediate benefit",
        metric: "Time to first core action completion",
        timeline: "Under 10 minutes ideal"
      },
      onboarding: {
        tools: ["In-app tooltips", "Video tutorials", "Onboarding call for Pro/Enterprise"],
        milestones: ["Account setup", "First core action", "First valuable output"],
        supportLevel: customerCount < 20 ? "High-touch (founder involvement)" : "Guided self-serve"
      },
      retention: {
        nudges: ["Usage tips via email", "Feature discovery prompts", "Success milestone celebrations"],
        checkpoints: ["Day 7: Check engagement", "Day 30: NPS survey", "Day 60: Expansion conversation"],
        expansionTriggers: ["Usage hitting tier limits", "New team members joining", "Positive NPS score"]
      }
    },
    metrics: {
      northStar: {
        metric: hasRevenue ? "Monthly Recurring Revenue (MRR)" : "Weekly Active Users completing core action",
        target: hasRevenue ? `3x MRR in 6 months` : "50+ active users in 90 days",
        rationale: "Best indicator of product-market fit and growth trajectory"
      },
      acquisition: {
        cac: {current: isFoodDelivery ? "₹100-300 per install" : "Founder time-based", target: isFoodDelivery ? "Under ₹150 per ordering user" : "Under ₹5,000 for SMB"},
        conversionRate: {current: gtmStage === 'Pre-Revenue' ? "TBD" : isFoodDelivery ? "~15-25% install-to-order" : "~5-10%", target: isFoodDelivery ? "30%+ install-to-first-order" : "15-20%"},
        cpl: {current: "Organic focus", target: isFoodDelivery ? "Under ₹50 per install" : "Under ₹500"}
      },
      activation: {
        timeToFirstValue: {current: "TBD", target: isFoodDelivery ? "Under 3 minutes to first order" : "Under 10 minutes"},
        activationRate: {current: gtmStage === 'Pre-Revenue' ? "Measuring" : "~40%", target: isFoodDelivery ? "25%+ D7 retention" : "60%+"},
        featureAdoption: {keyFeatures: isFoodDelivery ? ["Browse restaurants", "Complete first order", "Track delivery"] : ["Core feature 1", "Core feature 2"]}
      },
      revenue: {
        arpu: {current: hasRevenue && customerCount > 0 ? `₹${Math.round(monthlyRevenue/customerCount).toLocaleString('en-IN')}` : "TBD", target: isFoodDelivery ? "₹300-500 per ordering user/month" : "20% increase"},
        ltv: {current: "Calculating", target: isFoodDelivery ? "₹3000+ per user (12-month)" : "3x CAC minimum"},
        churn: {current: "Early to measure", target: isFoodDelivery ? "Under 20% monthly inactive" : "Under 5% monthly"},
        expansionRevenue: {current: "Not yet", target: isFoodDelivery ? "Grocery/essentials add-on" : "20% of MRR"}
      }
    },
    risks: getContextualRisks(),
    executionPlan: {
      month1: {
        theme: isFoodDelivery ? "Supply & Product Validation" : "Validation & Readiness",
        objectives: isFoodDelivery ? ["Onboard 20+ quality restaurants", "Launch app in one locality", "Get first 100 orders"] : ["Validate core value proposition", "Establish baseline metrics", "Build initial pipeline"],
        keyActions: isFoodDelivery ? [
          {action: "Sign up 20 restaurant partners in target area", owner: "Founder", deliverable: "Restaurant contracts signed", timeline: "Week 1-2"},
          {action: "Onboard 5 delivery partners", owner: "Founder/Ops", deliverable: "Delivery fleet ready", timeline: "Week 2"},
          {action: "Soft launch with friends/family + local marketing", owner: "Founder", deliverable: "100+ orders completed", timeline: "Week 3-4"}
        ] : [
          {action: "Complete 10 customer interviews", owner: "Founder", deliverable: "ICP validation doc", timeline: "Week 1-2"},
          {action: "Set up analytics and tracking", owner: "Founder", deliverable: "Dashboard live", timeline: "Week 1"},
          {action: "Launch outreach to first 30 prospects", owner: "Founder", deliverable: "5+ demos booked", timeline: "Week 2-4"}
        ],
        successMetrics: isFoodDelivery ? ["20+ restaurant partners live", "100+ completed orders", "Avg delivery time <35 min"] : ["10+ customer conversations", "Clear ICP definition", "First demo feedback"]
      },
      month2: {
        theme: isFoodDelivery ? "Optimize Unit Economics" : "Launch & Optimization",
        objectives: isFoodDelivery ? ["Improve delivery times", "Increase order frequency", "Achieve positive unit economics"] : ["Convert first paying customers", "Iterate based on feedback", "Establish repeatable process"],
        keyActions: isFoodDelivery ? [
          {action: "Analyze and optimize delivery routes", owner: "Ops", deliverable: "<30 min avg delivery", timeline: "Week 5-6"},
          {action: "Launch referral program", owner: "Marketing", deliverable: "20% orders from referrals", timeline: "Week 6-7"},
          {action: "Negotiate better restaurant commissions", owner: "Founder", deliverable: "Positive unit economics", timeline: "Week 7-8"}
        ] : [
          {action: "Close first 5 paying customers", owner: "Founder", deliverable: "Revenue start", timeline: "Week 5-6"},
          {action: "Document sales playbook", owner: "Founder", deliverable: "Playbook v1", timeline: "Week 6-7"},
          {action: "Create first case study", owner: "Founder", deliverable: "Published case study", timeline: "Week 7-8"}
        ],
        successMetrics: isFoodDelivery ? ["500+ orders", "20%+ repeat customers", "Positive contribution margin"] : ["5+ paying customers", "Clear objection handling", "Repeatable demo process"]
      },
      month3: {
        theme: isFoodDelivery ? "Scale to New Areas" : "Scale & Expansion",
        objectives: isFoodDelivery ? ["Expand to 2-3 more localities", "Launch marketing campaigns", "Build team for scale"] : ["Double customer count", "Test second channel", "Prepare for growth hire"],
        keyActions: isFoodDelivery ? [
          {action: "Expand to 2 new high-density areas", owner: "Founder/Ops", deliverable: "3x coverage area", timeline: "Week 9-10"},
          {action: "Launch paid acquisition campaigns", owner: "Marketing", deliverable: "1000+ new installs", timeline: "Week 10-11"},
          {action: "Hire ops manager and 2 support staff", owner: "Founder", deliverable: "Core team in place", timeline: "Week 12"}
        ] : [
          {action: "Scale winning channel", owner: "Founder", deliverable: "2x pipeline", timeline: "Week 9-10"},
          {action: "Test secondary channel", owner: "Founder", deliverable: "Channel validation", timeline: "Week 10-11"},
          {action: "Define first hire requirements", owner: "Founder", deliverable: "Job description", timeline: "Week 12"}
        ],
        successMetrics: ["10+ customers", "Second channel showing signal", "Ready for first hire"]
      }
    },
    hypotheses: [
      {
        id: "H1",
        hypothesis: `${targetCustomer} will respond to direct outreach highlighting their specific pain point`,
        channel: gtmStage === 'Pre-Revenue' ? "LinkedIn DM / Cold Email" : "Customer referrals",
        message: gtmStage === 'Pre-Revenue' ? "I'm building X for people like you. Can I get 15 min of feedback?" : "Your peer [Customer] thought you'd find this valuable",
        successSignal: gtmStage === 'Pre-Revenue' ? "≥10% response rate, ≥3 demos from 30 outreach" : "≥40% referral acceptance rate",
        timebox: "14 days",
        cost: `₹0 + ${founderBandwidth}h founder time`,
        confidence: "Medium",
        status: "Active"
      },
      {
        id: "H2",
        hypothesis: `Content about ${businessCategory} problems will attract inbound leads`,
        channel: "LinkedIn posts + Blog",
        message: "Educational content on problems, not product pitches",
        successSignal: "≥5 inbound inquiries from content in 30 days",
        timebox: "30 days",
        cost: "₹0 + 5h/week",
        confidence: "Low",
        status: "Queued"
      }
    ],
    decisions: {
      doubleDown: {
        what: hasRevenue && customerCount > 0 ? "Customer referral program" : "Direct founder outreach",
        evidence: hasRevenue ? "If ≥2 referrals convert in 14 days" : "If ≥10% response rate on first 30 outreach",
        impact: "Lowest CAC, highest conversion quality"
      },
      pause: {
        what: "Paid advertising and SEO",
        reason: `At ${gtmStage} with ${runwayMonths} months runway, need faster signal. Paid ads amplify what works, but you need to know what works first.`,
        reviewIn: "After 20+ paying customers"
      },
      kill: {
        what: "Generic content marketing without distribution strategy",
        reason: "Content without promotion is invisible. Kill unless you have distribution figured out.",
        reversibility: "High - can restart with proper distribution"
      }
    },
    vcSlides: {
      slide1: {
        title: "GTM Philosophy",
        points: [
          `Every GTM experiment must show signal in 14 days or gets killed`,
          `Cost per learning < ₹${Math.round(500000/runwayMonths).toLocaleString('en-IN')}/month`,
          `Run max 2 hypotheses at once - winners get doubled, losers get cut`
        ]
      },
      slide2: {
        title: "Current GTM Focus",
        points: [
          `Primary: ${hasRevenue ? 'Customer referrals' : 'Founder-led outreach'}`,
          `Traction: ${hasRevenue ? `₹${monthlyRevenue.toLocaleString('en-IN')}/mo, ${customerCount} customers` : 'Pre-revenue, validating'}`,
          `Learning: What messaging resonates with ${targetCustomer}`
        ]
      },
      slide3: {
        title: "GTM Roadmap",
        points: [
          `30 days: ${hasRevenue ? '2x customer count' : 'First 5 paying customers'}`,
          `60 days: Repeatable playbook documented`,
          `90 days: Ready for first GTM hire`
        ]
      }
    }
  };
}

// Get saved GTM strategy
app.get('/api/gtm/latest', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    if (!db) {
      return res.status(503).json({ error: 'Database not available' });
    }
    
    const collection = db.collection('gtm_strategies');
    const gtmData = await collection.findOne({ userId });
    
    if (!gtmData) {
      return res.status(404).json({ error: 'No GTM strategy found. Generate one first.' });
    }
    
    res.json({
      success: true,
      strategy: gtmData.strategy,
      metadata: {
        createdAt: gtmData.createdAt,
        updatedAt: gtmData.updatedAt
      }
    });
  } catch (error) {
    console.error('Error fetching GTM strategy:', error);
    res.status(500).json({ error: 'Failed to fetch GTM strategy' });
  }
});

// ============================================
// GTM TASK TRACKING SYSTEM - Your AI Co-founder
// ============================================

// Start tracking a GTM action (Accept an H1/H2 recommendation)
app.post('/api/gtm/tasks/start', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { 
      taskType, // 'H1', 'H2', 'H3', 'launch', 'partner', 'cac'
      category, // 'double-down', 'pause', 'kill', 'positioning', 'launch-plan', 'partners', 'cac'
      title,
      description,
      targetMetric,
      targetValue,
      deadline, // 30 days default
      isUserCreated, // true for H3
      originalRecommendation // AI's original recommendation
    } = req.body;
    
    const taskId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const startDate = new Date();
    const deadlineDate = deadline ? new Date(deadline) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    
    const task = {
      taskId,
      userId,
      taskType,
      category,
      title,
      description,
      targetMetric,
      targetValue,
      status: 'active', // active, completed, paused, abandoned
      progress: 0,
      startDate,
      deadline: deadlineDate,
      isUserCreated: isUserCreated || false,
      originalRecommendation,
      updates: [], // Track progress updates
      aiFollowups: [], // AI check-in messages
      nextFollowup: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
      completedDate: null,
      outcome: null,
      learnings: null,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    await gtmTasksCollection.insertOne(task);
    
    // Generate AI welcome message for this task
    const welcomePrompt = `You are an AI co-founder. The founder just started working on this task:

TASK: ${title}
DESCRIPTION: ${description}
TYPE: ${taskType} (${category})
TARGET: ${targetMetric ? `${targetMetric}: ${targetValue}` : 'Not specified'}
DEADLINE: ${deadlineDate.toLocaleDateString()}

Generate a short, encouraging message (2-3 sentences) that:
1. Acknowledges their commitment
2. Gives ONE specific tip for getting started TODAY
3. Sounds like a supportive co-founder, not a bot

Be casual, warm, and specific to their task.`;

    let welcomeMessage = "Great decision to start this! Focus on the first small win today - momentum matters more than perfection.";
    try {
      const aiResponse = await callGemini(welcomePrompt, "You are a supportive AI co-founder.");
      welcomeMessage = aiResponse.trim().replace(/"/g, '');
    } catch (e) {
      console.log('Using fallback welcome message');
    }
    
    res.json({
      success: true,
      task,
      welcomeMessage
    });
    
  } catch (error) {
    console.error('Error starting GTM task:', error);
    res.status(500).json({ error: 'Failed to start task' });
  }
});

// Get all active GTM tasks for user
app.get('/api/gtm/tasks', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { status } = req.query; // 'active', 'completed', 'all'
    
    let query = { userId };
    if (status && status !== 'all') {
      query.status = status;
    }
    
    const tasks = await gtmTasksCollection
      .find(query)
      .sort({ startDate: -1 })
      .toArray();
    
    res.json({ success: true, tasks });
    
  } catch (error) {
    console.error('Error fetching GTM tasks:', error);
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

// Update task progress
app.post('/api/gtm/tasks/:taskId/update', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { taskId } = req.params;
    const { progress, note, currentValue, blockers } = req.body;
    
    const update = {
      date: new Date(),
      progress,
      note,
      currentValue,
      blockers
    };
    
    // Get task to generate AI response
    const task = await gtmTasksCollection.findOne({ taskId, userId });
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    // Generate AI follow-up based on progress
    const progressPercent = progress || task.progress;
    const daysRemaining = Math.ceil((new Date(task.deadline) - new Date()) / (1000 * 60 * 60 * 24));
    
    const followupPrompt = `You are an AI co-founder checking in on progress. Here's the situation:

TASK: ${task.title}
DESCRIPTION: ${task.description}
STARTED: ${new Date(task.startDate).toLocaleDateString()}
DEADLINE: ${new Date(task.deadline).toLocaleDateString()} (${daysRemaining} days remaining)
PROGRESS: ${progressPercent}%
${note ? `FOUNDER'S UPDATE: "${note}"` : ''}
${blockers ? `BLOCKERS MENTIONED: ${blockers}` : ''}
${currentValue ? `CURRENT VALUE: ${currentValue}` : ''}
TARGET: ${task.targetMetric ? `${task.targetMetric}: ${task.targetValue}` : 'Not specified'}

Generate a brief, helpful response (2-4 sentences) that:
1. Acknowledges their progress (be specific)
2. If behind: Suggest ONE concrete next step to get back on track
3. If on track: Encourage and suggest how to accelerate
4. If blockers: Offer specific advice to overcome them

Sound like a supportive co-founder who's invested in their success. Be direct and actionable.`;

    let aiResponse = "Keep pushing! Every step counts. What's the ONE thing you can do today to move this forward?";
    try {
      aiResponse = await callGemini(followupPrompt, "You are a supportive, direct AI co-founder.");
      aiResponse = aiResponse.trim().replace(/^["']|["']$/g, '');
    } catch (e) {
      console.log('Using fallback follow-up message');
    }
    
    // Update the task
    await gtmTasksCollection.updateOne(
      { taskId, userId },
      {
        $set: {
          progress: progressPercent,
          nextFollowup: new Date(Date.now() + 24 * 60 * 60 * 1000), // Next day
          updatedAt: new Date()
        },
        $push: {
          updates: update,
          aiFollowups: {
            date: new Date(),
            message: aiResponse,
            progressAtTime: progressPercent
          }
        }
      }
    );
    
    res.json({
      success: true,
      aiResponse,
      daysRemaining,
      onTrack: progressPercent >= ((30 - daysRemaining) / 30) * 100
    });
    
  } catch (error) {
    console.error('Error updating GTM task:', error);
    res.status(500).json({ error: 'Failed to update task' });
  }
});

// Complete a task
app.post('/api/gtm/tasks/:taskId/complete', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { taskId } = req.params;
    const { outcome, learnings, finalValue, success } = req.body;
    
    const task = await gtmTasksCollection.findOne({ taskId, userId });
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    // Generate AI summary and next steps
    const summaryPrompt = `As an AI co-founder, summarize this completed task and suggest next steps:

TASK: ${task.title}
DESCRIPTION: ${task.description}
STARTED: ${new Date(task.startDate).toLocaleDateString()}
COMPLETED: ${new Date().toLocaleDateString()}
TARGET: ${task.targetMetric}: ${task.targetValue}
ACHIEVED: ${finalValue || 'Not specified'}
SUCCESS: ${success ? 'Yes' : 'Partially/No'}
OUTCOME: ${outcome || 'Not specified'}
LEARNINGS: ${learnings || 'Not specified'}

Generate a JSON response:
{
  "celebration": "One sentence celebrating their effort (be specific and warm)",
  "keyInsight": "One key learning or insight from this task",
  "nextAction": "One specific next action they should take based on this outcome",
  "recommendation": "Should they SCALE this (do more), ITERATE (adjust and retry), or PIVOT (try something different)?"
}`;

    let aiSummary = {
      celebration: "Great job completing this task! Your consistency is building momentum.",
      keyInsight: "Every completed task teaches you something about your market.",
      nextAction: "Review what worked and double down on it.",
      recommendation: "ITERATE"
    };
    
    try {
      const aiResponse = await callGemini(summaryPrompt, "You are a supportive AI co-founder.");
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        aiSummary = JSON.parse(jsonMatch[0]);
      }
    } catch (e) {
      console.log('Using fallback summary');
    }
    
    await gtmTasksCollection.updateOne(
      { taskId, userId },
      {
        $set: {
          status: 'completed',
          progress: 100,
          completedDate: new Date(),
          outcome,
          learnings,
          finalValue,
          success,
          aiSummary,
          updatedAt: new Date()
        }
      }
    );
    
    res.json({
      success: true,
      aiSummary
    });
    
  } catch (error) {
    console.error('Error completing GTM task:', error);
    res.status(500).json({ error: 'Failed to complete task' });
  }
});

// Get AI follow-up check-ins (called when user opens dashboard)
app.get('/api/gtm/tasks/followups', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    // Find tasks that need follow-up (nextFollowup <= now)
    const tasksNeedingFollowup = await gtmTasksCollection
      .find({
        userId,
        status: 'active',
        nextFollowup: { $lte: new Date() }
      })
      .toArray();
    
    if (tasksNeedingFollowup.length === 0) {
      return res.json({ success: true, followups: [] });
    }
    
    const followups = [];
    
    for (const task of tasksNeedingFollowup) {
      const daysActive = Math.ceil((new Date() - new Date(task.startDate)) / (1000 * 60 * 60 * 24));
      const daysRemaining = Math.ceil((new Date(task.deadline) - new Date()) / (1000 * 60 * 60 * 24));
      const lastUpdate = task.updates?.length > 0 ? task.updates[task.updates.length - 1] : null;
      
      const checkInPrompt = `You are an AI co-founder doing a daily check-in. Be brief and action-oriented.

TASK: ${task.title}
DAYS ACTIVE: ${daysActive}
DAYS REMAINING: ${daysRemaining}
CURRENT PROGRESS: ${task.progress}%
LAST UPDATE: ${lastUpdate ? `${lastUpdate.note || 'No note'} (${new Date(lastUpdate.date).toLocaleDateString()})` : 'No updates yet'}

Generate a short check-in message (1-2 sentences) that:
- If no updates: Gently ask how things are going
- If behind schedule: Offer quick help or suggest simplifying
- If on track: Encourage and ask about blockers
- If close to deadline: Create urgency but be supportive

Sound like a friend who's invested in their success, not a nagging reminder.`;

      let checkInMessage = `Hey, how's "${task.title}" going? Any blockers I can help think through?`;
      try {
        checkInMessage = await callGemini(checkInPrompt, "You are a friendly AI co-founder.");
        checkInMessage = checkInMessage.trim().replace(/^["']|["']$/g, '');
      } catch (e) {
        console.log('Using fallback check-in');
      }
      
      followups.push({
        taskId: task.taskId,
        taskTitle: task.title,
        category: task.category,
        progress: task.progress,
        daysRemaining,
        message: checkInMessage,
        isOverdue: daysRemaining < 0,
        isCritical: daysRemaining <= 3 && task.progress < 70
      });
      
      // Update nextFollowup to tomorrow
      await gtmTasksCollection.updateOne(
        { taskId: task.taskId },
        { $set: { nextFollowup: new Date(Date.now() + 24 * 60 * 60 * 1000) } }
      );
    }
    
    res.json({ success: true, followups });
    
  } catch (error) {
    console.error('Error getting followups:', error);
    res.status(500).json({ error: 'Failed to get followups' });
  }
});

// Add user-created H3 (Kill) task
app.post('/api/gtm/tasks/h3', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { title, description, reason, reversibility } = req.body;
    
    const taskId = `h3_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const task = {
      taskId,
      userId,
      taskType: 'H3',
      category: 'kill',
      title,
      description,
      reason,
      reversibility,
      status: 'active',
      isUserCreated: true,
      startDate: new Date(),
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    await gtmTasksCollection.insertOne(task);
    
    res.json({
      success: true,
      task,
      message: `Added "${title}" to your Kill list. Remember: Killing the right things is just as important as doing the right things.`
    });
    
  } catch (error) {
    console.error('Error adding H3 task:', error);
    res.status(500).json({ error: 'Failed to add task' });
  }
});

// Get partner suggestions based on location and business type
app.post('/api/gtm/partners/suggest', authenticateToken, async (req, res) => {
  try {
    const { location, businessType, targetPartnerCount, currentPartners } = req.body;
    
    const partnerPrompt = `You are a GTM strategist for Indian startups. Suggest specific partners for this business:

BUSINESS TYPE: ${businessType}
LOCATION: ${location}
TARGET: Sign up ${targetPartnerCount || 20} partners
CURRENT PARTNERS: ${currentPartners || 'None yet'}

For a ${businessType} business in ${location}, provide:

1. TOP 10 SPECIFIC PARTNER SUGGESTIONS:
   - For restaurants: Suggest actual restaurant types/cuisines popular in ${location}
   - For e-commerce: Suggest supplier/brand categories
   - For services: Suggest complementary service providers

2. WHERE TO FIND THEM:
   - Specific online platforms
   - Offline locations in ${location}
   - Community groups/associations

3. OUTREACH STRATEGY:
   - Best approach for first contact
   - Value proposition for partners
   - Common objections and how to handle

Return as JSON:
{
  "partnerSuggestions": [
    {"type": "Partner type", "examples": ["Example 1", "Example 2"], "why": "Why good fit", "whereToFind": "Where to find them"}
  ],
  "outreachPlatforms": [
    {"platform": "Platform name", "approach": "How to use it"}
  ],
  "outreachStrategy": {
    "firstContact": "How to approach",
    "valueProposition": "What you offer them",
    "objectionsHandling": [{"objection": "Common objection", "response": "How to handle"}]
  },
  "weeklyTargets": {
    "week1": "Target and focus",
    "week2": "Target and focus",
    "week3": "Target and focus",
    "week4": "Target and focus"
  }
}`;

    let suggestions = null;
    try {
      const aiResponse = await callGemini(partnerPrompt, "You are an expert in Indian B2B partnerships.");
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        suggestions = JSON.parse(jsonMatch[0]);
      }
    } catch (e) {
      console.log('Partner suggestion AI error:', e.message);
    }
    
    if (!suggestions) {
      suggestions = {
        partnerSuggestions: [
          { type: "Local popular restaurants", examples: ["Biryani places", "South Indian restaurants"], why: "High volume, regular customers", whereToFind: "Google Maps, Zomato" },
          { type: "Cloud kitchens", examples: ["Rebel Foods brands", "Local cloud kitchens"], why: "Delivery-focused, tech-savvy", whereToFind: "LinkedIn, direct outreach" }
        ],
        outreachPlatforms: [
          { platform: "LinkedIn", approach: "Connect with restaurant owners/managers" },
          { platform: "In-person visits", approach: "Visit during off-peak hours with a one-pager" }
        ],
        outreachStrategy: {
          firstContact: "Lead with how you'll bring them more orders, not your app features",
          valueProposition: "More orders with zero additional marketing cost",
          objectionsHandling: [
            { objection: "Already on Zomato/Swiggy", response: "We complement, not compete - different customer segment" }
          ]
        },
        weeklyTargets: {
          week1: "Identify 30 potential partners, contact 15",
          week2: "Follow up, aim for 5 signed",
          week3: "Onboard first 5, identify next 20",
          week4: "Scale to 15-20 total partners"
        }
      };
    }
    
    res.json({ success: true, suggestions });
    
  } catch (error) {
    console.error('Error getting partner suggestions:', error);
    res.status(500).json({ error: 'Failed to get suggestions' });
  }
});

// Get CAC (Customer Acquisition Cost) strategy
app.post('/api/gtm/cac/strategy', authenticateToken, async (req, res) => {
  try {
    const { businessType, location, budget, targetCustomers, currentChannels } = req.body;
    
    const cacPrompt = `You are a growth marketing expert for Indian startups. Create a detailed CAC strategy:

BUSINESS: ${businessType}
LOCATION: ${location}
MONTHLY BUDGET: ₹${budget || '50000'}
TARGET CUSTOMERS: ${targetCustomers || '100'} per month
CURRENT CHANNELS: ${currentChannels || 'None specified'}

Create a specific, actionable CAC strategy for the Indian market:

Return as JSON:
{
  "channelBreakdown": [
    {
      "channel": "Channel name",
      "budgetPercent": 30,
      "budgetAmount": "₹15,000",
      "expectedLeads": 50,
      "expectedCustomers": 15,
      "cac": "₹1,000",
      "tactics": ["Specific tactic 1", "Specific tactic 2"],
      "toolsNeeded": ["Tool 1", "Tool 2"],
      "weeklyActions": ["Action 1", "Action 2"]
    }
  ],
  "overallMetrics": {
    "blendedCAC": "₹X",
    "bestChannel": "Channel name",
    "worstChannel": "Channel name",
    "ltv_cac_ratio": "X:1"
  },
  "optimizationTips": [
    "Tip 1",
    "Tip 2"
  ],
  "weeklyCalendar": {
    "monday": "Focus area",
    "tuesday": "Focus area",
    "wednesday": "Focus area",
    "thursday": "Focus area",
    "friday": "Focus area"
  },
  "redFlags": [
    "Warning sign to watch for"
  ]
}`;

    let cacStrategy = null;
    try {
      const aiResponse = await callGemini(cacPrompt, "You are an expert in Indian digital marketing and growth.");
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        cacStrategy = JSON.parse(jsonMatch[0]);
      }
    } catch (e) {
      console.log('CAC strategy AI error:', e.message);
    }
    
    if (!cacStrategy) {
      cacStrategy = {
        channelBreakdown: [
          {
            channel: "Instagram/Facebook Ads",
            budgetPercent: 40,
            budgetAmount: "₹20,000",
            expectedLeads: 200,
            expectedCustomers: 40,
            cac: "₹500",
            tactics: ["Retargeting website visitors", "Lookalike audiences from best customers"],
            toolsNeeded: ["Meta Business Suite", "Pixel installed"],
            weeklyActions: ["Create 3 ad creatives", "Test 2 audiences", "Optimize daily"]
          },
          {
            channel: "WhatsApp Marketing",
            budgetPercent: 20,
            budgetAmount: "₹10,000",
            expectedLeads: 100,
            expectedCustomers: 25,
            cac: "₹400",
            tactics: ["Broadcast lists for offers", "Click-to-WhatsApp ads"],
            toolsNeeded: ["WhatsApp Business API", "Wati or similar"],
            weeklyActions: ["Send 2 broadcasts", "Respond within 5 mins"]
          }
        ],
        overallMetrics: {
          blendedCAC: "₹500",
          bestChannel: "WhatsApp Marketing",
          worstChannel: "Google Ads (initially)",
          ltv_cac_ratio: "3:1 target"
        },
        optimizationTips: [
          "Start with lowest CAC channel, scale what works",
          "Track every channel separately with UTM parameters"
        ],
        weeklyCalendar: {
          monday: "Review last week metrics, plan creatives",
          tuesday: "Launch new campaigns",
          wednesday: "Optimize bids and audiences",
          thursday: "Content creation for next week",
          friday: "Analysis and reporting"
        },
        redFlags: [
          "CAC > 50% of first order value",
          "Conversion rate dropping below 2%"
        ]
      };
    }
    
    res.json({ success: true, strategy: cacStrategy });
    
  } catch (error) {
    console.error('Error getting CAC strategy:', error);
    res.status(500).json({ error: 'Failed to get CAC strategy' });
  }
});

// ============================================
// FOUNDER SYNOPSIS ROUTE
// ============================================

// Generate Founder Synopsis
app.post('/api/founder/synopsis', authenticateToken, async (req, res) => {
  try {
    const { ddqResponses, companyData, recentActivity } = req.body;
    
    const synopsisPrompt = `As a strategic advisor, create a comprehensive founder synopsis based on this data:

COMPANY: ${companyData?.name || 'Startup'}
INDUSTRY: ${companyData?.industry || 'Technology'}
STAGE: ${companyData?.stage || 'Early-stage'}

FOUNDER DATA FROM DDQ:
${JSON.stringify(ddqResponses || {}, null, 2)}

RECENT ACTIVITY:
${JSON.stringify(recentActivity || {}, null, 2)}

Generate a founder synopsis with:
1. Current State Summary (2-3 sentences)
2. Key Strengths (3 points)
3. Growth Areas (3 points)
4. Immediate Focus (what to prioritize this week)
5. 30-Day Vision (what success looks like)

Format as JSON:
{
  "currentState": "Summary text",
  "strengths": ["strength1", "strength2", "strength3"],
  "growthAreas": ["area1", "area2", "area3"],
  "immediateFocus": "What to focus on",
  "thirtyDayVision": "Vision statement",
  "founderType": "Visionary/Executor/Builder/Strategist",
  "confidenceScore": 75
}`;

    const result = await geminiModel.generateContent(synopsisPrompt);
    const responseText = result.response.text();
    
    let synopsis;
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        synopsis = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found');
      }
    } catch (parseError) {
      synopsis = {
        currentState: "Building a promising venture with strong foundations.",
        strengths: ["Clear vision", "Domain expertise", "Adaptability"],
        growthAreas: ["Team building", "Market expansion", "Process optimization"],
        immediateFocus: "Focus on your most impactful metric this week.",
        thirtyDayVision: "Achieve meaningful progress on your core objectives.",
        founderType: "Builder",
        confidenceScore: 70
      };
    }
    
    res.json({
      success: true,
      synopsis,
      generatedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error generating synopsis:', error);
    res.status(500).json({ error: 'Failed to generate synopsis' });
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
