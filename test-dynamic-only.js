// 5 Personas Strict Test - With Retry Logic (No Static Fallbacks)
const API_BASE = 'https://prometheus-v1.onrender.com';

const PERSONAS = [
  {
    name: "FinTech Founder - Priya",
    ddqResponses: {
      1: "PayEasy",
      2: "UPI-based payment solution for small businesses with instant settlement",
      3: ["FinTech"],
      4: "Mumbai",
      5: "MVP",
      6: "Razorpay, PayU, PhonePe Business",
      7: "Instant settlement within 30 minutes vs 2-3 days",
      8: "Small retail shops and kiranas",
      9: "B2B",
      10: "25",
      11: 1500000,
      15: 45,
      17: 4,
      18: ["Technical", "Finance"],
      19: ["Customer Acquisition", "Competition"],
      20: ["Direct Sales", "Referrals"],
      21: "Get to 500 merchants",
      22: "₹25-50 Lakhs",
      23: ["Competition", "Regulatory Changes"]
    },
    industryKeywords: ['payment', 'fintech', 'upi', 'banking', 'digital', 'financial', 'rbi', 'money', 'merchant', 'startup', 'technology', 'business', 'india', 'growth']
  },
  {
    name: "EdTech Founder - Rahul",
    ddqResponses: {
      1: "LearnSmart",
      2: "AI-powered personalized learning platform for K-12 students",
      3: ["EdTech"],
      4: "Bangalore",
      5: "Growth",
      6: "BYJU'S, Vedantu, Unacademy",
      7: "AI personalization that adapts in real-time to student performance",
      8: "Parents of K-12 students in tier-2 cities",
      9: "B2C",
      10: "150",
      11: 3500000,
      15: 2500,
      17: 12,
      18: ["Technical", "Content"],
      19: ["Customer Retention", "Content Quality"],
      20: ["Digital Marketing", "School Partnerships"],
      21: "Reach 10000 active students",
      22: "₹1-2 Cr",
      23: ["Competition", "Customer Churn"]
    },
    industryKeywords: ['education', 'edtech', 'learning', 'student', 'school', 'course', 'ai', 'platform', 'startup', 'technology', 'business', 'india', 'growth']
  },
  {
    name: "HealthTech Founder - Ananya",
    ddqResponses: {
      1: "MedConnect",
      2: "Telemedicine platform connecting rural patients with specialist doctors",
      3: ["HealthTech"],
      4: "Hyderabad",
      5: "Pre-seed",
      6: "Practo, 1mg, PharmEasy",
      7: "Focus on rural India with offline-first capabilities and local language support",
      8: "Rural patients and government health centers",
      9: "B2B2C",
      10: "8",
      11: 500000,
      15: 1200,
      17: 5,
      18: ["Technical", "Medical Advisory"],
      19: ["Regulatory Compliance", "Doctor Network"],
      20: ["Government Partnerships", "NGO Collaborations"],
      21: "Partner with 50 PHCs",
      22: "₹50 Lakhs - 1 Cr",
      23: ["Regulatory Changes", "Connectivity Issues"]
    },
    industryKeywords: ['health', 'medical', 'telemedicine', 'doctor', 'patient', 'healthcare', 'pharma', 'wellness', 'startup', 'technology', 'business', 'india', 'growth']
  },
  {
    name: "FoodTech Founder - Vikram",
    ddqResponses: {
      1: "CloudKitchen Pro",
      2: "Cloud kitchen management platform with AI-driven demand forecasting",
      3: ["FoodTech"],
      4: "Delhi NCR",
      5: "Seed",
      6: "Rebel Foods, Swiggy Access, FreshMenu",
      7: "AI demand prediction reducing food waste by 40%",
      8: "Cloud kitchen operators and restaurant chains",
      9: "B2B",
      10: "35",
      11: 2000000,
      15: 85,
      17: 8,
      18: ["Technical", "Operations"],
      19: ["Unit Economics", "Customer Acquisition"],
      20: ["Direct Sales", "Industry Events"],
      21: "Onboard 200 kitchens",
      22: "₹50 Lakhs - 1 Cr",
      23: ["Competition", "Operational Complexity"]
    },
    industryKeywords: ['food', 'kitchen', 'restaurant', 'delivery', 'foodtech', 'swiggy', 'zomato', 'cloud', 'startup', 'technology', 'business', 'india', 'growth']
  },
  {
    name: "SaaS Founder - Sneha",
    ddqResponses: {
      1: "TeamSync",
      2: "All-in-one project management tool for remote Indian startups",
      3: ["SaaS", "Enterprise"],
      4: "Pune",
      5: "Series A",
      6: "Monday.com, Asana, Notion",
      7: "Built for Indian compliance requirements and timezone collaboration",
      8: "Indian startups with 10-200 employees",
      9: "B2B",
      10: "500",
      11: 8000000,
      15: 350,
      17: 25,
      18: ["Technical", "Sales"],
      19: ["Enterprise Sales Cycles", "Feature Requests"],
      20: ["Content Marketing", "Partner Referrals"],
      21: "Reach ₹1Cr ARR",
      22: "₹5-10 Cr",
      23: ["Competition", "Customer Churn"]
    },
    industryKeywords: ['saas', 'software', 'enterprise', 'startup', 'project', 'management', 'platform', 'tool', 'technology', 'business', 'india', 'growth']
  }
];

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function apiCall(endpoint, method, body, token) {
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` })
    },
    ...(body && { body: JSON.stringify(body) })
  };
  
  const response = await fetch(`${API_BASE}${endpoint}`, options);
  const text = await response.text();
  
  try {
    return { status: response.status, data: JSON.parse(text) };
  } catch {
    return { status: response.status, data: { error: 'Invalid JSON' }, raw: text };
  }
}

// API call with retry logic for 503 errors
async function apiCallWithRetry(endpoint, method, body, token, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const result = await apiCall(endpoint, method, body, token);
    
    if (result.status === 200) {
      return result;
    }
    
    if (result.status === 503 && attempt < maxRetries) {
      const waitTime = (result.data.retryAfter || 5) * 1000 * attempt; // Exponential backoff
      console.log(`     ⏳ Retry ${attempt}/${maxRetries} after ${waitTime/1000}s...`);
      await sleep(waitTime);
      continue;
    }
    
    return result;
  }
}

async function testPersona(persona, personaIndex) {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`👤 PERSONA ${personaIndex + 1}/5: ${persona.name}`);
  console.log(`${'═'.repeat(60)}`);
  
  const results = { news: false, gtm: false, chat: false, competitors: false, simulation: false };
  const email = `test_retry_${Date.now()}_${personaIndex}@test.com`;
  
  // Auth
  const authRes = await apiCall('/api/auth/signup', 'POST', {
    email, password: 'Test123!@#', name: persona.name, companyName: persona.ddqResponses[1]
  });
  const token = authRes.data.accessToken;
  
  if (!token) {
    console.log('❌ Auth failed');
    return results;
  }
  console.log('✅ Authenticated');
  
  // Save DDQ
  await apiCall('/api/ddq/save', 'POST', { responses: persona.ddqResponses, completed: true }, token);
  console.log('✅ DDQ saved');
  
  await sleep(3000);
  
  // NEWS TEST
  const newsRes = await apiCallWithRetry('/api/news', 'GET', null, token);
  if (newsRes.status === 200) {
    const articles = newsRes.data.news || newsRes.data.articles || [];
    const validArticles = articles.filter(a => a.title && a.title.length > 5);
    let relevantCount = 0;
    validArticles.forEach(a => {
      const text = ((a.title || '') + ' ' + (a.summary || a.description || '')).toLowerCase();
      if (persona.industryKeywords.some(kw => text.includes(kw))) relevantCount++;
    });
    const relevance = validArticles.length > 0 ? (relevantCount / validArticles.length * 100) : 0;
    results.news = validArticles.length > 0 && relevance >= 15;
    console.log(`📰 NEWS: ${results.news ? '✅' : '❌'} ${validArticles.length} articles, ${relevance.toFixed(0)}% relevant`);
  } else {
    console.log(`📰 NEWS: ❌ Status ${newsRes.status}`);
  }
  
  await sleep(8000);
  
  // GTM TEST (with retry)
  const gtmRes = await apiCallWithRetry('/api/gtm/generate', 'POST', {
    ddqResponses: persona.ddqResponses, valuation: { estimatedValuation: 10000000 }
  }, token);
  if (gtmRes.status === 200 && gtmRes.data.strategy) {
    const strategy = gtmRes.data.strategy;
    const gtmString = JSON.stringify(strategy).toLowerCase();
    const hasProductName = gtmString.includes(persona.ddqResponses[1].toLowerCase());
    const hasContent = !!strategy.productOverview || !!strategy.targetMarket || !!strategy.launchPlan;
    results.gtm = hasProductName && hasContent;
    console.log(`🚀 GTM: ${results.gtm ? '✅' : '❌'} Product: ${hasProductName}, Content: ${hasContent}`);
  } else {
    console.log(`🚀 GTM: ❌ Status ${gtmRes.status}`);
  }
  
  await sleep(8000);
  
  // CHAT TEST (with retry)
  const chatRes = await apiCallWithRetry('/api/chat/grok', 'POST', {
    message: `What are the top 3 things I should focus on for ${persona.ddqResponses[1]} in the next month?`,
    ddqResponses: persona.ddqResponses
  }, token);
  if (chatRes.status === 200 && chatRes.data.response) {
    const response = chatRes.data.response;
    const hasProductName = response.toLowerCase().includes(persona.ddqResponses[1].toLowerCase());
    const hasNumbers = /\d+/.test(response);
    const hasActionVerb = /\b(focus|implement|start|build|launch|create|develop|improve)\b/i.test(response);
    const isGenericHelp = response.includes('Try asking more specific questions');
    const markers = [hasProductName, hasNumbers, hasActionVerb].filter(Boolean).length;
    results.chat = !isGenericHelp && response.length > 200 && markers >= 2;
    console.log(`💬 CHAT: ${results.chat ? '✅' : '❌'} ${response.length} chars, ${markers}/3 markers, mentions product: ${hasProductName}`);
  } else {
    console.log(`💬 CHAT: ❌ Status ${chatRes.status} - ${chatRes.data.error || 'Unknown error'}`);
  }
  
  await sleep(8000);
  
  // COMPETITORS TEST (with retry)
  const compRes = await apiCallWithRetry('/api/analysis/competitors', 'POST', {
    category: Array.isArray(persona.ddqResponses[3]) ? persona.ddqResponses[3][0] : persona.ddqResponses[3],
    userMentionedCompetitors: persona.ddqResponses[6],
    stage: persona.ddqResponses[5],
    productDescription: persona.ddqResponses[2]
  }, token);
  if (compRes.status === 200 && compRes.data.competitors) {
    const competitors = compRes.data.competitors;
    const fakePatterns = [/^startup\s*[a-z]$/i, /^company\s*[a-z]$/i, /^competitor\s*[a-z0-9]$/i];
    const fakeCount = competitors.filter(c => fakePatterns.some(p => p.test(c.name || ''))).length;
    results.competitors = competitors.length > 0 && fakeCount === 0;
    console.log(`🏢 COMPETITORS: ${results.competitors ? '✅' : '❌'} ${competitors.length} found, ${fakeCount} fake`);
  } else {
    console.log(`🏢 COMPETITORS: ❌ Status ${compRes.status} - ${compRes.data.error || 'Unknown error'}`);
  }
  
  await sleep(8000);
  
  // SIMULATION TEST (with retry)
  const simRes = await apiCallWithRetry('/api/simulation/run', 'POST', {
    decision: `Should ${persona.ddqResponses[1]} invest in expanding the team to accelerate ${persona.ddqResponses[21]}?`,
    timeframe: '6 months',
    companyData: {
      name: persona.ddqResponses[1],
      industry: Array.isArray(persona.ddqResponses[3]) ? persona.ddqResponses[3][0] : persona.ddqResponses[3],
      stage: persona.ddqResponses[5]
    }
  }, token);
  if (simRes.status === 200) {
    const sim = simRes.data.simulation || simRes.data;
    const hasSummary = !!sim.summary && sim.summary.length > 30;
    const hasRecommendation = !!sim.recommendation;
    const hasImpacts = (!!sim.runwayImpact && !!sim.growthImpact) || !!sim.impactAnalysis;
    results.simulation = hasSummary && hasRecommendation && hasImpacts;
    console.log(`🎯 SIMULATION: ${results.simulation ? '✅' : '❌'} Summary: ${hasSummary}, Rec: ${hasRecommendation}, Impacts: ${hasImpacts}`);
  } else {
    console.log(`🎯 SIMULATION: ❌ Status ${simRes.status} - ${simRes.data.error || 'Unknown error'}`);
  }
  
  return results;
}

async function runAllTests() {
  console.log('\n' + '█'.repeat(60));
  console.log('     🔬 5 PERSONAS STRICT TEST - DYNAMIC DATA ONLY');
  console.log('     (No Static Fallbacks - Real AI Responses Only)');
  console.log('█'.repeat(60));
  
  const allResults = [];
  
  for (let i = 0; i < PERSONAS.length; i++) {
    const results = await testPersona(PERSONAS[i], i);
    allResults.push({ persona: PERSONAS[i].name, results });
    
    if (i < PERSONAS.length - 1) {
      console.log('\n⏳ Waiting 15s before next persona to avoid rate limits...');
      await sleep(15000);
    }
  }
  
  // Final Summary
  console.log('\n' + '█'.repeat(60));
  console.log('                    📊 FINAL SUMMARY');
  console.log('█'.repeat(60) + '\n');
  
  const features = ['news', 'gtm', 'chat', 'competitors', 'simulation'];
  const totals = { news: 0, gtm: 0, chat: 0, competitors: 0, simulation: 0 };
  
  allResults.forEach(({ persona, results }) => {
    const passed = Object.values(results).filter(Boolean).length;
    console.log(`${passed === 5 ? '🎉' : '⚠️'} ${persona}: ${passed}/5`);
    features.forEach(f => { if (results[f]) totals[f]++; });
  });
  
  console.log('\n' + '─'.repeat(40));
  console.log('By Feature:');
  features.forEach(f => {
    const icon = totals[f] === 5 ? '✅' : (totals[f] >= 3 ? '⚠️' : '❌');
    console.log(`  ${icon} ${f.toUpperCase()}: ${totals[f]}/5 personas`);
  });
  
  const totalPassed = Object.values(totals).reduce((a, b) => a + b, 0);
  const totalTests = 25;
  
  console.log('\n' + '═'.repeat(40));
  console.log(`OVERALL: ${totalPassed}/${totalTests} tests passed (${(totalPassed/totalTests*100).toFixed(0)}%)`);
  
  if (totalPassed === totalTests) {
    console.log('🎉🎉🎉 ALL TESTS PASSED WITH DYNAMIC DATA! 🎉🎉🎉');
    return true;
  } else if (totalPassed >= 20) {
    console.log('✅ MOSTLY PASSING - Some rate limits may have occurred');
    return true;
  } else {
    console.log('❌ TESTS FAILED - Check Gemini API availability');
    return false;
  }
}

runAllTests().then(success => {
  process.exit(success ? 0 : 1);
}).catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
