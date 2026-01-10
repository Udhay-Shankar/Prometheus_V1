// Single Persona Deep Test - With correct response field mappings
const API_BASE = 'https://prometheus-v1.onrender.com';

const PERSONA = {
  name: "FinTech Founder - Priya",
  email: `deep_fintech_${Date.now()}@test.com`,
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
  industryKeywords: ['payment', 'fintech', 'upi', 'banking', 'digital', 'financial', 'rbi', 'money', 'transaction', 'merchant', 'technology', 'startups']
};

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
    const data = JSON.parse(text);
    return { status: response.status, data };
  } catch {
    return { status: response.status, data: { error: 'Invalid JSON' }, raw: text };
  }
}

async function runDeepTest() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('     🔬 DEEP SINGLE PERSONA TEST - WITH RATE LIMIT HANDLING');
  console.log('═══════════════════════════════════════════════════════════════\n');
  
  const results = { news: null, competitors: null, chat: null, simulation: null, gtm: null };
  
  // 1. Auth
  console.log('🔐 Authenticating...');
  const authRes = await apiCall('/api/auth/signup', 'POST', {
    email: PERSONA.email,
    password: 'Test123!@#',
    name: PERSONA.name,
    companyName: PERSONA.ddqResponses[1]
  });
  const token = authRes.data.accessToken;
  console.log('   Token:', token ? '✅ Obtained' : '❌ Failed');
  
  // 2. Save DDQ
  console.log('\n📝 Saving DDQ...');
  await apiCall('/api/ddq/save', 'POST', { responses: PERSONA.ddqResponses, completed: true }, token);
  console.log('   ✅ Saved');
  
  // Wait 5 seconds before API tests
  console.log('\n⏳ Waiting 5s for rate limit reset...\n');
  await sleep(5000);
  
  // ============ NEWS TEST ============
  console.log('━'.repeat(60));
  console.log('📰 NEWS API TEST');
  console.log('━'.repeat(60));
  
  const newsRes = await apiCall('/api/news', 'GET', null, token);
  console.log('   Status:', newsRes.status);
  console.log('   Response Keys:', Object.keys(newsRes.data));
  
  // Note: API returns 'news' not 'articles'
  const newsArray = newsRes.data.news || newsRes.data.articles || [];
  
  if (newsRes.status === 200 && Array.isArray(newsArray) && newsArray.length > 0) {
    // Check article structure
    const validArticles = newsArray.filter(a => a.title && a.title.length > 5);
    console.log('   Articles Count:', validArticles.length);
    
    // Check relevance
    let relevantCount = 0;
    validArticles.forEach(a => {
      const text = ((a.title || '') + ' ' + (a.summary || a.description || '')).toLowerCase();
      if (PERSONA.industryKeywords.some(kw => text.includes(kw))) {
        relevantCount++;
      }
    });
    
    const relevance = validArticles.length > 0 ? (relevantCount / validArticles.length * 100).toFixed(0) : 0;
    console.log('   Industry Relevance:', relevance + '%');
    console.log('   Sample Title:', validArticles[0]?.title?.slice(0, 60));
    
    results.news = {
      pass: validArticles.length > 0 && parseInt(relevance) >= 15,
      details: `${validArticles.length} articles, ${relevance}% relevant`
    };
  } else {
    results.news = { pass: false, details: `Status ${newsRes.status}, no valid articles` };
  }
  console.log('   Result:', results.news.pass ? '✅ PASS' : '❌ FAIL', '-', results.news.details);
  
  await sleep(5000);
  
  // ============ GTM TEST ============
  console.log('\n' + '━'.repeat(60));
  console.log('🚀 GTM API TEST');
  console.log('━'.repeat(60));
  
  const gtmRes = await apiCall('/api/gtm/generate', 'POST', {
    ddqResponses: PERSONA.ddqResponses,
    valuation: { estimatedValuation: 10000000 }
  }, token);
  
  console.log('   Status:', gtmRes.status);
  console.log('   Response Keys:', Object.keys(gtmRes.data));
  
  if (gtmRes.status === 200 && gtmRes.data.strategy) {
    const strategy = gtmRes.data.strategy;
    const strategyKeys = Object.keys(strategy);
    console.log('   Strategy Keys:', strategyKeys.slice(0, 8).join(', '));
    
    // Check for product name
    const gtmString = JSON.stringify(strategy).toLowerCase();
    const hasProductName = gtmString.includes(PERSONA.ddqResponses[1].toLowerCase());
    console.log('   Mentions Product:', hasProductName ? '✅ Yes' : '❌ No');
    
    // Check for required sections
    const hasOverview = !!strategy.productOverview;
    const hasTargetMarket = !!strategy.targetMarket;
    const hasLaunchPlan = !!strategy.launchPlan || !!strategy.executionPlan;
    console.log('   Has Overview:', hasOverview);
    console.log('   Has Target Market:', hasTargetMarket);
    console.log('   Has Plan:', hasLaunchPlan);
    
    results.gtm = {
      pass: hasProductName && (hasOverview || hasTargetMarket),
      details: `Product mentioned: ${hasProductName}, Sections: overview=${hasOverview}, target=${hasTargetMarket}`
    };
  } else {
    results.gtm = { pass: false, details: `Status ${gtmRes.status}` };
  }
  console.log('   Result:', results.gtm.pass ? '✅ PASS' : '❌ FAIL', '-', results.gtm.details);
  
  await sleep(8000); // Longer wait before Gemini-heavy calls
  
  // ============ CHAT TEST ============
  console.log('\n' + '━'.repeat(60));
  console.log('💬 CHAT API TEST');
  console.log('━'.repeat(60));
  
  const chatRes = await apiCall('/api/chat/grok', 'POST', {
    message: `What are the top 3 things I should focus on for PayEasy in the next month to improve our merchant acquisition?`,
    ddqResponses: PERSONA.ddqResponses
  }, token);
  
  console.log('   Status:', chatRes.status);
  
  if (chatRes.status === 200 && chatRes.data.response) {
    const response = chatRes.data.response;
    console.log('   Response Length:', response.length, 'chars');
    console.log('   Preview:', response.slice(0, 150).replace(/\n/g, ' '));
    
    // Check for quality markers
    const hasProductName = response.toLowerCase().includes('payeasy');
    const hasNumbers = /\d+/.test(response);
    const hasList = response.includes('1.') || response.includes('1)') || response.includes('•');
    const hasActionVerb = /\b(focus|implement|start|build|launch|create|develop|improve)\b/i.test(response);
    const isGenericHelp = response.includes('Try asking more specific questions');
    
    console.log('   Quality Markers:');
    console.log('     - Mentions PayEasy:', hasProductName);
    console.log('     - Contains Numbers:', hasNumbers);
    console.log('     - Has List Format:', hasList);
    console.log('     - Has Action Verbs:', hasActionVerb);
    console.log('     - Is Generic Help:', isGenericHelp);
    
    const markerCount = [hasProductName, hasNumbers, hasList, hasActionVerb].filter(Boolean).length;
    
    results.chat = {
      pass: !isGenericHelp && response.length > 200 && markerCount >= 2,
      details: `${response.length} chars, ${markerCount}/4 markers, generic=${isGenericHelp}`
    };
  } else {
    results.chat = { pass: false, details: `Status ${chatRes.status}` };
  }
  console.log('   Result:', results.chat.pass ? '✅ PASS' : '❌ FAIL', '-', results.chat.details);
  
  await sleep(8000);
  
  // ============ COMPETITORS TEST ============
  console.log('\n' + '━'.repeat(60));
  console.log('🏢 COMPETITORS API TEST');
  console.log('━'.repeat(60));
  
  const compRes = await apiCall('/api/analysis/competitors', 'POST', {
    category: PERSONA.ddqResponses[3][0], // Industry
    userMentionedCompetitors: PERSONA.ddqResponses[6], // Competitors from DDQ
    stage: PERSONA.ddqResponses[5], // Stage
    productDescription: PERSONA.ddqResponses[2] // Description
  }, token);
  
  console.log('   Status:', compRes.status);
  
  if (compRes.status === 200 && compRes.data.competitors) {
    const competitors = compRes.data.competitors;
    console.log('   Competitors Count:', competitors.length);
    console.log('   Names:', competitors.slice(0, 5).map(c => c.name).join(', '));
    
    // Check for fake names
    const fakePatterns = [/^startup\s*[a-z]$/i, /^company\s*[a-z]$/i, /^competitor\s*[a-z0-9]$/i];
    const fakeCount = competitors.filter(c => fakePatterns.some(p => p.test(c.name || ''))).length;
    console.log('   Fake Names Found:', fakeCount);
    
    results.competitors = {
      pass: competitors.length > 0 && fakeCount === 0,
      details: `${competitors.length} competitors, ${fakeCount} fake names`
    };
  } else {
    results.competitors = { 
      pass: false, 
      details: `Status ${compRes.status}: ${compRes.data.error || 'Unknown error'}`
    };
  }
  console.log('   Result:', results.competitors.pass ? '✅ PASS' : '❌ FAIL', '-', results.competitors.details);
  
  await sleep(8000);
  
  // ============ SIMULATION TEST ============
  console.log('\n' + '━'.repeat(60));
  console.log('🎯 SIMULATION API TEST');
  console.log('━'.repeat(60));
  
  const simRes = await apiCall('/api/simulation/run', 'POST', {
    decision: 'We are considering raising our transaction fee from 1% to 1.5% for PayEasy to improve unit economics. This affects our 45 merchants. Should we proceed?',
    timeframe: '6 months'
  }, token);
  
  console.log('   Status:', simRes.status);
  
  if (simRes.status === 200) {
    const sim = simRes.data.simulation || simRes.data; // Handle both nested and flat responses
    console.log('   Response Keys:', Object.keys(sim).slice(0, 10).join(', '));
    
    // Check required fields
    const hasScenario = !!sim.scenario;
    const hasSummary = !!sim.summary && sim.summary.length > 30;
    const hasRecommendation = !!sim.recommendation;
    const hasImpacts = (!!sim.runwayImpact && !!sim.growthImpact) || !!sim.impactAnalysis;
    const hasConfidence = typeof sim.confidence === 'number';
    const hasDetailedExplanation = !!sim.detailedExplanation;
    
    console.log('   Has Scenario:', hasScenario);
    console.log('   Has Summary:', hasSummary);
    console.log('   Has Recommendation:', hasRecommendation);
    console.log('   Has Impacts:', hasImpacts);
    console.log('   Has Confidence:', hasConfidence, sim.confidence);
    console.log('   Has Detailed Explanation:', hasDetailedExplanation);
    
    results.simulation = {
      pass: hasSummary && hasRecommendation && hasImpacts,
      details: `scenario=${hasScenario}, summary=${hasSummary}, impacts=${hasImpacts}`
    };
  } else {
    results.simulation = { 
      pass: false, 
      details: `Status ${simRes.status}: ${simRes.data.error || 'Unknown error'}`
    };
  }
  console.log('   Result:', results.simulation.pass ? '✅ PASS' : '❌ FAIL', '-', results.simulation.details);
  
  // ============ FINAL SUMMARY ============
  console.log('\n' + '═'.repeat(60));
  console.log('                    📊 FINAL RESULTS');
  console.log('═'.repeat(60));
  
  const features = ['news', 'gtm', 'chat', 'competitors', 'simulation'];
  let passCount = 0;
  
  features.forEach(f => {
    const r = results[f];
    const icon = r.pass ? '✅' : '❌';
    console.log(`${icon} ${f.toUpperCase()}: ${r.pass ? 'PASS' : 'FAIL'} - ${r.details}`);
    if (r.pass) passCount++;
  });
  
  console.log('\n' + '═'.repeat(60));
  console.log(`TOTAL: ${passCount}/5 tests passed`);
  
  if (passCount === 5) {
    console.log('🎉 ALL TESTS PASSED!');
  } else if (passCount >= 3) {
    console.log('⚠️ PARTIALLY PASSING - Some APIs need attention');
  } else {
    console.log('❌ TESTS FAILED - Major issues present');
  }
  
  return passCount === 5;
}

runDeepTest().then(success => {
  process.exit(success ? 0 : 1);
}).catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
