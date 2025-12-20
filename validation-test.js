/**
 * CEO Insight Engine - System Validation (Sequential with Delays)
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

// Response time tracking per endpoint
const responseTimes = {};
const testResults = { products: [], summary: { totalTests: 0, passed: 0, failed: 0 } };

// Helper function to make HTTP requests
async function makeRequest(endpoint, method = 'GET', body = null, token = null) {
  const startTime = Date.now();
  
  try {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    
    const options = { method, headers };
    if (body && (method === 'POST' || method === 'PUT')) {
      options.body = JSON.stringify(body);
    }
    
    const response = await fetch(`${BASE_URL}${endpoint}`, options);
    const responseTime = Date.now() - startTime;
    
    if (!responseTimes[endpoint]) responseTimes[endpoint] = [];
    responseTimes[endpoint].push(responseTime);
    
    let data;
    try { data = await response.json(); } catch { data = null; }
    
    return { success: response.ok, status: response.status, data, responseTime, error: null };
  } catch (error) {
    return { success: false, status: 0, data: null, responseTime: Date.now() - startTime, error: error.message };
  }
}

// Delay helper
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Calculate percentile
function calculatePercentile(arr, percentile) {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const index = Math.ceil((percentile / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

// Test a single product
async function testProduct(product, testIndex) {
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`🏢 Product ${testIndex}/25: ${product.name}`);
  console.log(`   Category: ${product.category} | Stage: ${product.stage}`);
  console.log(`   Competitors: ${product.competitors}`);
  
  const result = { name: product.name, category: product.category, tests: {}, passed: 0, failed: 0, totalTime: 0 };
  const testEmail = `test_${product.id}_${Date.now()}@test.com`;
  let token = null;
  
  // Build DDQ data
  const ddqData = {
    responses: {
      0: product.name, 1: product.description, 2: 'B2C', 3: product.category,
      4: product.state, 5: product.stage, 6: product.competitors, 7: '2023',
      8: '3', 9: 'Founder', 10: 'Revenue', 11: 'Subscription', 12: '10',
      13: String(product.revenue / 12), 14: '20', 15: String(product.customers),
      16: '500000', 17: 'Growth', 18: '5', 19: 'Market leadership'
    }
  };

  // Test functions using actual API endpoints
  const tests = [
    { name: 'Signup', fn: () => makeRequest('/api/auth/signup', 'POST', { email: testEmail, password: 'Test@123!', name: `Test User ${product.id}`, companyName: product.name }) },
    { name: 'DDQ Save', fn: () => makeRequest('/api/ddq/save', 'POST', ddqData, token), needsToken: true },
    { name: 'DDQ Get', fn: () => makeRequest('/api/ddq/latest', 'GET', null, token), needsToken: true },
    { name: 'Valuation', fn: () => makeRequest('/api/valuation/calculate', 'POST', { ddqResponses: ddqData.responses, productName: product.name, category: product.category, stage: product.stage, revenue: product.revenue }, token), needsToken: true },
    { name: 'SWOT', fn: () => makeRequest('/api/analysis/swot', 'POST', { ddqResponses: ddqData.responses, productName: product.name, category: product.category }, token), needsToken: true },
    { name: 'Funding', fn: () => makeRequest('/api/analysis/funding-schemes', 'POST', { ddqResponses: ddqData.responses, category: product.category, stage: product.stage, state: product.state, totalInvestment: product.revenue || 100000, hasRevenue: product.revenue > 0 }, token), needsToken: true },
    { name: 'Competitors', fn: () => makeRequest('/api/analysis/competitors', 'POST', { ddqResponses: ddqData.responses, category: product.category, userMentionedCompetitors: product.competitors, stage: product.stage, revenue: product.revenue }, token), needsToken: true },
    { name: 'Actions Gen', fn: () => makeRequest('/api/actions/generate', 'POST', { ddqResponses: ddqData.responses, productName: product.name, stage: product.stage }, token), needsToken: true },
    { name: 'Actions Today', fn: () => makeRequest('/api/actions/today', 'GET', null, token), needsToken: true },
    { name: 'Chat Grok', fn: () => makeRequest('/api/chat/grok', 'POST', { message: `What challenges for ${product.category}?`, ddqResponses: ddqData.responses }, token), needsToken: true },
    { name: 'Notes Get', fn: () => makeRequest('/api/notes', 'GET', null, token), needsToken: true }
  ];

  for (const test of tests) {
    if (test.needsToken && !token) {
      result.tests[test.name] = { success: false, skipped: true };
      result.failed++;
      continue;
    }
    
    const res = await test.fn();
    result.totalTime += res.responseTime;
    
    // Store token from signup (API returns accessToken, not token)
    if (test.name === 'Signup' && res.success && (res.data?.accessToken || res.data?.token)) {
      token = res.data.accessToken || res.data.token;
    }
    
    // Also count Login success if we got token from signup
    const success = res.success || (test.name === 'Signup' && res.status === 409);
    result.tests[test.name] = { success, responseTime: res.responseTime, status: res.status };
    
    if (success) {
      result.passed++;
      process.stdout.write(`   ✅ ${test.name}: ${res.responseTime}ms`);
      if (test.name === 'Competitors' && res.data) {
        const comps = res.data?.competitors || res.data || [];
        const names = Array.isArray(comps) ? comps.map(c => c.name).slice(0, 3).join(', ') : '';
        if (names) process.stdout.write(` [${names}]`);
      }
      console.log('');
    } else {
      result.failed++;
      console.log(`   ❌ ${test.name}: ${res.error || res.data?.message || `Status ${res.status}`}`);
    }
    
    await delay(100); // Small delay between tests
  }
  
  const total = result.passed + result.failed;
  result.successRate = total > 0 ? ((result.passed / total) * 100).toFixed(1) : 0;
  console.log(`   📊 Summary: ${result.passed}/${total} (${result.successRate}%) | ${result.totalTime}ms total`);
  
  return result;
}

// Main
async function main() {
  console.log('\n' + '█'.repeat(70));
  console.log('█  CEO INSIGHT ENGINE - SYSTEM VALIDATION');
  console.log('█  Testing 25 Products Across Diverse Industries');
  console.log('█  Including: Construction, Real Estate, Manufacturing, Agriculture');
  console.log('█'.repeat(70));
  
  const startTime = Date.now();
  
  for (let i = 0; i < TEST_PRODUCTS.length; i++) {
    const result = await testProduct(TEST_PRODUCTS[i], i + 1);
    testResults.products.push(result);
    testResults.summary.passed += result.passed;
    testResults.summary.failed += result.failed;
    testResults.summary.totalTests += result.passed + result.failed;
    await delay(500); // Delay between products
  }
  
  const totalTime = Date.now() - startTime;
  testResults.summary.successRate = ((testResults.summary.passed / testResults.summary.totalTests) * 100).toFixed(2);
  
  // Print Final Report
  console.log('\n\n' + '═'.repeat(70));
  console.log('                    FINAL VALIDATION REPORT');
  console.log('═'.repeat(70));
  
  // 90th Percentile Response Times
  console.log('\n📈 90th PERCENTILE RESPONSE TIMES:');
  console.log('─'.repeat(60));
  console.log('| Endpoint              | P50 (ms) | P90 (ms) | P99 (ms) | Avg (ms) |');
  console.log('|─────────────────────--|----------|----------|----------|----------|');
  
  for (const [endpoint, times] of Object.entries(responseTimes)) {
    if (times.length > 0) {
      const name = endpoint.replace('/api/', '').replace('/analysis/', '').slice(0, 20);
      const p50 = calculatePercentile(times, 50);
      const p90 = calculatePercentile(times, 90);
      const p99 = calculatePercentile(times, 99);
      const avg = Math.round(times.reduce((a, b) => a + b, 0) / times.length);
      console.log(`| ${name.padEnd(21)} | ${String(p50).padStart(8)} | ${String(p90).padStart(8)} | ${String(p99).padStart(8)} | ${String(avg).padStart(8)} |`);
    }
  }
  
  // Category Results
  console.log('\n\n📊 RESULTS BY CATEGORY:');
  console.log('─'.repeat(60));
  
  const categoryResults = {};
  for (const p of testResults.products) {
    if (!categoryResults[p.category]) categoryResults[p.category] = { passed: 0, failed: 0, products: [] };
    categoryResults[p.category].passed += p.passed;
    categoryResults[p.category].failed += p.failed;
    categoryResults[p.category].products.push({ name: p.name, rate: p.successRate });
  }
  
  for (const [cat, data] of Object.entries(categoryResults)) {
    const total = data.passed + data.failed;
    const rate = ((data.passed / total) * 100).toFixed(1);
    const icon = rate >= 80 ? '✅' : rate >= 50 ? '⚠️' : '❌';
    console.log(`\n${icon} ${cat}: ${rate}% success (${data.passed}/${total})`);
    for (const p of data.products) {
      console.log(`   • ${p.name}: ${p.rate}%`);
    }
  }
  
  // Non-Tech Focus
  console.log('\n\n🏗️  CONSTRUCTION & REAL ESTATE (NON-TECH) FOCUS:');
  console.log('─'.repeat(60));
  
  const nonTech = ['Construction', 'Real Estate', 'Manufacturing', 'Agriculture', 'Food & Beverage'];
  let nonTechPassed = 0, nonTechTotal = 0;
  
  for (const p of testResults.products) {
    if (nonTech.includes(p.category)) {
      nonTechPassed += p.passed;
      nonTechTotal += p.passed + p.failed;
      console.log(`• ${p.name} (${p.category}): ${p.successRate}%`);
    }
  }
  
  console.log(`\n📈 Non-Tech Overall: ${((nonTechPassed / nonTechTotal) * 100).toFixed(1)}%`);
  
  // Overall Summary
  console.log('\n\n' + '═'.repeat(70));
  console.log('                       OVERALL SUMMARY');
  console.log('═'.repeat(70));
  console.log(`\n✅ Passed: ${testResults.summary.passed}`);
  console.log(`❌ Failed: ${testResults.summary.failed}`);
  console.log(`📊 Success Rate: ${testResults.summary.successRate}%`);
  console.log(`⏱️  Duration: ${(totalTime / 1000).toFixed(1)}s`);
  console.log(`🏢 Products: ${testResults.products.length}`);
  
  const rate = parseFloat(testResults.summary.successRate);
  console.log(`\n🎯 VERDICT: ${rate >= 90 ? '🌟 EXCELLENT' : rate >= 75 ? '✅ GOOD' : rate >= 50 ? '⚠️ NEEDS WORK' : '❌ CRITICAL'}`);
  
  console.log('\n' + '█'.repeat(70) + '\n');
}

main().catch(console.error);
