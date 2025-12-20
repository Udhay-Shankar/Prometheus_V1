/**
 * CEO Insight Engine - System Validation & Performance Test
 * Tests 25 different products across various industries
 * Measures 90th percentile response times and success rates
 */

const BASE_URL = 'http://localhost:3001';

// 25 Test Products - Diverse Industries including Non-Tech
const TEST_PRODUCTS = [
  // Construction & Real Estate (Non-Tech)
  { id: 1, name: 'BuildRight Construction', category: 'Construction', competitors: 'L&T, Shapoorji Pallonji, Godrej Properties', stage: 'Growth', revenue: 5000000, customers: 50, state: 'Maharashtra', description: 'Commercial building construction company' },
  { id: 2, name: 'HomeSpace Realty', category: 'Real Estate', competitors: 'DLF, Prestige, Sobha', stage: 'Series A', revenue: 2000000, customers: 200, state: 'Karnataka', description: 'Residential real estate development' },
  { id: 3, name: 'UrbanBuild Contractors', category: 'Construction', competitors: 'Oberoi Realty, Brigade Group, Puravankara', stage: 'Idea', revenue: 0, customers: 0, state: 'Tamil Nadu', description: 'Infrastructure and road construction' },
  { id: 4, name: 'LandMark Properties', category: 'Real Estate', competitors: 'Lodha, Hiranandani, Raheja', stage: 'Pre-seed', revenue: 500000, customers: 15, state: 'Gujarat', description: 'Commercial property leasing' },
  { id: 5, name: 'GreenBuild Solutions', category: 'Construction', competitors: 'Tata Projects, Larsen & Toubro, NBCC', stage: 'Seed', revenue: 1000000, customers: 25, state: 'Delhi', description: 'Sustainable construction services' },
  
  // Food & Beverage (Non-Tech)
  { id: 6, name: 'Spice Kitchen', category: 'Food & Beverage', competitors: 'Haldiram, MTR, Catch', stage: 'Growth', revenue: 3000000, customers: 5000, state: 'Rajasthan', description: 'Traditional spice manufacturing' },
  { id: 7, name: 'Fresh Farms Dairy', category: 'Food & Beverage', competitors: 'Amul, Mother Dairy, Nestle', stage: 'Series A', revenue: 8000000, customers: 10000, state: 'Punjab', description: 'Dairy products manufacturing' },
  
  // Healthcare (Non-Tech focused)
  { id: 8, name: 'CarePlus Clinics', category: 'Healthcare', competitors: 'Apollo, Fortis, Max Healthcare', stage: 'Series B', revenue: 10000000, customers: 50000, state: 'Telangana', description: 'Chain of diagnostic clinics' },
  { id: 9, name: 'MediSupply Chain', category: 'Healthcare', competitors: 'Medplus, Apollo Pharmacy, Netmeds', stage: 'Growth', revenue: 15000000, customers: 1000, state: 'Andhra Pradesh', description: 'Medical equipment distribution' },
  
  // Manufacturing (Non-Tech)
  { id: 10, name: 'SteelCraft Industries', category: 'Manufacturing', competitors: 'Tata Steel, JSW, SAIL', stage: 'Public', revenue: 50000000, customers: 500, state: 'Jharkhand', description: 'Steel fabrication and manufacturing' },
  { id: 11, name: 'TextilePro Mills', category: 'Manufacturing', competitors: 'Raymond, Arvind, Welspun', stage: 'Series A', revenue: 7000000, customers: 300, state: 'Gujarat', description: 'Textile manufacturing' },
  
  // E-commerce & Mobile Apps
  { id: 12, name: 'QuickMart', category: 'E-commerce', competitors: 'ONDC, Swiggy, Zepto', stage: 'Seed', revenue: 500000, customers: 10000, state: 'Tamil Nadu', description: 'Quick commerce grocery delivery' },
  { id: 13, name: 'FashionHub', category: 'E-commerce', competitors: 'Myntra, Ajio, Nykaa', stage: 'Series A', revenue: 2000000, customers: 50000, state: 'Maharashtra', description: 'Fashion e-commerce platform' },
  
  // FinTech
  { id: 14, name: 'PayEasy', category: 'FinTech', competitors: 'Paytm, PhonePe, Razorpay', stage: 'Series B', revenue: 5000000, customers: 100000, state: 'Karnataka', description: 'Digital payment solutions' },
  { id: 15, name: 'LoanBuddy', category: 'FinTech', competitors: 'Bajaj Finserv, HDFC, ICICI', stage: 'Growth', revenue: 3000000, customers: 25000, state: 'Delhi', description: 'Personal loan platform' },
  
  // EdTech
  { id: 16, name: 'LearnSmart', category: 'EdTech', competitors: 'Byju, Unacademy, Vedantu', stage: 'Seed', revenue: 200000, customers: 5000, state: 'Kerala', description: 'Online learning platform' },
  
  // SaaS / B2B
  { id: 17, name: 'CloudOps', category: 'SaaS', competitors: 'Freshworks, Zoho, Salesforce', stage: 'Series A', revenue: 1000000, customers: 100, state: 'Karnataka', description: 'Cloud infrastructure management' },
  { id: 18, name: 'HRFlow', category: 'B2B', competitors: 'Darwinbox, Keka, greytHR', stage: 'Seed', revenue: 300000, customers: 50, state: 'Telangana', description: 'HR management software' },
  
  // Agriculture (Non-Tech)
  { id: 19, name: 'AgroFresh', category: 'Agriculture', competitors: 'ITC, Mahindra Agri, UPL', stage: 'Growth', revenue: 4000000, customers: 2000, state: 'Madhya Pradesh', description: 'Agricultural inputs and seeds' },
  { id: 20, name: 'FarmDirect', category: 'Agriculture', competitors: 'BigBasket, Ninjacart, DeHaat', stage: 'Series A', revenue: 1500000, customers: 5000, state: 'Uttar Pradesh', description: 'Farm-to-consumer platform' },
  
  // Logistics (Non-Tech focused)
  { id: 21, name: 'SwiftLogistics', category: 'Logistics', competitors: 'Delhivery, BlueDart, DTDC', stage: 'Series B', revenue: 20000000, customers: 10000, state: 'Maharashtra', description: 'Last-mile delivery services' },
  
  // Hospitality (Non-Tech)
  { id: 22, name: 'StayComfort Hotels', category: 'Hospitality', competitors: 'OYO, Taj, ITC Hotels', stage: 'Growth', revenue: 8000000, customers: 50000, state: 'Goa', description: 'Budget hotel chain' },
  
  // Retail (Non-Tech)
  { id: 23, name: 'MegaMart Retail', category: 'Retail', competitors: 'Reliance Retail, DMart, Big Bazaar', stage: 'Series A', revenue: 12000000, customers: 100000, state: 'Tamil Nadu', description: 'Supermarket chain' },
  
  // Energy (Non-Tech)
  { id: 24, name: 'SolarPower Solutions', category: 'Energy', competitors: 'Tata Power Solar, Adani Green, Waaree', stage: 'Growth', revenue: 6000000, customers: 500, state: 'Rajasthan', description: 'Solar panel installation' },
  
  // Automotive (Non-Tech)
  { id: 25, name: 'AutoParts Hub', category: 'Automotive', competitors: 'Bosch, Motherson, Bharat Forge', stage: 'Series A', revenue: 3000000, customers: 1000, state: 'Haryana', description: 'Automotive spare parts manufacturing' }
];

// Test Results Storage
const testResults = {
  endpoints: {},
  products: [],
  summary: {
    totalTests: 0,
    passed: 0,
    failed: 0,
    successRate: 0
  }
};

// Response time tracking per endpoint
const responseTimes = {
  '/api/auth/register': [],
  '/api/auth/login': [],
  '/api/ddq/save': [],
  '/api/ddq/get': [],
  '/api/analysis/valuation': [],
  '/api/analysis/competitors': [],
  '/api/analysis/introspection': [],
  '/api/analysis/vrio': [],
  '/api/analysis/porter': [],
  '/api/analysis/product-insight': [],
  '/api/analysis/daily-actions': [],
  '/api/analysis/backlog': [],
  '/api/analysis/news': [],
  '/api/chat': []
};

// Helper function to make HTTP requests
async function makeRequest(endpoint, method = 'GET', body = null, token = null) {
  const startTime = Date.now();
  
  try {
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
    
    if (body && (method === 'POST' || method === 'PUT')) {
      options.body = JSON.stringify(body);
    }
    
    const response = await fetch(`${BASE_URL}${endpoint}`, options);
    const responseTime = Date.now() - startTime;
    
    // Track response time
    if (responseTimes[endpoint]) {
      responseTimes[endpoint].push(responseTime);
    }
    
    let data;
    try {
      data = await response.json();
    } catch {
      data = { message: 'Non-JSON response' };
    }
    
    return {
      success: response.ok,
      status: response.status,
      data,
      responseTime,
      error: null
    };
  } catch (error) {
    const responseTime = Date.now() - startTime;
    return {
      success: false,
      status: 0,
      data: null,
      responseTime,
      error: error.message
    };
  }
}

// Calculate percentile
function calculatePercentile(arr, percentile) {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const index = Math.ceil((percentile / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

// Validate data quality
function validateData(data, dataType, product) {
  const issues = [];
  
  switch (dataType) {
    case 'valuation':
      if (!data.currentValuation && data.currentValuation !== 0) issues.push('Missing currentValuation');
      if (!data.methodology) issues.push('Missing methodology');
      if (data.currentValuation < 0) issues.push('Negative valuation');
      break;
      
    case 'competitors':
      if (!Array.isArray(data) && !data.competitors) issues.push('Competitors not an array');
      const comps = Array.isArray(data) ? data : (data.competitors || []);
      if (comps.length === 0) issues.push('No competitors returned');
      // Check if user-mentioned competitors are included
      const compNames = comps.map(c => c.name?.toLowerCase() || '');
      const userComps = product.competitors.toLowerCase().split(',').map(c => c.trim());
      const foundUserComps = userComps.filter(uc => compNames.some(cn => cn.includes(uc) || uc.includes(cn)));
      if (foundUserComps.length === 0 && userComps.length > 0) {
        issues.push(`User competitors not found: ${userComps.join(', ')}`);
      }
      break;
      
    case 'introspection':
      if (!data.strengths && !data.analysis) issues.push('Missing strengths/analysis');
      break;
      
    case 'vrio':
      if (!data.resources && !data.analysis) issues.push('Missing VRIO resources');
      break;
      
    case 'porter':
      if (!data.forces && !data.analysis) issues.push('Missing Porter forces');
      break;
      
    case 'product-insight':
      if (!data.insights && !data.analysis && !data.features) issues.push('Missing product insights');
      break;
      
    case 'daily-actions':
      if (!data.actions && !data.tasks && !Array.isArray(data)) issues.push('Missing daily actions');
      break;
      
    case 'backlog':
      if (!data.items && !data.backlog && !Array.isArray(data)) issues.push('Missing backlog items');
      break;
      
    case 'news':
      if (!data.articles && !data.news && !Array.isArray(data)) issues.push('Missing news');
      break;
  }
  
  return {
    valid: issues.length === 0,
    issues
  };
}

// Test a single product
async function testProduct(product, testIndex) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Testing Product ${testIndex}/25: ${product.name}`);
  console.log(`Category: ${product.category} | Stage: ${product.stage}`);
  console.log(`Competitors: ${product.competitors}`);
  console.log('='.repeat(60));
  
  const productResult = {
    id: product.id,
    name: product.name,
    category: product.category,
    tests: {},
    passed: 0,
    failed: 0,
    totalResponseTime: 0
  };
  
  // Generate unique email for this test
  const testEmail = `test_${product.id}_${Date.now()}@validation.com`;
  const testPassword = 'TestPass123!';
  let authToken = null;
  
  // 1. Test Registration
  console.log('\n1. Testing Registration...');
  const registerResult = await makeRequest('/api/auth/register', 'POST', {
    email: testEmail,
    password: testPassword,
    name: `Test User ${product.id}`
  });
  
  productResult.tests.register = {
    success: registerResult.success || registerResult.status === 400, // 400 = already exists
    responseTime: registerResult.responseTime,
    status: registerResult.status
  };
  
  if (registerResult.success) {
    authToken = registerResult.data.token;
    console.log(`   ✅ Registration: ${registerResult.responseTime}ms`);
    productResult.passed++;
  } else if (registerResult.status === 400) {
    console.log(`   ⚠️ User exists, trying login: ${registerResult.responseTime}ms`);
    productResult.passed++;
  } else {
    console.log(`   ❌ Registration failed: ${registerResult.error || registerResult.data?.message}`);
    productResult.failed++;
  }
  productResult.totalResponseTime += registerResult.responseTime;
  
  // 2. Test Login
  console.log('2. Testing Login...');
  const loginResult = await makeRequest('/api/auth/login', 'POST', {
    email: testEmail,
    password: testPassword
  });
  
  productResult.tests.login = {
    success: loginResult.success,
    responseTime: loginResult.responseTime,
    status: loginResult.status
  };
  
  if (loginResult.success) {
    authToken = loginResult.data.token;
    console.log(`   ✅ Login: ${loginResult.responseTime}ms`);
    productResult.passed++;
  } else {
    console.log(`   ❌ Login failed: ${loginResult.error || loginResult.data?.message}`);
    productResult.failed++;
  }
  productResult.totalResponseTime += loginResult.responseTime;
  
  // Build DDQ data for this product
  const ddqData = {
    responses: {
      0: product.name, // Product name
      1: product.description, // Description
      2: 'B2C', // Target market
      3: product.category, // Category
      4: product.state, // State
      5: product.stage, // Stage
      6: product.competitors, // Competitors
      7: '2023', // Founded year
      8: '3', // Team size
      9: 'Founder', // Role
      10: 'Revenue', // Business model
      11: 'Subscription', // Revenue model
      12: '10', // Team size
      13: String(product.revenue / 12), // Monthly revenue
      14: '20', // Growth rate
      15: String(product.customers), // Customers
      16: '500000', // Funding needed
      17: 'Growth', // Use of funds
      18: '5', // Runway months
      19: 'Market leadership' // Vision
    }
  };
  
  // 3. Test DDQ Save
  console.log('3. Testing DDQ Save...');
  const ddqSaveResult = await makeRequest('/api/ddq/save', 'POST', ddqData, authToken);
  
  productResult.tests.ddqSave = {
    success: ddqSaveResult.success,
    responseTime: ddqSaveResult.responseTime,
    status: ddqSaveResult.status
  };
  
  if (ddqSaveResult.success) {
    console.log(`   ✅ DDQ Save: ${ddqSaveResult.responseTime}ms`);
    productResult.passed++;
  } else {
    console.log(`   ❌ DDQ Save failed: ${ddqSaveResult.error || ddqSaveResult.data?.message}`);
    productResult.failed++;
  }
  productResult.totalResponseTime += ddqSaveResult.responseTime;
  
  // 4. Test Valuation
  console.log('4. Testing Valuation Analysis...');
  const valuationResult = await makeRequest('/api/analysis/valuation', 'POST', {
    ddqResponses: ddqData.responses,
    productName: product.name,
    category: product.category,
    stage: product.stage,
    revenue: product.revenue,
    customers: product.customers
  }, authToken);
  
  const valuationValidation = validateData(valuationResult.data, 'valuation', product);
  productResult.tests.valuation = {
    success: valuationResult.success && valuationValidation.valid,
    responseTime: valuationResult.responseTime,
    status: valuationResult.status,
    dataValidation: valuationValidation
  };
  
  if (valuationResult.success && valuationValidation.valid) {
    console.log(`   ✅ Valuation: ${valuationResult.responseTime}ms | Value: ₹${(valuationResult.data?.currentValuation || 0).toLocaleString()}`);
    productResult.passed++;
  } else {
    console.log(`   ❌ Valuation failed: ${valuationValidation.issues.join(', ') || valuationResult.error}`);
    productResult.failed++;
  }
  productResult.totalResponseTime += valuationResult.responseTime;
  
  // 5. Test Competitors
  console.log('5. Testing Competitor Analysis...');
  const competitorResult = await makeRequest('/api/analysis/competitors', 'POST', {
    ddqResponses: ddqData.responses,
    category: product.category,
    userMentionedCompetitors: product.competitors,
    stage: product.stage,
    revenue: product.revenue
  }, authToken);
  
  const competitorData = competitorResult.data?.competitors || competitorResult.data || [];
  const competitorValidation = validateData(competitorData, 'competitors', product);
  productResult.tests.competitors = {
    success: competitorResult.success,
    responseTime: competitorResult.responseTime,
    status: competitorResult.status,
    dataValidation: competitorValidation,
    competitorsFound: Array.isArray(competitorData) ? competitorData.length : (competitorData.length || 0)
  };
  
  if (competitorResult.success) {
    const compList = Array.isArray(competitorData) ? competitorData : [];
    console.log(`   ✅ Competitors: ${competitorResult.responseTime}ms | Found: ${compList.length} competitors`);
    if (compList.length > 0) {
      console.log(`      Names: ${compList.slice(0, 5).map(c => c.name).join(', ')}${compList.length > 5 ? '...' : ''}`);
    }
    if (competitorValidation.issues.length > 0) {
      console.log(`      ⚠️ Data issues: ${competitorValidation.issues.join(', ')}`);
    }
    productResult.passed++;
  } else {
    console.log(`   ❌ Competitors failed: ${competitorResult.error || competitorResult.data?.message}`);
    productResult.failed++;
  }
  productResult.totalResponseTime += competitorResult.responseTime;
  
  // 6. Test Introspection
  console.log('6. Testing Introspection Analysis...');
  const introspectionResult = await makeRequest('/api/analysis/introspection', 'POST', {
    ddqResponses: ddqData.responses,
    productName: product.name,
    category: product.category
  }, authToken);
  
  productResult.tests.introspection = {
    success: introspectionResult.success,
    responseTime: introspectionResult.responseTime,
    status: introspectionResult.status
  };
  
  if (introspectionResult.success) {
    console.log(`   ✅ Introspection: ${introspectionResult.responseTime}ms`);
    productResult.passed++;
  } else {
    console.log(`   ❌ Introspection failed: ${introspectionResult.error || introspectionResult.data?.message}`);
    productResult.failed++;
  }
  productResult.totalResponseTime += introspectionResult.responseTime;
  
  // 7. Test VRIO
  console.log('7. Testing VRIO Analysis...');
  const vrioResult = await makeRequest('/api/analysis/vrio', 'POST', {
    ddqResponses: ddqData.responses,
    productName: product.name,
    category: product.category
  }, authToken);
  
  productResult.tests.vrio = {
    success: vrioResult.success,
    responseTime: vrioResult.responseTime,
    status: vrioResult.status
  };
  
  if (vrioResult.success) {
    console.log(`   ✅ VRIO: ${vrioResult.responseTime}ms`);
    productResult.passed++;
  } else {
    console.log(`   ❌ VRIO failed: ${vrioResult.error || vrioResult.data?.message}`);
    productResult.failed++;
  }
  productResult.totalResponseTime += vrioResult.responseTime;
  
  // 8. Test Porter's Five Forces
  console.log("8. Testing Porter's Five Forces...");
  const porterResult = await makeRequest('/api/analysis/porter', 'POST', {
    ddqResponses: ddqData.responses,
    productName: product.name,
    category: product.category
  }, authToken);
  
  productResult.tests.porter = {
    success: porterResult.success,
    responseTime: porterResult.responseTime,
    status: porterResult.status
  };
  
  if (porterResult.success) {
    console.log(`   ✅ Porter: ${porterResult.responseTime}ms`);
    productResult.passed++;
  } else {
    console.log(`   ❌ Porter failed: ${porterResult.error || porterResult.data?.message}`);
    productResult.failed++;
  }
  productResult.totalResponseTime += porterResult.responseTime;
  
  // 9. Test Product Insight
  console.log('9. Testing Product Insight...');
  const productInsightResult = await makeRequest('/api/analysis/product-insight', 'POST', {
    ddqResponses: ddqData.responses,
    productName: product.name,
    category: product.category
  }, authToken);
  
  productResult.tests.productInsight = {
    success: productInsightResult.success,
    responseTime: productInsightResult.responseTime,
    status: productInsightResult.status
  };
  
  if (productInsightResult.success) {
    console.log(`   ✅ Product Insight: ${productInsightResult.responseTime}ms`);
    productResult.passed++;
  } else {
    console.log(`   ❌ Product Insight failed: ${productInsightResult.error || productInsightResult.data?.message}`);
    productResult.failed++;
  }
  productResult.totalResponseTime += productInsightResult.responseTime;
  
  // 10. Test Daily Actions
  console.log('10. Testing Daily Actions...');
  const dailyActionsResult = await makeRequest('/api/analysis/daily-actions', 'POST', {
    ddqResponses: ddqData.responses,
    productName: product.name,
    category: product.category,
    stage: product.stage
  }, authToken);
  
  productResult.tests.dailyActions = {
    success: dailyActionsResult.success,
    responseTime: dailyActionsResult.responseTime,
    status: dailyActionsResult.status
  };
  
  if (dailyActionsResult.success) {
    console.log(`   ✅ Daily Actions: ${dailyActionsResult.responseTime}ms`);
    productResult.passed++;
  } else {
    console.log(`   ❌ Daily Actions failed: ${dailyActionsResult.error || dailyActionsResult.data?.message}`);
    productResult.failed++;
  }
  productResult.totalResponseTime += dailyActionsResult.responseTime;
  
  // 11. Test Backlog
  console.log('11. Testing Backlog...');
  const backlogResult = await makeRequest('/api/analysis/backlog', 'POST', {
    ddqResponses: ddqData.responses,
    productName: product.name,
    category: product.category,
    stage: product.stage
  }, authToken);
  
  productResult.tests.backlog = {
    success: backlogResult.success,
    responseTime: backlogResult.responseTime,
    status: backlogResult.status
  };
  
  if (backlogResult.success) {
    console.log(`   ✅ Backlog: ${backlogResult.responseTime}ms`);
    productResult.passed++;
  } else {
    console.log(`   ❌ Backlog failed: ${backlogResult.error || backlogResult.data?.message}`);
    productResult.failed++;
  }
  productResult.totalResponseTime += backlogResult.responseTime;
  
  // 12. Test News
  console.log('12. Testing News...');
  const newsResult = await makeRequest('/api/analysis/news', 'POST', {
    ddqResponses: ddqData.responses,
    productName: product.name,
    category: product.category,
    competitors: product.competitors
  }, authToken);
  
  productResult.tests.news = {
    success: newsResult.success,
    responseTime: newsResult.responseTime,
    status: newsResult.status
  };
  
  if (newsResult.success) {
    console.log(`   ✅ News: ${newsResult.responseTime}ms`);
    productResult.passed++;
  } else {
    console.log(`   ❌ News failed: ${newsResult.error || newsResult.data?.message}`);
    productResult.failed++;
  }
  productResult.totalResponseTime += newsResult.responseTime;
  
  // 13. Test Chat (Daddy AI)
  console.log('13. Testing Chat (Daddy AI)...');
  const chatResult = await makeRequest('/api/chat', 'POST', {
    message: `What are the key challenges for a ${product.category} business like ${product.name} in ${product.state}?`,
    ddqResponses: ddqData.responses,
    context: {
      productName: product.name,
      category: product.category,
      stage: product.stage
    }
  }, authToken);
  
  productResult.tests.chat = {
    success: chatResult.success,
    responseTime: chatResult.responseTime,
    status: chatResult.status
  };
  
  if (chatResult.success) {
    console.log(`   ✅ Chat: ${chatResult.responseTime}ms`);
    productResult.passed++;
  } else {
    console.log(`   ❌ Chat failed: ${chatResult.error || chatResult.data?.message}`);
    productResult.failed++;
  }
  productResult.totalResponseTime += chatResult.responseTime;
  
  // Calculate product success rate
  const totalTests = productResult.passed + productResult.failed;
  productResult.successRate = totalTests > 0 ? ((productResult.passed / totalTests) * 100).toFixed(1) : 0;
  
  console.log(`\n📊 Product Summary: ${productResult.passed}/${totalTests} tests passed (${productResult.successRate}%)`);
  console.log(`⏱️  Total Response Time: ${productResult.totalResponseTime}ms`);
  
  return productResult;
}

// Main test runner
async function runValidation() {
  console.log('\n' + '█'.repeat(70));
  console.log('█  CEO INSIGHT ENGINE - SYSTEM VALIDATION & PERFORMANCE TEST');
  console.log('█  Testing 25 Products Across Diverse Industries');
  console.log('█  Including: Construction, Real Estate, Manufacturing, Agriculture');
  console.log('█'.repeat(70));
  
  const startTime = Date.now();
  
  // Test each product
  for (let i = 0; i < TEST_PRODUCTS.length; i++) {
    try {
      const result = await testProduct(TEST_PRODUCTS[i], i + 1);
      testResults.products.push(result);
      testResults.summary.totalTests += result.passed + result.failed;
      testResults.summary.passed += result.passed;
      testResults.summary.failed += result.failed;
    } catch (error) {
      console.log(`\n❌ CRITICAL ERROR testing ${TEST_PRODUCTS[i].name}: ${error.message}`);
      testResults.products.push({
        id: TEST_PRODUCTS[i].id,
        name: TEST_PRODUCTS[i].name,
        category: TEST_PRODUCTS[i].category,
        error: error.message,
        passed: 0,
        failed: 13 // All tests failed
      });
      testResults.summary.totalTests += 13;
      testResults.summary.failed += 13;
    }
    
    // Small delay between products to avoid overwhelming the server
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  const totalTime = Date.now() - startTime;
  
  // Calculate final statistics
  testResults.summary.successRate = ((testResults.summary.passed / testResults.summary.totalTests) * 100).toFixed(2);
  
  // Print Final Report
  console.log('\n\n' + '═'.repeat(70));
  console.log('                    FINAL VALIDATION REPORT');
  console.log('═'.repeat(70));
  
  // 90th Percentile Response Times
  console.log('\n📈 90th PERCENTILE RESPONSE TIMES (milliseconds):');
  console.log('-'.repeat(50));
  
  const endpoints = [
    { name: 'Registration', key: '/api/auth/register' },
    { name: 'Login', key: '/api/auth/login' },
    { name: 'DDQ Save', key: '/api/ddq/save' },
    { name: 'Valuation', key: '/api/analysis/valuation' },
    { name: 'Competitors', key: '/api/analysis/competitors' },
    { name: 'Introspection', key: '/api/analysis/introspection' },
    { name: 'VRIO', key: '/api/analysis/vrio' },
    { name: 'Porter', key: '/api/analysis/porter' },
    { name: 'Product Insight', key: '/api/analysis/product-insight' },
    { name: 'Daily Actions', key: '/api/analysis/daily-actions' },
    { name: 'Backlog', key: '/api/analysis/backlog' },
    { name: 'News', key: '/api/analysis/news' },
    { name: 'Chat (Daddy AI)', key: '/api/chat' }
  ];
  
  const percentileResults = [];
  
  for (const endpoint of endpoints) {
    const times = responseTimes[endpoint.key] || [];
    if (times.length > 0) {
      const p50 = calculatePercentile(times, 50);
      const p90 = calculatePercentile(times, 90);
      const p99 = calculatePercentile(times, 99);
      const avg = Math.round(times.reduce((a, b) => a + b, 0) / times.length);
      const min = Math.min(...times);
      const max = Math.max(...times);
      
      percentileResults.push({
        name: endpoint.name,
        p50, p90, p99, avg, min, max,
        samples: times.length
      });
      
      console.log(`\n${endpoint.name}:`);
      console.log(`   P50: ${p50}ms | P90: ${p90}ms | P99: ${p99}ms`);
      console.log(`   Avg: ${avg}ms | Min: ${min}ms | Max: ${max}ms | Samples: ${times.length}`);
    }
  }
  
  // Category-wise Results
  console.log('\n\n📊 RESULTS BY CATEGORY:');
  console.log('-'.repeat(60));
  
  const categoryResults = {};
  for (const product of testResults.products) {
    if (!categoryResults[product.category]) {
      categoryResults[product.category] = { passed: 0, failed: 0, products: [] };
    }
    categoryResults[product.category].passed += product.passed;
    categoryResults[product.category].failed += product.failed;
    categoryResults[product.category].products.push(product.name);
  }
  
  for (const [category, results] of Object.entries(categoryResults)) {
    const total = results.passed + results.failed;
    const rate = ((results.passed / total) * 100).toFixed(1);
    const status = rate >= 80 ? '✅' : rate >= 50 ? '⚠️' : '❌';
    console.log(`\n${status} ${category}:`);
    console.log(`   Success Rate: ${rate}% (${results.passed}/${total} tests)`);
    console.log(`   Products: ${results.products.join(', ')}`);
  }
  
  // Construction & Real Estate Specific
  console.log('\n\n🏗️  CONSTRUCTION & REAL ESTATE (NON-TECH) FOCUS:');
  console.log('-'.repeat(60));
  
  const nonTechCategories = ['Construction', 'Real Estate', 'Manufacturing', 'Agriculture', 'Food & Beverage'];
  let nonTechPassed = 0;
  let nonTechTotal = 0;
  
  for (const product of testResults.products) {
    if (nonTechCategories.includes(product.category)) {
      nonTechPassed += product.passed;
      nonTechTotal += product.passed + product.failed;
      console.log(`\n${product.name} (${product.category}):`);
      console.log(`   Tests: ${product.passed}/${product.passed + product.failed} passed`);
      console.log(`   Success Rate: ${product.successRate}%`);
    }
  }
  
  const nonTechRate = nonTechTotal > 0 ? ((nonTechPassed / nonTechTotal) * 100).toFixed(1) : 0;
  console.log(`\n📈 Non-Tech Industries Overall: ${nonTechRate}% success rate`);
  
  // Overall Summary
  console.log('\n\n' + '═'.repeat(70));
  console.log('                       OVERALL SUMMARY');
  console.log('═'.repeat(70));
  console.log(`\n✅ Total Tests Passed: ${testResults.summary.passed}`);
  console.log(`❌ Total Tests Failed: ${testResults.summary.failed}`);
  console.log(`📊 Overall Success Rate: ${testResults.summary.successRate}%`);
  console.log(`⏱️  Total Test Duration: ${(totalTime / 1000).toFixed(1)} seconds`);
  console.log(`🏢 Products Tested: ${testResults.products.length}`);
  
  // Performance Summary Table
  console.log('\n\n📋 PERFORMANCE SUMMARY TABLE (90th Percentile):');
  console.log('-'.repeat(70));
  console.log('| Endpoint                | P90 (ms) | Status              |');
  console.log('|-------------------------|----------|---------------------|');
  
  for (const result of percentileResults) {
    const status = result.p90 < 1000 ? '✅ Excellent' : 
                   result.p90 < 3000 ? '✅ Good' : 
                   result.p90 < 5000 ? '⚠️ Acceptable' : '❌ Slow';
    console.log(`| ${result.name.padEnd(23)} | ${String(result.p90).padStart(8)} | ${status.padEnd(19)} |`);
  }
  console.log('-'.repeat(70));
  
  // Final Verdict
  console.log('\n\n🎯 FINAL VERDICT:');
  console.log('═'.repeat(70));
  
  const overallRate = parseFloat(testResults.summary.successRate);
  if (overallRate >= 90) {
    console.log('🌟 EXCELLENT - System is production-ready with high reliability');
  } else if (overallRate >= 75) {
    console.log('✅ GOOD - System is functional with minor issues');
  } else if (overallRate >= 50) {
    console.log('⚠️ NEEDS IMPROVEMENT - Several components need attention');
  } else {
    console.log('❌ CRITICAL - Major issues detected, not ready for production');
  }
  
  console.log('\n' + '█'.repeat(70));
  console.log('█                    VALIDATION COMPLETE');
  console.log('█'.repeat(70) + '\n');
  
  return testResults;
}

// Run the validation
runValidation().catch(console.error);
