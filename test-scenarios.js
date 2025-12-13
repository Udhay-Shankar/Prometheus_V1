/**
 * Test Script: Validate AI-Generated Analysis Against Real Market Data
 * 
 * This script tests 5 different startup scenarios and compares
 * AI-generated competitor/valuation data with real market research
 */

const API_URL = 'http://localhost:3001';

// Test authentication token (replace with actual token from localStorage)
let AUTH_TOKEN = '';

const testScenarios = [
  {
    name: 'Scenario 1: Early-Stage SaaS in Karnataka',
    category: 'SaaS',
    stage: 'MVP',
    state: 'Karnataka',
    revenue: 0,
    expectedCompetitors: ['Freshworks', 'Chargebee', 'Postman', 'Zoho'],
    expectedValuationRange: [20000000, 100000000], // ₹2-10 Cr for MVP SaaS
    researchNotes: 'Karnataka is SaaS hub with Freshworks (₹35000 Cr), Chargebee (₹14500 Cr)'
  },
  {
    name: 'Scenario 2: Growing Marketplace in Maharashtra',
    category: 'Marketplace',
    stage: 'Launched',
    state: 'Maharashtra',
    revenue: 500000,
    expectedCompetitors: ['Meesho', 'Dunzo', 'Swiggy', 'Zomato'],
    expectedValuationRange: [100000000, 500000000], // ₹10-50 Cr for launched marketplace with ₹5L/month
    researchNotes: 'Mumbai/Pune marketplace ecosystem - Meesho (₹4900 Cr), Swiggy (₹105000 Cr)'
  },
  {
    name: 'Scenario 3: Pre-Revenue AI/ML in Telangana',
    category: 'AI/ML',
    stage: 'Beta',
    state: 'Telangana',
    revenue: 0,
    expectedCompetitors: ['Darwinbox', 'Haptik', 'Active.ai', 'Crayon Data'],
    expectedValuationRange: [50000000, 200000000], // ₹5-20 Cr for Beta AI/ML
    researchNotes: 'Hyderabad AI hub - T-Hub backed, Darwinbox (₹450 Cr Series D)'
  },
  {
    name: 'Scenario 4: Revenue E-commerce in Delhi',
    category: 'E-commerce',
    stage: 'Growing',
    state: 'Delhi',
    revenue: 1000000,
    expectedCompetitors: ['Nykaa', 'Lenskart', 'Urban Company', 'FirstCry'],
    expectedValuationRange: [500000000, 2000000000], // ₹50-200 Cr for growing e-commerce
    researchNotes: 'Delhi D2C brands - Nykaa (₹58000 Cr), Lenskart (₹32500 Cr)'
  },
  {
    name: 'Scenario 5: Seed FinTech in Bangalore',
    category: 'FinTech',
    stage: 'Launched',
    state: 'Karnataka',
    revenue: 200000,
    expectedCompetitors: ['CRED', 'Razorpay', 'PhonePe', 'Paytm'],
    expectedValuationRange: [100000000, 800000000], // ₹10-80 Cr for launched fintech
    researchNotes: 'Bangalore FinTech - CRED (₹65000 Cr), Razorpay (₹75000 Cr Series F)'
  }
];

async function login() {
  try {
    const response = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'saminathann@stratschool.com',
        password: 'kjhasdkjhjkfd'
      })
    });

    if (response.ok) {
      const data = await response.json();
      AUTH_TOKEN = data.accessToken;
      console.log('✅ Authentication successful\n');
      return true;
    } else {
      console.log('❌ Login failed - using existing session\n');
      return false;
    }
  } catch (error) {
    console.log('⚠️ Login error:', error.message, '\n');
    return false;
  }
}

async function testCompetitors(scenario) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`🧪 TESTING: ${scenario.name}`);
  console.log(`${'='.repeat(80)}\n`);

  console.log(`📋 Input Parameters:`);
  console.log(`   Category: ${scenario.category}`);
  console.log(`   Stage: ${scenario.stage}`);
  console.log(`   State: ${scenario.state}`);
  console.log(`   Revenue: ₹${scenario.revenue.toLocaleString('en-IN')}/month`);
  console.log(`\n📚 Market Research:`);
  console.log(`   ${scenario.researchNotes}`);
  console.log(`   Expected Competitors: ${scenario.expectedCompetitors.join(', ')}`);
  console.log(`   Expected Valuation: ₹${(scenario.expectedValuationRange[0]/10000000).toFixed(1)}-${(scenario.expectedValuationRange[1]/10000000).toFixed(1)} Cr\n`);

  try {
    // Test Competitors API
    console.log(`🔍 Calling Competitors API...`);
    const competitorResponse = await fetch(`${API_URL}/api/analysis/competitors`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${AUTH_TOKEN}`
      },
      body: JSON.stringify({
        category: scenario.category,
        stage: scenario.stage,
        revenue: scenario.revenue
      })
    });

    if (!competitorResponse.ok) {
      const error = await competitorResponse.json();
      console.log(`❌ Competitor API Failed:`, error);
      return { success: false, reason: error.error };
    }

    const competitorData = await competitorResponse.json();
    console.log(`\n✅ AI-Generated Competitors:`);
    
    const competitors = competitorData.competitors || [];
    let matchCount = 0;
    
    competitors.forEach((comp, index) => {
      const isExpected = scenario.expectedCompetitors.some(name => 
        comp.name.toLowerCase().includes(name.toLowerCase()) || 
        name.toLowerCase().includes(comp.name.toLowerCase())
      );
      
      const matchSymbol = isExpected ? '✓' : '?';
      console.log(`   ${index + 1}. ${matchSymbol} ${comp.name} - ${comp.stage} (₹${(comp.currentValuation/10000000).toFixed(1)} Cr)`);
      
      if (isExpected) matchCount++;
    });

    const accuracy = (matchCount / scenario.expectedCompetitors.length) * 100;
    console.log(`\n📊 Accuracy: ${matchCount}/${scenario.expectedCompetitors.length} matches (${accuracy.toFixed(1)}%)`);

    // Test Valuation API
    console.log(`\n🔍 Calling Valuation API...`);
    const valuationResponse = await fetch(`${API_URL}/api/valuation/calculate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${AUTH_TOKEN}`
      },
      body: JSON.stringify({
        scores: {
          teamScore: 3.5,
          productScore: scenario.stage === 'Idea' ? 2 : scenario.stage === 'MVP' ? 3 : 4,
          marketScore: 4,
          salesScore: scenario.revenue > 0 ? 4 : 2,
          financingScore: 3,
          competitiveScore: 3.5
        },
        companyStage: scenario.stage,
        revenue: scenario.revenue,
        category: scenario.category,
        totalInvestment: 0,
        monthlyExpenses: scenario.revenue * 0.7
      })
    });

    if (valuationResponse.ok) {
      const valuationData = await valuationResponse.json();
      const valuation = valuationData.finalValuationINR;
      const inRange = valuation >= scenario.expectedValuationRange[0] && 
                      valuation <= scenario.expectedValuationRange[1];
      
      console.log(`\n✅ AI-Generated Valuation: ₹${(valuation/10000000).toFixed(2)} Cr`);
      console.log(`   Expected Range: ₹${(scenario.expectedValuationRange[0]/10000000).toFixed(1)}-${(scenario.expectedValuationRange[1]/10000000).toFixed(1)} Cr`);
      console.log(`   ${inRange ? '✅ WITHIN RANGE' : '⚠️ OUTSIDE RANGE'}`);
      console.log(`   Method: ${valuationData.valuationMethod}`);

      return {
        success: true,
        competitorAccuracy: accuracy,
        valuationInRange: inRange,
        aiCompetitors: competitors.map(c => c.name),
        aiValuation: valuation
      };
    }

  } catch (error) {
    console.log(`\n❌ Test Failed:`, error.message);
    return { success: false, reason: error.message };
  }
}

async function runAllTests() {
  console.log(`\n${'*'.repeat(80)}`);
  console.log(`  AI ANALYSIS VALIDATION TEST SUITE`);
  console.log(`  Testing Gemini 2.0 Flash Exp against Real Market Data`);
  console.log(`${'*'.repeat(80)}\n`);

  // Try to login
  await login();

  const results = [];

  for (const scenario of testScenarios) {
    const result = await testCompetitors(scenario);
    results.push({
      scenario: scenario.name,
      ...result
    });

    // Wait between tests to respect rate limits
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  // Summary Report
  console.log(`\n\n${'='.repeat(80)}`);
  console.log(`📊 TEST SUMMARY REPORT`);
  console.log(`${'='.repeat(80)}\n`);

  const successCount = results.filter(r => r.success).length;
  const avgAccuracy = results
    .filter(r => r.competitorAccuracy)
    .reduce((sum, r) => sum + r.competitorAccuracy, 0) / results.length;
  const valuationsInRange = results.filter(r => r.valuationInRange).length;

  console.log(`Total Tests: ${testScenarios.length}`);
  console.log(`Successful: ${successCount}/${testScenarios.length}`);
  console.log(`Average Competitor Accuracy: ${avgAccuracy.toFixed(1)}%`);
  console.log(`Valuations in Expected Range: ${valuationsInRange}/${testScenarios.length}\n`);

  results.forEach((result, index) => {
    console.log(`${index + 1}. ${result.scenario}`);
    console.log(`   Status: ${result.success ? '✅ PASS' : '❌ FAIL'}`);
    if (result.success) {
      console.log(`   Competitor Match: ${result.competitorAccuracy?.toFixed(1)}%`);
      console.log(`   Valuation: ${result.valuationInRange ? '✅ In Range' : '⚠️ Out of Range'}`);
    }
    console.log('');
  });

  console.log(`${'='.repeat(80)}\n`);
}

// Run tests
runAllTests().catch(console.error);
