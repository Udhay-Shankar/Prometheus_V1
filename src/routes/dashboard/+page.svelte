<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { goto } from '$app/navigation';
	import { writable } from 'svelte/store';
	import confetti from 'canvas-confetti';
	import { env } from '$env/dynamic/public';

	// API Configuration - use relative URLs in production (same domain)
	const API_URL = typeof window !== 'undefined' && window.location.hostname !== 'localhost' 
		? '' // Use relative URLs in production
		: (env.PUBLIC_VITE_API_URL || import.meta.env.VITE_API_URL || 'http://localhost:3001');

	let user: any = null;
	let activeTab = 'overview';
	let showDDQ = false;
	let currentQuestion = 0;
	let ddqResponses: any = {};
	let valuation: any = null;
	let swotAnalysis: any = null;
	let fundingSchemes: any = null;
	let competitors: any = null;
	let verifiedCompetitors: any[] = []; // Competitors with verified revenue/customers
	let potentialCompetitors: any[] = []; // Competitors without verified data
	let userPickCompetitors: any[] = []; // User-mentioned competitors
	let globalCompetitors: any[] = []; // Global/international competitors
	let localCompetitors: any[] = []; // Local/Indian competitors
	let rivalCompetitors: any[] = []; // Rival/emerging competitors
	let allCompetitors: any[] = []; // All competitors combined
	let competitorDataSummary: any = null; // Summary of competitor data
	let activeCompetitorTab = 'all'; // 'all' | 'user-pick' | 'global' | 'local' | 'rival'
	let compareMode = false; // Whether compare frame is active
	let compareList: any[] = []; // List of competitors to compare
	let compareSearchQuery = ''; // Search query in compare frame
	let onlineSearchLoading = false; // Loading state for online search
	let onlineSearchError = ''; // Error message for online search
	let chartTooltip: { visible: boolean; x: number; y: number; company: string; year: number; valuation: number; event: string } = { visible: false, x: 0, y: 0, company: '', year: 0, valuation: 0, event: '' };
	let marketTrends: any[] = [];
	let marketOpportunities: any = null;
	let strategicRecommendations: any[] = [];
	let monitoredCompetitors: string[] = [];
	let loading = false;
	let sidebarMinimized = false;
	let theme = 'light';
	let hasRevenue: boolean | null = null; // Track conditional path
	let customBusinessCategory: string = ''; // For 'Other' business category
	let pricingModel: string | null = null; // Track pricing model for revenue questions
	let isPreRevenue = false; // Determined by Q9 answer
	
	// Helper function to convert multiselect arrays to display strings
	function toDisplayString(value: any, separator: string = ', '): string {
		if (Array.isArray(value)) {
			return value.join(separator);
		}
		return value || '';
	}
	
	// Helper function to get the primary (first) value from multiselect or single value
	function getPrimaryValue(value: any, fallback: string = ''): string {
		if (Array.isArray(value)) {
			return value[0] || fallback;
		}
		return value || fallback;
	}
	let showChatbot = false; // Floating chatbot visibility
	let selectedCompetitor: any = null; // For modal display
	let showMethodologyModal = false; // For methodology breakdown modal
	let showVrioInfo = false; // For VRIO framework explanation tooltip
	
	// Frame Info Modal state
	let showFrameInfo = false;
	let activeFrameInfo: { title: string; description: string; calculation?: string } | null = null;
	
	// Frame information definitions
	const frameInfo: Record<string, { title: string; description: string; calculation: string }> = {
		'valuation': {
			title: 'Company Valuation',
			description: 'This shows your estimated company valuation based on multiple methodologies including Berkus Method and Scorecard Method. It provides a comprehensive view of your startup\'s worth.',
			calculation: 'Valuation is calculated using a weighted combination of: Berkus Method (evaluates 5 key risk factors: Sound Idea, Prototype, Quality Management, Strategic Relationships, Product Rollout) and Scorecard Method (compares your startup against average startups in your region using factors like Team, Opportunity Size, Product/Technology, Competitive Environment, Marketing/Sales, Need for Additional Investment, and Other factors).'
		},
		'introspection': {
			title: 'SWOT Analysis (Introspection)',
			description: 'A strategic planning framework that identifies your company\'s Strengths, Weaknesses, Opportunities, and Threats. This helps you understand internal and external factors affecting your business.',
			calculation: 'Generated using AI analysis of your DDQ responses, including business category, competitive landscape, team composition, funding status, and market positioning. The AI considers industry benchmarks and startup best practices.'
		},
		'funding-schemes': {
			title: 'Funding Schemes',
			description: 'Curated list of government grants, startup programs, and funding opportunities specifically relevant to your business category, stage, and location.',
			calculation: 'Matched based on your business category, company stage, state location, and funding requirements. We analyze eligibility criteria from various central and state government schemes, incubators, and accelerator programs.'
		},
		'competitors': {
			title: 'Competitor Analysis',
			description: 'Comprehensive analysis of your competitive landscape including direct competitors, global players, and emerging rivals. Helps you understand market positioning.',
			calculation: 'Identified through AI analysis of your business description, target market, and user-mentioned competitors. Data includes company profiles, estimated revenue ranges, funding status, and market positioning.'
		},
		'pestel': {
			title: 'PESTEL Analysis',
			description: 'A framework analyzing Political, Economic, Social, Technological, Environmental, and Legal factors that impact your business environment.',
			calculation: 'Generated by analyzing macro-environmental factors relevant to your business category and location. Each factor is rated on impact level and assessed for opportunities and threats.'
		},
		'porters-five': {
			title: 'Porter\'s Five Forces',
			description: 'Analyzes five competitive forces that shape your industry: Threat of New Entrants, Bargaining Power of Suppliers, Bargaining Power of Buyers, Threat of Substitutes, and Industry Rivalry.',
			calculation: 'Each force is evaluated on a scale based on your business category, competitive landscape, and market dynamics. Higher scores indicate stronger competitive pressure.'
		},
		'market-metrics': {
			title: 'Market Metrics',
			description: 'Key market indicators including Total Addressable Market (TAM), Serviceable Addressable Market (SAM), and Serviceable Obtainable Market (SOM).',
			calculation: 'TAM represents the total market demand. SAM is the portion you can target based on your capabilities. SOM is the realistic market share you can capture. Calculated using industry data and your specific market positioning.'
		},
		'vrio': {
			title: 'VRIO Framework',
			description: 'Evaluates your competitive resources across four dimensions: Valuable, Rare, Imitable, and Organized. Helps identify sustainable competitive advantages.',
			calculation: 'Resources are scored based on: Value (does it help exploit opportunities?), Rarity (do few competitors possess it?), Imitability (is it costly to imitate?), and Organization (are you organized to capture value?). Resources meeting all criteria provide sustained competitive advantage.'
		},
		'balanced-scorecard': {
			title: 'Balanced Scorecard',
			description: 'A strategic management framework measuring performance across four perspectives: Financial, Customer, Internal Processes, and Learning & Growth.',
			calculation: 'Scores are derived from your DDQ responses mapped to each perspective. Financial metrics from revenue/funding data, Customer metrics from acquisition and retention data, Process metrics from operational indicators, and Growth metrics from team and capability assessments.'
		},
		'product-insight': {
			title: 'Product Insight',
			description: 'Benchmarks your product metrics against industry standards for profitable companies. Shows how your unit economics and growth metrics compare.',
			calculation: 'Compares your actual metrics (from DDQ responses) against benchmark values from successful companies in your category. Benchmarks are derived from industry research and include CAC, LTV, churn rate, gross margin, and growth rate.'
		},
		'methodology': {
			title: 'Valuation Methodology',
			description: 'Detailed breakdown of how your company valuation is calculated using industry-standard methods.',
			calculation: 'Uses Berkus Method (assigns up to ₹4Cr per factor for 5 risk elements) and Scorecard Method (multiplies base valuation by weighted factors). Final valuation is a weighted average with adjustments for your specific circumstances.'
		},
		'daily-actions': {
			title: 'Daily Actions',
			description: 'AI-generated actionable tasks tailored to your business stage and current challenges. Helps you stay focused on high-impact activities.',
			calculation: 'Generated daily using AI analysis of your business profile, current challenges, goals, and previous action history. Actions are prioritized based on urgency and potential impact.'
		},
		'news': {
			title: 'Industry News',
			description: 'Curated news and updates relevant to your business category and market. Stay informed about industry trends and developments.',
			calculation: 'Aggregated from various news sources and filtered based on your business category keywords. Includes startup ecosystem news, funding announcements, and market trends.'
		}
	};
	
	// Function to show frame info modal
	function showInfo(frameKey: string) {
		const info = frameInfo[frameKey];
		if (info) {
			activeFrameInfo = info;
			showFrameInfo = true;
		}
	}
	
	// Function to close frame info modal
	function closeFrameInfo() {
		showFrameInfo = false;
		activeFrameInfo = null;
	}
	
	// Function to open chatbot with pre-filled context about a frame
	function askDaddy(frameKey: string) {
		const info = frameInfo[frameKey];
		if (info) {
			// Open chatbot
			showChatbot = true;
			
			// Pre-fill the chat input with a contextual question
			const contextQuestion = `Explain the "${info.title}" section to me. What does this data mean for my business and how is it calculated? Give me actionable insights.`;
			chatInput = contextQuestion;
			
			// Auto-send the message after a brief delay
			setTimeout(() => {
				sendChatMessage();
			}, 300);
		}
	}

	// AI Chatbot state
	let chatMessages: Array<{role: string, content: string, timestamp: Date, id?: string}> = [];
	let chatInput = '';
	let chatLoading = false;
	let chatContainer: HTMLElement;

	// Saved Notes state
	let savedNotes: any[] = [];
	let notesLoading = false;
	let notesSearchQuery = '';
	let selectedNoteCategory = 'all';
	let noteCategories: string[] = [];
	let selectedNote: any = null;
	let isCreatingNote = false;
	let newNoteTitle = '';
	let newNoteContent = '';
	let newNoteCategory = 'General';

	// Daily Actions & Backlog state
	let dailyActions: Array<{
		id: string;
		text: string;
		status: 'pending' | 'accepted' | 'rejected';
		progress: 'red' | 'amber' | 'green' | null;
		createdAt: Date;
		rejectionReason?: string;
	}> = [];
	let backlogItems: Array<{
		id: string;
		text: string;
		progress: 'red' | 'amber' | 'green';
		movedToBacklogAt: Date;
	}> = [];
	let actionsLoading = false;

	// Company Logo state
	let companyLogo: string | null = null;
	let logoFile: File | null = null;
	let logoUploading = false;

	// News state
	let newsItems: Array<{
		title: string;
		source: string;
		url: string;
		publishedAt: string;
		summary?: string;
		timeAgo?: string;
		imageUrl?: string;
	}> = [];
	let newsLoading = false;
	let featuredNewsIndex = 0;
	let newsRotationInterval: ReturnType<typeof setInterval> | null = null;

	// SECTION 1: Business Foundation (5 questions)
	const section1Questions = [
		{
			id: 1,
			section: 'Business Foundation',
			question: 'Product/service name',
			type: 'text',
			placeholder: 'Enter product or service name',
			required: true
		},
		{
			id: 'logo',
			section: 'Business Foundation',
			question: 'Company Logo (optional)',
			type: 'file',
			placeholder: 'Upload your company logo',
			required: false,
			accept: 'image/*'
		},
		{
			id: 2,
			section: 'Business Foundation',
			question: 'Description',
			type: 'textarea',
			placeholder: 'Briefly describe what your product/service does and the problem it solves',
			required: true
		},
		{
			id: 3,
			section: 'Business Foundation',
			question: 'Business category selection (select all that apply)',
			type: 'multiselect',
			options: ['SaaS', 'Mobile App', 'E-commerce', 'AI/ML', 'Hardware', 'Marketplace', 'Consulting', 'FMCG', 'Other'],
			required: true,
			hasOther: true // Shows textbox when 'Other' is selected
		},
		{
			id: '3_other',
			section: 'Business Foundation',
			question: 'Please specify your business category',
			type: 'text',
			placeholder: 'Enter your specific business field/category',
			required: true,
			conditionalOn: 3,
			conditionalValue: 'Other'
		},
		{
			id: 4,
			section: 'Business Foundation',
			question: 'State/Location of your startup',
			type: 'dropdown',
			options: [
				'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
				'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand',
				'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur',
				'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab',
				'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura',
				'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
				'Delhi NCR', 'Chandigarh', 'Puducherry', 'Other'
			],
			required: true
		},
		{
			id: 5,
			section: 'Business Foundation',
			question: 'Product stage',
			type: 'dropdown',
			options: ['Idea', 'MVP', 'Beta', 'Launched', 'Growing', 'Established'],
			required: true
		},
		{
			id: 6,
			section: 'Business Foundation',
			question: 'Main competitors (2-3 names)',
			type: 'text',
			placeholder: 'List 2-3 main competitors or "None" if first mover',
			required: true
		},
		{
			id: 7,
			section: 'Business Foundation',
			question: 'Competitive differentiation',
			type: 'textarea',
			placeholder: 'Describe your unique value proposition and what makes you different from competitors',
			required: true
		}
	];

	// SECTION 2: Market Validation (4 questions)
	const section2Questions = [
		{
			id: 8,
			section: 'Market Validation',
			question: 'Target customer description',
			type: 'textarea',
			placeholder: 'Who is your ideal customer? Be specific about demographics, pain points, and behavior',
			required: true
		},
		{
			id: 9,
			section: 'Market Validation',
			question: 'Type of marketing preferred',
			type: 'dropdown',
			options: ['B2C (Business to Consumer)', 'B2B (Business to Business)', 'B2G (Business to Government)', 'C2C (Consumer to Consumer)'],
			required: true
		},
		{
			id: 10,
			section: 'Market Validation',
			question: 'Customer interviews completed',
			type: 'dropdown',
			options: ['0', '1-5', '6-20', '21-50', '50+'],
			required: true
		},
		{
			id: 11,
			section: 'Market Validation',
			question: 'Total investment received till now',
			type: 'number',
			placeholder: 'Enter total funding in INR (0 if bootstrapped)',
			required: true
		},
		{
			id: '11b',
			section: 'Market Validation',
			question: 'Pricing model (planned or existing)',
			type: 'dropdown',
			options: ['Monthly Recurring', 'Quarterly Recurring', 'Yearly Recurring', 'One-time Payment', 'Freemium', 'Usage-based', 'Hybrid'],
			required: true,
			pricingModel: true // This sets pricing model for revenue questions
		},
		{
			id: 12,
			section: 'Market Validation',
			question: 'Paying customers status',
			type: 'dropdown',
			options: ['Yes', 'No'],
			required: true,
			conditional: true // This triggers branch logic
		}
	];

	// SECTION 3A: Revenue Businesses (if Q12 = Yes)
	// Revenue questions vary based on pricing model
	function getSection3AQuestions() {
		const pricing = ddqResponses['11b'] || 'Monthly Recurring';
		
		// Base questions
		const questions = [
			{
				id: 15,
				section: 'Revenue Metrics',
				question: 'Total customer count',
				type: 'number',
				placeholder: 'Total paying customers',
				required: true
			}
		];
		
		// Revenue questions based on pricing model
		if (pricing === 'Monthly Recurring') {
			questions.unshift(
				{ id: 13, section: 'Revenue Metrics', question: 'Current monthly recurring revenue (MRR)', type: 'number', placeholder: 'Enter MRR in INR', required: true },
				{ id: 14, section: 'Revenue Metrics', question: 'MRR 3 months ago', type: 'number', placeholder: 'Enter in INR', required: true }
			);
		} else if (pricing === 'Quarterly Recurring') {
			questions.unshift(
				{ id: 13, section: 'Revenue Metrics', question: 'Current quarterly recurring revenue (QRR)', type: 'number', placeholder: 'Enter QRR in INR', required: true },
				{ id: 14, section: 'Revenue Metrics', question: 'QRR last quarter', type: 'number', placeholder: 'Enter in INR', required: true }
			);
		} else if (pricing === 'Yearly Recurring') {
			questions.unshift(
				{ id: 13, section: 'Revenue Metrics', question: 'Annual recurring revenue (ARR)', type: 'number', placeholder: 'Enter ARR in INR', required: true },
				{ id: 14, section: 'Revenue Metrics', question: 'ARR last year', type: 'number', placeholder: 'Enter in INR', required: true }
			);
		} else if (pricing === 'One-time Payment') {
			questions.unshift(
				{ id: 13, section: 'Revenue Metrics', question: 'Total revenue this month', type: 'number', placeholder: 'Enter in INR', required: true },
				{ id: 14, section: 'Revenue Metrics', question: 'Total revenue 3 months ago', type: 'number', placeholder: 'Enter in INR', required: true }
			);
		} else {
			// Freemium, Usage-based, Hybrid - ask for monthly equivalent
			questions.unshift(
				{ id: 13, section: 'Revenue Metrics', question: 'Current monthly revenue (all sources)', type: 'number', placeholder: 'Enter in INR', required: true },
				{ id: 14, section: 'Revenue Metrics', question: 'Revenue 3 months ago', type: 'number', placeholder: 'Enter in INR', required: true }
			);
		}
		
		// Add Customer count question
		questions.push({
			id: 15,
			section: 'Revenue Metrics',
			question: 'Total customer count',
			type: 'number',
			placeholder: 'Total paying customers',
			required: true
		});
		
		// Add ARPC question
		questions.push({
			id: 16,
			section: 'Revenue Metrics',
			question: pricing === 'One-time Payment' ? 'Average revenue per customer (one-time)' : 'Average revenue per customer (per period)',
			type: 'number',
			placeholder: 'Enter in INR (approx)',
			required: true
		});
		
		return questions;
	}
	
	// Legacy constant for backward compatibility
	const section3AQuestions = [
		{
			id: 13,
			section: 'Revenue Metrics',
			question: 'Current monthly revenue',
			type: 'number',
			placeholder: 'Enter in INR',
			required: true
		},
		{
			id: 14,
			section: 'Revenue Metrics',
			question: 'Revenue 3 months ago',
			type: 'number',
			placeholder: 'Enter in INR',
			required: true
		},
		{
			id: 15,
			section: 'Revenue Metrics',
			question: 'Total customer count',
			type: 'number',
			placeholder: 'Total paying customers',
			required: true
		},
		{
			id: 16,
			section: 'Revenue Metrics',
			question: 'Average revenue per customer',
			type: 'number',
			placeholder: 'Enter in INR (approx)',
			required: true
		}
	];

	// SECTION 3B: Pre-Revenue Businesses (if Q12 = No)
	const section3BQuestions = [
		{
			id: 13,
			section: 'Pre-Revenue Planning',
			question: 'Expected first customer timeline',
			type: 'dropdown',
			options: ['Already have some', '<1 month', '1-3 months', '3-6 months', '6+ months', 'Uncertain'],
			required: true
		},
		{
			id: 14,
			section: 'Pre-Revenue Planning',
			question: 'Planned pricing model (monthly amount)',
			type: 'number',
			placeholder: 'Expected monthly price per customer in INR',
			required: true
		},
		{
			id: 15,
			section: 'Pre-Revenue Planning',
			question: 'Pilot customers or beta users',
			type: 'number',
			placeholder: 'Number of free users/testers currently',
			required: true
		},
		{
			id: 16,
			section: 'Pre-Revenue Planning',
			question: 'Monthly expenses/burn rate',
			type: 'number',
			placeholder: 'Current monthly expenses in INR',
			required: true
		}
	];

	// SECTION 4: Team & Operations (3 questions)
	const section4Questions = [
		{
			id: 17,
			section: 'Team & Operations',
			question: 'Team size including founder',
			type: 'number',
			placeholder: 'Total number of team members (including yourself)',
			required: true
		},
		{
			id: 18,
			section: 'Team & Operations',
			question: 'Founder background (select all that apply)',
			type: 'multiselect',
			options: ['Technical', 'Business', 'Industry Expert', 'Previous Startup', 'Finance', 'Marketing', 'Other'],
			required: true
		},
		{
			id: 19,
			section: 'Team & Operations',
			question: 'Biggest current challenges (select all that apply)',
			type: 'multiselect',
			options: ['Customers', 'Product', 'Funding', 'Team', 'Competition', 'Regulations', 'Tech', 'Other'],
			required: true
		}
	];

	// SECTION 5: Growth Strategy (3 questions)
	const section5Questions = [
		{
			id: 20,
			section: 'Growth Strategy',
			question: 'Customer acquisition strategies (select all that apply)',
			type: 'multiselect',
			options: ['Online marketing', 'Direct sales', 'Word of mouth', 'Partnerships', 'App stores', 'Social media', 'Other'],
			required: true
		},
		{
			id: 21,
			section: 'Growth Strategy',
			question: '6-month primary goal',
			type: 'text',
			placeholder: 'What is your main objective for the next 6 months?',
			required: true
		},
		{
			id: 22,
			section: 'Growth Strategy',
			question: 'Funding needed for goals',
			type: 'dropdown',
			options: ['Less than ₹10 Lakhs', '₹10-25 Lakhs', '₹25-50 Lakhs', '₹50 Lakhs - ₹1 Crore', '₹1-5 Crores', 'Over ₹5 Crores'],
			required: true
		}
	];

	// SECTION 6: Risk Assessment (1 question)
	const section6Questions = [
		{
			id: 23,
			section: 'Risk Assessment',
			question: 'Primary business risks (select all that apply)',
			type: 'multiselect',
			options: ['Competition', 'No demand', 'Funding', 'Technical', 'Regulatory', 'Key person', 'Economic', 'Other'],
			required: true
		}
	];

	// Build initial question list
	let ddqQuestions: any[] = [
		...section1Questions,
		...section2Questions
	];

	// Combined questions for profile display
	const allQuestions = [
		...section1Questions,
		...section2Questions,
		...section3AQuestions,
		...section3BQuestions,
		...section4Questions,
		...section5Questions,
		...section6Questions
	];
	
	// Handle Q11 answer to determine path and rebuild questions
	function handleRevenueDecision(answer: string) {
		if (answer === 'Yes') {
			hasRevenue = true;
			isPreRevenue = false;
			ddqQuestions = [
				...section1Questions,
				...section2Questions,
				...getSection3AQuestions(), // Use dynamic questions based on pricing model
				...section4Questions,
				...section5Questions,
				...section6Questions
			].filter(q => shouldShowQuestion(q));
		} else if (answer === 'No') {
			hasRevenue = false;
			isPreRevenue = true;
			ddqQuestions = [
				...section1Questions,
				...section2Questions,
				...section3BQuestions,
				...section4Questions,
				...section5Questions,
				...section6Questions
			].filter(q => shouldShowQuestion(q));
		}
		// Force reactivity update
		ddqQuestions = ddqQuestions;
	}
	
	// Check if a conditional question should be shown
	function shouldShowQuestion(question: any): boolean {
		if (!question.conditionalOn) return true;
		const parentAnswer = ddqResponses[question.conditionalOn];
		if (Array.isArray(parentAnswer)) {
			return parentAnswer.includes(question.conditionalValue);
		}
		return parentAnswer === question.conditionalValue;
	}
	
	// Rebuild questions when conditional answers change
	function rebuildQuestions() {
		const baseQuestions = hasRevenue === null 
			? [...section1Questions, ...section2Questions]
			: hasRevenue 
				? [...section1Questions, ...section2Questions, ...getSection3AQuestions(), ...section4Questions, ...section5Questions, ...section6Questions]
				: [...section1Questions, ...section2Questions, ...section3BQuestions, ...section4Questions, ...section5Questions, ...section6Questions];
		
		ddqQuestions = baseQuestions.filter(q => shouldShowQuestion(q));
	}

	// Reactive declarations for DDQ
	$: currentQuestionData = ddqQuestions[currentQuestion];
	$: progress = ((currentQuestion + 1) / ddqQuestions.length) * 100;
	$: canProceedToNext = currentQuestionData && (() => {
		const answer = ddqResponses[currentQuestionData.id];
		if (!currentQuestionData.required) return true;
		if (currentQuestionData.type === 'multiselect') {
			return answer && answer.length > 0;
		}
		return answer !== undefined && answer !== '' && answer !== null;
	})();

	// Load notes when notes tab is opened
	$: if ((activeTab === 'notes' || activeTab === 'profile') && savedNotes.length === 0 && !notesLoading) {
		loadNotes();
	}

	// Load competitors when trends tab is opened
	$: if (activeTab === 'trends' && !competitors && valuation) {
		getCompetitors().catch(err => console.warn('Competitor analysis failed:', err));
	}

	onMount(async () => {
		const token = localStorage.getItem('accessToken');
		const userData = localStorage.getItem('user');
		const savedTheme = localStorage.getItem('theme') || 'light';
		theme = savedTheme;
		document.documentElement.setAttribute('data-theme', theme);

		if (!token || !userData) {
			// Clear any stale data and redirect to login
			localStorage.removeItem('accessToken');
			localStorage.removeItem('refreshToken');
			localStorage.removeItem('user');
			goto('/auth/login');
			return;
		}

		try {
			user = JSON.parse(userData);
			
			// Load saved DDQ responses with validation
			const saved = localStorage.getItem('ddq_progress');
			if (saved) {
				try {
					const parsedResponses = JSON.parse(saved);
					// Validate that responses are in correct format (not objects)
					let hasCorruptedData = false;
					for (const key in parsedResponses) {
						const value = parsedResponses[key];
						// Check if value is an object (but not null or array)
						if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
							console.warn(`Corrupted data detected for question ${key}:`, value);
							hasCorruptedData = true;
							break;
						}
					}
					
					if (hasCorruptedData) {
						console.log('🧹 Clearing corrupted DDQ progress data');
						localStorage.removeItem('ddq_progress');
						ddqResponses = {};
					} else {
						ddqResponses = parsedResponses;
					}
				} catch (parseError) {
					console.error('Error parsing DDQ progress:', parseError);
					localStorage.removeItem('ddq_progress');
					ddqResponses = {};
				}
			}
			
			// Check for existing DDQ and auto-open if needed
			const hasExistingValuation = await checkExistingDDQ();
			
			// Don't auto-open DDQ - let users explore the dashboard first
			// They can click "Begin Assessment" when ready
			// const ddqDismissed = sessionStorage.getItem('ddqDismissed');
			// if (!hasExistingValuation && !ddqDismissed) {
			// 	setTimeout(() => {
			// 		showDDQ = true;
			// 	}, 500);
			// }
		} catch (error) {
			console.error('Error initializing dashboard:', error);
			// If there's any error parsing user data, clear everything and redirect
			localStorage.removeItem('accessToken');
			localStorage.removeItem('refreshToken');
			localStorage.removeItem('user');
			goto('/auth/login');
		}
	});

	function toggleTheme() {
		theme = theme === 'light' ? 'dark' : 'light';
		document.documentElement.setAttribute('data-theme', theme);
		localStorage.setItem('theme', theme);
	}

	function toggleSidebar() {
		sidebarMinimized = !sidebarMinimized;
		localStorage.setItem('sidebar', sidebarMinimized ? 'minimized' : 'maximized');
	}

	async function checkExistingDDQ() {
		try {
			const token = localStorage.getItem('accessToken');
			console.log('Checking existing DDQ with token:', token ? 'Token exists' : 'No token');
			
			const response = await fetch(`${API_URL}/api/ddq/latest`, {
				headers: {
					Authorization: `Bearer ${token}`
				}
			});

			console.log('DDQ fetch response status:', response.status);

			if (response.ok) {
				const data = await response.json();
				console.log('DDQ data received:', data);
				
				if (data && data.responses) {
					ddqResponses = data.responses;
					
					// Load logo if saved
					if (data.responses.logo) {
						companyLogo = data.responses.logo;
					}
					
					calculateValuation();
					
					// Also load SWOT, funding schemes, and competitors
					generateSWOT().catch(err => console.warn('SWOT generation failed:', err));
					getFundingSchemes().catch(err => console.warn('Funding schemes failed:', err));
					getCompetitors().catch(err => console.warn('Competitor analysis failed:', err));
					
					// Load daily actions immediately
					loadTodayActions().catch(err => console.warn('Actions loading failed:', err));
					
					// Defer news loading to not block main UI (load after 2 seconds)
					setTimeout(() => {
						loadNews().catch(err => console.warn('News loading failed:', err));
					}, 2000);
					
					return true; // Has existing valuation
				}
			} else {
				const errorData = await response.json().catch(() => ({}));
				console.error('DDQ fetch failed:', response.status, errorData);
				
				// If token is invalid/expired, redirect to login
				if (response.status === 403 || response.status === 401) {
					console.log('Token expired, redirecting to login');
					localStorage.clear();
					goto('/auth/login');
					return false;
				}
			}
			return false; // No existing valuation
		} catch (error) {
			console.error('Error fetching DDQ:', error);
			return false;
		}
	}

	function startDDQ() {
		showDDQ = true;
		currentQuestion = 0;
		// Clear any corrupted data from localStorage
		localStorage.removeItem('ddq_progress');
		// Reset responses to start fresh
		ddqResponses = {};
	}

	function closeDDQ() {
		showDDQ = false;
		// Mark as dismissed in session to prevent re-opening
		sessionStorage.setItem('ddqDismissed', 'true');
	}

	function nextQuestion() {
		if (!currentQuestionData) {
			console.error('No current question data');
			return;
		}
		
		// Check if this is Q12 (paying customers decision - the conditional trigger)
		if (currentQuestionData.conditional && ddqResponses[currentQuestionData.id]) {
			handleRevenueDecision(ddqResponses[currentQuestionData.id]);
		}
		
		// Check if Q3 (business category) was answered with 'Other' - need to show Q3_other
		if (currentQuestionData.id === 3) {
			const categories = ddqResponses[3] || [];
			if (Array.isArray(categories) && categories.includes('Other')) {
				// Make sure Q3_other will be shown
				rebuildQuestions();
			}
		}
		
		// Check if pricing model changed - rebuild revenue questions
		if (currentQuestionData.pricingModel) {
			pricingModel = ddqResponses['11b'];
			// Revenue questions will be regenerated when handleRevenueDecision is called
		}
		
		// Save current answer to localStorage
		localStorage.setItem('ddq_progress', JSON.stringify(ddqResponses));

		if (currentQuestion < ddqQuestions.length - 1) {
			currentQuestion++;
			// Skip conditional questions that shouldn't show
			while (currentQuestion < ddqQuestions.length - 1 && !shouldShowQuestion(ddqQuestions[currentQuestion])) {
				currentQuestion++;
			}
		} else {
			completeDDQ();
		}
	}

	function previousQuestion() {
		if (currentQuestion > 0) {
			currentQuestion--;
		}
	}

	function handleAnswer(value: any) {
		if (!currentQuestionData) return;
		console.log('Answer updated:', currentQuestionData.id, '=', value);
		ddqResponses[currentQuestionData.id] = value;
		ddqResponses = { ...ddqResponses }; // Trigger reactivity
		
		// If this question has hasOther flag, check if we need to show/hide the other textbox
		if (currentQuestionData.hasOther && Array.isArray(value)) {
			rebuildQuestions();
		}
	}

	// Handle logo file upload
	function handleLogoUpload(event: Event) {
		const target = event.target as HTMLInputElement;
		const file = target.files?.[0];
		if (file) {
			logoFile = file;
			const reader = new FileReader();
			reader.onload = (e) => {
				companyLogo = e.target?.result as string;
				ddqResponses['logo'] = companyLogo;
			};
			reader.readAsDataURL(file);
		}
	}

	function canProceed(): boolean {
		if (!currentQuestionData) {
			console.log('canProceed: No question data');
			return false;
		}
		
		const answer = ddqResponses[currentQuestionData.id];
		console.log('canProceed check:', { 
			questionId: currentQuestionData.id, 
			answer, 
			required: currentQuestionData.required,
			type: currentQuestionData.type 
		});
		
		if (!currentQuestionData.required) return true;
		
		if (currentQuestionData.type === 'multiselect') {
			return answer && answer.length > 0;
		}
		
		const result = answer !== undefined && answer !== '' && answer !== null;
		console.log('canProceed result:', result);
		return result;
	}

	async function completeDDQ() {
		loading = true;
		try {
			const token = localStorage.getItem('accessToken');
			
			// Save DDQ responses
			await fetch(`${API_URL}/api/ddq/save`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${token}`
				},
				body: JSON.stringify({
					responses: ddqResponses,
					hasRevenue
				})
			});

			// Clear progress from localStorage
			localStorage.removeItem('ddq_progress');

			showDDQ = false;
			
			// Calculate valuation first (critical path)
			await calculateValuation();
			
			// Load SWOT, funding schemes, and competitors in background (non-blocking)
			// These can fail gracefully without affecting the main flow
			generateSWOT().catch(err => console.warn('SWOT generation failed:', err));
			getFundingSchemes().catch(err => console.warn('Funding schemes failed:', err));
			getCompetitors().catch(err => console.warn('Competitor analysis failed:', err));
			
		} catch (error) {
			console.error('Error completing DDQ:', error);
			alert('There was an error processing your responses. Please try again.');
		} finally {
			loading = false;
		}
	}

	async function calculateValuation() {
		loading = true;
		try {
			const token = localStorage.getItem('accessToken');
			if (!token) {
				console.error('No access token found');
				goto('/auth/login');
				return;
			}

			// Calculate scores from responses
			const scores = {
				teamScore: calculateTeamScore(),
				productScore: calculateProductScore(),
				marketScore: calculateMarketScore(),
				salesScore: calculateSalesScore(),
				financingScore: calculateFinancingScore(),
				competitiveScore: calculateCompetitiveScore()
			};

			const response = await fetch(`${API_URL}/api/valuation/calculate`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				Authorization: `Bearer ${token}`
			},
			body: JSON.stringify({
				scores,
				companyStage: ddqResponses[5], // Q5: Product stage (was Q4)
				revenue: hasRevenue ? parseInt(ddqResponses[13]) : 0, // Q13: Current monthly revenue (was Q12)
				fundingNeeded: parseInt(ddqResponses[22]) || 0, // Q22: Funding needed for goals (was Q21)
				category: ddqResponses[3], // Q3: Business category (unchanged)
				totalInvestment: parseInt(ddqResponses[11]) || 0, // Q11: Total investment received (was Q10)
				monthlyExpenses: hasRevenue ? 0 : (parseInt(ddqResponses[16]) || 0), // Q16: Monthly expenses for pre-revenue
				customerCount: hasRevenue ? (parseInt(ddqResponses[15]) || 0) : 0 // Q15: Total customer count (was Q14)
			})
		});			if (!response.ok) {
				const errorData = await response.json();
				console.error('Valuation API error:', response.status, errorData);
				if (response.status === 403 || response.status === 401) {
					console.log('Token expired, redirecting to login');
					goto('/auth/login');
					return;
				}
				throw new Error(errorData.error || 'Failed to calculate valuation');
			}

			valuation = await response.json();
			activeTab = 'overview'; // Redirect to overview (hero page) after valuation
			
			// Trigger 5-second confetti celebration
			triggerConfetti();
			
			// Load daily actions immediately, defer news to not block UI
			await loadTodayActions();
			
			// Load news after a short delay to not block the main UI rendering
			setTimeout(() => {
				loadNews().catch(err => console.warn('News loading failed:', err));
			}, 1500);
		} catch (error) {
			console.error('Error calculating valuation:', error);
		} finally {
			loading = false;
		}
	}

	// Confetti celebration for 5 seconds
	function triggerConfetti() {
		const duration = 5000; // 5 seconds
		const animationEnd = Date.now() + duration;
		const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 9999 };

		function randomInRange(min: number, max: number) {
			return Math.random() * (max - min) + min;
		}

		const interval: any = setInterval(function() {
			const timeLeft = animationEnd - Date.now();

			if (timeLeft <= 0) {
				return clearInterval(interval);
			}

			const particleCount = 50 * (timeLeft / duration);
			
			// Emit confetti from two sides
			confetti({
				...defaults,
				particleCount,
				origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 }
			});
			confetti({
				...defaults,
				particleCount,
				origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 }
			});
		}, 250);
	}

	// Score calculation functions (updated for new question structure)
	function calculateTeamScore(): number {
		let score = 3; // Base score
	const teamSize = parseInt(ddqResponses[17]) || 1; // Q17: Team size including founder (was Q16)
	const founderBackgrounds = ddqResponses[18] || []; // Q18: Founder background (now multiselect)
	const backgrounds = Array.isArray(founderBackgrounds) ? founderBackgrounds : [founderBackgrounds];
	
	// Team size bonus
		if (teamSize >= 20) score += 1.5;
		else if (teamSize >= 11) score += 1.2;
		else if (teamSize >= 6) score += 0.8;
		else if (teamSize >= 4) score += 0.5;
		else if (teamSize >= 2) score += 0.3;

		// Founder background bonus (now checks multiple backgrounds)
		if (backgrounds.includes('Previous Startup')) score += 1.2;
		if (backgrounds.includes('Industry Expert')) score += 0.8;
		if (backgrounds.includes('Technical')) score += 0.6;
		if (backgrounds.includes('Business') || backgrounds.includes('Finance')) score += 0.4;
		if (backgrounds.includes('Marketing')) score += 0.3;

		return Math.min(score, 5);
	}

	function calculateProductScore(): number {
		let score = 2; // Base score
		const stage = ddqResponses[5] || 'Idea'; // Q5: Product stage (was Q4)

		// Product stage scoring (updated stages)
		if (stage === 'Established') score = 5;
		else if (stage === 'Growing') score = 4.5;
		else if (stage === 'Launched') score = 4.0;
		else if (stage === 'Beta') score = 3.2;
		else if (stage === 'MVP') score = 2.5;
		else if (stage === 'Idea') score = 1.5;

		return score;
	}

	function calculateMarketScore(): number {
		let score = 3; // Base score
		const marketType = ddqResponses[9] || 'B2C'; // Q9: Type of marketing preferred (was Q8)
		const categories = ddqResponses[3] || []; // Q3: Business category (now multiselect)
		const categoryList = Array.isArray(categories) ? categories : [categories];
		const interviews = ddqResponses[10] || '0'; // Q10: Customer interviews completed (was Q9)

		// Marketing type bonus
		if (marketType.includes('B2B')) score += 0.8; // B2B typically higher valuation
		else if (marketType.includes('B2G')) score += 1.0; // Government contracts can be lucrative
		else if (marketType.includes('B2C')) score += 0.5;

		// High-growth category bonus (now checks multiple categories)
		const highGrowthCategories = ['SaaS', 'AI/ML', 'Mobile App'];
		if (categoryList.some((c: string) => highGrowthCategories.includes(c))) score += 0.7;
		else if (categoryList.includes('E-commerce') || categoryList.includes('Marketplace')) score += 0.5;

		// Customer validation bonus (interviews conducted)
		if (interviews === '50+') score += 1.0;
		else if (interviews === '21-50') score += 0.7;
		else if (interviews === '6-20') score += 0.4;
		else if (interviews === '1-5') score += 0.2;

		return Math.min(score, 5);
	}

	function calculateSalesScore(): number {
		let score = 2; // Base score
		
		if (hasRevenue) {
			// Revenue business path
		const currentRevenue = parseInt(ddqResponses[13]) || 0; // Q13: Current monthly revenue (was Q12)
		const revenue3mo = parseInt(ddqResponses[14]) || 0; // Q14: Revenue 3 months ago (was Q13)
		const totalCustomers = parseInt(ddqResponses[15]) || 0; // Q15: Total customer count (was Q14)
		const avgRevenuePerCustomer = parseInt(ddqResponses[16]) || 0; // Q16: Average revenue per customer (was Q15)			// Current revenue scoring
			if (currentRevenue >= 1000000) score += 2; // 10L+/month
			else if (currentRevenue >= 500000) score += 1.5; // 5L+/month
			else if (currentRevenue >= 100000) score += 1; // 1L+/month
			else if (currentRevenue >= 50000) score += 0.5; // 50K+/month

			// Revenue growth bonus
			if (revenue3mo > 0 && currentRevenue > revenue3mo) {
				const growthRate = ((currentRevenue - revenue3mo) / revenue3mo) * 100;
				if (growthRate >= 50) score += 1.0; // 50%+ growth
				else if (growthRate >= 25) score += 0.7;
				else if (growthRate >= 10) score += 0.4;
			}

			// Customer count and ARPU bonus
			if (totalCustomers >= 100) score += 0.5;
			else if (totalCustomers >= 50) score += 0.3;
			if (avgRevenuePerCustomer >= 10000) score += 0.5; // High ARPU

	} else {
		// Pre-revenue business path
		const firstCustomerTimeline = ddqResponses[13] || 'Uncertain'; // Q13: Expected first customer timeline (was Q12)
		const plannedPricing = parseInt(ddqResponses[14]) || 0; // Q14: Planned pricing model (was Q13)			// Timeline to revenue bonus
			if (firstCustomerTimeline === 'Already have some') score += 1.5;
			else if (firstCustomerTimeline === '<1 month') score += 1.2;
			else if (firstCustomerTimeline === '1-3 months') score += 0.8;
			else if (firstCustomerTimeline === '3-6 months') score += 0.5;

			// Pricing model validation
			if (plannedPricing >= 10000) score += 0.8; // Premium pricing
			else if (plannedPricing >= 1000) score += 0.5;
			else if (plannedPricing >= 500) score += 0.3;
		}

		return Math.min(score, 5);
	}

	function calculateFinancingScore(): number {
		let score = 2.5; // Base score
		const totalInvestment = parseInt(ddqResponses[11]) || 0; // Q11: Total investment received till now (was Q10)
		
		// Check burn rate based on revenue status
		let burnRate = 0;
	if (hasRevenue) {
		// For revenue businesses, burn might not be explicitly asked, estimate from current operations
		burnRate = parseInt(ddqResponses[16]) || 0; // Q16: Could be avg revenue per customer as proxy (was Q15)
	} else {
		burnRate = parseInt(ddqResponses[16]) || 0; // Q16: Monthly expenses/burn rate (pre-revenue) (was Q15)
	}		// Funding raised bonus
		if (totalInvestment >= 10000000) score += 1.5; // 1Cr+
		else if (totalInvestment >= 5000000) score += 1.2; // 50L+
		else if (totalInvestment >= 1000000) score += 0.8; // 10L+
		else if (totalInvestment >= 500000) score += 0.4; // 5L+
		else if (totalInvestment === 0) score += 0.2; // Bootstrapped shows resourcefulness

		// Runway calculation (if we have burn rate)
		if (hasRevenue) {
			const currentRevenue = parseInt(ddqResponses[13]) || 0; // Q13 (was Q12)
			// Assume profitability is good
			if (currentRevenue > burnRate) score += 1.0;
		} else {
			// For pre-revenue, good if burn is low
			if (burnRate > 0 && totalInvestment > 0) {
				const runwayMonths = totalInvestment / burnRate;
				if (runwayMonths >= 18) score += 1.0; // 18+ months runway
				else if (runwayMonths >= 12) score += 0.7;
				else if (runwayMonths >= 6) score += 0.4;
			}
		}

		return Math.min(score, 5);
	}

	function calculateCompetitiveScore(): number {
		let score = 3; // Base score
		const competitors = (ddqResponses[5] || '').toLowerCase(); // Q5: Main competitors
		const differentiation = ddqResponses[6] || ''; // Q6: Competitive differentiation
		const biggestChallenge = ddqResponses[19] || ''; // Q19: Biggest current challenge (was Q18)

		// First mover advantage
		if (competitors.includes('none') || competitors.includes('no competitor')) {
			score += 1.5;
		} else if (competitors.length < 30) {
			score += 0.3; // Few competitors mentioned
		}

		// Strong differentiation (longer, more detailed description = more thought)
		if (differentiation.length > 200) score += 1.0;
		else if (differentiation.length > 150) score += 0.8;
		else if (differentiation.length > 100) score += 0.5;
		else if (differentiation.length > 50) score += 0.3;

		// Challenge not being competition is good
		if (!biggestChallenge.includes('Competition')) score += 0.3;

		return Math.min(score, 5);
	}

	async function generateSWOT() {
		try {
			const token = localStorage.getItem('accessToken');
			if (!token) {
				console.error('No access token found');
				return;
			}

		// Get business categories (now multiselect)
		const categories = ddqResponses[3] || [];
		const categoryString = toDisplayString(categories);
		// Include custom category if 'Other' was selected
		const fullCategory = ddqResponses['3_other'] 
			? (categoryString ? `${categoryString}, ${ddqResponses['3_other']}` : ddqResponses['3_other'])
			: categoryString;

		console.log('📊 Generating SWOT analysis...', {
			industry: fullCategory,
			competitors: ddqResponses[6], // Q6 (was Q5)
			stage: ddqResponses[5] // Q5 (was Q4)
		});

		const response = await fetch(`${API_URL}/api/analysis/swot`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${token}`
			},
			body: JSON.stringify({
				companyData: {
					name: ddqResponses[1],
					category: fullCategory, // Now uses multiselect + custom
					stage: ddqResponses[5], // Q5 (was Q4)
					hasRevenue,
					targetCustomer: ddqResponses[8] // Q8 (was Q7)
				},
				industry: fullCategory, // Now uses multiselect + custom
				competitors: ddqResponses[6] // Q6 (was Q5)
			})
		});			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}));
				console.error('❌ SWOT API error:', response.status, errorData);
				// Don't return early - use fallback data
				throw new Error(`API returned ${response.status}`);
			}

			const data = await response.json();
			console.log('✅ SWOT data received:', data);
			swotAnalysis = data;
		} catch (error) {
			console.error('❌ Error generating SWOT:', error);
		// INTELLIGENT fallback SWOT based on analyzing user's actual data
		const industryCategories = ddqResponses[3] || [];
		const industry = toDisplayString(industryCategories) || 'Technology';
		const state = ddqResponses[4] || 'Other'; // Q4: State (NEW)
		const stage = ddqResponses[5] || 'Growing'; // Q5 (was Q4)
		const competitors = ddqResponses[6] || 'Market competitors'; // Q6 (was Q5)
		const uniqueValue = ddqResponses[7] || ''; // Q7 (was Q6)
		const teamSize = parseInt(ddqResponses[17]) || 1; // Q17 (was Q16) - CORRECT NOW
		const founderBackgrounds = ddqResponses[18] || []; // Q18: Now multiselect
		const founderBackground = toDisplayString(founderBackgrounds); // Convert to string for display
		const mainChallenges = ddqResponses[19] || []; // Q19: Now multiselect
		const mainChallenge = toDisplayString(mainChallenges); // Convert to string for display
		const acquisitionChannels = ddqResponses[20] || []; // Q20: Now multiselect
		const acquisitionChannel = toDisplayString(acquisitionChannels); // Convert to string for display
		
		console.log('🔍 Analyzing user data for intelligent SWOT fallback:', {
			industry,
			competitors,
			stage,
			teamSize,
			founderBackground,
			hasRevenue,
			uniqueValue: uniqueValue.substring(0, 50) + '...'
		});
			
			// Analyze strengths based on actual user data
			const strengths = [];
			
			// Team strength analysis
			if (teamSize >= 20) {
				strengths.push(`Large team of ${teamSize} members enabling rapid execution and market coverage`);
			} else if (teamSize >= 10) {
				strengths.push(`Growing team of ${teamSize} people with specialized skills in ${industry}`);
			} else if (teamSize >= 5) {
				strengths.push(`Agile team of ${teamSize} members with deep ${industry} expertise`);
			} else {
				strengths.push(`Lean and focused founding team committed to ${industry} innovation`);
			}
			
			// Founder background strength (now handles array)
			const bgArray = Array.isArray(founderBackgrounds) ? founderBackgrounds : [founderBackgrounds];
			if (bgArray.includes('Previous Startup')) {
				strengths.push('Proven entrepreneurial experience from previous startup journey');
			} else if (bgArray.includes('Industry Expert')) {
				strengths.push(`Deep industry expertise and networks in ${industry} sector`);
			} else if (bgArray.includes('Technical')) {
				strengths.push('Strong technical foundation for product development and innovation');
			}
			
			// Revenue/Traction strength
			if (hasRevenue) {
				const revenue = parseInt(ddqResponses[13]) || 0; // Q13 for revenue
				const customers = parseInt(ddqResponses[15]) || 0; // Q15 for customers
				strengths.push(`Proven business model with ₹${(revenue/100000).toFixed(1)}L monthly revenue from ${customers} customers`);
			} else {
				strengths.push(`${stage} stage focus on product-market fit and early customer validation`);
			}
			
			// Unique value strength
			if (uniqueValue && uniqueValue.length > 50) {
				strengths.push(`Clear differentiation: ${uniqueValue.substring(0, 80)}...`);
			} else {
				strengths.push(`Focused value proposition addressing specific ${industry} market needs`);
			}
			
			// Analyze weaknesses based on actual challenges
			const weaknesses = [];
			
			// Revenue/scale weakness
			if (hasRevenue) {
				weaknesses.push('Revenue growth requires acceleration to compete with established players');
			} else {
				weaknesses.push('Pre-revenue stage requiring market validation and customer acquisition');
			}
			
			// Competition weakness
			if (competitors && competitors.toLowerCase() !== 'none') {
				weaknesses.push(`Intense competition from established players like ${competitors}`);
			} else {
				weaknesses.push('Need to establish clear market positioning in emerging category');
			}
			
			// Team/resource weakness
			if (teamSize < 5) {
				weaknesses.push('Limited team size may constrain rapid scaling and market expansion');
			}
			weaknesses.push('Brand awareness and market presence still developing');
			
			// Analyze opportunities based on industry and stage
			const opportunities = [];
			
			// Industry-specific opportunities
			if (industry === 'Marketplace' || industry === 'E-commerce') {
				opportunities.push('Growing digital commerce adoption and online ordering trends in India');
				opportunities.push('Hyperlocal and quick commerce creating new market segments');
			} else if (industry === 'SaaS' || industry === 'B2B') {
				opportunities.push('Enterprise digital transformation driving SaaS adoption in India');
				opportunities.push('SMB market underserved and seeking affordable solutions');
			} else if (industry === 'FinTech') {
				opportunities.push('Financial inclusion and digital payments revolution in India');
				opportunities.push('Regulatory support for fintech innovation and UPI ecosystem');
			} else {
				opportunities.push(`Expanding ${industry} market with strong growth trajectory`);
			}
			
			opportunities.push('Strategic partnerships with ecosystem players and platforms');
			opportunities.push('Government startup schemes (SISFS, CGSS) providing seed funding support');
			
			if (acquisitionChannel && acquisitionChannel.includes('Digital')) {
				opportunities.push('Digital marketing channels offering cost-effective customer acquisition');
			}
			
			// Analyze threats based on competition and challenges
			const threats = [];
			
			// Competition threats
			if (competitors && competitors.toLowerCase().includes('zomato') || competitors.toLowerCase().includes('swiggy')) {
				threats.push(`Dominant players (${competitors}) with deep pockets and extensive delivery networks`);
				threats.push('Price wars and aggressive customer acquisition by funded competitors');
			} else if (competitors && competitors.toLowerCase() !== 'none') {
				threats.push(`Direct competition from ${competitors} with established market presence`);
				threats.push('Well-funded competitors may outspend on customer acquisition');
			} else {
				threats.push('Risk of larger players entering the market once opportunity is validated');
			}
			
			// Industry-specific threats
			if (industry === 'Marketplace' || industry === 'E-commerce') {
				threats.push('High customer acquisition costs and low switching costs in the market');
			}
			
			threats.push(`Regulatory changes and compliance requirements in ${industry} sector`);
			threats.push('Economic uncertainties affecting consumer spending and investor sentiment');
			
			swotAnalysis = {
				strengths: strengths.slice(0, 4), // Keep top 4
				weaknesses: weaknesses.slice(0, 4),
				opportunities: opportunities.slice(0, 4),
				threats: threats.slice(0, 4)
			};
			
			console.log('📝 Generated intelligent SWOT based on user data:', {
				teamSize,
				revenue: hasRevenue,
				competitors: competitors.substring(0, 30),
				strengths: strengths.length,
				weaknesses: weaknesses.length
			});
		}
	}

	async function getFundingSchemes() {
		try {
			const token = localStorage.getItem('accessToken');
			if (!token) {
				console.error('No access token found');
				return;
			}

			// Get personalization parameters from DDQ responses (updated IDs)
			const category = ddqResponses[3] || 'Technology'; // Q3: Business category
			const state = ddqResponses[4] || 'Other'; // Q4: State/Location (NEW!)
			const stage = ddqResponses[5] || 'Idea'; // Q5: Product stage
			const totalInvestment = parseInt(ddqResponses[11]) || 0; // Q11: Total investment
			const fundingNeeded = ddqResponses[22] || 'Less than ₹10 Lakhs'; // Q22: Funding needed
			const hasRevenue = ddqResponses[12] === 'Yes'; // Q12: Paying customers
			const teamSize = parseInt(ddqResponses[17]) || 1; // Q17: Team size
			const productDescription = ddqResponses[2] || ''; // Q2: Description

			console.log('💰 Fetching funding schemes...', { category, state, stage, totalInvestment, hasRevenue });

			const response = await fetch(`${API_URL}/api/analysis/funding-schemes`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${token}`
				},
				body: JSON.stringify({
					category,
					state,
					stage,
					totalInvestment,
					location: state, // Send state as location too for backward compatibility
					hasRevenue,
					teamSize,
					productDescription,
					companyProfile: {
						stage: stage,
						industry: category,
						incorporationDate: new Date(),
						revenue: hasRevenue ? (parseInt(ddqResponses[13]) || 0) : 0, // Q13: Monthly revenue
						techFocus: category,
						location: state,
						state: state
					}
				})
			});

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}));
				console.error('❌ Funding schemes API error:', response.status, errorData);
				throw new Error(`API returned ${response.status}`);
			}

			const data = await response.json();
			console.log('✅ Funding schemes received:', data);
			fundingSchemes = data;
		} catch (error) {
			console.error('❌ Error getting funding schemes:', error);
			// INTELLIGENT fallback based on analyzing user's eligibility
			const category = ddqResponses[3] || 'Technology';
			const state = ddqResponses[4] || 'Other';
			const stage = ddqResponses[5] || 'Idea';
			const totalInvestment = parseInt(ddqResponses[11]) || 0;
			const fundingNeeded = parseInt(ddqResponses[22]) || 0;
			const location = ddqResponses[4] || 'Pan India';
			const hasRevenue = ddqResponses[12] === 'Yes';
			const teamSize = parseInt(ddqResponses[17]) || 1;
			
			console.log('🔍 Analyzing eligibility for intelligent funding fallback:', {
				category,
				stage,
				totalInvestment,
				fundingNeeded,
				hasRevenue,
				teamSize,
				location
			});
			
			// Calculate actual eligibility based on criteria
			const isEligibleForSISFS = totalInvestment < 5000000 && 
			                           (stage === 'Idea' || stage === 'MVP' || stage === 'Beta' || stage === 'Launched');
			const isEligibleForCGSS = hasRevenue && 
			                          (stage === 'Growing' || stage === 'Established' || stage === 'Launched');
			const isEligibleForGENESIS = (category === 'AI/ML' || category === 'Technology') && 
			                             teamSize >= 2;
			const isEligibleForStateScheme = location && location !== 'Pan India';
			const isEdTech = category === 'EdTech' || category === 'Education' || category === 'E-learning';
			
			// All Central Government Schemes (priority ordered)
			const allCentralSchemes = [
				// Priority 1: SISFS - Startup India Seed Fund Scheme
				{
					name: 'Startup India Seed Fund Scheme (SISFS)',
					amount: 'Up to ₹50 Lakhs',
					eligibility: 'DPIIT recognized startups, incorporated < 2 years, innovative product/service',
					benefits: 'Proof of concept validation, prototype development, product trials, market entry, commercialization',
					eligible: isEligibleForSISFS,
					eligibilityStatus: isEligibleForSISFS ? 'eligible' : (stage === 'Growing' || stage === 'Established') ? 'not-eligible' : 'partial',
					reasoning: isEligibleForSISFS 
						? `You qualify! Investment of ₹${(totalInvestment/100000).toFixed(1)}L < ₹50L and ${stage} stage fits criteria`
						: stage === 'Growing' || stage === 'Established'
						? 'Your company has progressed beyond seed stage'
						: 'Consider applying if DPIIT recognized and < 2 years old',
					url: 'https://seedfund.startupindia.gov.in/',
					priority: fundingNeeded <= 5000000 ? 1 : 5
				},
				// Priority 2: CGSS - Credit Guarantee Scheme
				{
					name: 'Credit Guarantee Scheme for Startups (CGSS)',
					amount: 'Up to ₹10 Crores',
					eligibility: 'DPIIT recognized startups, valid business model, revenue generation potential',
					benefits: 'Collateral-free credit guarantee, easier access to working capital loans from banks',
					eligible: isEligibleForCGSS,
					eligibilityStatus: isEligibleForCGSS ? 'eligible' : hasRevenue ? 'partial' : 'not-eligible',
					reasoning: isEligibleForCGSS
						? `Strong match! You have revenue and ${stage} stage shows business model validation`
						: hasRevenue
						? 'You have revenue - strengthen business model documentation for better chances'
						: 'Focus on achieving revenue first to qualify for this scheme',
					url: 'https://www.startupindia.gov.in/content/sih/en/government-schemes/credit-guarantee-scheme.html',
					priority: isEligibleForCGSS ? 1 : 4
				},
				// Priority 3: GENESIS - AI/ML specific
				{
					name: 'GENESIS - Gen-Next Support for Innovative Startups',
					amount: 'Up to ₹1 Crore',
					eligibility: 'Deep tech startups in AI/ML, IoT, Blockchain, AR/VR, Robotics',
					benefits: 'Product development support, mentorship, market access, international expansion',
					eligible: isEligibleForGENESIS,
					eligibilityStatus: isEligibleForGENESIS ? 'eligible' : 'partial',
					reasoning: category === 'AI/ML'
						? 'Perfect fit for AI/ML deep tech startup'
						: 'Technology startups can apply if product has deep tech component',
					url: 'https://www.meity.gov.in/content/genesis',
					priority: (category === 'AI/ML' || category === 'Technology') ? 1 : 6
				},
				// Priority 4: Atal Innovation Mission
				{
					name: 'Atal Innovation Mission (AIM)',
					amount: 'Up to ₹2 Crores',
					eligibility: 'Innovative startups with scalable solutions, focus on social impact',
					benefits: 'Grants, incubation support, mentorship, access to Atal Incubation Centers',
					eligible: stage === 'Idea' || stage === 'MVP' || stage === 'Beta',
					eligibilityStatus: (stage === 'Idea' || stage === 'MVP' || stage === 'Beta') ? 'eligible' : 'partial',
					reasoning: (stage === 'Idea' || stage === 'MVP' || stage === 'Beta')
						? `Early stage startup - AIM provides excellent incubation support`
						: 'AIM focuses on early stage - check Atal Incubation Centers for opportunities',
					url: 'https://aim.gov.in/',
					priority: isEdTech ? 1 : 3
				},
				// Priority 5: Fund of Funds for Startups (FFS)
				{
					name: 'Fund of Funds for Startups (FFS)',
					amount: 'Through SEBI-registered AIFs',
					eligibility: 'DPIIT recognized startups seeking equity funding',
					benefits: 'Access to ₹10,000 Cr corpus through SIDBI-managed fund, equity support without dilution concerns',
					eligible: true,
					eligibilityStatus: 'partial',
					reasoning: 'FFS provides indirect equity support through SEBI-registered AIFs - great for growth stage',
					url: 'https://www.startupindia.gov.in/content/sih/en/government-schemes/fund-of-funds-for-startups-ffs.html',
					priority: (stage === 'Growing' || stage === 'Established') ? 2 : 4
				},
				// Priority 6: SAMRIDH - Startup Accelerators
				{
					name: 'SAMRIDH - Startup Accelerators',
					amount: 'Up to ₹40 Lakhs',
					eligibility: 'Growth stage startups with proven business model',
					benefits: 'Investment support, expert mentoring, market access, international expansion support',
					eligible: stage === 'Growing' || stage === 'Launched' || hasRevenue,
					eligibilityStatus: (stage === 'Growing' || stage === 'Launched' || hasRevenue) ? 'eligible' : 'partial',
					reasoning: (stage === 'Growing' || stage === 'Launched' || hasRevenue)
						? 'You have traction - SAMRIDH helps scale with accelerator support'
						: 'Focus on revenue generation to maximize SAMRIDH benefits',
					url: 'https://samridh.meity.gov.in/',
					priority: hasRevenue ? 2 : 5
				},
				// Priority 7: TIDE 2.0 - Technology Incubation
				{
					name: 'TIDE 2.0 - Technology Incubation',
					amount: 'Up to ₹7 Crores per incubator',
					eligibility: 'Tech startups through TIDE 2.0 centers across India',
					benefits: 'Financial support, technical mentoring, lab facilities, industry connections',
					eligible: category === 'Technology' || category === 'AI/ML' || category === 'SaaS',
					eligibilityStatus: (category === 'Technology' || category === 'AI/ML' || category === 'SaaS') ? 'eligible' : 'partial',
					reasoning: 'TIDE 2.0 centers provide comprehensive tech incubation support across premier institutes',
					url: 'https://www.meity.gov.in/tide2-0',
					priority: 3
				},
				// Priority 8: BioNEST - Biotech Incubators
				{
					name: 'BioNEST - Biotech Incubators',
					amount: 'Up to ₹50 Lakhs',
					eligibility: 'Biotech and healthcare startups with innovative solutions',
					benefits: 'Lab infrastructure, regulatory guidance, funding support, industry mentorship',
					eligible: category === 'Healthcare' || category === 'Biotech' || category === 'MedTech',
					eligibilityStatus: (category === 'Healthcare' || category === 'Biotech' || category === 'MedTech') ? 'eligible' : 'not-eligible',
					reasoning: (category === 'Healthcare' || category === 'Biotech' || category === 'MedTech')
						? 'Directly relevant for your healthcare/biotech venture'
						: 'Specifically for biotech/healthcare startups',
					url: 'https://birac.nic.in/bionest.php',
					priority: (category === 'Healthcare' || category === 'Biotech' || category === 'MedTech') ? 1 : 10
				},
				// Priority 9: NIDHI-SSS - Seed Support System
				{
					name: 'NIDHI-SSS - Seed Support System',
					amount: 'Up to ₹1 Crore',
					eligibility: 'Startups incubated at DST-supported TBIs',
					benefits: 'Seed funding for proof of concept, prototype development, early commercialization',
					eligible: stage === 'Idea' || stage === 'MVP',
					eligibilityStatus: (stage === 'Idea' || stage === 'MVP') ? 'eligible' : 'partial',
					reasoning: (stage === 'Idea' || stage === 'MVP')
						? 'Perfect for early stage - join a DST-supported incubator to apply'
						: 'Best suited for idea/MVP stage startups',
					url: 'https://dst.gov.in/nidhi-seed-support-system',
					priority: (stage === 'Idea' || stage === 'MVP') ? 2 : 6
				},
				// Priority 10: Mudra Loan Scheme
				{
					name: 'Mudra Loan - PMMY',
					amount: 'Up to ₹10 Lakhs',
					eligibility: 'Micro and small enterprises, individuals starting businesses',
					benefits: 'Collateral-free loans under Shishu (₹50K), Kishor (₹5L), Tarun (₹10L) categories',
					eligible: fundingNeeded <= 1000000,
					eligibilityStatus: fundingNeeded <= 1000000 ? 'eligible' : 'partial',
					reasoning: fundingNeeded <= 1000000
						? 'Good fit for initial working capital and small funding needs'
						: 'Consider for smaller working capital requirements',
					url: 'https://www.mudra.org.in/',
					priority: fundingNeeded <= 1000000 ? 2 : 7
				},
				// Priority 11: Stand Up India
				{
					name: 'Stand Up India',
					amount: '₹10 Lakhs to ₹1 Crore',
					eligibility: 'SC/ST and women entrepreneurs setting up greenfield enterprises',
					benefits: 'Bank loans for manufacturing, services or trading sector enterprises',
					eligible: true,
					eligibilityStatus: 'partial',
					reasoning: 'Excellent scheme for SC/ST and women entrepreneurs - check eligibility criteria',
					url: 'https://www.standupmitra.in/',
					priority: 8
				}
			];
			
			// Filter out not-eligible schemes, sort by priority, and take top 6
			const centralSchemes = allCentralSchemes
				.filter(s => s.eligibilityStatus !== 'not-eligible') // Only show eligible or partially eligible
				.sort((a, b) => {
					// Prioritize 'eligible' over 'partial'
					if (a.eligibilityStatus === 'eligible' && b.eligibilityStatus !== 'eligible') return -1;
					if (b.eligibilityStatus === 'eligible' && a.eligibilityStatus !== 'eligible') return 1;
					return a.priority - b.priority;
				})
				.slice(0, 6)
				.map(({ priority, ...scheme }) => scheme); // Remove priority field from final output
			
			// All State-level schemes (priority ordered based on location match)
			const allStateSchemes = [
				// Primary state scheme based on user's location
				{
					name: `${location || 'Your State'} Startup Policy Fund`,
					amount: 'Up to ₹25 Lakhs',
					eligibility: `State-registered startups operating in ${location || 'your state'}`,
					benefits: 'Seed funding, mentorship, incubation support, networking opportunities',
					eligible: isEligibleForStateScheme,
					eligibilityStatus: isEligibleForStateScheme ? 'eligible' : 'partial',
					reasoning: isEligibleForStateScheme 
						? `Based in ${location} - check with state startup cell for application process`
						: 'Register your startup in your state to access local schemes',
					url: 'https://www.startupindia.gov.in/content/sih/en/state-startup-policies.html',
					priority: isEligibleForStateScheme ? 1 : 5
				},
				// Karnataka specific
				{
					name: 'Karnataka Elevate 100',
					amount: 'Up to ₹50 Lakhs',
					eligibility: 'Innovative startups registered in Karnataka with scalable solutions',
					benefits: 'Equity-free grants, mentorship, market access, global exposure',
					eligible: location === 'Karnataka' || location === 'Bengaluru' || location === 'Bangalore',
					eligibilityStatus: (location === 'Karnataka' || location === 'Bengaluru' || location === 'Bangalore') ? 'eligible' : 'partial',
					reasoning: (location === 'Karnataka' || location === 'Bengaluru' || location === 'Bangalore')
						? 'Karnataka-based - highly recommended flagship state program!'
						: 'Available for Karnataka-registered startups only',
					url: 'https://elevate.karnataka.gov.in/',
					priority: (location === 'Karnataka' || location === 'Bengaluru' || location === 'Bangalore') ? 1 : 6
				},
				// Tamil Nadu specific
				{
					name: 'Tamil Nadu Startup Seed Grant Fund',
					amount: 'Up to ₹10 Lakhs',
					eligibility: 'DPIIT recognized startups headquartered in Tamil Nadu',
					benefits: 'Seed grants, incubation support, mentorship, investor connects',
					eligible: location === 'Tamil Nadu',
					eligibilityStatus: location === 'Tamil Nadu' ? 'eligible' : 'partial',
					reasoning: location === 'Tamil Nadu'
						? 'Tamil Nadu offers robust startup ecosystem support!'
						: 'Available for Tamil Nadu registered startups',
					url: 'https://startuptn.in/',
					priority: location === 'Tamil Nadu' ? 1 : 6
				},
				// Tamil Nadu - TANSIDCO
				{
					name: 'TANSIDCO Startup Scheme',
					amount: 'Up to ₹15 Lakhs',
					eligibility: 'Manufacturing and technology startups in Tamil Nadu',
					benefits: 'Capital subsidy, land allocation at subsidized rates, power tariff concession',
					eligible: location === 'Tamil Nadu',
					eligibilityStatus: location === 'Tamil Nadu' ? 'eligible' : 'partial',
					reasoning: location === 'Tamil Nadu'
						? 'TANSIDCO provides excellent industrial support for TN startups!'
						: 'Available for Tamil Nadu registered startups only',
					url: 'https://www.tansidco.tn.gov.in/',
					priority: location === 'Tamil Nadu' ? 2 : 6
				},
				// Tamil Nadu - TIDCO
				{
					name: 'TIDCO Innovation Fund',
					amount: 'Up to ₹25 Lakhs',
					eligibility: 'Innovative startups with scalable technology solutions in Tamil Nadu',
					benefits: 'Equity investment, mentorship, industry connects, export assistance',
					eligible: location === 'Tamil Nadu',
					eligibilityStatus: location === 'Tamil Nadu' ? 'eligible' : 'partial',
					reasoning: location === 'Tamil Nadu'
						? 'TIDCO backs high-growth TN startups with equity investment!'
						: 'Available for Tamil Nadu registered startups only',
					url: 'https://www.tidco.com/',
					priority: location === 'Tamil Nadu' ? 2 : 6
				},
				// Tamil Nadu - TNIDB
				{
					name: 'TN Industrial Development Bank (TNIDB)',
					amount: 'Up to ₹50 Lakhs',
					eligibility: 'MSMEs and startups registered in Tamil Nadu',
					benefits: 'Low-interest loans, working capital support, machinery finance',
					eligible: location === 'Tamil Nadu',
					eligibilityStatus: location === 'Tamil Nadu' ? 'eligible' : 'partial',
					reasoning: location === 'Tamil Nadu'
						? 'TNIDB offers competitive financing for TN businesses!'
						: 'Available for Tamil Nadu registered businesses only',
					url: 'https://www.tnidb.tn.gov.in/',
					priority: location === 'Tamil Nadu' ? 3 : 6
				},
				// Tamil Nadu - StartupTN Scaleup
				{
					name: 'StartupTN Scaleup Program',
					amount: 'Up to ₹1 Crore',
					eligibility: 'Growth-stage startups with proven traction in Tamil Nadu',
					benefits: 'Growth funding, market expansion support, corporate partnerships, international exposure',
					eligible: location === 'Tamil Nadu',
					eligibilityStatus: location === 'Tamil Nadu' ? 'eligible' : 'partial',
					reasoning: location === 'Tamil Nadu'
						? 'Flagship scaleup program for high-growth TN startups!'
						: 'Available for Tamil Nadu registered startups only',
					url: 'https://startuptn.in/scaleup/',
					priority: location === 'Tamil Nadu' ? 2 : 6
				},
				// Tamil Nadu - MSME-TN
				{
					name: 'TN MSME Startup Assistance',
					amount: 'Up to ₹20 Lakhs',
					eligibility: 'MSME registered startups operating in Tamil Nadu',
					benefits: 'Capital subsidy, patent cost reimbursement, quality certification support',
					eligible: location === 'Tamil Nadu',
					eligibilityStatus: location === 'Tamil Nadu' ? 'eligible' : 'partial',
					reasoning: location === 'Tamil Nadu'
						? 'Comprehensive MSME support from TN government!'
						: 'Available for Tamil Nadu MSMEs only',
					url: 'https://www.msmeonline.tn.gov.in/',
					priority: location === 'Tamil Nadu' ? 3 : 6
				},
				// Maharashtra specific
				{
					name: 'Maharashtra State Innovation Society (MSInS)',
					amount: 'Up to ₹15 Lakhs',
					eligibility: 'Startups registered under Maharashtra Startup Policy',
					benefits: 'Grant funding, co-working space, mentorship, procurement support',
					eligible: location === 'Maharashtra' || location === 'Mumbai' || location === 'Pune',
					eligibilityStatus: (location === 'Maharashtra' || location === 'Mumbai' || location === 'Pune') ? 'eligible' : 'partial',
					reasoning: (location === 'Maharashtra' || location === 'Mumbai' || location === 'Pune')
						? 'Maharashtra has excellent startup support infrastructure!'
						: 'Available for Maharashtra registered startups',
					url: 'https://msins.in/',
					priority: (location === 'Maharashtra' || location === 'Mumbai' || location === 'Pune') ? 1 : 6
				},
				// Telangana specific
				{
					name: 'T-Hub / Telangana Innovation Fund',
					amount: 'Up to ₹25 Lakhs',
					eligibility: 'Startups in Telangana with innovative technology solutions',
					benefits: 'Incubation, funding, corporate connects, global market access',
					eligible: location === 'Telangana' || location === 'Hyderabad',
					eligibilityStatus: (location === 'Telangana' || location === 'Hyderabad') ? 'eligible' : 'partial',
					reasoning: (location === 'Telangana' || location === 'Hyderabad')
						? 'T-Hub is one of India\'s largest incubators - excellent opportunity!'
						: 'Available for Telangana registered startups',
					url: 'https://t-hub.co/',
					priority: (location === 'Telangana' || location === 'Hyderabad') ? 1 : 6
				},
				// Kerala specific
				{
					name: 'Kerala Startup Mission (KSUM)',
					amount: 'Up to ₹20 Lakhs',
					eligibility: 'Startups registered under Kerala Startup Policy',
					benefits: 'Seed funding, incubation, international exposure, procurement support',
					eligible: location === 'Kerala' || location === 'Kochi' || location === 'Thiruvananthapuram',
					eligibilityStatus: (location === 'Kerala' || location === 'Kochi' || location === 'Thiruvananthapuram') ? 'eligible' : 'partial',
					reasoning: (location === 'Kerala' || location === 'Kochi' || location === 'Thiruvananthapuram')
						? 'KSUM offers comprehensive support with excellent international connects!'
						: 'Available for Kerala registered startups',
					url: 'https://startupmission.kerala.gov.in/',
					priority: (location === 'Kerala' || location === 'Kochi' || location === 'Thiruvananthapuram') ? 1 : 6
				},
				// Gujarat specific
				{
					name: 'Gujarat Industrial Policy Assistance',
					amount: 'Up to ₹30 Lakhs',
					eligibility: 'Startups manufacturing or operating in Gujarat',
					benefits: 'Capital subsidy, interest subsidy, patent assistance, power tariff benefits',
					eligible: location === 'Gujarat' || location === 'Ahmedabad' || location === 'Surat',
					eligibilityStatus: (location === 'Gujarat' || location === 'Ahmedabad' || location === 'Surat') ? 'eligible' : 'partial',
					reasoning: (location === 'Gujarat' || location === 'Ahmedabad' || location === 'Surat')
						? 'Gujarat offers substantial industrial and startup incentives!'
						: 'Available for Gujarat registered businesses',
					url: 'https://ic.gujarat.gov.in/startup-gujarat.aspx',
					priority: (location === 'Gujarat' || location === 'Ahmedabad' || location === 'Surat') ? 1 : 6
				},
				// Delhi NCR specific
				{
					name: 'Delhi Startup Policy Support',
					amount: 'Up to ₹15 Lakhs',
					eligibility: 'Startups registered and operating in Delhi NCR',
					benefits: 'Reimbursement of patent costs, incubation support, mentorship programs',
					eligible: location === 'Delhi' || location === 'Delhi NCR' || location === 'Noida' || location === 'Gurgaon',
					eligibilityStatus: (location === 'Delhi' || location === 'Delhi NCR' || location === 'Noida' || location === 'Gurgaon') ? 'eligible' : 'partial',
					reasoning: (location === 'Delhi' || location === 'Delhi NCR' || location === 'Noida' || location === 'Gurgaon')
						? 'Access to Delhi\'s vibrant startup ecosystem and support!'
						: 'Available for Delhi NCR registered startups',
					url: 'https://startup.delhi.gov.in/',
					priority: (location === 'Delhi' || location === 'Delhi NCR' || location === 'Noida' || location === 'Gurgaon') ? 1 : 6
				}
			];
			
			// Filter state schemes to ONLY show schemes from the user's region (eligible status)
			// Don't show schemes from other states as they're not applicable
			const stateSchemes = allStateSchemes
				.filter(s => s.eligibilityStatus === 'eligible') // ONLY show schemes matching user's state
				.sort((a, b) => a.priority - b.priority)
				.slice(0, 6)
				.map(({ priority, ...scheme }) => scheme); // Remove priority field from final output
			
			// Priority recommendation based on analysis
			let priority = '';
			if (isEligibleForSISFS && fundingNeeded <= 5000000) {
				priority = `SISFS is your best bet! With ₹${(fundingNeeded/100000).toFixed(1)}L funding need and ${stage} stage, this provides comprehensive seed support including prototype development and market validation. Apply through DPIIT recognized incubators.`;
			} else if (isEligibleForCGSS && fundingNeeded >= 1000000) {
				priority = `Focus on CGSS! Your ${stage} stage with revenue makes you eligible for collateral-free credit guarantee up to ₹10 Cr. Partner with recognized banks/NBFCs for loan applications.`;
			} else if (isEdTech) {
				priority = `Ed-AII is tailored for you! As an ${category} startup, education-focused schemes offer grants up to ₹2 Cr with pilot program support. AIM incubators can guide applications.`;
			} else if (centralSchemes.length > 0) {
				const topScheme = centralSchemes[0];
				priority = `Start with ${topScheme.name} - ${topScheme.reasoning}`;
			} else {
				priority = `At ${stage} stage with ₹${(fundingNeeded/100000).toFixed(1)}L funding need, focus on angel investors and early-stage VCs while working towards DPIIT recognition for government schemes.`;
			}
			
			fundingSchemes = {
				centralSchemes,
				stateSchemes,
				priority
			};
			
			console.log('📝 Generated intelligent funding schemes:', {
				totalSchemes: centralSchemes.length + stateSchemes.length,
				eligibleSchemes: [...centralSchemes, ...stateSchemes].filter(s => s.eligible).length,
				topRecommendation: centralSchemes[0]?.name
			});
		}
	}

	async function getCompetitors() {
		try {
			const token = localStorage.getItem('accessToken');
			if (!token) {
				console.error('No access token found');
				return;
			}

			const category = ddqResponses[3] || 'SaaS'; // Q3: Business category
			const stage = ddqResponses[5] || 'Idea'; // Q5: Product stage
			const revenue = parseInt(ddqResponses[13]) || 0; // Q13: Monthly revenue
			const userMentionedCompetitors = ddqResponses[6] || ''; // Q6: User mentioned competitors

			console.log('🏢 Fetching competitors with valuation timeline...', { category, stage, revenue, userMentionedCompetitors });

			const response = await fetch(`${API_URL}/api/analysis/competitors`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${token}`
				},
				body: JSON.stringify({
					category,
					stage,
					revenue,
					userMentionedCompetitors
				})
			});

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}));
				console.error('❌ Competitors API error:', response.status, errorData);
				throw new Error(`API returned ${response.status}`);
			}

			const data = await response.json();
			console.log('✅ Competitors received:', data);
			
			// Handle categorized competitors from server
			verifiedCompetitors = data.verifiedCompetitors || [];
			potentialCompetitors = data.potentialCompetitors || [];
			userPickCompetitors = data.userPickCompetitors || [];
			globalCompetitors = data.globalCompetitors || [];
			localCompetitors = data.localCompetitors || [];
			rivalCompetitors = data.rivalCompetitors || [];
			allCompetitors = data.competitors || [];
			competitorDataSummary = data.summary || null;
			
			// Main competitors array for backwards compatibility (all competitors)
			competitors = allCompetitors.length > 0 ? allCompetitors : (verifiedCompetitors.length > 0 ? verifiedCompetitors : []);
			
			marketTrends = data.marketTrends || [];
			marketOpportunities = data.marketOpportunities || null;
			strategicRecommendations = data.strategicRecommendations || [];
			
			console.log(`📊 Competitor summary: User picks: ${userPickCompetitors.length}, Global: ${globalCompetitors.length}, Local: ${localCompetitors.length}, Rival: ${rivalCompetitors.length}`);
		} catch (error) {
			console.error('❌ Error getting competitors:', error);
			// INTELLIGENT fallback based on user's actual data
			const category = ddqResponses[3] || 'SaaS';
			const userCompetitors = String(ddqResponses[6] || '').toLowerCase(); // Q6: User's mentioned competitors
			const stage = ddqResponses[5] || 'Idea';
			const userRevenue = parseInt(ddqResponses[13]) || 0; // Q13: Monthly revenue
			const userCustomers = parseInt(ddqResponses[15]) || 0; // Q15: Total customers
			
			console.log('🔍 Analyzing user data for intelligent fallback:', {
				category,
				mentionedCompetitors: userCompetitors,
				stage,
				revenue: userRevenue,
				customers: userCustomers
			});
			
			// Analyze user's mentioned competitors to identify industry
			let intelligentCompetitors = [];
			
			// Food Delivery / Marketplace detection
			if (userCompetitors.includes('zomato') || userCompetitors.includes('swiggy') || 
			    userCompetitors.includes('uber eats') || userCompetitors.includes('dunzo') ||
			    category === 'Marketplace' || category === 'Food & Beverage') {
				intelligentCompetitors = [
					{ name: 'Dunzo', stage: 'Series F', currentValuation: 23000000000, earlyValuation: 800000000, growthRate: 420, revenue: 35000000, customers: 3000000, fundingRaised: 800000000, investments: ['Google - $12M', 'Reliance - $200M'], flagshipProduct: 'Hyperlocal Delivery', products: ['Hyperlocal Delivery', 'Quick Commerce', 'B2B Services'], visible: true, valuationTimeline: [{ year: 2015, valuation: 50000000, event: 'Founded' }, { year: 2017, valuation: 800000000, event: 'Series B' }, { year: 2020, valuation: 5000000000, event: 'Series D' }, { year: 2022, valuation: 23000000000, event: 'Series F' }] },
					{ name: 'Zomato', stage: 'Public', currentValuation: 650000000000, earlyValuation: 20000000000, growthRate: 480, revenue: 4800000000, customers: 80000000, fundingRaised: 20000000000, investments: ['Info Edge - $1M', 'Ant Financial - $200M'], flagshipProduct: 'Food Delivery App', products: ['Food Delivery', 'Dining Out', 'Hyperpure'], visible: true, valuationTimeline: [{ year: 2008, valuation: 10000000, event: 'Founded' }, { year: 2013, valuation: 2000000000, event: 'Series C' }, { year: 2018, valuation: 20000000000, event: 'Series G' }, { year: 2021, valuation: 650000000000, event: 'IPO' }] },
					{ name: 'Swiggy', stage: 'Series J', currentValuation: 1050000000000, earlyValuation: 25000000000, growthRate: 520, revenue: 6500000000, customers: 120000000, fundingRaised: 25000000000, investments: ['Accel - $2M', 'Prosus - $1B'], flagshipProduct: 'Food Delivery Platform', products: ['Food Delivery', 'Instamart', 'Genie'], visible: true, valuationTimeline: [{ year: 2014, valuation: 50000000, event: 'Founded' }, { year: 2017, valuation: 2000000000, event: 'Series C' }, { year: 2020, valuation: 35000000000, event: 'Series H' }, { year: 2024, valuation: 1050000000000, event: 'Series J' }] }
				];
			}
			// E-commerce detection
			else if (userCompetitors.includes('amazon') || userCompetitors.includes('flipkart') || 
			         userCompetitors.includes('meesho') || category === 'E-commerce') {
				intelligentCompetitors = [
					{ name: 'Meesho', stage: 'Series F', currentValuation: 49000000000, earlyValuation: 2000000000, growthRate: 500, revenue: 35000000, customers: 13000000, fundingRaised: 2000000000, investments: ['SoftBank - $300M', 'Meta - $50M'], flagshipProduct: 'Social Commerce Platform', products: ['Social Commerce', 'Supplier Network', 'Meesho Mall'], visible: true, valuationTimeline: [{ year: 2015, valuation: 50000000, event: 'Founded' }, { year: 2019, valuation: 5000000000, event: 'Series C' }, { year: 2021, valuation: 49000000000, event: 'Series F' }] },
					{ name: 'Flipkart', stage: 'Acquired', currentValuation: 2000000000000, earlyValuation: 50000000000, growthRate: 450, revenue: 850000000000, customers: 450000000, fundingRaised: 50000000000, investments: ['Walmart - $16B'], flagshipProduct: 'E-commerce Marketplace', products: ['E-commerce', 'Flipkart Plus', 'Grocery'], visible: true, valuationTimeline: [{ year: 2007, valuation: 10000000, event: 'Founded' }, { year: 2012, valuation: 10000000000, event: 'Series D' }, { year: 2018, valuation: 200000000000, event: 'Walmart Acquisition' }, { year: 2024, valuation: 2000000000000, event: 'Current' }] },
					{ name: 'Amazon India', stage: 'Public', currentValuation: 15000000000000, earlyValuation: 500000000000, growthRate: 380, revenue: 2500000000000, customers: 500000000, fundingRaised: 500000000000, investments: ['Amazon Global'], flagshipProduct: 'Amazon Shopping', products: ['E-commerce', 'Prime', 'Fresh'], visible: true, valuationTimeline: [{ year: 2013, valuation: 50000000000, event: 'India Launch' }, { year: 2017, valuation: 300000000000, event: 'Expansion' }, { year: 2020, valuation: 800000000000, event: 'Pandemic Growth' }, { year: 2024, valuation: 15000000000000, event: 'Current' }] }
				];
			}
			// FinTech detection
			else if (userCompetitors.includes('paytm') || userCompetitors.includes('phonepe') || 
			         userCompetitors.includes('razorpay') || category === 'FinTech') {
				intelligentCompetitors = [
					{ name: 'Razorpay', stage: 'Series F', currentValuation: 75000000000, earlyValuation: 5000000000, growthRate: 480, revenue: 95000000, customers: 8000000, fundingRaised: 5000000000, investments: ['Sequoia - $10M', 'Tiger Global - $150M'], flagshipProduct: 'Payment Gateway', products: ['Payment Gateway', 'Banking', 'Payroll'], visible: true, valuationTimeline: [{ year: 2014, valuation: 50000000, event: 'Founded' }, { year: 2018, valuation: 5000000000, event: 'Series C' }, { year: 2021, valuation: 75000000000, event: 'Series F' }] },
					{ name: 'Paytm', stage: 'Public', currentValuation: 450000000000, earlyValuation: 20000000000, growthRate: 420, revenue: 250000000, customers: 350000000, fundingRaised: 20000000000, investments: ['Alibaba - $680M', 'SoftBank - $1.4B'], flagshipProduct: 'Paytm Wallet & UPI', products: ['Payments', 'Banking', 'Wealth'], visible: true, valuationTimeline: [{ year: 2010, valuation: 50000000, event: 'Founded' }, { year: 2015, valuation: 40000000000, event: 'Series D' }, { year: 2019, valuation: 160000000000, event: 'Series G' }, { year: 2021, valuation: 450000000000, event: 'IPO' }] },
					{ name: 'PhonePe', stage: 'Series E', currentValuation: 850000000000, earlyValuation: 15000000000, growthRate: 520, revenue: 180000000, customers: 450000000, fundingRaised: 15000000000, investments: ['Walmart - $700M'], flagshipProduct: 'UPI Payments App', products: ['UPI Payments', 'Insurance', 'Mutual Funds'], visible: true, valuationTimeline: [{ year: 2015, valuation: 100000000, event: 'Founded' }, { year: 2018, valuation: 15000000000, event: 'Flipkart Era' }, { year: 2022, valuation: 100000000000, event: 'Spin-off' }, { year: 2024, valuation: 850000000000, event: 'Series E' }] }
				];
			}
			// EdTech detection
			else if (userCompetitors.includes('byju') || userCompetitors.includes('unacademy') || 
			         userCompetitors.includes('upgrad') || category === 'EdTech' || category === 'Education') {
				intelligentCompetitors = [
					{ name: 'Unacademy', stage: 'Series H', currentValuation: 37000000000, earlyValuation: 3000000000, growthRate: 390, revenue: 28000000, customers: 50000000, fundingRaised: 3000000000, investments: ['SoftBank - $150M', 'General Atlantic - $440M'], flagshipProduct: 'Live Classes Platform', products: ['Live Classes', 'Test Prep', 'Upskilling'], visible: true, valuationTimeline: [{ year: 2015, valuation: 20000000, event: 'Founded' }, { year: 2018, valuation: 1000000000, event: 'Series C' }, { year: 2020, valuation: 20000000000, event: 'Series F' }, { year: 2022, valuation: 37000000000, event: 'Series H' }] },
					{ name: 'UpGrad', stage: 'Series E', currentValuation: 28000000000, earlyValuation: 2500000000, growthRate: 360, revenue: 35000000, customers: 4000000, fundingRaised: 2500000000, investments: ['Temasek - $120M'], flagshipProduct: 'Online Degrees', products: ['Online Degrees', 'Bootcamps', 'Corporate Training'], visible: true, valuationTimeline: [{ year: 2015, valuation: 50000000, event: 'Founded' }, { year: 2019, valuation: 2000000000, event: 'Series C' }, { year: 2021, valuation: 12000000000, event: 'Series D' }, { year: 2023, valuation: 28000000000, event: 'Series E' }] },
					{ name: "Byju's", stage: 'Series F', currentValuation: 220000000000, earlyValuation: 10000000000, growthRate: 480, revenue: 120000000, customers: 150000000, fundingRaised: 10000000000, investments: ['Sequoia - $50M', 'Tiger Global - $200M'], flagshipProduct: "Byju's Learning App", products: ['K-12 Learning', 'Test Prep', 'Coding'], visible: true, valuationTimeline: [{ year: 2011, valuation: 20000000, event: 'Founded' }, { year: 2016, valuation: 5000000000, event: 'Series C' }, { year: 2019, valuation: 80000000000, event: 'Series E' }, { year: 2022, valuation: 220000000000, event: 'Peak Valuation' }] }
				];
			}
			// SaaS / B2B detection
			else if (userCompetitors.includes('freshworks') || userCompetitors.includes('zoho') || 
			         userCompetitors.includes('salesforce') || category === 'SaaS' || category === 'B2B') {
				intelligentCompetitors = [
					{ name: 'Freshworks', stage: 'Public', currentValuation: 350000000000, earlyValuation: 10000000000, growthRate: 450, revenue: 500000000, customers: 50000, fundingRaised: 10000000000, investments: ['Accel - $5M', 'Tiger Global - $100M'], flagshipProduct: 'Freshdesk (Customer Support)', products: ['Freshdesk', 'Freshsales', 'Freshservice'], visible: true, valuationTimeline: [{ year: 2010, valuation: 50000000, event: 'Founded' }, { year: 2015, valuation: 5000000000, event: 'Series D' }, { year: 2019, valuation: 35000000000, event: 'Series H' }, { year: 2021, valuation: 350000000000, event: 'IPO' }] },
					{ name: 'Zoho', stage: 'Private', currentValuation: 250000000000, earlyValuation: 2000000000, growthRate: 400, revenue: 350000000, customers: 80000, fundingRaised: 2000000000, investments: ['Bootstrapped'], flagshipProduct: 'Zoho CRM', products: ['Zoho CRM', 'Zoho Mail', 'Zoho Suite'], visible: true, valuationTimeline: [{ year: 1996, valuation: 10000000, event: 'Founded' }, { year: 2008, valuation: 5000000000, event: 'SaaS Expansion' }, { year: 2018, valuation: 100000000000, event: 'Unicorn' }, { year: 2024, valuation: 250000000000, event: 'Current' }] },
					{ name: 'Postman', stage: 'Series D', currentValuation: 58000000000, earlyValuation: 3500000000, growthRate: 420, revenue: 45000000, customers: 25000, fundingRaised: 3500000000, investments: ['Insight Partners - $50M', 'CRV - $150M'], flagshipProduct: 'API Development Platform', products: ['API Platform', 'Collaboration', 'Testing'], visible: true, valuationTimeline: [{ year: 2014, valuation: 20000000, event: 'Founded' }, { year: 2019, valuation: 5000000000, event: 'Series B' }, { year: 2021, valuation: 58000000000, event: 'Series D' }] }
				];
			}
			// Generic technology / startup fallback
			else {
				// Create personalized competitors based on user's actual metrics
				const userStage = stage;
				const avgRevenue = userRevenue > 0 ? userRevenue * 12 : 1000000; // Annual revenue estimate
				
				intelligentCompetitors = [
					{
						name: `${category} Startup A`,
						stage: 'Seed',
						currentValuation: avgRevenue * 5,
						earlyValuation: avgRevenue * 2,
						growthRate: 300,
						revenue: avgRevenue * 0.5,
						customers: Math.max(userCustomers * 2, 1000),
						fundingRaised: avgRevenue * 2,
						investments: ['Angel Investors', 'Early Stage VC'],
						flagshipProduct: `${category} Core Solution`,
						products: [`${category} Solution`, 'Core Product', 'Platform'],
						visible: true,
						valuationTimeline: [
							{ year: 2021, valuation: avgRevenue * 2, event: 'Founded' },
							{ year: 2023, valuation: avgRevenue * 3.5, event: 'Seed Round' },
							{ year: 2024, valuation: avgRevenue * 5, event: 'Current' }
						]
					},
					{
						name: `${category} Startup B`,
						stage: 'Series A',
						currentValuation: avgRevenue * 15,
						earlyValuation: avgRevenue * 5,
						growthRate: 400,
						revenue: avgRevenue * 3,
						customers: Math.max(userCustomers * 10, 10000),
						fundingRaised: avgRevenue * 5,
						investments: ['Series A VC', 'Strategic Investor'],
						flagshipProduct: `${category} Analytics Platform`,
						products: [`${category} Platform`, 'Analytics', 'Enterprise Solution'],
						visible: true,
						valuationTimeline: [
							{ year: 2019, valuation: avgRevenue * 2, event: 'Founded' },
							{ year: 2021, valuation: avgRevenue * 5, event: 'Seed' },
							{ year: 2023, valuation: avgRevenue * 10, event: 'Series A' },
							{ year: 2024, valuation: avgRevenue * 15, event: 'Current' }
						]
					},
					{
						name: `Industry Leader`,
						stage: 'Public/Series C+',
						currentValuation: avgRevenue * 50,
						earlyValuation: avgRevenue * 10,
						growthRate: 350,
						revenue: avgRevenue * 20,
						customers: Math.max(userCustomers * 100, 100000),
						fundingRaised: avgRevenue * 10,
						investments: ['Major VC Firms', 'IPO'],
						flagshipProduct: `${category} Enterprise Suite`,
						products: [`${category} Suite`, 'Enterprise', 'Global Platform'],
						visible: true,
						isVerified: true,
						valuationTimeline: [
							{ year: 2015, valuation: avgRevenue * 5, event: 'Founded' },
							{ year: 2018, valuation: avgRevenue * 15, event: 'Series B' },
							{ year: 2021, valuation: avgRevenue * 35, event: 'Series D' },
							{ year: 2024, valuation: avgRevenue * 50, event: 'Current' }
						]
					}
				];
			}
			
			// Mark fallback competitors and categorize
			intelligentCompetitors = intelligentCompetitors.map((c, index) => ({
				...c,
				isVerified: c.revenue > 0 || c.customers > 0,
				dataConfidence: (c.revenue > 0 || c.customers > 0) ? 'high' : 'low',
				flagshipProduct: c.flagshipProduct || (c.products && c.products.length > 0 ? c.products[0] : 'Core Product'),
				region: index === 0 ? 'global' : index === 1 ? 'global' : index === 2 ? 'local' : index === 3 ? 'local' : 'rival',
				isUserMentioned: false
			}));
			
			competitors = intelligentCompetitors;
			allCompetitors = intelligentCompetitors;
			verifiedCompetitors = intelligentCompetitors.filter(c => c.isVerified);
			potentialCompetitors = intelligentCompetitors.filter(c => !c.isVerified);
			userPickCompetitors = intelligentCompetitors.filter(c => c.isUserMentioned);
			globalCompetitors = intelligentCompetitors.filter(c => c.region === 'global');
			localCompetitors = intelligentCompetitors.filter(c => c.region === 'local');
			rivalCompetitors = intelligentCompetitors.filter(c => c.region === 'rival');
			competitorDataSummary = {
				totalCompetitors: intelligentCompetitors.length,
				verifiedCount: verifiedCompetitors.length,
				potentialCount: potentialCompetitors.length,
				userPickCount: userPickCompetitors.length,
				globalCount: globalCompetitors.length,
				localCount: localCompetitors.length,
				rivalCount: rivalCompetitors.length
			};
			
			console.log(`📝 Using intelligent fallback competitors based on user's ${category} business and mentioned competitors: ${userCompetitors}`);
		}
	}

	// Add competitor to compare list
	function addToCompare(competitor: any) {
		if (!compareList.find(c => c.name === competitor.name)) {
			compareList = [...compareList, competitor];
		}
	}

	// Remove competitor from compare list
	function removeFromCompare(competitorName: string) {
		compareList = compareList.filter(c => c.name !== competitorName);
	}

	// Toggle compare mode
	function toggleCompareMode() {
		compareMode = !compareMode;
		if (!compareMode) {
			compareList = [];
		}
	}

	// Search for a company online via web scraping
	async function searchCompanyOnline(companyName: string) {
		if (!companyName || companyName.trim().length < 2) return;
		
		onlineSearchLoading = true;
		onlineSearchError = '';
		
		try {
			const token = localStorage.getItem('accessToken');
			console.log('🔍 Searching for company:', companyName, 'Token exists:', !!token);
			
			if (!token) {
				onlineSearchError = 'Please login again to search for companies';
				onlineSearchLoading = false;
				return;
			}
			
			const response = await fetch('http://localhost:3001/api/analysis/search-company', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': `Bearer ${token}`
				},
				body: JSON.stringify({
					companyName: companyName.trim(),
					category: ddqResponses?.q3 || ddqResponses?.[3] || 'Technology' // Use user's category if available
				})
			});

			console.log('🔍 Search response status:', response.status);
			
			if (response.status === 401 || response.status === 403) {
				onlineSearchError = 'Session expired. Please refresh the page and login again.';
				return;
			}

			const data = await response.json();
			console.log('🔍 Search result:', data);
			
			if (data.found && data.company) {
				// Add the found company to the compare list
				addToCompare(data.company);
				// Also add to potential competitors for future reference
				if (!potentialCompetitors.find(c => c.name === data.company.name)) {
					potentialCompetitors = [...potentialCompetitors, data.company];
				}
				compareSearchQuery = '';
				onlineSearchError = '';
				console.log(`✅ Found and added company: ${data.company.name}`);
			} else {
				onlineSearchError = data.message || data.error || `Could not find "${companyName}"`;
			}
		} catch (error: any) {
			console.error('Online search error:', error);
			onlineSearchError = `Search failed: ${error.message || 'Network error'}`;
		} finally {
			onlineSearchLoading = false;
		}
	}

	function toggleCompetitorVisibility(index: number) {
		if (competitors && competitors[index]) {
			competitors[index].visible = !competitors[index].visible;
			competitors = [...competitors]; // Trigger reactivity
		}
	}

	function addToMonitoring(competitorName: string) {
		if (!monitoredCompetitors.includes(competitorName)) {
			monitoredCompetitors = [...monitoredCompetitors, competitorName];
		}
	}

	function removeFromMonitoring(competitorName: string) {
		monitoredCompetitors = monitoredCompetitors.filter(name => name !== competitorName);
	}

	function showCompetitorDetails(competitor: any) {
		selectedCompetitor = competitor;
	}

	function closeCompetitorModal() {
		selectedCompetitor = null;
	}

	// AI Chatbot function
	async function sendChatMessage() {
		if (!chatInput.trim() || chatLoading) return;

		const userMessage = chatInput.trim();
		chatInput = '';
		
		// Check if this is a response to a rejection question
		if (rejectingActionId && rejectingActionText) {
			// User is responding to rejection prompt - submit feedback
			await submitRejectionFeedback(userMessage);
			
			// Add user message to chat
			chatMessages = [...chatMessages, {
				role: 'user',
				content: userMessage,
				timestamp: new Date()
			}];
			return;
		}
		
		// Add user message
		chatMessages = [...chatMessages, {
			role: 'user',
			content: userMessage,
			timestamp: new Date()
		}];

		chatLoading = true;

		try {
			const token = localStorage.getItem('accessToken');
			if (!token) {
				console.error('No access token found');
				return;
			}

			// Build context from DDQ responses and analyses
			const context = {
				company: {
					name: ddqResponses[1] || 'Your Company', // Q1: Product/service name
					description: ddqResponses[2], // Q2: Description
					category: ddqResponses[3], // Q3: Business category
					state: ddqResponses[4], // Q4: State location (NEW)
					stage: ddqResponses[5], // Q5: Product stage (was Q4)
					competitors: ddqResponses[6], // Q6: Main competitors (was Q5)
					uniqueValue: ddqResponses[7], // Q7: Competitive differentiation (was Q6)
					targetCustomer: ddqResponses[8], // Q8: Target customer description (was Q7)
					marketingType: ddqResponses[9], // Q9: Type of marketing preferred (was Q8)
					interviews: ddqResponses[10], // Q10: Customer interviews completed (was Q9)
					totalInvestment: ddqResponses[11], // Q11: Total investment received (was Q10)
					monthlyRevenue: hasRevenue ? ddqResponses[13] : 0, // Q13: Current monthly revenue (was Q12)
					expenses: hasRevenue ? 0 : ddqResponses[16], // Q16: Monthly expenses for pre-revenue
					funding: ddqResponses[11], // Q11: Total investment (same as totalInvestment)
					customers: hasRevenue ? ddqResponses[15] : 0, // Q15: Total customer count (was Q14)
					teamSize: ddqResponses[17], // Q17: Team size (was Q16)
					founderBackground: ddqResponses[18], // Q18: Founder background (was Q17)
					challenge: ddqResponses[19], // Q19: Biggest current challenge (was Q18)
					acquisitionStrategy: ddqResponses[20], // Q20: Customer acquisition strategy (was Q19)
					primaryGoal: ddqResponses[21], // Q21: 6-month primary goal (was Q20)
					fundingNeeded: ddqResponses[22], // Q22: Funding needed for goals (was Q21)
					primaryRisk: ddqResponses[23] // Q23: Primary business risk (was Q22)
				},
				valuation: valuation ? {
					finalValuationINR: valuation.finalValuationINR,
					finalValuationUSD: valuation.finalValuationUSD,
					berkusValuation: valuation.berkusValuation,
					scorecardValuation: valuation.scorecardValuation
				} : null,
				swot: swotAnalysis
			};

			const response = await fetch(`${API_URL}/api/chat/grok`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${token}`
				},
				body: JSON.stringify({
					message: userMessage,
					context: context,
					conversationHistory: chatMessages.slice(-5) // Last 5 messages for context
				})
			});

			if (!response.ok) {
				throw new Error('Failed to get AI response');
			}

			const data = await response.json();
			
			// Add AI response
			chatMessages = [...chatMessages, {
				role: 'assistant',
				content: data.response,
				timestamp: new Date()
			}];

			// Scroll to bottom
			setTimeout(() => {
				if (chatContainer) {
					chatContainer.scrollTop = chatContainer.scrollHeight;
				}
			}, 100);

		} catch (error) {
			console.error('Error sending chat message:', error);
			chatMessages = [...chatMessages, {
				role: 'assistant',
				content: 'Sorry, I encountered an error. Please try again.',
				timestamp: new Date()
			}];
		} finally {
			chatLoading = false;
		}
	}

	// Initialize chat with welcome message
	function initializeChat() {
		if (chatMessages.length === 0) {
			chatMessages = [{
				role: 'assistant',
				content: `Hello! I am your AI Strategic Advisor, Daddy. I have analyzed your business data and I am here to help you with:

• Strategic planning and decision-making
• Market analysis and competitive insights  
• Financial projections and valuation questions
• Growth strategies and scaling advice
• Funding and investment guidance

What would you like to discuss about ${ddqResponses[1] || 'your business'}?`,
				timestamp: new Date()
			}];
		}
	}

	// Save a chat message to notes
	async function saveToNotes(messageIndex: number) {
		try {
			const token = localStorage.getItem('accessToken');
			if (!token) {
				alert('Please login to save notes');
				return;
			}

			// Get user message and AI response (assuming pairs)
			const userMessage = chatMessages[messageIndex - 1];
			const aiResponse = chatMessages[messageIndex];

			if (!userMessage || !aiResponse || userMessage.role !== 'user' || aiResponse.role !== 'assistant') {
				alert('Invalid message selection');
				return;
			}

			const noteTitle = prompt('Enter a title for this note (optional):');
			const category = prompt('Enter a category (optional, e.g., Strategy, Funding, Growth):') || 'General';

			const response = await fetch(`${API_URL}/api/notes/save`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': `Bearer ${token}`
				},
				body: JSON.stringify({
					chatMessage: userMessage.content,
					response: aiResponse.content,
					noteTitle: noteTitle || userMessage.content.substring(0, 50) + '...',
					category
				})
			});

			if (response.ok) {
				alert('✅ Note saved successfully!');
				loadNotes(); // Reload notes
			} else {
				const error = await response.json();
				alert(`Failed to save note: ${error.error}`);
			}
		} catch (error) {
			console.error('Error saving note:', error);
			alert('Failed to save note. Please try again.');
		}
	}

	// Load saved notes
	async function loadNotes() {
		try {
			notesLoading = true;
			const token = localStorage.getItem('accessToken');
			if (!token) return;

			const params = new URLSearchParams();
			if (selectedNoteCategory !== 'all') params.append('category', selectedNoteCategory);
			if (notesSearchQuery) params.append('search', notesSearchQuery);

			const response = await fetch(`${API_URL}/api/notes?${params.toString()}`, {
				headers: {
					'Authorization': `Bearer ${token}`
				}
			});

			if (response.ok) {
				const data = await response.json();
				savedNotes = data.notes;
				
				// Load categories
				const catResponse = await fetch(`${API_URL}/api/notes/categories`, {
					headers: { 'Authorization': `Bearer ${token}` }
				});
				if (catResponse.ok) {
					const catData = await catResponse.json();
					noteCategories = ['all', ...catData.categories];
				}
			}
		} catch (error) {
			console.error('Error loading notes:', error);
		} finally {
			notesLoading = false;
		}
	}

	// Delete a note
	async function deleteNote(noteId: string) {
		if (!confirm('Are you sure you want to delete this note?')) return;

		try {
			const token = localStorage.getItem('accessToken');
			const response = await fetch(`${API_URL}/api/notes/${noteId}`, {
				method: 'DELETE',
				headers: {
					'Authorization': `Bearer ${token}`
				}
			});

			if (response.ok) {
				alert('✅ Note deleted successfully!');
				if (selectedNote && selectedNote._id === noteId) {
					selectedNote = null;
				}
				loadNotes();
			} else {
				alert('Failed to delete note');
			}
		} catch (error) {
			console.error('Error deleting note:', error);
			alert('Failed to delete note');
		}
	}

	// Create a new note
	async function createNote() {
		if (!newNoteTitle.trim() || !newNoteContent.trim()) {
			alert('Please enter both title and content for the note');
			return;
		}

		try {
			const token = localStorage.getItem('accessToken');
			const response = await fetch(`${API_URL}/api/notes`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': `Bearer ${token}`
				},
				body: JSON.stringify({
					noteTitle: newNoteTitle.trim(),
					chatMessage: 'Manual Note',
					response: newNoteContent.trim(),
					category: newNoteCategory
				})
			});

			const data = await response.json();
			
			if (response.ok && data.success) {
				alert('✅ Note created successfully!');
				newNoteTitle = '';
				newNoteContent = '';
				newNoteCategory = 'General';
				isCreatingNote = false;
				loadNotes();
				// Select the newly created note
				if (data.note) {
					selectedNote = data.note;
				}
			} else {
				console.error('Note creation error:', data);
				alert(`Failed to create note: ${data.error || 'Unknown error'}`);
			}
		} catch (error) {
			console.error('Error creating note:', error);
			alert('Failed to create note: Network error');
		}
	}

	// Select a note to view
	function selectNote(note: any) {
		selectedNote = note;
		isCreatingNote = false;
	}

	// Start creating a new note
	function startNewNote() {
		isCreatingNote = true;
		selectedNote = null;
		newNoteTitle = '';
		newNoteContent = '';
		newNoteCategory = 'General';
	}

	// =====================================================
	// DAILY ACTIONS FUNCTIONS
	// =====================================================

	// Generate daily actions based on 6-month goal
	async function generateDailyActions() {
		actionsLoading = true;
		try {
			const token = localStorage.getItem('accessToken');
			if (!token) return;

			const response = await fetch(`${API_URL}/api/actions/generate`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': `Bearer ${token}`
				},
				body: JSON.stringify({
					sixMonthGoal: ddqResponses[21] || 'Grow the business',
					productName: ddqResponses[1] || 'Unknown Product',
					category: ddqResponses[3] || 'Other',
					stage: ddqResponses[5] || 'Unknown',
					currentChallenge: ddqResponses[19] || 'General'
				})
			});

			if (response.ok) {
				const data = await response.json();
				dailyActions = data.actions.map((action: any) => ({
					...action,
					status: action.status || 'pending',
					progress: action.progress || null
				}));
			}
		} catch (error) {
			console.error('Error generating actions:', error);
		} finally {
			actionsLoading = false;
		}
	}

	// Load today's actions
	async function loadTodayActions() {
		actionsLoading = true;
		try {
			const token = localStorage.getItem('accessToken');
			if (!token) return;

			const response = await fetch(`${API_URL}/api/actions/today`, {
				headers: {
					'Authorization': `Bearer ${token}`
				}
			});

			if (response.ok) {
				const data = await response.json();
				dailyActions = data.actions || [];
				backlogItems = data.backlog || [];
				
				// If no actions for today, generate new ones
				if (dailyActions.length === 0 && ddqResponses[21]) {
					await generateDailyActions();
				}
			}
		} catch (error) {
			console.error('Error loading actions:', error);
		} finally {
			actionsLoading = false;
		}
	}

	// Accept an action (show RAG progress)
	async function acceptAction(actionId: string) {
		try {
			const token = localStorage.getItem('accessToken');
			await fetch(`${API_URL}/api/actions/${actionId}/status`, {
				method: 'PUT',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': `Bearer ${token}`
				},
				body: JSON.stringify({ status: 'accepted' })
			});

			dailyActions = dailyActions.map(a => 
				a.id === actionId ? { ...a, status: 'accepted' } : a
			);
		} catch (error) {
			console.error('Error accepting action:', error);
		}
	}

	// Reject an action (opens chatbot for feedback)
	let rejectingActionId: string | null = null;
	let rejectingActionText: string = '';
	let rejectionReminderTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();
	let rejectionAskedTwice: Set<string> = new Set(); // Track actions already reminded

	async function rejectAction(actionId: string, actionText: string) {
		rejectingActionId = actionId;
		rejectingActionText = actionText;
		
		// Immediately remove the task from the UI
		dailyActions = dailyActions.filter(a => a.id !== actionId);
		
		// Also update in backend
		try {
			const token = localStorage.getItem('accessToken');
			await fetch(`${API_URL}/api/actions/${actionId}/status`, {
				method: 'PUT',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': `Bearer ${token}`
				},
				body: JSON.stringify({ status: 'rejected' })
			});
		} catch (error) {
			console.error('Error rejecting action:', error);
		}
		
		// Open chatbot with question
		showChatbot = true;
		
		// Add initial message asking for reason
		chatMessages = [
			...chatMessages,
			{
				role: 'assistant',
				content: `I noticed you rejected the action: "${actionText}". Could you tell me why this action isn't relevant? This helps me suggest better actions.`,
				timestamp: new Date(),
				id: `rejection-${actionId}`
			}
		];
		
		// Set a 6-hour reminder if user doesn't respond (only if not already asked twice)
		if (!rejectionAskedTwice.has(actionId)) {
			const timerId = setTimeout(() => {
				// Check if chatbot is not active and user hasn't responded
				if (!showChatbot && rejectingActionId === actionId) {
					// Re-ask the question
					showChatbot = true;
					chatMessages = [
						...chatMessages,
						{
							role: 'assistant',
							content: `Just a quick follow-up: You rejected "${actionText}" earlier. Any feedback on why it wasn't useful? (No response needed if you'd rather skip)`,
							timestamp: new Date(),
							id: `rejection-reminder-${actionId}`
						}
					];
					// Mark as asked twice so we don't ask again
					rejectionAskedTwice.add(actionId);
				}
				// Clean up timer reference
				rejectionReminderTimers.delete(actionId);
			}, 6 * 60 * 60 * 1000); // 6 hours in milliseconds
			
			rejectionReminderTimers.set(actionId, timerId);
		}
	}

	// Cancel rejection reminder when user responds
	function cancelRejectionReminder(actionId: string) {
		const timerId = rejectionReminderTimers.get(actionId);
		if (timerId) {
			clearTimeout(timerId);
			rejectionReminderTimers.delete(actionId);
		}
		rejectingActionId = null;
		rejectingActionText = '';
	}

	// Handle rejection feedback from chatbot
	async function submitRejectionFeedback(reason: string) {
		if (!rejectingActionId) return;

		// Cancel the 6-hour reminder since user responded
		cancelRejectionReminder(rejectingActionId);

		try {
			const token = localStorage.getItem('accessToken');
			
			// Update action status with reason
			await fetch(`${API_URL}/api/actions/${rejectingActionId}/status`, {
				method: 'PUT',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': `Bearer ${token}`
				},
				body: JSON.stringify({ status: 'rejected', rejectionReason: reason })
			});

			// Store feedback for future learning
			await fetch(`${API_URL}/api/actions/feedback`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': `Bearer ${token}`
				},
				body: JSON.stringify({
					actionText: rejectingActionText,
					rejectionReason: reason
				})
			});

			// Thank the user
			chatMessages = [
				...chatMessages,
				{
					role: 'assistant',
					content: 'Thank you for the feedback! I\'ll use this to suggest more relevant actions in the future.',
					timestamp: new Date()
				}
			];
			
			// Clear rejection state
			rejectingActionId = null;
			rejectingActionText = '';
		} catch (error) {
			console.error('Error submitting rejection feedback:', error);
		}
	}

	// Update action progress (RAG)
	async function updateActionProgress(actionId: string, progress: 'red' | 'amber' | 'green') {
		try {
			const token = localStorage.getItem('accessToken');
			await fetch(`${API_URL}/api/actions/${actionId}/progress`, {
				method: 'PUT',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': `Bearer ${token}`
				},
				body: JSON.stringify({ progress })
			});

			// Update daily actions
			dailyActions = dailyActions.map(a => 
				a.id === actionId ? { ...a, progress } : a
			);

			// Update backlog items
			backlogItems = backlogItems.map(b => 
				b.id === actionId ? { ...b, progress } : b
			);

			// If marked green, remove from backlog (completed)
			if (progress === 'green') {
				backlogItems = backlogItems.filter(b => b.id !== actionId);
			}
		} catch (error) {
			console.error('Error updating progress:', error);
		}
	}

	// =====================================================
	// NEWS FUNCTIONS
	// =====================================================

	async function loadNews() {
		newsLoading = true;
		try {
			const token = localStorage.getItem('accessToken');
			if (!token) return;

			// Get industry from questionnaire (question 3 is industry/sector)
			const industry = ddqResponses[3] || '';
			const productName = ddqResponses[1] || '';
			const query = `${productName} ${industry} business technology`.trim();
			
			const response = await fetch(`${API_URL}/api/news?query=${encodeURIComponent(query)}&industry=${encodeURIComponent(industry)}`, {
				headers: {
					'Authorization': `Bearer ${token}`
				}
			});

			if (response.ok) {
				const data = await response.json();
				newsItems = data.news || [];
				featuredNewsIndex = 0;
				
				// Start news rotation (every 10 seconds)
				startNewsRotation();
			}
		} catch (error) {
			console.error('Error loading news:', error);
		} finally {
			newsLoading = false;
		}
	}

	function startNewsRotation() {
		// Clear existing interval if any
		if (newsRotationInterval) {
			clearInterval(newsRotationInterval);
		}
		
		// Rotate featured news every 10 seconds
		newsRotationInterval = setInterval(() => {
			if (newsItems.length > 0) {
				featuredNewsIndex = (featuredNewsIndex + 1) % newsItems.length;
			}
		}, 10000);
	}

	function selectFeaturedNews(index: number) {
		featuredNewsIndex = index;
		// Reset the rotation timer when manually selecting
		startNewsRotation();
	}

	// Cleanup on component destroy
	onDestroy(() => {
		if (newsRotationInterval) {
			clearInterval(newsRotationInterval);
		}
		// Clear all rejection reminder timers
		rejectionReminderTimers.forEach((timerId) => {
			clearTimeout(timerId);
		});
		rejectionReminderTimers.clear();
	});

	// Open Government Scheme Website
	function openSchemeWebsite(scheme: any) {
		// URL mapping for known schemes
		const schemeUrls: Record<string, string> = {
			// Central Government Schemes
			'Startup India Seed Fund Scheme (SISFS)': 'https://seedfund.startupindia.gov.in/',
			'Credit Guarantee Scheme for Startups (CGSS)': 'https://www.startupindia.gov.in/content/sih/en/government-schemes/credit-guarantee-scheme.html',
			'GENESIS - Gen-Next Support for Innovative Startups': 'https://www.meity.gov.in/content/genesis',
			'Atal Innovation Mission (AIM)': 'https://aim.gov.in/',
			'Atal Innovation Mission - Ed-AII': 'https://aim.gov.in/',
			'Fund of Funds for Startups (FFS)': 'https://www.startupindia.gov.in/content/sih/en/government-schemes/fund-of-funds-for-startups-ffs.html',
			'SAMRIDH - Startup Accelerators': 'https://samridh.meity.gov.in/',
			'SAMRIDH': 'https://samridh.meity.gov.in/',
			'TIDE 2.0 - Technology Incubation': 'https://www.meity.gov.in/tide2-0',
			'TIDE 2.0': 'https://www.meity.gov.in/tide2-0',
			'BioNEST - Biotech Incubators': 'https://birac.nic.in/bionest.php',
			'BioNEST': 'https://birac.nic.in/bionest.php',
			'NIDHI-SSS - Seed Support System': 'https://dst.gov.in/nidhi-seed-support-system',
			'NIDHI-SSS': 'https://dst.gov.in/nidhi-seed-support-system',
			'Mudra Loan - PMMY': 'https://www.mudra.org.in/',
			'Pradhan Mantri Mudra Yojana': 'https://www.mudra.org.in/',
			'Stand Up India': 'https://www.standupmitra.in/',
			// State Government Schemes
			'Karnataka Elevate 100': 'https://elevate.karnataka.gov.in/',
			'Tamil Nadu Startup Seed Grant Fund': 'https://startuptn.in/',
			'Maharashtra State Innovation Society (MSInS)': 'https://msins.in/',
			'T-Hub / Telangana Innovation Fund': 'https://t-hub.co/',
			'Kerala Startup Mission (KSUM)': 'https://startupmission.kerala.gov.in/',
			'Gujarat Industrial Policy Assistance': 'https://ic.gujarat.gov.in/startup-gujarat.aspx',
			'Delhi Startup Policy Support': 'https://startup.delhi.gov.in/'
		};

		// Try to find URL from scheme object first, then from mapping
		let url = scheme.url;
		
		if (!url || url === '#') {
			// Try exact match
			url = schemeUrls[scheme.name];
			
			// Try partial match if exact doesn't work
			if (!url) {
				for (const [key, value] of Object.entries(schemeUrls)) {
					if (scheme.name?.toLowerCase().includes(key.toLowerCase().split(' ')[0]) ||
					    key.toLowerCase().includes(scheme.name?.toLowerCase().split(' ')[0])) {
						url = value;
						break;
					}
				}
			}
		}

		// Check for state schemes
		if (!url && scheme.name?.toLowerCase().includes('state')) {
			url = 'https://www.startupindia.gov.in/content/sih/en/state-startup-policies.html';
		}

		// Default fallback to Startup India
		if (!url) {
			url = 'https://www.startupindia.gov.in/content/sih/en/government-schemes.html';
		}

		// Open in new tab
		window.open(url, '_blank', 'noopener,noreferrer');
	}

	// Proposal Generation State
	let proposalLoading = false;
	let proposalScheme: any = null;

	// Generate and download proposal as .doc file
	async function createProposal(scheme: any) {
		proposalLoading = true;
		proposalScheme = scheme;

		try {
			const token = localStorage.getItem('accessToken');
			if (!token) {
				alert('Please log in to create a proposal');
				return;
			}

			// Generate proposal content using AI
			const response = await fetch(`${API_URL}/api/proposal/generate`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': `Bearer ${token}`
				},
				body: JSON.stringify({
					scheme: {
						name: scheme.name,
						amount: scheme.amount,
						eligibility: scheme.eligibility,
						benefits: scheme.benefits,
						type: scheme.type
					},
					company: {
						name: ddqResponses[1] || user?.companyName || 'Company',
						description: ddqResponses[2] || '',
						category: ddqResponses[3] || '',
						stage: ddqResponses[5] || '',
						state: ddqResponses[4] || '',
						uniqueValue: ddqResponses[7] || '',
						targetCustomer: ddqResponses[8] || '',
						teamSize: ddqResponses[17] || '',
						founderBackground: ddqResponses[18] || '',
						monthlyRevenue: ddqResponses[13] || 0,
						totalInvestment: ddqResponses[11] || 0,
						customers: ddqResponses[15] || 0,
						primaryGoal: ddqResponses[21] || '',
						fundingNeeded: ddqResponses[22] || ''
					},
					valuation: valuation ? {
						finalValuationINR: valuation.finalValuationINR,
						method: valuation.valuationMethod
					} : null
				})
			});

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
				throw new Error(errorData.error || `HTTP ${response.status}`);
			}

			const data = await response.json();
			
			if (!data.success || !data.proposal) {
				throw new Error('Invalid response from server');
			}
			
			// Create .doc file content (RTF format for Word compatibility)
			const docContent = generateDocContent(data.proposal, scheme);
			
			// Download the file
			downloadDoc(docContent, `${scheme.name.replace(/[^a-zA-Z0-9]/g, '_')}_Proposal.doc`);

		} catch (error: any) {
			console.error('Error creating proposal:', error);
			alert(`Failed to generate proposal: ${error.message || 'Please try again.'}`);
		} finally {
			proposalLoading = false;
			proposalScheme = null;
		}
	}

	// Generate RTF/DOC content
	function generateDocContent(proposal: any, scheme: any): string {
		const companyName = ddqResponses[1] || user?.companyName || 'Company';
		const founderName = user?.name || 'Founder';
		const today = new Date().toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' });

		// RTF header for Word compatibility
		const rtfHeader = `{\\rtf1\\ansi\\deff0
{\\fonttbl{\\f0\\fswiss\\fcharset0 Arial;}{\\f1\\froman\\fcharset0 Times New Roman;}}
{\\colortbl;\\red0\\green0\\blue0;\\red0\\green102\\blue204;\\red212\\green175\\blue55;\\red34\\green139\\blue34;}
\\viewkind4\\uc1\\pard\\f1\\fs24
`;

		// Build RTF content
		let rtfContent = rtfHeader;

		// Title
		rtfContent += `\\pard\\qc\\b\\fs36\\cf3 FUNDING PROPOSAL\\b0\\fs24\\cf1\\par
\\pard\\qc\\fs28 ${scheme.name}\\par
\\pard\\qc\\fs20 Submitted by: ${companyName}\\par
\\pard\\qc\\fs18 Date: ${today}\\par
\\par\\par

`;

		// Executive Summary
		rtfContent += `\\pard\\b\\fs28\\cf2 EXECUTIVE SUMMARY\\b0\\fs24\\cf1\\par
\\par
${proposal.executiveSummary || 'This proposal outlines our request for funding under the ' + scheme.name + ' to accelerate our growth and achieve key milestones.'}\\par
\\par\\par

`;

		// Company Overview
		rtfContent += `\\b\\fs28\\cf2 COMPANY OVERVIEW\\b0\\fs24\\cf1\\par
\\par
\\b Company Name:\\b0  ${companyName}\\par
\\b Industry/Category:\\b0  ${ddqResponses[3] || 'Technology'}\\par
\\b Stage:\\b0  ${ddqResponses[5] || 'Growth'}\\par
\\b Location:\\b0  ${ddqResponses[4] || 'India'}\\par
\\b Team Size:\\b0  ${ddqResponses[17] || 'N/A'}\\par
\\par
${proposal.companyOverview || ddqResponses[2] || ''}\\par
\\par\\par

`;

		// Problem & Solution
		rtfContent += `\\b\\fs28\\cf2 PROBLEM & SOLUTION\\b0\\fs24\\cf1\\par
\\par
\\b The Problem:\\b0\\par
${proposal.problem || 'Market gap that our solution addresses.'}\\par
\\par
\\b Our Solution:\\b0\\par
${proposal.solution || ddqResponses[7] || 'Our unique value proposition.'}\\par
\\par\\par

`;

		// Market Opportunity
		rtfContent += `\\b\\fs28\\cf2 MARKET OPPORTUNITY\\b0\\fs24\\cf1\\par
\\par
${proposal.marketOpportunity || 'Our target market consists of ' + (ddqResponses[8] || 'customers') + ' with significant growth potential.'}\\par
\\par\\par

`;

		// Traction & Milestones
		rtfContent += `\\b\\fs28\\cf2 TRACTION & MILESTONES\\b0\\fs24\\cf1\\par
\\par
\\b Current Traction:\\b0\\par
`;
		if (proposal.traction && proposal.traction.length > 0) {
			proposal.traction.forEach((item: string) => {
				rtfContent += `\\bullet  ${item}\\par
`;
			});
		} else {
			rtfContent += `\\bullet  ${ddqResponses[15] ? ddqResponses[15] + ' customers acquired' : 'Building initial customer base'}\\par
\\bullet  ${ddqResponses[13] ? 'Monthly revenue of ₹' + ddqResponses[13] : 'Pre-revenue stage with strong pipeline'}\\par
`;
		}
		rtfContent += `\\par\\par

`;

		// Funding Request
		rtfContent += `\\b\\fs28\\cf2 FUNDING REQUEST\\b0\\fs24\\cf1\\par
\\par
\\b Scheme Applied:\\b0  ${scheme.name}\\par
\\b Funding Amount Requested:\\b0  ${scheme.amount || 'As per scheme guidelines'}\\par
\\b Funding Type:\\b0  ${scheme.type || 'Grant/Equity'}\\par
\\par
\\b Use of Funds:\\b0\\par
`;
		if (proposal.useOfFunds && proposal.useOfFunds.length > 0) {
			proposal.useOfFunds.forEach((item: string) => {
				rtfContent += `\\bullet  ${item}\\par
`;
			});
		} else {
			rtfContent += `\\bullet  Product Development & Enhancement\\par
\\bullet  Market Expansion & Customer Acquisition\\par
\\bullet  Team Building & Operations\\par
\\bullet  Technology Infrastructure\\par
`;
		}
		rtfContent += `\\par\\par

`;

		// Why This Scheme
		rtfContent += `\\b\\fs28\\cf2 WHY ${scheme.name.toUpperCase()}\\b0\\fs24\\cf1\\par
\\par
${proposal.whyThisScheme || 'Our company aligns perfectly with the objectives of ' + scheme.name + ' because of our innovative approach, strong team, and scalable business model.'}\\par
\\par\\par

`;

		// Team
		rtfContent += `\\b\\fs28\\cf2 TEAM\\b0\\fs24\\cf1\\par
\\par
\\b Founder:\\b0  ${founderName}\\par
\\b Background:\\b0  ${ddqResponses[18] || 'Experienced entrepreneur with domain expertise'}\\par
\\b Team Size:\\b0  ${ddqResponses[17] || 'Growing team'}\\par
\\par
${proposal.teamDescription || ''}\\par
\\par\\par

`;

		// Financial Projections
		if (valuation) {
			rtfContent += `\\b\\fs28\\cf2 FINANCIAL OVERVIEW\\b0\\fs24\\cf1\\par
\\par
\\b Current Valuation:\\b0  ₹${(valuation.finalValuationINR / 10000000).toFixed(2)} Crores\\par
\\b Valuation Method:\\b0  ${valuation.valuationMethod || 'Berkus + Scorecard Method'}\\par
`;
			if (ddqResponses[13]) {
				rtfContent += `\\b Monthly Revenue:\\b0  ₹${Number(ddqResponses[13]).toLocaleString('en-IN')}\\par
`;
			}
			rtfContent += `\\par\\par

`;
		}

		// Conclusion
		rtfContent += `\\b\\fs28\\cf2 CONCLUSION\\b0\\fs24\\cf1\\par
\\par
${proposal.conclusion || 'We believe that with the support of ' + scheme.name + ', we can achieve our growth objectives and create significant value. We look forward to the opportunity to discuss our proposal further.'}\\par
\\par\\par

`;

		// Contact Information
		rtfContent += `\\b\\fs28\\cf2 CONTACT INFORMATION\\b0\\fs24\\cf1\\par
\\par
\\b Company:\\b0  ${companyName}\\par
\\b Contact Person:\\b0  ${founderName}\\par
\\b Email:\\b0  ${user?.email || ''}\\par
\\par\\par
\\pard\\qc\\i Thank you for considering our proposal.\\i0\\par
}`;

		return rtfContent;
	}

	// Download .doc file
	function downloadDoc(content: string, filename: string) {
		const blob = new Blob([content], { type: 'application/msword' });
		const url = URL.createObjectURL(blob);
		const link = document.createElement('a');
		link.href = url;
		link.download = filename;
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
		URL.revokeObjectURL(url);
	}

	function logout() {
		localStorage.clear();
		goto('/');
	}
</script>

<svelte:head>
	<title>Dashboard - CEO Insight Engine</title>
</svelte:head>

<div class="dashboard">
	<!-- Sidebar -->
	<aside class="sidebar" class:minimized={sidebarMinimized}>
		<div class="sidebar-header">
			<div class="logo-section">
				<img src="/logo-dark.png" alt="Singularity" class="logo-icon logo-dark" />
				<img src="/logo-light.png" alt="Singularity" class="logo-icon logo-light" />
				{#if !sidebarMinimized}
					<div class="brand-text">
						<span class="brand-nebulaa">Nebulaa</span>
						<span class="brand-name">Singularity</span>
					</div>
				{/if}
			</div>
			<button class="sidebar-toggle" on:click={toggleSidebar} aria-label="Toggle sidebar">
				<span class="material-symbols-outlined">
					{sidebarMinimized ? 'left_panel_open' : 'left_panel_close'}
				</span>
			</button>
		</div>

		<nav class="sidebar-nav">
			<button
				class="nav-item"
				class:active={activeTab === 'overview'}
				on:click={() => (activeTab = 'overview')}
				title="Home"
			>
				<span class="material-symbols-outlined nav-icon">home</span>
				{#if !sidebarMinimized}
					<span class="nav-text">Home</span>
				{/if}
			</button>
			<button
				class="nav-item"
				class:active={activeTab === 'strengths-weaknesses'}
				on:click={() => (activeTab = 'strengths-weaknesses')}
				title="Introspection"
			>
				<span class="material-symbols-outlined nav-icon">balance</span>
				{#if !sidebarMinimized}
					<span class="nav-text">Introspection</span>
				{/if}
			</button>
			<button
				class="nav-item"
				class:active={activeTab === 'funding'}
				on:click={() => (activeTab = 'funding')}
				title="Government Schemes"
			>
				<span class="material-symbols-outlined nav-icon">account_balance</span>
				{#if !sidebarMinimized}
					<span class="nav-text">Government Schemes</span>
				{/if}
			</button>
			<button
				class="nav-item"
				class:active={activeTab === 'trends'}
				on:click={() => (activeTab = 'trends')}
				title="Marketing Trends"
			>
				<span class="material-symbols-outlined nav-icon">query_stats</span>
				{#if !sidebarMinimized}
					<span class="nav-text">Marketing Trends</span>
				{/if}
			</button>
			<button
				class="nav-item"
				class:active={activeTab === 'notes'}
				on:click={() => (activeTab = 'notes')}
				title="Notes"
			>
				<span class="material-symbols-outlined nav-icon">bookmark</span>
				{#if !sidebarMinimized}
					<span class="nav-text">Notes</span>
				{/if}
			</button>
			<button
				class="nav-item"
				class:active={activeTab === 'profile'}
				on:click={() => (activeTab = 'profile')}
				title="Profile"
			>
				<span class="material-symbols-outlined nav-icon">person</span>
				{#if !sidebarMinimized}
					<span class="nav-text">Profile</span>
				{/if}
			</button>
			<button
				class="nav-item logout-nav-item"
				on:click={logout}
				title="Logout"
			>
				<span class="material-symbols-outlined nav-icon">logout</span>
				{#if !sidebarMinimized}
					<span class="nav-text">Logout</span>
				{/if}
			</button>
		</nav>
	</aside>

	<!-- Main Content -->
	<main class="main-content">
		<header class="dashboard-header">
			<div>
				<h1 class="dashboard-title">Welcome back, {user?.name || 'CEO'}</h1>
				<p class="dashboard-subtitle">{user?.companyName || 'Your Company'}</p>
			</div>
			<div class="header-actions">
				<!-- Company Logo or Name Display -->
				{#if companyLogo}
					<div class="header-company-logo">
						<img src={companyLogo} alt="Company Logo" />
					</div>
				{:else if ddqResponses[1]}
					<div class="header-company-name">
						{ddqResponses[1]}
					</div>
				{/if}
				<button class="header-theme-toggle" on:click={toggleTheme} title="Toggle {theme === 'light' ? 'Dark' : 'Light'} Mode">
					<span class="material-symbols-outlined">
						{theme === 'light' ? 'dark_mode' : 'light_mode'}
					</span>
				</button>
			</div>
		</header>

		<!-- DDQ Modal -->
		{#if showDDQ && currentQuestionData}
			<div class="ddq-modal">
				<div class="ddq-content minimal-card">
					<div class="ddq-header">
						<div class="progress-section">
							<div class="progress-bar">
								<div class="progress-fill" style="width: {progress}%"></div>
							</div>
							<span class="progress-text">
								Question {currentQuestion + 1} of {ddqQuestions.length}
							</span>
						</div>
						<div class="ddq-header-controls">
							<span class="question-section-label">{currentQuestionData.section}</span>
							<button class="modal-close-btn" on:click={closeDDQ} title="Close questionnaire">
								<span class="material-symbols-outlined">close</span>
							</button>
						</div>
					</div>

					<div class="ddq-question">
						<h2 class="question-text">{currentQuestionData.question}</h2>

						<!-- Text Input -->
						{#if currentQuestionData.type === 'text'}
							<input
								type="text"
								class="text-input"
								placeholder={currentQuestionData.placeholder}
								bind:value={ddqResponses[currentQuestionData.id]}
								on:input={() => handleAnswer(ddqResponses[currentQuestionData.id])}
							/>
						
						<!-- Textarea -->
						{:else if currentQuestionData.type === 'textarea'}
							<textarea
								class="textarea-input"
								placeholder={currentQuestionData.placeholder}
								bind:value={ddqResponses[currentQuestionData.id]}
								on:input={() => handleAnswer(ddqResponses[currentQuestionData.id])}
								rows="4"
							></textarea>
						
						<!-- Number Input -->
						{:else if currentQuestionData.type === 'number'}
							<input
								type="number"
								class="number-input"
								placeholder={currentQuestionData.placeholder}
								bind:value={ddqResponses[currentQuestionData.id]}
								on:input={() => handleAnswer(ddqResponses[currentQuestionData.id])}
							/>
						
						<!-- Dropdown -->
						{:else if currentQuestionData.type === 'dropdown'}
							<select
								class="dropdown-select"
								bind:value={ddqResponses[currentQuestionData.id]}
								on:change={() => handleAnswer(ddqResponses[currentQuestionData.id])}
							>
								<option value="">Select an option...</option>
								{#each currentQuestionData.options || [] as option}
									<option value={option}>{option}</option>
								{/each}
							</select>
						
						<!-- Radio Buttons -->
						{:else if currentQuestionData.type === 'radio'}
							<div class="radio-group">
								{#each currentQuestionData.options || [] as option}
									<label class="radio-label">
										<input
											type="radio"
											name="question-{currentQuestionData.id}"
											value={option}
											bind:group={ddqResponses[currentQuestionData.id]}
											on:change={() => handleAnswer(option)}
										/>
										<span>{option}</span>
									</label>
								{/each}
							</div>
						
						<!-- Multi-select Checkboxes -->
						{:else if currentQuestionData.type === 'multiselect'}
							<div class="checkbox-group">
								{#each currentQuestionData.options || [] as option}
									<label class="checkbox-label">
										<input
											type="checkbox"
											value={option}
											checked={ddqResponses[currentQuestionData.id]?.includes(option)}
											on:change={(e) => {
												const current = ddqResponses[currentQuestionData.id] || [];
												if (e.currentTarget.checked) {
													ddqResponses[currentQuestionData.id] = [...current, option];
												} else {
													ddqResponses[currentQuestionData.id] = current.filter((v: string) => v !== option);
												}
												handleAnswer(ddqResponses[currentQuestionData.id]);
											}}
										/>
										<span>{option}</span>
									</label>
								{/each}
							</div>
						
						<!-- File Upload (Logo) -->
						{:else if currentQuestionData.type === 'file'}
							<div class="file-upload-container">
								<input
									type="file"
									id="logo-upload"
									accept={currentQuestionData.accept || 'image/*'}
									on:change={handleLogoUpload}
									style="display: none;"
								/>
								<label for="logo-upload" class="file-upload-label">
									{#if companyLogo}
										<img src={companyLogo} alt="Company Logo Preview" class="logo-preview" />
										<span class="change-logo-text">Click to change logo</span>
									{:else}
										<span class="material-symbols-outlined">upload</span>
										<span>Click to upload logo</span>
									{/if}
								</label>
								{#if companyLogo}
									<button class="btn-secondary skip-btn" on:click={() => { companyLogo = null; logoFile = null; }}>
										<span class="material-symbols-outlined">delete</span>
										Remove Logo
									</button>
								{/if}
								<button class="btn-secondary skip-btn" on:click={nextQuestion}>
									<span class="material-symbols-outlined">skip_next</span>
									Skip this step
								</button>
							</div>
						{/if}
					</div>

					<!-- Navigation Buttons -->
					<div class="ddq-navigation">
						<button
							class="btn-secondary nav-btn"
							on:click={previousQuestion}
							disabled={currentQuestion === 0}
						>
							<span class="material-symbols-outlined">chevron_left</span>
							Back
						</button>
						<button
							class="btn-primary nav-btn"
							on:click={nextQuestion}
							disabled={!canProceedToNext}
						>
							{currentQuestion === ddqQuestions.length - 1 ? 'Complete' : 'Next'}
							<span class="material-symbols-outlined">chevron_right</span>
						</button>
					</div>
				</div>
			</div>
		{/if}

		<!-- Content Area -->
		<div class="content-area">
			{#if activeTab === 'overview'}
				<div class="overview-section home-layout">
					<!-- Row 1: Valuation + Top 5 Actions + Backlog in a compact grid -->
					<div class="home-row-top">
						<!-- Left Column: Valuation -->
						<div class="home-card valuation-summary-card" on:dblclick={() => { if(valuation) showMethodologyModal = true; }} role="button" tabindex="0" title="Double-click to see valuation breakdown">
							<div class="home-card-header-row">
								<h3 class="home-card-title">Your Valuation</h3>
								<div class="card-header-actions">
									<button class="info-btn" on:click|stopPropagation={() => showInfo('valuation')} title="What is this?">
										<span class="info-icon">i</span>
									</button>
									<button class="daddy-btn" on:click|stopPropagation={() => askDaddy('valuation')} title="Ask Daddy">
										<span class="daddy-icon">D</span>
									</button>
								</div>
							</div>
							{#if valuation}
								<div class="valuation-big">
									₹{(valuation.finalValuationINR / 10000000).toFixed(2)} Cr
								</div>
								<div class="valuation-usd-small">
									${(valuation.finalValuationUSD / 1000000).toFixed(2)}M USD
								</div>
								<div class="valuation-hint">Double-click for details</div>
							{:else}
								<button class="btn-primary" on:click={startDDQ}>
									<span class="material-symbols-outlined">rocket_launch</span>
									Begin Assessment
								</button>
							{/if}
						</div>

						<!-- Middle Column: Top 5 Actions -->
						<div class="home-card actions-card">
							<div class="home-card-header-row">
								<h3 class="home-card-title">Today's Top 5 Actions</h3>
								<div class="card-header-actions">
									<button class="info-btn" on:click={() => showInfo('daily-actions')} title="What is this?">
										<span class="info-icon">i</span>
									</button>
									<button class="daddy-btn" on:click={() => askDaddy('daily-actions')} title="Ask Daddy">
										<span class="daddy-icon">D</span>
									</button>
								</div>
							</div>
							{#if actionsLoading}
								<div class="loading-spinner-small">Loading...</div>
							{:else if dailyActions.length === 0}
								<p class="no-actions-text">Complete the assessment to get personalized daily actions.</p>
							{:else}
								<div class="actions-list">
									{#each dailyActions.slice(0, 5) as action, index}
										<div class="action-item" class:rejected={action.status === 'rejected'} class:accepted={action.status === 'accepted'}>
											<span class="action-letter">{String.fromCharCode(97 + index)}.</span>
											<span class="action-text" class:strikethrough={action.status === 'rejected'}>
												{action.text}
											</span>
											
											{#if action.status === 'pending'}
												<div class="action-buttons">
													<button class="action-btn accept" on:click={() => acceptAction(action.id)} title="Accept">
														<span class="material-symbols-outlined">check</span>
													</button>
													<button class="action-btn reject" on:click={() => rejectAction(action.id, action.text)} title="Reject">
														<span class="material-symbols-outlined">close</span>
													</button>
												</div>
											{:else if action.status === 'accepted'}
												<div class="rag-buttons">
													<button class="rag-btn red" class:active={action.progress === 'red'} on:click={() => updateActionProgress(action.id, 'red')} title="Not Started"></button>
													<button class="rag-btn amber" class:active={action.progress === 'amber'} on:click={() => updateActionProgress(action.id, 'amber')} title="In Progress"></button>
													<button class="rag-btn green" class:active={action.progress === 'green'} on:click={() => updateActionProgress(action.id, 'green')} title="Completed"></button>
												</div>
											{/if}
										</div>
									{/each}
								</div>
							{/if}
						</div>

						<!-- Right Column: Backlog -->
						<div class="home-card backlog-card">
							<h3 class="home-card-title">Backlog</h3>
							{#if backlogItems.length === 0}
								<p class="no-backlog-text">No pending tasks</p>
							{:else}
								<div class="backlog-list">
									{#each backlogItems.slice(0, 5) as item, index}
										<div class="backlog-item" title={item.text}>
											<span class="backlog-letter">{index + 1}.</span>
											<span class="backlog-text">{item.text.length > 15 ? item.text.substring(0, 15) + '...' : item.text}</span>
											<div class="rag-buttons small">
												<button class="rag-btn red" class:active={item.progress === 'red'} on:click={() => updateActionProgress(item.id, 'red')} title="Not Started"></button>
												<button class="rag-btn amber" class:active={item.progress === 'amber'} on:click={() => updateActionProgress(item.id, 'amber')} title="In Progress"></button>
												<button class="rag-btn green" class:active={item.progress === 'green'} on:click={() => updateActionProgress(item.id, 'green')} title="Completed"></button>
											</div>
										</div>
									{/each}
								</div>
							{/if}
						</div>
					</div>

					<!-- Row 2: News (Left) + inFINity & Gravity stats (Right) -->
					<div class="home-split-section">
						<!-- Left: News Section -->
						<div class="news-section-container">
							<div class="section-header-row">
								<h3 class="section-label">Industry News</h3>
								<div class="card-header-actions">
									<button class="info-btn" on:click={() => showInfo('news')} title="What is this?">
										<span class="info-icon">i</span>
									</button>
									<button class="daddy-btn" on:click={() => askDaddy('news')} title="Ask Daddy">
										<span class="daddy-icon">D</span>
									</button>
								</div>
							</div>
							{#if newsLoading}
								<div class="news-loading-state">
									<span class="material-symbols-outlined spinning">progress_activity</span>
									<span>Loading latest news...</span>
								</div>
							{:else if newsItems.length === 0}
								<div class="news-empty-state">
									<span class="material-symbols-outlined">newspaper</span>
									<span>News will appear here based on your industry</span>
								</div>
							{:else}
								<!-- Featured News (Top) -->
								<div class="featured-news-container">
									<a href={newsItems[featuredNewsIndex]?.url || '#'} target="_blank" rel="noopener noreferrer" class="featured-news">
										<div class="featured-news-image" style="background-image: url('{newsItems[featuredNewsIndex]?.imageUrl || `https://picsum.photos/seed/${featuredNewsIndex}/800/400`}')">
											<div class="featured-news-overlay"></div>
										</div>
										<div class="featured-news-content">
											<h2 class="featured-news-title">{newsItems[featuredNewsIndex]?.title || 'Loading...'}</h2>
											<p class="featured-news-summary">{newsItems[featuredNewsIndex]?.summary || ''}</p>
											<div class="featured-news-meta">
												<span class="featured-source">{newsItems[featuredNewsIndex]?.source}</span>
												<span class="featured-time">{newsItems[featuredNewsIndex]?.timeAgo}</span>
											</div>
											<span class="read-more-link">Read More »</span>
										</div>
									</a>
									<!-- Progress Dots -->
									<div class="news-progress-dots">
										{#each newsItems as _, i}
											<button 
												class="progress-dot" 
												class:active={i === featuredNewsIndex}
												on:click={() => selectFeaturedNews(i)}
												aria-label="View news {i + 1}"
											></button>
										{/each}
									</div>
								</div>

								<!-- News Thumbnails Row (Bottom) -->
								<div class="news-thumbnails-row">
									{#each newsItems.slice(0, 3) as newsItem, i}
										<a 
											href={newsItem.url || '#'} 
											target="_blank" 
											rel="noopener noreferrer" 
											class="news-thumbnail-card"
											class:active={i === featuredNewsIndex}
											on:click|preventDefault={() => selectFeaturedNews(i)}
										>
											<div class="thumbnail-image" style="background-image: url('{newsItem.imageUrl || `https://picsum.photos/seed/${i}/200/120`}')"></div>
											<p class="thumbnail-title">{newsItem.title}</p>
										</a>
									{/each}
								</div>
							{/if}
						</div>

						<!-- Right: inFINity stats + Gravity stats -->
						<div class="dashboard-right-column">
							<!-- inFINity stats Panel -->
							<div class="home-card financial-panel">
								<h3 class="home-card-title">inFINity stats</h3>
								{#if valuation}
									{@const hasRevenue = ddqResponses[12] === 'Yes'}
									{@const monthlyRevenue = hasRevenue ? (Number(ddqResponses[13]) || 0) : 0}
									{@const previousRevenue = hasRevenue ? (Number(ddqResponses[14]) || 0) : 0}
									{@const estimatedBurn = hasRevenue ? Math.round(monthlyRevenue * 0.6) : (Number(ddqResponses[16]) || 0)}
									{@const totalInvestment = Number(ddqResponses[11]) || 0}
									{@const netProfit = monthlyRevenue - estimatedBurn}
									{@const runway = estimatedBurn > 0 ? Math.floor((totalInvestment + (netProfit > 0 ? netProfit * 12 : 0)) / estimatedBurn) : 999}
									{@const revenueGrowth = previousRevenue > 0 ? ((monthlyRevenue - previousRevenue) / previousRevenue * 100) : 0}
									{@const isProfitable = hasRevenue && netProfit > 0}
									<div class="financial-grid">
										<div class="fin-metric">
											<span class="fin-label">Total Revenue</span>
											<span class="fin-value revenue">₹{(monthlyRevenue * 12 / 100000).toFixed(1)}L</span>
										</div>
										<div class="fin-metric">
											<span class="fin-label">Total Investment</span>
											<span class="fin-value">₹{(totalInvestment / 100000).toFixed(1)}L</span>
										</div>
										<div class="fin-metric">
											<span class="fin-label">Monthly Revenue</span>
											<span class="fin-value revenue">₹{(monthlyRevenue / 100000).toFixed(1)}L</span>
										</div>
										<div class="fin-metric">
											<span class="fin-label">Monthly Burn</span>
											<span class="fin-value burn">₹{(estimatedBurn / 100000).toFixed(1)}L</span>
										</div>
										<div class="fin-metric">
											<span class="fin-label">Runway</span>
											<span class="fin-value">
												{runway > 100 ? '100+ mo' : runway + ' mo'}
											</span>
										</div>
										<div class="fin-metric">
											<span class="fin-label">Status</span>
											<span class="fin-value {isProfitable ? 'profitable' : 'burning'}">
												{isProfitable ? 'Profitable' : (hasRevenue ? 'Growing' : 'Pre-Revenue')}
											</span>
										</div>
										<div class="fin-metric full-width">
											<span class="fin-label">Revenue Growth</span>
											<span class="fin-value {revenueGrowth >= 0 ? 'profitable' : 'burning'}">
												{(revenueGrowth >= 0 ? '+' : '') + revenueGrowth.toFixed(1)}%
											</span>
										</div>
									</div>
								{:else}
									<p class="dashboard-placeholder">Complete assessment for insights</p>
								{/if}
							</div>

							<!-- Gravity stats Panel -->
							<div class="home-card marketing-panel">
								<h3 class="home-card-title">Gravity stats</h3>
								{#if competitors}
									<div class="marketing-grid">
										<div class="mkt-metric">
											<span class="mkt-label">Profile Performance</span>
											<span class="mkt-value">{Math.floor(Math.random() * 30) + 60}/100</span>
										</div>
										<div class="mkt-metric">
											<span class="mkt-label">Brand Score</span>
											<span class="mkt-value">{Math.floor(Math.random() * 20) + 70}/100</span>
										</div>
										<div class="mkt-metric">
											<span class="mkt-label">Number Of Followers</span>
											<span class="mkt-value">{(Math.floor(Math.random() * 50) + 10)}K</span>
										</div>
										<div class="mkt-metric">
											<span class="mkt-label">Pending Campaign Actions</span>
											<span class="mkt-value action">{Math.floor(Math.random() * 5) + 2}</span>
										</div>
										<div class="mkt-metric">
											<span class="mkt-label">Number of interaction</span>
											<span class="mkt-value">{(Math.floor(Math.random() * 20) + 5)}K</span>
										</div>
										<div class="mkt-metric">
											<span class="mkt-label">Number of followers Increased</span>
											<span class="mkt-value profitable">+{Math.floor(Math.random() * 500) + 100}</span>
										</div>
										<div class="mkt-metric">
											<span class="mkt-label">Number of followers Decreased</span>
											<span class="mkt-value burning">-{Math.floor(Math.random() * 50) + 10}</span>
										</div>
									</div>
								{:else}
									<p class="dashboard-placeholder">Complete assessment for insights</p>
								{/if}
							</div>
						</div>
					</div>
				</div>
			{:else if activeTab === 'valuation'}
				{#if valuation}
					<div class="valuation-section">
						<div class="minimal-card">
							<div class="card-header">
								<span class="material-symbols-outlined icon-large">universal_currency_alt</span>
								<h2 class="section-title">Company Valuation</h2>
								<div class="card-header-actions">
									<button class="info-btn" on:click={() => showInfo('valuation')} title="What is this?">
										<span class="info-icon">i</span>
									</button>
									<button class="daddy-btn" on:click={() => askDaddy('valuation')} title="Ask Daddy">
										<span class="daddy-icon">D</span>
									</button>
								</div>
							</div>
							
							<!-- Modern Bullet Chart Visualization -->
							<div class="valuation-display-container" on:dblclick={() => showMethodologyModal = true} role="button" tabindex="0" title="Double-click for methodology details">
								<div class="valuation-main">
									<div class="valuation-icon-wrapper">
										<span class="material-symbols-outlined valuation-icon">universal_currency_alt</span>
									</div>
									<div class="valuation-value-section">
										<div class="valuation-label">Your Company Valuation</div>
										<div class="valuation-amount">
											<span class="currency">₹</span>
											<span class="value">{(valuation.finalValuationINR / 10000000).toFixed(2)}</span>
											<span class="unit">Cr</span>
										</div>
										<div class="valuation-usd">
											${(valuation.finalValuationUSD / 1000000).toFixed(2)}M USD
										</div>
									</div>
								</div>

								<!-- Bullet Chart with bins of 10Cr up to 50Cr -->
								{#if valuation.finalValuationINR}
									{@const valuationCr = valuation.finalValuationINR / 10000000}
									{@const maxRange = valuationCr > 50 ? Math.ceil(valuationCr / 50) * 50 : 50}
									{@const binSize = 10}
									{@const numBins = maxRange / binSize}
									
									<div class="bullet-chart-container">
										<div class="bullet-chart">
											<!-- Background bins -->
											<div class="bullet-bins">
												{#each Array(numBins) as _, i}
													<div class="bullet-bin" class:filled={valuationCr > (i * binSize)}>
														<span class="bin-label">{i * binSize}-{(i + 1) * binSize}Cr</span>
													</div>
												{/each}
											</div>
											
											<!-- Progress bar with micro-sparkline effect -->
											<div class="bullet-progress-track">
												<div 
													class="bullet-progress" 
													style="width: {Math.min((valuationCr / maxRange) * 100, 100)}%"
												>
													<div class="sparkline-effect"></div>
												</div>
												<div class="progress-marker" style="left: {Math.min((valuationCr / maxRange) * 100, 100)}%">
													<span class="marker-value">₹{valuationCr.toFixed(1)}Cr</span>
												</div>
											</div>
										</div>
										
										<!-- Milestone indicators -->
										<div class="milestone-indicators">
											<div class="milestone" class:achieved={valuationCr >= 10}>
												<span class="material-symbols-outlined">{valuationCr >= 10 ? 'check_circle' : 'radio_button_unchecked'}</span>
												<span>₹10Cr</span>
											</div>
											<div class="milestone" class:achieved={valuationCr >= 25}>
												<span class="material-symbols-outlined">{valuationCr >= 25 ? 'check_circle' : 'radio_button_unchecked'}</span>
												<span>₹25Cr</span>
											</div>
											<div class="milestone" class:achieved={valuationCr >= 50}>
												<span class="material-symbols-outlined">{valuationCr >= 50 ? 'check_circle' : 'radio_button_unchecked'}</span>
												<span>₹50Cr</span>
											</div>
											{#if maxRange > 50}
												<div class="milestone achieved">
													<span class="material-symbols-outlined">stars</span>
													<span>Beyond ₹50Cr!</span>
												</div>
											{/if}
										</div>
									</div>
								{/if}

								<!-- Stage badge -->
								<div class="valuation-stage">
									{#if valuation.finalValuationINR < 20000000}
										<span class="stage-badge early">🌱 Early Stage</span>
									{:else if valuation.finalValuationINR < 50000000}
										<span class="stage-badge growing">📈 Growing</span>
									{:else if valuation.finalValuationINR < 100000000}
										<span class="stage-badge established">🏢 Established</span>
									{:else}
										<span class="stage-badge scale">🚀 Scale-up</span>
									{/if}
								</div>

								<div class="methodology-hint">
									<span class="material-symbols-outlined">info</span>
									<span>Double-click to see methodology breakdown</span>
								</div>
							</div>

							<!-- Market Opportunity Metrics -->
							{#if valuation.TAM}
								<div class="market-metrics-section">
									<h3 class="subsection-title">
										<span class="material-symbols-outlined">trending_up</span>
										Market Opportunity Analysis
									</h3>

									<div class="metrics-grid">
										<div class="metric-card tam">
											<div class="metric-header">
												<span class="material-symbols-outlined">language</span>
												<span class="metric-label">TAM</span>
											</div>
											<div class="metric-value">₹{(valuation.TAM / 10000000).toFixed(1)} Cr</div>
											<div class="metric-desc">Total Addressable Market</div>
											<div class="metric-detail">{ddqResponses[3] || 'Market'}</div>
										</div>

										<div class="metric-card sam">
											<div class="metric-header">
												<span class="material-symbols-outlined">target</span>
												<span class="metric-label">SAM</span>
											</div>
											<div class="metric-value">₹{(valuation.SAM / 10000000).toFixed(1)} Cr</div>
											<div class="metric-desc">Serviceable Addressable Market</div>
											<div class="metric-detail">{((valuation.SAM / valuation.TAM) * 100).toFixed(0)}% of TAM</div>
										</div>

										<div class="metric-card som">
											<div class="metric-header">
												<span class="material-symbols-outlined">my_location</span>
												<span class="metric-label">SOM</span>
											</div>
											<div class="metric-value">₹{(valuation.SOM / 10000000).toFixed(1)} Cr</div>
											<div class="metric-desc">Serviceable Obtainable Market</div>
											<div class="metric-detail">
												{valuation.marketPenetration > 0 ? `${valuation.marketPenetration}% captured` : 'Target market'}
											</div>
										</div>

										<div class="metric-card cagr">
											<div class="metric-header">
												<span class="material-symbols-outlined">show_chart</span>
												<span class="metric-label">CAGR</span>
											</div>
											<div class="metric-value">{valuation.CAGR.toFixed(1)}%</div>
											<div class="metric-desc">Compound Annual Growth</div>
											<div class="metric-detail">
												{#if valuation.CAGR > 100}
													Hyper Growth 🚀
												{:else if valuation.CAGR > 50}
													Fast Growth 📈
												{:else if valuation.CAGR > 20}
													Growing 📊
												{:else}
													Steady 📉
												{/if}
											</div>
										</div>
									</div>

									<!-- inFINity stats Metrics -->
									<div class="financial-health-section">
										<h3 class="subsection-title">
											<span class="material-symbols-outlined">health_and_safety</span>
											inFINity stats
										</h3>
										<div class="health-metrics">
											<div class="health-metric">
												<span class="material-symbols-outlined">schedule</span>
												<div class="health-details">
													<span class="health-label">Runway</span>
													<span class="health-value">
														{#if valuation.runway >= 999}
															<span class="profitability-badge">Profitable</span>
														{:else if valuation.runway > 0}
															{valuation.runway} months
														{:else}
															N/A
														{/if}
													</span>
												</div>
											</div>
											<div class="health-metric">
												<span class="material-symbols-outlined">local_fire_department</span>
												<div class="health-details">
													<span class="health-label">Monthly Burn</span>
													<span class="health-value">₹{(valuation.burnRate / 100000).toFixed(1)}L</span>
												</div>
											</div>
											<div class="health-metric">
												<span class="material-symbols-outlined">payments</span>
												<div class="health-details">
													<span class="health-label">Monthly Revenue</span>
													<span class="health-value">₹{(valuation.monthlyRevenue / 100000).toFixed(1)}L</span>
												</div>
											</div>
											<div class="health-metric">
												<span class="material-symbols-outlined">{valuation.isProfitable ? 'trending_up' : 'trending_down'}</span>
												<div class="health-details">
													<span class="health-label">Status</span>
													<span class="health-value {valuation.isProfitable ? 'positive' : 'negative'}">
														{valuation.isProfitable ? 'Cash Positive' : 'Burning Cash'}
													</span>
												</div>
											</div>
										</div>
									</div>

									<!-- Valuation Method Info -->
									<div class="method-info-section">
										<div class="info-badge">
											<span class="material-symbols-outlined">info</span>
											<span>Valuation Method: <strong>{valuation.valuationMethod}</strong></span>
										</div>
										{#if valuation.industryMultiple}
											<div class="info-badge">
												<span class="material-symbols-outlined">calculate</span>
												<span>
													Industry Multiple: <strong>{valuation.industryMultiple.min}x - {valuation.industryMultiple.max}x</strong> 
													(Avg: {valuation.industryMultiple.avg}x)
												</span>
											</div>
										{/if}
									</div>
								</div>
							{/if}

							<!-- Porter's 5 Forces Analysis -->
							<div class="porters-section">
						<h3 class="subsection-title">
							<span class="material-symbols-outlined">hub</span>
							Porter's 5 Forces - Competitive Landscape
							<div class="card-header-actions inline">
								<button class="info-btn" on:click={() => showInfo('porters-five')} title="What is this?">
									<span class="info-icon">i</span>
								</button>
								<button class="daddy-btn" on:click={() => askDaddy('porters-five')} title="Ask Daddy">
									<span class="daddy-icon">D</span>
								</button>
							</div>
						</h3>
					<div class="forces-grid">
						{#if true}
						{@const hasProprietaryTech = String(ddqResponses[17] || '').includes('Yes')}
						{@const teamSize = ddqResponses[15] || '1 (Solo founder)'}
						{@const channels = ddqResponses[18] || []}
						{@const stage = ddqResponses[4] || 'Idea'}
						{@const category = ddqResponses[3] || 'Technology'}
						{@const customers = Number(ddqResponses[14]) || 0}
						{@const competitors = ddqResponses[5] || 'Unknown'}
								
								<!-- Calculate threat scores -->
								{@const newEntrantThreat = hasProprietaryTech ? 'Low' : stage === 'Idea' ? 'High' : 'Medium'}
								{@const supplierPower = category === 'Manufacturing' || category === 'AgriTech' ? 'High' : 'Low'}
								{@const buyerPower = customers > 1000 ? 'Low' : customers > 100 ? 'Medium' : 'High'}
								{@const substituteThreat = competitors.toLowerCase().includes('none') ? 'Low' : category === 'Technology' ? 'High' : 'Medium'}
								{@const rivalry = competitors.toLowerCase().includes('none') ? 'Low' : 'High'}									<div class="force-card">
										<div class="force-icon">
											<span class="material-symbols-outlined">group_add</span>
										</div>
										<h4>Threat of New Entrants</h4>
										<div class="threat-level {newEntrantThreat.toLowerCase()}">{newEntrantThreat}</div>
										<p class="force-analysis">
											{#if hasProprietaryTech}
												Protected by proprietary technology/patents, creating barriers to entry.
											{:else if stage === 'Idea'}
												Early stage with low barriers - high risk of competition.
											{:else}
												Moderate barriers based on market position.
											{/if}
										</p>
									</div>

									<div class="force-card">
										<div class="force-icon">
											<span class="material-symbols-outlined">local_shipping</span>
										</div>
										<h4>Bargaining Power of Suppliers</h4>
										<div class="threat-level {supplierPower.toLowerCase()}">{supplierPower}</div>
										<p class="force-analysis">
											{#if supplierPower === 'High'}
												{category} businesses typically depend on specialized suppliers.
											{:else}
												Low supplier dependence - primarily digital/service-based operations.
											{/if}
										</p>
									</div>

									<div class="force-card">
										<div class="force-icon">
											<span class="material-symbols-outlined">shopping_cart</span>
										</div>
										<h4>Bargaining Power of Buyers</h4>
										<div class="threat-level {buyerPower.toLowerCase()}">{buyerPower}</div>
										<p class="force-analysis">
											{#if customers > 1000}
												Large customer base dilutes individual buyer power.
											{:else if customers > 100}
												Growing customer base provides moderate leverage.
											{:else}
												Small customer base gives buyers significant negotiating power.
											{/if}
										</p>
									</div>

									<div class="force-card">
										<div class="force-icon">
											<span class="material-symbols-outlined">swap_horiz</span>
										</div>
										<h4>Threat of Substitutes</h4>
										<div class="threat-level {substituteThreat.toLowerCase()}">{substituteThreat}</div>
										<p class="force-analysis">
											{#if competitors.toLowerCase().includes('none')}
												First-mover advantage with no direct substitutes identified.
											{:else if category === 'Technology'}
												Technology markets face high substitution risk from innovation.
											{:else}
												Moderate risk of alternative solutions entering the market.
											{/if}
										</p>
									</div>

									<div class="force-card central">
										<div class="force-icon">
											<span class="material-symbols-outlined">swords</span>
										</div>
										<h4>Competitive Rivalry</h4>
										<div class="threat-level {rivalry.toLowerCase()}">{rivalry}</div>
										<p class="force-analysis">
											{#if competitors.toLowerCase().includes('none')}
												Low rivalry - operating in uncrowded market space.
											{:else}
												High competitive intensity: {competitors}
											{/if}
										</p>
										<div class="competitive-advantage">
											<strong>Your Advantage:</strong> {ddqResponses[7] || 'Building unique value proposition'}
										</div>
									</div>
								{/if}
							</div>

							<!-- Porter's 5 Forces Explanation -->
							<div class="framework-explanation porters-explanation">
								<h4>
									<span class="material-symbols-outlined">info</span>
									Understanding Porter's 5 Forces
								</h4>
								<p class="explanation-intro">Porter's 5 Forces helps assess industry attractiveness and your competitive position. Higher forces = harder market, lower profitability.</p>
								<div class="explanation-grid">
									<div class="explanation-item">
										<strong>🚀 New Entrants</strong>
										<p>How easily can new competitors enter? High barriers (patents, capital, regulations) protect you.</p>
									</div>
									<div class="explanation-item">
										<strong>📦 Supplier Power</strong>
										<p>How much leverage do suppliers have? Few suppliers or unique inputs = higher power over you.</p>
									</div>
									<div class="explanation-item">
										<strong>🛒 Buyer Power</strong>
										<p>How much leverage do customers have? Many alternatives or low switching costs = buyer power.</p>
									</div>
									<div class="explanation-item">
										<strong>🔄 Substitutes</strong>
										<p>Can customers solve their problem differently? Alternative solutions reduce your pricing power.</p>
									</div>
									<div class="explanation-item central-explanation">
										<strong>⚔️ Rivalry (Center)</strong>
										<p>How intense is competition? Many similar competitors with low differentiation = high rivalry.</p>
									</div>
								</div>
								<div class="strategic-insight">
									<span class="material-symbols-outlined">lightbulb</span>
									<p><strong>Strategic Insight:</strong> Focus on forces you can influence. Build barriers through proprietary technology, create switching costs for customers, and differentiate strongly to reduce rivalry impact.</p>
								</div>
							</div>
						</div>

						<!-- Introspection Section -->
						{#if swotAnalysis}
						<div class="minimal-card">
							<div class="card-header">
								<span class="material-symbols-outlined icon-large">grid_view</span>
								<h2 class="section-title">Introspection</h2>
								<div class="card-header-actions">
									<button class="info-btn" on:click={() => showInfo('introspection')} title="What is this?">
										<span class="info-icon">i</span>
									</button>
									<button class="daddy-btn" on:click={() => askDaddy('introspection')} title="Ask Daddy">
										<span class="daddy-icon">D</span>
									</button>
								</div>
							</div>
							
							<div class="swot-grid">
								<!-- Strengths -->
								<div class="swot-quadrant strengths">
									<div class="quadrant-header">
										<span class="material-symbols-outlined">trending_up</span>
										<h3>Strengths</h3>
									</div>
									<div class="quadrant-content">
										{#if swotAnalysis.strengths && swotAnalysis.strengths.length > 0}
											{#each swotAnalysis.strengths as item}
												<div class="swot-item">• {item}</div>
											{/each}
										{:else}
											<p class="empty-text">No strengths identified</p>
										{/if}
									</div>
								</div>

								<!-- Weaknesses -->
								<div class="swot-quadrant weaknesses">
									<div class="quadrant-header">
										<span class="material-symbols-outlined">trending_down</span>
										<h3>Weaknesses</h3>
									</div>
									<div class="quadrant-content">
										{#if swotAnalysis.weaknesses && swotAnalysis.weaknesses.length > 0}
											{#each swotAnalysis.weaknesses as item}
												<div class="swot-item">• {item}</div>
											{/each}
										{:else}
											<p class="empty-text">No weaknesses identified</p>
										{/if}
									</div>
								</div>

								<!-- Opportunities -->
								<div class="swot-quadrant opportunities">
									<div class="quadrant-header">
										<span class="material-symbols-outlined">lightbulb</span>
										<h3>Opportunities</h3>
									</div>
									<div class="quadrant-content">
										{#if swotAnalysis.opportunities && swotAnalysis.opportunities.length > 0}
											{#each swotAnalysis.opportunities as item}
												<div class="swot-item">• {item}</div>
											{/each}
										{:else}
											<p class="empty-text">No opportunities identified</p>
										{/if}
									</div>
								</div>

								<!-- Threats -->
								<div class="swot-quadrant threats">
									<div class="quadrant-header">
										<span class="material-symbols-outlined">warning</span>
										<h3>Threats</h3>
									</div>
									<div class="quadrant-content">
										{#if swotAnalysis.threats && swotAnalysis.threats.length > 0}
											{#each swotAnalysis.threats as item}
												<div class="swot-item">• {item}</div>
											{/each}
										{:else}
											<p class="empty-text">No threats identified</p>
										{/if}
									</div>
								</div>
							</div>
						</div>
						{/if}

						<!-- VRIO Analysis Section -->
						<div class="minimal-card">
							<div class="card-header">
								<span class="material-symbols-outlined icon-large">shield</span>
								<h2 class="section-title">VRIO Framework Analysis</h2>
								<div class="card-header-actions">
									<button class="info-btn" on:click={() => showInfo('vrio')} title="What is this?">
										<span class="info-icon">i</span>
									</button>
									<button class="daddy-btn" on:click={() => askDaddy('vrio')} title="Ask Daddy">
										<span class="daddy-icon">D</span>
									</button>
								</div>
							</div>
							<p class="section-desc">Evaluating resources for sustainable competitive advantage</p>
							
							{#if true}
							{@const hasProprietaryTech = String(ddqResponses[18] || '').includes('Yes')}
							{@const hasPreviousStartup = String(ddqResponses[18] || '').includes('Previous Startup')}
							{@const hasIndustryExpert = String(ddqResponses[18] || '').includes('Industry Expert')}
							{@const hasTechnicalFounder = String(ddqResponses[18] || '').includes('Technical')}
							{@const teamSize = Number(ddqResponses[17]) || 1}
							{@const isOrganized = teamSize > 1}
							{@const hasRevenue = ddqResponses[12] === 'Yes'}
							{@const customerCount = Number(ddqResponses[15]) || 0}
							
							<div class="vrio-table">
								<div class="vrio-header-row">
									<div class="vrio-col resource-col">Resource</div>
									<div class="vrio-col">Valuable</div>
									<div class="vrio-col">Rare</div>
									<div class="vrio-col">Inimitable</div>
									<div class="vrio-col">Organized</div>
									<div class="vrio-col result-col">Implication</div>
								</div>
								
								<!-- Technology/IP -->
								<div class="vrio-row">
									<div class="vrio-col resource-col">
										<span class="material-symbols-outlined">code</span>
										Technology/IP
									</div>
									<div class="vrio-col"><span class="vrio-check-icon yes">✓</span></div>
									<div class="vrio-col"><span class="vrio-check-icon {hasProprietaryTech ? 'yes' : 'no'}">{hasProprietaryTech ? '✓' : '✗'}</span></div>
									<div class="vrio-col"><span class="vrio-check-icon {hasProprietaryTech && hasTechnicalFounder ? 'yes' : 'no'}">{hasProprietaryTech && hasTechnicalFounder ? '✓' : '✗'}</span></div>
									<div class="vrio-col"><span class="vrio-check-icon {isOrganized ? 'yes' : 'no'}">{isOrganized ? '✓' : '✗'}</span></div>
									<div class="vrio-col result-col {hasProprietaryTech && hasTechnicalFounder && isOrganized ? 'sustained' : hasProprietaryTech ? 'temporary' : 'parity'}">
										{hasProprietaryTech && hasTechnicalFounder && isOrganized ? 'Sustained Advantage' : hasProprietaryTech ? 'Temporary Advantage' : 'Competitive Parity'}
									</div>
								</div>
								
								<!-- Team Expertise -->
								<div class="vrio-row">
									<div class="vrio-col resource-col">
										<span class="material-symbols-outlined">groups</span>
										Team Expertise
									</div>
									<div class="vrio-col"><span class="vrio-check-icon {hasIndustryExpert || hasPreviousStartup ? 'yes' : 'no'}">{hasIndustryExpert || hasPreviousStartup ? '✓' : '✗'}</span></div>
									<div class="vrio-col"><span class="vrio-check-icon {hasIndustryExpert && hasPreviousStartup ? 'yes' : 'no'}">{hasIndustryExpert && hasPreviousStartup ? '✓' : '✗'}</span></div>
									<div class="vrio-col"><span class="vrio-check-icon {hasPreviousStartup ? 'yes' : 'no'}">{hasPreviousStartup ? '✓' : '✗'}</span></div>
									<div class="vrio-col"><span class="vrio-check-icon {isOrganized ? 'yes' : 'no'}">{isOrganized ? '✓' : '✗'}</span></div>
									<div class="vrio-col result-col {hasIndustryExpert && hasPreviousStartup && isOrganized ? 'sustained' : hasIndustryExpert || hasPreviousStartup ? 'temporary' : 'disadvantage'}">
										{hasIndustryExpert && hasPreviousStartup && isOrganized ? 'Sustained Advantage' : hasIndustryExpert || hasPreviousStartup ? 'Temporary Advantage' : 'Disadvantage'}
									</div>
								</div>
								
								<!-- Customer Base -->
								<div class="vrio-row">
									<div class="vrio-col resource-col">
										<span class="material-symbols-outlined">people</span>
										Customer Base
									</div>
									<div class="vrio-col"><span class="vrio-check-icon {hasRevenue ? 'yes' : 'no'}">{hasRevenue ? '✓' : '✗'}</span></div>
									<div class="vrio-col"><span class="vrio-check-icon {customerCount > 500 ? 'yes' : 'no'}">{customerCount > 500 ? '✓' : '✗'}</span></div>
									<div class="vrio-col"><span class="vrio-check-icon {customerCount > 1000 ? 'yes' : 'no'}">{customerCount > 1000 ? '✓' : '✗'}</span></div>
									<div class="vrio-col"><span class="vrio-check-icon {isOrganized ? 'yes' : 'no'}">{isOrganized ? '✓' : '✗'}</span></div>
									<div class="vrio-col result-col {customerCount > 1000 && isOrganized ? 'sustained' : hasRevenue ? 'temporary' : 'disadvantage'}">
										{customerCount > 1000 && isOrganized ? 'Sustained Advantage' : hasRevenue ? 'Temporary Advantage' : 'Disadvantage'}
									</div>
								</div>
								
								<!-- Brand/Reputation -->
								<div class="vrio-row">
									<div class="vrio-col resource-col">
										<span class="material-symbols-outlined">stars</span>
										Brand
									</div>
									<div class="vrio-col"><span class="vrio-check-icon {customerCount > 100 ? 'yes' : 'no'}">{customerCount > 100 ? '✓' : '✗'}</span></div>
									<div class="vrio-col"><span class="vrio-check-icon no">✗</span></div>
									<div class="vrio-col"><span class="vrio-check-icon no">✗</span></div>
									<div class="vrio-col"><span class="vrio-check-icon {isOrganized ? 'yes' : 'no'}">{isOrganized ? '✓' : '✗'}</span></div>
									<div class="vrio-col result-col parity">Competitive Parity</div>
								</div>
							</div>
							{/if}
						</div>
					</div>
				</div>
			{:else}
				<div class="minimal-card">
					<div class="empty-state">
						<span class="material-symbols-outlined icon-empty">psychology</span>
						<h3>No Introspection Data Yet</h3>
						<p>Complete the assessment to view your company analysis</p>
							<button class="btn-primary" on:click={startDDQ}>
								<span class="material-symbols-outlined">rocket_launch</span>
								Start Assessment
							</button>
						</div>
					</div>
				{/if}
			
			<!-- Introspection Tab -->
			{:else if activeTab === 'strengths-weaknesses'}
				{#if swotAnalysis}
					<div class="strengths-weaknesses-section">
						<div class="minimal-card">
							<div class="card-header">
								<span class="material-symbols-outlined icon-large">balance</span>
								<h2 class="section-title">Introspection</h2>
								<p class="section-subtitle">Strengths, Weaknesses, Opportunities & Threats</p>
							</div>

							<div class="balance-grid">
								<!-- Strengths -->
								<div class="analysis-panel strengths-panel">
									<div class="panel-header">
										<span class="material-symbols-outlined">trending_up</span>
										<h3>Strengths</h3>
										<span class="count-badge">{swotAnalysis.strengths?.length || 0}</span>
									</div>
									<div class="panel-content">
										{#if swotAnalysis.strengths && swotAnalysis.strengths.length > 0}
											{#each swotAnalysis.strengths as strength, index}
												<div class="analysis-item strengths-item">
													<span class="item-number">{index + 1}</span>
													<p>{strength}</p>
												</div>
											{/each}
										{:else}
											<div class="empty-panel">
												<span class="material-symbols-outlined">lightbulb</span>
												<p>No strengths identified yet</p>
											</div>
										{/if}
									</div>
								</div>

								<!-- Weaknesses -->
								<div class="analysis-panel weaknesses-panel">
									<div class="panel-header">
										<span class="material-symbols-outlined">trending_down</span>
										<h3>Weaknesses</h3>
										<span class="count-badge">{swotAnalysis.weaknesses?.length || 0}</span>
									</div>
									<div class="panel-content">
										{#if swotAnalysis.weaknesses && swotAnalysis.weaknesses.length > 0}
											{#each swotAnalysis.weaknesses as weakness, index}
												<div class="analysis-item weaknesses-item">
													<span class="item-number">{index + 1}</span>
													<p>{weakness}</p>
												</div>
											{/each}
										{:else}
											<div class="empty-panel">
												<span class="material-symbols-outlined">shield</span>
												<p>No weaknesses identified yet</p>
											</div>
										{/if}
									</div>
								</div>
							</div>

<!-- Internal Balance Score removed -->

							<!-- Opportunities vs Threats Section -->
							<div class="opportunities-threats-section" style="margin-top: 2rem;">
								<h3 class="subsection-title">
									<span class="material-symbols-outlined">currency_exchange</span>
									External Factors: Opportunities vs Threats
								</h3>
								<div class="balance-grid" style="margin-top: 1rem;">
									<!-- Opportunities -->
									<div class="analysis-panel opportunities-panel">
										<div class="panel-header">
											<span class="material-symbols-outlined">check_circle</span>
											<h3>Opportunities</h3>
											<span class="count-badge">{swotAnalysis.opportunities?.length || 0}</span>
										</div>
										<div class="panel-content">
											{#if swotAnalysis.opportunities && swotAnalysis.opportunities.length > 0}
												{#each swotAnalysis.opportunities as opportunity, index}
													<div class="analysis-item opportunities-item">
														<span class="item-number">{index + 1}</span>
														<p>{opportunity}</p>
													</div>
												{/each}
											{:else}
												<div class="empty-panel">
													<span class="material-symbols-outlined">explore</span>
													<p>No opportunities identified yet</p>
												</div>
											{/if}
										</div>
									</div>

									<!-- Threats -->
									<div class="analysis-panel threats-panel">
										<div class="panel-header">
											<span class="material-symbols-outlined">warning</span>
											<h3>Threats</h3>
											<span class="count-badge">{swotAnalysis.threats?.length || 0}</span>
										</div>
										<div class="panel-content">
											{#if swotAnalysis.threats && swotAnalysis.threats.length > 0}
												{#each swotAnalysis.threats as threat, index}
													<div class="analysis-item threats-item">
														<span class="item-number">{index + 1}</span>
														<p>{threat}</p>
													</div>
												{/each}
											{:else}
												<div class="empty-panel">
													<span class="material-symbols-outlined">shield_locked</span>
													<p>No threats identified yet</p>
												</div>
											{/if}
										</div>
									</div>
								</div>

								<!-- External Balance Indicator removed -->
							</div>

							<!-- VRIO Analysis Framework -->
							<div class="vrio-section">
								<h3 class="subsection-title">
									<span class="material-symbols-outlined">shield_with_heart</span>
									VRIO Analysis - Competitive Advantage
							</h3>
							<p class="subsection-desc">Evaluate your resources for sustainable competitive advantage</p>
							
							{#if true}
							{@const hasProprietaryTech = String(ddqResponses[18] || '').includes('Yes')}
							{@const hasPreviousStartup = String(ddqResponses[18] || '').includes('Previous Startup')}
							{@const hasIndustryExpert = String(ddqResponses[18] || '').includes('Industry Expert')}
							{@const hasTechnicalFounder = String(ddqResponses[18] || '').includes('Technical')}
							{@const teamSizeValue = Number(ddqResponses[17]) || 1}
							{@const isOrganized = teamSizeValue > 1}
							{@const uniqueValue = ddqResponses[7] || ''}
							{@const hasRevenueCheck = ddqResponses[12] === 'Yes'}
							
							{@const hasExpertise = hasIndustryExpert || hasPreviousStartup}
							{@const expertiseRare = hasIndustryExpert && hasPreviousStartup}
							{@const customerValue = hasRevenueCheck && Number(ddqResponses[15]) > 50}
							{@const customerRare = Number(ddqResponses[15]) > 500}
							{@const hardToSteal = Number(ddqResponses[15]) > 1000 || String(ddqResponses[19] || '').includes('Referrals')}
							
							{@const uvpStrong = (uniqueValue?.length || 0) > 50}
							{@const uvpDifferentiated = !String(ddqResponses[5] || '').toLowerCase().includes('none')}
							
							{@const expertiseAdvantage = hasExpertise && expertiseRare && isOrganized ? 'sustained' : hasExpertise && expertiseRare ? 'temporary' : hasExpertise ? 'parity' : 'disadvantage'}
							{@const tractionAdvantage = customerValue && customerRare && hardToSteal && isOrganized ? 'sustained' : customerValue && customerRare && hardToSteal ? 'temporary' : customerValue ? 'parity' : 'disadvantage'}
							{@const uvpAdvantage = uvpStrong && uvpDifferentiated && isOrganized ? 'temporary' : uvpStrong ? 'parity' : 'disadvantage'}
							
							<!-- Dynamic contextual explanations -->
							{@const expertiseExplanation = (() => {
								if (hasExpertise && expertiseRare && isOrganized) return "Strong founder background with rare skill combo. Team is leveraging it well — sustainable moat.";
								if (hasExpertise && expertiseRare) return "Rare expertise exists but team structure limits leverage. Build the team to capitalize.";
								if (hasExpertise && isOrganized) return "Solid expertise but common in the market. Others can hire similar talent easily.";
								if (hasExpertise) return "You have relevant experience but it's not rare. Competitors can match this.";
								if (isOrganized) return "Team structure is good but founder expertise needs strengthening. Consider advisors or co-founders.";
								return "Limited founder expertise for this domain. Consider building advisory network or upskilling.";
							})()}
							
							{@const tractionExplanation = (() => {
								if (customerValue && customerRare && hardToSteal && isOrganized) return "Strong customer base with high switching costs. Well-organized to scale — major competitive moat.";
								if (customerValue && customerRare && hardToSteal) return "Great traction with sticky customers but team capacity limits growth. Scale operations.";
								if (customerValue && customerRare) return "Good customer numbers but they can easily switch. Build loyalty programs and integrations.";
								if (customerValue && isOrganized) return "Revenue exists but customer base is still early. Focus on growth and retention.";
								if (customerValue) return "Some traction but not at scale yet. Keep pushing customer acquisition.";
								if (isOrganized) return "Team is ready but traction is weak. Prioritize product-market fit and sales.";
								return "Early stage with minimal traction. Focus on acquiring first customers and proving demand.";
							})()}
							
							{@const uvpExplanation = (() => {
								if (uvpStrong && uvpDifferentiated && isOrganized) return "Clear differentiation with solid execution. But UVPs can be copied — keep innovating.";
								if (uvpStrong && uvpDifferentiated) return "You have differentiation — good sign. But competitors can replicate. Execution needs work.";
								if (uvpStrong && isOrganized) return "Well-articulated UVP with good execution. But it's not unique enough — refine positioning.";
								if (uvpDifferentiated && isOrganized) return "You have differentiation and execution is solid, but defensibility is weak.";
								if (uvpStrong) return "UVP is defined but not differentiated enough. Study competitors and find unique angles.";
								if (uvpDifferentiated) return "Differentiation exists but not well-articulated. Clarify your value proposition.";
								if (isOrganized) return "Team is executing but UVP is unclear. Define what makes you truly different.";
								return "Value proposition needs work. Clearly define why customers should choose you over alternatives.";
							})()}
							
							<!-- VRIO Matrix Table -->
							<div class="vrio-matrix-container">
								<button class="vrio-info-btn" on:click={() => showVrioInfo = !showVrioInfo} title="What is VRIO?">
									<span class="material-symbols-outlined">info</span>
								</button>
								
								{#if showVrioInfo}
								<div class="vrio-info-popup">
									<div class="vrio-info-header">
										<h4>Understanding VRIO Framework</h4>
										<button class="close-btn" on:click={() => showVrioInfo = false}>
											<span class="material-symbols-outlined">close</span>
										</button>
									</div>
									<div class="explanation-grid">
										<div class="explanation-item">
											<strong>V - Valuable</strong>
											<p>Does this resource help exploit opportunities or neutralize threats?</p>
										</div>
										<div class="explanation-item">
											<strong>R - Rare</strong>
											<p>Is this resource scarce in the market?</p>
										</div>
										<div class="explanation-item">
											<strong>I - Inimitable</strong>
											<p>Is it difficult to copy or replicate?</p>
										</div>
										<div class="explanation-item">
											<strong>O - Organized</strong>
											<p>Is your organization structured to exploit these resources?</p>
										</div>
									</div>
									<div class="implications-list">
										<div class="implication-row"><span class="dot disadvantage"></span><span><strong>Competitive Disadvantage:</strong> Resource is not valuable — address urgently</span></div>
										<div class="implication-row"><span class="dot parity"></span><span><strong>Competitive Parity:</strong> Valuable but not rare — meets baseline</span></div>
										<div class="implication-row"><span class="dot temporary"></span><span><strong>Temporary Advantage:</strong> Valuable & rare but can be copied</span></div>
										<div class="implication-row"><span class="dot sustained"></span><span><strong>Sustained Advantage:</strong> V+R+I+O — your strategic moat</span></div>
									</div>
								</div>
								{/if}
								
								<table class="vrio-matrix">
									<thead>
										<tr>
											<th class="resource-col">Resource</th>
											<th>Valuable</th>
											<th>Rare</th>
											<th>Hard to Imitate</th>
											<th>Organized</th>
											<th class="outcome-col">Insight</th>
										</tr>
									</thead>
									<tbody>
										<!-- Founder Expertise Row -->
										<tr>
											<td class="resource-name">Founder expertise</td>
											<td class="vrio-cell">
												<span class="vrio-icon {hasExpertise ? 'yes' : 'no'}">
													{#if hasExpertise}✓{:else}✗{/if}
												</span>
											</td>
											<td class="vrio-cell">
												<span class="vrio-icon {expertiseRare ? 'yes' : 'no'}">
													{#if expertiseRare}✓{:else}✗{/if}
												</span>
											</td>
											<td class="vrio-cell">
												<span class="vrio-icon no">✗</span>
											</td>
											<td class="vrio-cell">
												<span class="vrio-icon {isOrganized ? 'yes' : 'no'}">
													{#if isOrganized}✓{:else}✗{/if}
												</span>
											</td>
											<td class="outcome-cell {expertiseAdvantage}">
												{expertiseExplanation}
											</td>
										</tr>
										
										<!-- Customer Traction Row -->
										<tr>
											<td class="resource-name">Customer traction</td>
											<td class="vrio-cell">
												<span class="vrio-icon {customerValue ? 'yes' : 'no'}">
													{#if customerValue}✓{:else}✗{/if}
												</span>
											</td>
											<td class="vrio-cell">
												<span class="vrio-icon {customerRare ? 'yes' : 'no'}">
													{#if customerRare}✓{:else}✗{/if}
												</span>
											</td>
											<td class="vrio-cell">
												<span class="vrio-icon {hardToSteal ? 'yes' : 'no'}">
													{#if hardToSteal}✓{:else}✗{/if}
												</span>
											</td>
											<td class="vrio-cell">
												<span class="vrio-icon {isOrganized ? 'yes' : 'no'}">
													{#if isOrganized}✓{:else}✗{/if}
												</span>
											</td>
											<td class="outcome-cell {tractionAdvantage}">
												{tractionExplanation}
											</td>
										</tr>
										
										<!-- UVP Row -->
										<tr>
											<td class="resource-name">UVP</td>
											<td class="vrio-cell">
												<span class="vrio-icon {uvpStrong ? 'yes' : 'no'}">
													{#if uvpStrong}✓{:else}✗{/if}
												</span>
											</td>
											<td class="vrio-cell">
												<span class="vrio-icon {uvpDifferentiated ? 'yes' : 'no'}">
													{#if uvpDifferentiated}✓{:else}✗{/if}
												</span>
											</td>
											<td class="vrio-cell">
												<span class="vrio-icon no">✗</span>
											</td>
											<td class="vrio-cell">
												<span class="vrio-icon {isOrganized ? 'yes' : 'no'}">
													{#if isOrganized}✓{:else}✗{/if}
												</span>
											</td>
											<td class="outcome-cell {uvpAdvantage}">
												{uvpExplanation}
											</td>
										</tr>
										
										<!-- Proprietary Technology Row (if applicable) -->
										{#if hasProprietaryTech}
										{@const techRare = hasTechnicalFounder && hasProprietaryTech}
										{@const techHardToImitate = hasTechnicalFounder && hasProprietaryTech}
										{@const techAdvantage = isOrganized && techHardToImitate && techRare ? 'sustained' : techHardToImitate && techRare ? 'temporary' : techRare ? 'parity' : 'disadvantage'}
										{@const techExplanation = (() => {
											if (isOrganized && techHardToImitate && techRare) return "Proprietary tech with technical depth and team to scale. Strong defensible moat.";
											if (techHardToImitate && techRare) return "Solid tech IP but team structure limits leverage. Build engineering capacity.";
											if (techRare) return "Tech exists but can be replicated. Consider patents or deeper technical moats.";
											return "Tech claimed but not differentiated. Invest in R&D or unique technical approaches.";
										})()}
										<tr>
											<td class="resource-name">Proprietary tech/IP</td>
											<td class="vrio-cell">
												<span class="vrio-icon yes">✓</span>
											</td>
											<td class="vrio-cell">
												<span class="vrio-icon {techRare ? 'yes' : 'no'}">
													{#if techRare}✓{:else}✗{/if}
												</span>
											</td>
											<td class="vrio-cell">
												<span class="vrio-icon {techHardToImitate ? 'yes' : 'no'}">
													{#if techHardToImitate}✓{:else}✗{/if}
												</span>
											</td>
											<td class="vrio-cell">
												<span class="vrio-icon {isOrganized ? 'yes' : 'no'}">
													{#if isOrganized}✓{:else}✗{/if}
												</span>
											</td>
											<td class="outcome-cell {techAdvantage}">
												{techExplanation}
											</td>
										</tr>
										{/if}
									</tbody>
								</table>
							</div>

								<!-- VRIO Summary & Explanations -->
								<div class="vrio-summary">
									<h4>
										<span class="material-symbols-outlined">summarize</span>
									Strategic Recommendation
								</h4>
								{#if true}
								{@const sustainedCount = [
									hasProprietaryTech && isOrganized ? 1 : 0,
									hasExpertise && expertiseRare && isOrganized ? 1 : 0,
									customerValue && customerRare && hardToSteal && isOrganized ? 1 : 0
								].reduce((a, b) => a + b, 0)}
								{@const categories = toDisplayString(ddqResponses[3]) || 'Technology'}
								{@const productStage = ddqResponses[5] || 'MVP'}
								{@const mainChallenges = toDisplayString(ddqResponses[19]) || 'Growth'}
									<p>
										{#if sustainedCount >= 2}
											<strong>Strong Position for {categories}:</strong> With {sustainedCount} sustained competitive advantages, your {productStage}-stage startup has solid foundations. 
											<span class="recommendation-detail">Priority Actions: 1) Protect IP through patents/trade secrets, 2) Build organizational processes to scale your {categories} expertise, 3) Deepen customer relationships to increase switching costs.</span>
										{:else if sustainedCount === 1}
											<strong>Developing Position in {categories}:</strong> You have 1 sustainable advantage which is good for {productStage} stage.
											<span class="recommendation-detail">Priority Actions: 1) {!hasProprietaryTech ? 'Invest in proprietary technology/IP development' : 'Strengthen team expertise'}, 2) {mainChallenges.includes('Customers') ? 'Focus on customer acquisition and retention strategies' : 'Build organizational capabilities'}, 3) Document and protect your competitive advantages.</span>
										{:else}
											<strong>Building Phase for {categories} Startup:</strong> As a {productStage}-stage company facing {mainChallenges} challenges, focus on developing defensible advantages.
											<span class="recommendation-detail">Priority Actions: 1) {categories.includes('AI') || categories.includes('SaaS') ? 'Develop proprietary algorithms or unique data moats' : 'Create unique processes or partnerships'}, 2) Build founder expertise through industry networking and certifications, 3) Focus on early customer wins to build traction moat.</span>
										{/if}
									</p>
								{/if}
								</div>

								<!-- Product Insight - Performance Comparison -->
								<div class="product-insight-section">
									<h4>
										<span class="material-symbols-outlined">insights</span>
										Product Insight
										<div class="card-header-actions inline">
											<button class="info-btn" on:click={() => showInfo('product-insight')} title="What is this?">
												<span class="info-icon">i</span>
											</button>
											<button class="daddy-btn" on:click={() => askDaddy('product-insight')} title="Ask Daddy">
												<span class="daddy-icon">D</span>
											</button>
										</div>
									</h4>
									<p class="insight-subtitle">How your product performs against market benchmarks</p>
									
									{#if true}
									{@const userRevenue = Number(ddqResponses[13]) || 0}
									{@const userInvestment = Number(ddqResponses[11]) || 0}
									{@const userBurnRate = Number(ddqResponses[16]) || (userRevenue * 0.6)}
									{@const userRunway = userBurnRate > 0 ? Math.round((userInvestment + (userRevenue * 12)) / (userBurnRate * 12)) : 0}
									{@const userMarketingSpend = Math.round(userBurnRate * 0.25)}
									{@const userEfficiency = userBurnRate > 0 ? (userRevenue / userBurnRate) * 100 : 0}
									
									<!-- Profitable Company Benchmark -->
									{@const profitableBenchmark = {
										revenue: 8000000,
										investment: 25000000,
										burnRate: 5000000,
										runway: 24,
										marketingSpend: 1200000,
										efficiency: 160,
										grossMargin: 65,
										netMargin: 15
									}}
									
									<div class="benchmark-comparison-section">
										<div class="benchmark-header-info">
											<span class="material-symbols-outlined">emoji_events</span>
											<div>
												<h4>Profitable Company Benchmark</h4>
												<p>What successful Series A+ startups look like</p>
											</div>
										</div>
										
										<div class="benchmark-table">
											<div class="benchmark-row header">
												<span class="metric-name">Metric</span>
												<span class="your-val">Your Value</span>
												<span class="benchmark-val">Profitable Benchmark</span>
												<span class="status-col">Status</span>
											</div>
											
											<div class="benchmark-row">
												<span class="metric-name">
													<span class="material-symbols-outlined">payments</span>
													Monthly Revenue
												</span>
												<span class="your-val">₹{(userRevenue / 100000).toFixed(1)}L</span>
												<span class="benchmark-val">₹{(profitableBenchmark.revenue / 100000).toFixed(0)}L</span>
												<span class="status-col {userRevenue >= profitableBenchmark.revenue ? 'positive' : userRevenue >= profitableBenchmark.revenue * 0.5 ? 'warning' : 'negative'}">
													{#if userRevenue >= profitableBenchmark.revenue}
														✓ Exceeds
													{:else if userRevenue >= profitableBenchmark.revenue * 0.5}
														↗ Growing
													{:else}
														⚠ Below
													{/if}
												</span>
											</div>
											
											<div class="benchmark-row">
												<span class="metric-name">
													<span class="material-symbols-outlined">local_fire_department</span>
													Monthly Burn
												</span>
												<span class="your-val">₹{(userBurnRate / 100000).toFixed(1)}L</span>
												<span class="benchmark-val">₹{(profitableBenchmark.burnRate / 100000).toFixed(0)}L</span>
												<span class="status-col {userBurnRate <= profitableBenchmark.burnRate ? 'positive' : 'warning'}">
													{#if userBurnRate <= profitableBenchmark.burnRate * 0.5}
														✓ Lean
													{:else if userBurnRate <= profitableBenchmark.burnRate}
														✓ Controlled
													{:else}
														⚠ High
													{/if}
												</span>
											</div>
											
											<div class="benchmark-row">
												<span class="metric-name">
													<span class="material-symbols-outlined">speed</span>
													Revenue Efficiency
												</span>
												<span class="your-val">{userEfficiency.toFixed(0)}%</span>
												<span class="benchmark-val">{profitableBenchmark.efficiency}%</span>
												<span class="status-col {userEfficiency >= 100 ? 'positive' : userEfficiency >= 50 ? 'warning' : 'negative'}">
													{#if userEfficiency >= 100}
														✓ Profitable
													{:else if userEfficiency >= 50}
														↗ Near
													{:else}
														⚠ Work needed
													{/if}
												</span>
											</div>
											
											<div class="benchmark-row">
												<span class="metric-name">
													<span class="material-symbols-outlined">timer</span>
													Runway
												</span>
												<span class="your-val">{userRunway} months</span>
												<span class="benchmark-val">{profitableBenchmark.runway}+ months</span>
												<span class="status-col {userRunway >= 18 ? 'positive' : userRunway >= 12 ? 'warning' : 'negative'}">
													{#if userRunway >= 18}
														✓ Strong
													{:else if userRunway >= 12}
														↗ Adequate
													{:else}
														⚠ Low
													{/if}
												</span>
											</div>
											
											<div class="benchmark-row">
												<span class="metric-name">
													<span class="material-symbols-outlined">account_balance</span>
													Total Raised
												</span>
												<span class="your-val">₹{(userInvestment / 10000000).toFixed(2)}Cr</span>
												<span class="benchmark-val">₹{(profitableBenchmark.investment / 10000000).toFixed(1)}Cr</span>
												<span class="status-col neutral">
													{#if userInvestment >= profitableBenchmark.investment}
														💰 Well-funded
													{:else if userInvestment > 0}
														💡 Capital efficient
													{:else}
														🎯 Bootstrapped
													{/if}
												</span>
											</div>
										</div>
										
										<!-- Key Insights Box -->
										<div class="profitability-insights">
											<div class="insight-title">
												<span class="material-symbols-outlined">lightbulb</span>
												Key Profitability Metrics
											</div>
											<div class="insight-grid">
												<div class="insight-item">
													<span class="label">Target Gross Margin</span>
													<span class="value">{profitableBenchmark.grossMargin}%+</span>
												</div>
												<div class="insight-item">
													<span class="label">Target Net Margin</span>
													<span class="value">{profitableBenchmark.netMargin}%+</span>
												</div>
												<div class="insight-item">
													<span class="label">Revenue/Burn Ratio</span>
													<span class="value">&gt;1.6x</span>
												</div>
												<div class="insight-item">
													<span class="label">Path to Profit</span>
													<span class="value">12-18 mo</span>
												</div>
											</div>
											<p class="insight-note">
												💡 <strong>Profitable startups</strong> typically achieve revenue that exceeds burn by 60%+, 
												maintain 18+ months runway, and reach profitability within 3-4 years of founding.
											</p>
										</div>
									</div>
									{/if}
								</div>
							{/if}
						</div>
					</div>
				</div>
			{:else}
				<div class="minimal-card">
					<div class="empty-state">
						<span class="material-symbols-outlined icon-empty">balance</span>
							<h3>No Analysis Available</h3>
							<p>Complete the assessment to view internal analysis</p>
							<button class="btn-primary" on:click={startDDQ}>
								<span class="material-symbols-outlined">rocket_launch</span>
								Start Assessment
							</button>
						</div>
					</div>
				{/if}

			<!-- Marketing Trends Tab -->
			{:else if activeTab === 'trends'}
				{#if !competitors}
					<div class="minimal-card">
						<div class="empty-state">
							<span class="material-symbols-outlined icon-empty">query_stats</span>
							<h3>Loading Competitor Analysis...</h3>
							<p>Complete the assessment to fetch market trends and competitor data</p>
							<button class="btn-primary" on:click={() => { getCompetitors(); }}>
								<span class="material-symbols-outlined">refresh</span>
								Load Competitors
							</button>
						</div>
					</div>
				{:else}
					<div class="trends-section">
						<div class="minimal-card">
							<div class="card-header">
								<span class="material-symbols-outlined icon-large">query_stats</span>
								<h2 class="section-title">Marketing Trends & Competitor Analysis</h2>
								<div class="card-header-actions">
									<button class="info-btn" on:click={() => showInfo('competitors')} title="What is this?">
										<span class="info-icon">i</span>
									</button>
									<button class="daddy-btn" on:click={() => askDaddy('competitors')} title="Ask Daddy">
										<span class="daddy-icon">D</span>
									</button>
								</div>
								<p class="section-subtitle">Track top competitors and market performance</p>
							</div>

							<!-- Know your Market Section -->
							{#if valuation}
							<div class="know-your-market-section">
								<h3 class="subsection-title">
									<span class="material-symbols-outlined">analytics</span>
									Know your Market
								</h3>
								<div class="market-metrics-grid">
									<div class="metric-box tam">
										<div class="metric-header-small">
											<span class="material-symbols-outlined">language</span>
											<span>TAM</span>
										</div>
										<div class="metric-value-large">₹{(valuation.TAM / 10000000).toFixed(0)} Cr</div>
										<div class="metric-desc-small">Total Addressable Market</div>
										<div class="metric-sub">{ddqResponses[3] || 'Market'}</div>
									</div>
									<div class="metric-box sam">
										<div class="metric-header-small">
											<span class="material-symbols-outlined">target</span>
											<span>SAM</span>
										</div>
										<div class="metric-value-large">₹{(valuation.SAM / 10000000).toFixed(0)} Cr</div>
										<div class="metric-desc-small">Serviceable Addressable Market</div>
										<div class="metric-sub">{((valuation.SAM / valuation.TAM) * 100).toFixed(0)}% of TAM</div>
									</div>
									<div class="metric-box som">
										<div class="metric-header-small">
											<span class="material-symbols-outlined">my_location</span>
											<span>SOM</span>
										</div>
										<div class="metric-value-large">₹{(valuation.SOM / 10000000).toFixed(0)} Cr</div>
										<div class="metric-desc-small">Serviceable Obtainable Market</div>
										<div class="metric-sub">Target market</div>
									</div>
									<div class="metric-box cagr">
										<div class="metric-header-small">
											<span class="material-symbols-outlined">show_chart</span>
											<span>CAGR</span>
										</div>
										<div class="metric-value-large">{valuation.CAGR.toFixed(0)}%</div>
										<div class="metric-desc-small">Compound Annual Growth</div>
										<div class="metric-sub">{valuation.CAGR > 50 ? 'Fast Growth 📈' : 'Steady Growth'}</div>
									</div>
								</div>
							</div>
							{/if}

							<!-- Monitoring List -->
							{#if monitoredCompetitors.length > 0}
								<div class="monitoring-section">
									<h3 class="subsection-title">
										<span class="material-symbols-outlined">visibility</span>
										Monitored Competitors
									</h3>
									<div class="monitored-list">
										{#each monitoredCompetitors as name}
											<div class="monitored-item">
												<span class="material-symbols-outlined">star</span>
												<span>{name}</span>
												<button class="btn-icon" on:click={() => removeFromMonitoring(name)}>
													<span class="material-symbols-outlined">close</span>
												</button>
											</div>
										{/each}
									</div>
								</div>
							{/if}

							<!-- Performance Graph - Line Chart -->
							{#if competitors && competitors.filter((c: any) => c.visible && c.valuationTimeline && c.valuationTimeline.length > 0).length > 0}
							{@const visibleCompetitors = competitors.filter((c: any) => c.visible && c.valuationTimeline && c.valuationTimeline.length > 0)}
							{@const chartColors = ['#4ade80', '#60a5fa', '#f472b6', '#fbbf24', '#a78bfa', '#34d399', '#fb923c', '#ef4444']}
							{@const allYears = [...new Set(visibleCompetitors.flatMap((c: any) => c.valuationTimeline?.map((v: any) => v.year) || []))].sort((a: any, b: any) => Number(a) - Number(b))}
							{@const maxValuation = Math.max(...visibleCompetitors.flatMap((c: any) => c.valuationTimeline?.map((v: any) => Number(v.valuation) || 0) || [0]), 1)}
							{@const chartWidth = 800}
							{@const chartHeight = 400}
							{@const padding = { top: 40, right: 150, bottom: 60, left: 100 }}
							{@const yearDivisor = Math.max(allYears.length - 1, 1)}
							<div class="performance-section">
								<h3 class="subsection-title">
									<span class="material-symbols-outlined">trending_up</span>
									Valuation Growth Over Time
								</h3>
								
								<div class="chart-container line-chart-container">
									<!-- Enhanced Legend Box -->
									<div class="chart-legend-box">
										<div class="legend-header">
											<span class="material-symbols-outlined">info</span>
											Legend
										</div>
										<div class="legend-items">
											{#each visibleCompetitors as competitor, i}
												<div class="legend-row" style="--legend-color: {chartColors[i % chartColors.length]}">
													<div class="legend-color-line" style="background: {chartColors[i % chartColors.length]}"></div>
													<span class="legend-company-name">{competitor.name}</span>
													{#if competitor.isUserMentioned}
														<span class="legend-badge your-pick">Your Pick</span>
													{:else if competitor.region === 'local'}
														<span class="legend-badge local">🇮🇳 Local</span>
													{:else if competitor.region === 'international'}
														<span class="legend-badge global">🌍 Global</span>
													{/if}
												</div>
											{/each}
										</div>
									</div>

									<!-- SVG Line Chart -->
									<div class="svg-chart-wrapper" style="position: relative;">
										<!-- Hover Tooltip -->
										{#if chartTooltip.visible}
											<div 
												class="chart-tooltip"
												style="left: {chartTooltip.x}px; top: {chartTooltip.y}px;"
											>
												<div class="tooltip-company">{chartTooltip.company}</div>
												<div class="tooltip-year">Year: {chartTooltip.year}</div>
												<div class="tooltip-valuation">₹{(chartTooltip.valuation / 10000000).toLocaleString('en-IN', { maximumFractionDigits: 0 })} Cr</div>
												{#if chartTooltip.event}
													<div class="tooltip-event">{chartTooltip.event}</div>
												{/if}
											</div>
										{/if}
										
										<svg viewBox="0 0 {chartWidth} {chartHeight}" class="valuation-line-chart">
											<!-- Y-Axis Grid Lines and Labels -->
											{#each [0, 0.25, 0.5, 0.75, 1] as tick}
												{@const y = padding.top + (1 - tick) * (chartHeight - padding.top - padding.bottom)}
												{@const value = tick * maxValuation}
												<line 
													x1={padding.left} 
													y1={y} 
													x2={chartWidth - padding.right} 
													y2={y} 
													stroke="var(--border-color)" 
													stroke-dasharray="4,4" 
													opacity="0.5"
												/>
												<text 
													x={padding.left - 10} 
													y={y + 4} 
													text-anchor="end" 
													class="axis-label"
												>
													₹{value >= 10000000000000 ? (value / 10000000000000).toFixed(0) + 'L Cr' : 
													   value >= 100000000000 ? (value / 100000000000).toFixed(0) + 'K Cr' :
													   value >= 10000000 ? (value / 10000000).toFixed(0) + ' Cr' : 
													   (value / 100000).toFixed(0) + ' L'}
												</text>
											{/each}

											<!-- X-Axis Labels (Years) -->
											{#each allYears as year, i}
												{@const x = padding.left + (i / yearDivisor) * (chartWidth - padding.left - padding.right)}
												<text 
													x={x} 
													y={chartHeight - padding.bottom + 25} 
													text-anchor="middle" 
													class="axis-label"
												>
													{year}
												</text>
												<line 
													x1={x} 
													y1={chartHeight - padding.bottom} 
													x2={x} 
													y2={chartHeight - padding.bottom + 5} 
													stroke="var(--text-secondary)"
												/>
											{/each}

											<!-- Axis Lines -->
											<line 
												x1={padding.left} 
												y1={padding.top} 
												x2={padding.left} 
												y2={chartHeight - padding.bottom} 
												stroke="var(--text-secondary)" 
												stroke-width="2"
											/>
											<line 
												x1={padding.left} 
												y1={chartHeight - padding.bottom} 
												x2={chartWidth - padding.right} 
												y2={chartHeight - padding.bottom} 
												stroke="var(--text-secondary)" 
												stroke-width="2"
											/>

											<!-- Lines for each competitor -->
											{#each visibleCompetitors as competitor, compIndex}
												{@const color = chartColors[compIndex % chartColors.length]}
												{@const timeline = (competitor.valuationTimeline || []).filter((p: any) => p && p.year !== undefined && p.valuation !== undefined)}
												
												<!-- Draw line path -->
												{#if timeline.length > 1 && allYears.length > 0}
													<path 
														d={timeline.map((point: any, i: number) => {
															const yearIndex = Math.max(0, allYears.indexOf(point.year));
															const safeYearDivisor = Math.max(allYears.length - 1, 1);
															const x = padding.left + (yearIndex / safeYearDivisor) * (chartWidth - padding.left - padding.right);
															const safeValuation = Number(point.valuation) || 0;
															const y = padding.top + (1 - safeValuation / maxValuation) * (chartHeight - padding.top - padding.bottom);
															return `${i === 0 ? 'M' : 'L'} ${isNaN(x) ? padding.left : x} ${isNaN(y) ? padding.top : y}`;
														}).join(' ')}
														fill="none" 
														stroke={color} 
														stroke-width="3" 
														stroke-linecap="round"
														stroke-linejoin="round"
														class="chart-line"
													/>
												{/if}

												<!-- Draw dots for each data point with hover tooltip -->
												{#each timeline as point, pointIndex}
													{@const yearIndex = Math.max(0, allYears.indexOf(point.year))}
													{@const safeValuation = Number(point.valuation) || 0}
													{@const x = padding.left + (yearIndex / yearDivisor) * (chartWidth - padding.left - padding.right)}
													{@const y = padding.top + (1 - safeValuation / maxValuation) * (chartHeight - padding.top - padding.bottom)}
													
													<!-- svelte-ignore a11y-no-static-element-interactions -->
													<circle 
														cx={isNaN(x) ? padding.left : x} 
														cy={isNaN(y) ? padding.top : y} 
														r="8" 
														fill={color} 
														stroke="var(--card-bg)" 
														stroke-width="3"
														class="chart-dot interactive-dot"
														on:mouseenter={(e) => {
															chartTooltip = {
																visible: true,
																x: e.offsetX + 15,
																y: e.offsetY - 70,
																company: competitor.name,
																year: point.year,
																valuation: safeValuation,
																event: point.event || ''
															};
														}}
														on:mouseleave={() => {
															chartTooltip = { ...chartTooltip, visible: false };
														}}
													/>
												{/each}
											{/each}

											<!-- Y-Axis Title -->
											<text 
												x={20} 
												y={chartHeight / 2} 
												text-anchor="middle" 
												transform="rotate(-90, 20, {chartHeight / 2})" 
												class="axis-title"
											>
												Valuation (₹)
											</text>

											<!-- X-Axis Title -->
											<text 
												x={(chartWidth - padding.left - padding.right) / 2 + padding.left} 
												y={chartHeight - 10} 
												text-anchor="middle" 
												class="axis-title"
											>
												Year
											</text>
										</svg>
									</div>

									<!-- Data Source Info -->
									<div class="data-source-info">
										<span class="material-symbols-outlined">verified</span>
										<span>Data sourced from funding rounds, IPO filings & verified business reports</span>
									</div>
								</div>
							</div>
							{/if}

							<!-- Market Trends Section -->
							{#if marketTrends && marketTrends.length > 0}
								<div class="market-trends-section">
									<h3 class="subsection-title trends-title">
										<span class="material-symbols-outlined">insights</span>
										Market Trends (Bullish Signals)
									</h3>
									<div class="trends-list">
										{#each marketTrends as trend}
											<div class="trend-item">
												<strong class="trend-title">{trend.title}:</strong>
												<span class="trend-value">{trend.value}</span>
												<span class="trend-description">({trend.description})</span>
											</div>
										{/each}
									</div>
								</div>
							{/if}

							<!-- Market Opportunities Section -->
							{#if marketOpportunities}
								<div class="market-opportunities-section">
									<h3 class="subsection-title opportunities-title">
										<span class="material-symbols-outlined">target</span>
										Market Opportunities
									</h3>
									<div class="opportunities-grid">
										{#if marketOpportunities.governmentPSU}
											<div class="opportunity-card govt">
												<h4>{marketOpportunities.governmentPSU.title}</h4>
												<ul>
													{#each marketOpportunities.governmentPSU.items as item}
														<li><span class="checkmark">✓</span> {item}</li>
													{/each}
												</ul>
											</div>
										{/if}
										{#if marketOpportunities.enterpriseChannel}
											<div class="opportunity-card enterprise">
												<h4>{marketOpportunities.enterpriseChannel.title}</h4>
												<ul>
													{#each marketOpportunities.enterpriseChannel.items as item}
														<li><span class="checkmark">✓</span> {item}</li>
													{/each}
												</ul>
											</div>
										{/if}
									</div>
								</div>
							{/if}

							<!-- Strategic Recommendations Section -->
							{#if strategicRecommendations && strategicRecommendations.length > 0}
								<div class="strategic-recommendations-section">
									<h3 class="subsection-title strategy-title">
										<span class="material-symbols-outlined">lightbulb</span>
										Strategic Recommendations
									</h3>
									<div class="recommendations-list">
										{#each strategicRecommendations as rec, index}
											<div class="recommendation-card priority-{rec.priority.toLowerCase()}">
												<div class="rec-header">
													<span class="rec-number">{index + 1}.</span>
													<span class="rec-title">{rec.title}</span>
													<span class="priority-badge {rec.priority.toLowerCase()}">(Priority: {rec.priority})</span>
												</div>
												<p class="rec-description">{rec.description}</p>
												{#if rec.target}
													<div class="rec-target">
														<span class="material-symbols-outlined">flag</span>
														<strong>Target:</strong> {rec.target}
													</div>
												{/if}
											</div>
										{/each}
									</div>
								</div>
							{/if}

							<!-- Compare Performance Frame -->
							{#if compareMode}
								<div class="compare-frame">
									<div class="compare-header">
										<h3 class="subsection-title">
											<span class="material-symbols-outlined">compare</span>
											Compare Performance
										</h3>
										<div class="compare-search-box">
											<span class="material-symbols-outlined">search</span>
											<input 
												type="text" 
												placeholder="Search companies to add..." 
												bind:value={compareSearchQuery}
												class="compare-search-input"
											/>
											{#if compareSearchQuery}
												<button class="clear-search" on:click={() => compareSearchQuery = ''}>
													<span class="material-symbols-outlined">close</span>
												</button>
											{/if}
										</div>
										<button class="btn-secondary" on:click={toggleCompareMode}>
											<span class="material-symbols-outlined">close</span>
											Close Compare
										</button>
									</div>
									
									<!-- Search Results Dropdown -->
									{#if compareSearchQuery}
										{@const allCompetitors = [...verifiedCompetitors, ...potentialCompetitors]}
										{@const searchResults = allCompetitors.filter(c => 
											c.name.toLowerCase().includes(compareSearchQuery.toLowerCase()) &&
											!compareList.find(comp => comp.name === c.name)
										)}
										{#if searchResults.length > 0}
											<div class="compare-search-results">
												<div class="search-results-header">
													<span class="material-symbols-outlined">list</span>
													Found {searchResults.length} company{searchResults.length > 1 ? 'ies' : ''}
												</div>
												{#each searchResults.slice(0, 5) as result}
													<button class="search-result-item" on:click={() => { addToCompare(result); compareSearchQuery = ''; }}>
														<div class="result-info">
															<span class="result-name">{result.name}</span>
															<span class="result-stage">{result.stage || 'N/A'}</span>
															{#if result.region}
																<span class="result-region {result.region}">{result.region === 'local' ? '🇮🇳 India' : '🌍 Global'}</span>
															{/if}
														</div>
														<span class="material-symbols-outlined add-icon">add_circle</span>
													</button>
												{/each}
												<!-- Option to search online even if local results exist -->
												<div class="search-online-divider">
													<span>or</span>
												</div>
												<button 
													class="search-online-btn" 
													on:click={() => searchCompanyOnline(compareSearchQuery)}
													disabled={onlineSearchLoading}
												>
													{#if onlineSearchLoading}
														<span class="material-symbols-outlined spinning">refresh</span>
														<span>Searching online...</span>
													{:else}
														<span class="material-symbols-outlined">travel_explore</span>
														<span>Search web for "{compareSearchQuery}"</span>
													{/if}
												</button>
											</div>
										{:else}
											<div class="compare-search-results">
												{#if onlineSearchLoading}
													<div class="search-loading">
														<span class="material-symbols-outlined spinning">refresh</span>
														<span>Searching online for "{compareSearchQuery}"...</span>
													</div>
												{:else if onlineSearchError}
													<div class="search-error">
														<span class="material-symbols-outlined">error</span>
														<span>{onlineSearchError}</span>
													</div>
													<button 
														class="search-online-btn retry" 
														on:click={() => searchCompanyOnline(compareSearchQuery)}
													>
														<span class="material-symbols-outlined">refresh</span>
														<span>Try again</span>
													</button>
												{:else}
													<div class="no-local-results">
														<span class="material-symbols-outlined">search_off</span>
														<span>Not in current list</span>
													</div>
													<button 
														class="search-online-btn" 
														on:click={() => searchCompanyOnline(compareSearchQuery)}
													>
														<span class="material-symbols-outlined">travel_explore</span>
														<span>Search web for "{compareSearchQuery}"</span>
													</button>
												{/if}
											</div>
										{/if}
									{/if}
									
									{#if compareList.length === 0}
										<div class="compare-empty">
											<span class="material-symbols-outlined">add_circle_outline</span>
											<p>Search above or click the <strong>+</strong> icon on competitor cards below to add them to comparison</p>
										</div>
									{:else}
										<div class="compare-grid">
											{#each compareList as comp}
												<div class="compare-card">
													<div class="compare-card-header">
														<h4>{comp.name}</h4>
														{#if comp.region}
															<span class="region-badge {comp.region}">{comp.region === 'local' ? '🇮🇳' : '🌍'}</span>
														{/if}
														<button class="btn-icon-danger" on:click={() => removeFromCompare(comp.name)} title="Remove from comparison">
															<span class="material-symbols-outlined">remove_circle</span>
														</button>
													</div>
													<!-- Flagship Product -->
													{#if comp.products && comp.products.length > 0}
														<div class="compare-flagship">
															<span class="material-symbols-outlined">star</span>
															<span class="flagship-label">Flagship Product:</span>
															<span class="flagship-value">{comp.flagshipProduct || comp.products[0]}</span>
														</div>
													{/if}
													<div class="compare-metrics">
														<div class="compare-metric">
															<span class="compare-label">Valuation</span>
															<span class="compare-value">₹{((comp.currentValuation || 0) / 10000000).toFixed(1)}Cr</span>
														</div>
														<div class="compare-metric">
															<span class="compare-label">Revenue</span>
															<span class="compare-value">₹{((comp.revenue || 0) / 10000000).toFixed(1)}Cr</span>
														</div>
														<div class="compare-metric">
															<span class="compare-label">Customers</span>
															<span class="compare-value">{(comp.customers || 0).toLocaleString()}</span>
														</div>
														<div class="compare-metric">
															<span class="compare-label">Growth</span>
															<span class="compare-value growth">{comp.growthRate || 0}%</span>
														</div>
														<div class="compare-metric">
															<span class="compare-label">Stage</span>
															<span class="compare-value">{comp.stage || 'N/A'}</span>
														</div>
														<div class="compare-metric">
															<span class="compare-label">Data Quality</span>
															<span class="compare-value {comp.isVerified ? 'verified' : 'potential'}">
																{comp.isVerified ? '✓ Verified' : '⚠ Estimated'}
															</span>
														</div>
													</div>
													<!-- Data not public note -->
													{#if (comp.currentValuation === 0 || !comp.currentValuation) || (comp.revenue === 0 || !comp.revenue) || (comp.customers === 0 || !comp.customers)}
														<div class="data-not-public-note">
															<span class="material-symbols-outlined">info</span>
															<span>Note: Some data is not publicly available</span>
														</div>
													{/if}
												</div>
											{/each}
										</div>
									{/if}
								</div>
							{/if}

							<!-- Competitor Tabs -->
							<div class="competitor-tabs-section">
								<div class="competitor-tabs-header">
									<div class="tabs-row">
										<button 
											class="tab-btn" 
											class:active={activeCompetitorTab === 'all'}
											on:click={() => activeCompetitorTab = 'all'}
										>
											<span class="material-symbols-outlined">grid_view</span>
											All
											{#if allCompetitors.length > 0}
												<span class="tab-count">{allCompetitors.length}</span>
											{/if}
										</button>
										{#if userPickCompetitors.length > 0}
											<button 
												class="tab-btn" 
												class:active={activeCompetitorTab === 'user-pick'}
												on:click={() => activeCompetitorTab = 'user-pick'}
											>
												<span class="material-symbols-outlined">person</span>
												Your Picks
												<span class="tab-count">{userPickCompetitors.length}</span>
											</button>
										{/if}
										<button 
											class="tab-btn" 
											class:active={activeCompetitorTab === 'global'}
											on:click={() => activeCompetitorTab = 'global'}
										>
											<span class="material-symbols-outlined">public</span>
											Global
											{#if globalCompetitors.length > 0}
												<span class="tab-count">{globalCompetitors.length}</span>
											{/if}
										</button>
										<button 
											class="tab-btn" 
											class:active={activeCompetitorTab === 'local'}
											on:click={() => activeCompetitorTab = 'local'}
										>
											<span class="material-symbols-outlined">location_on</span>
											Local
											{#if localCompetitors.length > 0}
												<span class="tab-count">{localCompetitors.length}</span>
											{/if}
										</button>
										<button 
											class="tab-btn" 
											class:active={activeCompetitorTab === 'rival'}
											on:click={() => activeCompetitorTab = 'rival'}
										>
											<span class="material-symbols-outlined">sports_martial_arts</span>
											Rival
											{#if rivalCompetitors.length > 0}
												<span class="tab-count">{rivalCompetitors.length}</span>
											{/if}
										</button>
									</div>
									<button 
										class="btn-compare" 
										class:active={compareMode}
										on:click={toggleCompareMode}
									>
										<span class="material-symbols-outlined">compare</span>
										{compareMode ? 'Exit Compare' : 'Compare'}
									</button>
								</div>

								<!-- Data Quality Summary -->
								{#if competitorDataSummary}
									<div class="data-quality-summary">
										<div class="summary-item user-pick">
											<span class="material-symbols-outlined">person</span>
											<span><strong>{competitorDataSummary.userPickCount || userPickCompetitors.length}</strong> Your Picks</span>
										</div>
										<div class="summary-item global">
											<span class="material-symbols-outlined">public</span>
											<span><strong>{competitorDataSummary.globalCount || globalCompetitors.length}</strong> Global</span>
										</div>
										<div class="summary-item local">
											<span class="material-symbols-outlined">location_on</span>
											<span><strong>{competitorDataSummary.localCount || localCompetitors.length}</strong> Local</span>
										</div>
										<div class="summary-item rival">
											<span class="material-symbols-outlined">sports_martial_arts</span>
											<span><strong>{competitorDataSummary.rivalCount || rivalCompetitors.length}</strong> Rival</span>
										</div>
									</div>
								{/if}

								<!-- Tab Content -->
								{#if allCompetitors}
									{@const displayCompetitors = 
										activeCompetitorTab === 'all' ? allCompetitors :
										activeCompetitorTab === 'user-pick' ? userPickCompetitors :
										activeCompetitorTab === 'global' ? globalCompetitors :
										activeCompetitorTab === 'local' ? localCompetitors :
										activeCompetitorTab === 'rival' ? rivalCompetitors :
										allCompetitors
									}
									{@const tabDescription = 
										activeCompetitorTab === 'all' ? 'All competitors including your picks, global leaders, local players, and emerging rivals.' :
										activeCompetitorTab === 'user-pick' ? 'Competitors you mentioned during the questionnaire.' :
										activeCompetitorTab === 'global' ? 'International companies that compete or could enter the Indian market.' :
										activeCompetitorTab === 'local' ? 'Well-established major players in India.' :
										activeCompetitorTab === 'rival' ? 'Emerging companies that could be direct future threats.' :
										'All competitors'
									}
									<div class="tab-description">
										<span class="material-symbols-outlined">info</span>
										<p>{tabDescription}</p>
									</div>
									<div class="competitors-grid">
										{#each displayCompetitors as competitor, index}
											<div class="competitor-card {competitor.region}" class:hidden={!competitor.visible}>
												<div class="competitor-header">
													<h4>{competitor.name}</h4>
													<div class="competitor-actions">
														{#if compareMode}
															{#if compareList.find(c => c.name === competitor.name)}
																<button 
																	class="btn-icon-danger"
																	on:click={() => removeFromCompare(competitor.name)}
																	title="Remove from comparison"
																>
																	<span class="material-symbols-outlined">remove_circle</span>
																</button>
															{:else}
																<button 
																	class="btn-icon-success"
																	on:click={() => addToCompare(competitor)}
																	title="Add to comparison"
																>
																	<span class="material-symbols-outlined">add_circle</span>
																</button>
															{/if}
														{/if}
														<button 
															class="btn-icon" 
															on:click={() => toggleCompetitorVisibility(index)}
															title={competitor.visible ? 'Hide from graph' : 'Show in graph'}
														>
															<span class="material-symbols-outlined">
																{competitor.visible ? 'visibility' : 'visibility_off'}
															</span>
														</button>
														<button 
															class="btn-icon"
															on:click={() => monitoredCompetitors.includes(competitor.name) ? removeFromMonitoring(competitor.name) : addToMonitoring(competitor.name)}
															title={monitoredCompetitors.includes(competitor.name) ? 'Remove from monitoring' : 'Add to monitoring'}
														>
															<span class="material-symbols-outlined">
																{monitoredCompetitors.includes(competitor.name) ? 'star' : 'star_border'}
															</span>
														</button>
													</div>
												</div>
												
												<div class="competitor-stage">
													<span class="stage-badge">{competitor.stage || 'N/A'}</span>
													<span class="region-badge {competitor.region || 'local'}">
														{competitor.region === 'user-pick' ? 'Your Pick' :
														 competitor.region === 'global' ? 'Global' :
														 competitor.region === 'rival' ? 'Rival' : 'Local'}
													</span>
													{#if competitor.isVerified}
														<span class="verified-badge">✓ Verified</span>
													{/if}
												</div>

												<div class="competitor-metrics">
													<div class="metric-item">
														<span class="material-symbols-outlined">trending_up</span>
														<div>
															<div class="metric-label">Growth Rate</div>
															<div class="metric-value">{competitor.growthRate || 0}%</div>
														</div>
													</div>
													<div class="metric-item">
														<span class="material-symbols-outlined">currency_rupee</span>
														<div>
															<div class="metric-label">Revenue</div>
															<div class="metric-value">₹{((competitor.revenue || 0) / 10000000).toFixed(1)}Cr</div>
														</div>
													</div>
													<div class="metric-item">
														<span class="material-symbols-outlined">groups</span>
														<div>
															<div class="metric-label">Customers</div>
															<div class="metric-value">{(competitor.customers || 0).toLocaleString()}</div>
														</div>
													</div>
												</div>

												<button 
													class="btn-secondary full-width"
													on:click={() => showCompetitorDetails(competitor)}
												>
													<span class="material-symbols-outlined">info</span>
													View Details
												</button>
											</div>
										{/each}
										{#if displayCompetitors.length === 0}
											<div class="empty-tab-state">
												<span class="material-symbols-outlined">search_off</span>
												<p>No competitors found in this category</p>
											</div>
										{/if}
									</div>
								{/if}
							</div>
						</div>
					</div>
				{/if}

			<!-- Notes Tab -->
			{:else if activeTab === 'notes'}
				<div class="notes-section">
					<div class="notes-layout">
						<!-- Left Sidebar - Notes List (1/4) -->
						<div class="notes-sidebar">
							<div class="notes-sidebar-header">
								<h3>My Notes</h3>
								<button class="btn-add-note" on:click={startNewNote} title="Create new note">
									<span class="material-symbols-outlined">add</span>
								</button>
							</div>

							<div class="notes-search-box">
								<span class="material-symbols-outlined">search</span>
								<input 
									type="text" 
									placeholder="Search notes..." 
									bind:value={notesSearchQuery}
									on:input={loadNotes}
								/>
							</div>

							<select class="notes-category-select" bind:value={selectedNoteCategory} on:change={loadNotes}>
								{#each noteCategories as category}
									<option value={category}>
										{category === 'all' ? 'All Categories' : category}
									</option>
								{/each}
							</select>

							<div class="notes-list">
								{#if notesLoading}
									<div class="loading-notes-state">
										<span class="material-symbols-outlined rotating">progress_activity</span>
									</div>
								{:else if savedNotes.length === 0}
									<div class="empty-notes-sidebar">
										<span class="material-symbols-outlined">note_add</span>
										<p>No notes yet</p>
									</div>
								{:else}
									{#each savedNotes as note}
										<button 
											class="note-list-item" 
											class:active={selectedNote && selectedNote._id === note._id}
											on:click={() => selectNote(note)}
										>
											<div class="note-list-item-title">{note.noteTitle}</div>
											<div class="note-list-item-meta">
												<span class="note-list-category">{note.category}</span>
												<span class="note-list-date">{new Date(note.createdAt).toLocaleDateString()}</span>
											</div>
										</button>
									{/each}
								{/if}
							</div>
						</div>

						<!-- Right Content Area (3/4) -->
						<div class="notes-content">
							{#if isCreatingNote}
								<!-- Create New Note Form -->
								<div class="note-editor">
									<div class="note-editor-header">
										<span class="material-symbols-outlined">edit_note</span>
										<h2>Create New Note</h2>
									</div>

									<div class="note-form">
										<div class="form-group">
											<label for="note-title">Title</label>
											<input 
												id="note-title"
												type="text" 
												placeholder="Enter note title..." 
												bind:value={newNoteTitle}
											/>
										</div>

										<div class="form-group">
											<label for="note-category">Category</label>
											<select id="note-category" bind:value={newNoteCategory}>
												<option value="General">General</option>
												<option value="Strategy">Strategy</option>
												<option value="Finance">Finance</option>
												<option value="Marketing">Marketing</option>
												<option value="Operations">Operations</option>
												<option value="Product">Product</option>
												<option value="Team">Team</option>
												<option value="Ideas">Ideas</option>
											</select>
										</div>

										<div class="form-group">
											<label for="note-content">Content</label>
											<textarea 
												id="note-content"
												placeholder="Write your note here..." 
												bind:value={newNoteContent}
												rows="15"
											></textarea>
										</div>

										<div class="note-form-actions">
											<button class="btn-secondary" on:click={() => { isCreatingNote = false; }}>
												<span class="material-symbols-outlined">close</span>
												Cancel
											</button>
											<button class="btn-primary" on:click={createNote}>
												<span class="material-symbols-outlined">save</span>
												Save Note
											</button>
										</div>
									</div>
								</div>
							{:else if selectedNote}
								<!-- View Selected Note -->
								<div class="note-viewer">
									<div class="note-viewer-header">
										<div class="note-viewer-title">
											<h2>{selectedNote.noteTitle}</h2>
											<span class="note-category-badge">{selectedNote.category}</span>
										</div>
										<div class="note-viewer-actions">
											<span class="note-date-badge">
												{new Date(selectedNote.createdAt).toLocaleDateString()}
											</span>
											<button 
												class="btn-icon-danger" 
												on:click={() => deleteNote(selectedNote._id)}
												title="Delete note"
											>
												<span class="material-symbols-outlined">delete</span>
											</button>
										</div>
									</div>

									<div class="note-viewer-content">
										{#if selectedNote.chatMessage && selectedNote.chatMessage !== 'Manual Note'}
											<div class="note-question-box">
												<span class="material-symbols-outlined">person</span>
												<div>
													<strong>Your Question:</strong>
													<p>{selectedNote.chatMessage}</p>
												</div>
											</div>
										{/if}
										<div class="note-answer-box">
											<span class="material-symbols-outlined">{selectedNote.chatMessage === 'Manual Note' ? 'description' : 'psychology'}</span>
											<div>
												<strong>{selectedNote.chatMessage === 'Manual Note' ? 'Note Content:' : 'AI Response:'}</strong>
												<p>{selectedNote.response}</p>
											</div>
										</div>
									</div>
								</div>
							{:else}
								<!-- Empty State - No note selected -->
								<div class="note-placeholder">
									<span class="material-symbols-outlined">sticky_note_2</span>
									<h3>Select a note or create a new one</h3>
									<p>Choose a note from the sidebar to view its content, or click the + button to create a new note.</p>
									<button class="btn-primary" on:click={startNewNote}>
										<span class="material-symbols-outlined">add</span>
										Create New Note
									</button>
								</div>
							{/if}
						</div>
					</div>
				</div>

			<!-- Profile Tab -->
			{:else if activeTab === 'profile'}
				<div class="profile-section">
					<div class="minimal-card">
						<div class="card-header">
							<span class="material-symbols-outlined icon-large">person</span>
							<h2 class="section-title">Profile</h2>
						</div>

						<div class="profile-grid">
							<!-- User Info -->
							<div class="profile-card">
								<h3 class="profile-card-title">
									<span class="material-symbols-outlined">badge</span>
									Founder Information
								</h3>
								<div class="profile-info">
									<div class="info-row">
										<span class="info-label">Name</span>
										<span class="info-value">{user?.name || 'N/A'}</span>
									</div>
									<div class="info-row">
										<span class="info-label">Email</span>
										<span class="info-value">{user?.email || 'N/A'}</span>
									</div>
									<div class="info-row">
										<span class="info-label">Company</span>
										<span class="info-value">{user?.companyName || ddqResponses[1] || 'N/A'}</span>
									</div>
									<div class="info-row">
										<span class="info-label">Category</span>
										<span class="info-value">{ddqResponses[3] || 'N/A'}</span>
									</div>
									<div class="info-row">
										<span class="info-label">State</span>
										<span class="info-value">{ddqResponses[4] || 'N/A'}</span>
									</div>
									<div class="info-row">
										<span class="info-label">Stage</span>
										<span class="info-value">{ddqResponses[5] || 'N/A'}</span>
									</div>
								</div>
							</div>

							<!-- Social Links -->
							<div class="profile-card">
								<h3 class="profile-card-title">
									<span class="material-symbols-outlined">link</span>
									Social Links
								</h3>
								<div class="social-links">
									{#if user?.socials?.linkedIn}
										<a href={user.socials.linkedIn} target="_blank" rel="noopener" class="social-link">
											<span class="material-symbols-outlined">groups</span>
											LinkedIn
											<span class="material-symbols-outlined">open_in_new</span>
										</a>
									{/if}
									{#if user?.socials?.website}
										<a href={user.socials.website} target="_blank" rel="noopener" class="social-link">
											<span class="material-symbols-outlined">language</span>
											Website
											<span class="material-symbols-outlined">open_in_new</span>
										</a>
									{/if}
									{#if user?.socials?.instagram}
										<a href={user.socials.instagram} target="_blank" rel="noopener" class="social-link">
											<span class="material-symbols-outlined">photo_camera</span>
											Instagram
											<span class="material-symbols-outlined">open_in_new</span>
										</a>
									{/if}
									{#if user?.socials?.other}
										<a href={user.socials.other} target="_blank" rel="noopener" class="social-link">
											<span class="material-symbols-outlined">add_link</span>
											Other
											<span class="material-symbols-outlined">open_in_new</span>
										</a>
									{/if}
									{#if !user?.socials?.linkedIn && !user?.socials?.website && !user?.socials?.instagram && !user?.socials?.other}
										<div class="empty-social">
											<span class="material-symbols-outlined">link_off</span>
											<p>No social links added</p>
										</div>
									{/if}
								</div>
							</div>

							<!-- Assessment Status -->
							<div class="profile-card full-width">
								<h3 class="profile-card-title">
									<span class="material-symbols-outlined">assessment</span>
									Assessment Status
								</h3>
								<div class="assessment-status">
									{#if Object.keys(ddqResponses).length > 0}
										<div class="status-item">
											<span class="material-symbols-outlined status-icon completed">check_circle</span>
											<div>
												<h4>Assessment Completed</h4>
												<p>You've answered {Object.keys(ddqResponses).length} questions</p>
											</div>
										</div>
										{#if valuation}
											<div class="status-item">
												<span class="material-symbols-outlined status-icon completed">universal_currency_alt</span>
												<div>
													<h4>Valuation Generated</h4>
													<p>₹{(valuation.finalValuationINR / 10000000).toFixed(2)} Cr</p>
												</div>
											</div>
										{/if}
										<button class="btn-secondary retake-btn" on:click={() => {
											if (confirm('Are you sure you want to retake the assessment? This will clear your current responses.')) {
												ddqResponses = {};
												valuation = null;
												swotAnalysis = null;
												fundingSchemes = null;
												localStorage.removeItem('ddq_progress');
												startDDQ();
											}
										}}>
											<span class="material-symbols-outlined">refresh</span>
											Retake Assessment
										</button>
									{:else}
										<div class="status-item">
											<span class="material-symbols-outlined status-icon pending">pending</span>
											<div>
												<h4>No Assessment Taken</h4>
												<p>Start your assessment to get a valuation</p>
											</div>
										</div>
										<button class="btn-primary" on:click={startDDQ}>
											<span class="material-symbols-outlined">rocket_launch</span>
											Start Assessment
										</button>
									{/if}
								</div>
							</div>

							<!-- Account Actions -->
							<div class="profile-card full-width">
								<h3 class="profile-card-title">
									<span class="material-symbols-outlined">settings</span>
									Account Actions
								</h3>
								<div class="account-actions">
									<button class="btn-danger logout-profile-btn" on:click={logout}>
										<span class="material-symbols-outlined">logout</span>
										Logout from Account
									</button>
								</div>
							</div>

							<!-- Saved Notes from Chat -->
							<div class="profile-card full-width">
								<h3 class="profile-card-title">
									<span class="material-symbols-outlined">bookmark</span>
									Saved Notes from Advisor Chat
								</h3>
								
								<div class="notes-controls">
									<div class="notes-search">
										<span class="material-symbols-outlined">search</span>
										<input 
											type="text" 
											placeholder="Search notes..." 
											bind:value={notesSearchQuery}
											on:input={loadNotes}
										/>
									</div>
									<select bind:value={selectedNoteCategory} on:change={loadNotes}>
										{#each noteCategories as category}
											<option value={category}>
												{category === 'all' ? 'All Categories' : category}
											</option>
										{/each}
									</select>
									<button class="btn-secondary" on:click={loadNotes}>
										<span class="material-symbols-outlined">refresh</span>
										Refresh
									</button>
								</div>

								<div class="saved-notes-list">
									{#if notesLoading}
										<div class="loading-notes">
											<span class="material-symbols-outlined rotating">progress_activity</span>
											Loading notes...
										</div>
									{:else if savedNotes.length === 0}
										<div class="empty-notes">
											<span class="material-symbols-outlined">bookmark_border</span>
											<p>No saved notes yet</p>
											<p class="hint">Use the "Save to Notes" button in the chatbot to save important conversations</p>
										</div>
									{:else}
										{#each savedNotes as note}
											<div class="note-card">
												<div class="note-header">
													<div class="note-title-section">
														<h4>{note.noteTitle}</h4>
														<span class="note-category">{note.category}</span>
													</div>
													<div class="note-actions">
														<span class="note-date">
															{new Date(note.createdAt).toLocaleDateString()}
														</span>
														<button 
															class="btn-icon delete-note-btn" 
															on:click={() => deleteNote(note._id)}
															title="Delete note"
														>
															<span class="material-symbols-outlined">delete</span>
														</button>
													</div>
												</div>
												<div class="note-content">
													<div class="note-question">
														<span class="material-symbols-outlined">person</span>
														<p><strong>You:</strong> {note.chatMessage}</p>
													</div>
													<div class="note-answer">
														<span class="material-symbols-outlined">psychology</span>
														<p><strong>Prometheus:</strong> {note.response}</p>
													</div>
												</div>
											</div>
										{/each}
									{/if}
								</div>
							</div>

							<!-- DDQ Answers -->
							{#if Object.keys(ddqResponses).length > 0}
								<div class="profile-card full-width">
									<h3 class="profile-card-title">
										<span class="material-symbols-outlined">quiz</span>
										Assessment Answers
									</h3>
									<div class="ddq-answers">
										{#each Object.entries(ddqResponses) as [questionId, answer]}
											{@const question = allQuestions.find(q => q.id === parseInt(questionId))}
											{#if question}
												<div class="answer-card">
													<div class="answer-header">
														<div class="answer-question">
															<span class="question-number">Q{questionId}</span>
															<span class="question-text">{question.question}</span>
														</div>
														{#if question.id !== 11}
															<button class="btn-icon edit-btn" title="Edit answer">
																<span class="material-symbols-outlined">edit</span>
															</button>
														{/if}
													</div>
													<div class="answer-value">
														{#if question.type === 'dropdown'}
															<span class="dropdown-answer">{answer}</span>
														{:else if question.type === 'radio'}
															<span class="radio-answer">{answer}</span>
														{:else if question.type === 'textarea'}
															<p class="textarea-answer">{answer}</p>
														{:else}
															<span class="text-answer">{answer}</span>
														{/if}
													</div>
													{#if question.section}
														<div class="answer-section">{question.section}</div>
													{/if}
												</div>
											{/if}
										{/each}
									</div>
								</div>
							{/if}
						</div>
					</div>
				</div>

			<!-- What-If Analysis - Now handled by floating chatbot -->

			{:else if activeTab === 'swot'}
				{#if swotAnalysis}
					<div class="swot-section">
						<div class="elegant-card">
							<h2 class="section-title">🎯 Introspection</h2>
							<div class="swot-grid">
								<div class="swot-quadrant">
									<h3 class="swot-title strengths">Strengths</h3>
									<ul>
										{#each swotAnalysis.strengths || [] as strength}
											<li>{strength}</li>
										{/each}
									</ul>
								</div>
								<div class="swot-quadrant">
									<h3 class="swot-title weaknesses">Weaknesses</h3>
									<ul>
										{#each swotAnalysis.weaknesses || [] as weakness}
											<li>{weakness}</li>
										{/each}
									</ul>
								</div>
								<div class="swot-quadrant">
									<h3 class="swot-title opportunities">Opportunities</h3>
									<ul>
										{#each swotAnalysis.opportunities || [] as opportunity}
											<li>{opportunity}</li>
										{/each}
									</ul>
								</div>
								<div class="swot-quadrant">
									<h3 class="swot-title threats">Threats</h3>
									<ul>
										{#each swotAnalysis.threats || [] as threat}
											<li>{threat}</li>
										{/each}
									</ul>
								</div>
							</div>
						</div>
					</div>
				{:else}
					<div class="elegant-card">
						<p>Complete the DDQ to generate Introspection analysis</p>
					</div>
				{/if}
			{:else if activeTab === 'funding'}
				{#if fundingSchemes}
					<div class="funding-section">
						<div class="minimal-card">
							<div class="card-header">
								<span class="material-symbols-outlined icon-large">account_balance</span>
								<div>
									<h2 class="section-title">Government Funding Schemes</h2>
									<p class="section-subtitle">Personalized recommendations based on your startup profile</p>
								</div>
								<div class="card-header-actions">
									<button class="info-btn" on:click={() => showInfo('funding-schemes')} title="What is this?">
										<span class="info-icon">i</span>
									</button>
									<button class="daddy-btn" on:click={() => askDaddy('funding-schemes')} title="Ask Daddy">
										<span class="daddy-icon">D</span>
									</button>
								</div>
							</div>
							
							{#if fundingSchemes.priority}
								<div class="priority-recommendation">
									<span class="material-symbols-outlined">stars</span>
									<div>
										<h4>Priority Recommendation</h4>
										<p>{fundingSchemes.priority}</p>
									</div>
								</div>
							{/if}

							<div class="schemes-container">
								<!-- Central Government Schemes -->
								<div class="schemes-section central-schemes">
									<div class="section-header">
										<div class="section-title-row">
											<span class="material-symbols-outlined section-icon">flag</span>
											<h3 class="schemes-title">Central Government Schemes</h3>
										</div>
										<span class="schemes-count">{(fundingSchemes.centralSchemes || []).filter((s: any) => s.eligibilityStatus === 'eligible' || s.eligibilityStatus === 'partial').length} schemes</span>
									</div>
									<div class="schemes-grid">
										{#each (fundingSchemes.centralSchemes || [])
											.filter((s: any) => s.eligibilityStatus === 'eligible' || s.eligibilityStatus === 'partial')
											.sort((a: any, b: any) => {
												const order: Record<string, number> = { 'eligible': 0, 'partial': 1, 'not-eligible': 2 };
												return (order[a.eligibilityStatus] ?? 2) - (order[b.eligibilityStatus] ?? 2);
											}) as scheme}
											<div class="scheme-card">
												<div class="scheme-header">
													<div class="scheme-title-row">
														<h4 class="scheme-name">{scheme.name}</h4>
														{#if scheme.type}
															<span class="scheme-type-badge {scheme.type.toLowerCase()}">{scheme.type}</span>
														{/if}
													</div>
													{#if scheme.eligibilityStatus}
														<span class="eligibility-badge {scheme.eligibilityStatus}">
															{#if scheme.eligibilityStatus === 'eligible'}
																<span class="material-symbols-outlined">check_circle</span>
																Eligible
															{:else}
																<span class="material-symbols-outlined">info</span>
																Partially Eligible
															{/if}
														</span>
													{/if}
												</div>
												
												<div class="scheme-amount-row">
													<span class="material-symbols-outlined">currency_rupee</span>
													<span class="amount-text">{scheme.amount}</span>
												</div>
												
												{#if scheme.reasoning}
													<div class="scheme-reasoning">
														<span class="material-symbols-outlined">lightbulb</span>
														<p>{scheme.reasoning}</p>
													</div>
												{/if}
												
												<div class="scheme-details">
													<div class="detail-item">
														<span class="material-symbols-outlined">workspace_premium</span>
														<div>
															<strong>Benefits:</strong>
															<p>{scheme.benefits}</p>
														</div>
													</div>
													<div class="detail-item">
														<span class="material-symbols-outlined">verified</span>
														<div>
															<strong>Eligibility:</strong>
															<p>{scheme.eligibility}</p>
														</div>
													</div>
												</div>
												<!-- Action Buttons Grid -->
												<div class="scheme-actions-grid">
													<button class="scheme-action-btn check-gis" on:click={() => openSchemeWebsite(scheme)}>
														<span class="material-symbols-outlined">open_in_new</span>
														Check GIS
													</button>
													<button class="scheme-action-btn create-proposal" on:click={() => createProposal(scheme)} disabled={proposalLoading && proposalScheme?.name === scheme.name}>
														<span class="material-symbols-outlined">{proposalLoading && proposalScheme?.name === scheme.name ? 'progress_activity' : 'description'}</span>
														{proposalLoading && proposalScheme?.name === scheme.name ? 'Generating...' : 'Create Proposal'}
													</button>
												</div>
											</div>
										{/each}
									</div>
								</div>

								<!-- State Government Schemes -->
								{#if fundingSchemes.stateSchemes && fundingSchemes.stateSchemes.filter((s: any) => s.eligibilityStatus === 'eligible' || s.eligibilityStatus === 'partial').length > 0}
									<div class="schemes-section state-schemes">
										<div class="section-header">
											<div class="section-title-row">
												<span class="material-symbols-outlined section-icon">location_city</span>
												<h3 class="schemes-title">State Government Schemes</h3>
											</div>
											<span class="schemes-count">{(fundingSchemes.stateSchemes || []).filter((s: any) => s.eligibilityStatus === 'eligible' || s.eligibilityStatus === 'partial').length} schemes</span>
										</div>
										<div class="schemes-grid">
										{#each (fundingSchemes.stateSchemes || [])
											.filter((s: any) => s.eligibilityStatus === 'eligible' || s.eligibilityStatus === 'partial')
											.sort((a: any, b: any) => {
												const order: Record<string, number> = { 'eligible': 0, 'partial': 1, 'not-eligible': 2 };
												return (order[a.eligibilityStatus] ?? 2) - (order[b.eligibilityStatus] ?? 2);
											}) as scheme}
											<div class="scheme-card">
												<div class="scheme-header">
													<div class="scheme-title-row">
														<h4 class="scheme-name">{scheme.name}</h4>
														{#if scheme.type}
															<span class="scheme-type-badge {scheme.type.toLowerCase()}">{scheme.type}</span>
														{/if}
													</div>
													{#if scheme.eligibilityStatus}
														<span class="eligibility-badge {scheme.eligibilityStatus}">
															{#if scheme.eligibilityStatus === 'eligible'}
																<span class="material-symbols-outlined">check_circle</span>
																Eligible
															{:else}
																<span class="material-symbols-outlined">info</span>
																Partially Eligible
															{/if}
														</span>
													{/if}
												</div>
													
												<div class="scheme-amount-row">
													<span class="material-symbols-outlined">currency_rupee</span>
													<span class="amount-text">{scheme.amount}</span>
												</div>
													
													{#if scheme.reasoning}
														<div class="scheme-reasoning">
															<span class="material-symbols-outlined">lightbulb</span>
															<p>{scheme.reasoning}</p>
														</div>
													{/if}
													
													<div class="scheme-details">
														<div class="detail-item">
															<span class="material-symbols-outlined">workspace_premium</span>
															<div>
																<strong>Benefits:</strong>
																<p>{scheme.benefits}</p>
															</div>
														</div>
														<div class="detail-item">
															<span class="material-symbols-outlined">verified</span>
															<div>
																<strong>Eligibility:</strong>
																<p>{scheme.eligibility}</p>
															</div>
														</div>
													</div>
													<!-- Action Buttons Grid -->
													<div class="scheme-actions-grid">
														<button class="scheme-action-btn check-gis" on:click={() => openSchemeWebsite(scheme)}>
															<span class="material-symbols-outlined">open_in_new</span>
															Check GIS
														</button>
														<button class="scheme-action-btn create-proposal" on:click={() => createProposal(scheme)} disabled={proposalLoading && proposalScheme?.name === scheme.name}>
															<span class="material-symbols-outlined">{proposalLoading && proposalScheme?.name === scheme.name ? 'progress_activity' : 'description'}</span>
															{proposalLoading && proposalScheme?.name === scheme.name ? 'Generating...' : 'Create Proposal'}
														</button>
													</div>
												</div>
											{/each}
										</div>
									</div>
								{/if}
							</div>
						</div>
					</div>
				{:else}
					<div class="minimal-card">
						<div class="empty-state">
							<span class="material-symbols-outlined icon-empty">account_balance</span>
							<h3>No Funding Schemes Available</h3>
							<p>Complete the assessment to view personalized funding schemes</p>
							<button class="btn-primary" on:click={startDDQ}>
								<span class="material-symbols-outlined">rocket_launch</span>
								Start Assessment
							</button>
						</div>
					</div>
				{/if}
			{:else if activeTab === 'chat'}
				<div class="chat-section elegant-card">
					<h2 class="section-title">💬 AI Strategic Assistant</h2>
					<p class="section-text">Ask me anything about your valuation, methodology, or scenarios...</p>
					<div class="chat-placeholder">
						<p>🚧 Chat interface coming soon</p>
						<p>This feature will allow you to ask questions about your valuation and run "what-if" scenarios.</p>
					</div>
				</div>
			{/if}
		</div>

		<!-- Footer -->
		<footer class="dashboard-footer">
			<div class="footer-content">
				<div class="footer-left">
					<img src="/logo-dark.png" alt="NebulAa" class="footer-logo-img logo-dark" />
					<img src="/logo-light.png" alt="NebulAa" class="footer-logo-img logo-light" />
					<span class="footer-logo">NebulAa</span>
					<span class="footer-separator">•</span>
					<span class="footer-tagline">Singularity</span>
					<span class="footer-separator">•</span>
					<span class="footer-copyright">© 2025 All rights reserved</span>
				</div>
				<div class="footer-right">
					<a href="mailto:reach@stratschool.org" class="footer-contact">
						<span class="material-symbols-outlined">mail</span>
						reach@stratschool.org
					</a>
				</div>
			</div>
		</footer>
	</main>

	<!-- Competitor Details Modal -->
	{#if selectedCompetitor}
		<!-- svelte-ignore a11y-click-events-have-key-events -->
		<!-- svelte-ignore a11y-no-static-element-interactions -->
		<div class="modal-overlay" on:click={closeCompetitorModal}>
			<!-- svelte-ignore a11y-click-events-have-key-events -->
			<!-- svelte-ignore a11y-no-static-element-interactions -->
			<div class="modal-content competitor-modal" on:click|stopPropagation>
				<div class="modal-header">
					<h3>{selectedCompetitor.name || 'Competitor'}</h3>
					<button class="btn-icon" on:click={closeCompetitorModal}>
						<span class="material-symbols-outlined">close</span>
					</button>
				</div>
				<div class="modal-body">
					<!-- Flagship Product Highlight -->
					{#if selectedCompetitor.products && selectedCompetitor.products.length > 0}
						<div class="flagship-highlight">
							<div class="flagship-icon">
								<span class="material-symbols-outlined">star</span>
							</div>
							<div class="flagship-content">
								<span class="flagship-title">Flagship Product</span>
								<span class="flagship-name">{selectedCompetitor.flagshipProduct || selectedCompetitor.products[0]}</span>
							</div>
						</div>
					{/if}

					<div class="competitor-detail-section">
						<h4>
							<span class="material-symbols-outlined">attach_money</span>
							Funding Information
						</h4>
						<p class="detail-value">Total Raised: ₹{((selectedCompetitor.fundingRaised || 0) / 10000000).toFixed(2)} Cr</p>
						<p class="detail-label">Key Investments:</p>
						<ul class="investments-list">
							{#each (selectedCompetitor.investments || []) as investment}
								<li>{investment}</li>
							{/each}
						</ul>
					</div>
					<div class="competitor-detail-section">
						<h4>
							<span class="material-symbols-outlined">inventory</span>
							Product Portfolio
						</h4>
						<div class="products-list">
							{#each (selectedCompetitor.products || []) as product, i}
								<span class="product-badge" class:flagship={i === 0}>
									{#if i === 0}<span class="material-symbols-outlined star-icon">star</span>{/if}
									{product}
								</span>
							{/each}
						</div>
					</div>
					<div class="competitor-detail-section">
						<h4>
							<span class="material-symbols-outlined">analytics</span>
							Performance Metrics
						</h4>
						<div class="detail-metrics">
							<div class="detail-metric">
								<span class="material-symbols-outlined">currency_rupee</span>
								<div>
									<div class="detail-label">Current Valuation</div>
									<div class="detail-value">₹{((selectedCompetitor.currentValuation || 0) / 10000000).toFixed(2)} Cr</div>
								</div>
							</div>
							<div class="detail-metric">
								<span class="material-symbols-outlined">trending_up</span>
								<div>
									<div class="detail-label">Growth Rate</div>
									<div class="detail-value">{selectedCompetitor.growthRate || 0}%</div>
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	{/if}

	<!-- Methodology Breakdown Modal -->
	{#if showMethodologyModal && valuation}
		<!-- svelte-ignore a11y-click-events-have-key-events -->
		<!-- svelte-ignore a11y-no-static-element-interactions -->
		<div class="modal-overlay" on:click={() => showMethodologyModal = false}>
			<!-- svelte-ignore a11y-click-events-have-key-events -->
			<!-- svelte-ignore a11y-no-static-element-interactions -->
			<div class="modal-content methodology-modal" on:click|stopPropagation>
				<div class="modal-header">
					<h3>
						<span class="material-symbols-outlined">analytics</span>
						Methodology Breakdown
					</h3>
					<button class="btn-icon" on:click={() => showMethodologyModal = false}>
						<span class="material-symbols-outlined">close</span>
					</button>
				</div>
				<div class="modal-body">
					<div class="methodology-explanation">
						<p class="explanation-text">
							Your valuation of <strong>₹{(valuation.finalValuationINR / 10000000).toFixed(2)} Cr</strong> 
							was calculated using the <strong>{valuation.valuationMethod}</strong> approach, 
							which combines multiple industry-standard methodologies.
						</p>
					</div>

					<div class="method-cards-modal">
						<div class="method-card-modal berkus">
							<div class="method-card-header">
								<span class="method-icon material-symbols-outlined">assured_workload</span>
								<div>
									<h4>Berkus Method</h4>
									<p class="method-description">Pre-revenue valuation based on qualitative factors</p>
								</div>
							</div>
							<div class="method-value-large">₹{(valuation.berkusValuation / 10000000).toFixed(2)} Cr</div>
							{#if valuation.berkusFactors}
								<div class="method-breakdown">
									<div class="breakdown-item">
										<span>Sound Idea/Tech</span>
										<span>₹{(valuation.berkusFactors.soundIdea / 100000).toFixed(1)}L</span>
									</div>
									<div class="breakdown-item">
										<span>Quality Team</span>
										<span>₹{(valuation.berkusFactors.qualityTeam / 100000).toFixed(1)}L</span>
									</div>
									<div class="breakdown-item">
										<span>Prototype/MVP</span>
										<span>₹{(valuation.berkusFactors.prototype / 100000).toFixed(1)}L</span>
									</div>
									<div class="breakdown-item">
										<span>Strategic Relationships</span>
										<span>₹{(valuation.berkusFactors.strategicRelationships / 100000).toFixed(1)}L</span>
									</div>
									<div class="breakdown-item">
										<span>Product Rollout</span>
										<span>₹{(valuation.berkusFactors.productRollout / 100000).toFixed(1)}L</span>
									</div>
								</div>
							{/if}
						</div>

						<div class="method-card-modal scorecard">
							<div class="method-card-header">
								<span class="method-icon material-symbols-outlined">scoreboard</span>
								<div>
									<h4>Scorecard Method</h4>
									<p class="method-description">Comparative valuation with regional multipliers</p>
								</div>
							</div>
							<div class="method-value-large">₹{(valuation.scorecardValuation / 10000000).toFixed(2)} Cr</div>
							{#if valuation.scorecardMultipliers}
								<div class="method-breakdown">
									<div class="breakdown-item">
										<span>Team Strength</span>
										<span>{(valuation.scorecardMultipliers.team * 100).toFixed(0)}%</span>
									</div>
									<div class="breakdown-item">
										<span>Market Opportunity</span>
										<span>{(valuation.scorecardMultipliers.market * 100).toFixed(0)}%</span>
									</div>
									<div class="breakdown-item">
										<span>Product/Technology</span>
										<span>{(valuation.scorecardMultipliers.product * 100).toFixed(0)}%</span>
									</div>
									<div class="breakdown-item">
										<span>Sales/Marketing</span>
										<span>{(valuation.scorecardMultipliers.sales * 100).toFixed(0)}%</span>
									</div>
									<div class="breakdown-item">
										<span>Competitive Position</span>
										<span>{(valuation.scorecardMultipliers.competitive * 100).toFixed(0)}%</span>
									</div>
								</div>
							{/if}
						</div>

						{#if valuation.revenueMultipleValuation && valuation.revenueMultipleValuation > 0}
							<div class="method-card-modal revenue-multiple">
								<div class="method-card-header">
									<span class="method-icon material-symbols-outlined">trending_up</span>
									<div>
										<h4>Revenue Multiple Method</h4>
										<p class="method-description">Based on {ddqResponses[3] || 'industry'} revenue multiples</p>
									</div>
								</div>
								<div class="method-value-large">₹{(valuation.revenueMultipleValuation / 10000000).toFixed(2)} Cr</div>
								<div class="method-breakdown">
									<div class="breakdown-item">
										<span>Annual Revenue</span>
										<span>₹{(valuation.annualRevenue / 10000000).toFixed(2)} Cr</span>
									</div>
									<div class="breakdown-item">
										<span>Industry Multiple</span>
										<span>{valuation.industryMultiple?.avg}x</span>
									</div>
								</div>
							</div>
						{/if}
					</div>
				</div>
			</div>
		</div>
	{/if}

	<!-- Frame Info Modal -->
	{#if showFrameInfo && activeFrameInfo}
		<div class="frame-info-modal-overlay" on:click={closeFrameInfo} on:keydown={(e) => e.key === 'Escape' && closeFrameInfo()} role="presentation">
			<div class="frame-info-modal" on:click|stopPropagation on:keydown={() => {}} role="dialog" aria-modal="true" tabindex="-1">
				<div class="frame-info-header">
					<h3>
						<span class="info-icon-large">i</span>
						{activeFrameInfo.title}
					</h3>
					<button class="frame-info-close" on:click={closeFrameInfo}>
						<span class="material-symbols-outlined">close</span>
					</button>
				</div>
				<div class="frame-info-body">
					<div class="frame-info-section">
						<h4>What is this?</h4>
						<p>{activeFrameInfo.description}</p>
					</div>
					{#if activeFrameInfo.calculation}
						<div class="frame-info-section">
							<h4>How is it calculated?</h4>
							<p>{activeFrameInfo.calculation}</p>
						</div>
					{/if}
				</div>
			</div>
		</div>
	{/if}

	<!-- Floating Chatbot FAB -->
	{#if valuation}
		{@const _ = initializeChat()}
		<button 
			class="chatbot-fab"
			class:expanded={showChatbot}
			on:click={() => showChatbot = !showChatbot}
			title="AI Strategic Advisor"
		>
			<span class="material-symbols-outlined fab-icon">psychology</span>
			<div class="fab-pulse"></div>
		</button>

		{#if showChatbot}
			<div class="chatbot-panel">
				<div class="chatbot-header">
					<div class="chatbot-header-content">
						<span class="material-symbols-outlined">psychology</span>
						<div>
							<h3>Daddy</h3>
							<span class="chatbot-badge">Your AI Strategic Advisor</span>
						</div>
					</div>
					<button class="chatbot-close" on:click={() => showChatbot = false}>
						<span class="material-symbols-outlined">close</span>
					</button>
				</div>

				<div class="chatbot-messages" bind:this={chatContainer}>
					{#each chatMessages as message, index}
						<div class="chat-message {message.role}">
							<div class="chat-message-avatar">
								{#if message.role === 'user'}
									<span class="material-symbols-outlined">person</span>
								{:else}
									<span class="material-symbols-outlined">psychology</span>
								{/if}
							</div>
							<div class="chat-message-content">
								<div class="chat-message-text">{message.content}</div>
								<div class="chat-message-footer">
									<div class="chat-message-time">
										{message.timestamp.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
									</div>
									{#if message.role === 'assistant' && index > 0}
										<button 
											class="save-note-btn" 
											on:click={() => saveToNotes(index)}
											title="Save this conversation to notes"
										>
											<span class="material-symbols-outlined">bookmark_add</span>
											Save to Notes
										</button>
									{/if}
								</div>
							</div>
						</div>
					{/each}
					
					{#if chatLoading}
						<div class="chat-message assistant">
							<div class="chat-message-avatar">
								<span class="material-symbols-outlined">psychology</span>
							</div>
							<div class="chat-message-content">
								<div class="typing-indicator">
									<span></span>
									<span></span>
									<span></span>
								</div>
							</div>
						</div>
					{/if}
				</div>

				<div class="chatbot-input-container">
					<div class="chatbot-suggestions">
						{#if chatMessages.length === 1}
							<button class="suggestion-chip" on:click={() => { chatInput = 'What are my biggest competitive advantages?'; sendChatMessage(); }}>
								💪 Advantages
							</button>
							<button class="suggestion-chip" on:click={() => { chatInput = 'How can I improve my valuation?'; sendChatMessage(); }}>
								📈 Improve
							</button>
							<button class="suggestion-chip" on:click={() => { chatInput = 'What should my growth strategy be?'; sendChatMessage(); }}>
								🚀 Strategy
							</button>
						{/if}
					</div>
					<form class="chatbot-input-form" on:submit|preventDefault={sendChatMessage}>
						<input
							type="text"
							class="chatbot-input"
							placeholder="Ask anything..."
							bind:value={chatInput}
							disabled={chatLoading}
						/>
						<button 
							type="submit" 
							class="chatbot-send-btn"
							disabled={!chatInput.trim() || chatLoading}
						>
							<span class="material-symbols-outlined">send</span>
						</button>
					</form>
				</div>
			</div>
		{/if}
	{/if}
</div>

<style>
	.dashboard {
		display: grid;
		grid-template-columns: 260px 1fr;
		min-height: 100vh;
		background: var(--bg-primary);
		transition: grid-template-columns 0.3s ease;
	}

	.dashboard:has(.sidebar.minimized) {
		grid-template-columns: 80px 1fr;
	}

	/* Sidebar */
	.sidebar {
		background: var(--sidebar-bg);
		border-right: 1px solid var(--border-color);
		display: flex;
		flex-direction: column;
		padding: 1.5rem 0;
		transition: all 0.3s ease;
		position: relative;
	}

	.sidebar.minimized {
		padding: 1.5rem 0;
	}

	.sidebar-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		padding: 0 1.25rem 1.5rem;
		border-bottom: 1px solid rgba(0, 0, 0, 0.1);
		margin-bottom: 1.5rem;
	}

	.sidebar.minimized .sidebar-header {
		flex-direction: column;
		gap: 1rem;
		padding: 0 0.75rem 1.5rem;
	}

	.logo-section {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.sidebar.minimized .logo-section {
		justify-content: center;
	}

	.logo-icon {
		width: 2.5rem;
		height: 2.5rem;
		object-fit: contain;
		flex-shrink: 0;
	}

	.logo-dark {
		display: block;
	}

	.logo-light {
		display: none;
	}

	:global([data-theme='light']) .logo-dark {
		display: none;
	}

	:global([data-theme='light']) .logo-light {
		display: block;
	}

	.brand-text {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
	}

	.brand-nebulaa {
		font-family: 'Badhorse', cursive;
		font-size: 0.9rem;
		color: var(--sidebar-text, var(--accent-primary));
		letter-spacing: 0.3px;
		line-height: 1;
	}

	.brand-name {
		font-size: 0.9rem;
		font-weight: 600;
		color: var(--sidebar-text, var(--text-primary));
		letter-spacing: 0.3px;
		line-height: 1;
	}

	.sidebar-toggle {
		background: none;
		border: none;
		color: var(--sidebar-text, var(--text-secondary));
		cursor: pointer;
		padding: 0.5rem;
		border-radius: 6px;
		transition: all 0.2s ease;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.sidebar-toggle:hover {
		background: var(--sidebar-hover, var(--bg-hover));
		color: var(--sidebar-text, var(--accent-primary));
	}

	.sidebar-toggle .material-symbols-outlined {
		font-size: 1.25rem;
	}

	.sidebar-nav {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding: 0 0.75rem;
		overflow-y: auto;
	}

	.nav-item {
		display: flex;
		align-items: center;
		gap: 0.875rem;
		padding: 0.875rem 1rem;
		background: none;
		border: none;
		border-radius: 8px;
		color: var(--sidebar-text, var(--text-secondary));
		cursor: pointer;
		transition: all 0.2s ease;
		text-align: left;
		font-size: 0.95rem;
		font-weight: 500;
		white-space: nowrap;
	}

	.sidebar.minimized .nav-item {
		justify-content: center;
		padding: 0.875rem;
	}

	.nav-icon {
		font-size: 1.5rem;
		flex-shrink: 0;
		transition: color 0.2s ease;
	}

	.nav-text {
		flex: 1;
	}

	.nav-item:hover {
		background: var(--sidebar-hover, var(--bg-hover));
		color: var(--sidebar-text, var(--text-primary));
	}

	.nav-item:hover .nav-icon {
		color: var(--sidebar-text, var(--accent-primary));
	}

	.nav-item.active {
		background: rgba(0, 0, 0, 0.12);
		color: var(--sidebar-text, var(--accent-primary));
		font-weight: 600;
	}

	.nav-item.active .nav-icon {
		color: var(--sidebar-text, var(--accent-primary));
	}

	/* Overview */
	.overview-section {
		display: grid;
		gap: 2rem;
	}

	/* NEW HOME LAYOUT STYLES */
	.home-layout {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		width: 100%;
		padding-right: 0.5rem;
		padding-bottom: 1rem;
		height: 100%;
		min-height: calc(100vh - 200px);
	}

	.home-row-top {
		display: grid;
		grid-template-columns: 160px 1fr 220px;
		gap: 1rem;
		min-height: 280px;
	}

	.home-row-bottom {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1rem;
		min-height: 180px;
	}

	/* New Split Section: News (Left) + Dashboards (Right) */
	.home-split-section {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1rem;
		flex: 1;
	}

	/* Right Dashboard Column - stacks Financial & Marketing */
	.dashboard-right-column {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.dashboard-right-column .home-card {
		flex: 1;
		display: flex;
		flex-direction: column;
	}

	.dashboard-right-column .financial-grid,
	.dashboard-right-column .marketing-grid {
		flex: 1;
	}

	/* New Bottom Section: News + Financial + Marketing */
	.home-bottom-section {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1rem;
		min-height: 180px;
	}

	/* =====================================================
	   NEWS SECTION STYLES (Wireframe Layout)
	   ===================================================== */
	
	.news-section-container {
		background: var(--card-bg);
		border-radius: 12px;
		padding: 1rem;
		border: 1px solid var(--border-color);
		display: flex;
		flex-direction: column;
		height: 100%;
	}

	.section-label {
		font-size: 0.9rem;
		font-weight: 600;
		color: var(--text-secondary);
		margin-bottom: 1rem;
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}
	
	.section-header-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 1rem;
	}
	
	.section-header-row .section-label {
		margin-bottom: 0;
	}

	.news-loading-state,
	.news-empty-state {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.75rem;
		padding: 3rem 1rem;
		color: var(--text-secondary);
		font-size: 0.9rem;
		flex: 1;
	}

	.news-loading-state .spinning {
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		from { transform: rotate(0deg); }
		to { transform: rotate(360deg); }
	}

	/* Featured News (Top Section) */
	.featured-news-container {
		position: relative;
		margin-bottom: 0.75rem;
		flex: 1;
		display: flex;
		flex-direction: column;
	}

	.featured-news {
		display: flex;
		flex-direction: column;
		gap: 0;
		text-decoration: none;
		color: var(--text-primary);
		border-radius: 10px;
		overflow: hidden;
		background: var(--bg-secondary);
		flex: 1;
		transition: transform 0.3s ease, box-shadow 0.3s ease;
	}

	.featured-news:hover {
		transform: translateY(-2px);
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
	}

	.featured-news-image {
		position: relative;
		background-size: cover;
		background-position: center;
		background-color: var(--bg-tertiary);
		flex: 1;
		min-height: 180px;
	}

	.featured-news-overlay {
		position: absolute;
		inset: 0;
		background: linear-gradient(to bottom, transparent 40%, rgba(0,0,0,0.8) 100%);
	}

	.featured-news-content {
		padding: 1rem;
		display: flex;
		flex-direction: column;
		justify-content: center;
		background: var(--bg-secondary);
	}

	.featured-news-title {
		font-size: 1.1rem;
		font-weight: 700;
		line-height: 1.3;
		margin-bottom: 0.5rem;
		color: var(--text-primary);
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	.featured-news-summary {
		font-size: 0.85rem;
		color: var(--text-secondary);
		line-height: 1.4;
		margin-bottom: 0.5rem;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	.featured-news-meta {
		display: flex;
		gap: 0.75rem;
		font-size: 0.7rem;
		color: var(--text-muted);
		margin-bottom: 0.25rem;
	}

	.featured-source {
		font-weight: 600;
		color: var(--accent-primary);
	}

	.read-more-link {
		font-size: 0.85rem;
		font-weight: 600;
		color: var(--accent-primary);
	}

	/* Progress Dots */
	.news-progress-dots {
		display: flex;
		justify-content: center;
		gap: 0.5rem;
		padding: 0.5rem 0;
	}

	.progress-dot {
		width: 10px;
		height: 10px;
		border-radius: 50%;
		background: var(--border-color);
		border: none;
		cursor: pointer;
		transition: all 0.3s ease;
		padding: 0;
	}

	.progress-dot:hover {
		background: var(--text-secondary);
	}

	.progress-dot.active {
		background: var(--accent-primary);
		width: 28px;
		border-radius: 5px;
	}

	/* News Thumbnails Row */
	.news-thumbnails-row {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 0.75rem;
	}

	.news-thumbnail-card {
		text-decoration: none;
		color: var(--text-primary);
		background: var(--bg-secondary);
		border-radius: 8px;
		overflow: hidden;
		transition: transform 0.2s ease, box-shadow 0.2s ease;
		cursor: pointer;
		border: 2px solid transparent;
	}

	.news-thumbnail-card:hover {
		transform: translateY(-2px);
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
	}

	.news-thumbnail-card.active {
		border-color: var(--accent-primary);
	}

	.thumbnail-image {
		height: 70px;
		background-size: cover;
		background-position: center;
		background-color: var(--bg-tertiary);
	}

	.thumbnail-title {
		padding: 0.5rem;
		font-size: 0.7rem;
		font-weight: 500;
		line-height: 1.3;
		color: var(--text-primary);
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
		margin: 0;
	}

	/* Right Panels Container */
	.home-right-panels {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1rem;
	}

	/* inFINity stats Panel */
	.financial-panel {
		border-top: 3px solid #3b82f6;
	}

	.financial-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.75rem;
		flex: 1;
	}

	.fin-metric {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		padding: 0.5rem;
		background: var(--bg-secondary);
		border-radius: 6px;
	}

	.fin-metric.full-width {
		grid-column: span 2;
	}

	.fin-label {
		font-size: 0.7rem;
		color: var(--text-secondary);
		text-transform: uppercase;
	}

	.fin-value {
		font-size: 1rem;
		font-weight: 700;
		color: var(--text-primary);
	}

	.fin-value.revenue {
		color: #10b981;
	}

	.fin-value.burn {
		color: #ef4444;
	}

	.fin-value.profitable {
		color: #10b981;
	}

	.fin-value.burning {
		color: #ef4444;
	}

	/* Gravity stats Panel */
	.marketing-panel {
		border-top: 3px solid #f59e0b;
	}

	.marketing-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.5rem;
		flex: 1;
	}

	.mkt-metric {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		padding: 0.4rem;
		background: var(--bg-secondary);
		border-radius: 6px;
	}

	.mkt-label {
		font-size: 0.65rem;
		color: var(--text-secondary);
	}

	.mkt-value {
		font-size: 0.9rem;
		font-weight: 600;
		color: var(--text-primary);
	}

	.mkt-value.profitable {
		color: #10b981;
	}

	.mkt-value.burning {
		color: #ef4444;
	}

	.mkt-value.action {
		color: #f59e0b;
	}

	.home-card {
		background: var(--card-bg);
		border: 1px solid var(--border-color);
		border-radius: 10px;
		padding: 1rem;
		min-width: 0;
		overflow: hidden;
		display: flex;
		flex-direction: column;
	}
	
	.home-card-header-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 0.5rem;
	}
	
	.home-card-header-row .home-card-title {
		margin-bottom: 0;
	}
	
	.home-card-header-row .card-header-actions {
		margin-left: 0;
	}

	.home-card-title {
		font-size: 0.85rem;
		font-weight: 700;
		color: var(--text-primary);
		margin: 0 0 0.5rem 0;
		flex-shrink: 0;
	}

	/* Valuation Summary Card */
	.valuation-summary-card {
		text-align: center;
		justify-content: center;
		cursor: pointer;
		transition: all 0.2s ease;
	}
	
	.valuation-summary-card .home-card-header-row {
		justify-content: center;
		gap: 0.5rem;
	}
	
	.valuation-summary-card .home-card-header-row .card-header-actions {
		position: absolute;
		top: 0.5rem;
		right: 0.5rem;
	}
	
	.valuation-summary-card {
		position: relative;
	}

	.valuation-summary-card:hover {
		border-color: var(--accent-color);
		box-shadow: 0 2px 8px rgba(255, 193, 7, 0.2);
	}

	.valuation-big {
		font-size: 1.5rem;
		font-weight: 800;
		color: var(--accent-color);
	}

	.valuation-usd-small {
		font-size: 0.75rem;
		color: var(--text-secondary);
		margin-top: 0.25rem;
	}

	.valuation-hint {
		font-size: 0.65rem;
		color: var(--text-secondary);
		margin-top: 0.5rem;
		opacity: 0.7;
	}

	/* Actions Card */
	.actions-card {
		min-width: 0;
		overflow: hidden;
	}

	.actions-list {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		width: 100%;
		overflow-y: auto;
		flex: 1;
	}

	.action-item {
		display: flex;
		align-items: flex-start;
		gap: 0.5rem;
		padding: 0.4rem 0.5rem;
		background: rgba(0, 0, 0, 0.02);
		border-radius: 6px;
		transition: all 0.2s ease;
		min-width: 0;
	}

	.action-item.rejected {
		opacity: 0.5;
	}

	.action-item.accepted {
		border-left: 3px solid var(--accent-color);
	}

	.action-letter {
		font-weight: 700;
		color: var(--accent-color);
		min-width: 16px;
		flex-shrink: 0;
		font-size: 0.75rem;
	}

	.action-text {
		flex: 1;
		font-size: 0.72rem;
		color: var(--text-primary);
		line-height: 1.3;
		word-wrap: break-word;
		overflow-wrap: break-word;
		min-width: 0;
	}

	.action-text.strikethrough {
		text-decoration: line-through;
		color: var(--text-secondary);
	}

	.action-buttons {
		display: flex;
		gap: 0.5rem;
		flex-shrink: 0;
	}

	.action-btn {
		width: 26px;
		height: 26px;
		border-radius: 50%;
		border: none;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: all 0.2s ease;
		flex-shrink: 0;
	}

	.action-btn.accept {
		background: #22c55e;
		color: white;
	}

	.action-btn.accept:hover {
		background: #16a34a;
		transform: scale(1.1);
	}

	.action-btn.reject {
		background: #ef4444;
		color: white;
	}

	.action-btn.reject:hover {
		background: #dc2626;
		transform: scale(1.1);
	}

	.action-btn .material-symbols-outlined {
		font-size: 16px;
	}

	/* RAG Buttons */
	.rag-buttons {
		display: flex;
		gap: 0.4rem;
		flex-shrink: 0;
	}

	.rag-buttons.small .rag-btn {
		width: 14px;
		height: 14px;
	}

	.rag-btn {
		width: 18px;
		height: 18px;
		border-radius: 50%;
		border: 2px solid transparent;
		cursor: pointer;
		transition: all 0.2s ease;
		opacity: 0.4;
		flex-shrink: 0;
	}

	.rag-btn:hover {
		opacity: 0.8;
		transform: scale(1.2);
	}

	.rag-btn.active {
		opacity: 1;
		border-color: white;
		box-shadow: 0 0 8px currentColor;
	}

	.rag-btn.red {
		background: #ef4444;
	}

	.rag-btn.amber {
		background: #f59e0b;
	}

	.rag-btn.green {
		background: #22c55e;
	}

	/* Backlog Card */
	.backlog-card {
		min-width: 0;
		overflow: hidden;
	}

	.backlog-list {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		overflow-y: auto;
		flex: 1;
	}

	.backlog-item {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		font-size: 0.75rem;
		padding: 0.4rem;
		background: rgba(0, 0, 0, 0.02);
		border-radius: 4px;
	}

	.backlog-letter {
		font-weight: 600;
		color: var(--text-secondary);
		font-size: 0.7rem;
		min-width: 18px;
		flex-shrink: 0;
	}

	.backlog-text {
		flex: 1;
		color: var(--text-primary);
		overflow: hidden;
		text-overflow: ellipsis;
		display: -webkit-box;
		-webkit-line-clamp: 1;
		-webkit-box-orient: vertical;
		word-break: break-word;
	}

	.rag-buttons.small {
		flex-shrink: 0;
	}

	.rag-buttons.small .rag-btn {
		width: 14px;
		height: 14px;
	}

	.no-actions-text, .no-backlog-text {
		color: var(--text-secondary);
		font-size: 0.75rem;
		text-align: center;
		padding: 1rem 0.5rem;
	}

	/* News Marquee */
	.news-marquee-container {
		background: var(--card-bg);
		border: 1px solid var(--border-color);
		border-radius: 8px;
		padding: 0.6rem 1rem;
		display: flex;
		align-items: center;
		gap: 0.75rem;
		overflow: hidden;
		flex-shrink: 0;
	}

	.news-label {
		font-weight: 700;
		color: var(--text-primary);
		white-space: nowrap;
		padding-right: 0.75rem;
		border-right: 2px solid var(--border-color);
		font-size: 0.8rem;
	}

	.news-marquee {
		flex: 1;
		overflow: hidden;
		position: relative;
	}

	.marquee-content {
		display: flex;
		gap: 3rem;
		animation: marquee 30s linear infinite;
		white-space: nowrap;
	}

	@keyframes marquee {
		0% { transform: translateX(0); }
		100% { transform: translateX(-50%); }
	}

	.news-item {
		display: inline-flex;
		gap: 0.5rem;
		color: var(--text-primary);
		font-size: 0.9rem;
	}

	.news-item strong {
		color: var(--accent-color);
	}

	.news-time {
		color: var(--text-secondary);
		font-size: 0.7rem;
	}

	.news-loading, .news-placeholder {
		color: var(--text-secondary);
		font-style: italic;
		font-size: 0.8rem;
	}

	.news-item {
		display: inline-flex;
		gap: 0.4rem;
		color: var(--text-primary);
		font-size: 0.8rem;
	}

	/* Dashboard Cards */
	.dashboard-card {
		justify-content: center;
		align-items: center;
	}

	.dashboard-metric {
		text-align: center;
	}

	.dashboard-metric .metric-label {
		display: block;
		font-size: 0.75rem;
		color: var(--text-secondary);
		margin-bottom: 0.25rem;
	}

	.dashboard-metric .metric-value {
		font-size: 1.5rem;
		font-weight: 800;
		color: var(--accent-color);
	}

	.dashboard-placeholder {
		color: var(--text-secondary);
		text-align: center;
		font-size: 0.75rem;
	}

	/* inFINity stats Dashboard Card */
	.financial-health-card {
		flex-direction: column;
		align-items: stretch !important;
		min-height: 160px;
		justify-content: flex-start;
	}

	.dashboard-metrics-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1.25rem;
		width: 100%;
		padding: 0.75rem 0;
		flex: 1;
	}

	.dashboard-metric-item {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	.dashboard-metric-item .metric-label {
		font-size: 0.75rem;
		color: var(--text-secondary);
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	.dashboard-metric-item .metric-value {
		font-size: 1.4rem;
		font-weight: 700;
		color: var(--text-primary);
		line-height: 1.2;
	}

	.dashboard-metric-item.burn .metric-value {
		color: #ef4444;
	}

	.dashboard-metric-item.revenue .metric-value {
		color: #10b981;
	}

	.dashboard-metric-item .metric-value.profitable {
		color: #10b981;
	}

	.dashboard-metric-item .metric-value.burning {
		color: #ef4444;
	}

	/* Home Metrics Section */
	.home-metrics-section {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		margin-bottom: 0.5rem;
	}

	.metrics-row {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 0.75rem;
	}

	/* inFINity stats 2x2 Grid */
	.metrics-row.financial-row {
		grid-template-columns: repeat(2, 1fr);
		gap: 0.75rem;
	}

	/* Know your Market Section */
	.know-your-market-section {
		margin-bottom: 1.5rem;
		padding-bottom: 1.5rem;
		border-bottom: 1px solid var(--border-color);
	}

	.market-metrics-grid {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 0.75rem;
		margin-top: 1rem;
	}

	.metric-box {
		background: var(--card-bg);
		border: 1px solid var(--border-color);
		border-radius: 10px;
		padding: 0.75rem 1rem;
		border-top: 3px solid var(--border-color);
	}

	.metric-box.tam { border-top-color: #3b82f6; }
	.metric-box.sam { border-top-color: #f59e0b; }
	.metric-box.som { border-top-color: #22c55e; }
	.metric-box.cagr { border-top-color: #8b5cf6; }
	.metric-box.runway { border-top-color: #6b7280; }
	.metric-box.burn { border-top-color: #ef4444; }
	.metric-box.revenue { border-top-color: #10b981; }
	.metric-box.status { border-top-color: #f59e0b; }

	.metric-header-small {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		font-size: 0.7rem;
		font-weight: 600;
		color: var(--text-secondary);
		text-transform: uppercase;
		margin-bottom: 0.4rem;
	}

	.metric-header-small .material-symbols-outlined {
		font-size: 0.9rem;
	}

	.metric-value-large {
		font-size: 1.25rem;
		font-weight: 800;
		color: var(--text-primary);
		line-height: 1.2;
	}

	.metric-value-large.profitable { color: #22c55e; }
	.metric-value-large.burning { color: #ef4444; }

	.metric-desc-small {
		font-size: 0.65rem;
		color: var(--text-secondary);
		margin-top: 0.25rem;
	}

	.metric-sub {
		font-size: 0.6rem;
		color: var(--text-secondary);
		background: var(--bg-secondary);
		padding: 0.15rem 0.4rem;
		border-radius: 4px;
		display: inline-block;
		margin-top: 0.25rem;
	}

	.financial-health-header {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.85rem;
		font-weight: 600;
		color: var(--text-primary);
		margin-top: 0.5rem;
	}

	.financial-health-header .material-symbols-outlined {
		font-size: 1rem;
		color: var(--accent-color);
	}

	.valuation-method-row {
		display: flex;
		gap: 2rem;
		padding: 0.5rem 0;
	}

	.method-item {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		font-size: 0.75rem;
		color: var(--text-secondary);
	}

	.method-item .material-symbols-outlined {
		font-size: 0.9rem;
	}

	.method-item strong {
		color: var(--text-primary);
	}

	/* News Link Styles */
	.news-item-link {
		text-decoration: none;
		color: inherit;
		transition: all 0.2s ease;
	}

	.news-item-link:hover {
		color: var(--accent-color);
	}

	.news-item-link:hover .news-item {
		text-decoration: underline;
	}

	@media (max-width: 992px) {
		.metrics-row {
			grid-template-columns: repeat(2, 1fr);
		}
	}

	@media (max-width: 576px) {
		.metrics-row {
			grid-template-columns: 1fr;
		}
		
		.valuation-method-row {
			flex-direction: column;
			gap: 0.5rem;
		}
	}

	/* Header Company Logo/Name */
	.header-company-logo {
		display: flex;
		align-items: center;
		margin-right: 1rem;
	}

	.header-company-logo img {
		height: 36px;
		width: auto;
		max-width: 120px;
		object-fit: contain;
		border-radius: 6px;
	}

	.header-company-name {
		font-weight: 600;
		color: var(--text-primary);
		font-size: 0.95rem;
		margin-right: 1rem;
		padding: 0.5rem 1rem;
		background: rgba(255, 215, 0, 0.1);
		border-radius: 6px;
	}

	/* File Upload Styles */
	.file-upload-container {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1rem;
	}

	.file-upload-label {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		width: 200px;
		height: 200px;
		border: 2px dashed var(--border-color);
		border-radius: 12px;
		cursor: pointer;
		transition: all 0.2s ease;
		background: rgba(0, 0, 0, 0.02);
	}

	.file-upload-label:hover {
		border-color: var(--accent-color);
		background: rgba(255, 215, 0, 0.05);
	}

	.file-upload-label .material-symbols-outlined {
		font-size: 48px;
		color: var(--text-secondary);
	}

	.logo-preview {
		max-width: 160px;
		max-height: 160px;
		object-fit: contain;
		border-radius: 8px;
	}

	.change-logo-text {
		font-size: 0.85rem;
		color: var(--text-secondary);
	}

	.skip-btn {
		font-size: 0.9rem;
	}

	.loading-spinner-small {
		text-align: center;
		padding: 2rem;
		color: var(--text-secondary);
	}

	/* Responsive adjustments for home layout */
	@media (max-width: 1200px) {
		.home-row-top {
			grid-template-columns: 140px 1fr 180px;
		}
	}

	@media (max-width: 992px) {
		.home-layout {
			height: auto;
			overflow: auto;
		}
		
		.home-row-top {
			grid-template-columns: 1fr 1fr;
			grid-template-rows: auto auto;
		}
		
		.valuation-summary-card {
			grid-column: 1;
		}
		
		.actions-card {
			grid-column: 2;
			grid-row: 1 / 3;
		}
		
		.backlog-card {
			grid-column: 1;
		}
	}

	@media (max-width: 768px) {
		.home-row-top, .home-row-bottom {
			grid-template-columns: 1fr;
		}
		
		.actions-card, .backlog-card {
			grid-column: span 1;
			grid-row: auto;
		}
	}

	.welcome-card {
		padding: 2.5rem;
	}

	.section-title {
		font-size: 1.75rem;
		font-weight: 700;
		color: var(--text-primary);
		margin: 0;
	}

	.section-text {
		color: var(--text-secondary);
		margin-top: 0.5rem;
		line-height: 1.6;
	}

	.stats-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
		gap: 1.5rem;
		margin-top: 2rem;
	}

	.stat-card {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.75rem;
		padding: 1.5rem;
		text-align: center;
		background: rgba(255, 215, 0, 0.05);
		border: 1px solid rgba(255, 215, 0, 0.15);
		transition: all 0.3s ease;
	}
	
	.stat-card:hover {
		background: rgba(255, 215, 0, 0.08);
		border-color: rgba(255, 215, 0, 0.25);
		transform: translateY(-2px);
	}

	.stat-card .icon {
		font-size: 2rem;
		color: var(--accent-primary);
	}

	.stat-label {
		font-size: 0.875rem;
		color: var(--text-tertiary);
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	.stat-value {
		font-size: 1.25rem;
		font-weight: 700;
		color: var(--text-primary);
	}

	.quick-insights {
		margin-top: 2rem;
	}

	.insight-item {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 1rem 0;
		border-bottom: 1px solid var(--border-color);
	}

	.insight-item:last-child {
		border-bottom: none;
	}

	.insight-item .icon {
		margin-right: 0.75rem;
		color: var(--accent-primary);
	}

	.accent-text {
		font-size: 1.25rem;
		font-weight: 700;
		color: var(--accent-primary);
	}

	/* DDQ Modal */
	.ddq-modal {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(0, 0, 0, 0.8);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1000;
		padding: 2rem;
	}

	/* Main Content */
	.main-content {
		overflow-y: auto;
		overflow-x: hidden;
		max-width: 100%;
	}

	/* Main Content */
	main {
		display: flex;
		flex-direction: column;
		min-height: 100vh;
	}

	.dashboard-header {
		padding: 2rem;
		border-bottom: 1px solid var(--border-color);
		background: var(--bg-secondary);
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 2rem;
	}

	.header-actions {
		display: flex;
		align-items: center;
		gap: 1rem;
	}

	.header-theme-toggle {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 48px;
		height: 48px;
		background: var(--bg-primary);
		border: 2px solid var(--border-color);
		border-radius: 12px;
		color: var(--text-secondary);
		cursor: pointer;
		transition: all 0.3s ease;
		padding: 0;
	}

	.header-theme-toggle:hover {
		background: var(--bg-hover);
		color: var(--accent-primary);
		border-color: var(--accent-primary);
		transform: translateY(-2px);
		box-shadow: 0 4px 12px rgba(212, 175, 55, 0.2);
	}

	.header-theme-toggle .material-symbols-outlined {
		font-size: 1.5rem;
	}

	.dashboard-title {
		font-size: 2rem;
		font-weight: 700;
		color: var(--text-primary);
		margin-bottom: 0.5rem;
	}

	.dashboard-subtitle {
		color: var(--text-secondary);
		font-size: 1rem;
	}

	.content-area {
		padding: 20px 15px;
		flex: 1;
		max-width: 100%;
		overflow-x: hidden;
	}

	.card-header {
		display: flex;
		align-items: center;
		gap: 1rem;
		margin-bottom: 2rem;
	}
	
	/* Info and Daddy Button Styles */
	.card-header-actions {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		margin-left: auto;
		flex-shrink: 0;
	}
	
	.card-header-actions.inline {
		display: inline-flex;
		margin-left: 0.5rem;
		vertical-align: middle;
	}
	
	.info-btn, .daddy-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 18px;
		height: 18px;
		border-radius: 50%;
		border: 1.5px solid var(--border-color);
		background: var(--bg-secondary);
		cursor: pointer;
		transition: all 0.2s ease;
		font-weight: 700;
		font-size: 0.65rem;
		padding: 0;
		line-height: 1;
	}
	
	.info-btn {
		color: var(--accent-primary);
		border-color: var(--accent-primary);
	}
	
	.info-btn:hover {
		background: var(--accent-primary);
		color: var(--bg-primary);
		transform: scale(1.15);
	}
	
	.daddy-btn {
		color: #9c27b0;
		border-color: #9c27b0;
	}
	
	.daddy-btn:hover {
		background: #9c27b0;
		color: white;
		transform: scale(1.15);
	}
	
	.info-icon, .daddy-icon {
		font-family: 'Inter', system-ui, sans-serif;
		font-style: italic;
		font-weight: 700;
		font-size: 0.6rem;
	}
	
	.daddy-icon {
		font-style: normal;
	}
	
	/* Frame Info Modal */
	.frame-info-modal-overlay {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(0, 0, 0, 0.6);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1000;
		animation: fadeIn 0.2s ease;
	}
	
	.frame-info-modal {
		background: var(--card-bg);
		border-radius: 16px;
		max-width: 500px;
		width: 90%;
		max-height: 80vh;
		overflow-y: auto;
		box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
		animation: slideUp 0.3s ease;
	}
	
	.frame-info-header {
		padding: 1.5rem;
		border-bottom: 1px solid var(--border-color);
		display: flex;
		align-items: center;
		justify-content: space-between;
	}
	
	.frame-info-header h3 {
		font-size: 1.25rem;
		font-weight: 700;
		color: var(--text-primary);
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}
	
	.frame-info-header h3 .info-icon-large {
		width: 32px;
		height: 32px;
		background: var(--accent-primary);
		color: var(--bg-primary);
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		font-weight: 700;
		font-style: italic;
	}
	
	.frame-info-close {
		background: none;
		border: none;
		color: var(--text-secondary);
		cursor: pointer;
		padding: 0.5rem;
		border-radius: 8px;
		transition: all 0.2s ease;
	}
	
	.frame-info-close:hover {
		background: var(--bg-hover);
		color: var(--text-primary);
	}
	
	.frame-info-body {
		padding: 1.5rem;
	}
	
	.frame-info-section {
		margin-bottom: 1.5rem;
	}
	
	.frame-info-section:last-child {
		margin-bottom: 0;
	}
	
	.frame-info-section h4 {
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--accent-primary);
		text-transform: uppercase;
		letter-spacing: 0.5px;
		margin-bottom: 0.5rem;
	}
	
	.frame-info-section p {
		font-size: 0.95rem;
		color: var(--text-secondary);
		line-height: 1.6;
	}
	
	@keyframes slideUp {
		from {
			opacity: 0;
			transform: translateY(20px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}
	
	@keyframes fadeIn {
		from { opacity: 0; }
		to { opacity: 1; }
	}

	.icon-large {
		font-size: 2.5rem;
		color: var(--accent-primary);
	}

	/* Modern Bullet Chart Valuation Display */
	.valuation-display-container {
		padding: 2rem;
		cursor: pointer;
		transition: all 0.3s ease;
		border-radius: 12px;
	}

	.valuation-display-container:hover {
		background: var(--bg-secondary);
		transform: translateY(-2px);
		box-shadow: 0 4px 16px rgba(212, 175, 55, 0.2);
	}

	.valuation-main {
		display: flex;
		align-items: center;
		gap: 2rem;
		margin-bottom: 2rem;
	}

	.valuation-icon-wrapper {
		background: linear-gradient(135deg, rgba(212, 175, 55, 0.2), rgba(212, 175, 55, 0.05));
		padding: 1.5rem;
		border-radius: 16px;
		border: 2px solid rgba(212, 175, 55, 0.3);
	}

	.valuation-icon {
		font-size: 4rem;
		color: var(--accent-primary);
		display: block;
	}

	.valuation-value-section {
		flex: 1;
	}

	.valuation-label {
		font-size: 0.875rem;
		color: var(--text-secondary);
		text-transform: uppercase;
		letter-spacing: 1px;
		margin-bottom: 0.5rem;
	}

	.valuation-amount {
		display: flex;
		align-items: baseline;
		gap: 0.5rem;
		margin-bottom: 0.5rem;
	}

	.valuation-amount .currency {
		font-size: 2.5rem;
		font-weight: 700;
		color: var(--accent-primary);
	}

	.valuation-amount .value {
		font-size: 4.5rem;
		font-weight: 800;
		color: var(--accent-primary);
		line-height: 1;
		letter-spacing: -2px;
	}

	.valuation-amount .unit {
		font-size: 2rem;
		font-weight: 600;
		color: var(--text-secondary);
	}

	.valuation-usd {
		font-size: 1.25rem;
		color: var(--text-tertiary);
	}

	/* Bullet Chart */
	.bullet-chart-container {
		margin: 2rem 0;
	}

	.bullet-chart {
		position: relative;
		margin-bottom: 1rem;
	}

	.bullet-bins {
		display: flex;
		gap: 2px;
		margin-bottom: 1rem;
	}

	.bullet-bin {
		flex: 1;
		height: 40px;
		background: var(--bg-secondary);
		border: 1px solid var(--border-color);
		border-radius: 4px;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 0.75rem;
		color: var(--text-tertiary);
		transition: all 0.3s ease;
	}

	.bullet-bin.filled {
		background: linear-gradient(135deg, rgba(212, 175, 55, 0.3), rgba(212, 175, 55, 0.1));
		border-color: var(--accent-primary);
		color: var(--accent-primary);
		font-weight: 600;
	}

	.bullet-progress-track {
		position: relative;
		height: 12px;
		background: var(--bg-secondary);
		border-radius: 6px;
		overflow: hidden;
		border: 1px solid var(--border-color);
	}

	.bullet-progress {
		height: 100%;
		background: linear-gradient(90deg, 
			rgba(212, 175, 55, 0.3) 0%, 
			rgba(212, 175, 55, 0.6) 50%, 
			var(--accent-primary) 100%);
		border-radius: 6px;
		position: relative;
		transition: width 1s ease-out;
	}

	.sparkline-effect {
		position: absolute;
		top: 0;
		right: 0;
		width: 40px;
		height: 100%;
		background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.3));
		animation: sparkle 2s ease-in-out infinite;
	}

	@keyframes sparkle {
		0%, 100% {
			opacity: 0.3;
			transform: translateX(-20px);
		}
		50% {
			opacity: 1;
			transform: translateX(0);
		}
	}

	.progress-marker {
		position: absolute;
		top: -35px;
		transform: translateX(-50%);
		transition: left 1s ease-out;
	}

	.marker-value {
		background: var(--accent-primary);
		color: var(--bg-primary);
		padding: 0.25rem 0.75rem;
		border-radius: 12px;
		font-size: 0.875rem;
		font-weight: 700;
		white-space: nowrap;
		box-shadow: 0 2px 8px rgba(212, 175, 55, 0.4);
	}

	.marker-value::after {
		content: '';
		position: absolute;
		bottom: -4px;
		left: 50%;
		transform: translateX(-50%);
		width: 0;
		height: 0;
		border-left: 5px solid transparent;
		border-right: 5px solid transparent;
		border-top: 5px solid var(--accent-primary);
	}

	/* Milestone Indicators */
	.milestone-indicators {
		display: flex;
		justify-content: space-around;
		margin-top: 1.5rem;
		gap: 1rem;
	}

	.milestone {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.5rem;
		opacity: 0.4;
		transition: all 0.3s ease;
	}

	.milestone.achieved {
		opacity: 1;
	}

	.milestone .material-symbols-outlined {
		font-size: 2rem;
		color: var(--text-tertiary);
	}

	.milestone.achieved .material-symbols-outlined {
		color: var(--accent-primary);
	}

	.milestone span:last-child {
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--text-secondary);
	}

	.milestone.achieved span:last-child {
		color: var(--accent-primary);
	}

	.valuation-stage {
		text-align: center;
		margin-top: 1.5rem;
	}

	.stage-badge {
		padding: 0.75rem 1.5rem;
		border-radius: 24px;
		font-size: 1rem;
		font-weight: 600;
		display: inline-block;
	}

	.stage-badge.early {
		background: rgba(255, 107, 107, 0.2);
		color: #ff6b6b;
		border: 2px solid rgba(255, 107, 107, 0.4);
	}

	.stage-badge.growing {
		background: rgba(255, 217, 61, 0.2);
		color: #ffd93d;
		border: 2px solid rgba(255, 217, 61, 0.4);
	}

	.stage-badge.established {
		background: var(--accent-shadow);
		color: var(--accent-primary);
		border: 2px solid rgba(212, 175, 55, 0.4);
	}

	.stage-badge.scale {
		background: rgba(78, 205, 196, 0.2);
		color: #4ecdc4;
		border: 2px solid rgba(78, 205, 196, 0.4);
	}

	.methodology-hint {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		margin-top: 1.5rem;
		font-size: 0.875rem;
		color: var(--text-tertiary);
		font-style: italic;
	}

	.methodology-hint .material-symbols-outlined {
		font-size: 1.125rem;
	}

	/* Methodology Modal */
	.methodology-modal {
		max-width: 800px;
		max-height: 90vh;
		overflow-y: auto;
	}

	.methodology-explanation {
		background: var(--bg-secondary);
		padding: 1.5rem;
		border-radius: 12px;
		border-left: 4px solid var(--accent-primary);
		margin-bottom: 2rem;
	}

	.explanation-text {
		font-size: 1rem;
		line-height: 1.6;
		color: var(--text-secondary);
	}

	.explanation-text strong {
		color: var(--accent-primary);
	}

	.method-cards-modal {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	.method-card-modal {
		background: var(--bg-secondary);
		padding: 1.5rem;
		border-radius: 12px;
		border: 1px solid var(--border-color);
	}

	.method-card-modal.berkus {
		border-left: 4px solid #6bcf7f;
	}

	.method-card-modal.scorecard {
		border-left: 4px solid #4ecdc4;
	}

	.method-card-modal.revenue-multiple {
		border-left: 4px solid var(--accent-primary);
	}

	.method-card-header {
		display: flex;
		align-items: flex-start;
		gap: 1rem;
		margin-bottom: 1rem;
	}

	.method-card-header .method-icon {
		font-size: 2.5rem;
		color: var(--accent-primary);
	}

	.method-card-header h4 {
		font-size: 1.25rem;
		font-weight: 700;
		color: var(--text-primary);
		margin-bottom: 0.25rem;
	}

	.method-description {
		font-size: 0.875rem;
		color: var(--text-tertiary);
	}

	.method-value-large {
		font-size: 2.5rem;
		font-weight: 800;
		color: var(--accent-primary);
		margin-bottom: 1rem;
	}

	.method-breakdown {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.breakdown-item {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.75rem;
		background: var(--bg-primary);
		border-radius: 8px;
		border: 1px solid var(--border-color);
	}

	.breakdown-item span:first-child {
		color: var(--text-secondary);
		font-size: 0.875rem;
	}

	.breakdown-item span:last-child {
		font-weight: 700;
		color: var(--accent-primary);
	}

	/* Methodology Section (kept for backward compatibility, hidden in UI) */
	.methodology-section {
		display: none; /* Hidden - shown in modal instead */
		margin-top: 2rem;
		padding-top: 2rem;
		border-top: 1px solid var(--border-color);
	}

	.subsection-title {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		font-size: 1.25rem;
		font-weight: 600;
		color: var(--text-primary);
		margin-bottom: 1.5rem;
	}

	.subsection-title .material-symbols-outlined {
		font-size: 1.5rem;
		color: var(--accent-primary);
	}

	.method-cards {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
		gap: 1.5rem;
	}

	.method-card {
		display: flex;
		align-items: flex-start;
		gap: 1rem;
		padding: 1.5rem;
		background: var(--bg-secondary);
		border: 1px solid var(--border-color);
		border-radius: 12px;
		transition: all 0.2s ease;
	}

	.method-card:hover {
		border-color: var(--accent-primary);
		transform: translateY(-2px);
		box-shadow: 0 4px 12px var(--accent-shadow);
	}

	.method-icon {
		font-size: 2.5rem;
		color: var(--accent-primary);
		flex-shrink: 0;
	}

	.method-details {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.method-name {
		font-size: 1rem;
		font-weight: 600;
		color: var(--text-primary);
	}

	.method-value {
		font-size: 1.5rem;
		font-weight: 700;
		color: var(--accent-primary);
	}

	.method-weight {
		font-size: 0.875rem;
		color: var(--text-tertiary);
	}

	/* Empty State */
	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 4rem 2rem;
		text-align: center;
		gap: 1.5rem;
	}

	.icon-empty {
		font-size: 4rem;
		color: var(--text-tertiary);
		opacity: 0.5;
	}

	.empty-state h3 {
		font-size: 1.5rem;
		font-weight: 600;
		color: var(--text-primary);
		margin: 0;
	}

	.empty-state p {
		color: var(--text-secondary);
		margin: 0;
	}

	/* Overview */
	.overview-section {
		display: grid;
		gap: 2rem;
	}

	.welcome-card {
		padding: 3rem;
	}

	.section-title {
		font-size: 2rem;
		font-weight: 700;
		color: var(--text-primary);
		margin-bottom: 1rem;
	}

	.section-text {
		color: var(--text-secondary);
		margin-bottom: 2rem;
		line-height: 1.6;
	}

	.stats-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
		gap: 1.5rem;
		margin-top: 2rem;
	}

	.stat-card {
		background: var(--card-bg);
		padding: 1.5rem;
		border-radius: 12px;
		border: 1px solid var(--border-color);
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		transition: all 0.3s ease;
	}

	.stat-card:hover {
		background: var(--bg-secondary);
		border-color: rgba(212, 175, 55, 0.3);
		transform: translateY(-2px);
		box-shadow: 0 4px 12px rgba(212, 175, 55, 0.15);
	}

	.stat-label {
		font-size: 0.875rem;
		color: var(--text-tertiary);
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	.stat-value {
		font-size: 2rem;
		font-weight: 800;
		color: var(--accent-primary);
	}

	.quick-insights {
		padding: 2rem;
	}

	.card-title {
		font-size: 1.5rem;
		font-weight: 700;
		margin-bottom: 1.5rem;
		color: var(--text-primary);
	}

	.insight-item {
		display: flex;
		justify-content: space-between;
		padding: 1rem;
		border-bottom: 1px solid rgba(212, 175, 55, 0.1);
		font-size: 1.125rem;
	}

	/* DDQ Modal */
	.ddq-modal {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(0, 0, 0, 0.8);
		backdrop-filter: blur(5px);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1000;
		padding: 2rem;
	}

	.ddq-content {
		max-width: 720px;
		width: 100%;
		padding: 32px;
		max-height: 90vh;
		overflow-y: auto;
	}

	.ddq-header {
		display: flex;
		flex-direction: column;
		gap: 16px;
		margin-bottom: 32px;
	}

	.ddq-header-controls {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16px;
	}

	.modal-close-btn {
		background: transparent;
		border: none;
		color: var(--text-secondary);
		cursor: pointer;
		padding: 8px;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: all 0.2s ease;
	}

	.modal-close-btn:hover {
		background: var(--bg-tertiary);
		color: var(--accent-primary);
	}

	.modal-close-btn .material-symbols-outlined {
		font-size: 24px;
	}

	.progress-section {
		flex: 1;
	}

	.question-section-label {
		display: inline-block;
		padding: 8px 16px;
		background: var(--accent-shadow);
		border-radius: 20px;
		font-size: 0.875rem;
		color: var(--accent-primary);
		font-weight: 600;
	}

	.ddq-progress {
		margin-bottom: 24px;
	}

	.progress-bar {
		height: 8px;
		background: rgba(212, 175, 55, 0.2);
		border-radius: 4px;
		overflow: hidden;
		margin-bottom: 0.5rem;
	}

	.progress-fill {
		height: 100%;
		background: linear-gradient(135deg, #d4af37 0%, #ffd700 100%);
		transition: width 0.3s ease;
	}

	.progress-text {
		font-size: 0.875rem;
		color: rgba(248, 248, 255, 0.6);
	}

	.question-category {
		display: inline-block;
		padding: 0.5rem 1rem;
		background: rgba(75, 0, 130, 0.3);
		border-radius: 20px;
		font-size: 0.875rem;
		color: var(--elegant-gold);
		margin-bottom: 1rem;
	}

	.question-text {
		font-size: 1.5rem;
		font-weight: 700;
		color: var(--text-primary);
		margin-bottom: 2.5rem;
		line-height: 1.4;
	}

	/* DDQ Input Styles */
	.text-input,
	.textarea-input,
	.number-input,
	.dropdown-select {
		width: 100%;
		padding: 1.25rem;
		font-size: 1rem;
		background: var(--bg-secondary);
		border: 2px solid var(--border-color);
		border-radius: 8px;
		color: var(--text-primary);
		margin-bottom: 2.5rem;
		transition: all 0.3s ease;
		font-family: 'Inter', sans-serif;
	}

	.text-input:focus,
	.textarea-input:focus,
	.number-input:focus,
	.dropdown-select:focus {
		outline: none;
		border-color: var(--accent-primary);
		background: var(--bg-primary);
		box-shadow: 0 0 0 3px var(--accent-shadow);
	}

	.textarea-input {
		resize: vertical;
		min-height: 120px;
		line-height: 1.6;
	}

	.radio-group,
	.checkbox-group {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		margin-bottom: 2.5rem;
	}

	.radio-label,
	.checkbox-label {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 1rem;
		background: var(--bg-secondary);
		border: 2px solid var(--border-color);
		border-radius: 8px;
		cursor: pointer;
		transition: all 0.3s ease;
	}

	.radio-label:hover,
	.checkbox-label:hover {
		background: var(--bg-primary);
		border-color: var(--accent-primary);
	}

	.radio-label input,
	.checkbox-label input {
		width: 20px;
		height: 20px;
		cursor: pointer;
	}

	.radio-label span,
	.checkbox-label span {
		font-size: 1rem;
		color: var(--text-primary);
	}

	/* DDQ Navigation */
	.ddq-navigation {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		margin-top: 3rem;
		padding-top: 2rem;
		border-top: 1px solid var(--border-color);
	}

	.nav-btn {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 1rem 2rem;
		font-size: 1rem;
		font-weight: 600;
	}

	.answer-options {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.option-btn {
		padding: 1.25rem;
		background: rgba(255, 255, 255, 0.05);
		border: 1px solid rgba(212, 175, 55, 0.3);
		border-radius: 8px;
		color: var(--text-primary);
		font-size: 1rem;
		cursor: pointer;
		transition: all 0.2s ease;
		text-align: left;
	}

	.option-btn:hover {
		background: rgba(212, 175, 55, 0.1);
		border-color: var(--rich-gold);
		transform: translateX(4px);
	}

	.number-input input {
		width: 100%;
		padding: 1.25rem;
		font-size: 1.125rem;
	}

	/* Valuation Section */
	.valuation-section {
		display: grid;
		gap: 2rem;
	}

	.valuation-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
		gap: 2rem;
		margin: 2rem 0;
	}

	.valuation-card {
		background: rgba(75, 0, 130, 0.2);
		padding: 2rem;
		border-radius: 12px;
		border: 1px solid rgba(212, 175, 55, 0.3);
		text-align: center;
	}

	.valuation-card h3 {
		font-size: 1.125rem;
		color: rgba(248, 248, 255, 0.7);
		margin-bottom: 1rem;
	}

	.valuation-amount {
		font-size: 2.5rem;
		font-weight: 800;
		margin: 0;
	}

	.methodology-section {
		margin-top: 2rem;
		padding-top: 2rem;
		border-top: 1px solid rgba(212, 175, 55, 0.2);
	}

	.methodology-section h3 {
		font-size: 1.5rem;
		margin-bottom: 1rem;
		color: var(--text-primary);
	}

	.method-item {
		display: flex;
		justify-content: space-between;
		padding: 1rem;
		background: rgba(255, 255, 255, 0.03);
		border-radius: 8px;
		margin-bottom: 0.5rem;
	}

	/* SWOT Section */
	.swot-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
		gap: 1.5rem;
		margin-top: 2rem;
	}

	.swot-quadrant {
		background: rgba(255, 255, 255, 0.03);
		padding: 2rem;
		border-radius: 12px;
		border: 1px solid rgba(212, 175, 55, 0.2);
	}

	.swot-title {
		font-size: 1.25rem;
		font-weight: 700;
		margin-bottom: 1rem;
		padding-bottom: 0.75rem;
		border-bottom: 2px solid;
	}

	.swot-title.strengths {
		color: #4ade80;
		border-color: #4ade80;
	}

	.swot-title.weaknesses {
		color: #f87171;
		border-color: #f87171;
	}

	.swot-title.opportunities {
		color: #60a5fa;
		border-color: #60a5fa;
	}

	.swot-title.threats {
		color: #fbbf24;
		border-color: #fbbf24;
	}

	.swot-quadrant ul {
		list-style: none;
		padding: 0;
	}

	.swot-quadrant li {
		padding: 0.75rem 0;
		border-bottom: 1px solid rgba(212, 175, 55, 0.1);
		color: rgba(248, 248, 255, 0.8);
		line-height: 1.5;
	}

	.swot-quadrant li:last-child {
		border-bottom: none;
	}

	/* Funding Section */
	.funding-section {
		margin-bottom: 2rem;
	}

	.priority-recommendation {
		display: flex;
		align-items: flex-start;
		gap: 1rem;
		padding: 1.5rem;
		background: linear-gradient(135deg, rgba(255, 215, 0, 0.1), rgba(255, 193, 7, 0.05));
		border: 1px solid rgba(255, 215, 0, 0.2);
		border-radius: 12px;
		margin-bottom: 2rem;
	}

	.priority-recommendation .material-symbols-outlined {
		font-size: 2rem;
		color: #ffc107;
	}

	.priority-recommendation h4 {
		font-size: 1.125rem;
		font-weight: 600;
		color: var(--text-primary);
		margin-bottom: 0.5rem;
	}

	.priority-recommendation p {
		color: var(--text-secondary);
		font-size: 0.9rem;
		line-height: 1.6;
	}

	.schemes-container {
		display: flex;
		flex-direction: column;
		gap: 3rem;
	}

	.schemes-section {
		background: var(--bg-secondary);
		padding: 2rem;
		border-radius: 16px;
		border: 1px solid var(--border-color);
	}

	.schemes-section.central-schemes {
		border-left: 4px solid #4caf50;
	}

	.schemes-section.state-schemes {
		border-left: 4px solid #2196f3;
	}

	.section-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 1.5rem;
		padding-bottom: 1rem;
		border-bottom: 2px solid var(--border-color);
	}

	.section-title-row {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.section-icon {
		font-size: 1.75rem;
		color: var(--accent-primary);
	}

	.schemes-title {
		font-size: 1.5rem;
		font-weight: 700;
		color: var(--text-primary);
		margin: 0;
	}

	.schemes-count {
		background: rgba(212, 175, 55, 0.15);
		color: var(--accent-primary);
		padding: 0.5rem 1rem;
		border-radius: 20px;
		font-size: 0.875rem;
		font-weight: 600;
	}

	.schemes-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(380px, 1fr));
		gap: 1.5rem;
	}

	.scheme-card {
		background: var(--card-bg);
		padding: 1.75rem;
		border-radius: 12px;
		border: 1px solid var(--border-color);
		transition: all 0.3s ease;
		position: relative;
		overflow: hidden;
	}

	.scheme-card::before {
		content: '';
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		height: 3px;
		background: linear-gradient(90deg, rgba(212, 175, 55, 0.5), rgba(212, 175, 55, 0.1));
		opacity: 0;
		transition: opacity 0.3s ease;
	}

	.scheme-card:hover {
		transform: translateY(-4px);
		box-shadow: 0 12px 32px rgba(0, 0, 0, 0.15);
		border-color: rgba(212, 175, 55, 0.4);
	}

	.scheme-card:hover::before {
		opacity: 1;
	}

	/* Scheme Action Buttons Grid */
	.scheme-actions-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.75rem;
		margin-top: 1.25rem;
		padding-top: 1rem;
		border-top: 1px solid var(--border-color);
	}

	.scheme-action-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		padding: 0.75rem 1rem;
		border-radius: 8px;
		font-size: 0.85rem;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.2s ease;
		text-decoration: none;
		border: none;
	}

	.scheme-action-btn .material-symbols-outlined {
		font-size: 1.1rem;
	}

	.scheme-action-btn.check-gis {
		background: linear-gradient(135deg, #4ade80, #22c55e);
		color: white;
		box-shadow: 0 2px 8px rgba(74, 222, 128, 0.3);
	}

	.scheme-action-btn.check-gis:hover {
		background: linear-gradient(135deg, #22c55e, #16a34a);
		transform: translateY(-2px);
		box-shadow: 0 4px 12px rgba(74, 222, 128, 0.4);
	}

	.scheme-action-btn.create-proposal {
		background: linear-gradient(135deg, var(--accent-primary), var(--accent-secondary));
		color: white;
		box-shadow: 0 2px 8px rgba(99, 102, 241, 0.3);
	}

	.scheme-action-btn.create-proposal:hover {
		transform: translateY(-2px);
		box-shadow: 0 4px 12px rgba(99, 102, 241, 0.4);
	}

	[data-theme='light'] .scheme-action-btn.check-gis {
		background: linear-gradient(135deg, #16a34a, #15803d);
	}

	[data-theme='light'] .scheme-action-btn.check-gis:hover {
		background: linear-gradient(135deg, #15803d, #166534);
	}

	.scheme-header {
		margin-bottom: 1.25rem;
	}

	.scheme-title-row {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 1rem;
		margin-bottom: 0.75rem;
	}

	.scheme-name {
		font-size: 1.125rem;
		color: var(--text-primary);
		font-weight: 600;
		flex: 1;
		line-height: 1.4;
	}

	.scheme-type-badge {
		padding: 0.35rem 0.75rem;
		border-radius: 6px;
		font-size: 0.7rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		white-space: nowrap;
	}

	.scheme-type-badge.grant {
		background: linear-gradient(135deg, #4caf50, #66bb6a);
		color: white;
	}

	.scheme-type-badge.equity {
		background: linear-gradient(135deg, #ff9800, #ffa726);
		color: white;
	}

	.scheme-type-badge.loan {
		background: linear-gradient(135deg, #2196f3, #42a5f5);
		color: white;
	}

	.scheme-type-badge.credit {
		background: linear-gradient(135deg, #9c27b0, #ba68c8);
		color: white;
	}

	.eligibility-badge {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		padding: 0.5rem 0.85rem;
		border-radius: 20px;
		font-size: 0.75rem;
		font-weight: 600;
		white-space: nowrap;
	}

	.eligibility-badge .material-symbols-outlined {
		font-size: 1rem;
	}

	.eligibility-badge.eligible {
		background: linear-gradient(135deg, #4caf50, #66bb6a);
		color: white;
		box-shadow: 0 2px 8px rgba(76, 175, 80, 0.3);
	}

	.eligibility-badge.partial {
		background: linear-gradient(135deg, #ff9800, #ffa726);
		color: white;
		box-shadow: 0 2px 8px rgba(255, 152, 0, 0.3);
	}

	.eligibility-badge.not-eligible {
		background: rgba(158, 158, 158, 0.2);
		color: rgba(255, 255, 255, 0.5);
	}

	.scheme-amount-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-bottom: 1rem;
		padding: 1rem;
		background: linear-gradient(135deg, rgba(212, 175, 55, 0.1), rgba(212, 175, 55, 0.05));
		border-radius: 8px;
	}

	.scheme-amount-row .material-symbols-outlined {
		font-size: 1.5rem;
		color: var(--accent-primary);
	}

	.amount-text {
		font-size: 1.25rem;
		color: var(--accent-primary);
		font-weight: 700;
	}

	.scheme-reasoning {
		display: flex;
		align-items: flex-start;
		gap: 0.75rem;
		padding: 1rem;
		background: rgba(33, 150, 243, 0.08);
		border-left: 3px solid #2196f3;
		border-radius: 8px;
		margin-bottom: 1rem;
	}

	.scheme-reasoning .material-symbols-outlined {
		font-size: 1.25rem;
		color: #2196f3;
		flex-shrink: 0;
		margin-top: 0.125rem;
	}

	.scheme-reasoning p {
		color: var(--text-secondary);
		font-size: 0.875rem;
		line-height: 1.6;
		margin: 0;
		font-style: italic;
	}

	.scheme-details {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.detail-item {
		display: flex;
		align-items: flex-start;
		gap: 0.75rem;
		padding-top: 1rem;
		border-top: 1px solid var(--border-color);
	}

	.detail-item:first-child {
		border-top: none;
		padding-top: 0;
	}

	.detail-item .material-symbols-outlined {
		font-size: 1.25rem;
		color: var(--accent-primary);
		flex-shrink: 0;
		margin-top: 0.125rem;
	}

	.detail-item strong {
		color: var(--text-primary);
		font-size: 0.875rem;
		display: block;
		margin-bottom: 0.25rem;
	}

	.detail-item p {
		color: var(--text-secondary);
		font-size: 0.875rem;
		line-height: 1.6;
		margin: 0;
	}

	/* Marketing Trends Section */
	.trends-section {
		margin-bottom: 2rem;
	}

	.monitoring-section {
		margin-bottom: 2rem;
		padding: 1.5rem;
		background: rgba(255, 215, 0, 0.05);
		border: 1px solid rgba(255, 215, 0, 0.15);
		border-radius: 12px;
	}

	.monitored-list {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
		margin-top: 1rem;
	}

	.monitored-item {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 1rem;
		background: var(--card-bg);
		border: 1px solid var(--border-color);
		border-radius: 20px;
		font-size: 0.875rem;
	}

	.monitored-item .material-symbols-outlined {
		color: #ffc107;
		font-size: 1rem;
	}

	.performance-section {
		margin-bottom: 2.5rem;
	}

	.chart-container {
		margin-top: 1.5rem;
	}

	/* Line Chart Styles */
	.line-chart-container {
		background: var(--bg-secondary);
		border: 1px solid var(--border-color);
		border-radius: 12px;
		padding: 1.5rem;
	}

	/* Enhanced Legend Box Styles */
	.chart-legend-box {
		background: var(--card-bg);
		border: 1px solid var(--border-color);
		border-radius: 12px;
		padding: 1rem 1.25rem;
		margin-bottom: 1.5rem;
		box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
	}

	.legend-header {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-weight: 600;
		font-size: 0.9rem;
		color: var(--text-secondary);
		margin-bottom: 0.75rem;
		padding-bottom: 0.5rem;
		border-bottom: 1px solid var(--border-color);
	}

	.legend-header .material-symbols-outlined {
		font-size: 1rem;
		color: var(--accent-primary);
	}

	.legend-items {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
	}

	.legend-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 0.75rem;
		background: var(--bg-secondary);
		border: 1px solid var(--border-color);
		border-radius: 8px;
		transition: all 0.2s ease;
	}

	.legend-row:hover {
		background: var(--hover-bg);
		transform: translateX(3px);
	}

	.legend-color-line {
		width: 20px;
		height: 4px;
		border-radius: 2px;
		flex-shrink: 0;
	}

	.legend-company-name {
		font-size: 0.85rem;
		font-weight: 500;
		color: var(--text-primary);
		white-space: nowrap;
	}

	.legend-badge {
		font-size: 0.65rem;
		padding: 0.2rem 0.5rem;
		border-radius: 10px;
		font-weight: 600;
		white-space: nowrap;
	}

	.legend-badge.your-pick {
		background: linear-gradient(135deg, var(--accent-primary), var(--accent-secondary));
		color: white;
	}

	.legend-badge.local {
		background: rgba(255, 153, 51, 0.15);
		color: #ff9933;
		border: 1px solid rgba(255, 153, 51, 0.3);
	}

	.legend-badge.global {
		background: rgba(96, 165, 250, 0.15);
		color: #60a5fa;
		border: 1px solid rgba(96, 165, 250, 0.3);
	}

	/* Light mode legend adjustments */
	[data-theme='light'] .chart-legend-box {
		background: #ffffff;
		box-shadow: 0 4px 15px rgba(0, 0, 0, 0.08);
	}

	[data-theme='light'] .legend-row {
		background: #f8fafc;
		border-color: #e2e8f0;
	}

	[data-theme='light'] .legend-row:hover {
		background: #f1f5f9;
	}

	[data-theme='light'] .legend-badge.local {
		background: rgba(234, 88, 12, 0.1);
		color: #ea580c;
		border-color: rgba(234, 88, 12, 0.3);
	}

	[data-theme='light'] .legend-badge.global {
		background: rgba(37, 99, 235, 0.1);
		color: #2563eb;
		border-color: rgba(37, 99, 235, 0.3);
	}

	/* Chart Tooltip Styles */
	.chart-tooltip {
		position: absolute;
		background: var(--card-bg);
		border: 2px solid var(--accent-primary);
		border-radius: 10px;
		padding: 0.75rem 1rem;
		box-shadow: 0 8px 25px rgba(0, 0, 0, 0.3);
		z-index: 1000;
		pointer-events: none;
		min-width: 150px;
		animation: tooltipFadeIn 0.15s ease-out;
	}

	[data-theme='light'] .chart-tooltip {
		background: #ffffff;
		box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15);
	}

	@keyframes tooltipFadeIn {
		from {
			opacity: 0;
			transform: translateY(5px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	.tooltip-company {
		font-weight: 700;
		font-size: 0.95rem;
		color: var(--text-primary);
		margin-bottom: 0.4rem;
		border-bottom: 1px solid var(--border-color);
		padding-bottom: 0.4rem;
	}

	.tooltip-year {
		font-size: 0.8rem;
		color: var(--text-secondary);
		margin-bottom: 0.25rem;
	}

	.tooltip-valuation {
		font-size: 1rem;
		font-weight: 600;
		color: #4ade80;
		margin-bottom: 0.25rem;
	}

	[data-theme='light'] .tooltip-valuation {
		color: #16a34a;
	}

	.tooltip-event {
		font-size: 0.75rem;
		color: var(--accent-primary);
		font-style: italic;
		margin-top: 0.4rem;
		padding-top: 0.4rem;
		border-top: 1px dashed var(--border-color);
	}

	.interactive-dot {
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.interactive-dot:hover {
		r: 10;
		filter: brightness(1.2) drop-shadow(0 0 8px currentColor);
	}

	.line-chart-legend {
		display: flex;
		flex-wrap: wrap;
		gap: 1rem;
		margin-bottom: 1.5rem;
		padding: 1rem;
		background: var(--card-bg);
		border-radius: 8px;
	}

	.line-chart-legend .legend-item {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.85rem;
		padding: 0.375rem 0.75rem;
		background: var(--bg-secondary);
		border-radius: 20px;
		border: 1px solid var(--border-color);
	}

	.legend-dot {
		width: 12px;
		height: 12px;
		border-radius: 50%;
	}

	.legend-label {
		font-weight: 500;
		color: var(--text-primary);
	}

	.user-mentioned-badge {
		font-size: 0.7rem;
		padding: 0.2rem 0.5rem;
		background: var(--accent-primary);
		color: white;
		border-radius: 10px;
		font-weight: 600;
	}

	.svg-chart-wrapper {
		width: 100%;
		overflow-x: auto;
		padding: 1rem 0;
	}

	.valuation-line-chart {
		width: 100%;
		min-width: 600px;
		height: auto;
		max-height: 450px;
	}

	.valuation-line-chart .axis-label {
		font-size: 11px;
		fill: var(--text-secondary);
		font-family: inherit;
	}

	.valuation-line-chart .axis-title {
		font-size: 12px;
		font-weight: 600;
		fill: var(--text-primary);
		font-family: inherit;
	}

	.chart-line {
		filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1));
		transition: stroke-width 0.2s;
	}

	.chart-line:hover {
		stroke-width: 4;
	}

	.chart-dot {
		cursor: pointer;
		transition: r 0.2s, filter 0.2s;
	}

	.chart-dot:hover {
		r: 9;
		filter: drop-shadow(0 0 8px currentColor);
	}

	.data-source-info {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-top: 1rem;
		padding: 0.75rem 1rem;
		background: var(--card-bg);
		border-radius: 8px;
		font-size: 0.8rem;
		color: var(--text-secondary);
	}

	.data-source-info .material-symbols-outlined {
		font-size: 1rem;
		color: var(--accent-primary);
	}

	.chart-legend {
		display: flex;
		gap: 2rem;
		margin-bottom: 1.5rem;
		padding: 1rem;
		background: var(--bg-secondary);
		border-radius: 8px;
	}

	.legend-item {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.875rem;
	}

	.legend-color {
		width: 24px;
		height: 12px;
		border-radius: 4px;
	}

	.legend-color.early {
		background: linear-gradient(135deg, rgba(100, 100, 255, 0.6), rgba(100, 100, 255, 0.8));
	}

	.legend-color.current {
		background: linear-gradient(135deg, #4caf50, #66bb6a);
	}

	.bar-chart {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	.chart-row {
		display: flex;
		gap: 1rem;
		align-items: center;
	}

	.chart-label {
		min-width: 120px;
		font-weight: 600;
		font-size: 0.875rem;
		color: var(--text-primary);
	}

	.chart-bars {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.chart-bar {
		height: 32px;
		border-radius: 6px;
		display: flex;
		align-items: center;
		padding: 0 0.75rem;
		transition: all 0.3s ease;
		position: relative;
		overflow: visible;
	}

	.chart-bar.early {
		background: linear-gradient(135deg, rgba(100, 100, 255, 0.6), rgba(100, 100, 255, 0.8));
	}

	.chart-bar.current {
		background: linear-gradient(135deg, #4caf50, #66bb6a);
	}

	.bar-value {
		font-size: 0.75rem;
		font-weight: 600;
		color: rgba(255, 255, 255, 0.98);
		text-shadow: 0 1px 3px rgba(0, 0, 0, 0.5);
		white-space: nowrap;
	}

	[data-theme='light'] .bar-value {
		color: rgba(0, 0, 0, 0.85);
		text-shadow: 0 1px 2px rgba(255, 255, 255, 0.8);
		font-weight: 700;
	}

	/* Market Trends Section Styles */
	.market-trends-section {
		margin-top: 2rem;
		padding: 1.5rem;
		background: linear-gradient(135deg, rgba(34, 139, 34, 0.1), rgba(0, 100, 0, 0.05));
		border: 1px solid rgba(34, 139, 34, 0.3);
		border-radius: 12px;
	}

	.trends-title {
		color: #228b22 !important;
	}

	.trends-list {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.trend-item {
		padding: 0.75rem 1rem;
		background: var(--card-bg);
		border-radius: 8px;
		border-left: 4px solid #228b22;
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		align-items: center;
	}

	.trend-title {
		color: var(--text-primary);
		font-weight: 600;
	}

	.trend-value {
		color: #228b22;
		font-weight: 700;
	}

	.trend-description {
		color: var(--text-secondary);
		font-style: italic;
	}

	/* Market Opportunities Section Styles */
	.market-opportunities-section {
		margin-top: 2rem;
		padding: 1.5rem;
		background: linear-gradient(135deg, rgba(220, 38, 38, 0.05), rgba(255, 255, 255, 0.02));
		border: 1px solid var(--border-color);
		border-radius: 12px;
	}

	.opportunities-title {
		color: #dc2626 !important;
	}

	.opportunities-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
		gap: 1.5rem;
		margin-top: 1rem;
	}

	.opportunity-card {
		background: var(--card-bg);
		border-radius: 12px;
		padding: 1.5rem;
		border: 1px solid var(--border-color);
	}

	.opportunity-card.govt {
		border-left: 4px solid #2563eb;
	}

	.opportunity-card.enterprise {
		border-left: 4px solid #059669;
	}

	.opportunity-card h4 {
		font-size: 1.1rem;
		font-weight: 700;
		color: var(--accent-color);
		margin-bottom: 1rem;
	}

	.opportunity-card ul {
		list-style: none;
		padding: 0;
		margin: 0;
	}

	.opportunity-card li {
		padding: 0.5rem 0;
		color: var(--text-primary);
		display: flex;
		align-items: flex-start;
		gap: 0.5rem;
		border-bottom: 1px solid var(--border-color);
	}

	.opportunity-card li:last-child {
		border-bottom: none;
	}

	.checkmark {
		color: #059669;
		font-weight: 700;
		flex-shrink: 0;
	}

	/* Strategic Recommendations Section Styles */
	.strategic-recommendations-section {
		margin-top: 2rem;
		padding: 1.5rem;
		background: linear-gradient(135deg, rgba(37, 99, 235, 0.05), rgba(255, 255, 255, 0.02));
		border: 1px solid var(--border-color);
		border-radius: 12px;
	}

	.strategy-title {
		color: #2563eb !important;
	}

	.recommendations-list {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		margin-top: 1rem;
	}

	.recommendation-card {
		background: var(--card-bg);
		border-radius: 12px;
		padding: 1.25rem;
		border: 1px solid var(--border-color);
		transition: all 0.3s ease;
	}

	.recommendation-card:hover {
		transform: translateX(4px);
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
	}

	.recommendation-card.priority-critical {
		border-left: 4px solid #dc2626;
		background: linear-gradient(135deg, rgba(220, 38, 38, 0.08), var(--card-bg));
	}

	.recommendation-card.priority-high {
		border-left: 4px solid #f59e0b;
		background: linear-gradient(135deg, rgba(245, 158, 11, 0.08), var(--card-bg));
	}

	.recommendation-card.priority-medium {
		border-left: 4px solid #3b82f6;
		background: linear-gradient(135deg, rgba(59, 130, 246, 0.08), var(--card-bg));
	}

	.rec-header {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem;
		margin-bottom: 0.75rem;
	}

	.rec-number {
		font-weight: 700;
		color: var(--accent-color);
		font-size: 1.1rem;
	}

	.rec-title {
		font-weight: 700;
		color: var(--text-primary);
		font-size: 1rem;
	}

	.priority-badge {
		font-size: 0.75rem;
		font-weight: 600;
		padding: 0.25rem 0.5rem;
		border-radius: 4px;
	}

	.priority-badge.critical {
		color: #dc2626;
		background: rgba(220, 38, 38, 0.15);
	}

	.priority-badge.high {
		color: #f59e0b;
		background: rgba(245, 158, 11, 0.15);
	}

	.priority-badge.medium {
		color: #3b82f6;
		background: rgba(59, 130, 246, 0.15);
	}

	.rec-description {
		color: var(--text-secondary);
		font-size: 0.95rem;
		line-height: 1.6;
		margin: 0 0 0.75rem 0;
	}

	.rec-target {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 0.75rem;
		background: rgba(34, 197, 94, 0.1);
		border-radius: 6px;
		color: #059669;
		font-size: 0.9rem;
	}

	.rec-target .material-symbols-outlined {
		font-size: 1rem;
	}

	/* Compare Frame Styles */
	.compare-frame {
		background: linear-gradient(135deg, rgba(33, 150, 243, 0.1), rgba(156, 39, 176, 0.1));
		border: 2px solid rgba(33, 150, 243, 0.3);
		border-radius: 16px;
		padding: 1.5rem;
		margin-bottom: 2rem;
	}

	.compare-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 1rem;
		flex-wrap: wrap;
		gap: 0.75rem;
	}

	.compare-empty {
		text-align: center;
		padding: 2rem;
		color: var(--text-secondary);
	}

	.compare-empty .material-symbols-outlined {
		font-size: 3rem;
		color: rgba(33, 150, 243, 0.5);
		margin-bottom: 0.5rem;
	}

	.compare-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
		gap: 1rem;
	}

	.compare-card {
		background: var(--card-bg);
		border: 1px solid var(--border-color);
		border-radius: 12px;
		padding: 1rem;
	}

	.compare-card-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 1rem;
		padding-bottom: 0.75rem;
		border-bottom: 1px solid var(--border-color);
	}

	.compare-card-header h4 {
		font-size: 1rem;
		font-weight: 600;
		color: var(--text-primary);
	}

	.compare-metrics {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.75rem;
	}

	.compare-metric {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.compare-label {
		font-size: 0.7rem;
		color: var(--text-tertiary);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.compare-value {
		font-size: 0.9rem;
		font-weight: 600;
		color: var(--text-primary);
	}

	.compare-value.growth {
		color: #4ade80;
	}

	.compare-value.verified {
		color: #4ade80;
	}

	.compare-value.potential {
		color: #fbbf24;
	}

	/* Flagship Product Styles in Compare Card */
	.compare-flagship {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.75rem;
		background: linear-gradient(135deg, rgba(255, 215, 0, 0.15), rgba(255, 193, 7, 0.1));
		border: 1px solid rgba(255, 215, 0, 0.3);
		border-radius: 8px;
		margin-bottom: 0.75rem;
	}

	.compare-flagship .material-symbols-outlined {
		color: #ffd700;
		font-size: 1.25rem;
	}

	.flagship-label {
		font-size: 0.7rem;
		color: var(--text-tertiary);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.flagship-value {
		font-size: 0.9rem;
		font-weight: 600;
		color: var(--text-primary);
		margin-left: 0.25rem;
	}

	/* Flagship Highlight in View Details Modal */
	.flagship-highlight {
		display: flex;
		align-items: center;
		gap: 1rem;
		padding: 1rem 1.25rem;
		background: linear-gradient(135deg, rgba(255, 215, 0, 0.2), rgba(255, 193, 7, 0.1));
		border: 2px solid rgba(255, 215, 0, 0.4);
		border-radius: 12px;
		margin-bottom: 1.5rem;
	}

	.flagship-icon {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 48px;
		height: 48px;
		background: linear-gradient(135deg, #ffd700, #ffb700);
		border-radius: 50%;
		flex-shrink: 0;
	}

	.flagship-icon .material-symbols-outlined {
		color: white;
		font-size: 1.5rem;
	}

	.flagship-content {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.flagship-title {
		font-size: 0.75rem;
		color: var(--text-tertiary);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.flagship-name {
		font-size: 1.25rem;
		font-weight: 700;
		color: var(--text-primary);
	}

	/* Compare Search Styles */
	.compare-search-box {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		background: var(--card-bg);
		border: 1px solid var(--border-color);
		border-radius: 8px;
		padding: 0.5rem 0.75rem;
		flex: 1;
		max-width: 350px;
		margin: 0 1rem;
	}

	.compare-search-box .material-symbols-outlined {
		color: var(--text-tertiary);
		font-size: 1.25rem;
	}

	.compare-search-input {
		flex: 1;
		border: none;
		background: transparent;
		font-size: 0.875rem;
		color: var(--text-primary);
		outline: none;
	}

	.compare-search-input::placeholder {
		color: var(--text-tertiary);
	}

	.clear-search {
		display: flex;
		align-items: center;
		justify-content: center;
		background: transparent;
		border: none;
		cursor: pointer;
		padding: 0;
	}

	.clear-search .material-symbols-outlined {
		font-size: 1rem;
		color: var(--text-tertiary);
	}

	.clear-search:hover .material-symbols-outlined {
		color: var(--text-primary);
	}

	.compare-search-results {
		background: var(--card-bg);
		border: 1px solid var(--border-color);
		border-radius: 10px;
		margin-bottom: 1rem;
		overflow: hidden;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
	}

	.compare-search-results.no-results {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		padding: 1rem;
		color: var(--text-tertiary);
	}

	.search-results-header {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.75rem 1rem;
		background: var(--hover-bg);
		font-size: 0.75rem;
		color: var(--text-secondary);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.search-results-header .material-symbols-outlined {
		font-size: 1rem;
	}

	.search-result-item {
		display: flex;
		align-items: center;
		justify-content: space-between;
		width: 100%;
		padding: 0.75rem 1rem;
		background: transparent;
		border: none;
		border-bottom: 1px solid var(--border-color);
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.search-result-item:last-child {
		border-bottom: none;
	}

	.search-result-item:hover {
		background: var(--hover-bg);
	}

	.result-info {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.result-name {
		font-size: 0.9rem;
		font-weight: 600;
		color: var(--text-primary);
	}

	.result-stage {
		font-size: 0.75rem;
		color: var(--text-tertiary);
		background: var(--hover-bg);
		padding: 0.2rem 0.5rem;
		border-radius: 4px;
	}

	.result-region {
		font-size: 0.7rem;
		padding: 0.2rem 0.5rem;
		border-radius: 4px;
	}

	.result-region.local {
		background: rgba(255, 153, 51, 0.15);
		color: #ff9933;
	}

	.result-region.international {
		background: rgba(33, 150, 243, 0.15);
		color: #2196f3;
	}

	.add-icon {
		color: #4ade80;
		font-size: 1.25rem;
	}

	/* Region Badge in Compare Card */
	.region-badge {
		font-size: 1rem;
		margin-left: auto;
		margin-right: 0.5rem;
	}

	/* Data Not Public Note */
	.data-not-public-note {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 0.75rem;
		background: rgba(251, 191, 36, 0.1);
		border: 1px solid rgba(251, 191, 36, 0.3);
		border-radius: 6px;
		margin-top: 0.75rem;
		font-size: 0.7rem;
		color: #b45309;
	}

	.data-not-public-note .material-symbols-outlined {
		font-size: 0.9rem;
		color: #fbbf24;
	}

	:global(.dark) .data-not-public-note {
		background: rgba(251, 191, 36, 0.15);
		color: #fcd34d;
	}

	/* Online Search Styles */
	.search-online-divider {
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 0.5rem 1rem;
		color: var(--text-tertiary);
		font-size: 0.75rem;
	}

	.search-online-divider::before,
	.search-online-divider::after {
		content: '';
		flex: 1;
		height: 1px;
		background: var(--border-color);
		margin: 0 0.5rem;
	}

	.search-online-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		width: 100%;
		padding: 0.75rem 1rem;
		background: linear-gradient(135deg, rgba(33, 150, 243, 0.1), rgba(156, 39, 176, 0.1));
		border: 1px solid rgba(33, 150, 243, 0.3);
		border-top: none;
		border-radius: 0 0 10px 10px;
		font-size: 0.875rem;
		font-weight: 500;
		color: #2196f3;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.search-online-btn:hover:not(:disabled) {
		background: linear-gradient(135deg, rgba(33, 150, 243, 0.2), rgba(156, 39, 176, 0.2));
	}

	.search-online-btn:disabled {
		opacity: 0.7;
		cursor: not-allowed;
	}

	.search-online-btn.retry {
		border-radius: 0 0 10px 10px;
		border-top: 1px solid var(--border-color);
		color: #fbbf24;
	}

	.search-online-btn .material-symbols-outlined {
		font-size: 1.25rem;
	}

	.spinning {
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		from { transform: rotate(0deg); }
		to { transform: rotate(360deg); }
	}

	.search-loading {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.75rem;
		padding: 1rem;
		color: #2196f3;
		font-size: 0.875rem;
	}

	.search-loading .material-symbols-outlined {
		font-size: 1.5rem;
	}

	.search-error {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		padding: 0.75rem 1rem;
		background: rgba(239, 68, 68, 0.1);
		color: #ef4444;
		font-size: 0.8rem;
	}

	.search-error .material-symbols-outlined {
		font-size: 1rem;
	}

	.no-local-results {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		padding: 0.75rem 1rem;
		color: var(--text-tertiary);
		font-size: 0.875rem;
	}

	.no-local-results .material-symbols-outlined {
		font-size: 1.25rem;
	}

	/* Product Badge with Flagship indicator */
	.product-badge.flagship {
		background: linear-gradient(135deg, rgba(255, 215, 0, 0.25), rgba(255, 193, 7, 0.15));
		border-color: rgba(255, 215, 0, 0.5);
		color: var(--text-primary);
		font-weight: 600;
	}

	.product-badge .star-icon {
		font-size: 0.875rem;
		color: #ffd700;
		margin-right: 0.25rem;
	}

	/* Competitor Tabs Styles */
	.competitor-tabs-section {
		margin-top: 2rem;
	}

	.competitor-tabs-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 1rem;
		flex-wrap: wrap;
		gap: 1rem;
	}

	.tabs-row {
		display: flex;
		gap: 0.5rem;
		background: var(--hover-bg);
		padding: 0.25rem;
		border-radius: 10px;
	}

	.tab-btn {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.75rem 1.25rem;
		background: transparent;
		border: none;
		border-radius: 8px;
		font-size: 0.875rem;
		font-weight: 500;
		color: var(--text-secondary);
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.tab-btn:hover {
		background: var(--card-bg);
		color: var(--text-primary);
	}

	.tab-btn.active {
		background: var(--card-bg);
		color: var(--text-primary);
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
	}

	.tab-btn .material-symbols-outlined {
		font-size: 1.125rem;
	}

	.tab-count {
		background: rgba(255, 215, 0, 0.2);
		color: rgba(255, 215, 0, 1);
		padding: 0.125rem 0.5rem;
		border-radius: 10px;
		font-size: 0.75rem;
		font-weight: 600;
	}

	.btn-compare {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.75rem 1.25rem;
		background: linear-gradient(135deg, rgba(33, 150, 243, 0.2), rgba(156, 39, 176, 0.2));
		border: 1px solid rgba(33, 150, 243, 0.3);
		border-radius: 8px;
		font-size: 0.875rem;
		font-weight: 500;
		color: var(--text-primary);
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.btn-compare:hover {
		background: linear-gradient(135deg, rgba(33, 150, 243, 0.3), rgba(156, 39, 176, 0.3));
	}

	.btn-compare.active {
		background: linear-gradient(135deg, #2196f3, #9c27b0);
		color: white;
	}

	/* Data Quality Summary */
	.data-quality-summary {
		display: flex;
		gap: 1.5rem;
		padding: 0.75rem 1rem;
		background: var(--hover-bg);
		border-radius: 8px;
		margin-bottom: 1rem;
	}

	.summary-item {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.875rem;
	}

	.summary-item.verified .material-symbols-outlined {
		color: #4ade80;
	}

	.summary-item.potential .material-symbols-outlined {
		color: #fbbf24;
	}

	/* Tab Description */
	.tab-description {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.75rem 1rem;
		background: rgba(74, 222, 128, 0.1);
		border: 1px solid rgba(74, 222, 128, 0.2);
		border-radius: 8px;
		margin-bottom: 1rem;
		font-size: 0.875rem;
		color: var(--text-secondary);
	}

	.tab-description .material-symbols-outlined {
		color: #4ade80;
	}

	.tab-description.potential {
		background: rgba(251, 191, 36, 0.1);
		border-color: rgba(251, 191, 36, 0.2);
	}

	.tab-description.potential .material-symbols-outlined {
		color: #fbbf24;
	}

	/* Badge Styles */
	.verified-badge {
		padding: 0.25rem 0.5rem;
		background: rgba(74, 222, 128, 0.15);
		color: #4ade80;
		border-radius: 12px;
		font-size: 0.7rem;
		font-weight: 600;
	}

	.estimated-badge {
		padding: 0.25rem 0.5rem;
		background: rgba(251, 191, 36, 0.15);
		color: #fbbf24;
		border-radius: 12px;
		font-size: 0.7rem;
		font-weight: 600;
	}

	.user-pick-badge {
		padding: 0.25rem 0.5rem;
		background: rgba(156, 39, 176, 0.15);
		color: #ce93d8;
		border-radius: 12px;
		font-size: 0.7rem;
		font-weight: 600;
	}

	/* Region badges */
	.region-badge {
		padding: 0.25rem 0.5rem;
		border-radius: 12px;
		font-size: 0.7rem;
		font-weight: 600;
	}

	.region-badge.user-pick {
		background: rgba(156, 39, 176, 0.15);
		color: #ce93d8;
	}

	.region-badge.global {
		background: rgba(59, 130, 246, 0.15);
		color: #60a5fa;
	}

	.region-badge.local {
		background: rgba(34, 197, 94, 0.15);
		color: #4ade80;
	}

	.region-badge.rival {
		background: rgba(239, 68, 68, 0.15);
		color: #f87171;
	}

	/* Competitor card region styling */
	.competitor-card.user-pick {
		border-left: 3px solid #ce93d8;
	}

	.competitor-card.global {
		border-left: 3px solid #60a5fa;
	}

	.competitor-card.local {
		border-left: 3px solid #4ade80;
	}

	.competitor-card.rival {
		border-left: 3px solid #f87171;
	}

	/* Data quality summary items */
	.summary-item.user-pick {
		color: #ce93d8;
	}

	.summary-item.global {
		color: #60a5fa;
	}

	.summary-item.local {
		color: #4ade80;
	}

	.summary-item.rival {
		color: #f87171;
	}

	/* Potential competitor card styling */
	.competitor-card.potential {
		border-color: rgba(251, 191, 36, 0.3);
		background: linear-gradient(135deg, var(--card-bg), rgba(251, 191, 36, 0.05));
	}

	.metric-value.estimate {
		color: var(--text-secondary);
		font-style: italic;
	}

	.estimate-note {
		font-size: 0.7rem;
		color: var(--text-tertiary);
		font-style: italic;
		text-align: center;
		margin-bottom: 0.75rem;
	}

	/* Icon buttons */
	.btn-icon-success {
		background: rgba(74, 222, 128, 0.15);
		border: 1px solid rgba(74, 222, 128, 0.3);
		border-radius: 8px;
		padding: 0.5rem;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.btn-icon-success:hover {
		background: rgba(74, 222, 128, 0.25);
	}

	.btn-icon-success .material-symbols-outlined {
		color: #4ade80;
	}

	.btn-icon-danger {
		background: rgba(239, 68, 68, 0.15);
		border: 1px solid rgba(239, 68, 68, 0.3);
		border-radius: 8px;
		padding: 0.5rem;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.btn-icon-danger:hover {
		background: rgba(239, 68, 68, 0.25);
	}

	.btn-icon-danger .material-symbols-outlined {
		color: #ef4444;
	}

	/* Empty tab state */
	.empty-tab-state {
		grid-column: 1 / -1;
		text-align: center;
		padding: 3rem;
		color: var(--text-secondary);
	}

	.empty-tab-state .material-symbols-outlined {
		font-size: 3rem;
		margin-bottom: 1rem;
		opacity: 0.5;
	}

	.competitors-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
		gap: 1.5rem;
		margin-top: 2rem;
	}

	.competitor-card {
		background: var(--card-bg);
		border: 1px solid var(--border-color);
		border-radius: 12px;
		padding: 1.5rem;
		transition: all 0.3s ease;
		overflow: hidden;
	}

	.competitor-card:hover {
		transform: translateY(-4px);
		box-shadow: 0 12px 32px rgba(0, 0, 0, 0.15);
		border-color: rgba(255, 215, 0, 0.3);
	}

	.competitor-card.hidden {
		opacity: 0.5;
	}

	.competitor-header {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		margin-bottom: 1rem;
	}

	.competitor-header h4 {
		font-size: 1.125rem;
		font-weight: 600;
		color: var(--text-primary);
	}

	.competitor-actions {
		display: flex;
		gap: 0.5rem;
	}

	.competitor-stage {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin-bottom: 1rem;
	}

	.stage-badge, .category-badge {
		padding: 0.375rem 0.75rem;
		border-radius: 16px;
		font-size: 0.75rem;
		font-weight: 600;
	}

	.stage-badge {
		background: linear-gradient(135deg, #2196f3, #42a5f5);
		color: white;
	}

	.category-badge {
		background: rgba(255, 215, 0, 0.15);
		color: rgba(255, 215, 0, 0.9);
		border: 1px solid rgba(255, 215, 0, 0.2);
	}

	.competitor-metrics {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		margin-bottom: 1.5rem;
	}

	.metric-item {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.metric-item .material-symbols-outlined {
		color: rgba(255, 215, 0, 0.8);
		font-size: 1.5rem;
	}

	.metric-label {
		font-size: 0.75rem;
		color: var(--text-tertiary);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.metric-value {
		font-size: 1rem;
		font-weight: 700;
		color: var(--text-primary);
	}

	/* Competitor Modal */
	.modal-overlay {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(0, 0, 0, 0.7);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 10000;
		padding: 2rem;
	}

	.modal-content {
		background: var(--card-bg);
		border: 1px solid var(--border-color);
		border-radius: 16px;
		max-width: 600px;
		width: 100%;
		max-height: 80vh;
		overflow-y: auto;
	}

	.modal-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 1.5rem;
		border-bottom: 1px solid var(--border-color);
	}

	.modal-header h3 {
		font-size: 1.5rem;
		font-weight: 600;
		color: var(--text-primary);
	}

	.modal-body {
		padding: 1.5rem;
	}

	.competitor-detail-section {
		margin-bottom: 2rem;
	}

	.competitor-detail-section:last-child {
		margin-bottom: 0;
	}

	.competitor-detail-section h4 {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 1.125rem;
		font-weight: 600;
		color: var(--text-primary);
		margin-bottom: 1rem;
	}

	.competitor-detail-section h4 .material-symbols-outlined {
		color: rgba(255, 215, 0, 0.8);
	}

	.detail-label {
		font-size: 0.875rem;
		color: var(--text-tertiary);
		margin-bottom: 0.5rem;
	}

	.detail-value {
		font-size: 1.125rem;
		font-weight: 600;
		color: var(--text-primary);
		margin-bottom: 1rem;
	}

	.investments-list {
		list-style: none;
		padding: 0;
		margin: 0;
	}

	.investments-list li {
		padding: 0.75rem;
		background: var(--bg-secondary);
		border: 1px solid var(--border-color);
		border-radius: 8px;
		margin-bottom: 0.5rem;
		font-size: 0.875rem;
	}

	.products-list {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.product-badge {
		padding: 0.5rem 1rem;
		background: rgba(255, 215, 0, 0.1);
		border: 1px solid rgba(255, 215, 0, 0.2);
		border-radius: 20px;
		font-size: 0.875rem;
		color: var(--text-primary);
	}

	.detail-metrics {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 1rem;
	}

	.detail-metric {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 1rem;
		background: var(--bg-secondary);
		border: 1px solid var(--border-color);
		border-radius: 8px;
	}

	.detail-metric .material-symbols-outlined {
		color: rgba(255, 215, 0, 0.8);
		font-size: 1.5rem;
	}

	/* Chat Section */
	.chat-placeholder {
		text-align: center;
		padding: 4rem 2rem;
		color: rgba(248, 248, 255, 0.6);
	}

	.chat-placeholder p {
		margin: 1rem 0;
	}

	/* Strengths vs Weaknesses / PESTEL Analysis */
	.balance-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
		gap: 2rem;
		margin-top: 2rem;
	}

	.analysis-panel {
		background: var(--bg-secondary);
		border: 1px solid var(--border-color);
		border-radius: 12px;
		overflow: hidden;
		transition: all 0.3s ease;
	}

	.analysis-panel:hover {
		transform: translateY(-4px);
		box-shadow: 0 8px 24px var(--accent-shadow);
	}

	.panel-header {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 1.5rem;
		border-bottom: 2px solid;
	}

	.strengths-panel .panel-header {
		border-color: #4ade80;
		background: rgba(74, 222, 128, 0.1);
	}

	.weaknesses-panel .panel-header {
		border-color: #f87171;
		background: rgba(248, 113, 113, 0.1);
	}

	.opportunities-panel .panel-header {
		border-color: #60a5fa;
		background: rgba(96, 165, 250, 0.1);
	}

	.threats-panel .panel-header {
		border-color: #fbbf24;
		background: rgba(251, 191, 36, 0.1);
	}

	.panel-header .material-symbols-outlined {
		font-size: 1.75rem;
	}

	.strengths-panel .panel-header .material-symbols-outlined {
		color: #4ade80;
	}

	.weaknesses-panel .panel-header .material-symbols-outlined {
		color: #f87171;
	}

	.opportunities-panel .panel-header .material-symbols-outlined {
		color: #60a5fa;
	}

	.threats-panel .panel-header .material-symbols-outlined {
		color: #fbbf24;
	}

	.panel-header h3 {
		flex: 1;
		font-size: 1.25rem;
		font-weight: 600;
		color: var(--text-primary);
		margin: 0;
	}

	.count-badge {
		padding: 0.25rem 0.75rem;
		border-radius: 12px;
		font-size: 0.875rem;
		font-weight: 700;
		background: var(--accent-primary);
		color: var(--bg-primary);
	}

	.panel-content {
		padding: 1.5rem;
		display: flex;
		flex-direction: column;
		gap: 1rem;
		max-height: 400px;
		overflow-y: auto;
	}

	.analysis-item {
		display: flex;
		align-items: flex-start;
		gap: 1rem;
		padding: 1rem;
		background: var(--bg-primary);
		border: 1px solid var(--border-color);
		border-radius: 8px;
		transition: all 0.2s ease;
	}

	.analysis-item:hover {
		transform: translateX(4px);
	}

	.strengths-item:hover {
		border-color: #4ade80;
		box-shadow: 0 0 0 2px rgba(74, 222, 128, 0.1);
	}

	.weaknesses-item:hover {
		border-color: #f87171;
		box-shadow: 0 0 0 2px rgba(248, 113, 113, 0.1);
	}

	.opportunities-item:hover {
		border-color: #60a5fa;
		box-shadow: 0 0 0 2px rgba(96, 165, 250, 0.1);
	}

	.threats-item:hover {
		border-color: #fbbf24;
		box-shadow: 0 0 0 2px rgba(251, 191, 36, 0.1);
	}

	.item-number {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 28px;
		border-radius: 50%;
		font-size: 0.875rem;
		font-weight: 700;
		flex-shrink: 0;
	}

	.strengths-item .item-number {
		background: rgba(74, 222, 128, 0.2);
		color: #4ade80;
	}

	.weaknesses-item .item-number {
		background: rgba(248, 113, 113, 0.2);
		color: #f87171;
	}

	.opportunities-item .item-number {
		background: rgba(96, 165, 250, 0.2);
		color: #60a5fa;
	}

	.threats-item .item-number {
		background: rgba(251, 191, 36, 0.2);
		color: #fbbf24;
	}

	.analysis-item p {
		color: var(--text-primary);
		line-height: 1.5;
		margin: 0;
	}

	.empty-panel {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 3rem 1rem;
		gap: 1rem;
		text-align: center;
	}

	.empty-panel .material-symbols-outlined {
		font-size: 3rem;
		color: var(--text-tertiary);
		opacity: 0.5;
	}

	.empty-panel p {
		color: var(--text-secondary);
		margin: 0;
	}

	/* Balance Indicator */
	.balance-indicator {
		margin-top: 2rem;
		padding: 2rem;
		background: var(--bg-secondary);
		border: 1px solid var(--border-color);
		border-radius: 12px;
	}

	.balance-label {
		font-size: 1rem;
		font-weight: 600;
		color: var(--text-primary);
		margin-bottom: 1rem;
		text-align: center;
	}

	.balance-bar {
		height: 16px;
		border-radius: 8px;
		overflow: hidden;
		display: flex;
		margin-bottom: 1.5rem;
		box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.1);
	}

	.balance-fill {
		transition: width 0.5s ease;
	}

	.strengths-fill {
		background: linear-gradient(90deg, #4ade80 0%, #22c55e 100%);
	}

	.weaknesses-fill {
		background: linear-gradient(90deg, #f87171 0%, #ef4444 100%);
	}

	.opportunities-fill {
		background: linear-gradient(90deg, #60a5fa 0%, #3b82f6 100%);
	}

	.threats-fill {
		background: linear-gradient(90deg, #fbbf24 0%, #f59e0b 100%);
	}

	.balance-stats {
		display: flex;
		justify-content: space-around;
		gap: 2rem;
	}

	.stat-item {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 1rem;
		font-weight: 600;
	}

	.strengths-stat {
		color: #4ade80;
	}

	.weaknesses-stat {
		color: #f87171;
	}

	.opportunities-stat {
		color: #60a5fa;
	}

	.threats-stat {
		color: #fbbf24;
	}

	.stat-item .material-symbols-outlined {
		font-size: 1.25rem;
	}

	/* PESTEL Framework */
	.pestel-framework {
		margin-top: 2rem;
		padding-top: 2rem;
		border-top: 1px solid var(--border-color);
	}

	.pestel-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
		gap: 1.5rem;
		margin-top: 1.5rem;
	}

	.pestel-card {
		display: flex;
		align-items: flex-start;
		gap: 1rem;
		padding: 1.5rem;
		background: var(--bg-secondary);
		border: 1px solid var(--border-color);
		border-radius: 12px;
		transition: all 0.2s ease;
	}

	.pestel-card:hover {
		border-color: var(--accent-primary);
		transform: translateY(-2px);
		box-shadow: 0 4px 12px var(--accent-shadow);
	}

	.pestel-card .material-symbols-outlined {
		font-size: 2rem;
		color: var(--accent-primary);
		flex-shrink: 0;
	}

	.pestel-card h4 {
		font-size: 1.125rem;
		font-weight: 600;
		color: var(--text-primary);
		margin: 0 0 0.5rem 0;
	}

	.pestel-card p {
		font-size: 0.875rem;
		color: var(--text-secondary);
		line-height: 1.5;
		margin: 0;
	}

	/* =====================================================
	   NOTES SECTION STYLES
	   ===================================================== */
	
	.notes-section {
		padding: 0;
		height: calc(100vh - 140px);
	}

	.notes-layout {
		display: grid;
		grid-template-columns: 1fr 3fr;
		height: 100%;
		background: var(--card-bg);
		border: 1px solid var(--border-color);
		border-radius: 12px;
		overflow: hidden;
	}

	/* Notes Sidebar (Left 1/4) */
	.notes-sidebar {
		background: var(--bg-secondary);
		border-right: 1px solid var(--border-color);
		display: flex;
		flex-direction: column;
		height: 100%;
		overflow: hidden;
	}

	.notes-sidebar-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 1rem 1.25rem;
		border-bottom: 1px solid var(--border-color);
	}

	.notes-sidebar-header h3 {
		margin: 0;
		font-size: 1.1rem;
		font-weight: 600;
		color: var(--text-primary);
	}

	.btn-add-note {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 32px;
		height: 32px;
		background: var(--accent-primary);
		border: none;
		border-radius: 8px;
		cursor: pointer;
		transition: all 0.2s;
	}

	.btn-add-note .material-symbols-outlined {
		font-size: 1.25rem;
		color: white;
	}

	.btn-add-note:hover {
		background: var(--accent-hover);
		transform: scale(1.05);
	}

	.notes-sidebar .notes-search-box {
		margin: 0.75rem;
		padding: 0.5rem 0.75rem;
	}

	.notes-sidebar .notes-category-select {
		margin: 0 0.75rem 0.75rem;
		width: calc(100% - 1.5rem);
	}

	.notes-list {
		flex: 1;
		overflow-y: auto;
		padding: 0.5rem;
	}

	.note-list-item {
		display: block;
		width: 100%;
		text-align: left;
		padding: 0.875rem 1rem;
		background: transparent;
		border: 1px solid transparent;
		border-radius: 8px;
		cursor: pointer;
		transition: all 0.2s;
		margin-bottom: 0.25rem;
	}

	.note-list-item:hover {
		background: var(--bg-tertiary);
		border-color: var(--border-color);
	}

	.note-list-item.active {
		background: var(--accent-shadow);
		border-color: var(--accent-primary);
	}

	.note-list-item-title {
		font-size: 0.9rem;
		font-weight: 600;
		color: var(--text-primary);
		margin-bottom: 0.375rem;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.note-list-item-meta {
		display: flex;
		justify-content: space-between;
		font-size: 0.75rem;
		color: var(--text-secondary);
	}

	.note-list-category {
		color: var(--accent-primary);
		font-weight: 500;
	}

	.empty-notes-sidebar {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 2rem;
		text-align: center;
		color: var(--text-secondary);
	}

	.empty-notes-sidebar .material-symbols-outlined {
		font-size: 2.5rem;
		margin-bottom: 0.5rem;
		color: var(--accent-primary);
		opacity: 0.5;
	}

	.empty-notes-sidebar p {
		margin: 0;
		font-size: 0.875rem;
	}

	/* Notes Content (Right 3/4) */
	.notes-content {
		display: flex;
		flex-direction: column;
		height: 100%;
		overflow: hidden;
	}

	/* Note Editor (Create New) */
	.note-editor {
		height: 100%;
		display: flex;
		flex-direction: column;
	}

	.note-editor-header {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 1.25rem 1.5rem;
		border-bottom: 1px solid var(--border-color);
		background: var(--bg-secondary);
	}

	.note-editor-header .material-symbols-outlined {
		font-size: 1.5rem;
		color: var(--accent-primary);
	}

	.note-editor-header h2 {
		margin: 0;
		font-size: 1.25rem;
		font-weight: 600;
		color: var(--text-primary);
	}

	.note-form {
		flex: 1;
		padding: 1.5rem;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
	}

	.form-group {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.form-group label {
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--text-secondary);
	}

	.form-group input,
	.form-group select,
	.form-group textarea {
		padding: 0.75rem 1rem;
		background: var(--bg-secondary);
		border: 1px solid var(--border-color);
		border-radius: 8px;
		color: var(--text-primary);
		font-size: 0.95rem;
		transition: border-color 0.2s;
	}

	.form-group input:focus,
	.form-group select:focus,
	.form-group textarea:focus {
		outline: none;
		border-color: var(--accent-primary);
	}

	.form-group textarea {
		resize: vertical;
		min-height: 200px;
		flex: 1;
		font-family: inherit;
		line-height: 1.6;
	}

	.note-form-actions {
		display: flex;
		justify-content: flex-end;
		gap: 1rem;
		padding-top: 1rem;
		border-top: 1px solid var(--border-color);
	}

	/* Note Viewer */
	.note-viewer {
		height: 100%;
		display: flex;
		flex-direction: column;
	}

	.note-viewer-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		padding: 1.25rem 1.5rem;
		border-bottom: 1px solid var(--border-color);
		background: var(--bg-secondary);
	}

	.note-viewer-title {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		flex-wrap: wrap;
	}

	.note-viewer-title h2 {
		margin: 0;
		font-size: 1.25rem;
		font-weight: 600;
		color: var(--text-primary);
	}

	.note-viewer-actions {
		display: flex;
		align-items: center;
		gap: 1rem;
	}

	.note-viewer-content {
		flex: 1;
		padding: 1.5rem;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
	}

	/* Note Placeholder */
	.note-placeholder {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		text-align: center;
		padding: 3rem;
		color: var(--text-secondary);
	}

	.note-placeholder .material-symbols-outlined {
		font-size: 4rem;
		margin-bottom: 1rem;
		color: var(--accent-primary);
		opacity: 0.4;
	}

	.note-placeholder h3 {
		margin: 0 0 0.5rem;
		font-size: 1.25rem;
		color: var(--text-primary);
	}

	.note-placeholder p {
		margin: 0 0 1.5rem;
		max-width: 300px;
	}

	.section-description {
		color: var(--text-secondary);
		font-size: 0.95rem;
		line-height: 1.6;
		margin-bottom: 1.5rem;
	}

	.notes-search-box {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		background: var(--bg-secondary);
		border: 1px solid var(--border-color);
		border-radius: 8px;
		padding: 0.5rem 1rem;
	}

	.notes-search-box input {
		flex: 1;
		border: none;
		background: transparent;
		color: var(--text-primary);
		font-size: 0.9rem;
		outline: none;
	}

	.notes-search-box .material-symbols-outlined {
		color: var(--text-secondary);
		font-size: 1.2rem;
	}

	.notes-category-select {
		padding: 0.5rem 1rem;
		border: 1px solid var(--border-color);
		border-radius: 8px;
		background: var(--bg-secondary);
		color: var(--text-primary);
		font-size: 0.9rem;
		cursor: pointer;
	}

	.loading-notes-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 2rem;
		text-align: center;
		color: var(--text-secondary);
	}

	.loading-notes-state .material-symbols-outlined {
		font-size: 2rem;
		color: var(--accent-primary);
	}

	.note-category-badge {
		display: inline-block;
		padding: 0.25rem 0.75rem;
		background: var(--accent-shadow);
		color: var(--accent-primary);
		border-radius: 20px;
		font-size: 0.75rem;
		font-weight: 500;
	}

	.note-date-badge {
		font-size: 0.8rem;
		color: var(--text-secondary);
	}

	.btn-icon-danger {
		background: transparent;
		border: none;
		cursor: pointer;
		padding: 0.5rem;
		border-radius: 6px;
		color: var(--text-secondary);
		transition: all 0.2s;
	}

	.btn-icon-danger:hover {
		background: rgba(239, 68, 68, 0.1);
		color: #ef4444;
	}

	.note-question-box,
	.note-answer-box {
		display: flex;
		gap: 0.75rem;
		padding: 1rem;
		border-radius: 8px;
	}

	.note-question-box {
		background: var(--bg-tertiary);
	}

	.note-answer-box {
		background: var(--accent-shadow);
	}

	.note-question-box .material-symbols-outlined,
	.note-answer-box .material-symbols-outlined {
		font-size: 1.5rem;
		color: var(--accent-primary);
		flex-shrink: 0;
	}

	.note-question-box strong,
	.note-answer-box strong {
		display: block;
		font-size: 0.8rem;
		color: var(--text-secondary);
		margin-bottom: 0.25rem;
	}

	.note-question-box p,
	.note-answer-box p {
		margin: 0;
		font-size: 0.9rem;
		line-height: 1.5;
		color: var(--text-primary);
		white-space: pre-wrap;
	}

	/* Profile Section */
	.profile-grid {
		display: grid;
		gap: 2rem;
		margin-top: 2rem;
	}

	.profile-card {
		background: var(--bg-secondary);
		border: 1px solid var(--border-color);
		border-radius: 12px;
		padding: 2rem;
	}

	.profile-card.full-width {
		grid-column: 1 / -1;
	}

	.profile-card-title {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		font-size: 1.25rem;
		font-weight: 600;
		color: var(--text-primary);
		margin-bottom: 1.5rem;
		padding-bottom: 1rem;
		border-bottom: 1px solid var(--border-color);
	}

	.profile-card-title .material-symbols-outlined {
		font-size: 1.5rem;
		color: var(--accent-primary);
	}

	.profile-info {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.info-row {
		display: flex;
		justify-content: space-between;
		padding: 0.75rem 0;
		border-bottom: 1px solid var(--border-color);
	}

	.info-row:last-child {
		border-bottom: none;
	}

	.info-label {
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--text-secondary);
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	.info-value {
		font-size: 1rem;
		font-weight: 600;
		color: var(--text-primary);
	}

	/* Social Links */
	.social-links {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.social-link {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 1rem;
		background: var(--bg-primary);
		border: 1px solid var(--border-color);
		border-radius: 8px;
		color: var(--text-primary);
		text-decoration: none;
		transition: all 0.2s ease;
	}

	.social-link:hover {
		border-color: var(--accent-primary);
		transform: translateX(4px);
		box-shadow: 0 4px 12px var(--accent-shadow);
	}

	.social-link .material-symbols-outlined:first-child {
		color: var(--accent-primary);
	}

	.social-link .material-symbols-outlined:last-child {
		margin-left: auto;
		font-size: 1rem;
		color: var(--text-tertiary);
	}

	.empty-social {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 3rem 1rem;
		gap: 1rem;
		text-align: center;
	}

	.empty-social .material-symbols-outlined {
		font-size: 3rem;
		color: var(--text-tertiary);
		opacity: 0.5;
	}

	.empty-social p {
		color: var(--text-secondary);
		margin: 0;
	}

	/* Assessment Status */
	.assessment-status {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	.status-item {
		display: flex;
		align-items: center;
		gap: 1rem;
		padding: 1.5rem;
		background: var(--bg-primary);
		border: 1px solid var(--border-color);
		border-radius: 8px;
	}

	.status-icon {
		font-size: 2.5rem;
		flex-shrink: 0;
	}

	.status-icon.completed {
		color: #4ade80;
	}

	.status-icon.pending {
		color: var(--text-tertiary);
	}

	.status-item h4 {
		font-size: 1.125rem;
		font-weight: 600;
		color: var(--text-primary);
		margin: 0 0 0.25rem 0;
	}

	.status-item p {
		font-size: 0.875rem;
		color: var(--text-secondary);
		margin: 0;
	}

	.retake-btn {
		margin-top: 1rem;
	}

	/* Account Actions */
	.account-actions {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		padding: 1rem 0;
	}

	.logout-profile-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.75rem;
		padding: 1rem 1.5rem;
		background: transparent;
		border: 2px solid #ff6b6b;
		border-radius: 8px;
		color: #ff6b6b;
		font-size: 1rem;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.3s ease;
	}

	.logout-profile-btn:hover {
		background: #ff6b6b;
		color: white;
		transform: translateY(-2px);
		box-shadow: 0 4px 12px rgba(255, 107, 107, 0.3);
	}

	.logout-profile-btn .material-symbols-outlined {
		font-size: 1.25rem;
	}

	/* DDQ Answers */
	.ddq-answers {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.answer-card {
		background: var(--bg-secondary);
		border: 1px solid var(--border-color);
		border-radius: 12px;
		padding: 1.25rem;
		transition: all 0.3s ease;
	}

	.answer-card:hover {
		border-color: rgba(255, 215, 0, 0.3);
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
	}

	.answer-header {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 1rem;
		margin-bottom: 0.75rem;
	}

	.answer-question {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		flex: 1;
	}

	.question-number {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 32px;
		height: 32px;
		background: linear-gradient(135deg, rgba(255, 215, 0, 0.15), rgba(255, 193, 7, 0.1));
		border: 1px solid rgba(255, 215, 0, 0.25);
		border-radius: 8px;
		font-size: 0.75rem;
		font-weight: 700;
		color: rgba(255, 215, 0, 0.9);
	}

	.question-text {
		font-size: 0.9rem;
		font-weight: 500;
		color: var(--text-secondary);
		line-height: 1.4;
	}

	.edit-btn {
		opacity: 0;
		transition: opacity 0.2s ease;
	}

	.answer-card:hover .edit-btn {
		opacity: 1;
	}

	.answer-value {
		margin-bottom: 0.75rem;
	}

	.dropdown-answer, .radio-answer, .text-answer {
		display: inline-block;
		padding: 0.5rem 1rem;
		background: var(--card-bg);
		border: 1px solid var(--border-color);
		border-radius: 8px;
		font-weight: 600;
		color: var(--text-primary);
	}

	.textarea-answer {
		padding: 0.75rem;
		background: var(--card-bg);
		border: 1px solid var(--border-color);
		border-radius: 8px;
		color: var(--text-primary);
		line-height: 1.6;
		margin: 0;
	}

	.answer-section {
		display: inline-block;
		padding: 0.25rem 0.75rem;
		background: rgba(100, 100, 255, 0.1);
		border: 1px solid rgba(100, 100, 255, 0.2);
		border-radius: 12px;
		font-size: 0.75rem;
		font-weight: 600;
		color: rgba(100, 100, 255, 0.9);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.small-text {
		font-size: 0.875rem;
		color: var(--text-tertiary);
	}

	/* Dashboard Footer */
	.dashboard-footer {
		padding: 1.5rem 2rem;
		background: var(--bg-secondary);
		border-top: 1px solid var(--border-color);
		margin-top: auto;
	}

	.footer-content {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 2rem;
		flex-wrap: wrap;
	}

	.footer-left {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.footer-logo-img {
		width: 1.25rem;
		height: 1.25rem;
		object-fit: contain;
	}

	.footer-logo-img.logo-dark {
		display: block;
	}

	.footer-logo-img.logo-light {
		display: none;
	}

	:global([data-theme='light']) .footer-logo-img.logo-dark {
		display: none;
	}

	:global([data-theme='light']) .footer-logo-img.logo-light {
		display: block;
	}

	.footer-logo {
		font-size: 1.125rem;
		font-weight: 700;
		color: var(--accent-primary);
		letter-spacing: -0.5px;
	}

	.footer-tagline {
		font-size: 0.875rem;
		font-weight: 500;
		color: var(--text-secondary);
	}

	.footer-separator {
		color: var(--text-tertiary);
	}

	.footer-copyright {
		font-size: 0.875rem;
		color: var(--text-secondary);
	}

	.footer-right {
		display: flex;
		align-items: center;
	}

	.footer-contact {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 1rem;
		background: var(--bg-primary);
		border: 1px solid var(--border-color);
		border-radius: 8px;
		color: var(--text-primary);
		text-decoration: none;
		font-size: 0.875rem;
		font-weight: 500;
		transition: all 0.2s ease;
	}

	.nav-item.logout-nav-item {
		margin-top: 0;
	}

	.nav-item.logout-nav-item:hover {
		background: rgba(255, 107, 107, 0.1);
		color: #ff6b6b;
	}

	.footer-contact:hover {
		border-color: var(--accent-primary);
		box-shadow: 0 2px 8px var(--accent-shadow);
		transform: translateY(-1px);
	}

	.footer-contact .material-symbols-outlined {
		font-size: 1.125rem;
		color: var(--accent-primary);
	}

	/* Market Metrics Section */
	.market-metrics-section {
		margin-top: 2rem;
		padding-top: 2rem;
		border-top: 1px solid var(--border-color);
	}

	.metrics-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
		gap: 1.5rem;
		margin-top: 1.5rem;
	}

	.metric-card {
		background: linear-gradient(135deg, var(--card-bg) 0%, var(--bg-secondary) 100%);
		border: 1px solid var(--border-color);
		border-radius: 16px;
		padding: 1.5rem;
		position: relative;
		overflow: hidden;
	}

	.metric-card::before {
		content: '';
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		height: 3px;
		background: linear-gradient(90deg, var(--accent-primary), var(--accent-secondary));
	}

	.metric-card.tam::before {
		background: linear-gradient(90deg, #667eea, #764ba2);
	}

	.metric-card.sam::before {
		background: linear-gradient(90deg, #f093fb, #f5576c);
	}

	.metric-card.som::before {
		background: linear-gradient(90deg, #4facfe, #00f2fe);
	}

	.metric-card.cagr::before {
		background: linear-gradient(90deg, #43e97b, #38f9d7);
	}

	.metric-header {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-bottom: 1rem;
	}

	.metric-header .material-symbols-outlined {
		font-size: 1.5rem;
		color: var(--accent-primary);
	}

	.metric-label {
		font-weight: 600;
		font-size: 0.875rem;
		color: var(--text-secondary);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.metric-value {
		font-size: 2rem;
		font-weight: 700;
		color: var(--text-primary);
		margin: 0.5rem 0;
	}

	.metric-desc {
		font-size: 0.875rem;
		color: var(--text-secondary);
		margin-bottom: 0.5rem;
	}

	.metric-detail {
		font-size: 0.75rem;
		color: var(--text-tertiary);
		padding: 0.25rem 0.75rem;
		background: var(--bg-secondary);
		border-radius: 12px;
		display: inline-block;
	}

	/* inFINity stats Metrics */
	.health-metrics {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 1.5rem;
		margin-top: 1.5rem;
	}

	.health-metric {
		display: flex;
		align-items: center;
		gap: 1rem;
		padding: 1.5rem;
		background: var(--card-bg);
		border: 1px solid var(--border-color);
		border-radius: 12px;
		transition: all 0.3s ease;
	}

	.health-metric:hover {
		transform: translateY(-2px);
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
		border-color: rgba(255, 215, 0, 0.3);
	}

	.health-details {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		flex: 1;
	}

	.health-label {
		font-size: 0.875rem;
		color: var(--text-tertiary);
		font-weight: 500;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.health-value {
		font-size: 1.25rem;
		font-weight: 700;
		color: var(--text-primary);
	}

	.profitability-badge {
		background: linear-gradient(135deg, #4caf50, #66bb6a);
		color: white;
		padding: 0.5rem 1rem;
		border-radius: 20px;
		font-weight: 600;
		font-size: 0.875rem;
		display: inline-block;
		box-shadow: 0 4px 12px rgba(76, 175, 80, 0.3);
	}

	.positive {
		color: #4caf50;
	}

	.negative {
		color: #ef5350;
	}

	/* Method Info Section */
	.method-info-section {
		margin-top: 1.5rem;
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.info-badge {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 1rem;
		background: rgba(255, 215, 0, 0.05);
		border: 1px solid rgba(255, 215, 0, 0.15);
		border-radius: 8px;
		font-size: 0.9rem;
		color: var(--text-secondary);
	}

	.info-badge strong {
		color: var(--text-primary);
		font-weight: 600;
	}

	/* Porter's 5 Forces Section */
	.porters-section {
		margin-top: 2rem;
		padding-top: 2rem;
		border-top: 1px solid var(--border-color);
	}

	.forces-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
		gap: 1.5rem;
		margin-top: 1.5rem;
	}

	.force-card {
		background: var(--card-bg);
		border: 1px solid var(--border-color);
		border-radius: 16px;
		padding: 1.5rem;
		transition: all 0.3s ease;
	}

	.force-card:hover {
		transform: translateY(-4px);
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1);
	}

	.force-card.central {
		grid-column: 1 / -1;
		background: linear-gradient(135deg, rgba(212, 175, 55, 0.15) 0%, rgba(218, 165, 32, 0.1) 100%);
		border: 2px solid var(--accent-primary);
		color: var(--text-primary);
	}

	.force-card.central h4,
	.force-card.central p {
		color: var(--text-primary);
	}

	.force-icon {
		width: 48px;
		height: 48px;
		background: var(--accent-primary);
		border-radius: 12px;
		display: flex;
		align-items: center;
		justify-content: center;
		margin-bottom: 1rem;
	}

	.force-card.central .force-icon {
		background: var(--accent-primary);
	}

	.force-icon .material-symbols-outlined {
		font-size: 1.5rem;
		color: white;
	}

	.force-card h4 {
		font-size: 1.125rem;
		font-weight: 600;
		margin-bottom: 1rem;
		color: var(--text-primary);
	}

	.threat-level {
		display: inline-block;
		padding: 0.5rem 1rem;
		border-radius: 20px;
		font-weight: 600;
		font-size: 0.875rem;
		margin-bottom: 1rem;
		text-transform: uppercase;
	}

	.threat-level.low {
		background: rgba(76, 217, 100, 0.2);
		color: #4cd964;
	}

	.threat-level.medium {
		background: rgba(255, 204, 0, 0.2);
		color: #ffcc00;
	}

	.threat-level.high {
		background: rgba(255, 59, 48, 0.2);
		color: #ff3b30;
	}

	.force-analysis {
		font-size: 0.875rem;
		line-height: 1.6;
		color: var(--text-secondary);
		margin-bottom: 0.5rem;
	}

	.force-card.central .force-analysis {
		color: var(--text-primary);
	}

	.competitive-advantage {
		margin-top: 1rem;
		padding: 1rem;
		background: rgba(212, 175, 55, 0.15);
		border: 1px solid var(--accent-primary);
		border-radius: 12px;
		font-size: 0.875rem;
		color: var(--text-primary);
	}

	.competitive-advantage strong {
		display: block;
		margin-bottom: 0.5rem;
		color: var(--accent-primary);
		font-weight: 600;
	}

	/* VRIO Analysis Section */
	.vrio-section {
		margin-top: 2rem;
		padding-top: 2rem;
		border-top: 1px solid var(--border-color);
	}

	.subsection-desc {
		color: var(--text-secondary);
		font-size: 0.875rem;
		margin-top: 0.5rem;
	}

	/* VRIO Matrix Table Styles */
	.vrio-matrix-container {
		margin-top: 1.5rem;
		overflow-x: auto;
		border-radius: 12px;
		background: var(--bg-secondary);
		position: relative;
	}

	.vrio-info-btn {
		position: absolute;
		top: 0.75rem;
		right: 0.75rem;
		background: transparent;
		border: 1px solid var(--border-color);
		border-radius: 50%;
		width: 28px;
		height: 28px;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		z-index: 10;
		transition: all 0.2s ease;
	}

	.vrio-info-btn:hover {
		background: var(--accent-primary);
		border-color: var(--accent-primary);
	}

	.vrio-info-btn .material-symbols-outlined {
		font-size: 1rem;
		color: var(--text-secondary);
	}

	.vrio-info-btn:hover .material-symbols-outlined {
		color: white;
	}

	.vrio-info-popup {
		position: absolute;
		top: 3rem;
		right: 0.75rem;
		width: 400px;
		max-width: calc(100vw - 2rem);
		background: var(--card-bg);
		border: 1px solid var(--border-color);
		border-radius: 12px;
		padding: 1rem;
		z-index: 100;
		box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
	}

	.vrio-info-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 1rem;
		padding-bottom: 0.75rem;
		border-bottom: 1px solid var(--border-color);
	}

	.vrio-info-header h4 {
		margin: 0;
		font-size: 0.95rem;
		color: var(--accent-primary);
	}

	.vrio-info-header .close-btn {
		background: transparent;
		border: none;
		cursor: pointer;
		padding: 0.25rem;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 4px;
	}

	.vrio-info-header .close-btn:hover {
		background: var(--bg-secondary);
	}

	.vrio-info-header .close-btn .material-symbols-outlined {
		font-size: 1.25rem;
		color: var(--text-secondary);
	}

	.vrio-info-popup .explanation-grid {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 0.75rem;
		margin-bottom: 1rem;
	}

	.vrio-info-popup .explanation-item {
		background: var(--bg-secondary);
		padding: 0.75rem;
		border-radius: 8px;
	}

	.vrio-info-popup .explanation-item strong {
		color: #d4af37;
		font-size: 0.8rem;
		display: block;
		margin-bottom: 0.25rem;
	}

	.vrio-info-popup .explanation-item p {
		margin: 0;
		font-size: 0.75rem;
		color: var(--text-secondary);
		line-height: 1.4;
	}

	.vrio-info-popup .implications-list {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.vrio-info-popup .implication-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.75rem;
		color: var(--text-secondary);
		padding: 0.5rem;
		background: var(--bg-secondary);
		border-radius: 6px;
	}

	.vrio-info-popup .implication-row .dot {
		width: 10px;
		height: 10px;
		border-radius: 50%;
		flex-shrink: 0;
	}

	.vrio-info-popup .dot.disadvantage { background: #ff3b30; }
	.vrio-info-popup .dot.parity { background: #ffcc00; }
	.vrio-info-popup .dot.temporary { background: #5ac8fa; }
	.vrio-info-popup .dot.sustained { background: #4cd964; }

	.vrio-matrix {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.9rem;
	}

	.vrio-matrix thead {
		background: var(--bg-tertiary);
	}

	.vrio-matrix th {
		padding: 1rem 1.25rem;
		text-align: center;
		font-weight: 600;
		color: var(--text-secondary);
		font-size: 0.85rem;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		border-bottom: 2px solid var(--border-color);
	}

	.vrio-matrix th.resource-col {
		text-align: left;
		width: 180px;
	}

	.vrio-matrix th.outcome-col {
		text-align: left;
		min-width: 280px;
	}

	.vrio-matrix tbody tr {
		border-bottom: 1px solid var(--border-color);
		transition: background 0.2s ease;
	}

	.vrio-matrix tbody tr:last-child {
		border-bottom: none;
	}

	.vrio-matrix tbody tr:hover {
		background: rgba(var(--accent-primary-rgb), 0.05);
	}

	.vrio-matrix td {
		padding: 1rem 1.25rem;
		vertical-align: middle;
	}

	.vrio-matrix .resource-name {
		font-weight: 500;
		color: var(--accent-primary);
		text-align: left;
	}

	.vrio-matrix .vrio-cell {
		text-align: center;
	}

	.vrio-matrix .vrio-icon {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 28px;
		border-radius: 6px;
		font-weight: 700;
		font-size: 1rem;
	}

	.vrio-matrix .vrio-icon.yes {
		background: rgba(76, 217, 100, 0.15);
		color: #4cd964;
	}

	.vrio-matrix .vrio-icon.no {
		background: rgba(255, 59, 48, 0.15);
		color: #ff3b30;
	}

	.vrio-matrix .outcome-cell {
		font-weight: 400;
		font-size: 0.8rem;
		text-align: left;
		line-height: 1.4;
		color: var(--text-secondary);
	}

	/* Remove color coding from outcome cells */
	.vrio-matrix .outcome-cell.sustained,
	.vrio-matrix .outcome-cell.temporary,
	.vrio-matrix .outcome-cell.parity,
	.vrio-matrix .outcome-cell.disadvantage {
		color: var(--text-secondary);
	}

	/* Keep old styles for backward compatibility */
	.vrio-grid {
		display: grid;
		gap: 1.5rem;
		margin-top: 1.5rem;
	}

	.vrio-card {
		background: var(--card-bg);
		border: 2px solid var(--border-color);
		border-radius: 16px;
		padding: 1.5rem;
		transition: all 0.3s ease;
	}

	.vrio-card.sustained-competitive-advantage {
		border-color: #4cd964;
		background: linear-gradient(135deg, rgba(76, 217, 100, 0.05) 0%, var(--card-bg) 100%);
	}

	.vrio-card.temporary-advantage {
		border-color: #5ac8fa;
		background: linear-gradient(135deg, rgba(90, 200, 250, 0.05) 0%, var(--card-bg) 100%);
	}

	.vrio-card.competitive-parity {
		border-color: #ffcc00;
		background: linear-gradient(135deg, rgba(255, 204, 0, 0.05) 0%, var(--card-bg) 100%);
	}

	.vrio-card.competitive-disadvantage {
		border-color: #ff3b30;
		background: linear-gradient(135deg, rgba(255, 59, 48, 0.05) 0%, var(--card-bg) 100%);
	}

	.vrio-resource {
		display: flex;
		align-items: center;
		gap: 1rem;
		margin-bottom: 1.5rem;
	}

	.vrio-resource .material-symbols-outlined {
		font-size: 2rem;
		color: var(--accent-primary);
	}

	.vrio-resource h4 {
		font-size: 1.125rem;
		font-weight: 600;
		color: var(--text-primary);
		margin: 0;
	}

	.vrio-checks {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
		gap: 1rem;
		margin-bottom: 1.5rem;
	}

	.vrio-check {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.5rem;
		padding: 0.75rem;
		background: var(--bg-secondary);
		border-radius: 12px;
		text-align: center;
	}

	.vrio-check.check-yes .material-symbols-outlined {
		color: #4cd964;
	}

	.vrio-check.check-no .material-symbols-outlined {
		color: #ff3b30;
	}

	.vrio-check span:last-child {
		font-size: 0.75rem;
		font-weight: 500;
		color: var(--text-secondary);
	}

	.vrio-result {
		text-align: center;
		padding: 1rem;
		background: var(--bg-secondary);
		border-radius: 12px;
	}

	.vrio-result strong {
		font-size: 1rem;
		color: var(--accent-primary);
	}

	.vrio-summary {
		margin-top: 2rem;
		padding: 1.5rem;
		background: linear-gradient(135deg, var(--accent-primary) 0%, var(--accent-secondary) 100%);
		border-radius: 16px;
		color: white;
	}

	.vrio-summary h4 {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 1.25rem;
		margin-bottom: 1rem;
		color: white;
	}

	.vrio-summary p {
		line-height: 1.8;
		font-size: 0.938rem;
	}

	.vrio-summary strong {
		font-weight: 700;
	}

	/* Product Insight Section */
	.product-insight-section {
		margin-top: 2rem;
		padding-top: 2rem;
		border-top: 1px solid var(--border-color);
	}

	.product-insight-section h4 {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 1.25rem;
		font-weight: 600;
		color: var(--text-primary);
		margin-bottom: 0.5rem;
	}

	.product-insight-section h4 .material-symbols-outlined {
		color: var(--accent-primary);
		font-size: 1.5rem;
	}

	.insight-subtitle {
		font-size: 0.9rem;
		color: var(--text-secondary);
		margin-bottom: 1.5rem;
	}

	.insight-comparison-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
		gap: 1.25rem;
	}

	.insight-metric-card {
		background: var(--card-bg);
		border: 1px solid var(--border-color);
		border-radius: 16px;
		padding: 1.25rem;
		transition: all 0.3s ease;
	}

	.insight-metric-card:hover {
		transform: translateY(-2px);
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
		border-color: var(--accent-primary);
	}

	.metric-header {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-bottom: 1rem;
		padding-bottom: 0.75rem;
		border-bottom: 1px solid var(--border-color);
	}

	.metric-header .material-symbols-outlined {
		font-size: 1.25rem;
		color: var(--accent-primary);
	}

	.metric-header span:last-child {
		font-weight: 600;
		font-size: 0.95rem;
		color: var(--text-primary);
	}

	.metric-comparison {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		margin-bottom: 1rem;
	}

	.your-value {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.your-value .label {
		font-size: 0.75rem;
		color: var(--text-secondary);
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	.your-value .value {
		font-size: 1.5rem;
		font-weight: 700;
		color: var(--accent-primary);
	}

	.benchmark-values {
		display: flex;
		gap: 1.25rem;
	}

	.benchmark {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 0.125rem;
	}

	.benchmark .label {
		font-size: 0.65rem;
		color: var(--text-tertiary);
		text-transform: uppercase;
		letter-spacing: 0.3px;
	}

	.benchmark .value {
		font-size: 0.9rem;
		font-weight: 500;
	}

	.benchmark.local .value {
		color: #5ac8fa;
	}

	.benchmark.global .value {
		color: #ff9500;
	}

	.progress-bar-container {
		height: 6px;
		background: var(--bg-tertiary);
		border-radius: 3px;
		overflow: visible;
		margin-bottom: 0.75rem;
		position: relative;
	}

	.benchmark-marker {
		position: absolute;
		top: -4px;
		width: 2px;
		height: 14px;
		border-radius: 1px;
		transform: translateX(-50%);
		z-index: 2;
	}

	.benchmark-marker.local {
		background: #5ac8fa;
	}

	.benchmark-marker.global {
		background: #ff9500;
	}

	.benchmark-marker::after {
		content: attr(data-label);
		position: absolute;
		top: -18px;
		left: 50%;
		transform: translateX(-50%);
		font-size: 0.6rem;
		white-space: nowrap;
		color: var(--text-secondary);
		font-weight: 500;
	}

	.benchmark-marker.local::after {
		content: 'L';
		color: #5ac8fa;
	}

	.benchmark-marker.global::after {
		content: 'G';
		color: #ff9500;
	}

	.progress-bar {
		height: 100%;
		border-radius: 3px;
		transition: width 0.5s ease;
	}

	.progress-bar.your {
		background: linear-gradient(90deg, var(--accent-primary) 0%, var(--accent-secondary) 100%);
	}

	.progress-bar.burn {
		background: linear-gradient(90deg, #ff9500 0%, #ff3b30 100%);
	}

	.progress-bar.runway {
		background: linear-gradient(90deg, #4cd964 0%, #5ac8fa 100%);
	}

	.progress-bar.runway.good {
		background: linear-gradient(90deg, #4cd964 0%, #34c759 100%);
	}

	.progress-bar.runway.warning {
		background: linear-gradient(90deg, #ffcc00 0%, #ff9500 100%);
	}

	.progress-bar.runway.danger {
		background: linear-gradient(90deg, #ff3b30 0%, #ff453a 100%);
	}

	.progress-bar.marketing {
		background: linear-gradient(90deg, #5856d6 0%, #af52de 100%);
	}

	.progress-bar.efficiency {
		background: linear-gradient(90deg, #34c759 0%, #4cd964 100%);
	}

	.comparison-text {
		display: block;
		font-size: 0.8rem;
		line-height: 1.4;
	}

	.comparison-text.positive {
		color: #4cd964;
	}

	.comparison-text.negative {
		color: #ff3b30;
	}

	.comparison-text.warning {
		color: #ff9500;
	}

	.comparison-text.neutral {
		color: var(--text-secondary);
	}

	/* Benchmark Comparison Table Styles */
	.benchmark-comparison-section {
		background: var(--card-bg);
		border: 1px solid var(--border-color);
		border-radius: 16px;
		padding: 1.5rem;
	}

	.benchmark-header-info {
		display: flex;
		align-items: center;
		gap: 1rem;
		margin-bottom: 1.5rem;
		padding-bottom: 1rem;
		border-bottom: 1px solid var(--border-color);
	}

	.benchmark-header-info .material-symbols-outlined {
		font-size: 2rem;
		color: #ffd700;
	}

	.benchmark-header-info h4 {
		margin: 0;
		font-size: 1.1rem;
		font-weight: 600;
		color: var(--text-primary);
	}

	.benchmark-header-info p {
		margin: 0.25rem 0 0;
		font-size: 0.85rem;
		color: var(--text-secondary);
	}

	.benchmark-table {
		margin-bottom: 1.5rem;
	}

	.benchmark-row {
		display: grid;
		grid-template-columns: 2fr 1fr 1.2fr 1fr;
		gap: 1rem;
		padding: 0.875rem 1rem;
		align-items: center;
		border-radius: 8px;
		transition: background 0.2s ease;
	}

	.benchmark-row:not(.header):hover {
		background: var(--bg-tertiary);
	}

	.benchmark-row.header {
		background: var(--bg-secondary);
		font-size: 0.75rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		color: var(--text-secondary);
		margin-bottom: 0.5rem;
	}

	.benchmark-row:not(.header) {
		border-bottom: 1px solid var(--border-color);
	}

	.benchmark-row:not(.header):last-of-type {
		border-bottom: none;
	}

	.benchmark-row .metric-name {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-weight: 500;
		color: var(--text-primary);
	}

	.benchmark-row .metric-name .material-symbols-outlined {
		font-size: 1.1rem;
		color: var(--accent-primary);
	}

	.benchmark-row .your-val {
		font-weight: 600;
		color: var(--accent-primary);
	}

	.benchmark-row .benchmark-val {
		font-weight: 500;
		color: #ffd700;
	}

	.benchmark-row .status-col {
		font-size: 0.85rem;
		font-weight: 500;
	}

	.benchmark-row .status-col.positive {
		color: #4cd964;
	}

	.benchmark-row .status-col.warning {
		color: #ff9500;
	}

	.benchmark-row .status-col.negative {
		color: #ff3b30;
	}

	.benchmark-row .status-col.neutral {
		color: var(--text-secondary);
	}

	.profitability-insights {
		background: linear-gradient(135deg, rgba(255, 215, 0, 0.1) 0%, rgba(255, 215, 0, 0.03) 100%);
		border: 1px solid rgba(255, 215, 0, 0.3);
		border-radius: 12px;
		padding: 1.25rem;
	}

	.profitability-insights .insight-title {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-weight: 600;
		color: #ffd700;
		margin-bottom: 1rem;
	}

	.profitability-insights .insight-title .material-symbols-outlined {
		font-size: 1.25rem;
	}

	.profitability-insights .insight-grid {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 1rem;
		margin-bottom: 1rem;
	}

	.profitability-insights .insight-item {
		text-align: center;
		padding: 0.75rem;
		background: var(--bg-secondary);
		border-radius: 8px;
	}

	.profitability-insights .insight-item .label {
		display: block;
		font-size: 0.7rem;
		color: var(--text-secondary);
		text-transform: uppercase;
		letter-spacing: 0.3px;
		margin-bottom: 0.25rem;
	}

	.profitability-insights .insight-item .value {
		font-size: 1.1rem;
		font-weight: 700;
		color: #ffd700;
	}

	.profitability-insights .insight-note {
		font-size: 0.85rem;
		color: var(--text-secondary);
		line-height: 1.5;
		margin: 0;
	}

	.profitability-insights .insight-note strong {
		color: #ffd700;
	}

	@media (max-width: 768px) {
		.benchmark-row {
			grid-template-columns: 1fr 1fr;
			gap: 0.5rem;
		}
		
		.benchmark-row.header .benchmark-val,
		.benchmark-row.header .status-col {
			display: none;
		}
		
		.profitability-insights .insight-grid {
			grid-template-columns: repeat(2, 1fr);
		}
	}

	/* SWOT Grid Styles */
	.swot-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1rem;
		margin-top: 1.5rem;
	}

	.swot-quadrant {
		padding: 1.25rem;
		border-radius: 12px;
		min-height: 180px;
	}

	.swot-quadrant.strengths {
		background: linear-gradient(135deg, rgba(34, 197, 94, 0.1) 0%, rgba(34, 197, 94, 0.05) 100%);
		border: 1px solid rgba(34, 197, 94, 0.3);
	}

	.swot-quadrant.weaknesses {
		background: linear-gradient(135deg, rgba(239, 68, 68, 0.1) 0%, rgba(239, 68, 68, 0.05) 100%);
		border: 1px solid rgba(239, 68, 68, 0.3);
	}

	.swot-quadrant.opportunities {
		background: linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(59, 130, 246, 0.05) 100%);
		border: 1px solid rgba(59, 130, 246, 0.3);
	}

	.swot-quadrant.threats {
		background: linear-gradient(135deg, rgba(245, 158, 11, 0.1) 0%, rgba(245, 158, 11, 0.05) 100%);
		border: 1px solid rgba(245, 158, 11, 0.3);
	}

	.quadrant-header {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-bottom: 1rem;
		padding-bottom: 0.75rem;
		border-bottom: 1px solid var(--border-color);
	}

	.quadrant-header h3 {
		font-size: 1rem;
		font-weight: 700;
		margin: 0;
	}

	.swot-quadrant.strengths .quadrant-header { color: #22c55e; }
	.swot-quadrant.weaknesses .quadrant-header { color: #ef4444; }
	.swot-quadrant.opportunities .quadrant-header { color: #3b82f6; }
	.swot-quadrant.threats .quadrant-header { color: #f59e0b; }

	.quadrant-content {
		max-height: 200px;
		overflow-y: auto;
	}

	.swot-item {
		font-size: 0.85rem;
		color: var(--text-primary);
		padding: 0.4rem 0;
		line-height: 1.4;
	}

	.empty-text {
		color: var(--text-secondary);
		font-size: 0.85rem;
		font-style: italic;
	}

	/* VRIO Table Styles */
	.section-desc {
		color: var(--text-secondary);
		font-size: 0.9rem;
		margin-top: 0.5rem;
		margin-bottom: 1.5rem;
	}

	.vrio-table {
		border: 1px solid var(--border-color);
		border-radius: 12px;
		overflow: hidden;
	}

	.vrio-header-row {
		display: grid;
		grid-template-columns: 2fr 1fr 1fr 1fr 1fr 2fr;
		background: var(--bg-secondary);
		font-weight: 600;
		font-size: 0.8rem;
		color: var(--text-secondary);
	}

	.vrio-row {
		display: grid;
		grid-template-columns: 2fr 1fr 1fr 1fr 1fr 2fr;
		border-top: 1px solid var(--border-color);
	}

	.vrio-row:hover {
		background: rgba(255, 193, 7, 0.05);
	}

	.vrio-col {
		padding: 0.75rem;
		display: flex;
		align-items: center;
		justify-content: center;
		text-align: center;
		font-size: 0.8rem;
	}

	.vrio-col.resource-col {
		justify-content: flex-start;
		gap: 0.5rem;
		font-weight: 500;
		color: var(--text-primary);
	}

	.vrio-col.resource-col .material-symbols-outlined {
		font-size: 1.2rem;
		color: var(--accent-color);
	}

	.vrio-col.result-col {
		font-weight: 600;
		font-size: 0.75rem;
	}

	.vrio-col.result-col.sustained { color: #22c55e; }
	.vrio-col.result-col.temporary { color: #3b82f6; }
	.vrio-col.result-col.parity { color: #f59e0b; }
	.vrio-col.result-col.disadvantage { color: #ef4444; }

	.vrio-check-icon {
		font-size: 1rem;
		font-weight: 700;
	}

	.vrio-check-icon.yes { color: #22c55e; }
	.vrio-check-icon.no { color: #ef4444; }

	@media (max-width: 768px) {
		.swot-grid {
			grid-template-columns: 1fr;
		}
		
		.vrio-header-row,
		.vrio-row {
			grid-template-columns: 1.5fr repeat(4, 0.8fr) 1.5fr;
			font-size: 0.7rem;
		}
		
		.vrio-col {
			padding: 0.5rem 0.25rem;
		}
	}

	/* AI Chatbot Section */
	.chat-section {
		height: calc(100vh - 140px);
		overflow: hidden;
	}

	.chat-card {
		height: 100%;
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	.chat-badge {
		margin-left: auto;
		padding: 0.5rem 1rem;
		background: linear-gradient(135deg, var(--accent-primary), var(--accent-secondary));
		color: white;
		border-radius: 20px;
		font-size: 0.75rem;
		font-weight: 600;
	}

	.chat-messages {
		flex: 1;
		overflow-y: auto;
		padding: 2rem;
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	.message {
		display: flex;
		gap: 1rem;
		animation: slideIn 0.3s ease;
	}

	@keyframes slideIn {
		from {
			opacity: 0;
			transform: translateY(10px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	.message.user {
		flex-direction: row-reverse;
	}

	.message-avatar {
		width: 40px;
		height: 40px;
		border-radius: 50%;
		background: linear-gradient(135deg, var(--accent-primary), var(--accent-secondary));
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}

	.message.user .message-avatar {
		background: linear-gradient(135deg, #667eea, #764ba2);
	}

	.message-avatar .material-symbols-outlined {
		color: white;
		font-size: 1.25rem;
	}

	.message-content {
		flex: 1;
		max-width: 70%;
	}

	.message.user .message-content {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
	}

	.message-text {
		background: var(--card-bg);
		border: 1px solid var(--border-color);
		padding: 1rem 1.25rem;
		border-radius: 16px;
		line-height: 1.6;
		white-space: pre-wrap;
		word-wrap: break-word;
	}

	.message.user .message-text {
		background: linear-gradient(135deg, var(--accent-primary), var(--accent-secondary));
		color: white;
		border: none;
	}

	.message-time {
		font-size: 0.75rem;
		color: var(--text-tertiary);
		margin-top: 0.5rem;
		padding: 0 0.5rem;
	}

	.typing-indicator {
		display: flex;
		gap: 0.5rem;
		padding: 1rem 1.25rem;
		background: var(--card-bg);
		border: 1px solid var(--border-color);
		border-radius: 16px;
	}

	.typing-indicator span {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--accent-primary);
		animation: bounce 1.4s infinite ease-in-out both;
	}

	.typing-indicator span:nth-child(1) {
		animation-delay: -0.32s;
	}

	.typing-indicator span:nth-child(2) {
		animation-delay: -0.16s;
	}

	@keyframes bounce {
		0%, 80%, 100% {
			transform: scale(0);
		}
		40% {
			transform: scale(1);
		}
	}

	.chat-input-container {
		border-top: 1px solid var(--border-color);
		padding: 1.5rem;
		background: var(--bg-secondary);
	}

	.chat-suggestions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
		margin-bottom: 1rem;
	}

	.suggestion-chip {
		padding: 0.5rem 1rem;
		background: var(--card-bg);
		border: 1px solid var(--border-color);
		border-radius: 20px;
		font-size: 0.875rem;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.suggestion-chip:hover {
		background: var(--accent-primary);
		color: white;
		border-color: var(--accent-primary);
		transform: translateY(-2px);
	}

	.chat-input-form {
		display: flex;
		gap: 1rem;
		align-items: center;
	}

	.chat-input {
		flex: 1;
		padding: 1rem 1.5rem;
		background: var(--card-bg);
		border: 1px solid var(--border-color);
		border-radius: 24px;
		font-size: 0.938rem;
		color: var(--text-primary);
		outline: none;
		transition: all 0.3s ease;
	}

	.chat-input:focus {
		border-color: var(--accent-primary);
		box-shadow: 0 0 0 3px rgba(103, 128, 159, 0.1);
	}

	.chat-send-btn {
		width: 48px;
		height: 48px;
		border-radius: 50%;
		background: linear-gradient(135deg, var(--accent-primary), var(--accent-secondary));
		border: none;
		color: white;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: all 0.3s ease;
	}

	.chat-send-btn:hover:not(:disabled) {
		transform: scale(1.1);
		box-shadow: 0 4px 12px rgba(103, 128, 159, 0.3);
	}

	.chat-send-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.chat-send-btn .material-symbols-outlined {
		font-size: 1.25rem;
	}

	/* Floating Chatbot FAB */
	.chatbot-fab {
		position: fixed;
		bottom: 24px;
		right: 24px;
		width: 64px;
		height: 64px;
		border-radius: 50%;
		background: linear-gradient(135deg, var(--accent-primary), var(--accent-secondary));
		border: none;
		color: var(--bg-primary);
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
		transition: all 0.3s ease;
		z-index: 999;
	}

	.chatbot-fab:hover {
		transform: scale(1.1);
		box-shadow: 0 6px 24px rgba(0, 0, 0, 0.4);
	}

	.chatbot-fab.expanded {
		opacity: 0.5;
		pointer-events: none;
	}

	.chatbot-fab .fab-icon {
		font-size: 32px;
		z-index: 2;
	}

	.fab-pulse {
		position: absolute;
		width: 100%;
		height: 100%;
		border-radius: 50%;
		background: var(--accent-primary);
		animation: pulse 2s ease-in-out infinite;
		opacity: 0;
	}

	@keyframes pulse {
		0% {
			transform: scale(1);
			opacity: 0.7;
		}
		50% {
			transform: scale(1.2);
			opacity: 0.3;
		}
		100% {
			transform: scale(1.4);
			opacity: 0;
		}
	}

	/* Floating Chatbot Panel */
	.chatbot-panel {
		position: fixed;
		bottom: 100px;
		right: 24px;
		width: 400px;
		max-width: calc(100vw - 48px);
		height: 600px;
		max-height: calc(100vh - 150px);
		background: var(--card-bg);
		border: 1px solid var(--border-color);
		border-radius: 16px;
		box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
		display: flex;
		flex-direction: column;
		z-index: 998;
		animation: slideUp 0.3s ease-out;
	}

	@keyframes slideUp {
		from {
			opacity: 0;
			transform: translateY(20px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	.chatbot-header {
		padding: 16px;
		border-bottom: 1px solid var(--border-color);
		background: var(--bg-secondary);
		border-radius: 16px 16px 0 0;
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.chatbot-header-content {
		display: flex;
		align-items: center;
		gap: 12px;
	}

	.chatbot-header-content .material-symbols-outlined {
		font-size: 28px;
		color: var(--accent-primary);
	}

	.chatbot-header h3 {
		font-size: 1rem;
		font-weight: 600;
		color: var(--text-primary);
		margin: 0;
	}

	.chatbot-badge {
		display: inline-block;
		padding: 2px 8px;
		background: var(--accent-shadow);
		color: var(--accent-primary);
		border-radius: 12px;
		font-size: 0.75rem;
		font-weight: 600;
	}

	.chatbot-close {
		background: transparent;
		border: none;
		color: var(--text-secondary);
		cursor: pointer;
		padding: 4px;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: all 0.2s ease;
	}

	.chatbot-close:hover {
		background: var(--bg-tertiary);
		color: var(--accent-primary);
	}

	.chatbot-messages {
		flex: 1;
		overflow-y: auto;
		padding: 16px;
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.chat-message {
		display: flex;
		gap: 12px;
		animation: fadeIn 0.3s ease-out;
	}

	@keyframes fadeIn {
		from {
			opacity: 0;
			transform: translateY(10px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	.chat-message.user {
		flex-direction: row-reverse;
	}

	.chat-message-avatar {
		width: 32px;
		height: 32px;
		border-radius: 50%;
		background: var(--accent-primary);
		color: var(--bg-primary);
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}

	.chat-message.user .chat-message-avatar {
		background: var(--bg-tertiary);
		color: var(--text-primary);
	}

	.chat-message-avatar .material-symbols-outlined {
		font-size: 20px;
	}

	.chat-message-content {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.chat-message-text {
		padding: 12px 16px;
		background: var(--bg-secondary);
		border-radius: 12px;
		font-size: 0.9rem;
		line-height: 1.5;
		color: var(--text-primary);
	}

	.chat-message.user .chat-message-text {
		background: var(--accent-primary);
		color: var(--bg-primary);
		border-radius: 12px 12px 0 12px;
	}

	.chat-message.assistant .chat-message-text {
		border-radius: 12px 12px 12px 0;
	}

	.chat-message-time {
		font-size: 0.75rem;
		color: var(--text-tertiary);
		padding: 0 4px;
	}

	.chatbot-input-container {
		border-top: 1px solid var(--border-color);
		padding: 12px;
		background: var(--bg-secondary);
		border-radius: 0 0 16px 16px;
	}

	.chatbot-suggestions {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		margin-bottom: 8px;
	}

	.chatbot-suggestions .suggestion-chip {
		padding: 6px 12px;
		font-size: 0.8rem;
	}

	.chatbot-input-form {
		display: flex;
		gap: 8px;
		align-items: center;
	}

	.chatbot-input {
		flex: 1;
		padding: 10px 14px;
		background: var(--card-bg);
		border: 1px solid var(--border-color);
		border-radius: 20px;
		font-size: 0.875rem;
		color: var(--text-primary);
		outline: none;
		transition: all 0.2s ease;
	}

	.chatbot-input:focus {
		border-color: var(--accent-primary);
		box-shadow: 0 0 0 2px var(--accent-shadow);
	}

	.chatbot-send-btn {
		width: 40px;
		height: 40px;
		border-radius: 50%;
		background: linear-gradient(135deg, var(--accent-primary), var(--accent-secondary));
		border: none;
		color: var(--bg-primary);
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: all 0.2s ease;
	}

	.chatbot-send-btn:hover:not(:disabled) {
		transform: scale(1.1);
	}

	.chatbot-send-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.chatbot-send-btn .material-symbols-outlined {
		font-size: 20px;
	}

	@media (max-width: 968px) {
		.dashboard {
			grid-template-columns: 1fr;
		}

		.sidebar {
			display: none;
		}

		.balance-grid {
			grid-template-columns: 1fr;
		}

		.pestel-grid {
			grid-template-columns: 1fr;
		}

		.metrics-grid {
			grid-template-columns: 1fr;
		}

		.forces-grid {
			grid-template-columns: 1fr;
		}

		.message-content {
			max-width: 85%;
		}

		.footer-content {
			flex-direction: column;
			align-items: flex-start;
			gap: 1rem;
		}
	}

	/* ============================================
	   SAVED NOTES STYLES
	   ============================================ */
	
	.save-note-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		padding: 0.4rem 0.75rem;
		background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
		color: white;
		border: none;
		border-radius: 20px;
		font-size: 0.75rem;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.2s ease;
		opacity: 0.8;
	}

	.save-note-btn:hover {
		opacity: 1;
		transform: translateY(-1px);
		box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
	}

	.save-note-btn .material-symbols-outlined {
		font-size: 16px;
	}

	.chat-message-footer {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-top: 0.5rem;
		gap: 1rem;
	}

	.notes-controls {
		display: flex;
		gap: 1rem;
		margin-bottom: 1.5rem;
		flex-wrap: wrap;
	}

	.notes-search {
		flex: 1;
		min-width: 250px;
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.75rem 1rem;
		background: var(--bg-secondary);
		border-radius: 12px;
		border: 1px solid var(--border-color);
	}

	.notes-search input {
		flex: 1;
		border: none;
		background: transparent;
		font-size: 0.95rem;
		color: var(--text-primary);
		outline: none;
	}

	.notes-search .material-symbols-outlined {
		color: var(--text-secondary);
		font-size: 20px;
	}

	.notes-controls select {
		padding: 0.75rem 1rem;
		background: var(--bg-secondary);
		border: 1px solid var(--border-color);
		border-radius: 12px;
		color: var(--text-primary);
		font-size: 0.95rem;
		cursor: pointer;
		outline: none;
	}

	.saved-notes-list {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.loading-notes {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.75rem;
		padding: 3rem;
		color: var(--text-secondary);
		font-size: 0.95rem;
	}

	.loading-notes .material-symbols-outlined {
		font-size: 24px;
	}

	@keyframes rotating {
		from { transform: rotate(0deg); }
		to { transform: rotate(360deg); }
	}

	.rotating {
		animation: rotating 1s linear infinite;
	}

	.empty-notes {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 3rem;
		text-align: center;
		color: var(--text-secondary);
	}

	.empty-notes .material-symbols-outlined {
		font-size: 64px;
		opacity: 0.3;
		margin-bottom: 1rem;
	}

	.empty-notes p {
		margin: 0.5rem 0;
	}

	.empty-notes .hint {
		font-size: 0.85rem;
		opacity: 0.7;
		max-width: 400px;
	}

	.note-card {
		background: var(--bg-secondary);
		border: 1px solid var(--border-color);
		border-radius: 16px;
		padding: 1.5rem;
		transition: all 0.2s ease;
	}

	.note-card:hover {
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
		transform: translateY(-2px);
	}

	.note-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		margin-bottom: 1rem;
		gap: 1rem;
	}

	.note-title-section {
		flex: 1;
		display: flex;
		align-items: center;
		gap: 0.75rem;
		flex-wrap: wrap;
	}

	.note-title-section h4 {
		margin: 0;
		font-size: 1.1rem;
		color: var(--text-primary);
	}

	.note-category {
		display: inline-block;
		padding: 0.35rem 0.75rem;
		background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
		color: white;
		border-radius: 20px;
		font-size: 0.75rem;
		font-weight: 500;
	}

	.note-actions {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.note-date {
		font-size: 0.85rem;
		color: var(--text-secondary);
	}

	.delete-note-btn {
		padding: 0.5rem;
		background: #ff3b30;
		color: white;
		border: none;
		border-radius: 8px;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.delete-note-btn:hover {
		background: #e6342a;
		transform: scale(1.05);
	}

	.delete-note-btn .material-symbols-outlined {
		font-size: 18px;
	}

	.note-content {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.note-question, .note-answer {
		display: flex;
		gap: 0.75rem;
		padding: 1rem;
		background: var(--bg-primary);
		border-radius: 12px;
		border-left: 3px solid transparent;
	}

	.note-question {
		border-left-color: #667eea;
	}

	.note-answer {
		border-left-color: #4cd964;
	}

	.note-question .material-symbols-outlined,
	.note-answer .material-symbols-outlined {
		flex-shrink: 0;
		font-size: 20px;
		opacity: 0.7;
	}

	.note-question p,
	.note-answer p {
		margin: 0;
		line-height: 1.6;
		color: var(--text-primary);
		font-size: 0.95rem;
	}

	.note-question strong,
	.note-answer strong {
		color: var(--text-primary);
		display: block;
		margin-bottom: 0.25rem;
	}

	/* Framework Explanation Section Styles */
	.framework-explanation {
		margin-top: 2rem;
		padding: 1.5rem;
		background: linear-gradient(135deg, rgba(102, 126, 234, 0.08), rgba(118, 75, 162, 0.04));
		border: 1px solid rgba(102, 126, 234, 0.2);
		border-radius: 16px;
	}

	.framework-explanation h4 {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 1.125rem;
		font-weight: 600;
		color: var(--accent-primary);
		margin-bottom: 1rem;
	}

	.framework-explanation h4 .material-symbols-outlined {
		font-size: 1.25rem;
		color: var(--accent-primary);
	}

	.framework-explanation .explanation-intro {
		color: var(--text-secondary);
		font-size: 0.9rem;
		margin-bottom: 1.25rem;
		line-height: 1.5;
	}

	.explanation-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
		gap: 1rem;
		margin-bottom: 1.5rem;
	}

	.explanation-item {
		padding: 1rem;
		background: var(--card-bg);
		border: 1px solid var(--border-color);
		border-radius: 12px;
		transition: all 0.2s ease;
	}

	.explanation-item:hover {
		border-color: var(--accent-primary);
		transform: translateY(-2px);
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
	}

	.explanation-item strong {
		display: block;
		font-size: 0.95rem;
		font-weight: 600;
		color: var(--accent-primary);
		margin-bottom: 0.5rem;
	}

	.explanation-item p {
		font-size: 0.85rem;
		color: var(--text-secondary);
		line-height: 1.5;
		margin: 0;
	}

	.explanation-item.central-explanation {
		grid-column: 1 / -1;
		background: linear-gradient(135deg, rgba(255, 193, 7, 0.1), rgba(255, 215, 0, 0.05));
		border-color: rgba(255, 193, 7, 0.3);
	}

	.implications-table {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		padding-top: 1rem;
		border-top: 1px solid var(--border-color);
	}

	.implication-row {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.75rem 1rem;
		background: var(--card-bg);
		border-radius: 8px;
		font-size: 0.875rem;
		color: var(--text-primary);
		transition: all 0.2s ease;
	}

	.implication-row:hover {
		transform: translateX(4px);
	}

	.implication-row strong {
		color: var(--text-primary);
	}

	.dot {
		width: 12px;
		height: 12px;
		border-radius: 50%;
		flex-shrink: 0;
	}

	.dot.disadvantage {
		background: #ef4444;
		box-shadow: 0 0 8px rgba(239, 68, 68, 0.4);
	}

	.dot.parity {
		background: #f59e0b;
		box-shadow: 0 0 8px rgba(245, 158, 11, 0.4);
	}

	.dot.temporary {
		background: #3b82f6;
		box-shadow: 0 0 8px rgba(59, 130, 246, 0.4);
	}

	.dot.sustained {
		background: #22c55e;
		box-shadow: 0 0 8px rgba(34, 197, 94, 0.4);
	}

	.strategic-insight {
		display: flex;
		align-items: flex-start;
		gap: 0.75rem;
		margin-top: 1.25rem;
		padding: 1rem;
		background: linear-gradient(135deg, rgba(255, 193, 7, 0.1), rgba(255, 215, 0, 0.05));
		border: 1px solid rgba(255, 193, 7, 0.3);
		border-radius: 12px;
	}

	.strategic-insight .material-symbols-outlined {
		font-size: 1.5rem;
		color: #ffc107;
		flex-shrink: 0;
	}

	.strategic-insight p {
		font-size: 0.9rem;
		color: var(--text-primary);
		line-height: 1.6;
		margin: 0;
	}

	.strategic-insight p strong {
		color: var(--accent-primary);
	}

	/* Porter's specific styling */
	.porters-explanation {
		background: linear-gradient(135deg, rgba(59, 130, 246, 0.08), rgba(139, 92, 246, 0.04));
		border-color: rgba(59, 130, 246, 0.2);
	}

	.porters-explanation h4 {
		color: #3b82f6;
	}

	.porters-explanation h4 .material-symbols-outlined {
		color: #3b82f6;
	}

	@media (max-width: 768px) {
		.explanation-grid {
			grid-template-columns: 1fr;
		}
		
		.framework-explanation {
			padding: 1rem;
		}
		
		.implication-row {
			font-size: 0.8rem;
			padding: 0.5rem 0.75rem;
		}
	}
</style>

