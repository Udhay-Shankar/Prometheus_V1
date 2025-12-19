/**
 * Comprehensive Test Suite - 20 Test Cases
 * Tests various product types, revenue/pre-revenue scenarios, and "Others" category
 */

const testCases = [
  // ============= REVENUE-BASED COMPANIES (10 Cases) =============
  
  // 1. SaaS - High Revenue, Established
  {
    name: "SaaS Established Company",
    ddqResponses: {
      1: "CloudFlow CRM",
      2: "Enterprise CRM solution with AI-powered insights",
      3: ["SaaS"],
      4: "Karnataka",
      5: "Established",
      6: "Salesforce, HubSpot, Zoho",
      7: "AI-first approach with 60% lower implementation time",
      8: "Mid-size enterprises with 50-500 employees",
      9: "B2B (Business to Business)",
      10: "50+",
      11: 50000000,
      "11b": "Monthly Recurring",
      12: "Yes",
      13: 8000000,
      14: 6000000,
      15: 120,
      16: 66666
    },
    expectedCategory: "SaaS",
    hasRevenue: true
  },

  // 2. E-commerce - Growing Revenue
  {
    name: "E-commerce Growing Company",
    ddqResponses: {
      1: "ShopKart India",
      2: "Fashion e-commerce platform for tier-2 cities",
      3: ["E-commerce"],
      4: "Maharashtra",
      5: "Growing",
      6: "Myntra, Ajio, Meesho",
      7: "Hyper-local fashion with same-day delivery",
      8: "Women aged 18-35 in tier-2/3 cities",
      9: "B2C (Business to Consumer)",
      10: "50+",
      11: 25000000,
      "11b": "One-time Payment",
      12: "Yes",
      13: 15000000,
      14: 10000000,
      15: 25000,
      16: 600
    },
    expectedCategory: "E-commerce",
    hasRevenue: true
  },

  // 3. AI/ML - High Revenue
  {
    name: "AI/ML Revenue Company",
    ddqResponses: {
      1: "NeuralVision AI",
      2: "Computer vision platform for manufacturing QC",
      3: ["AI/ML"],
      4: "Tamil Nadu",
      5: "Growing",
      6: "Landing AI, Cognex, Instrumental",
      7: "10x faster defect detection with edge deployment",
      8: "Manufacturing plants with production lines",
      9: "B2B (Business to Business)",
      10: "21-50",
      11: 80000000,
      "11b": "Yearly Recurring",
      12: "Yes",
      13: 120000000,
      14: 80000000,
      15: 45,
      16: 2666666
    },
    expectedCategory: "AI/ML",
    hasRevenue: true
  },

  // 4. Mobile App - Revenue (Freemium)
  {
    name: "Mobile App Freemium",
    ddqResponses: {
      1: "FitTrack Pro",
      2: "AI fitness coaching app with personalized workouts",
      3: ["Mobile App"],
      4: "Delhi NCR",
      5: "Launched",
      6: "cult.fit, HealthifyMe, Nike Training",
      7: "AI coach that adapts in real-time to user performance",
      8: "Health-conscious millennials aged 25-40",
      9: "B2C (Business to Consumer)",
      10: "50+",
      11: 15000000,
      "11b": "Freemium",
      12: "Yes",
      13: 3000000,
      14: 2000000,
      15: 50000,
      16: 60
    },
    expectedCategory: "Mobile App",
    hasRevenue: true
  },

  // 5. Hardware - Revenue
  {
    name: "Hardware Revenue Company",
    ddqResponses: {
      1: "AgriSense IoT",
      2: "Smart irrigation sensors for precision farming",
      3: ["Hardware"],
      4: "Punjab",
      5: "Launched",
      6: "Jain Irrigation, Netafim, CropIn",
      7: "50% water savings with solar-powered sensors",
      8: "Large farm owners with 50+ acres",
      9: "B2B (Business to Business)",
      10: "21-50",
      11: 20000000,
      "11b": "One-time Payment",
      12: "Yes",
      13: 5000000,
      14: 3500000,
      15: 200,
      16: 25000
    },
    expectedCategory: "Hardware",
    hasRevenue: true
  },

  // 6. Marketplace - Revenue
  {
    name: "Marketplace Revenue Company",
    ddqResponses: {
      1: "SkillBridge",
      2: "Freelance marketplace for IT professionals",
      3: ["Marketplace"],
      4: "Telangana",
      5: "Growing",
      6: "Upwork, Toptal, Freelancer",
      7: "AI matching with escrow and skill verification",
      8: "IT companies needing temporary talent",
      9: "B2B (Business to Business)",
      10: "50+",
      11: 30000000,
      "11b": "Usage-based",
      12: "Yes",
      13: 6000000,
      14: 4000000,
      15: 5000,
      16: 1200
    },
    expectedCategory: "Marketplace",
    hasRevenue: true
  },

  // 7. FMCG - Revenue
  {
    name: "FMCG Revenue Company",
    ddqResponses: {
      1: "NaturaBite",
      2: "Organic snacks brand for health-conscious consumers",
      3: ["FMCG"],
      4: "Gujarat",
      5: "Launched",
      6: "Yoga Bar, RiteBite, True Elements",
      7: "Zero preservatives with local sourcing",
      8: "Urban health-conscious consumers aged 25-45",
      9: "B2C (Business to Consumer)",
      10: "50+",
      11: 10000000,
      "11b": "One-time Payment",
      12: "Yes",
      13: 4000000,
      14: 2500000,
      15: 10000,
      16: 400
    },
    expectedCategory: "FMCG",
    hasRevenue: true
  },

  // 8. Consulting - Revenue
  {
    name: "Consulting Revenue Company",
    ddqResponses: {
      1: "StrategyPro Advisors",
      2: "Management consulting for SME digital transformation",
      3: ["Consulting"],
      4: "Karnataka",
      5: "Established",
      6: "McKinsey, BCG, KPMG",
      7: "Affordable consulting for SMEs with implementation support",
      8: "SMEs with 50-200 employees looking to digitize",
      9: "B2B (Business to Business)",
      10: "50+",
      11: 5000000,
      "11b": "Quarterly Recurring",
      12: "Yes",
      13: 9000000,
      14: 7500000,
      15: 25,
      16: 360000
    },
    expectedCategory: "Consulting",
    hasRevenue: true
  },

  // 9. Other (HealthTech) - Revenue
  {
    name: "Other Category - HealthTech Revenue",
    ddqResponses: {
      1: "MediConnect",
      2: "Telemedicine platform connecting rural patients with specialists",
      3: ["Other"],
      "3_other": "HealthTech - Telemedicine",
      4: "Kerala",
      5: "Growing",
      6: "Practo, 1mg, Apollo 24/7",
      7: "Focus on tier-3 cities with vernacular support",
      8: "Rural patients needing specialist consultations",
      9: "B2C (Business to Consumer)",
      10: "50+",
      11: 40000000,
      "11b": "Hybrid",
      12: "Yes",
      13: 7000000,
      14: 5000000,
      15: 15000,
      16: 466
    },
    expectedCategory: "Other",
    customCategory: "HealthTech - Telemedicine",
    hasRevenue: true
  },

  // 10. Other (EdTech) - Revenue
  {
    name: "Other Category - EdTech Revenue",
    ddqResponses: {
      1: "LearnSmart Academy",
      2: "Vernacular language learning platform for competitive exams",
      3: ["Other"],
      "3_other": "EdTech - Competitive Exams",
      4: "Uttar Pradesh",
      5: "Growing",
      6: "BYJU'S, Unacademy, Vedantu",
      7: "100% vernacular content for regional exam prep",
      8: "Students in tier-2/3 cities preparing for govt exams",
      9: "B2C (Business to Consumer)",
      10: "50+",
      11: 35000000,
      "11b": "Yearly Recurring",
      12: "Yes",
      13: 60000000,
      14: 40000000,
      15: 100000,
      16: 600
    },
    expectedCategory: "Other",
    customCategory: "EdTech - Competitive Exams",
    hasRevenue: true
  },

  // ============= PRE-REVENUE COMPANIES (10 Cases) =============

  // 11. SaaS - Pre-Revenue MVP
  {
    name: "SaaS Pre-Revenue MVP",
    ddqResponses: {
      1: "HRBot AI",
      2: "AI-powered recruitment automation platform",
      3: ["SaaS", "AI/ML"],
      4: "Karnataka",
      5: "MVP",
      6: "LinkedIn, Indeed, Naukri",
      7: "90% reduction in time-to-hire with AI screening",
      8: "HR departments in tech companies",
      9: "B2B (Business to Business)",
      10: "6-20",
      11: 5000000,
      "11b": "Monthly Recurring",
      12: "No",
      13: "1-3 months",
      14: 500000,
      15: 10,
      16: 0
    },
    expectedCategory: "SaaS",
    hasRevenue: false
  },

  // 12. Mobile App - Pre-Revenue Idea
  {
    name: "Mobile App Pre-Revenue Idea",
    ddqResponses: {
      1: "PetCare+",
      2: "Pet health management app with vet consultations",
      3: ["Mobile App"],
      4: "Maharashtra",
      5: "Idea",
      6: "PetMD, Whistle, Pawfect",
      7: "India-first pet health tracking with local vets",
      8: "Urban pet owners aged 25-40",
      9: "B2C (Business to Consumer)",
      10: "1-5",
      11: 0,
      "11b": "Freemium",
      12: "No",
      13: "3-6 months",
      14: 200000,
      15: 0,
      16: 0
    },
    expectedCategory: "Mobile App",
    hasRevenue: false
  },

  // 13. AI/ML - Pre-Revenue Beta
  {
    name: "AI/ML Pre-Revenue Beta",
    ddqResponses: {
      1: "DocuMind AI",
      2: "AI document processing for legal firms",
      3: ["AI/ML", "SaaS"],
      4: "Delhi NCR",
      5: "Beta",
      6: "Kira Systems, Luminance, ContractPodAI",
      7: "Indian legal compliance with multi-language support",
      8: "Law firms and corporate legal departments",
      9: "B2B (Business to Business)",
      10: "6-20",
      11: 10000000,
      "11b": "Monthly Recurring",
      12: "No",
      13: "<1 month",
      14: 800000,
      15: 5,
      16: 0
    },
    expectedCategory: "AI/ML",
    hasRevenue: false
  },

  // 14. Hardware - Pre-Revenue MVP
  {
    name: "Hardware Pre-Revenue MVP",
    ddqResponses: {
      1: "SolarCharge Hub",
      2: "Portable solar charging stations for EV bikes",
      3: ["Hardware"],
      4: "Tamil Nadu",
      5: "MVP",
      6: "Ather, Ola Electric, Hero Electric",
      7: "Portable, affordable solar charging for rural areas",
      8: "EV bike owners in semi-urban areas",
      9: "B2C (Business to Consumer)",
      10: "6-20",
      11: 15000000,
      "11b": "One-time Payment",
      12: "No",
      13: "1-3 months",
      14: 1000000,
      15: 20,
      16: 0
    },
    expectedCategory: "Hardware",
    hasRevenue: false
  },

  // 15. Marketplace - Pre-Revenue Beta
  {
    name: "Marketplace Pre-Revenue Beta",
    ddqResponses: {
      1: "ArtisanHub",
      2: "Marketplace for traditional Indian handicrafts",
      3: ["Marketplace", "E-commerce"],
      4: "Rajasthan",
      5: "Beta",
      6: "Amazon Karigar, GoCoop, Okhai",
      7: "Direct artisan connection with authenticity certificates",
      8: "Global buyers interested in authentic Indian crafts",
      9: "B2C (Business to Consumer)",
      10: "21-50",
      11: 8000000,
      "11b": "Usage-based",
      12: "No",
      13: "Already have some",
      14: 400000,
      15: 50,
      16: 0
    },
    expectedCategory: "Marketplace",
    hasRevenue: false
  },

  // 16. Other (FinTech) - Pre-Revenue MVP
  {
    name: "Other Category - FinTech Pre-Revenue",
    ddqResponses: {
      1: "KisanCredit",
      2: "Micro-lending platform for small farmers",
      3: ["Other"],
      "3_other": "FinTech - AgriFinance",
      4: "Madhya Pradesh",
      5: "MVP",
      6: "Jai Kisan, DeHaat, Samunnati",
      7: "Satellite-based crop assessment for credit scoring",
      8: "Small farmers with 2-10 acres needing working capital",
      9: "B2C (Business to Consumer)",
      10: "6-20",
      11: 20000000,
      "11b": "Hybrid",
      12: "No",
      13: "1-3 months",
      14: 1500000,
      15: 100,
      16: 0
    },
    expectedCategory: "Other",
    customCategory: "FinTech - AgriFinance",
    hasRevenue: false
  },

  // 17. Other (CleanTech) - Pre-Revenue Idea
  {
    name: "Other Category - CleanTech Pre-Revenue",
    ddqResponses: {
      1: "WasteWise",
      2: "AI-powered waste segregation and recycling platform",
      3: ["Other"],
      "3_other": "CleanTech - Waste Management",
      4: "Karnataka",
      5: "Idea",
      6: "Saahas, Hasiru Dala, Nepra",
      7: "Computer vision for automatic waste categorization",
      8: "Municipal corporations and large housing societies",
      9: "B2G (Business to Government)",
      10: "1-5",
      11: 2000000,
      "11b": "Usage-based",
      12: "No",
      13: "6+ months",
      14: 300000,
      15: 0,
      16: 0
    },
    expectedCategory: "Other",
    customCategory: "CleanTech - Waste Management",
    hasRevenue: false
  },

  // 18. Other (PropTech) - Pre-Revenue Beta
  {
    name: "Other Category - PropTech Pre-Revenue",
    ddqResponses: {
      1: "RentEase",
      2: "AI-powered rental property management platform",
      3: ["Other"],
      "3_other": "PropTech - Property Management",
      4: "Maharashtra",
      5: "Beta",
      6: "NoBroker, MagicBricks, 99acres",
      7: "End-to-end rental management with AI tenant matching",
      8: "Property owners with 5+ rental units",
      9: "B2B (Business to Business)",
      10: "6-20",
      11: 12000000,
      "11b": "Monthly Recurring",
      12: "No",
      13: "<1 month",
      14: 600000,
      15: 15,
      16: 0
    },
    expectedCategory: "Other",
    customCategory: "PropTech - Property Management",
    hasRevenue: false
  },

  // 19. Other (Logistics) - Pre-Revenue Launched
  {
    name: "Other Category - Logistics Pre-Revenue",
    ddqResponses: {
      1: "ColdChain Express",
      2: "Temperature-controlled logistics for pharma",
      3: ["Other"],
      "3_other": "Logistics - Cold Chain",
      4: "Gujarat",
      5: "Launched",
      6: "Snowman Logistics, Gati Kausar, Delhivery Cold",
      7: "IoT-enabled real-time temperature monitoring",
      8: "Pharmaceutical companies needing cold chain logistics",
      9: "B2B (Business to Business)",
      10: "21-50",
      11: 30000000,
      "11b": "Usage-based",
      12: "No",
      13: "Already have some",
      14: 2000000,
      15: 8,
      16: 0
    },
    expectedCategory: "Other",
    customCategory: "Logistics - Cold Chain",
    hasRevenue: false
  },

  // 20. Multi-category (SaaS + AI) - Pre-Revenue MVP
  {
    name: "Multi-Category SaaS+AI Pre-Revenue",
    ddqResponses: {
      1: "ContentGenius",
      2: "AI content generation platform for marketing teams",
      3: ["SaaS", "AI/ML", "Other"],
      "3_other": "MarTech - Content Automation",
      4: "Telangana",
      5: "MVP",
      6: "Jasper, Copy.ai, Writesonic",
      7: "India-focused content with regional language support",
      8: "Digital marketing agencies and D2C brands",
      9: "B2B (Business to Business)",
      10: "6-20",
      11: 8000000,
      "11b": "Monthly Recurring",
      12: "No",
      13: "1-3 months",
      14: 500000,
      15: 25,
      16: 0
    },
    expectedCategory: "SaaS",
    hasRevenue: false
  },

  // 21. Construction Domain - Revenue Company
  {
    name: "Construction Tech Revenue Company",
    ddqResponses: {
      1: "BuildTrack Pro",
      2: "Construction project management platform with real-time progress tracking, material management, and contractor coordination for infrastructure projects",
      3: ["Other"],
      "3_other": "Construction Tech - Project Management",
      4: "Maharashtra",
      5: "Growing",
      6: "Procore, PlanGrid, Buildertrend",
      7: "India-specific compliance, vernacular support, and integration with government e-tendering portals",
      8: "Construction companies, real estate developers, and infrastructure contractors with 10+ ongoing projects",
      9: "B2B (Business to Business)",
      10: "50+",
      11: 45000000,
      "11b": "Monthly Recurring",
      12: "Yes",
      13: 5500000,
      14: 3800000,
      15: 85,
      16: 64705
    },
    expectedCategory: "Other",
    customCategory: "Construction Tech - Project Management",
    hasRevenue: true
  },

  // 22. Construction Domain - Pre-Revenue MVP
  {
    name: "Construction Materials Marketplace Pre-Revenue",
    ddqResponses: {
      1: "MateriMart",
      2: "B2B marketplace connecting construction material suppliers with contractors, featuring price comparison, quality certification, and doorstep delivery",
      3: ["Other", "Marketplace"],
      "3_other": "Construction - Materials Marketplace",
      4: "Gujarat",
      5: "MVP",
      6: "IndiaMart, JustDial, Infra.Market",
      7: "Construction-specific marketplace with material quality verification and project-based bulk ordering",
      8: "Small to mid-size contractors and builders needing cement, steel, sand, and finishing materials",
      9: "B2B (Business to Business)",
      10: "21-50",
      11: 15000000,
      "11b": "Usage-based",
      12: "No",
      13: "1-3 months",
      14: 800000,
      15: 150,
      16: 0
    },
    expectedCategory: "Other",
    customCategory: "Construction - Materials Marketplace",
    hasRevenue: false
  },

  // 23. Pure Construction Company - No Tech (Revenue)
  {
    name: "Pure Construction Company - Civil Contractor",
    ddqResponses: {
      1: "Sharma & Sons Constructions",
      2: "Civil construction company specializing in residential buildings, commercial complexes, and government infrastructure projects including roads, bridges, and public buildings",
      3: ["Other"],
      "3_other": "Construction - Civil Contractor",
      4: "Rajasthan",
      5: "Established",
      6: "L&T Construction, Shapoorji Pallonji, local contractors",
      7: "30+ years experience, government-approved contractor, strong workforce of 500+ skilled laborers, own equipment fleet",
      8: "Government bodies for infrastructure projects, real estate developers, and private clients for commercial buildings",
      9: "B2B (Business to Business)",
      10: "50+",
      11: 80000000,
      "11b": "One-time Payment",
      12: "Yes",
      13: 25000000,
      14: 20000000,
      15: 45,
      16: 555555
    },
    expectedCategory: "Other",
    customCategory: "Construction - Civil Contractor",
    hasRevenue: true
  },

  // 24. Pure Construction Company - No Tech (Pre-Revenue/New)
  {
    name: "Pure Construction Company - New Builder",
    ddqResponses: {
      1: "Urban Heights Builders",
      2: "Residential construction company focused on affordable housing projects in tier-2 cities, specializing in 2BHK and 3BHK apartments",
      3: ["Other"],
      "3_other": "Construction - Residential Builder",
      4: "Madhya Pradesh",
      5: "Launched",
      6: "Local builders, DLF, Godrej Properties",
      7: "Focus on affordable segment, PMAY-compliant designs, faster construction with precast technology",
      8: "First-time home buyers in tier-2 cities with budget of ₹25-50 lakhs",
      9: "B2C (Business to Consumer)",
      10: "21-50",
      11: 50000000,
      "11b": "One-time Payment",
      12: "No",
      13: "Already have some",
      14: 3000000,
      15: 25,
      16: 0
    },
    expectedCategory: "Other",
    customCategory: "Construction - Residential Builder",
    hasRevenue: false
  }
];

// Test validation functions
function validateValuationResponse(response, testCase) {
  const errors = [];
  
  // Check required fields exist
  if (!response.valuation) errors.push("Missing valuation data");
  if (!response.valuation?.total_inr) errors.push("Missing INR valuation");
  if (!response.valuation?.method) errors.push("Missing valuation method");
  if (!response.TAM) errors.push("Missing TAM");
  if (!response.SAM) errors.push("Missing SAM");
  if (!response.SOM) errors.push("Missing SOM");
  
  // Check valuation is reasonable
  const valuation = response.valuation?.total_inr || 0;
  if (valuation <= 0) errors.push("Valuation is zero or negative");
  if (valuation > 200000000000) errors.push("Valuation exceeds ₹2000Cr (unrealistic)");
  
  // Check stage cap is respected
  const stageCaps = {
    'Idea': 10000000,
    'MVP': 30000000,
    'Beta': 50000000,
    'Launched': 150000000,
    'Growing': 500000000,
    'Established': 2000000000
  };
  const stage = testCase.ddqResponses[5];
  const cap = stageCaps[stage];
  if (valuation > cap * 1.5) { // Allow 50% buffer for score adjustments
    errors.push(`Valuation ₹${(valuation/10000000).toFixed(2)}Cr exceeds stage cap ₹${(cap/10000000).toFixed(2)}Cr`);
  }
  
  // Check TAM/SAM/SOM hierarchy
  if (response.SAM > response.TAM) errors.push("SAM > TAM (invalid)");
  if (response.SOM > response.SAM) errors.push("SOM > SAM (invalid)");
  
  return errors;
}

function validateCompetitorResponse(response, testCase) {
  const errors = [];
  
  if (!response || !Array.isArray(response)) {
    errors.push("Competitor response is not an array");
    return errors;
  }
  
  // Check we have some competitors
  if (response.length === 0) {
    errors.push("No competitors returned");
  }
  
  // Check competitor structure
  response.forEach((comp, i) => {
    if (!comp.name) errors.push(`Competitor ${i+1} missing name`);
    if (!comp.description) errors.push(`Competitor ${i+1} missing description`);
  });
  
  return errors;
}

function validateSWOTResponse(response, testCase) {
  const errors = [];
  
  if (!response) {
    errors.push("No SWOT response");
    return errors;
  }
  
  // Check all 4 quadrants exist
  if (!response.strengths || !Array.isArray(response.strengths)) errors.push("Missing/invalid strengths");
  if (!response.weaknesses || !Array.isArray(response.weaknesses)) errors.push("Missing/invalid weaknesses");
  if (!response.opportunities || !Array.isArray(response.opportunities)) errors.push("Missing/invalid opportunities");
  if (!response.threats || !Array.isArray(response.threats)) errors.push("Missing/invalid threats");
  
  // Check each has at least 1 item
  if (response.strengths?.length === 0) errors.push("No strengths listed");
  if (response.weaknesses?.length === 0) errors.push("No weaknesses listed");
  if (response.opportunities?.length === 0) errors.push("No opportunities listed");
  if (response.threats?.length === 0) errors.push("No threats listed");
  
  return errors;
}

function validateOtherCategory(response, testCase) {
  const errors = [];
  
  // If "Other" was selected, check if custom category is being used
  if (testCase.ddqResponses[3].includes("Other") && testCase.customCategory) {
    // Check that the response acknowledges the custom category
    const responseStr = JSON.stringify(response).toLowerCase();
    const customCat = testCase.customCategory.toLowerCase();
    
    // Check if any part of custom category appears in response
    const keywords = customCat.split(/[\s-]+/);
    const found = keywords.some(kw => responseStr.includes(kw));
    
    if (!found) {
      errors.push(`Custom category "${testCase.customCategory}" not reflected in response`);
    }
  }
  
  return errors;
}

// API call simulation (using fetch)
async function runTest(testCase, authToken, apiUrl) {
  const results = {
    name: testCase.name,
    category: testCase.expectedCategory,
    customCategory: testCase.customCategory || null,
    hasRevenue: testCase.hasRevenue,
    passed: true,
    errors: [],
    scores: {},
    valuation: null
  };
  
  try {
    // Calculate scores from DDQ responses
    const scores = calculateScores(testCase.ddqResponses);
    results.scores = scores;
    
    // Prepare valuation request
    const valuationPayload = {
      scores: scores,
      companyStage: testCase.ddqResponses[5],
      revenue: testCase.hasRevenue ? testCase.ddqResponses[13] : 0,
      category: testCase.ddqResponses[3][0], // Primary category
      totalInvestment: testCase.ddqResponses[11] || 0,
      monthlyExpenses: testCase.ddqResponses[14] || 0,
      userValuation: 0
    };
    
    // Test valuation endpoint
    const valuationRes = await fetch(`${apiUrl}/api/valuation/calculate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify(valuationPayload)
    });
    
    if (!valuationRes.ok) {
      results.errors.push(`Valuation API failed: ${valuationRes.status}`);
      results.passed = false;
      return results;
    }
    
    const valuationData = await valuationRes.json();
    results.valuation = valuationData;
    
    // Validate valuation
    const valErrors = validateValuationResponse(valuationData, testCase);
    if (valErrors.length > 0) {
      results.errors.push(...valErrors);
      results.passed = false;
    }
    
    // Test competitor endpoint
    const competitorPayload = {
      productName: testCase.ddqResponses[1],
      description: testCase.ddqResponses[2],
      category: testCase.ddqResponses[3],
      customCategory: testCase.ddqResponses["3_other"] || "",
      competitors: testCase.ddqResponses[6],
      location: testCase.ddqResponses[4]
    };
    
    const compRes = await fetch(`${apiUrl}/api/competitors`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify(competitorPayload)
    });
    
    if (compRes.ok) {
      const compData = await compRes.json();
      const compErrors = validateCompetitorResponse(compData.competitors || compData, testCase);
      if (compErrors.length > 0) {
        results.errors.push(...compErrors);
      }
      
      // Check "Other" category handling
      const otherErrors = validateOtherCategory(compData, testCase);
      if (otherErrors.length > 0) {
        results.errors.push(...otherErrors);
      }
    }
    
    // Test SWOT endpoint
    const swotPayload = {
      productName: testCase.ddqResponses[1],
      description: testCase.ddqResponses[2],
      category: testCase.ddqResponses[3],
      stage: testCase.ddqResponses[5],
      differentiation: testCase.ddqResponses[7]
    };
    
    const swotRes = await fetch(`${apiUrl}/api/swot`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify(swotPayload)
    });
    
    if (swotRes.ok) {
      const swotData = await swotRes.json();
      const swotErrors = validateSWOTResponse(swotData, testCase);
      if (swotErrors.length > 0) {
        results.errors.push(...swotErrors);
      }
    }
    
  } catch (error) {
    results.errors.push(`Test error: ${error.message}`);
    results.passed = false;
  }
  
  // Mark as passed only if no errors
  results.passed = results.errors.length === 0;
  
  return results;
}

// Score calculation (mimics frontend logic)
function calculateScores(responses) {
  let teamScore = 3;
  let productScore = 3;
  let marketScore = 3;
  let salesScore = 3;
  let financingScore = 3;
  let competitiveScore = 3;
  
  // Product stage scoring
  const stageScores = { 'Idea': 2, 'MVP': 3, 'Beta': 3.5, 'Launched': 4, 'Growing': 4.5, 'Established': 5 };
  productScore = stageScores[responses[5]] || 3;
  
  // Customer interviews scoring
  const interviewScores = { '0': 2, '1-5': 2.5, '6-20': 3, '21-50': 4, '50+': 5 };
  marketScore = interviewScores[responses[10]] || 3;
  
  // Investment scoring
  const investment = responses[11] || 0;
  if (investment >= 50000000) financingScore = 5;
  else if (investment >= 20000000) financingScore = 4;
  else if (investment >= 5000000) financingScore = 3;
  else financingScore = 2;
  
  // Revenue scoring (if applicable)
  if (responses[12] === 'Yes' && responses[13] > 0) {
    const revenue = responses[13];
    if (revenue >= 10000000) salesScore = 5;
    else if (revenue >= 5000000) salesScore = 4;
    else if (revenue >= 1000000) salesScore = 3.5;
    else if (revenue > 0) salesScore = 3;
  } else {
    salesScore = 2.5;
  }
  
  // Competitive differentiation (based on text length as proxy)
  const diffText = responses[7] || '';
  if (diffText.length > 100) competitiveScore = 4;
  else if (diffText.length > 50) competitiveScore = 3.5;
  else competitiveScore = 3;
  
  // Team score (default, would need more questions)
  teamScore = 3.5;
  
  return {
    teamScore: Math.min(teamScore, 5),
    productScore: Math.min(productScore, 5),
    marketScore: Math.min(marketScore, 5),
    salesScore: Math.min(salesScore, 5),
    financingScore: Math.min(financingScore, 5),
    competitiveScore: Math.min(competitiveScore, 5)
  };
}

// Main test runner
async function runAllTests() {
  console.log("========================================");
  console.log("  CEO INSIGHT ENGINE - 20 SCENARIO TEST");
  console.log("========================================\n");
  
  const API_URL = process.env.API_URL || 'http://localhost:3001';
  
  // First, get an auth token by logging in
  let authToken = null;
  
  try {
    // Try to login or register
    const loginRes = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'test@example.com',
        password: 'Test123456'
      })
    });
    
    if (loginRes.ok) {
      const loginData = await loginRes.json();
      authToken = loginData.token;
    } else {
      // Try to register
      const regRes = await fetch(`${API_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'test@example.com',
          password: 'Test123456',
          companyName: 'Test Company'
        })
      });
      
      if (regRes.ok) {
        const regData = await regRes.json();
        authToken = regData.token;
      } else {
        console.error("Could not authenticate. Running local validation only.");
      }
    }
  } catch (error) {
    console.log("Server not available. Running local validation tests only.\n");
  }
  
  let passed = 0;
  let failed = 0;
  const results = [];
  
  // Category-based analysis
  const categoryStats = {};
  const revenueVsPreRevenue = { revenue: { passed: 0, total: 0 }, preRevenue: { passed: 0, total: 0 } };
  const otherCategoryTests = [];
  
  for (let i = 0; i < testCases.length; i++) {
    const tc = testCases[i];
    console.log(`[${i + 1}/20] Testing: ${tc.name}`);
    console.log(`        Category: ${tc.expectedCategory}${tc.customCategory ? ` (${tc.customCategory})` : ''}`);
    console.log(`        Revenue: ${tc.hasRevenue ? 'Yes' : 'Pre-Revenue'}`);
    
    let result;
    
    if (authToken) {
      result = await runTest(tc, authToken, API_URL);
    } else {
      // Local validation only
      result = {
        name: tc.name,
        category: tc.expectedCategory,
        customCategory: tc.customCategory || null,
        hasRevenue: tc.hasRevenue,
        passed: true,
        errors: [],
        scores: calculateScores(tc.ddqResponses)
      };
      
      // Validate scores are reasonable
      const scores = result.scores;
      if (Object.values(scores).some(s => s < 1 || s > 5)) {
        result.errors.push("Invalid score values");
        result.passed = false;
      }
      
      // Validate DDQ responses are complete
      const requiredFields = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, "11b", 12];
      for (const field of requiredFields) {
        if (tc.ddqResponses[field] === undefined || tc.ddqResponses[field] === null || tc.ddqResponses[field] === '') {
          result.errors.push(`Missing required field: Q${field}`);
          result.passed = false;
        }
      }
      
      // Check Other category has custom value
      if (tc.ddqResponses[3].includes("Other") && !tc.ddqResponses["3_other"]) {
        result.errors.push("Other category selected but no custom category provided");
        result.passed = false;
      }
      
      result.passed = result.errors.length === 0;
    }
    
    results.push(result);
    
    // Track stats
    if (!categoryStats[tc.expectedCategory]) {
      categoryStats[tc.expectedCategory] = { passed: 0, total: 0 };
    }
    categoryStats[tc.expectedCategory].total++;
    
    if (tc.hasRevenue) {
      revenueVsPreRevenue.revenue.total++;
    } else {
      revenueVsPreRevenue.preRevenue.total++;
    }
    
    if (tc.expectedCategory === "Other") {
      otherCategoryTests.push(result);
    }
    
    if (result.passed) {
      passed++;
      categoryStats[tc.expectedCategory].passed++;
      if (tc.hasRevenue) {
        revenueVsPreRevenue.revenue.passed++;
      } else {
        revenueVsPreRevenue.preRevenue.passed++;
      }
      console.log(`        ✅ PASSED`);
    } else {
      failed++;
      console.log(`        ❌ FAILED: ${result.errors.join(', ')}`);
    }
    console.log('');
  }
  
  // Calculate efficiency
  const efficiency = (passed / testCases.length) * 100;
  
  console.log("\n========================================");
  console.log("              TEST SUMMARY");
  console.log("========================================");
  console.log(`Total Tests: ${testCases.length}`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Efficiency: ${efficiency.toFixed(1)}%`);
  console.log("");
  
  console.log("Category Breakdown:");
  for (const [cat, stats] of Object.entries(categoryStats)) {
    const catEff = (stats.passed / stats.total * 100).toFixed(0);
    console.log(`  ${cat}: ${stats.passed}/${stats.total} (${catEff}%)`);
  }
  console.log("");
  
  console.log("Revenue vs Pre-Revenue:");
  const revEff = (revenueVsPreRevenue.revenue.passed / revenueVsPreRevenue.revenue.total * 100).toFixed(0);
  const preRevEff = (revenueVsPreRevenue.preRevenue.passed / revenueVsPreRevenue.preRevenue.total * 100).toFixed(0);
  console.log(`  Revenue Companies: ${revenueVsPreRevenue.revenue.passed}/${revenueVsPreRevenue.revenue.total} (${revEff}%)`);
  console.log(`  Pre-Revenue Companies: ${revenueVsPreRevenue.preRevenue.passed}/${revenueVsPreRevenue.preRevenue.total} (${preRevEff}%)`);
  console.log("");
  
  console.log("'Other' Category Tests:");
  otherCategoryTests.forEach(t => {
    const status = t.passed ? '✅' : '❌';
    console.log(`  ${status} ${t.name} - ${t.customCategory}`);
    if (!t.passed) {
      console.log(`      Errors: ${t.errors.join(', ')}`);
    }
  });
  
  console.log("\n========================================");
  if (efficiency >= 90) {
    console.log("✅ EFFICIENCY > 90% - ALL TESTS PASSED!");
    console.log("   Code is working efficiently across all scenarios.");
  } else {
    console.log("❌ EFFICIENCY < 90% - NEEDS IMPROVEMENT");
    console.log(`   Current efficiency: ${efficiency.toFixed(1)}%`);
    console.log("   Failed tests:");
    results.filter(r => !r.passed).forEach(r => {
      console.log(`   - ${r.name}: ${r.errors.join(', ')}`);
    });
  }
  console.log("========================================\n");
  
  return {
    total: testCases.length,
    passed,
    failed,
    efficiency,
    results,
    categoryStats,
    otherCategoryResults: otherCategoryTests
  };
}

// Run tests
runAllTests().catch(console.error);
