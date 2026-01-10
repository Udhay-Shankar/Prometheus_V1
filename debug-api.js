// Debug test to see actual API responses
const API_BASE = 'https://prometheus-v1.onrender.com';

async function debugTest() {
  console.log('🔍 DEBUG: Checking actual API response structures\n');
  
  // 1. Sign up and get token
  console.log('1. Getting auth token...');
  const authRes = await fetch(`${API_BASE}/api/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: `debug_${Date.now()}@test.com`,
      password: 'Test123!@#',
      name: 'Debug User',
      companyName: 'DebugCo'
    })
  });
  const authData = await authRes.json();
  const token = authData.accessToken;
  console.log('   Token obtained:', token ? 'YES' : 'NO');
  
  // 2. Save DDQ
  console.log('\n2. Saving DDQ...');
  const ddq = {
    1: "TestProduct",
    2: "A test product for debugging",
    3: ["SaaS"],
    4: "Mumbai",
    5: "MVP"
  };
  await fetch(`${API_BASE}/api/ddq/save`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ responses: ddq, completed: true })
  });
  console.log('   DDQ saved');
  
  // 3. Check NEWS response structure
  console.log('\n3. NEWS API Response:');
  const newsRes = await fetch(`${API_BASE}/api/news`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const newsData = await newsRes.json();
  console.log('   Status:', newsRes.status);
  console.log('   Keys:', Object.keys(newsData));
  console.log('   Full response:', JSON.stringify(newsData).slice(0, 500));
  
  // Wait to avoid rate limit
  await new Promise(r => setTimeout(r, 3000));
  
  // 4. Check CHAT response structure
  console.log('\n4. CHAT API Response:');
  const chatRes = await fetch(`${API_BASE}/api/chat/grok`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      message: 'What should I focus on for TestProduct?',
      ddqResponses: ddq
    })
  });
  const chatData = await chatRes.json();
  console.log('   Status:', chatRes.status);
  console.log('   Keys:', Object.keys(chatData));
  console.log('   Response preview:', chatData.response?.slice(0, 300) || JSON.stringify(chatData).slice(0, 300));
  
  // Wait
  await new Promise(r => setTimeout(r, 3000));
  
  // 5. Check GTM response structure
  console.log('\n5. GTM API Response:');
  const gtmRes = await fetch(`${API_BASE}/api/gtm/generate`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      ddqResponses: ddq,
      valuation: { estimatedValuation: 10000000 }
    })
  });
  const gtmData = await gtmRes.json();
  console.log('   Status:', gtmRes.status);
  console.log('   Top-level Keys:', Object.keys(gtmData));
  if (gtmData.strategy) {
    console.log('   Strategy Keys:', Object.keys(gtmData.strategy));
  }
  console.log('   Sample:', JSON.stringify(gtmData).slice(0, 800));
  
  // Wait
  await new Promise(r => setTimeout(r, 3000));
  
  // 6. Check SIMULATION response structure
  console.log('\n6. SIMULATION API Response:');
  const simRes = await fetch(`${API_BASE}/api/simulation/run`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      decision: 'We are considering raising prices by 20% for TestProduct to improve unit economics.',
      timeframe: '6 months'
    })
  });
  const simData = await simRes.json();
  console.log('   Status:', simRes.status);
  console.log('   Keys:', Object.keys(simData));
  console.log('   Sample:', JSON.stringify(simData).slice(0, 500));
  
  // Wait
  await new Promise(r => setTimeout(r, 3000));
  
  // 7. Check COMPETITORS response structure
  console.log('\n7. COMPETITORS API Response:');
  const compRes = await fetch(`${API_BASE}/api/analysis/competitors`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ ddqResponses: ddq })
  });
  const compData = await compRes.json();
  console.log('   Status:', compRes.status);
  console.log('   Keys:', Object.keys(compData));
  console.log('   Sample:', JSON.stringify(compData).slice(0, 500));
  
  console.log('\n✅ Debug complete');
}

debugTest().catch(console.error);
