<script lang="ts">
	import { onMount } from 'svelte';
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
	let monitoredCompetitors: string[] = [];
	let loading = false;
	let sidebarMinimized = false;
	let theme = 'light';
	let hasRevenue: boolean | null = null; // Track conditional path
	let isPreRevenue = false; // Determined by Q9 answer
	let showChatbot = false; // Floating chatbot visibility
	let selectedCompetitor: any = null; // For modal display
	let showMethodologyModal = false; // For methodology breakdown modal

	// AI Chatbot state
	let chatMessages: Array<{role: string, content: string, timestamp: Date}> = [];
	let chatInput = '';
	let chatLoading = false;
	let chatContainer: HTMLElement;

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
			question: 'Business category selection',
			type: 'dropdown',
			options: ['SaaS', 'Mobile App', 'E-commerce', 'AI/ML', 'Hardware', 'Marketplace', 'Consulting', 'FMCG', 'Other'],
			required: true
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
			question: 'Total investment to date',
			type: 'number',
			placeholder: 'Total invested so far in INR (including personal funds)',
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
			question: 'Founder background',
			type: 'dropdown',
			options: ['Technical', 'Business', 'Industry Expert', 'Previous Startup', 'Finance', 'Marketing', 'Other'],
			required: true
		},
		{
			id: 19,
			section: 'Team & Operations',
			question: 'Biggest current challenge',
			type: 'dropdown',
			options: ['Customers', 'Product', 'Funding', 'Team', 'Competition', 'Regulations', 'Tech', 'Other'],
			required: true
		}
	];

	// SECTION 5: Growth Strategy (3 questions)
	const section5Questions = [
		{
			id: 20,
			section: 'Growth Strategy',
			question: 'Customer acquisition strategy',
			type: 'dropdown',
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
			question: 'Primary business risk',
			type: 'dropdown',
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
				...section3AQuestions,
				...section4Questions,
				...section5Questions,
				...section6Questions
			];
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
			];
		}
		// Force reactivity update
		ddqQuestions = ddqQuestions;
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

	onMount(async () => {
		const token = localStorage.getItem('accessToken');
		const userData = localStorage.getItem('user');
		const savedTheme = localStorage.getItem('theme') || 'light';
		theme = savedTheme;
		document.documentElement.setAttribute('data-theme', theme);

		if (!token || !userData) {
			goto('/auth/login');
			return;
		}

		user = JSON.parse(userData);
		
		// Load saved DDQ responses
		const saved = localStorage.getItem('ddq_progress');
		if (saved) {
			ddqResponses = JSON.parse(saved);
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
					calculateValuation();
					
					// Also load SWOT, funding schemes, and competitors
					generateSWOT().catch(err => console.warn('SWOT generation failed:', err));
					getFundingSchemes().catch(err => console.warn('Funding schemes failed:', err));
					getCompetitors().catch(err => console.warn('Competitor analysis failed:', err));
					
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
		// Don't reset responses, keep any saved progress
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
		
		// Check if this is Q11 (paying customers decision - the conditional trigger)
		if (currentQuestionData.conditional && ddqResponses[currentQuestionData.id]) {
			handleRevenueDecision(ddqResponses[currentQuestionData.id]);
		}
		
		// Save current answer to localStorage
		localStorage.setItem('ddq_progress', JSON.stringify(ddqResponses));

		if (currentQuestion < ddqQuestions.length - 1) {
			currentQuestion++;
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
					companyStage: ddqResponses[4], // Q4: Product stage
					revenue: hasRevenue ? parseInt(ddqResponses[12]) : 0, // Q12: Current monthly revenue (if revenue business)
					fundingNeeded: parseInt(ddqResponses[21]) || 0, // Q21: Funding needed for goals
					category: ddqResponses[3], // Q3: Business category
					totalInvestment: parseInt(ddqResponses[10]) || 0, // Q10: Total investment received
					monthlyExpenses: hasRevenue ? 0 : (parseInt(ddqResponses[15]) || 0), // Q15: Monthly expenses (pre-revenue)
					customerCount: hasRevenue ? (parseInt(ddqResponses[14]) || 0) : 0 // Q14: Total customer count
				})
			});

			if (!response.ok) {
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
			activeTab = 'valuation';
			
			// Trigger 5-second confetti celebration
			triggerConfetti();
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
		const teamSize = parseInt(ddqResponses[16]) || 1; // Q16: Team size including founder
		const founderBackground = ddqResponses[17] || 'Other'; // Q17: Founder background

		// Team size bonus
		if (teamSize >= 20) score += 1.5;
		else if (teamSize >= 11) score += 1.2;
		else if (teamSize >= 6) score += 0.8;
		else if (teamSize >= 4) score += 0.5;
		else if (teamSize >= 2) score += 0.3;

		// Founder background bonus
		if (founderBackground === 'Previous Startup') score += 1.2;
		else if (founderBackground === 'Industry Expert') score += 1.0;
		else if (founderBackground === 'Technical') score += 0.8;
		else if (founderBackground === 'Business' || founderBackground === 'Finance') score += 0.6;

		return Math.min(score, 5);
	}

	function calculateProductScore(): number {
		let score = 2; // Base score
		const stage = ddqResponses[4] || 'Idea'; // Q4: Product stage

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
		const marketType = ddqResponses[8] || 'B2C'; // Q8: Type of marketing preferred
		const category = ddqResponses[3] || 'Other'; // Q3: Business category
		const interviews = ddqResponses[9] || '0'; // Q9: Customer interviews completed

		// Marketing type bonus
		if (marketType.includes('B2B')) score += 0.8; // B2B typically higher valuation
		else if (marketType.includes('B2G')) score += 1.0; // Government contracts can be lucrative
		else if (marketType.includes('B2C')) score += 0.5;

		// High-growth category bonus (updated categories)
		const highGrowthCategories = ['SaaS', 'AI/ML', 'Mobile App'];
		if (highGrowthCategories.includes(category)) score += 0.7;
		else if (category === 'E-commerce' || category === 'Marketplace') score += 0.5;

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
			const currentRevenue = parseInt(ddqResponses[12]) || 0; // Q12: Current monthly revenue
			const revenue3mo = parseInt(ddqResponses[13]) || 0; // Q13: Revenue 3 months ago
			const totalCustomers = parseInt(ddqResponses[14]) || 0; // Q14: Total customer count
			const avgRevenuePerCustomer = parseInt(ddqResponses[15]) || 0; // Q15: Average revenue per customer

			// Current revenue scoring
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
			const firstCustomerTimeline = ddqResponses[12] || 'Uncertain'; // Q12: Expected first customer timeline
			const plannedPricing = parseInt(ddqResponses[13]) || 0; // Q13: Planned pricing model

			// Timeline to revenue bonus
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
		const totalInvestment = parseInt(ddqResponses[10]) || 0; // Q10: Total investment received till now
		
		// Check burn rate based on revenue status
		let burnRate = 0;
		if (hasRevenue) {
			// For revenue businesses, burn might not be explicitly asked, estimate from current operations
			burnRate = parseInt(ddqResponses[15]) || 0; // Could be avg revenue per customer as proxy
		} else {
			burnRate = parseInt(ddqResponses[15]) || 0; // Q15: Monthly expenses/burn rate (pre-revenue)
		}

		// Funding raised bonus
		if (totalInvestment >= 10000000) score += 1.5; // 1Cr+
		else if (totalInvestment >= 5000000) score += 1.2; // 50L+
		else if (totalInvestment >= 1000000) score += 0.8; // 10L+
		else if (totalInvestment >= 500000) score += 0.4; // 5L+
		else if (totalInvestment === 0) score += 0.2; // Bootstrapped shows resourcefulness

		// Runway calculation (if we have burn rate)
		if (hasRevenue) {
			const currentRevenue = parseInt(ddqResponses[12]) || 0;
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
		const biggestChallenge = ddqResponses[18] || ''; // Q18: Biggest current challenge

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

			console.log('📊 Generating SWOT analysis...', {
				industry: ddqResponses[3],
				competitors: ddqResponses[5],
				stage: ddqResponses[4]
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
						category: ddqResponses[3],
						stage: ddqResponses[4],
						hasRevenue,
						targetCustomer: ddqResponses[7]
					},
					industry: ddqResponses[3],
					competitors: ddqResponses[5]
				})
			});

			if (!response.ok) {
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
			const industry = ddqResponses[3] || 'Technology';
			const state = ddqResponses[4] || 'Other';
			const stage = ddqResponses[5] || 'Growing';
			const competitors = ddqResponses[6] || 'Market competitors';
			const uniqueValue = ddqResponses[7] || '';
			const teamSize = parseInt(ddqResponses[17]) || 1;
			const founderBackground = ddqResponses[18] || '';
			const mainChallenge = ddqResponses[19] || '';
			const acquisitionChannel = ddqResponses[20] || '';
			
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
			
			// Founder background strength
			if (founderBackground.includes('Previous Startup')) {
				strengths.push('Proven entrepreneurial experience from previous startup journey');
			} else if (founderBackground.includes('Industry Expert')) {
				strengths.push(`Deep industry expertise and networks in ${industry} sector`);
			} else if (founderBackground.includes('Technical')) {
				strengths.push('Strong technical foundation for product development and innovation');
			}
			
			// Revenue/Traction strength
			if (hasRevenue) {
				const revenue = parseInt(ddqResponses[12]) || 0;
				const customers = parseInt(ddqResponses[14]) || 0;
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
			
			const centralSchemes = [];
			
			// SISFS - Startup India Seed Fund Scheme
			if (fundingNeeded <= 5000000) { // <= ₹50L
				centralSchemes.push({
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
						: 'Consider applying if DPIIT recognized and < 2 years old'
				});
			}
			
			// CGSS - Credit Guarantee Scheme
			if (fundingNeeded >= 1000000) { // >= ₹10L
				centralSchemes.push({
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
						: 'Focus on achieving revenue first to qualify for this scheme'
				});
			}
			
			// GENESIS - AI/ML specific
			if (category === 'AI/ML' || category === 'Technology') {
				centralSchemes.push({
					name: 'GENESIS - Gen-Next Support for Innovative Startups',
					amount: 'Up to ₹1 Crore',
					eligibility: 'Deep tech startups in AI/ML, IoT, Blockchain, AR/VR, Robotics',
					benefits: 'Product development support, mentorship, market access, international expansion',
					eligible: isEligibleForGENESIS,
					eligibilityStatus: isEligibleForGENESIS ? 'eligible' : 'partial',
					reasoning: category === 'AI/ML'
						? 'Perfect fit for AI/ML deep tech startup'
						: 'Technology startups can apply if product has deep tech component'
				});
			}
			
			// EdTech specific scheme
			if (isEdTech) {
				centralSchemes.push({
					name: 'Atal Innovation Mission - Ed-AII',
					amount: 'Up to ₹2 Crores',
					eligibility: 'Education technology startups with innovative learning solutions',
					benefits: 'Grants for product development, pilot programs, mentorship, scale-up support',
					eligible: true,
					eligibilityStatus: 'eligible',
					reasoning: `As an ${category} startup, you're directly eligible for education-focused schemes`
				});
			}
			
			// State-level schemes
			const stateSchemes = [];
			if (isEligibleForStateScheme) {
				stateSchemes.push({
					name: `${location} State Startup Fund`,
					amount: 'Up to ₹25 Lakhs',
					eligibility: `State-registered startups operating in ${location}`,
					benefits: 'Seed funding, mentorship, incubation support, networking opportunities',
					eligible: true,
					eligibilityStatus: 'eligible',
					reasoning: `Based in ${location} - check with state startup cell for application process`
				});
			}
			
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

			console.log('🏢 Fetching competitors...', { category, stage, revenue });

			const response = await fetch(`${API_URL}/api/analysis/competitors`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${token}`
				},
				body: JSON.stringify({
					category,
					stage,
					revenue
				})
			});

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}));
				console.error('❌ Competitors API error:', response.status, errorData);
				throw new Error(`API returned ${response.status}`);
			}

			const data = await response.json();
			console.log('✅ Competitors received:', data);
			competitors = data.competitors || [];
		} catch (error) {
			console.error('❌ Error getting competitors:', error);
			// INTELLIGENT fallback based on user's actual data
			const category = ddqResponses[3] || 'SaaS';
			const userCompetitors = (ddqResponses[6] || '').toLowerCase(); // Q6: User's mentioned competitors
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
					{ name: 'Dunzo', stage: 'Series F', currentValuation: 23000000000, earlyValuation: 800000000, growthRate: 420, revenue: 35000000, customers: 3000000, fundingRaised: 800000000, investments: ['Google - $12M', 'Reliance - $200M'], products: ['Hyperlocal Delivery', 'Quick Commerce', 'B2B Services'], visible: true },
					{ name: 'Zomato', stage: 'Public', currentValuation: 650000000000, earlyValuation: 20000000000, growthRate: 480, revenue: 4800000000, customers: 80000000, fundingRaised: 20000000000, investments: ['Info Edge - $1M', 'Ant Financial - $200M'], products: ['Food Delivery', 'Dining Out', 'Hyperpure'], visible: true },
					{ name: 'Swiggy', stage: 'Series J', currentValuation: 1050000000000, earlyValuation: 25000000000, growthRate: 520, revenue: 6500000000, customers: 120000000, fundingRaised: 25000000000, investments: ['Accel - $2M', 'Prosus - $1B'], products: ['Food Delivery', 'Instamart', 'Genie'], visible: true }
				];
			}
			// E-commerce detection
			else if (userCompetitors.includes('amazon') || userCompetitors.includes('flipkart') || 
			         userCompetitors.includes('meesho') || category === 'E-commerce') {
				intelligentCompetitors = [
					{ name: 'Meesho', stage: 'Series F', currentValuation: 49000000000, earlyValuation: 2000000000, growthRate: 500, revenue: 35000000, customers: 13000000, fundingRaised: 2000000000, investments: ['SoftBank - $300M', 'Meta - $50M'], products: ['Social Commerce', 'Supplier Network', 'Meesho Mall'], visible: true },
					{ name: 'Flipkart', stage: 'Acquired', currentValuation: 2000000000000, earlyValuation: 50000000000, growthRate: 450, revenue: 850000000000, customers: 450000000, fundingRaised: 50000000000, investments: ['Walmart - $16B'], products: ['E-commerce', 'Flipkart Plus', 'Grocery'], visible: true },
					{ name: 'Amazon India', stage: 'Public', currentValuation: 15000000000000, earlyValuation: 500000000000, growthRate: 380, revenue: 2500000000000, customers: 500000000, fundingRaised: 500000000000, investments: ['Amazon Global'], products: ['E-commerce', 'Prime', 'Fresh'], visible: true }
				];
			}
			// FinTech detection
			else if (userCompetitors.includes('paytm') || userCompetitors.includes('phonepe') || 
			         userCompetitors.includes('razorpay') || category === 'FinTech') {
				intelligentCompetitors = [
					{ name: 'Razorpay', stage: 'Series F', currentValuation: 75000000000, earlyValuation: 5000000000, growthRate: 480, revenue: 95000000, customers: 8000000, fundingRaised: 5000000000, investments: ['Sequoia - $10M', 'Tiger Global - $150M'], products: ['Payment Gateway', 'Banking', 'Payroll'], visible: true },
					{ name: 'Paytm', stage: 'Public', currentValuation: 450000000000, earlyValuation: 20000000000, growthRate: 420, revenue: 250000000, customers: 350000000, fundingRaised: 20000000000, investments: ['Alibaba - $680M', 'SoftBank - $1.4B'], products: ['Payments', 'Banking', 'Wealth'], visible: true },
					{ name: 'PhonePe', stage: 'Series E', currentValuation: 850000000000, earlyValuation: 15000000000, growthRate: 520, revenue: 180000000, customers: 450000000, fundingRaised: 15000000000, investments: ['Walmart - $700M'], products: ['UPI Payments', 'Insurance', 'Mutual Funds'], visible: true }
				];
			}
			// EdTech detection
			else if (userCompetitors.includes('byju') || userCompetitors.includes('unacademy') || 
			         userCompetitors.includes('upgrad') || category === 'EdTech' || category === 'Education') {
				intelligentCompetitors = [
					{ name: 'Unacademy', stage: 'Series H', currentValuation: 37000000000, earlyValuation: 3000000000, growthRate: 390, revenue: 28000000, customers: 50000000, fundingRaised: 3000000000, investments: ['SoftBank - $150M', 'General Atlantic - $440M'], products: ['Live Classes', 'Test Prep', 'Upskilling'], visible: true },
					{ name: 'UpGrad', stage: 'Series E', currentValuation: 28000000000, earlyValuation: 2500000000, growthRate: 360, revenue: 35000000, customers: 4000000, fundingRaised: 2500000000, investments: ['Temasek - $120M'], products: ['Online Degrees', 'Bootcamps', 'Corporate Training'], visible: true },
					{ name: "Byju's", stage: 'Series F', currentValuation: 220000000000, earlyValuation: 10000000000, growthRate: 480, revenue: 120000000, customers: 150000000, fundingRaised: 10000000000, investments: ['Sequoia - $50M', 'Tiger Global - $200M'], products: ['K-12 Learning', 'Test Prep', 'Coding'], visible: true }
				];
			}
			// SaaS / B2B detection
			else if (userCompetitors.includes('freshworks') || userCompetitors.includes('zoho') || 
			         userCompetitors.includes('salesforce') || category === 'SaaS' || category === 'B2B') {
				intelligentCompetitors = [
					{ name: 'Freshworks', stage: 'Public', currentValuation: 350000000000, earlyValuation: 10000000000, growthRate: 450, revenue: 500000000, customers: 50000, fundingRaised: 10000000000, investments: ['Accel - $5M', 'Tiger Global - $100M'], products: ['Freshdesk', 'Freshsales', 'Freshservice'], visible: true },
					{ name: 'Zoho', stage: 'Private', currentValuation: 250000000000, earlyValuation: 2000000000, growthRate: 400, revenue: 350000000, customers: 80000, fundingRaised: 2000000000, investments: ['Bootstrapped'], products: ['Zoho CRM', 'Zoho Mail', 'Zoho Suite'], visible: true },
					{ name: 'Postman', stage: 'Series D', currentValuation: 58000000000, earlyValuation: 3500000000, growthRate: 420, revenue: 45000000, customers: 25000, fundingRaised: 3500000000, investments: ['Insight Partners - $50M', 'CRV - $150M'], products: ['API Platform', 'Collaboration', 'Testing'], visible: true }
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
						products: [`${category} Solution`, 'Core Product', 'Platform'],
						visible: true
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
						products: [`${category} Platform`, 'Analytics', 'Enterprise Solution'],
						visible: true
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
						products: [`${category} Suite`, 'Enterprise', 'Global Platform'],
						visible: true
					}
				];
			}
			
			competitors = intelligentCompetitors;
			console.log(`📝 Using intelligent fallback competitors based on user's ${category} business and mentioned competitors: ${userCompetitors}`);
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
					stage: ddqResponses[4], // Q4: Product stage
					competitors: ddqResponses[5], // Q5: Main competitors
					uniqueValue: ddqResponses[6], // Q6: Competitive differentiation
					targetCustomer: ddqResponses[7], // Q7: Target customer description
					marketingType: ddqResponses[8], // Q8: Type of marketing preferred
					interviews: ddqResponses[9], // Q9: Customer interviews completed
					totalInvestment: ddqResponses[10], // Q10: Total investment received
					monthlyRevenue: hasRevenue ? ddqResponses[12] : 0, // Q12: Current monthly revenue
					expenses: hasRevenue ? 0 : ddqResponses[15], // Q15: Monthly expenses (pre-revenue)
					funding: ddqResponses[10], // Q10: Total investment (same as totalInvestment)
					customers: hasRevenue ? ddqResponses[14] : 0, // Q14: Total customer count
					teamSize: ddqResponses[16], // Q16: Team size
					founderBackground: ddqResponses[17], // Q17: Founder background
					challenge: ddqResponses[18], // Q18: Biggest current challenge
					acquisitionStrategy: ddqResponses[19], // Q19: Customer acquisition strategy
					primaryGoal: ddqResponses[20], // Q20: 6-month primary goal
					fundingNeeded: ddqResponses[21], // Q21: Funding needed for goals
					primaryRisk: ddqResponses[22] // Q22: Primary business risk
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
				content: `Hello! I am your AI Strategic Advisor, Prometheus. I have analyzed your business data and I am here to help you with:

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
				<span class="material-symbols-outlined logo-icon">multimodal_hand_eye</span>
				{#if !sidebarMinimized}
					<span class="logo-text">CoFounder</span>
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
				title="Overview"
			>
				<span class="material-symbols-outlined nav-icon">quick_reference_all</span>
				{#if !sidebarMinimized}
					<span class="nav-text">Overview</span>
				{/if}
			</button>
			<button
				class="nav-item"
				class:active={activeTab === 'valuation'}
				on:click={() => (activeTab = 'valuation')}
				title="Valuation"
			>
				<span class="material-symbols-outlined nav-icon">universal_currency_alt</span>
				{#if !sidebarMinimized}
					<span class="nav-text">Valuation</span>
				{/if}
			</button>
			<button
				class="nav-item"
				class:active={activeTab === 'strengths-weaknesses'}
				on:click={() => (activeTab = 'strengths-weaknesses')}
				title="Strengths vs Weaknesses"
			>
				<span class="material-symbols-outlined nav-icon">balance</span>
				{#if !sidebarMinimized}
					<span class="nav-text">Strengths vs Weaknesses</span>
				{/if}
			</button>
			<button
				class="nav-item"
				class:active={activeTab === 'pestel'}
				on:click={() => (activeTab = 'pestel')}
				title="Good vs Bad"
			>
				<span class="material-symbols-outlined nav-icon">currency_exchange</span>
				{#if !sidebarMinimized}
					<span class="nav-text">Good vs Bad</span>
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
				<div class="overview-section">
					<div class="welcome-card minimal-card">
						<div class="card-header">
							<span class="material-symbols-outlined icon-large">quick_reference_all</span>
							<h2 class="section-title">Your Strategic Command Center</h2>
						</div>
						<p class="section-text">
							Transform your qualitative insights into quantifiable value with our AI-powered
							analysis engine.
						</p>

						{#if Object.keys(ddqResponses).length === 0}
							<button class="btn-primary" on:click={startDDQ}>
								<span class="material-symbols-outlined">rocket_launch</span>
								Begin Assessment
							</button>
						{:else}
							<div class="stats-grid">
								<div class="stat-card minimal-card">
									<span class="material-symbols-outlined icon">business</span>
									<span class="stat-label">Company</span>
									<span class="stat-value">{ddqResponses[1] || 'N/A'}</span>
								</div>
								<div class="stat-card minimal-card">
									<span class="material-symbols-outlined icon">category</span>
									<span class="stat-label">Category</span>
									<span class="stat-value">{ddqResponses[3] || 'N/A'}</span>
								</div>
								<div class="stat-card minimal-card">
									<span class="material-symbols-outlined icon">timeline</span>
									<span class="stat-label">Stage</span>
									<span class="stat-value">{ddqResponses[4] || 'N/A'}</span>
								</div>
							</div>
						{/if}
					</div>

					{#if valuation}
						<div class="quick-insights minimal-card">
							<div class="card-header">
								<span class="material-symbols-outlined icon-large">trending_up</span>
								<h3 class="card-title">Quick Insights</h3>
							</div>
							<div class="insight-item">
								<span class="material-symbols-outlined icon">universal_currency_alt</span>
								<span>Estimated Valuation (INR)</span>
								<span class="accent-text">₹{(valuation.finalValuationINR / 10000000).toFixed(2)} Cr</span>
							</div>
							<div class="insight-item">
								<span class="material-symbols-outlined icon">currency_exchange</span>
								<span>Estimated Valuation (USD)</span>
								<span class="accent-text">${(valuation.finalValuationUSD / 1000000).toFixed(2)}M</span>
							</div>
						</div>
					{/if}
				</div>
			{:else if activeTab === 'valuation'}
				{#if valuation}
					<div class="valuation-section">
						<div class="minimal-card">
							<div class="card-header">
								<span class="material-symbols-outlined icon-large">universal_currency_alt</span>
								<h2 class="section-title">Company Valuation</h2>
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

									<!-- Financial Health Metrics -->
									<div class="financial-health-section">
										<h3 class="subsection-title">
											<span class="material-symbols-outlined">health_and_safety</span>
											Financial Health
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
						</h3>
					<div class="forces-grid">
						{#if true}
						{@const hasProprietaryTech = ddqResponses[17]?.includes('Yes')}
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
											<strong>Your Advantage:</strong> {ddqResponses[6] || 'Building unique value proposition'}
										</div>
									</div>
								{/if}
							</div>
						</div>
					</div>
				</div>
			{:else}
				<div class="minimal-card">
					<div class="empty-state">
						<span class="material-symbols-outlined icon-empty">universal_currency_alt</span>
						<h3>No Valuation Yet</h3>
						<p>Complete the assessment to view your company valuation</p>
							<button class="btn-primary" on:click={startDDQ}>
								<span class="material-symbols-outlined">rocket_launch</span>
								Start Assessment
							</button>
						</div>
					</div>
				{/if}
			
			<!-- Strengths vs Weaknesses Tab -->
			{:else if activeTab === 'strengths-weaknesses'}
				{#if swotAnalysis}
					<div class="strengths-weaknesses-section">
						<div class="minimal-card">
							<div class="card-header">
								<span class="material-symbols-outlined icon-large">balance</span>
								<h2 class="section-title">Internal Analysis: Strengths vs Weaknesses</h2>
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

							<!-- Balance Indicator -->
							{#if swotAnalysis}
								{@const strengthCount = swotAnalysis.strengths?.length || 0}
								{@const weaknessCount = swotAnalysis.weaknesses?.length || 0}
								{@const total = strengthCount + weaknessCount}
								{@const strengthPercent = total > 0 ? (strengthCount / total) * 100 : 50}
								<div class="balance-indicator">
									<div class="balance-label">Internal Balance Score</div>
									<div class="balance-bar">
										<div class="balance-fill strengths-fill" style="width: {strengthPercent}%"></div>
										<div class="balance-fill weaknesses-fill" style="width: {100 - strengthPercent}%"></div>
									</div>
									<div class="balance-stats">
										<span class="stat-item strengths-stat">
											<span class="material-symbols-outlined">trending_up</span>
											{strengthCount} Strengths
										</span>
										<span class="stat-item weaknesses-stat">
											<span class="material-symbols-outlined">trending_down</span>
											{weaknessCount} Weaknesses
										</span>
									</div>
								</div>
							{/if}

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
							
							
							<div class="vrio-grid">
								<!-- Proprietary Technology/IP -->
								{#if hasProprietaryTech}
									{@const isRare = hasTechnicalFounder && hasProprietaryTech}
									{@const hardToImitate = hasTechnicalFounder && hasProprietaryTech}
									{@const advantage = isOrganized && hardToImitate && isRare ? 'Sustained Competitive Advantage' : hardToImitate && isRare ? 'Temporary Advantage' : isRare ? 'Competitive Parity' : 'Competitive Disadvantage'}
										<div class="vrio-card {advantage.toLowerCase().replace(/\s+/g, '-')}">
											<div class="vrio-resource">
												<span class="material-symbols-outlined">verified</span>
												<h4>Proprietary Technology/IP</h4>
											</div>
											<div class="vrio-checks">
												<div class="vrio-check check-yes">
													<span class="material-symbols-outlined">check_circle</span>
													<span>Valuable</span>
												</div>
												<div class="vrio-check {isRare ? 'check-yes' : 'check-no'}">
													<span class="material-symbols-outlined">{isRare ? 'check_circle' : 'cancel'}</span>
													<span>{isRare ? 'Rare' : 'Common'}</span>
												</div>
												<div class="vrio-check {hardToImitate ? 'check-yes' : 'check-no'}">
													<span class="material-symbols-outlined">{hardToImitate ? 'check_circle' : 'cancel'}</span>
													<span>{hardToImitate ? 'Hard to Imitate' : 'Easy to Copy'}</span>
												</div>
												<div class="vrio-check {isOrganized ? 'check-yes' : 'check-no'}">
													<span class="material-symbols-outlined">{isOrganized ? 'check_circle' : 'cancel'}</span>
													<span>{isOrganized ? 'Organized' : 'Not Organized'}</span>
												</div>
											</div>
											<div class="vrio-result">
												<strong>{advantage}</strong>
											</div>
										</div>
									{/if}

								<!-- Founder Expertise -->
								{#if true}
								{@const expertiseAdvantage = hasExpertise && expertiseRare && isOrganized ? 'Sustained Competitive Advantage' : hasExpertise && expertiseRare ? 'Temporary Advantage' : hasExpertise ? 'Competitive Parity' : 'Competitive Disadvantage'}
									<div class="vrio-card {expertiseAdvantage.toLowerCase().replace(/\s+/g, '-')}">
										<div class="vrio-resource">
											<span class="material-symbols-outlined">school</span>
											<h4>Founder Expertise</h4>
										</div>
										<div class="vrio-checks">
											<div class="vrio-check {hasExpertise ? 'check-yes' : 'check-no'}">
												<span class="material-symbols-outlined">{hasExpertise ? 'check_circle' : 'cancel'}</span>
												<span>{hasExpertise ? 'Valuable' : 'Limited Value'}</span>
											</div>
											<div class="vrio-check {expertiseRare ? 'check-yes' : 'check-no'}">
												<span class="material-symbols-outlined">{expertiseRare ? 'check_circle' : 'cancel'}</span>
												<span>{expertiseRare ? 'Rare Combination' : 'Common'}</span>
											</div>
											<div class="vrio-check check-no">
												<span class="material-symbols-outlined">cancel</span>
												<span>Can Be Replicated</span>
											</div>
											<div class="vrio-check {isOrganized ? 'check-yes' : 'check-no'}">
												<span class="material-symbols-outlined">{isOrganized ? 'check_circle' : 'cancel'}</span>
												<span>{isOrganized ? 'Team Leverages' : 'Solo Effort'}</span>
											</div>
										</div>
										<div class="vrio-result">
											<strong>{expertiseAdvantage}</strong>
										</div>
									</div>
								{/if}

								<!-- Customer Base & Traction -->
								{#if true}
								{@const tractionAdvantage = customerValue && customerRare && hardToSteal && isOrganized ? 'Sustained Competitive Advantage' : customerValue && customerRare && hardToSteal ? 'Temporary Advantage' : customerValue ? 'Competitive Parity' : 'Competitive Disadvantage'}
									<div class="vrio-card {tractionAdvantage.toLowerCase().replace(/\s+/g, '-')}">
										<div class="vrio-resource">
											<span class="material-symbols-outlined">groups</span>
											<h4>Customer Base & Traction</h4>
										</div>
										<div class="vrio-checks">
											<div class="vrio-check {customerValue ? 'check-yes' : 'check-no'}">
												<span class="material-symbols-outlined">{customerValue ? 'check_circle' : 'cancel'}</span>
												<span>{customerValue ? 'Valuable' : 'Building'}</span>
											</div>
											<div class="vrio-check {customerRare ? 'check-yes' : 'check-no'}">
												<span class="material-symbols-outlined">{customerRare ? 'check_circle' : 'cancel'}</span>
												<span>{customerRare ? 'Significant Scale' : 'Early Stage'}</span>
											</div>
											<div class="vrio-check {hardToSteal ? 'check-yes' : 'check-no'}">
												<span class="material-symbols-outlined">{hardToSteal ? 'check_circle' : 'cancel'}</span>
												<span>{hardToSteal ? 'Sticky Customers' : 'At Risk'}</span>
											</div>
											<div class="vrio-check {isOrganized ? 'check-yes' : 'check-no'}">
												<span class="material-symbols-outlined">{isOrganized ? 'check_circle' : 'cancel'}</span>
												<span>{isOrganized ? 'Organized to Scale' : 'Limited Capacity'}</span>
											</div>
										</div>
										<div class="vrio-result">
											<strong>{tractionAdvantage}</strong>
										</div>
									</div>
								{/if}

									<!-- Unique Value Proposition -->
									{#if true}
									{@const uvpStrong = uniqueValue.length > 50}
									{@const uvpDifferentiated = !ddqResponses[5]?.toLowerCase().includes('none')}
									{@const uvpAdvantage = uvpStrong && isOrganized ? 'Temporary Advantage' : uvpStrong ? 'Competitive Parity' : 'Competitive Disadvantage'}
									
									<div class="vrio-card {uvpAdvantage.toLowerCase().replace(/\s+/g, '-')}">
										<div class="vrio-resource">
											<span class="material-symbols-outlined">auto_awesome</span>
											<h4>Unique Value Proposition</h4>
										</div>
										<div class="vrio-checks">
											<div class="vrio-check {uvpStrong ? 'check-yes' : 'check-no'}">
												<span class="material-symbols-outlined">{uvpStrong ? 'check_circle' : 'cancel'}</span>
												<span>{uvpStrong ? 'Well-Defined' : 'Needs Work'}</span>
											</div>
											<div class="vrio-check {uvpDifferentiated ? 'check-yes' : 'check-no'}">
												<span class="material-symbols-outlined">{uvpDifferentiated ? 'check_circle' : 'cancel'}</span>
												<span>{uvpDifferentiated ? 'Differentiated' : 'First Mover'}</span>
											</div>
											<div class="vrio-check check-no">
												<span class="material-symbols-outlined">cancel</span>
												<span>Can Be Copied</span>
											</div>
											<div class="vrio-check {isOrganized ? 'check-yes' : 'check-no'}">
												<span class="material-symbols-outlined">{isOrganized ? 'check_circle' : 'cancel'}</span>
												<span>{isOrganized ? 'Executing Well' : 'Execution Risk'}</span>
											</div>
										</div>
										<div class="vrio-result">
											<strong>{uvpAdvantage}</strong>
										</div>
									</div>
								{/if}
								</div>

								<!-- VRIO Summary -->
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
									<p>
										{#if sustainedCount >= 2}
											<strong>Strong Position:</strong> You have {sustainedCount} resources with sustained competitive advantages. 
											Focus on protecting and leveraging these assets while scaling operations.
										{:else if sustainedCount === 1}
											<strong>Developing Position:</strong> You have 1 sustainable advantage. 
											Work on strengthening other resources and building organizational capabilities.
										{:else}
											<strong>Building Phase:</strong> Focus on developing rare and hard-to-imitate resources. 
											Consider building proprietary technology, deepening expertise, and growing your customer base.
										{/if}
									</p>
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

			<!-- Good vs Bad Tab -->
			{:else if activeTab === 'pestel'}
				{#if swotAnalysis}
					<div class="pestel-section">
						<div class="minimal-card">
							<div class="card-header">
								<span class="material-symbols-outlined icon-large">currency_exchange</span>
								<h2 class="section-title">Good vs Bad</h2>
								<p class="section-subtitle">External factors that could impact your startup's success</p>
							</div>

							<div class="balance-grid">
								<!-- Opportunities (Good) -->
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

								<!-- Threats (Bad) -->
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

							<!-- External Balance Indicator -->
							{#if swotAnalysis}
								{@const opportunityCount = swotAnalysis.opportunities?.length || 0}
								{@const threatCount = swotAnalysis.threats?.length || 0}
								{@const total = opportunityCount + threatCount}
								{@const opportunityPercent = total > 0 ? (opportunityCount / total) * 100 : 50}
								<div class="balance-indicator">
									<div class="balance-label">External Environment Score</div>
									<div class="balance-bar">
										<div class="balance-fill opportunities-fill" style="width: {opportunityPercent}%"></div>
										<div class="balance-fill threats-fill" style="width: {100 - opportunityPercent}%"></div>
									</div>
									<div class="balance-stats">
										<span class="stat-item opportunities-stat">
											<span class="material-symbols-outlined">check_circle</span>
											{opportunityCount} Opportunities
										</span>
										<span class="stat-item threats-stat">
											<span class="material-symbols-outlined">warning</span>
											{threatCount} Threats
										</span>
									</div>
								</div>
							{/if}
						</div>
					</div>
				{:else}
					<div class="minimal-card">
						<div class="empty-state">
							<span class="material-symbols-outlined icon-empty">balance</span>
							<h3>No Analysis Available</h3>
							<p>Complete the assessment to view opportunities and threats</p>
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
								<p class="section-subtitle">Track top competitors and market performance</p>
							</div>

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

							<!-- Performance Graph -->
							<div class="performance-section">
								<h3 class="subsection-title">
									<span class="material-symbols-outlined">trending_up</span>
									Valuation Growth Comparison
								</h3>
								<div class="chart-container">
									<div class="chart-legend">
										<div class="legend-item">
											<div class="legend-color early"></div>
											<span>Early Stage Valuation</span>
										</div>
										<div class="legend-item">
											<div class="legend-color current"></div>
											<span>Current Valuation</span>
										</div>
									</div>
									<div class="bar-chart">
										{#each competitors.filter((c: any) => c.visible) as competitor, index}
											<div class="chart-row">
												<div class="chart-label">{competitor.name}</div>
												<div class="chart-bars">
													<div 
														class="chart-bar early" 
														style="width: {(competitor.earlyValuation / Math.max(...competitors.map((c: any) => c.currentValuation))) * 100}%"
													>
														<span class="bar-value">₹{(competitor.earlyValuation / 10000000).toFixed(1)}Cr</span>
													</div>
													<div 
														class="chart-bar current" 
														style="width: {(competitor.currentValuation / Math.max(...competitors.map((c: any) => c.currentValuation))) * 100}%"
													>
														<span class="bar-value">₹{(competitor.currentValuation / 10000000).toFixed(1)}Cr</span>
													</div>
												</div>
											</div>
										{/each}
									</div>
								</div>
							</div>

							<!-- Competitor Cards Grid -->
							<div class="competitors-grid">
								{#each competitors as competitor, index}
									<div class="competitor-card" class:hidden={!competitor.visible}>
										<div class="competitor-header">
											<h4>{competitor.name}</h4>
											<div class="competitor-actions">
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
											<span class="stage-badge">{competitor.stage}</span>
											<span class="category-badge">{competitor.category}</span>
										</div>

										<div class="competitor-metrics">
											<div class="metric-item">
												<span class="material-symbols-outlined">trending_up</span>
												<div>
													<div class="metric-label">Growth Rate</div>
													<div class="metric-value">{competitor.growthRate}%</div>
												</div>
											</div>
											<div class="metric-item">
												<span class="material-symbols-outlined">currency_rupee</span>
												<div>
													<div class="metric-label">Revenue</div>
													<div class="metric-value">₹{(competitor.revenue / 10000000).toFixed(1)}Cr</div>
												</div>
											</div>
											<div class="metric-item">
												<span class="material-symbols-outlined">groups</span>
												<div>
													<div class="metric-label">Customers</div>
													<div class="metric-value">{competitor.customers.toLocaleString()}</div>
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
							</div>
						</div>
					</div>
				{/if}

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
							<h2 class="section-title">🎯 SWOT Analysis</h2>
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
						<p>Complete the DDQ to generate SWOT analysis</p>
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
										<span class="schemes-count">{fundingSchemes.centralSchemes?.length || 0} schemes</span>
									</div>
									<div class="schemes-grid">
										{#each fundingSchemes.centralSchemes || [] as scheme}
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
															{:else if scheme.eligibilityStatus === 'partial'}
																<span class="material-symbols-outlined">info</span>
																Partially Eligible
															{:else}
																<span class="material-symbols-outlined">cancel</span>
																Not Eligible
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
											</div>
										{/each}
									</div>
								</div>

								<!-- State Government Schemes -->
								{#if fundingSchemes.stateSchemes && fundingSchemes.stateSchemes.length > 0}
									<div class="schemes-section state-schemes">
										<div class="section-header">
											<div class="section-title-row">
												<span class="material-symbols-outlined section-icon">location_city</span>
												<h3 class="schemes-title">State Government Schemes</h3>
											</div>
											<span class="schemes-count">{fundingSchemes.stateSchemes?.length || 0} schemes</span>
										</div>
										<div class="schemes-grid">
											{#each fundingSchemes.stateSchemes || [] as scheme}
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
																{:else if scheme.eligibilityStatus === 'partial'}
																	<span class="material-symbols-outlined">info</span>
																	Partially Eligible
																{:else}
																	<span class="material-symbols-outlined">cancel</span>
																	Not Eligible
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
					<span class="footer-logo">CoFounder</span>
					<span class="footer-separator">•</span>
					<span class="footer-copyright">© 2024 All rights reserved</span>
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
					<h3>{selectedCompetitor.name}</h3>
					<button class="btn-icon" on:click={closeCompetitorModal}>
						<span class="material-symbols-outlined">close</span>
					</button>
				</div>
				<div class="modal-body">
					<div class="competitor-detail-section">
						<h4>
							<span class="material-symbols-outlined">attach_money</span>
							Funding Information
						</h4>
						<p class="detail-value">Total Raised: ₹{(selectedCompetitor.fundingRaised / 10000000).toFixed(2)} Cr</p>
						<p class="detail-label">Key Investments:</p>
						<ul class="investments-list">
							{#each selectedCompetitor.investments as investment}
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
							{#each selectedCompetitor.products as product}
								<span class="product-badge">{product}</span>
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
									<div class="detail-value">₹{(selectedCompetitor.currentValuation / 10000000).toFixed(2)} Cr</div>
								</div>
							</div>
							<div class="detail-metric">
								<span class="material-symbols-outlined">trending_up</span>
								<div>
									<div class="detail-label">Growth Rate</div>
									<div class="detail-value">{selectedCompetitor.growthRate}%</div>
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
							<h3>Prometheus</h3>
							<span class="chatbot-badge">Your AI Strategic Advisor</span>
						</div>
					</div>
					<button class="chatbot-close" on:click={() => showChatbot = false}>
						<span class="material-symbols-outlined">close</span>
					</button>
				</div>

				<div class="chatbot-messages" bind:this={chatContainer}>
					{#each chatMessages as message}
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
								<div class="chat-message-time">
									{message.timestamp.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
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
		background: var(--bg-secondary);
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
		border-bottom: 1px solid var(--border-color);
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
		gap: 0.75rem;
	}

	.sidebar.minimized .logo-section {
		justify-content: center;
	}

	.logo-icon {
		font-size: 1.75rem;
		color: #D4AF37 !important; /* Always golden in both light and dark mode */
		flex-shrink: 0;
	}

	.logo-text {
		font-size: 1.25rem;
		font-weight: 700;
		color: var(--text-primary);
		white-space: nowrap;
	}

	.sidebar-toggle {
		background: none;
		border: none;
		color: var(--text-secondary);
		cursor: pointer;
		padding: 0.5rem;
		border-radius: 6px;
		transition: all 0.2s ease;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.sidebar-toggle:hover {
		background: var(--bg-hover);
		color: var(--accent-primary);
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
		color: var(--text-secondary);
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
		background: var(--bg-hover);
		color: var(--text-primary);
	}

	.nav-item:hover .nav-icon {
		color: var(--accent-primary);
	}

	.nav-item.active {
		background: var(--accent-shadow);
		color: var(--accent-primary);
		font-weight: 600;
	}

	.nav-item.active .nav-icon {
		color: var(--accent-primary);
	}

	/* Overview */
	.overview-section {
		display: grid;
		gap: 2rem;
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
	}

	.card-header {
		display: flex;
		align-items: center;
		gap: 1rem;
		margin-bottom: 2rem;
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
		color: white;
		white-space: nowrap;
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

	.footer-logo {
		font-size: 1.125rem;
		font-weight: 700;
		color: var(--accent-primary);
		letter-spacing: -0.5px;
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
		margin-top: auto;
		border-top: 1px solid var(--border-color);
		padding-top: 1rem;
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

	/* Financial Health Metrics */
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
</style>
