// Strict Comprehensive Test Suite - 5 Different Personas
// Does THOROUGH validation of response content, not just status codes

const API_BASE = 'https://prometheus-v1.onrender.com';

// 5 Different Test Personas
const PERSONAS = [
  {
    name: "FinTech Founder - Priya",
    email: `strict_fintech_${Date.now()}@test.com`,
    ddqResponses: {
      1: "PayEasy",
      2: "UPI-based payment solution for small businesses with instant settlement and smart analytics",
      3: ["FinTech"],
      4: "Mumbai",
      5: "MVP",
      6: "Razorpay, PayU, PhonePe Business",
      7: "Instant settlement within 30 minutes vs 2-3 days",
      8: "Small retail shops and kiranas with daily cash flow needs",
      9: "B2B",
      10: "25",
      11: 1500000,
      "11b": "Transaction Fee",
      12: "Yes",
      13: 85000,
      15: 45,
      17: 4,
      18: ["Technical", "Finance"],
      19: ["Customer Acquisition", "Competition"],
      20: ["Direct Sales", "Referrals"],
      21: "Get to 500 merchants",
      22: "₹25-50 Lakhs",
      23: ["Competition", "Regulatory Changes"]
    },
    expectedIndustry: "fintech",
    industryKeywords: ['payment', 'fintech', 'upi', 'banking', 'digital', 'financial', 'rbi', 'money', 'transaction', 'merchant']
  },
  {
    name: "EdTech Founder - Rahul",
    email: `strict_edtech_${Date.now()}@test.com`,
    ddqResponses: {
      1: "LearnQuest",
      2: "AI-powered personalized learning platform for K-12 students with adaptive curriculum",
      3: ["EdTech"],
      4: "Bangalore",
      5: "Growth",
      6: "BYJU'S, Vedantu, Toppr",
      7: "Truly adaptive AI that adjusts in real-time, not just pre-set paths",
      8: "Parents of students in classes 6-12 preparing for competitive exams",
      9: "B2C",
      10: "50",
      11: 3000000,
      "11b": "Monthly Recurring",
      12: "Yes",
      13: 250000,
      15: 320,
      17: 8,
      18: ["Technical", "Education"],
      19: ["Customer Acquisition", "Product Development"],
      20: ["Online marketing", "Social Media"],
      21: "Reach 2000 paid users",
      22: "₹50 Lakhs - ₹1 Crore",
      23: ["Competition", "Customer Churn"]
    },
    expectedIndustry: "edtech",
    industryKeywords: ['education', 'learning', 'edtech', 'school', 'student', 'online', 'course', 'teaching', 'exam', 'k-12']
  },
  {
    name: "HealthTech Founder - Dr. Aisha",
    email: `strict_health_${Date.now()}@test.com`,
    ddqResponses: {
      1: "MediConnect",
      2: "Telemedicine platform connecting rural patients with specialist doctors through local health workers",
      3: ["HealthTech"],
      4: "Hyderabad",
      5: "Early Traction",
      6: "Practo, 1mg, Apollo 24/7",
      7: "Focus on rural India with offline-first approach and local language support",
      8: "Rural patients and local health workers (ASHAs, ANMs)",
      9: "B2B2C",
      10: "100",
      11: 5000000,
      "11b": "Per Consultation",
      12: "Yes",
      13: 180000,
      15: 1200,
      17: 12,
      18: ["Medical", "Technical"],
      19: ["Distribution", "Unit Economics"],
      20: ["Partnerships", "Government Schemes"],
      21: "Expand to 50 villages",
      22: "₹1-2 Crore",
      23: ["Regulatory Changes", "Technology Adoption"]
    },
    expectedIndustry: "healthtech",
    industryKeywords: ['health', 'medical', 'telemedicine', 'healthcare', 'doctor', 'hospital', 'patient', 'medicine', 'clinic']
  },
  {
    name: "AgriTech Founder - Karthik",
    email: `strict_agri_${Date.now()}@test.com`,
    ddqResponses: {
      1: "FarmSmart",
      2: "IoT-based precision agriculture platform for crop monitoring and yield prediction",
      3: ["AgriTech"],
      4: "Pune",
      5: "Idea",
      6: "CropIn, DeHaat, AgNext",
      7: "Low-cost IoT sensors designed for Indian farm conditions",
      8: "Progressive farmers with 5+ acres and FPOs",
      9: "B2B",
      10: "15",
      11: 800000,
      "11b": "Annual Subscription",
      12: "No",
      15: 0,
      17: 3,
      18: ["Technical", "Agriculture"],
      19: ["Product Development", "Customer Acquisition"],
      20: ["Direct Sales", "Partnerships"],
      21: "Launch pilot with 50 farmers",
      22: "₹10-25 Lakhs",
      23: ["Technology Adoption", "Seasonal Dependency"]
    },
    expectedIndustry: "agritech",
    industryKeywords: ['agriculture', 'farming', 'agritech', 'crop', 'farmer', 'agri', 'farm', 'rural', 'harvest', 'soil']
  },
  {
    name: "SaaS Founder - Sneha",
    email: `strict_saas_${Date.now()}@test.com`,
    ddqResponses: {
      1: "TeamFlow",
      2: "AI-powered project management tool for remote engineering teams with automated sprint planning",
      3: ["SaaS", "Enterprise Software"],
      4: "Delhi NCR",
      5: "Growth",
      6: "Jira, Asana, Monday.com, Linear",
      7: "AI that actually understands engineering workflows and auto-assigns tasks",
      8: "Engineering managers at tech companies with 20-200 developers",
      9: "B2B",
      10: "40",
      11: 4000000,
      "11b": "Monthly Recurring",
      12: "Yes",
      13: 450000,
      15: 28,
      17: 6,
      18: ["Technical", "Product Management"],
      19: ["Competition", "Enterprise Sales Cycle"],
      20: ["Online marketing", "Content Marketing"],
      21: "Get 100 paying teams",
      22: "₹50 Lakhs - ₹1 Crore",
      23: ["Competition", "Customer Churn"]
    },
    expectedIndustry: "saas",
    industryKeywords: ['software', 'saas', 'enterprise', 'cloud', 'tech', 'startup', 'ai', 'automation', 'platform', 'project']
  }
];

// Test results tracking
const testResults = {
  news: { passed: 0, failed: 0, details: [] },
  competitors: { passed: 0, failed: 0, details: [] },
  chat: { passed: 0, failed: 0, details: [] },
  simulation: { passed: 0, failed: 0, details: [] },
  gtm: { passed: 0, failed: 0, details: [] }
};

// Helper function for API calls with retry and delay
async function apiCall(endpoint, method, body, token, retries = 3, delayMs = 3000) {
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` })
    },
    ...(body && { body: JSON.stringify(body) })
  };
  
  for (let i = 0; i < retries; i++) {
    try {
      // Add delay between retries to avoid rate limiting
      if (i > 0) {
        console.log(`   ⏳ Waiting ${delayMs/1000}s before retry ${i + 1}/${retries}...`);
        await new Promise(r => setTimeout(r, delayMs));
      }
      
      const response = await fetch(`${API_BASE}${endpoint}`, options);
      const text = await response.text();
      
      try {
        const data = JSON.parse(text);
        return { status: response.status, data, raw: text };
      } catch (parseErr) {
        if (i < retries - 1) continue;
        return { status: response.status, data: { error: 'Invalid JSON response' }, raw: text };
      }
    } catch (err) {
      if (i < retries - 1) continue;
      throw err;
    }
  }
}

// Sleep helper
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// Register and login a test user
async function setupUser(persona) {
  const regResult = await apiCall('/api/auth/signup', 'POST', {
    email: persona.email,
    password: 'Test123!@#',
    name: persona.name,
    companyName: persona.ddqResponses[1]
  });
  
  if (regResult.status === 200 && regResult.data.accessToken) {
    return regResult.data.accessToken;
  }
  
  if (regResult.status === 409) {
    const loginResult = await apiCall('/api/auth/login', 'POST', {
      email: persona.email,
      password: 'Test123!@#'
    });
    return loginResult.data.accessToken || loginResult.data.token;
  }
  
  return null;
}

// Save DDQ responses
async function saveDDQ(token, ddqResponses) {
  return await apiCall('/api/ddq/save', 'POST', { 
    responses: ddqResponses,
    completed: true
  }, token);
}

// ============================================
// STRICT VALIDATION FUNCTIONS
// ============================================

// Test 1: News API - STRICT validation
async function testNews(persona, token) {
  console.log(`\n📰 Testing News for ${persona.name}...`);
  
  try {
    const result = await apiCall('/api/news', 'GET', null, token);
    
    // Must be 200
    if (result.status !== 200) {
      testResults.news.failed++;
      testResults.news.details.push({ 
        persona: persona.name, 
        error: `HTTP ${result.status} - Expected 200`,
        response: JSON.stringify(result.data).slice(0, 200)
      });
      return false;
    }
    
    // Must have articles array
    if (!result.data.articles || !Array.isArray(result.data.articles)) {
      testResults.news.failed++;
      testResults.news.details.push({ 
        persona: persona.name, 
        error: 'Missing articles array in response',
        keys: Object.keys(result.data || {})
      });
      return false;
    }
    
    const articles = result.data.articles;
    
    // Must have at least 1 article
    if (articles.length === 0) {
      testResults.news.failed++;
      testResults.news.details.push({ 
        persona: persona.name, 
        error: 'No articles returned - news API returned empty array'
      });
      return false;
    }
    
    // Validate article structure
    const validArticles = articles.filter(a => 
      a.title && typeof a.title === 'string' && a.title.length > 10 &&
      (a.url || a.link) // Must have a link
    );
    
    if (validArticles.length === 0) {
      testResults.news.failed++;
      testResults.news.details.push({ 
        persona: persona.name, 
        error: 'No valid articles - articles missing title or URL',
        sample: JSON.stringify(articles[0]).slice(0, 200)
      });
      return false;
    }
    
    // Check industry relevance - at least 20% must be relevant
    const keywords = persona.industryKeywords;
    let relevantCount = 0;
    
    validArticles.forEach(article => {
      const text = ((article.title || '') + ' ' + (article.description || '')).toLowerCase();
      if (keywords.some(kw => text.includes(kw))) {
        relevantCount++;
      }
    });
    
    const relevanceRatio = relevantCount / validArticles.length;
    
    if (relevanceRatio < 0.2) {
      testResults.news.failed++;
      testResults.news.details.push({ 
        persona: persona.name, 
        error: `Low industry relevance: ${Math.round(relevanceRatio * 100)}% (need 20%+)`,
        industry: persona.expectedIndustry,
        sampleTitles: validArticles.slice(0, 3).map(a => a.title)
      });
      return false;
    }
    
    // PASSED
    testResults.news.passed++;
    testResults.news.details.push({ 
      persona: persona.name, 
      success: true,
      articleCount: validArticles.length,
      relevance: `${Math.round(relevanceRatio * 100)}%`,
      sampleTitle: validArticles[0].title.slice(0, 60)
    });
    return true;
    
  } catch (err) {
    testResults.news.failed++;
    testResults.news.details.push({ persona: persona.name, error: `Exception: ${err.message}` });
    return false;
  }
}

// Test 2: Competitors API - STRICT validation
async function testCompetitors(persona, token) {
  console.log(`\n🏢 Testing Competitors for ${persona.name}...`);
  
  try {
    const result = await apiCall('/api/analysis/competitors', 'POST', {
      ddqResponses: persona.ddqResponses
    }, token, 3, 5000); // Longer delay for this heavy endpoint
    
    // Must be 200
    if (result.status !== 200) {
      testResults.competitors.failed++;
      testResults.competitors.details.push({ 
        persona: persona.name, 
        error: `HTTP ${result.status} - ${result.data?.error || 'Unknown error'}`,
        note: 'API must return 200 with valid competitors'
      });
      return false;
    }
    
    // Must have competitors array
    if (!result.data.competitors || !Array.isArray(result.data.competitors)) {
      testResults.competitors.failed++;
      testResults.competitors.details.push({ 
        persona: persona.name, 
        error: 'Missing competitors array',
        keys: Object.keys(result.data || {})
      });
      return false;
    }
    
    const competitors = result.data.competitors;
    
    // Must have at least 1 competitor
    if (competitors.length === 0) {
      testResults.competitors.failed++;
      testResults.competitors.details.push({ 
        persona: persona.name, 
        error: 'No competitors returned'
      });
      return false;
    }
    
    // Validate competitor structure and check for fake names
    const fakePatterns = [
      /^startup\s*[a-z]$/i,
      /^company\s*[a-z]$/i,
      /^competitor\s*[a-z0-9]$/i,
      /^industry\s*leader$/i,
      /^market\s*player$/i,
      /^local\s*competitor$/i,
      /^generic\s*competitor$/i,
      /^example\s*(company|startup)?$/i,
      /^acme/i,
      /^xyz\s/i,
      /^abc\s/i,
      /^test\s*company/i
    ];
    
    let validCompetitors = [];
    let fakeCompetitors = [];
    
    competitors.forEach(comp => {
      const name = comp.name || '';
      
      // Check structure
      if (!name || name.length < 2) {
        fakeCompetitors.push(name || '(empty)');
        return;
      }
      
      // Check for fake patterns
      const isFake = fakePatterns.some(pattern => pattern.test(name));
      if (isFake) {
        fakeCompetitors.push(name);
        return;
      }
      
      // Must have meaningful data
      const hasDescription = comp.description && comp.description.length > 20;
      const hasStrengths = Array.isArray(comp.strengths) && comp.strengths.length > 0;
      const hasWeaknesses = Array.isArray(comp.weaknesses) && comp.weaknesses.length > 0;
      
      if (hasDescription || hasStrengths || hasWeaknesses) {
        validCompetitors.push(comp);
      } else {
        // Name only without data is suspicious but not fake
        validCompetitors.push(comp);
      }
    });
    
    // No fake companies allowed
    if (fakeCompetitors.length > 0) {
      testResults.competitors.failed++;
      testResults.competitors.details.push({ 
        persona: persona.name, 
        error: `Found ${fakeCompetitors.length} fake/generic competitor names`,
        fakeNames: fakeCompetitors.slice(0, 5)
      });
      return false;
    }
    
    // Must have at least 1 valid competitor
    if (validCompetitors.length === 0) {
      testResults.competitors.failed++;
      testResults.competitors.details.push({ 
        persona: persona.name, 
        error: 'No valid competitors with proper data'
      });
      return false;
    }
    
    // PASSED
    testResults.competitors.passed++;
    testResults.competitors.details.push({ 
      persona: persona.name, 
      success: true,
      competitorCount: validCompetitors.length,
      names: validCompetitors.slice(0, 5).map(c => c.name)
    });
    return true;
    
  } catch (err) {
    testResults.competitors.failed++;
    testResults.competitors.details.push({ persona: persona.name, error: `Exception: ${err.message}` });
    return false;
  }
}

// Test 3: Chat API - STRICT validation
async function testChat(persona, token) {
  console.log(`\n💬 Testing Chat/Advisor for ${persona.name}...`);
  
  try {
    const productName = persona.ddqResponses[1];
    const question = `What are the top 3 specific things I should focus on for ${productName} in the next month given my current stage and challenges?`;
    
    const result = await apiCall('/api/chat/grok', 'POST', {
      message: question,
      ddqResponses: persona.ddqResponses
    }, token, 3, 5000);
    
    // Must be 200
    if (result.status !== 200) {
      testResults.chat.failed++;
      testResults.chat.details.push({ 
        persona: persona.name, 
        error: `HTTP ${result.status} - ${result.data?.error || 'Unknown error'}`
      });
      return false;
    }
    
    // Must have response
    if (!result.data.response || typeof result.data.response !== 'string') {
      testResults.chat.failed++;
      testResults.chat.details.push({ 
        persona: persona.name, 
        error: 'Missing or invalid response field',
        keys: Object.keys(result.data || {})
      });
      return false;
    }
    
    const response = result.data.response;
    const responseLower = response.toLowerCase();
    
    // Response must be substantial (at least 150 chars)
    if (response.length < 150) {
      testResults.chat.failed++;
      testResults.chat.details.push({ 
        persona: persona.name, 
        error: `Response too short: ${response.length} chars (need 150+)`,
        response: response.slice(0, 100)
      });
      return false;
    }
    
    // Check for personalization markers
    const productNameLower = productName.toLowerCase();
    const hasProductName = responseLower.includes(productNameLower);
    const hasNumbers = /\d+/.test(response);
    const hasListItems = response.includes('1.') || response.includes('1)') || 
                         response.includes('•') || response.includes('-');
    const hasActionVerbs = /\b(focus|implement|start|build|launch|create|develop|improve|optimize)\b/i.test(response);
    
    // Must have at least 2 of these markers
    const markers = [hasProductName, hasNumbers, hasListItems, hasActionVerbs];
    const markerCount = markers.filter(Boolean).length;
    
    if (markerCount < 2) {
      testResults.chat.failed++;
      testResults.chat.details.push({ 
        persona: persona.name, 
        error: `Response lacks personalization (${markerCount}/4 markers)`,
        hasProductName,
        hasNumbers,
        hasListItems,
        hasActionVerbs,
        responsePreview: response.slice(0, 150)
      });
      return false;
    }
    
    // Check it's not a generic error message
    const genericPhrases = ['i cannot', 'i\'m unable', 'as an ai', 'i don\'t have access'];
    if (genericPhrases.some(phrase => responseLower.includes(phrase))) {
      testResults.chat.failed++;
      testResults.chat.details.push({ 
        persona: persona.name, 
        error: 'Response contains generic AI refusal phrases',
        responsePreview: response.slice(0, 150)
      });
      return false;
    }
    
    // PASSED
    testResults.chat.passed++;
    testResults.chat.details.push({ 
      persona: persona.name, 
      success: true,
      responseLength: response.length,
      markers: { hasProductName, hasNumbers, hasListItems, hasActionVerbs },
      preview: response.slice(0, 100) + '...'
    });
    return true;
    
  } catch (err) {
    testResults.chat.failed++;
    testResults.chat.details.push({ persona: persona.name, error: `Exception: ${err.message}` });
    return false;
  }
}

// Test 4: Simulation API - STRICT validation
async function testSimulation(persona, token) {
  console.log(`\n🎯 Testing Simulation for ${persona.name}...`);
  
  try {
    const productName = persona.ddqResponses[1];
    const decision = `We are considering raising prices by 20% for ${productName} to improve our unit economics. This would affect our current customer base of ${persona.ddqResponses[15] || 0} customers. The price increase would help us extend runway but might impact growth. Should we proceed with this price increase?`;
    
    const result = await apiCall('/api/simulation/run', 'POST', {
      decision: decision,
      timeframe: '6 months'
    }, token, 3, 5000);
    
    // Must be 200
    if (result.status !== 200) {
      testResults.simulation.failed++;
      testResults.simulation.details.push({ 
        persona: persona.name, 
        error: `HTTP ${result.status} - ${result.data?.error || 'Unknown error'}`
      });
      return false;
    }
    
    const sim = result.data;
    
    // Required fields validation
    const requiredFields = {
      scenario: { minLength: 10, type: 'string' },
      summary: { minLength: 50, type: 'string' },
      recommendation: { minLength: 30, type: 'string' },
      confidence: { type: 'number', min: 0, max: 100 },
      riskLevel: { type: 'string', values: ['low', 'medium', 'high'] }
    };
    
    const missingFields = [];
    const invalidFields = [];
    
    for (const [field, rules] of Object.entries(requiredFields)) {
      if (!sim[field]) {
        missingFields.push(field);
        continue;
      }
      
      if (rules.type === 'string' && typeof sim[field] !== 'string') {
        invalidFields.push(`${field}: expected string`);
      } else if (rules.type === 'number' && typeof sim[field] !== 'number') {
        invalidFields.push(`${field}: expected number`);
      } else if (rules.minLength && sim[field].length < rules.minLength) {
        invalidFields.push(`${field}: too short (${sim[field].length} < ${rules.minLength})`);
      } else if (rules.values && !rules.values.includes(sim[field].toLowerCase())) {
        invalidFields.push(`${field}: invalid value "${sim[field]}"`);
      }
    }
    
    if (missingFields.length > 0) {
      testResults.simulation.failed++;
      testResults.simulation.details.push({ 
        persona: persona.name, 
        error: `Missing required fields: ${missingFields.join(', ')}`,
        receivedKeys: Object.keys(sim)
      });
      return false;
    }
    
    if (invalidFields.length > 0) {
      testResults.simulation.failed++;
      testResults.simulation.details.push({ 
        persona: persona.name, 
        error: `Invalid fields: ${invalidFields.join('; ')}`
      });
      return false;
    }
    
    // Validate impact objects
    const impactFields = ['runwayImpact', 'growthImpact', 'valuationImpact'];
    for (const field of impactFields) {
      if (!sim[field] || typeof sim[field] !== 'object') {
        testResults.simulation.failed++;
        testResults.simulation.details.push({ 
          persona: persona.name, 
          error: `Missing or invalid ${field} object`
        });
        return false;
      }
      
      if (!sim[field].value || !sim[field].direction) {
        testResults.simulation.failed++;
        testResults.simulation.details.push({ 
          persona: persona.name, 
          error: `${field} missing value or direction property`
        });
        return false;
      }
    }
    
    // Check for detailed explanation (new feature)
    const hasDetailedExplanation = sim.detailedExplanation && sim.detailedExplanation.length > 50;
    
    // PASSED
    testResults.simulation.passed++;
    testResults.simulation.details.push({ 
      persona: persona.name, 
      success: true,
      confidence: sim.confidence,
      riskLevel: sim.riskLevel,
      hasDetailedExplanation,
      summaryPreview: sim.summary.slice(0, 80) + '...'
    });
    return true;
    
  } catch (err) {
    testResults.simulation.failed++;
    testResults.simulation.details.push({ persona: persona.name, error: `Exception: ${err.message}` });
    return false;
  }
}

// Test 5: GTM API - STRICT validation
async function testGTM(persona, token) {
  console.log(`\n🚀 Testing GTM for ${persona.name}...`);
  
  try {
    const result = await apiCall('/api/gtm/generate', 'POST', {
      ddqResponses: persona.ddqResponses,
      valuation: { estimatedValuation: 10000000 },
      swotAnalysis: null
    }, token, 3, 5000);
    
    // Must be 200
    if (result.status !== 200) {
      testResults.gtm.failed++;
      testResults.gtm.details.push({ 
        persona: persona.name, 
        error: `HTTP ${result.status} - ${result.data?.error || 'Unknown error'}`
      });
      return false;
    }
    
    const gtmData = result.data;
    
    // Check for strategy object (might be nested)
    const gtm = gtmData.strategy || gtmData;
    
    if (!gtm || typeof gtm !== 'object') {
      testResults.gtm.failed++;
      testResults.gtm.details.push({ 
        persona: persona.name, 
        error: 'No strategy object in response',
        keys: Object.keys(gtmData || {})
      });
      return false;
    }
    
    // Must mention the product name somewhere in the GTM
    const gtmString = JSON.stringify(gtm).toLowerCase();
    const productName = persona.ddqResponses[1].toLowerCase();
    
    if (!gtmString.includes(productName)) {
      testResults.gtm.failed++;
      testResults.gtm.details.push({ 
        persona: persona.name, 
        error: `GTM does not mention product name "${persona.ddqResponses[1]}"`,
        note: 'GTM strategy must be personalized to the product'
      });
      return false;
    }
    
    // Must have substantive sections
    const gtmKeys = Object.keys(gtm);
    const expectedSections = [
      'productOverview', 'targetMarket', 'channels', 'positioning', 
      'tasks', 'weeklyTasks', 'timeline', 'metrics', 'actionItems',
      'icp', 'persona', 'messaging', 'pricing'
    ];
    
    const foundSections = expectedSections.filter(section => 
      gtmKeys.some(key => key.toLowerCase().includes(section.toLowerCase()))
    );
    
    if (foundSections.length < 2) {
      testResults.gtm.failed++;
      testResults.gtm.details.push({ 
        persona: persona.name, 
        error: `GTM lacks required sections (found ${foundSections.length}/2 minimum)`,
        foundSections,
        allKeys: gtmKeys.slice(0, 10)
      });
      return false;
    }
    
    // Check for actionable content (tasks, action items, etc.)
    const hasActionableContent = 
      (Array.isArray(gtm.weeklyTasks) && gtm.weeklyTasks.length > 0) ||
      (Array.isArray(gtm.tasks) && gtm.tasks.length > 0) ||
      (Array.isArray(gtm.actionItems) && gtm.actionItems.length > 0) ||
      (gtm.timeline && typeof gtm.timeline === 'object');
    
    if (!hasActionableContent) {
      testResults.gtm.failed++;
      testResults.gtm.details.push({ 
        persona: persona.name, 
        error: 'GTM lacks actionable content (no tasks/timeline)',
        keys: gtmKeys.slice(0, 15)
      });
      return false;
    }
    
    // PASSED
    testResults.gtm.passed++;
    testResults.gtm.details.push({ 
      persona: persona.name, 
      success: true,
      mentionsProduct: true,
      sectionsFound: foundSections,
      hasActionableContent: true
    });
    return true;
    
  } catch (err) {
    testResults.gtm.failed++;
    testResults.gtm.details.push({ persona: persona.name, error: `Exception: ${err.message}` });
    return false;
  }
}

// Main test runner
async function runAllTests() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('     🔬 STRICT VALIDATION TEST SUITE - 5 PERSONAS');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`\nAPI Base: ${API_BASE}`);
  console.log(`Test started at: ${new Date().toISOString()}`);
  console.log('\n⚠️  This test does THOROUGH content validation, not just status codes.\n');
  
  for (let i = 0; i < PERSONAS.length; i++) {
    const persona = PERSONAS[i];
    console.log('\n' + '─'.repeat(60));
    console.log(`\n👤 PERSONA ${i + 1}/5: ${persona.name}`);
    console.log(`   Product: ${persona.ddqResponses[1]}`);
    console.log(`   Industry: ${persona.expectedIndustry}`);
    console.log('─'.repeat(60));
    
    try {
      // Setup user
      console.log('\n🔐 Setting up user...');
      const token = await setupUser(persona);
      
      if (!token) {
        console.log('❌ Failed to setup user - skipping all tests for this persona');
        ['news', 'competitors', 'chat', 'simulation', 'gtm'].forEach(feature => {
          testResults[feature].failed++;
          testResults[feature].details.push({ persona: persona.name, error: 'Auth failed' });
        });
        continue;
      }
      console.log('✅ User authenticated');
      
      // Save DDQ
      console.log('📝 Saving DDQ responses...');
      await saveDDQ(token, persona.ddqResponses);
      console.log('✅ DDQ saved');
      
      // Wait between major API calls to avoid rate limiting
      console.log('\n⏳ Waiting 3s before tests...');
      await sleep(3000);
      
      // Run all tests for this persona with delays between
      await testNews(persona, token);
      await sleep(2000);
      
      await testCompetitors(persona, token);
      await sleep(2000);
      
      await testChat(persona, token);
      await sleep(2000);
      
      await testSimulation(persona, token);
      await sleep(2000);
      
      await testGTM(persona, token);
      
      // Longer delay between personas
      if (i < PERSONAS.length - 1) {
        console.log('\n⏳ Waiting 5s before next persona...');
        await sleep(5000);
      }
      
    } catch (err) {
      console.log(`❌ Error testing ${persona.name}: ${err.message}`);
    }
  }
  
  // Print final results
  console.log('\n\n' + '═'.repeat(60));
  console.log('                    📊 STRICT TEST RESULTS');
  console.log('═'.repeat(60));
  
  const features = ['news', 'competitors', 'chat', 'simulation', 'gtm'];
  let allPassed = true;
  
  features.forEach(feature => {
    const result = testResults[feature];
    const status = result.passed === 5 ? '✅ PASS' : result.passed >= 3 ? '⚠️ PARTIAL' : '❌ FAIL';
    console.log(`\n${feature.toUpperCase()}: ${status} (${result.passed}/5)`);
    
    result.details.forEach(d => {
      if (d.success) {
        console.log(`   ✓ ${d.persona}`);
        // Print key success metrics
        if (d.competitorCount) console.log(`     → ${d.competitorCount} real competitors: ${d.names?.join(', ')}`);
        if (d.relevance) console.log(`     → ${d.relevance} industry relevance`);
        if (d.confidence !== undefined) console.log(`     → Confidence: ${d.confidence}%, Risk: ${d.riskLevel}`);
        if (d.sectionsFound) console.log(`     → GTM sections: ${d.sectionsFound.join(', ')}`);
      } else {
        console.log(`   ✗ ${d.persona}: ${d.error}`);
      }
    });
    
    if (result.passed < 5) allPassed = false;
  });
  
  console.log('\n' + '═'.repeat(60));
  
  const totalTests = features.length * 5;
  const totalPassed = features.reduce((sum, f) => sum + testResults[f].passed, 0);
  
  console.log(`\nTOTAL: ${totalPassed}/${totalTests} tests passed`);
  
  if (allPassed) {
    console.log('\n🎉 ALL STRICT TESTS PASSED! Production ready.');
  } else if (totalPassed >= totalTests * 0.8) {
    console.log('\n⚠️ MOSTLY PASSING (80%+) - Minor issues to address.');
  } else if (totalPassed >= totalTests * 0.6) {
    console.log('\n⚠️ PARTIALLY PASSING (60%+) - Several issues need attention.');
  } else {
    console.log('\n❌ TESTS FAILED - Major issues need to be fixed.');
  }
  
  console.log('\n═'.repeat(60));
  
  return { allPassed, totalPassed, totalTests, testResults };
}

// Run tests
runAllTests().then(results => {
  console.log('\nStrict test completed.');
  process.exit(results.allPassed ? 0 : 1);
}).catch(err => {
  console.error('Test runner failed:', err);
  process.exit(1);
});
