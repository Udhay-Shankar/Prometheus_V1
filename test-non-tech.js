// Test script for non-tech companies: Construction/Real Estate and Food/Hospitality

const BASE_URL = 'http://localhost:3001';

// Test data for two non-tech companies
const testCompanies = [
  {
    name: "BuildRight Constructions",
    type: "Construction & Real Estate",
    user: {
      email: `buildright_${Date.now()}@test.com`,
      password: "TestPass@123",
      name: "Rajesh Sharma",
      companyName: "BuildRight Constructions Pvt Ltd"
    },
    ddq: {
      // Company Info
      companyName: "BuildRight Constructions Pvt Ltd",
      foundingDate: "2020-03-15",
      location: "Mumbai, Maharashtra",
      category: "Other",
      stage: "Launched",
      
      // Business Details
      problemStatement: "Affordable housing shortage in tier-2 cities. Middle-class families struggle to find quality homes under ₹50 lakhs with modern amenities and good connectivity.",
      solution: "We build affordable housing complexes in tier-2 cities using cost-effective construction methods while maintaining quality. Our pre-approved designs reduce approval time by 60%.",
      targetMarket: "Middle-class families in tier-2 cities (Nashik, Nagpur, Aurangabad) with household income ₹8-15 lakhs per annum",
      businessModel: "Revenue from property sales, construction contracts, and maintenance services. Average ticket size ₹45 lakhs per unit.",
      
      // Metrics
      revenue: 85000000, // ₹8.5 Cr annual revenue
      monthlyExpenses: 4500000, // ₹45 lakhs monthly
      userBase: 150, // 150 units sold
      userGrowth: 35, // 35% YoY growth
      
      // Team
      teamSize: 45,
      founderExperience: "15 years in construction industry. Previously VP at L&T Realty. IIT Bombay Civil Engineering.",
      
      // Funding
      previousFunding: 20000000, // ₹2 Cr raised
      fundingRound: "Series A",
      askAmount: 100000000, // ₹10 Cr ask
      
      // Competitors
      competitors: "Godrej Properties, Lodha Group, Mahindra Lifespaces, local builders"
    }
  },
  {
    name: "Spice Route Kitchen",
    type: "Food & Hospitality (Cloud Kitchen)",
    user: {
      email: `spiceroute_${Date.now()}@test.com`,
      password: "TestPass@123",
      name: "Priya Menon",
      companyName: "Spice Route Kitchen LLP"
    },
    ddq: {
      // Company Info
      companyName: "Spice Route Kitchen LLP",
      foundingDate: "2022-01-10",
      location: "Bangalore, Karnataka",
      category: "FoodTech",
      stage: "Launched",
      
      // Business Details
      problemStatement: "Working professionals lack access to authentic, healthy home-style regional food. Existing options are either unhealthy fast food or expensive restaurant delivery.",
      solution: "Cloud kitchen network serving authentic regional cuisines (South Indian, Gujarati, Bengali) using standardized recipes from home cooks. Fresh ingredients, no preservatives, delivered in 30 mins.",
      targetMarket: "Working professionals aged 25-45 in Bangalore, Chennai, Hyderabad. Monthly food delivery budget ₹3000-8000.",
      businessModel: "Direct delivery via own app + aggregator platforms. Average order value ₹350. 4000+ orders/month across 3 cloud kitchens.",
      
      // Metrics
      revenue: 18000000, // ₹1.8 Cr annual revenue
      monthlyExpenses: 1200000, // ₹12 lakhs monthly
      userBase: 8500, // 8500 active customers
      userGrowth: 85, // 85% YoY growth
      
      // Team
      teamSize: 28,
      founderExperience: "8 years in food industry. Ex-Swiggy operations manager. MBA from IIM Kozhikode.",
      
      // Funding
      previousFunding: 5000000, // ₹50 lakhs raised
      fundingRound: "Seed",
      askAmount: 30000000, // ₹3 Cr ask
      
      // Competitors
      "competitors": "Rebel Foods, Box8, EatFit, local tiffin services"
    }
  }
];

async function makeRequest(method, endpoint, data = null, token = null) {
  const headers = {
    'Content-Type': 'application/json'
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  const options = {
    method,
    headers
  };
  
  if (data) {
    options.body = JSON.stringify(data);
  }
  
  const response = await fetch(`${BASE_URL}${endpoint}`, options);
  const result = await response.json();
  
  return { status: response.status, data: result };
}

async function testCompany(company) {
  console.log('\n' + '='.repeat(80));
  console.log(`🏢 TESTING: ${company.name} (${company.type})`);
  console.log('='.repeat(80));
  
  let accessToken = null;
  
  // 1. Register user
  console.log('\n📝 Step 1: Registering user...');
  const signupResult = await makeRequest('POST', '/api/auth/signup', company.user);
  
  if (signupResult.status === 200) {
    console.log('✅ User registered successfully');
    accessToken = signupResult.data.accessToken;
  } else {
    console.log('❌ Registration failed:', signupResult.data.error);
    return;
  }
  
  // 2. Save DDQ responses
  console.log('\n📋 Step 2: Saving DDQ assessment...');
  const ddqResult = await makeRequest('POST', '/api/ddq/save', {
    responses: company.ddq,
    scores: {
      productScore: 4,
      marketScore: 3,
      teamScore: 4,
      salesScore: 3,
      financingScore: 3,
      competitiveScore: 3
    }
  }, accessToken);
  
  if (ddqResult.status === 200) {
    console.log('✅ DDQ saved successfully');
  } else {
    console.log('❌ DDQ save failed:', ddqResult.data.error);
  }
  
  // 3. Calculate Valuation
  console.log('\n💰 Step 3: Calculating valuation...');
  const valuationResult = await makeRequest('POST', '/api/valuation/calculate', {
    scores: {
      productScore: 4,
      marketScore: 3,
      teamScore: 4,
      salesScore: 3,
      financingScore: 3,
      competitiveScore: 3
    },
    companyStage: company.ddq.stage,
    revenue: company.ddq.revenue,
    category: company.ddq.category,
    totalInvestment: company.ddq.previousFunding,
    monthlyExpenses: company.ddq.monthlyExpenses,
    userValuation: company.ddq.askAmount
  }, accessToken);
  
  if (valuationResult.status === 200) {
    const val = valuationResult.data;
    console.log('✅ Valuation calculated:');
    console.log(`   📊 Estimated Valuation: ₹${(val.finalValuationINR / 10000000).toFixed(2)} Cr`);
    console.log(`   📊 USD Equivalent: $${(val.finalValuationUSD / 1000000).toFixed(2)} M`);
    console.log(`   🎯 User Ask: ₹${(company.ddq.askAmount / 10000000).toFixed(2)} Cr`);
    console.log(`   📋 Methodology: ${val.valuationMethod}`);
    console.log(`   📈 Stage Cap: ₹${(val.stageCap / 10000000).toFixed(2)} Cr`);
  } else {
    console.log('❌ Valuation failed:', valuationResult.data.error);
  }
  
  // 4. Get Competitor Analysis
  console.log('\n🏆 Step 4: Analyzing competitors...');
  const competitorResult = await makeRequest('POST', '/api/analysis/competitors', {
    category: company.ddq.category,
    userMentionedCompetitors: company.ddq.competitors,
    stage: company.ddq.stage,
    revenue: company.ddq.revenue
  }, accessToken);
  
  if (competitorResult.status === 200) {
    const comp = competitorResult.data;
    console.log('✅ Competitor analysis complete:');
    if (comp.competitors && comp.competitors.length > 0) {
      console.log(`   📊 Found ${comp.competitors.length} competitors`);
      comp.competitors.slice(0, 3).forEach((c, i) => {
        console.log(`   ${i + 1}. ${c.name} - ${c.stage || 'N/A'}`);
      });
    }
  } else {
    console.log('❌ Competitor analysis failed:', competitorResult.data.error);
  }
  
  // 5. Get SWOT Analysis
  console.log('\n📊 Step 5: Generating SWOT analysis...');
  const swotResult = await makeRequest('POST', '/api/analysis/swot', {
    companyName: company.ddq.companyName,
    category: company.ddq.category,
    stage: company.ddq.stage,
    problemStatement: company.ddq.problemStatement,
    solution: company.ddq.solution,
    targetMarket: company.ddq.targetMarket,
    revenue: company.ddq.revenue,
    teamSize: company.ddq.teamSize
  }, accessToken);
  
  if (swotResult.status === 200) {
    const swot = swotResult.data;
    console.log('✅ SWOT analysis generated:');
    console.log(`   💪 Strengths: ${swot.strengths?.slice(0, 2).join(', ').substring(0, 60)}...`);
    console.log(`   ⚠️ Weaknesses: ${swot.weaknesses?.slice(0, 2).join(', ').substring(0, 60)}...`);
  } else {
    console.log('❌ SWOT analysis failed:', swotResult.data.error);
  }
  
  // 6. Get Funding Schemes
  console.log('\n🏦 Step 6: Finding funding schemes...');
  const fundingResult = await makeRequest('POST', '/api/analysis/funding-schemes', {
    category: company.ddq.category,
    stage: company.ddq.stage,
    state: company.ddq.location.split(',')[1]?.trim() || 'Karnataka',
    revenue: company.ddq.revenue,
    fundingNeeded: company.ddq.askAmount
  }, accessToken);
  
  if (fundingResult.status === 200) {
    const funding = fundingResult.data;
    console.log('✅ Funding schemes found:');
    if (funding.schemes && funding.schemes.length > 0) {
      console.log(`   📋 Total schemes: ${funding.schemes.length}`);
      funding.schemes.slice(0, 3).forEach((s, i) => {
        console.log(`   ${i + 1}. ${s.name} - ${s.type || 'Grant/Scheme'}`);
      });
    }
  } else {
    console.log('❌ Funding schemes failed:', fundingResult.data.error);
  }
  
  // 7. Chat with Grok
  console.log('\n🤖 Step 7: Getting AI insights...');
  const chatResult = await makeRequest('POST', '/api/chat/grok', {
    message: `As a ${company.type} startup with ₹${(company.ddq.revenue / 10000000).toFixed(1)} Cr revenue, what are the top 3 growth strategies for the next 12 months?`,
    context: {
      companyName: company.ddq.companyName,
      category: company.ddq.category,
      stage: company.ddq.stage,
      revenue: company.ddq.revenue
    }
  }, accessToken);
  
  if (chatResult.status === 200) {
    console.log('✅ AI insights received:');
    const response = chatResult.data.response || chatResult.data.message;
    if (response) {
      console.log(`   💡 ${response.substring(0, 200)}...`);
    }
  } else {
    console.log('❌ Chat failed:', chatResult.data.error);
  }
  
  console.log('\n' + '-'.repeat(80));
  console.log(`✅ COMPLETED: ${company.name}`);
  console.log('-'.repeat(80));
}

async function runAllTests() {
  console.log('\n');
  console.log('╔══════════════════════════════════════════════════════════════════════════════╗');
  console.log('║        🧪 NON-TECH STARTUP TESTING SUITE - CEO Insight Engine               ║');
  console.log('║              Testing Construction/Real Estate & Food/Hospitality            ║');
  console.log('╚══════════════════════════════════════════════════════════════════════════════╝');
  
  for (const company of testCompanies) {
    try {
      await testCompany(company);
    } catch (error) {
      console.error(`\n❌ Error testing ${company.name}:`, error.message);
    }
  }
  
  console.log('\n');
  console.log('╔══════════════════════════════════════════════════════════════════════════════╗');
  console.log('║                         🎉 ALL TESTS COMPLETED!                              ║');
  console.log('╚══════════════════════════════════════════════════════════════════════════════╝');
  console.log('\n');
}

runAllTests().catch(console.error);
