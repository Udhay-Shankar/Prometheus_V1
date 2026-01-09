<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { goto } from '$app/navigation';
	import { writable } from 'svelte/store';
	import confetti from 'canvas-confetti';

	// API Configuration - use relative URLs in production (same domain)
	const API_URL = typeof window !== 'undefined' && window.location.hostname !== 'localhost' 
		? '' // Use relative URLs in production
		: (import.meta.env.VITE_API_URL || 'http://localhost:3001');

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
	
	// GTM To-Do List state
	interface GTMTodoItem {
		id: number;
		action: string;
		owner: string;
		expectedSignal: string;
		reviewDate: string;
		ragStatus: 'red' | 'amber' | 'green' | 'not-started';
		createdAt: Date;
	}
	let gtmTodoItems: GTMTodoItem[] = [];
	let newTodoAction = '';
	let newTodoOwner = 'Founder';
	let newTodoSignal = '';
	let newTodoReviewDate = '';
	let showAddTodoForm = false;
	
	function addGTMTodoItem() {
		if (!newTodoAction.trim()) return;
		
		const newItem: GTMTodoItem = {
			id: Date.now(),
			action: newTodoAction.trim(),
			owner: newTodoOwner || 'Founder',
			expectedSignal: newTodoSignal.trim() || 'To be defined',
			reviewDate: newTodoReviewDate || 'TBD',
			ragStatus: 'not-started',
			createdAt: new Date()
		};
		
		gtmTodoItems = [...gtmTodoItems, newItem];
		
		// Reset form
		newTodoAction = '';
		newTodoOwner = 'Founder';
		newTodoSignal = '';
		newTodoReviewDate = '';
		showAddTodoForm = false;
	}
	
	function updateTodoRAGStatus(id: number, status: 'red' | 'amber' | 'green' | 'not-started') {
		gtmTodoItems = gtmTodoItems.map(item => 
			item.id === id ? { ...item, ragStatus: status } : item
		);
	}
	
	function deleteTodoItem(id: number) {
		gtmTodoItems = gtmTodoItems.filter(item => item.id !== id);
	}
	
	// Dynamic GTM Strategy state
	let gtmStrategy: any = null;
	let gtmLoading = false;
	let gtmError = '';
	let activeGtmSection = 'overview'; // 'overview' | 'market' | 'positioning' | 'pricing' | 'distribution' | 'marketing' | 'launch' | 'metrics' | 'execution'
	let gtmHypothesisStatuses: Record<string, string> = {}; // Track hypothesis status locally
	
	// GTM Task Tracking State
	let gtmTasks: any[] = [];
	let gtmTasksLoading = false;
	let gtmFollowups: any[] = [];
	let showFollowupModal = false;
	let activeFollowup: any = null;
	let taskProgressInput = 0;
	let taskNoteInput = '';
	let showH3Modal = false;
	let h3Input = { title: '', description: '', reason: '', reversibility: '' };
	let showTaskStartModal = false;
	let taskToStart: any = null;
	
	// Load GTM Tasks
	async function loadGTMTasks() {
		try {
			const token = localStorage.getItem('accessToken');
			if (!token) return;
			
			const response = await fetch(`${API_URL}/api/gtm/tasks?status=active`, {
				headers: { 'Authorization': `Bearer ${token}` }
			});
			
			if (response.ok) {
				const data = await response.json();
				gtmTasks = data.tasks || [];
			}
		} catch (e) {
			console.error('Failed to load GTM tasks:', e);
		}
	}
	
	// Load AI Follow-ups
	async function loadGTMFollowups() {
		try {
			const token = localStorage.getItem('accessToken');
			if (!token) return;
			
			const response = await fetch(`${API_URL}/api/gtm/tasks/followups`, {
				headers: { 'Authorization': `Bearer ${token}` }
			});
			
			if (response.ok) {
				const data = await response.json();
				gtmFollowups = data.followups || [];
				if (gtmFollowups.length > 0) {
					showFollowupModal = true;
					activeFollowup = gtmFollowups[0];
				}
			}
		} catch (e) {
			console.error('Failed to load followups:', e);
		}
	}
	
	// Start tracking a task
	async function startGTMTask(taskType: string, category: string, recommendation: any) {
		try {
			const token = localStorage.getItem('accessToken');
			if (!token) return;
			
			const response = await fetch(`${API_URL}/api/gtm/tasks/start`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': `Bearer ${token}`
				},
				body: JSON.stringify({
					taskType,
					category,
					title: recommendation.title || recommendation.what,
					description: recommendation.description || recommendation.evidence,
					targetMetric: recommendation.targetMetric,
					targetValue: recommendation.targetValue,
					originalRecommendation: recommendation
				})
			});
			
			if (response.ok) {
				const data = await response.json();
				gtmTasks = [...gtmTasks, data.task];
				alert(data.welcomeMessage || 'Task started! Check back tomorrow for AI follow-up.');
				showTaskStartModal = false;
			}
		} catch (e) {
			console.error('Failed to start task:', e);
			alert('Failed to start task. Please try again.');
		}
	}
	
	// Update task progress
	async function updateTaskProgress(taskId: string, progress: number, note: string) {
		try {
			const token = localStorage.getItem('accessToken');
			if (!token) return;
			
			const response = await fetch(`${API_URL}/api/gtm/tasks/${taskId}/update`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': `Bearer ${token}`
				},
				body: JSON.stringify({ progress, note })
			});
			
			if (response.ok) {
				const data = await response.json();
				// Update local task
				gtmTasks = gtmTasks.map(t => t.taskId === taskId ? { ...t, progress } : t);
				// Show AI response
				if (data.aiResponse) {
					alert(`AI Co-founder: ${data.aiResponse}`);
				}
				// Close modal
				showFollowupModal = false;
				activeFollowup = null;
				taskProgressInput = 0;
				taskNoteInput = '';
			}
		} catch (e) {
			console.error('Failed to update task:', e);
		}
	}
	
	// Add H3 (Kill) task
	async function addH3Task() {
		try {
			const token = localStorage.getItem('accessToken');
			if (!token) return;
			
			const response = await fetch(`${API_URL}/api/gtm/tasks/h3`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': `Bearer ${token}`
				},
				body: JSON.stringify(h3Input)
			});
			
			if (response.ok) {
				const data = await response.json();
				gtmTasks = [...gtmTasks, data.task];
				showH3Modal = false;
				h3Input = { title: '', description: '', reason: '', reversibility: '' };
				alert(data.message || 'Added to your Kill list!');
			}
		} catch (e) {
			console.error('Failed to add H3:', e);
		}
	}
	
	// Generate GTM Strategy
	async function generateGTMStrategy() {
		gtmLoading = true;
		gtmError = '';
		
		try {
			const token = localStorage.getItem('accessToken');
			if (!token) throw new Error('Not authenticated');
			
			const response = await fetch(`${API_URL}/api/gtm/generate`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': `Bearer ${token}`
				},
				body: JSON.stringify({
					ddqResponses,
					valuation,
					swotAnalysis
				})
			});
			
			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(errorData.error || 'Failed to generate GTM strategy');
			}
			
			const data = await response.json();
			gtmStrategy = data.strategy;
			console.log('✅ GTM Strategy generated:', gtmStrategy);
			
		} catch (error: any) {
			console.error('GTM generation error:', error);
			gtmError = error.message || 'Failed to generate GTM strategy';
		} finally {
			gtmLoading = false;
		}
	}
	
	// Load saved GTM Strategy
	async function loadGTMStrategy() {
		try {
			const token = localStorage.getItem('accessToken');
			if (!token) return;
			
			const response = await fetch(`${API_URL}/api/gtm/latest`, {
				headers: {
					'Authorization': `Bearer ${token}`
				}
			});
			
			if (response.ok) {
				const data = await response.json();
				gtmStrategy = data.strategy;
				console.log('✅ GTM Strategy loaded from cache');
			}
		} catch (error) {
			console.log('No cached GTM strategy found');
		}
	}
	
	// Update hypothesis status locally
	function updateHypothesisStatus(hypothesisId: string, newStatus: string) {
		gtmHypothesisStatuses[hypothesisId] = newStatus;
		gtmHypothesisStatuses = { ...gtmHypothesisStatuses };
	}
	
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
			title: 'Founder Decision Intelligence',
			description: 'Not generic advice. Three actionable lenses: Value Driver Analysis (what moves company value most), Decision Impact Analysis (what happens if you act), and Trajectory & Trigger Analysis (where you\'re heading and when to intervene).',
			calculation: 'Analyzes your specific situation to answer: What should you do next, and why is that the highest-leverage move? Each lens is ranked by expected valuation impact with clear reversibility ratings.'
		},
		'value-driver': {
			title: 'Value Driver Analysis',
			description: 'Identifies the top 3 factors that move your company value RIGHT NOW. Not a generic framework—specific to your stage, revenue, and situation. Each driver is assessed for signal strength and controllability.',
			calculation: 'Ranks drivers by expected valuation impact. Signal strength: Weak (early signal, needs validation), Medium (clear trend, actionable), Strong (proven, optimize now). Controllability indicates if you can impact this in 30-60 days.'
		},
		'decision-impact': {
			title: 'Decision Impact Analysis',
			description: 'Analyzes specific founder decisions with clear scenarios. Shows impact on runway, growth momentum, and valuation perception. Ends with a recommendation, not a summary.',
			calculation: 'Compares Act Now vs Delay scenarios. Each path shows: runway impact, growth impact, valuation perception change, key downside risk, and reversibility (High/Medium/Low). Exposes uncertainty rather than hiding it.'
		},
		'trajectory-trigger': {
			title: 'Trajectory & Trigger Analysis',
			description: 'Your current trajectory (stable/accelerating/fragile) with explicit triggers: If X happens → do Y. Includes time-based and metric-based thresholds. States what happens if you take no action.',
			calculation: 'Identifies 2-3 leading indicators signaling risk or upside. Triggers are specific: metric thresholds, time windows, competitive moves. Each trigger has a prescribed response.'
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
		},
		'simulation': {
			title: 'Decision Simulation',
			description: 'Simulate the impact of a decision BEFORE you make it. Input a scenario and see projected outcomes across multiple dimensions.',
			calculation: 'Uses your current metrics as baseline, then models the decision impact on: runway, growth rate, valuation perception, team capacity, and market position. Shows confidence intervals, not false precision.'
		}
	};
	
	// Decision Simulation state
	let simulationInput = '';
	let simulationResult: {
		scenario: string;
		runwayImpact: { value: string; direction: 'positive' | 'negative' | 'neutral' };
		growthImpact: { value: string; direction: 'positive' | 'negative' | 'neutral' };
		valuationImpact: { value: string; direction: 'positive' | 'negative' | 'neutral' };
		riskLevel: 'low' | 'medium' | 'high';
		recommendation: string;
		confidence: number;
		summary?: string;
		bestCase?: { description: string; metrics: string[]; timeline: string };
		worstCase?: { description: string; risks: string[]; mitigation: string[] };
		nextSteps?: string[];
		alternativeApproaches?: { approach: string; tradeoff: string }[];
	} | null = null;
	let simulationLoading = false;
	
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

	// Strategic Advisor state
	let advisorMessages: Array<{role: string, content: string, timestamp: Date, saved?: boolean}> = [];
	let advisorInput = '';
	let advisorLoading = false;
	let advisorContainer: HTMLElement;

	// InFinity Stats state
	interface InfinityStats {
		totalRevenue: number;
		totalInvestment: number;
		monthlyRevenue: number;
		monthlyBurn: number;
		runway: number;
		status: string;
		revenueGrowth: number;
	}
	let infinityStats: InfinityStats | null = null;
	let infinityLoading = false;
	let infinityError = '';

	// Format value to Lakhs for display
	function formatLakhs(value: number): string {
		return `₹${(value / 100000).toFixed(1)}L`;
	}

	// Fetch InFinity stats
	async function fetchInfinityStats() {
		try {
			infinityLoading = true;
			infinityError = '';
			
			// First check if we have cached InFinity data from login (email-matched)
			const cachedInfinityData = localStorage.getItem('infinityData');
			const infinityLinkedFlag = localStorage.getItem('infinityLinked');
			
			if (infinityLinkedFlag === 'true' && cachedInfinityData) {
				try {
					const parsedData = JSON.parse(cachedInfinityData);
					infinityStats = parsedData;
					console.log('📊 Using cached InFinity data from login (email-matched)');
					infinityLoading = false;
					// Continue to fetch fresh data in background
				} catch (e) {
					console.log('⚠️ Could not parse cached InFinity data');
				}
			}
			
			const token = localStorage.getItem('accessToken');
			if (!token) {
				infinityError = 'Not authenticated';
				return;
			}

			const response = await fetch(`${API_URL}/api/infinity/stats`, {
				headers: {
					'Authorization': `Bearer ${token}`
				}
			});

			if (!response.ok) {
				throw new Error('Failed to fetch InFinity stats');
			}

			const result = await response.json();
			if (result.success && result.data) {
				infinityStats = result.data;
				// Update cached data
				localStorage.setItem('infinityData', JSON.stringify(result.data));
				if (result.linkedByEmail) {
					localStorage.setItem('infinityLinked', 'true');
					console.log(`✅ InFinity data synced for email: ${result.linkedByEmail}`);
				}
			} else if (result.data) {
				infinityStats = result.data;
			}
			
			// Show message if not connected
			if (result.message && !result.linkedByEmail) {
				console.log('ℹ️ ' + result.message);
			}
		} catch (error) {
			console.error('Error fetching InFinity stats:', error);
			infinityError = 'Could not load InFinity data';
		} finally {
			infinityLoading = false;
		}
	}

	// Get persona-based suggested questions - ENHANCED for founder objectives
	function getAdvisorQuestions(): Array<{question: string, icon: string, category: string}> {
		const stage = ddqResponses[5] || 'Idea';
		const hasRevenue = ddqResponses[12] === 'Yes';
		const challenges = ddqResponses[19] || [];
		const productName = ddqResponses[1] || 'your product';
		const sixMonthGoal = ddqResponses[21] || '';
		const customerCount = Number(ddqResponses[15] || 0);
		const monthlyRevenue = Number(ddqResponses[13] || 0);
		
		// Challenge-specific questions (highest priority)
		const primaryChallenge = Array.isArray(challenges) ? challenges[0] : challenges;
		
		const challengeQuestions: Record<string, Array<{question: string, icon: string, category: string}>> = {
			'Customers': [
				{ question: `My biggest challenge is getting customers. What's the fastest path to my first 10 paying customers for ${productName}?`, icon: 'group_add', category: 'Acquisition' },
				{ question: 'Should I focus on inbound marketing or outbound sales given my stage?', icon: 'campaign', category: 'Strategy' },
				{ question: 'How do I identify my ideal customer profile (ICP) with limited data?', icon: 'person_search', category: 'Discovery' },
				{ question: 'What customer acquisition channel should I double down on RIGHT NOW?', icon: 'trending_up', category: 'Growth' }
			],
			'Funding': [
				{ question: 'I need funding but investors want traction. How do I break this chicken-and-egg problem?', icon: 'account_balance', category: 'Funding' },
				{ question: 'What metrics do I need before approaching VCs vs Angels?', icon: 'analytics', category: 'Metrics' },
				{ question: 'Should I bootstrap more or raise now? What are the tradeoffs?', icon: 'balance', category: 'Strategy' },
				{ question: 'How do I extend runway while waiting for the right funding opportunity?', icon: 'savings', category: 'Operations' }
			],
			'Product': [
				{ question: `Users aren't engaging with ${productName}. How do I diagnose the real problem?`, icon: 'bug_report', category: 'Product' },
				{ question: 'Should I build more features or fix what I have? How do I decide?', icon: 'build', category: 'Development' },
				{ question: 'How do I know if I have product-market fit or just early adopters?', icon: 'science', category: 'Validation' },
				{ question: "What's the MVP I should have launched vs what I actually built?", icon: 'rocket_launch', category: 'Strategy' }
			],
			'Team': [
				{ question: 'I\'m overwhelmed doing everything. What should I hire for first?', icon: 'groups', category: 'Hiring' },
				{ question: 'How do I attract good talent when I can\'t compete on salary?', icon: 'person_add', category: 'Recruitment' },
				{ question: 'Should I hire generalists or specialists at my stage?', icon: 'diversity_3', category: 'Team' },
				{ question: 'How do I manage a team while also doing founder work?', icon: 'manage_accounts', category: 'Leadership' }
			],
			'Competition': [
				{ question: 'A well-funded competitor just launched. How should I respond?', icon: 'sports_martial_arts', category: 'Competition' },
				{ question: 'How do I differentiate when my product looks similar to others?', icon: 'star', category: 'Positioning' },
				{ question: 'Should I compete head-on or find a niche? What\'s my unfair advantage?', icon: 'strategy', category: 'Strategy' },
				{ question: 'How do I win customers away from established players?', icon: 'emoji_events', category: 'Sales' }
			]
		};
		
		// Return challenge-specific questions if available
		if (primaryChallenge && challengeQuestions[primaryChallenge]) {
			return challengeQuestions[primaryChallenge];
		}
		
		// Pre-Revenue / Idea Stage Questions (fallback)
		if (!hasRevenue || stage === 'Idea' || stage === 'MVP') {
			return [
				{ question: `I'm pre-revenue with ${productName}. What should I focus on this week?`, icon: 'science', category: 'Validation' },
				{ question: 'What metrics should I track before my first paying customer?', icon: 'analytics', category: 'Metrics' },
				{ question: 'How should I price my product for early adopters?', icon: 'payments', category: 'Pricing' },
				{ question: 'What are the biggest mistakes founders make at my stage?', icon: 'warning', category: 'Strategy' }
			];
		}
		
		// Early Traction (< 20 customers)
		if (customerCount < 20) {
			return [
				{ question: `I have ${customerCount} customers. How do I get to 20 in the next 30 days?`, icon: 'group_add', category: 'Conversion' },
				{ question: 'What should my customer acquisition strategy be right now?', icon: 'campaign', category: 'Growth' },
				{ question: 'When is the right time to start fundraising?', icon: 'account_balance', category: 'Funding' },
				{ question: 'How do I build a repeatable sales process?', icon: 'trending_up', category: 'Sales' }
			];
		}
		
		// Scaling Stage
		return [
			{ question: `Revenue is ₹${(monthlyRevenue/1000).toFixed(0)}K/mo. How do I 3x in 6 months?`, icon: 'balance', category: 'Growth' },
			{ question: 'What hiring decisions should I prioritize next?', icon: 'groups', category: 'Team' },
			{ question: 'How should I structure my next funding round?', icon: 'payments', category: 'Funding' },
			{ question: 'What expansion opportunities should I explore?', icon: 'explore', category: 'Strategy' }
		];
	}

	// Send message to strategic advisor
	async function sendAdvisorMessage(presetQuestion?: string) {
		const message = presetQuestion || advisorInput.trim();
		if (!message || advisorLoading) return;

		advisorInput = '';
		advisorLoading = true;

		// Add user message
		advisorMessages = [...advisorMessages, {
			role: 'user',
			content: message,
			timestamp: new Date()
		}];

		try {
			const token = localStorage.getItem('accessToken');
			if (!token) throw new Error('Not authenticated');

			// Build context for the advisor
			const context = {
				productName: ddqResponses[1] || 'Unknown Product',
				businessDescription: ddqResponses[2] || '',
				category: ddqResponses[3] || 'Other',
				stage: ddqResponses[5] || 'Unknown',
				hasRevenue: ddqResponses[12] === 'Yes',
				monthlyRevenue: Number(ddqResponses[13]) || 0,
				customerCount: Number(ddqResponses[15]) || 0,
				teamSize: Number(ddqResponses[17]) || 1,
				challenge: ddqResponses[19] || 'General',
				sixMonthGoal: ddqResponses[21] || '',
				fundingNeeded: ddqResponses[22] || '',
				valuation: valuation ? {
					estimated: valuation.estimatedValuation,
					berkus: valuation.berkusValue,
					scorecard: valuation.scorecardValue
				} : null,
				swot: swotAnalysis || null
			};

			const response = await fetch(`${API_URL}/api/chat/grok`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': `Bearer ${token}`
				},
				body: JSON.stringify({
					message: `As a strategic startup advisor, answer this question concisely and actionably: ${message}`,
					context: context,
					conversationHistory: advisorMessages.slice(-6)
				})
			});

			if (!response.ok) throw new Error('Failed to get response');

			const data = await response.json();
			
			// Add AI response
			const aiMessage = {
				role: 'assistant',
				content: data.response,
				timestamp: new Date(),
				saved: false
			};
			advisorMessages = [...advisorMessages, aiMessage];

			// Auto-save to notes
			await autoSaveAdvisorNote(message, data.response);

			// Scroll to bottom
			setTimeout(() => {
				if (advisorContainer) {
					advisorContainer.scrollTop = advisorContainer.scrollHeight;
				}
			}, 100);

		} catch (error) {
			console.error('Error in advisor:', error);
			advisorMessages = [...advisorMessages, {
				role: 'assistant',
				content: 'Sorry, I encountered an error. Please try again.',
				timestamp: new Date()
			}];
		} finally {
			advisorLoading = false;
		}
	}

	// Auto-save advisor conversation to notes
	async function autoSaveAdvisorNote(question: string, answer: string) {
		try {
			const token = localStorage.getItem('accessToken');
			if (!token) return;

			await fetch(`${API_URL}/api/notes/save`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': `Bearer ${token}`
				},
				body: JSON.stringify({
					chatMessage: question,
					response: answer,
					noteTitle: question,
					category: 'Strategy Advisor'
				})
			});

			// Mark as saved
			advisorMessages = advisorMessages.map((msg, idx) => 
				idx === advisorMessages.length - 1 ? { ...msg, saved: true } : msg
			);

		} catch (error) {
			console.error('Error auto-saving note:', error);
		}
	}

	// Initialize advisor with welcome message
	function initializeAdvisor() {
		const productName = ddqResponses[1] || 'your business';
		const stage = ddqResponses[5] || 'early stage';
		
		if (advisorMessages.length === 0) {
			advisorMessages = [{
				role: 'assistant',
				content: `👋 Welcome! I'm your Strategic Advisor.

I've analyzed ${productName} and I'm here to help you make better decisions. Based on your ${stage} stage, I've prepared some relevant questions below.

**You can:**
• Click any suggested question to get instant advice
• Ask your own question about strategy, growth, or funding
• All conversations are automatically saved to your Notes

What would you like to discuss?`,
				timestamp: new Date()
			}];
		}
	}

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
		source?: 'gtm' | 'goal' | 'custom'; // Track where action came from
	}> = [];
	let backlogItems: Array<{
		id: string;
		text: string;
		progress: 'red' | 'amber' | 'green';
		movedToBacklogAt: Date;
		source?: 'gtm' | 'goal' | 'custom';
	}> = [];
	let actionsLoading = false;
	let showAddActionForm = false;
	let newActionText = '';
	let addingAction = false;
	
	// Carousel state for Top Actions
	let actionCarouselTab: 'pending' | 'bucket' | 'backlog' = 'pending';
	let currentPendingIndex = 0;
	let currentBucketIndex = 0;
	let currentBacklogIndex = 0;
	
	// Computed action lists
	$: pendingActions = dailyActions.filter(a => a.status === 'pending');
	$: bucketActions = dailyActions.filter(a => a.status === 'accepted');
	
	// Carousel navigation functions
	function nextAction(tab: string) {
		if (tab === 'pending' && pendingActions.length > 0) {
			currentPendingIndex = (currentPendingIndex + 1) % pendingActions.length;
		} else if (tab === 'bucket' && bucketActions.length > 0) {
			currentBucketIndex = (currentBucketIndex + 1) % bucketActions.length;
		} else if (tab === 'backlog' && backlogItems.length > 0) {
			currentBacklogIndex = (currentBacklogIndex + 1) % backlogItems.length;
		}
	}
	
	function prevAction(tab: string) {
		if (tab === 'pending' && pendingActions.length > 0) {
			currentPendingIndex = currentPendingIndex === 0 ? pendingActions.length - 1 : currentPendingIndex - 1;
		} else if (tab === 'bucket' && bucketActions.length > 0) {
			currentBucketIndex = currentBucketIndex === 0 ? bucketActions.length - 1 : currentBucketIndex - 1;
		} else if (tab === 'backlog' && backlogItems.length > 0) {
			currentBacklogIndex = currentBacklogIndex === 0 ? backlogItems.length - 1 : currentBacklogIndex - 1;
		}
	}

	// Function to add custom action to dailyActions via API
	async function addCustomAction() {
		if (!newActionText.trim() || addingAction) return;
		
		addingAction = true;
		try {
			const token = localStorage.getItem('accessToken');
			if (!token) {
				console.error('No access token');
				return;
			}

			const response = await fetch(`${API_URL}/api/actions/custom`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': `Bearer ${token}`
				},
				body: JSON.stringify({ text: newActionText.trim() })
			});

			if (response.ok) {
				const data = await response.json();
				dailyActions = [...dailyActions, data.action];
				newActionText = '';
				showAddActionForm = false;
			} else {
				console.error('Failed to add custom action');
			}
		} catch (error) {
			console.error('Error adding custom action:', error);
		} finally {
			addingAction = false;
		}
	}

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
			
			// Fetch InFinity stats
			fetchInfinityStats();
			
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
					
					// Use saved valuation if available, otherwise recalculate
					if (data.valuation && data.valuation.finalValuationINR) {
						console.log('Using saved valuation from database:', data.valuation.finalValuationINR);
						valuation = data.valuation;
					} else {
						console.log('No saved valuation found, recalculating...');
						calculateValuation();
					}
					
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

	// Autofill function for Rajinikanth Construction - early stage startup
	function autofillRajinikanth() {
		ddqResponses = {
			1: 'Rajinikanth Construction',
			2: 'Rajinikanth Construction is a construction company specializing in residential and commercial building projects in South India. We offer end-to-end construction services including design consultation, project management, and quality execution with a focus on sustainable building practices.',
			3: ['Other'],
			'3_other': 'Construction & Real Estate',
			4: 'Tamil Nadu',
			5: 'MVP',
			6: 'L&T Construction, Sobha Developers',
			7: 'Our competitive edge lies in our founder\'s 15+ years of industry experience, commitment to on-time delivery with zero cost overruns, and adoption of modern construction technologies like BIM and prefabrication. We offer transparent pricing with no hidden costs.',
			8: 'Our ideal customers are middle to upper-middle class families looking to build their dream homes (₹50L-2Cr budget), and small to medium businesses needing commercial spaces. They value quality, transparency, and timely completion over lowest cost.',
			9: 'B2C (Business to Consumer)',
			10: '6-20',
			11: 500000,
			'11b': 'One-time Payment',
			12: 'Yes',
			13: 2500000,
			14: 1800000,
			15: 8,
			16: 7500000,
			17: 12,
			18: ['Industry Expert', 'Business', 'Previous Startup'],
			19: ['Customers', 'Funding', 'Competition'],
			20: ['Direct sales', 'Word of mouth', 'Social media'],
			21: 'Complete 5 new residential projects and establish partnerships with 3 real estate developers for commercial construction contracts',
			22: '₹50 Lakhs - ₹1 Crore',
			23: ['Competition', 'Economic', 'Funding']
		};
		// Rebuild questions to handle conditional logic
		rebuildQuestions();
		// Save to localStorage
		localStorage.setItem('ddq_progress', JSON.stringify(ddqResponses));
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
			
			// Save the calculated valuation to the database for persistence
			try {
				await fetch(`${API_URL}/api/ddq/update-valuation`, {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						Authorization: `Bearer ${token}`
					},
					body: JSON.stringify({ valuation })
				});
				console.log('Valuation saved to database successfully');
			} catch (saveError) {
				console.warn('Failed to save valuation to database:', saveError);
			}
			
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
				},
				// Andhra Pradesh specific
				{
					name: 'AP Innovation Society Grant',
					amount: '₹10-30 Lakhs',
					eligibility: 'AP-registered startups with innovative solutions',
					benefits: 'Seed funding, incubation support, mentorship, investor connects',
					eligible: location === 'Andhra Pradesh' || location === 'Vijayawada' || location === 'Visakhapatnam' || location === 'Vizag',
					eligibilityStatus: (location === 'Andhra Pradesh' || location === 'Vijayawada' || location === 'Visakhapatnam' || location === 'Vizag') ? 'eligible' : 'partial',
					reasoning: (location === 'Andhra Pradesh' || location === 'Vijayawada' || location === 'Visakhapatnam' || location === 'Vizag')
						? 'AP Innovation Society offers excellent support for innovative startups!'
						: 'Available for Andhra Pradesh registered startups',
					url: 'https://apinnovationsociety.com/',
					priority: (location === 'Andhra Pradesh' || location === 'Vijayawada' || location === 'Visakhapatnam' || location === 'Vizag') ? 1 : 6
				},
				{
					name: 'Fintech Valley Fund',
					amount: '₹25-75 Lakhs',
					eligibility: 'FinTech startups in Andhra Pradesh',
					benefits: 'Specialized fintech funding, ecosystem connect, regulatory sandbox access',
					eligible: (location === 'Andhra Pradesh' || location === 'Vijayawada' || location === 'Visakhapatnam' || location === 'Vizag') && (category === 'FinTech' || String(category).includes('FinTech')),
					eligibilityStatus: ((location === 'Andhra Pradesh' || location === 'Vijayawada' || location === 'Visakhapatnam' || location === 'Vizag') && (category === 'FinTech' || String(category).includes('FinTech'))) ? 'eligible' : 'partial',
					reasoning: ((location === 'Andhra Pradesh' || location === 'Vijayawada' || location === 'Visakhapatnam' || location === 'Vizag') && (category === 'FinTech' || String(category).includes('FinTech')))
						? 'Visakhapatnam Fintech Valley offers specialized funding for fintech!'
						: 'Specialized for FinTech startups in Andhra Pradesh',
					url: 'https://fintechvalley.in/',
					priority: ((location === 'Andhra Pradesh' || location === 'Vijayawada' || location === 'Visakhapatnam' || location === 'Vizag') && (category === 'FinTech' || String(category).includes('FinTech'))) ? 1 : 6
				},
				{
					name: 'APSFC Startup Loan Scheme',
					amount: 'Up to ₹50 Lakhs',
					eligibility: 'Andhra Pradesh registered MSMEs and startups',
					benefits: 'Low-interest loans, working capital support, equipment financing',
					eligible: location === 'Andhra Pradesh' || location === 'Vijayawada' || location === 'Visakhapatnam' || location === 'Vizag',
					eligibilityStatus: (location === 'Andhra Pradesh' || location === 'Vijayawada' || location === 'Visakhapatnam' || location === 'Vizag') ? 'eligible' : 'partial',
					reasoning: (location === 'Andhra Pradesh' || location === 'Vijayawada' || location === 'Visakhapatnam' || location === 'Vizag')
						? 'APSFC provides competitive loans for AP-based startups!'
						: 'Available for Andhra Pradesh registered businesses',
					url: 'https://apsfc.in/',
					priority: (location === 'Andhra Pradesh' || location === 'Vijayawada' || location === 'Visakhapatnam' || location === 'Vizag') ? 2 : 6
				},
				{
					name: 'AP IT & Electronics Policy Support',
					amount: 'Up to ₹25 Lakhs',
					eligibility: 'IT/Electronics startups in Andhra Pradesh',
					benefits: 'Infrastructure subsidies, power tariff concession, stamp duty exemption',
					eligible: (location === 'Andhra Pradesh' || location === 'Vijayawada' || location === 'Visakhapatnam' || location === 'Vizag') && (category === 'SaaS' || category === 'AI/ML' || category === 'Hardware'),
					eligibilityStatus: ((location === 'Andhra Pradesh' || location === 'Vijayawada' || location === 'Visakhapatnam' || location === 'Vizag') && (category === 'SaaS' || category === 'AI/ML' || category === 'Hardware')) ? 'eligible' : 'partial',
					reasoning: ((location === 'Andhra Pradesh' || location === 'Vijayawada' || location === 'Visakhapatnam' || location === 'Vizag') && (category === 'SaaS' || category === 'AI/ML' || category === 'Hardware'))
						? 'AP IT policy offers excellent support for tech startups!'
						: 'Available for IT/Tech startups in Andhra Pradesh',
					url: 'https://it.ap.gov.in/',
					priority: ((location === 'Andhra Pradesh' || location === 'Vijayawada' || location === 'Visakhapatnam' || location === 'Vizag') && (category === 'SaaS' || category === 'AI/ML' || category === 'Hardware')) ? 2 : 6
				},
				{
					name: 'TIDE Andhra Pradesh',
					amount: 'Up to ₹15 Lakhs',
					eligibility: 'Tech startups in tier-2 cities of Andhra Pradesh',
					benefits: 'Technology incubation, mentorship, market access, DST support',
					eligible: location === 'Andhra Pradesh' || location === 'Vijayawada' || location === 'Visakhapatnam' || location === 'Vizag',
					eligibilityStatus: (location === 'Andhra Pradesh' || location === 'Vijayawada' || location === 'Visakhapatnam' || location === 'Vizag') ? 'eligible' : 'partial',
					reasoning: (location === 'Andhra Pradesh' || location === 'Vijayawada' || location === 'Visakhapatnam' || location === 'Vizag')
						? 'TIDE program supports tech innovation in AP tier-2 cities!'
						: 'Available for AP tier-2 city startups',
					url: 'https://dst.gov.in/tide-20',
					priority: (location === 'Andhra Pradesh' || location === 'Vijayawada' || location === 'Visakhapatnam' || location === 'Vizag') ? 3 : 6
				},
				{
					name: 'AP Skill Development Startup Grant',
					amount: 'Up to ₹10 Lakhs',
					eligibility: 'Startups in skill development and education sector in AP',
					benefits: 'Seed grant, partnership with skill development centers, government tie-ups',
					eligible: (location === 'Andhra Pradesh' || location === 'Vijayawada' || location === 'Visakhapatnam' || location === 'Vizag') && (category === 'EdTech' || category === 'Education'),
					eligibilityStatus: ((location === 'Andhra Pradesh' || location === 'Vijayawada' || location === 'Visakhapatnam' || location === 'Vizag') && (category === 'EdTech' || category === 'Education')) ? 'eligible' : 'partial',
					reasoning: ((location === 'Andhra Pradesh' || location === 'Vijayawada' || location === 'Visakhapatnam' || location === 'Vizag') && (category === 'EdTech' || category === 'Education'))
						? 'AP prioritizes skill development - excellent for EdTech!'
						: 'Available for EdTech/skill development startups in AP',
					url: 'https://apssdc.in/',
					priority: ((location === 'Andhra Pradesh' || location === 'Vijayawada' || location === 'Visakhapatnam' || location === 'Vizag') && (category === 'EdTech' || category === 'Education')) ? 2 : 6
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
			
			// FIRST: Parse user-mentioned competitors and add them as user-picks
			const userMentionedList = userCompetitors.split(',').map(c => c.trim()).filter(c => c.length > 0);
			const userPickedCompetitorEntries = userMentionedList.map((compName, idx) => ({
				name: compName.charAt(0).toUpperCase() + compName.slice(1), // Capitalize
				stage: 'Unknown',
				currentValuation: 0,
				earlyValuation: 0,
				growthRate: 0,
				revenue: 0,
				customers: 0,
				fundingRaised: 0,
				investments: [],
				flagshipProduct: `${compName} Product`,
				products: [`${compName} Product`],
				visible: true,
				isUserMentioned: true,
				region: 'user-pick',
				valuationTimeline: [
					{ year: 2020, valuation: 0, event: 'Founded' },
					{ year: 2024, valuation: 0, event: 'Current' }
				]
			}));
			
			// Helper function to check if category matches (handles arrays and strings)
			const categoryMatches = (checkCategory) => {
				if (Array.isArray(category)) {
					return category.some(c => c.toLowerCase().includes(checkCategory.toLowerCase()));
				}
				return String(category).toLowerCase().includes(checkCategory.toLowerCase());
			};
			
			// Food Delivery / Marketplace / E-commerce detection (ONDC, Swiggy indicate this)
			if (userCompetitors.includes('zomato') || userCompetitors.includes('swiggy') || 
			    userCompetitors.includes('ondc') || userCompetitors.includes('uber eats') || 
			    userCompetitors.includes('dunzo') || userCompetitors.includes('bigbasket') ||
			    categoryMatches('Marketplace') || categoryMatches('Food') || categoryMatches('E-commerce') ||
			    categoryMatches('Mobile App') || categoryMatches('Delivery')) {
				intelligentCompetitors = [
					{ name: 'ONDC', stage: 'Government Backed', currentValuation: 50000000000, earlyValuation: 10000000000, growthRate: 600, revenue: 0, customers: 50000000, fundingRaised: 10000000000, investments: ['Government of India', 'Quality Council of India'], flagshipProduct: 'Open Network for Digital Commerce', products: ['Open Commerce Network', 'Seller Network', 'Buyer Apps'], visible: true, region: 'local', valuationTimeline: [{ year: 2021, valuation: 10000000000, event: 'Founded' }, { year: 2022, valuation: 20000000000, event: 'Pilot Launch' }, { year: 2023, valuation: 35000000000, event: 'National Rollout' }, { year: 2024, valuation: 50000000000, event: 'Current' }] },
					{ name: 'Swiggy', stage: 'Series J', currentValuation: 1050000000000, earlyValuation: 25000000000, growthRate: 520, revenue: 6500000000, customers: 120000000, fundingRaised: 25000000000, investments: ['Accel - $2M', 'Prosus - $1B'], flagshipProduct: 'Food Delivery Platform', products: ['Food Delivery', 'Instamart', 'Genie'], visible: true, region: 'local', valuationTimeline: [{ year: 2014, valuation: 50000000, event: 'Founded' }, { year: 2017, valuation: 2000000000, event: 'Series C' }, { year: 2020, valuation: 35000000000, event: 'Series H' }, { year: 2024, valuation: 1050000000000, event: 'Series J' }] },
					{ name: 'Dunzo', stage: 'Series F', currentValuation: 23000000000, earlyValuation: 800000000, growthRate: 420, revenue: 35000000, customers: 3000000, fundingRaised: 800000000, investments: ['Google - $12M', 'Reliance - $200M'], flagshipProduct: 'Hyperlocal Delivery', products: ['Hyperlocal Delivery', 'Quick Commerce', 'B2B Services'], visible: true, region: 'local', valuationTimeline: [{ year: 2015, valuation: 50000000, event: 'Founded' }, { year: 2017, valuation: 800000000, event: 'Series B' }, { year: 2020, valuation: 5000000000, event: 'Series D' }, { year: 2022, valuation: 23000000000, event: 'Series F' }] },
					{ name: 'Zomato', stage: 'Public', currentValuation: 650000000000, earlyValuation: 20000000000, growthRate: 480, revenue: 4800000000, customers: 80000000, fundingRaised: 20000000000, investments: ['Info Edge - $1M', 'Ant Financial - $200M'], flagshipProduct: 'Food Delivery App', products: ['Food Delivery', 'Dining Out', 'Hyperpure'], visible: true, region: 'global', valuationTimeline: [{ year: 2008, valuation: 10000000, event: 'Founded' }, { year: 2013, valuation: 2000000000, event: 'Series C' }, { year: 2018, valuation: 20000000000, event: 'Series G' }, { year: 2021, valuation: 650000000000, event: 'IPO' }] }
				];
			}
			// Pure E-commerce detection (no food delivery)
			else if (userCompetitors.includes('amazon') || userCompetitors.includes('flipkart') || 
			         userCompetitors.includes('meesho') || (categoryMatches('E-commerce') && !categoryMatches('Food'))) {
				intelligentCompetitors = [
					{ name: 'Meesho', stage: 'Series F', currentValuation: 49000000000, earlyValuation: 2000000000, growthRate: 500, revenue: 35000000, customers: 13000000, fundingRaised: 2000000000, investments: ['SoftBank - $300M', 'Meta - $50M'], flagshipProduct: 'Social Commerce Platform', products: ['Social Commerce', 'Supplier Network', 'Meesho Mall'], visible: true, valuationTimeline: [{ year: 2015, valuation: 50000000, event: 'Founded' }, { year: 2019, valuation: 5000000000, event: 'Series C' }, { year: 2021, valuation: 49000000000, event: 'Series F' }] },
					{ name: 'Flipkart', stage: 'Acquired', currentValuation: 2000000000000, earlyValuation: 50000000000, growthRate: 450, revenue: 850000000000, customers: 450000000, fundingRaised: 50000000000, investments: ['Walmart - $16B'], flagshipProduct: 'E-commerce Marketplace', products: ['E-commerce', 'Flipkart Plus', 'Grocery'], visible: true, valuationTimeline: [{ year: 2007, valuation: 10000000, event: 'Founded' }, { year: 2012, valuation: 10000000000, event: 'Series D' }, { year: 2018, valuation: 200000000000, event: 'Walmart Acquisition' }, { year: 2024, valuation: 2000000000000, event: 'Current' }] },
					{ name: 'Amazon India', stage: 'Public', currentValuation: 15000000000000, earlyValuation: 500000000000, growthRate: 380, revenue: 2500000000000, customers: 500000000, fundingRaised: 500000000000, investments: ['Amazon Global'], flagshipProduct: 'Amazon Shopping', products: ['E-commerce', 'Prime', 'Fresh'], visible: true, valuationTimeline: [{ year: 2013, valuation: 50000000000, event: 'India Launch' }, { year: 2017, valuation: 300000000000, event: 'Expansion' }, { year: 2020, valuation: 800000000000, event: 'Pandemic Growth' }, { year: 2024, valuation: 15000000000000, event: 'Current' }] }
				];
			}
			// FinTech detection
			else if (userCompetitors.includes('paytm') || userCompetitors.includes('phonepe') || 
			         userCompetitors.includes('razorpay') || categoryMatches('FinTech') || categoryMatches('Payment')) {
				intelligentCompetitors = [
					{ name: 'Razorpay', stage: 'Series F', currentValuation: 75000000000, earlyValuation: 5000000000, growthRate: 480, revenue: 95000000, customers: 8000000, fundingRaised: 5000000000, investments: ['Sequoia - $10M', 'Tiger Global - $150M'], flagshipProduct: 'Payment Gateway', products: ['Payment Gateway', 'Banking', 'Payroll'], visible: true, valuationTimeline: [{ year: 2014, valuation: 50000000, event: 'Founded' }, { year: 2018, valuation: 5000000000, event: 'Series C' }, { year: 2021, valuation: 75000000000, event: 'Series F' }] },
					{ name: 'Paytm', stage: 'Public', currentValuation: 450000000000, earlyValuation: 20000000000, growthRate: 420, revenue: 250000000, customers: 350000000, fundingRaised: 20000000000, investments: ['Alibaba - $680M', 'SoftBank - $1.4B'], flagshipProduct: 'Paytm Wallet & UPI', products: ['Payments', 'Banking', 'Wealth'], visible: true, valuationTimeline: [{ year: 2010, valuation: 50000000, event: 'Founded' }, { year: 2015, valuation: 40000000000, event: 'Series D' }, { year: 2019, valuation: 160000000000, event: 'Series G' }, { year: 2021, valuation: 450000000000, event: 'IPO' }] },
					{ name: 'PhonePe', stage: 'Series E', currentValuation: 850000000000, earlyValuation: 15000000000, growthRate: 520, revenue: 180000000, customers: 450000000, fundingRaised: 15000000000, investments: ['Walmart - $700M'], flagshipProduct: 'UPI Payments App', products: ['UPI Payments', 'Insurance', 'Mutual Funds'], visible: true, valuationTimeline: [{ year: 2015, valuation: 100000000, event: 'Founded' }, { year: 2018, valuation: 15000000000, event: 'Flipkart Era' }, { year: 2022, valuation: 100000000000, event: 'Spin-off' }, { year: 2024, valuation: 850000000000, event: 'Series E' }] }
				];
			}
			// EdTech detection
			else if (userCompetitors.includes('byju') || userCompetitors.includes('unacademy') || 
			         userCompetitors.includes('upgrad') || categoryMatches('EdTech') || categoryMatches('Education')) {
				intelligentCompetitors = [
					{ name: 'Unacademy', stage: 'Series H', currentValuation: 37000000000, earlyValuation: 3000000000, growthRate: 390, revenue: 28000000, customers: 50000000, fundingRaised: 3000000000, investments: ['SoftBank - $150M', 'General Atlantic - $440M'], flagshipProduct: 'Live Classes Platform', products: ['Live Classes', 'Test Prep', 'Upskilling'], visible: true, valuationTimeline: [{ year: 2015, valuation: 20000000, event: 'Founded' }, { year: 2018, valuation: 1000000000, event: 'Series C' }, { year: 2020, valuation: 20000000000, event: 'Series F' }, { year: 2022, valuation: 37000000000, event: 'Series H' }] },
					{ name: 'UpGrad', stage: 'Series E', currentValuation: 28000000000, earlyValuation: 2500000000, growthRate: 360, revenue: 35000000, customers: 4000000, fundingRaised: 2500000000, investments: ['Temasek - $120M'], flagshipProduct: 'Online Degrees', products: ['Online Degrees', 'Bootcamps', 'Corporate Training'], visible: true, valuationTimeline: [{ year: 2015, valuation: 50000000, event: 'Founded' }, { year: 2019, valuation: 2000000000, event: 'Series C' }, { year: 2021, valuation: 12000000000, event: 'Series D' }, { year: 2023, valuation: 28000000000, event: 'Series E' }] },
					{ name: "Byju's", stage: 'Series F', currentValuation: 220000000000, earlyValuation: 10000000000, growthRate: 480, revenue: 120000000, customers: 150000000, fundingRaised: 10000000000, investments: ['Sequoia - $50M', 'Tiger Global - $200M'], flagshipProduct: "Byju's Learning App", products: ['K-12 Learning', 'Test Prep', 'Coding'], visible: true, valuationTimeline: [{ year: 2011, valuation: 20000000, event: 'Founded' }, { year: 2016, valuation: 5000000000, event: 'Series C' }, { year: 2019, valuation: 80000000000, event: 'Series E' }, { year: 2022, valuation: 220000000000, event: 'Peak Valuation' }] }
				];
			}
			// SaaS / B2B detection
			else if (userCompetitors.includes('freshworks') || userCompetitors.includes('zoho') || 
			         userCompetitors.includes('salesforce') || categoryMatches('SaaS') || categoryMatches('B2B')) {
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
			
			// Mark fallback competitors and categorize (keep their region if already set)
			intelligentCompetitors = intelligentCompetitors.map((c, index) => ({
				...c,
				isVerified: c.revenue > 0 || c.customers > 0,
				dataConfidence: (c.revenue > 0 || c.customers > 0) ? 'high' : 'low',
				flagshipProduct: c.flagshipProduct || (c.products && c.products.length > 0 ? c.products[0] : 'Core Product'),
				region: c.region || (index === 0 ? 'global' : index === 1 ? 'global' : index === 2 ? 'local' : index === 3 ? 'local' : 'rival'),
				isUserMentioned: c.isUserMentioned || false
			}));
			
			// COMBINE: User-picked competitors FIRST, then industry competitors
			const allFallbackCompetitors = [...userPickedCompetitorEntries, ...intelligentCompetitors];
			
			competitors = allFallbackCompetitors;
			allCompetitors = allFallbackCompetitors;
			verifiedCompetitors = allFallbackCompetitors.filter(c => c.isVerified);
			potentialCompetitors = allFallbackCompetitors.filter(c => !c.isVerified);
			userPickCompetitors = allFallbackCompetitors.filter(c => c.isUserMentioned || c.region === 'user-pick');
			globalCompetitors = allFallbackCompetitors.filter(c => c.region === 'global');
			localCompetitors = allFallbackCompetitors.filter(c => c.region === 'local');
			rivalCompetitors = allFallbackCompetitors.filter(c => c.region === 'rival');
			competitorDataSummary = {
				totalCompetitors: allFallbackCompetitors.length,
				verifiedCount: verifiedCompetitors.length,
				potentialCount: potentialCompetitors.length,
				userPickCount: userPickCompetitors.length,
				globalCount: globalCompetitors.length,
				localCount: localCompetitors.length,
				rivalCount: rivalCompetitors.length
			};
			
			console.log(`📝 Using intelligent fallback competitors based on user's ${category} business and mentioned competitors: ${userCompetitors}`);
			console.log(`📊 User picks: ${userPickCompetitors.length}, Global: ${globalCompetitors.length}, Local: ${localCompetitors.length}`);
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
		
		// Add user message immediately so user sees it
		chatMessages = [...chatMessages, {
			role: 'user',
			content: userMessage,
			timestamp: new Date()
		}];

		chatLoading = true;
		
		// Scroll to show user message
		setTimeout(() => {
			if (chatContainer) {
				chatContainer.scrollTop = chatContainer.scrollHeight;
			}
		}, 50);

		try {
			const token = localStorage.getItem('accessToken');
			if (!token) {
				console.error('No access token found');
				throw new Error('Not authenticated - please log in again');
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
				swot: swotAnalysis,
				competitorAnalysis: {
					userMentionedCompetitors: ddqResponses[6] || '', // Raw user input
					verifiedCompetitors: (verifiedCompetitors || []).map(c => ({
						name: c.name,
						stage: c.stage,
						currentValuation: c.currentValuation,
						revenue: c.revenue,
						customers: c.customers,
						fundingRaised: c.fundingRaised,
						flagshipProduct: c.flagshipProduct,
						region: c.region
					})),
					potentialCompetitors: (potentialCompetitors || []).map(c => ({
						name: c.name,
						stage: c.stage,
						currentValuation: c.currentValuation,
						revenue: c.revenue,
						customers: c.customers,
						fundingRaised: c.fundingRaised,
						flagshipProduct: c.flagshipProduct,
						region: c.region
					})),
					globalCompetitors: (globalCompetitors || []).map(c => ({
						name: c.name,
						stage: c.stage,
						currentValuation: c.currentValuation,
						revenue: c.revenue,
						flagshipProduct: c.flagshipProduct
					})),
					localCompetitors: (localCompetitors || []).map(c => ({
						name: c.name,
						stage: c.stage,
						currentValuation: c.currentValuation,
						revenue: c.revenue,
						flagshipProduct: c.flagshipProduct
					})),
					rivalCompetitors: (rivalCompetitors || []).map(c => ({
						name: c.name,
						stage: c.stage,
						currentValuation: c.currentValuation,
						revenue: c.revenue,
						flagshipProduct: c.flagshipProduct
					})),
					allCompetitors: (competitors || []).map(c => ({
						name: c.name,
						stage: c.stage,
						currentValuation: c.currentValuation,
						revenue: c.revenue,
						customers: c.customers,
						growthRate: c.growthRate
					})),
					summary: competitorDataSummary
				},
				// Top Actions (Daily Actions) - strategic recommendations for the business
				topActions: dailyActions.map(action => ({
					text: action.text,
					completed: action.completed || false
				})),
				// InFinity sync data if available
				infinityStats: {
					totalRevenue: window.infinityData?.totalRevenue || null,
					monthlyRevenue: window.infinityData?.monthlyRevenue || null,
					runway: window.infinityData?.runway || null,
					status: window.infinityData?.status || 'not synced'
				}
			};

			// Add timeout controller for the fetch request
			const controller = new AbortController();
			const timeoutId = setTimeout(() => controller.abort(), 45000); // 45 second timeout

			const response = await fetch(`${API_URL}/api/chat/grok`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${token}`
				},
				signal: controller.signal,
				body: JSON.stringify({
					message: userMessage,
					context: context,
					conversationHistory: chatMessages.slice(-5) // Last 5 messages for context
				})
			});

			clearTimeout(timeoutId);

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}));
				throw new Error(errorData.error || 'Failed to get AI response');
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

		} catch (error: any) {
			console.error('Error sending chat message:', error);
			
			// Generate a helpful fallback response based on the question
			const userMsg = chatMessages[chatMessages.length - 1]?.content?.toLowerCase() || '';
			let fallbackResponse = '';
			
			// Detect question type and provide contextual fallback
			if (userMsg.includes('valuation') || userMsg.includes('worth') || userMsg.includes('value')) {
				const val = valuation ? `₹${(valuation.finalValuationINR / 10000000).toFixed(2)} Cr` : 'not yet calculated (complete the assessment first)';
				fallbackResponse = `Based on your assessment, your company has an estimated valuation of ${val}. This uses the Berkus Method (30%) and Scorecard Method (70%), considering factors like team strength, product stage, market opportunity, and traction. Would you like me to explain any specific factor?`;
			} else if (userMsg.includes('competitor') || userMsg.includes('competition')) {
				const compCount = (competitors?.length || 0) + (verifiedCompetitors?.length || 0);
				fallbackResponse = `I've identified ${compCount} competitors in your space. Check the "Marketing Trends" tab for detailed competitor analysis including their valuations, funding, and market positioning. What specific competitor insight would you like?`;
			} else if (userMsg.includes('funding') || userMsg.includes('raise') || userMsg.includes('investor')) {
				fallbackResponse = `For funding advice, check the "Government Schemes" tab for grants and programs matching your profile. Key considerations: 1) Your stage determines investor type (Angels for early, VCs for growth), 2) Your valuation helps determine equity dilution, 3) Have clear use-of-funds and milestones ready.`;
			} else if (userMsg.includes('growth') || userMsg.includes('scale') || userMsg.includes('expand')) {
				const stage = ddqResponses[5] || 'current stage';
				fallbackResponse = `For growth at your ${stage}, focus on: 1) Customer acquisition cost optimization, 2) Retention and reducing churn, 3) Strategic partnerships, 4) Team expansion in key areas. Check the "GTM" tab for actionable growth tasks.`;
			} else if (userMsg.includes('strength') || userMsg.includes('weakness') || userMsg.includes('swot')) {
				fallbackResponse = `Check the "Introspection" tab for your full SWOT analysis. It includes: Strengths (your competitive advantages), Weaknesses (areas to improve), Opportunities (market gaps), and Threats (risks to address). Each comes with actionable recommendations.`;
			} else if (userMsg.includes('help') || userMsg.includes('what can you')) {
				fallbackResponse = `I can help you with:\n\n• **Valuation** - Understanding your company worth\n• **Competitors** - Market positioning analysis\n• **Funding** - Investment and grants guidance\n• **Growth** - Scaling strategies\n• **SWOT** - Strengths, weaknesses, opportunities\n\nTry asking: "What's my valuation?" or "Who are my main competitors?"`;
			} else {
				// Generic fallback
				fallbackResponse = `I'm having trouble connecting to my AI backend right now. In the meantime, you can:\n\n• Check the **Introspection** tab for SWOT analysis\n• View **Marketing Trends** for competitor data\n• Explore **Government Schemes** for funding options\n• Use **GTM** for action items\n\nPlease try your question again in a moment!`;
			}
			
			chatMessages = [...chatMessages, {
				role: 'assistant',
				content: fallbackResponse,
				timestamp: new Date()
			}];
			
			// Scroll to show response
			setTimeout(() => {
				if (chatContainer) {
					chatContainer.scrollTop = chatContainer.scrollHeight;
				}
			}, 100);
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

	// Parse markdown-style text to HTML for chat messages
	function parseMarkdownToHtml(text: string): string {
		if (!text) return '';
		
		// Escape HTML to prevent XSS
		let html = text
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;');
		
		// Parse bold: **text** or *text*
		html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
		html = html.replace(/\*([^*]+)\*/g, '<strong>$1</strong>');
		
		// Parse numbered lists (1. item, 2. item, etc.)
		html = html.replace(/^(\d+)\.\s+(.+)$/gm, '<li><strong>$1.</strong> $2</li>');
		
		// Parse bullet points (• or - at start of line)
		html = html.replace(/^[•\-]\s+(.+)$/gm, '<li>$1</li>');
		
		// Wrap consecutive <li> items in <ul>
		html = html.replace(/(<li>.*<\/li>\n?)+/g, '<ul class="chat-list">$&</ul>');
		
		// Parse line breaks
		html = html.replace(/\n/g, '<br>');
		
		// Clean up extra <br> inside lists
		html = html.replace(/<\/li><br>/g, '</li>');
		html = html.replace(/<ul class="chat-list"><br>/g, '<ul class="chat-list">');
		
		return html;
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

	// Generate daily actions based on 6-month goal + GTM strategy
	async function generateDailyActions() {
		actionsLoading = true;
		try {
			const token = localStorage.getItem('accessToken');
			if (!token) return;

			// Extract GTM-specific tasks if available
			const gtmTasks = [];
			if (gtmStrategy) {
				// Get tasks from GTM strategy
				if (gtmStrategy.ninetyDayPlan?.weeks) {
					const currentWeekTasks = gtmStrategy.ninetyDayPlan.weeks[0]?.tasks || [];
					gtmTasks.push(...currentWeekTasks.slice(0, 2).map((task: string) => ({
						text: task,
						source: 'gtm'
					})));
				} else if (gtmStrategy.marketingStrategy?.tactics) {
					gtmTasks.push(...gtmStrategy.marketingStrategy.tactics.slice(0, 2).map((t: any) => ({
						text: t.action || t.tactic || t,
						source: 'gtm'
					})));
				}
			}

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
					currentChallenge: ddqResponses[19] || 'General',
					gtmTasks: gtmTasks, // Pass GTM tasks to include
					requestCount: 5 - gtmTasks.length // Request remaining goal tasks
				})
			});

			if (response.ok) {
				const data = await response.json();
				// Combine GTM tasks (first 2) + Goal tasks (remaining 3)
				const goalActions = data.actions.map((action: any) => ({
					...action,
					status: action.status || 'pending',
					progress: action.progress || null,
					source: action.source || 'goal'
				}));
				
				// Add GTM tasks at the beginning if we have them locally
				const gtmActions = gtmTasks.map((task: any, i: number) => ({
					id: `gtm-${Date.now()}-${i}`,
					text: task.text,
					status: 'pending' as const,
					progress: null,
					source: 'gtm' as const,
					createdAt: new Date()
				}));
				
				// Combine: 2 GTM + up to 3 goal tasks
				dailyActions = [...gtmActions.slice(0, 2), ...goalActions.slice(0, 3)];
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
			saveActionsToStorage();
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
		saveActionsToStorage();
		
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
			
			saveActionsToStorage();
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
				class:active={activeTab === 'gtm'}
				on:click={() => { activeTab = 'gtm'; loadGTMTasks(); loadGTMFollowups(); }}
				title="GTM"
			>
				<span class="material-symbols-outlined nav-icon">rocket_launch</span>
				{#if !sidebarMinimized}
					<span class="nav-text">GTM</span>
				{/if}
			</button>
			<button
				class="nav-item"
				class:active={activeTab === 'advisor'}
				on:click={() => { activeTab = 'advisor'; initializeAdvisor(); }}
				title="Strategic Advisor"
			>
				<span class="material-symbols-outlined nav-icon">psychology</span>
				{#if !sidebarMinimized}
					<span class="nav-text">Strategic Advisor</span>
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
							<button class="autofill-btn" on:click={autofillRajinikanth} title="Autofill with Rajinikanth Construction data">
								<span class="material-symbols-outlined">auto_fix_high</span>
								Autofill Demo
							</button>
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

						<!-- Middle + Right: Top Actions Carousel (Merged) -->
						<div class="home-card actions-carousel-card">
							<!-- Carousel Tabs -->
							<div class="carousel-tabs">
								<button 
									class="carousel-tab" 
									class:active={actionCarouselTab === 'pending'}
									on:click={() => actionCarouselTab = 'pending'}
								>
									Top Action
									{#if pendingActions.length > 0}
										<span class="tab-count">{pendingActions.length}</span>
									{/if}
								</button>
								<button 
									class="carousel-tab" 
									class:active={actionCarouselTab === 'bucket'}
									on:click={() => actionCarouselTab = 'bucket'}
								>
									Action in your bucket
									{#if bucketActions.length > 0}
										<span class="tab-count">{bucketActions.length}</span>
									{/if}
								</button>
								<button 
									class="carousel-tab" 
									class:active={actionCarouselTab === 'backlog'}
									on:click={() => actionCarouselTab = 'backlog'}
								>
									Backlog
									{#if backlogItems.length > 0}
										<span class="tab-count">{backlogItems.length}</span>
									{/if}
								</button>
								<div class="carousel-tab-spacer"></div>
								<div class="card-header-actions">
									<button class="add-action-btn" on:click={() => showAddActionForm = !showAddActionForm} title="Add Action">
										<span class="material-symbols-outlined">{showAddActionForm ? 'close' : 'add'}</span>
									</button>
									<button class="info-btn" on:click={() => showInfo('daily-actions')} title="What is this?">
										<span class="info-icon">i</span>
									</button>
									<button class="daddy-btn" on:click={() => askDaddy('daily-actions')} title="Ask Daddy">
										<span class="daddy-icon">D</span>
									</button>
								</div>
							</div>
							
							<!-- Progress bar under tabs -->
							<div class="carousel-progress-bar"></div>
							
							<!-- Add Action Form -->
							{#if showAddActionForm}
								<div class="add-action-form">
									<input 
										type="text" 
										bind:value={newActionText}
										placeholder="Enter your action item..."
										on:keydown={(e) => e.key === 'Enter' && addCustomAction()}
									/>
									<button class="add-action-submit" on:click={addCustomAction} disabled={!newActionText.trim()}>
										<span class="material-symbols-outlined">add_task</span>
									</button>
								</div>
							{/if}
							
							{#if actionsLoading}
								<div class="carousel-loading">
									<span class="material-symbols-outlined spinning">progress_activity</span>
									Loading actions...
								</div>
							{:else}
								<!-- Carousel Content -->
								<div class="carousel-content">
									{#if actionCarouselTab === 'pending'}
										<!-- Pending Actions (Swipe to Accept/Reject) -->
										{#if pendingActions.length === 0}
											<div class="carousel-empty">
												<span class="material-symbols-outlined">task_alt</span>
												<p>No pending actions</p>
												<span class="empty-hint">Complete the assessment or add custom actions</span>
											</div>
										{:else}
											<div class="carousel-card-container">
												<button class="carousel-nav prev" on:click={() => prevAction('pending')} disabled={pendingActions.length <= 1}>
													<span class="nav-arrow">&lt;</span>
												</button>
												
												<div class="carousel-action-card">
													{#if pendingActions[currentPendingIndex]?.source === 'gtm'}
														<span class="action-source-badge gtm">GTM</span>
													{:else if pendingActions[currentPendingIndex]?.source === 'goal'}
														<span class="action-source-badge goal">6M Goal</span>
													{/if}
													<p class="carousel-action-text">{pendingActions[currentPendingIndex]?.text || ''}</p>
													<span class="carousel-action-index">{currentPendingIndex + 1} of {pendingActions.length}</span>
												</div>
												
												<button class="carousel-nav next" on:click={() => nextAction('pending')} disabled={pendingActions.length <= 1}>
													<span class="nav-arrow">&gt;</span>
												</button>
											</div>
											
											<!-- Accept/Reject Buttons -->
											<div class="carousel-action-buttons">
												<button 
													class="carousel-btn reject" 
													on:click={() => rejectAction(pendingActions[currentPendingIndex].id, pendingActions[currentPendingIndex].text)}
													title="Reject - Tell Daddy why"
												>
													<span class="carousel-btn-icon">✕</span>
												</button>
												<button 
													class="carousel-btn accept" 
													on:click={() => { acceptAction(pendingActions[currentPendingIndex].id); if (currentPendingIndex >= pendingActions.length - 1) currentPendingIndex = Math.max(0, pendingActions.length - 2); }}
													title="Accept - Add to bucket"
												>
													<span class="carousel-btn-icon">✓</span>
												</button>
											</div>
										{/if}
									{:else if actionCarouselTab === 'bucket'}
										<!-- Accepted Actions (In Bucket) -->
										{#if bucketActions.length === 0}
											<div class="carousel-empty">
												<span class="material-symbols-outlined">inbox</span>
												<p>No actions in bucket yet</p>
												<span class="empty-hint">Accept actions from Top Action tab</span>
											</div>
										{:else}
											<div class="carousel-card-container">
												<button class="carousel-nav prev" on:click={() => prevAction('bucket')} disabled={bucketActions.length <= 1}>
													<span class="nav-arrow">&lt;</span>
												</button>
												
												<div class="carousel-action-card bucket-card">
													<div class="bucket-checkbox-row">
														<input 
															type="checkbox" 
															class="bucket-checkbox"
															checked={bucketActions[currentBucketIndex]?.progress === 'green'}
															on:change={() => updateActionProgress(bucketActions[currentBucketIndex].id, bucketActions[currentBucketIndex].progress === 'green' ? 'red' : 'green')}
														/>
														<p class="carousel-action-text">{bucketActions[currentBucketIndex]?.text || ''}</p>
													</div>
													<span class="carousel-action-index">{currentBucketIndex + 1} of {bucketActions.length}</span>
												</div>
												
												<button class="carousel-nav next" on:click={() => nextAction('bucket')} disabled={bucketActions.length <= 1}>
													<span class="nav-arrow">&gt;</span>
												</button>
											</div>
											
											<!-- RAG Progress Buttons -->
											<div class="carousel-rag-buttons">
												<button 
													class="rag-btn-large red" 
													class:active={bucketActions[currentBucketIndex]?.progress === 'red'}
													on:click={() => updateActionProgress(bucketActions[currentBucketIndex].id, 'red')}
													title="Not Started"
												>
													<span class="rag-pentagon"></span>
												</button>
												<button 
													class="rag-btn-large amber" 
													class:active={bucketActions[currentBucketIndex]?.progress === 'amber'}
													on:click={() => updateActionProgress(bucketActions[currentBucketIndex].id, 'amber')}
													title="In Progress"
												>
													<span class="rag-pentagon"></span>
												</button>
												<button 
													class="rag-btn-large green" 
													class:active={bucketActions[currentBucketIndex]?.progress === 'green'}
													on:click={() => updateActionProgress(bucketActions[currentBucketIndex].id, 'green')}
													title="Completed"
												>
													<span class="rag-pentagon"></span>
												</button>
											</div>
										{/if}
									{:else if actionCarouselTab === 'backlog'}
										<!-- Backlog Items -->
										{#if backlogItems.length === 0}
											<div class="carousel-empty">
												<span class="material-symbols-outlined">history</span>
												<p>No backlog items</p>
												<span class="empty-hint">Previous tasks will appear here</span>
											</div>
										{:else}
											<div class="carousel-card-container">
												<button class="carousel-nav prev" on:click={() => prevAction('backlog')} disabled={backlogItems.length <= 1}>
													<span class="nav-arrow">&lt;</span>
												</button>
												
												<div class="carousel-action-card backlog-card-style">
													<p class="carousel-action-text">{backlogItems[currentBacklogIndex]?.text || ''}</p>
													<span class="carousel-action-index">{currentBacklogIndex + 1} of {backlogItems.length}</span>
												</div>
												
												<button class="carousel-nav next" on:click={() => nextAction('backlog')} disabled={backlogItems.length <= 1}>
													<span class="nav-arrow">&gt;</span>
												</button>
											</div>
											
											<!-- RAG Progress Buttons -->
											<div class="carousel-rag-buttons">
												<button 
													class="rag-btn-large red" 
													class:active={backlogItems[currentBacklogIndex]?.progress === 'red'}
													on:click={() => updateActionProgress(backlogItems[currentBacklogIndex].id, 'red')}
													title="Not Started"
												>
													<span class="rag-pentagon"></span>
												</button>
												<button 
													class="rag-btn-large amber" 
													class:active={backlogItems[currentBacklogIndex]?.progress === 'amber'}
													on:click={() => updateActionProgress(backlogItems[currentBacklogIndex].id, 'amber')}
													title="In Progress"
												>
													<span class="rag-pentagon"></span>
												</button>
												<button 
													class="rag-btn-large green" 
													class:active={backlogItems[currentBacklogIndex]?.progress === 'green'}
													on:click={() => updateActionProgress(backlogItems[currentBacklogIndex].id, 'green')}
													title="Completed"
												>
													<span class="rag-pentagon"></span>
												</button>
											</div>
										{/if}
									{/if}
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
								{#if infinityLoading}
									<div class="infinity-loading">
										<span class="material-symbols-outlined spinning">progress_activity</span>
										<span>Loading InFinity data...</span>
									</div>
								{:else if infinityStats}
									<div class="financial-grid">
										<div class="fin-metric">
											<span class="fin-label">TOTAL REVENUE</span>
											<span class="fin-value revenue">₹{(infinityStats.totalRevenue / 100000).toFixed(1)}L</span>
										</div>
										<div class="fin-metric">
											<span class="fin-label">TOTAL INVESTMENT</span>
											<span class="fin-value">₹{(infinityStats.totalInvestment / 100000).toFixed(1)}L</span>
										</div>
										<div class="fin-metric">
											<span class="fin-label">MONTHLY REVENUE</span>
											<span class="fin-value revenue">₹{(infinityStats.monthlyRevenue / 100000).toFixed(1)}L</span>
										</div>
										<div class="fin-metric">
											<span class="fin-label">MONTHLY BURN</span>
											<span class="fin-value burn">₹{(infinityStats.monthlyBurn / 100000).toFixed(1)}L</span>
										</div>
										<div class="fin-metric">
											<span class="fin-label">RUNWAY</span>
											<span class="fin-value">
												{infinityStats.runway > 100 ? '100+ mo' : infinityStats.runway + ' mo'}
											</span>
										</div>
										<div class="fin-metric">
											<span class="fin-label">STATUS</span>
											<span class="fin-value {infinityStats.status === 'Profitable' ? 'profitable' : 'burning'}">
												{infinityStats.status}
											</span>
										</div>
										<div class="fin-metric full-width">
											<span class="fin-label">REVENUE GROWTH</span>
											<span class="fin-value {infinityStats.revenueGrowth >= 0 ? 'profitable' : 'burning'}">
												{(infinityStats.revenueGrowth >= 0 ? '+' : '')}{infinityStats.revenueGrowth.toFixed(1)}%
											</span>
										</div>
									</div>
								{:else}
									<div class="infinity-not-connected">
										<span class="material-symbols-outlined">link_off</span>
										<p>Connect InFinity to see your financial metrics</p>
										<span class="infinity-hint">Link your InFinity account to sync live data</span>
									</div>
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
								{@const rivalry = competitors.toLowerCase().includes('none') ? 'Low' : 'High'}
									<div class="force-card">
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
					</div>
				</div>
				{:else}
					<div class="minimal-card">
						<div class="empty-state">
							<span class="material-symbols-outlined icon-empty">analytics</span>
							<h3>No Valuation Data</h3>
							<p>Complete the assessment to view your valuation</p>
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
				{@const hasRevenue = ddqResponses[12] === 'Yes'}
				{@const teamSize = Number(ddqResponses[17]) || 1}
				{@const stage = ddqResponses[5] || 'Idea'}
				{@const fundingNeeded = ddqResponses[22] || 'Less than ₹10 Lakhs'}
				{@const challenges = ddqResponses[19] || []}
				{@const monthlyRevenue = Number(ddqResponses[13]) || 0}
				{@const customerCount = Number(ddqResponses[15]) || 0}
				{@const arpc = Number(ddqResponses[16]) || 0}
				{@const currentPhase = stage === 'Idea' || stage === 'MVP' ? 'Introduction' : stage === 'Beta' || stage === 'Launched' ? 'Growth' : stage === 'Growing' ? 'Acceleration' : 'Maturity'}
				{@const productName = ddqResponses[1] || 'Your Product'}
				
					<div class="strengths-weaknesses-section">
						<!-- TODAY'S PROBLEM - START HERE -->
						<div class="minimal-card todays-problem-card">
							<div class="card-header">
								<span class="material-symbols-outlined icon-large" style="color: #ef4444;">warning</span>
								<h2 class="section-title">Start Here: Today's Problem</h2>
							</div>
							<p class="section-desc">What's the burning issue RIGHT NOW? Focus all analysis on solving THIS.</p>
							
							<div class="todays-problem-content">
								{#if Array.isArray(challenges) && challenges.length > 0}
									<div class="primary-challenge-box">
										<span class="primary-label">Your #1 Challenge:</span>
										<span class="primary-value">{challenges[0]}</span>
									</div>
									
									<!-- Challenge-specific SWOT Focus -->
									<div class="challenge-swot-focus">
										<h4>📊 SWOT Analysis for "{challenges[0]}" Challenge</h4>
										<div class="challenge-swot-grid">
											<div class="challenge-swot-item leverage">
												<span class="csw-header">💪 Leverage (Strengths to Use)</span>
												{#if swotAnalysis.strengths && swotAnalysis.strengths.length > 0}
													<p>{swotAnalysis.strengths[0]}</p>
												{:else}
													<p>Identify core strengths to tackle this</p>
												{/if}
											</div>
											<div class="challenge-swot-item fix">
												<span class="csw-header">🔧 Fix (Weakness Causing This)</span>
												{#if swotAnalysis.weaknesses && swotAnalysis.weaknesses.length > 0}
													<p>{swotAnalysis.weaknesses.find((w) => w.toLowerCase().includes(challenges[0].toLowerCase().slice(0, 4))) || swotAnalysis.weaknesses[0]}</p>
												{:else}
													<p>Identify weakness to address</p>
												{/if}
											</div>
											<div class="challenge-swot-item capture">
												<span class="csw-header">🎯 Capture (Opportunity)</span>
												{#if swotAnalysis.opportunities && swotAnalysis.opportunities.length > 0}
													<p>{swotAnalysis.opportunities[0]}</p>
												{:else}
													<p>Identify opportunity to capture</p>
												{/if}
											</div>
											<div class="challenge-swot-item mitigate">
												<span class="csw-header">🛡️ Mitigate (Threat)</span>
												{#if swotAnalysis.threats && swotAnalysis.threats.length > 0}
													<p>{swotAnalysis.threats[0]}</p>
												{:else}
													<p>Identify threat to mitigate</p>
												{/if}
											</div>
										</div>
									</div>
									
									<!-- Specific Why for this challenge -->
									<div class="why-this-matters">
										<h4>🤔 Why "{challenges[0]}" Matters Right Now</h4>
										<div class="why-content">
											{#if challenges[0] === 'Customers'}
												<p><strong>Revenue depends on it:</strong> Without customers, there's no business. At {stage} stage, every new customer is proof of product-market fit.</p>
												<p><strong>Your signal:</strong> {customerCount > 0 ? `You have ${customerCount} customers. Can you 2x in 30 days?` : 'Get your first 5 paying customers before anything else.'}</p>
											{:else if challenges[0] === 'Funding'}
												<p><strong>Runway is life:</strong> You need capital to execute. But raising too early = bad terms. Raising too late = desperation.</p>
												<p><strong>Your signal:</strong> {hasRevenue ? 'Revenue is your leverage. Show growth before you ask.' : 'Pre-revenue fundraise is harder. Show traction first.'}</p>
											{:else if challenges[0] === 'Product'}
												<p><strong>Product is foundation:</strong> Everything else is amplification. If product doesn't work, marketing won't save it.</p>
												<p><strong>Your signal:</strong> {stage === 'MVP' || stage === 'Beta' ? 'You\'re building. Focus on 1 feature that users love, not 10 they don\'t.' : 'Iterate based on usage data, not opinions.'}</p>
											{:else if challenges[0] === 'Team'}
												<p><strong>Team = execution capacity:</strong> You can only move as fast as your team allows. Wrong hires cost more than slow hires.</p>
												<p><strong>Your signal:</strong> Team size is {teamSize}. What's the ONE role that would unblock everything?</p>
											{:else if challenges[0] === 'Competition'}
												<p><strong>Competition is validation:</strong> If there's competition, there's a market. Differentiate on 1 thing, not 10.</p>
												<p><strong>Your signal:</strong> What can you do that competitors CAN'T or WON'T?</p>
											{:else}
												<p><strong>Focus creates momentum:</strong> Solving one problem well beats spreading thin across many.</p>
												<p><strong>Your signal:</strong> What's the ONE thing that, if solved, makes everything else easier?</p>
											{/if}
										</div>
									</div>
									
									<!-- Other challenges shown smaller -->
									{#if challenges.length > 1}
										<div class="secondary-challenges">
											<span class="secondary-label">Other challenges to address:</span>
											<div class="secondary-tags">
												{#each challenges.slice(1) as challenge}
													<span class="secondary-tag">{challenge}</span>
												{/each}
											</div>
										</div>
									{/if}
								{:else}
									<div class="no-challenges">
										<p>No specific challenges selected. Go to your Profile and update the DDQ to specify current challenges.</p>
										<button class="btn-secondary" on:click={() => activeTab = 'profile'}>
											<span class="material-symbols-outlined">edit</span>
											Update Challenges
										</button>
									</div>
								{/if}
							</div>
						</div>
						
						<!-- Introspection Overview -->
						<div class="actionable-summary-box introspection-overview">
							<div class="summary-header">
								<span class="material-symbols-outlined">lightbulb</span>
								<h3>What is Introspection?</h3>
							</div>
							<p class="summary-text">Introspection provides <strong>decision intelligence</strong> — not generic advice. It answers: What should you do next, and why is that the highest-leverage move?</p>
							<div class="action-checklist">
								<div class="checklist-title">🎯 Your Focus Areas:</div>
								<ul>
									<li><strong>Value Drivers:</strong> Identify what moves your valuation most</li>
									<li><strong>Decision Impact:</strong> Understand Act Now vs Delay consequences</li>
									<li><strong>Triggers:</strong> Set up IF→THEN rules for proactive decisions</li>
								</ul>
							</div>
						</div>

						<!-- 1. Value Driver Analysis -->
						<div class="minimal-card">
							<div class="actionable-guide">
								<span class="guide-icon">📌</span>
								<div class="guide-content">
									<strong>What to do:</strong> Focus 70% of your energy on Driver #1. Check if "Signal" is Weak — that means you need more validation. "Controllable = Yes" means you can impact this in 30-60 days.
								</div>
							</div>
							<div class="card-header">
								<span class="material-symbols-outlined icon-large">insights</span>
								<h2 class="section-title">Value Driver Analysis</h2>
								<div class="card-header-actions">
									<button class="info-btn" on:click={() => showInfo('value-driver')} title="What is this?">
										<span class="info-icon">i</span>
									</button>
									<button class="daddy-btn" on:click={() => askDaddy('value-driver')} title="Ask Daddy">
										<span class="daddy-icon">D</span>
									</button>
								</div>
							</div>
							<p class="section-desc">Top 3 factors that move your company value right now — ranked by expected impact</p>
							
							{#if true}
							{@const driver1Signal = hasRevenue ? 'Strong' : customerCount > 50 ? 'Medium' : 'Weak'}
							{@const driver2Signal = teamSize >= 2 && stage !== 'Idea' ? 'Medium' : 'Weak'}
							{@const driver3Signal = monthlyRevenue > 100000 ? 'Strong' : hasRevenue ? 'Medium' : 'Weak'}
							
							<div class="value-drivers-list">
								<!-- Driver #1 -->
								<div class="value-driver-card rank-1">
									<div class="driver-rank">
										<span class="rank-number">#1</span>
										<span class="rank-label">Highest Impact</span>
									</div>
									<div class="driver-content">
										<h4 class="driver-title">
											<span class="material-symbols-outlined">{hasRevenue ? 'payments' : 'group_add'}</span>
											{hasRevenue ? 'Revenue Velocity' : 'Customer Acquisition'}
										</h4>
										<p class="driver-why">
											{#if hasRevenue}
												<strong>Why now:</strong> You have revenue. Increasing velocity directly multiplies valuation at your stage. Every 10% MoM growth adds ~15% to valuation perception.
											{:else}
												<strong>Why now:</strong> Pre-revenue stage = all valuation hinges on traction proof. First 10 paying customers are worth more than any feature.
											{/if}
										</p>
										<div class="driver-metrics">
											<div class="metric-badge signal-{driver1Signal.toLowerCase()}">
												<span class="metric-label">Signal</span>
												<span class="metric-value">{driver1Signal}</span>
											</div>
											<div class="metric-badge controllable-yes">
												<span class="metric-label">Controllable</span>
												<span class="metric-value">Yes (30-60 days)</span>
											</div>
										</div>
									</div>
									<div class="driver-impact">
										<span class="impact-label">Valuation Impact</span>
										<span class="impact-value">+20-40%</span>
									</div>
								</div>
								
								<!-- Driver #2 -->
								<div class="value-driver-card rank-2">
									<div class="driver-rank">
										<span class="rank-number">#2</span>
										<span class="rank-label">High Impact</span>
									</div>
									<div class="driver-content">
										<h4 class="driver-title">
											<span class="material-symbols-outlined">{stage === 'Idea' || stage === 'MVP' ? 'science' : 'trending_up'}</span>
											{stage === 'Idea' || stage === 'MVP' ? 'Product-Market Fit Signal' : 'Growth Rate Consistency'}
										</h4>
										<p class="driver-why">
											{#if stage === 'Idea' || stage === 'MVP'}
												<strong>Why now:</strong> Without PMF signal, you're fundraising on vision alone. One clear retention metric changes the entire conversation.
											{:else}
												<strong>Why now:</strong> Consistent growth beats spiky growth. 3 months of steady 15% beats one month of 50%. Investors pattern-match on trajectory.
											{/if}
										</p>
										<div class="driver-metrics">
											<div class="metric-badge signal-{driver2Signal.toLowerCase()}">
												<span class="metric-label">Signal</span>
												<span class="metric-value">{driver2Signal}</span>
											</div>
											<div class="metric-badge controllable-partial">
												<span class="metric-label">Controllable</span>
												<span class="metric-value">Partially</span>
											</div>
										</div>
									</div>
									<div class="driver-impact">
										<span class="impact-label">Valuation Impact</span>
										<span class="impact-value">+15-25%</span>
									</div>
								</div>
								
								<!-- Driver #3 -->
								<div class="value-driver-card rank-3">
									<div class="driver-rank">
										<span class="rank-number">#3</span>
										<span class="rank-label">Medium Impact</span>
									</div>
									<div class="driver-content">
										<h4 class="driver-title">
											<span class="material-symbols-outlined">{Array.isArray(challenges) && challenges.includes('Funding') ? 'account_balance' : 'reduce_capacity'}</span>
											{Array.isArray(challenges) && challenges.includes('Funding') ? 'Runway Extension' : 'Unit Economics'}
										</h4>
										<p class="driver-why">
											{#if Array.isArray(challenges) && challenges.includes('Funding')}
												<strong>Why now:</strong> With funding as a challenge, extending runway buys negotiating leverage. Every extra month = better terms or backup options.
											{:else}
												<strong>Why now:</strong> LTV:CAC ratio is the investor litmus test. Proving you can acquire customers profitably removes the biggest risk question.
											{/if}
										</p>
										<div class="driver-metrics">
											<div class="metric-badge signal-{driver3Signal.toLowerCase()}">
												<span class="metric-label">Signal</span>
												<span class="metric-value">{driver3Signal}</span>
											</div>
											<div class="metric-badge controllable-yes">
												<span class="metric-label">Controllable</span>
												<span class="metric-value">Yes (30-60 days)</span>
											</div>
										</div>
									</div>
									<div class="driver-impact">
										<span class="impact-label">Valuation Impact</span>
										<span class="impact-value">+10-20%</span>
									</div>
								</div>
							</div>
							{/if}
						</div>
						
						<!-- 2. Decision Impact Analysis -->
						<div class="minimal-card">
							<div class="actionable-guide">
								<span class="guide-icon">⚡</span>
								<div class="guide-content">
									<strong>What to do:</strong> Compare "Act Now" vs "Delay" scenarios. Check the <em>Reversibility</em> — if it's "Low", don't delay. Follow the Recommendation timeline (14-30 days). Lost time cannot be recovered.
								</div>
							</div>
							<div class="card-header">
								<span class="material-symbols-outlined icon-large">compare_arrows</span>
								<h2 class="section-title">Decision Impact Analysis</h2>
								<div class="card-header-actions">
									<button class="info-btn" on:click={() => showInfo('decision-impact')} title="What is this?">
										<span class="info-icon">i</span>
									</button>
									<button class="daddy-btn" on:click={() => askDaddy('decision-impact')} title="Ask Daddy">
										<span class="daddy-icon">D</span>
									</button>
								</div>
							</div>
							<p class="section-desc">Act Now vs. Delay — impact on runway, growth, and valuation perception</p>
							
							{#if true}
							{@const primaryDecision = !hasRevenue ? 'Launch pricing & get first paying customer' : stage === 'Idea' || stage === 'MVP' ? 'Accelerate to PMF validation' : 'Scale customer acquisition'}
							{@const runwayMonths = fundingNeeded === 'Less than ₹10 Lakhs' ? 6 : fundingNeeded === '₹10-50 Lakhs' ? 12 : 18}
							
							<div class="decision-scenarios">
								<div class="current-decision">
									<span class="material-symbols-outlined">priority_high</span>
									<div class="decision-text">
										<span class="decision-label">Key Decision:</span>
										<strong>{primaryDecision}</strong>
									</div>
								</div>
								
								<div class="scenarios-grid">
									<!-- Scenario A: Act Now -->
									<div class="scenario-card act-now">
										<div class="scenario-header">
											<span class="scenario-badge">Scenario A</span>
											<h4>Act Now</h4>
										</div>
										<div class="scenario-impacts">
											<div class="impact-row">
												<span class="impact-icon">💰</span>
												<span class="impact-name">Runway Impact</span>
												<span class="impact-result negative">{hasRevenue ? '-1 to -2 months (investment)' : '-2 to -3 months (burn increase)'}</span>
											</div>
											<div class="impact-row">
												<span class="impact-icon">📈</span>
												<span class="impact-name">Growth Impact</span>
												<span class="impact-result positive">{hasRevenue ? '+15-25% MoM acceleration' : 'Establishes baseline metrics'}</span>
											</div>
											<div class="impact-row">
												<span class="impact-icon">💎</span>
												<span class="impact-name">Valuation Perception</span>
												<span class="impact-result positive">{hasRevenue ? '+20-30% if successful' : 'Moves from idea to traction stage'}</span>
											</div>
											<div class="impact-row">
												<span class="impact-icon">⚠️</span>
												<span class="impact-name">Key Downside</span>
												<span class="impact-result warning">{hasRevenue ? 'Execution risk, team bandwidth' : 'Premature scaling if PMF unclear'}</span>
											</div>
											<div class="impact-row">
												<span class="impact-icon">🔄</span>
												<span class="impact-name">Reversibility</span>
												<span class="impact-result">Medium — can course-correct in 4-6 weeks</span>
											</div>
										</div>
									</div>
									
									<!-- Scenario B: Delay -->
									<div class="scenario-card delay">
										<div class="scenario-header">
											<span class="scenario-badge">Scenario B</span>
											<h4>Delay 60 Days</h4>
										</div>
										<div class="scenario-impacts">
											<div class="impact-row">
												<span class="impact-icon">💰</span>
												<span class="impact-name">Runway Impact</span>
												<span class="impact-result neutral">Preserves current burn rate</span>
											</div>
											<div class="impact-row">
												<span class="impact-icon">📈</span>
												<span class="impact-name">Growth Impact</span>
												<span class="impact-result negative">{hasRevenue ? 'Momentum stalls, competitors gain' : 'Validation delayed 60+ days'}</span>
											</div>
											<div class="impact-row">
												<span class="impact-icon">💎</span>
												<span class="impact-name">Valuation Perception</span>
												<span class="impact-result negative">{stage === 'Idea' ? 'Stagnant = negative signal' : '-10-15% if growth slows'}</span>
											</div>
											<div class="impact-row">
												<span class="impact-icon">⚠️</span>
												<span class="impact-name">Key Downside</span>
												<span class="impact-result warning">Window closes — market timing, competitor moves</span>
											</div>
											<div class="impact-row">
												<span class="impact-icon">🔄</span>
												<span class="impact-name">Reversibility</span>
												<span class="impact-result">Low — lost time cannot be recovered</span>
											</div>
										</div>
									</div>
								</div>
								
								<!-- Recommendation -->
								<div class="decision-recommendation">
									<div class="recommendation-header">
										<span class="material-symbols-outlined">gavel</span>
										<strong>Recommendation</strong>
									</div>
									<p class="recommendation-text">
										{#if !hasRevenue}
											<strong>Act within 14 days.</strong> Your highest-leverage move is getting to first revenue. Delay compounds — every week without revenue data makes fundraising harder. The downside of premature action (course-correction) is lower than the downside of waiting (market window, competitor progress).
										{:else if stage === 'Idea' || stage === 'MVP'}
											<strong>Act within 21 days.</strong> PMF signal is your unlock. Delaying validation means building on assumptions. Execute a focused 4-week sprint to prove retention or pivot fast. Uncertainty is your enemy — resolve it.
										{:else}
											<strong>Act within 30 days.</strong> Growth compounds. A 60-day delay at your stage costs ~{Math.round(15 * (runwayMonths/12))}% in potential valuation gain. Your unit economics support scaling — waiting is leaving money on the table.
										{/if}
									</p>
								</div>
							</div>
							{/if}
						</div>
						
						<!-- 3. Trajectory & Trigger Analysis -->
						<div class="minimal-card">
							<div class="actionable-guide">
								<span class="guide-icon">🎯</span>
								<div class="guide-content">
									<strong>What to do:</strong> Check your Trajectory status (🔴 Fragile/🟡 Stable/🟢 Accelerating). Monitor the Leading Indicators weekly. Set calendar reminders for each IF→THEN trigger. Act BEFORE triggers fire — don't wait for crises.
								</div>
							</div>
							<div class="card-header">
								<span class="material-symbols-outlined icon-large">timeline</span>
								<h2 class="section-title">Trajectory & Trigger Analysis</h2>
								<div class="card-header-actions">
									<button class="info-btn" on:click={() => showInfo('trajectory-trigger')} title="What is this?">
										<span class="info-icon">i</span>
									</button>
									<button class="daddy-btn" on:click={() => askDaddy('trajectory-trigger')} title="Ask Daddy">
										<span class="daddy-icon">D</span>
									</button>
								</div>
							</div>
							<p class="section-desc">Current trajectory assessment with explicit "If X → do Y" triggers</p>
							
							{#if true}
							{@const trajectoryStatus = !hasRevenue ? 'Fragile' : monthlyRevenue > 500000 && customerCount > 100 ? 'Accelerating' : 'Stable'}
							{@const runwayEstimate = fundingNeeded === 'Less than ₹10 Lakhs' ? 6 : fundingNeeded === '₹10-50 Lakhs' ? 12 : 18}
							
							<div class="trajectory-analysis">
								<!-- Current Trajectory Status -->
								<div class="trajectory-status status-{trajectoryStatus.toLowerCase()}">
									<div class="status-indicator">
										<span class="material-symbols-outlined">
											{trajectoryStatus === 'Accelerating' ? 'rocket_launch' : trajectoryStatus === 'Stable' ? 'trending_flat' : 'warning'}
										</span>
									</div>
									<div class="status-content">
										<h4>Current Trajectory: <strong class="trajectory-label">{trajectoryStatus}</strong></h4>
										<p class="trajectory-desc">
											{#if trajectoryStatus === 'Fragile'}
												Pre-revenue or early stage with unvalidated assumptions. High dependency on execution and market timing. Vulnerable to delays and competitive moves.
											{:else if trajectoryStatus === 'Stable'}
												Positive signals but not yet compounding. Risk of stagnation if growth levers aren't activated. Need to convert stability into momentum.
											{:else}
												Multiple growth signals firing. Momentum building. Primary risk is now execution capacity and capital efficiency, not validation.
											{/if}
										</p>
									</div>
								</div>
								
								<!-- Leading Indicators -->
								<div class="leading-indicators">
									<h4><span class="material-symbols-outlined">monitoring</span> Leading Indicators to Watch</h4>
									<div class="indicators-list">
										<div class="indicator-item signal-{hasRevenue ? 'positive' : 'neutral'}">
											<span class="indicator-icon">{hasRevenue ? '🟢' : '🟡'}</span>
											<div class="indicator-content">
												<span class="indicator-name">Revenue Signal</span>
												<span class="indicator-status">{hasRevenue ? 'Active — monitor MoM growth rate' : 'Not yet — critical to establish'}</span>
											</div>
										</div>
										<div class="indicator-item signal-{customerCount > 50 ? 'positive' : customerCount > 10 ? 'neutral' : 'negative'}">
											<span class="indicator-icon">{customerCount > 50 ? '🟢' : customerCount > 10 ? '🟡' : '🔴'}</span>
											<div class="indicator-content">
												<span class="indicator-name">Customer Velocity</span>
												<span class="indicator-status">{customerCount > 50 ? 'Healthy acquisition rate' : customerCount > 10 ? 'Building traction' : 'Below threshold — focus here'}</span>
											</div>
										</div>
										<div class="indicator-item signal-{Array.isArray(challenges) && challenges.includes('Funding') ? 'negative' : 'neutral'}">
											<span class="indicator-icon">{Array.isArray(challenges) && challenges.includes('Funding') ? '🔴' : '🟡'}</span>
											<div class="indicator-content">
												<span class="indicator-name">Runway Pressure</span>
												<span class="indicator-status">{Array.isArray(challenges) && challenges.includes('Funding') ? 'Active concern — {runwayEstimate} months est.' : '~{runwayEstimate} months — monitor burn'}</span>
											</div>
										</div>
									</div>
								</div>
								
								<!-- Explicit Triggers -->
								<div class="explicit-triggers">
									<h4><span class="material-symbols-outlined">alt_route</span> Decision Triggers</h4>
									<div class="triggers-list">
										<!-- Trigger 1 -->
										<div class="trigger-rule">
											<div class="trigger-condition">
												<span class="if-label">IF</span>
												<span class="condition-text">{hasRevenue ? 'MoM growth drops below 10% for 2 consecutive months' : 'No paying customer within 45 days'}</span>
											</div>
											<div class="trigger-arrow">→</div>
											<div class="trigger-action">
												<span class="then-label">THEN</span>
												<span class="action-text">{hasRevenue ? 'Pause new features. Run customer interviews. Identify churn drivers.' : 'Pivot positioning or target segment. Current approach is not converting.'}</span>
											</div>
										</div>
										
										<!-- Trigger 2 -->
										<div class="trigger-rule">
											<div class="trigger-condition">
												<span class="if-label">IF</span>
												<span class="condition-text">{Array.isArray(challenges) && challenges.includes('Competition') ? 'Competitor raises funding or launches major feature' : 'Runway drops below 4 months'}</span>
											</div>
											<div class="trigger-arrow">→</div>
											<div class="trigger-action">
												<span class="then-label">THEN</span>
												<span class="action-text">{Array.isArray(challenges) && challenges.includes('Competition') ? 'Accelerate core differentiation. Consider strategic partnerships for defensibility.' : 'Cut non-essential burn by 30%. Start fundraise conversations immediately.'}</span>
											</div>
										</div>
										
										<!-- Trigger 3 -->
										<div class="trigger-rule positive">
											<div class="trigger-condition">
												<span class="if-label">IF</span>
												<span class="condition-text">{hasRevenue ? 'Organic referrals exceed 20% of new customers' : 'First 5 customers show >60% week-1 retention'}</span>
											</div>
											<div class="trigger-arrow">→</div>
											<div class="trigger-action">
												<span class="then-label">THEN</span>
												<span class="action-text">{hasRevenue ? 'Double down on referral program. This is your growth lever — invest aggressively.' : 'You have PMF signal. Shift from validation to scaling mode. Start fundraise prep.'}</span>
											</div>
										</div>
									</div>
								</div>
								
								<!-- Inaction Consequence -->
								<div class="inaction-warning">
									<span class="material-symbols-outlined">report</span>
									<div class="warning-content">
										<strong>If no action taken:</strong>
										{#if trajectoryStatus === 'Fragile'}
											Runway depletes without validation. Forces distressed fundraising or shutdown within {runwayEstimate} months. Competitor moat deepens.
										{:else if trajectoryStatus === 'Stable'}
											Stability becomes stagnation. Investors see flat metrics as negative signal. Valuation erodes 15-20% per quarter without growth.
										{:else}
											Momentum peaks then declines. Market window closes. Growth compounds work both ways — missed opportunities don't return.
										{/if}
									</div>
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

			<!-- GTM Tab - Dynamic Strategy -->
			{:else if activeTab === 'gtm'}
				{#if valuation && ddqResponses}
					{@const productName = ddqResponses[1] || 'Your Product'}
					{@const stage = ddqResponses[5] || 'Idea'}
					{@const fundingNeeded = ddqResponses[22] || 'Less than ₹10 Lakhs'}
					{@const teamSize = Number(ddqResponses[17]) || 1}
					{@const targetCustomer = ddqResponses[8] || 'Not specified'}
					{@const monthlyRevenue = Number(ddqResponses[13]) || 0}
					{@const customerCount = Number(ddqResponses[15]) || 0}
					{@const runwayMonths = fundingNeeded === 'Less than ₹10 Lakhs' ? 6 : fundingNeeded === '₹10-25 Lakhs' ? 9 : fundingNeeded === '₹25-50 Lakhs' ? 12 : 18}
					{@const gtmStageLocal = !hasRevenue ? 'Pre-Revenue' : customerCount < 10 ? 'Early Traction' : customerCount < 50 ? 'Growth' : 'Scaling'}
					{@const currentTraction = hasRevenue ? `₹${monthlyRevenue.toLocaleString('en-IN')}/mo, ${customerCount} customers` : customerCount > 0 ? `${customerCount} beta users` : 'No traction yet'}

					<div class="gtm-section">
						<!-- GTM Header with Generate Button -->
						<div class="gtm-header-card minimal-card">
							<div class="gtm-header-content">
								<div class="gtm-title-section">
									<span class="material-symbols-outlined gtm-icon">rocket_launch</span>
									<div>
										<h1 class="gtm-title">GTM Strategy for {productName}</h1>
										<p class="gtm-subtitle">Investor-grade, execution-ready Go-To-Market plan</p>
									</div>
								</div>
								<div class="gtm-header-actions">
									<div class="gtm-stage-badge {gtmStageLocal.toLowerCase().replace(' ', '-')}">
										{gtmStageLocal}
									</div>
									<button 
										class="btn-generate-gtm" 
										on:click={generateGTMStrategy}
										disabled={gtmLoading}
									>
										{#if gtmLoading}
											<span class="material-symbols-outlined rotating">sync</span>
											Generating...
										{:else}
											<span class="material-symbols-outlined">auto_awesome</span>
											{gtmStrategy ? 'Regenerate Strategy' : 'Generate GTM Strategy'}
										{/if}
									</button>
								</div>
							</div>
							<div class="gtm-quick-stats">
								<div class="quick-stat">
									<span class="stat-label">Stage</span>
									<span class="stat-value">{stage}</span>
								</div>
								<div class="quick-stat">
									<span class="stat-label">Runway</span>
									<span class="stat-value">~{runwayMonths} months</span>
								</div>
								<div class="quick-stat">
									<span class="stat-label">Traction</span>
									<span class="stat-value">{currentTraction}</span>
								</div>
								<div class="quick-stat">
									<span class="stat-label">Team</span>
									<span class="stat-value">{teamSize} {teamSize === 1 ? 'person' : 'people'}</span>
								</div>
							</div>
						</div>

						<!-- Decision Simulation -->
						<div class="minimal-card simulation-card">
							<div class="card-header">
								<span class="material-symbols-outlined icon-large">science</span>
								<h3 class="section-title">Decision Simulation</h3>
								<div class="card-header-actions">
									<button class="info-btn" on:click={() => showInfo('simulation')} title="What is this?">
										<span class="info-icon">i</span>
									</button>
								</div>
							</div>
							<p class="section-desc">Simulate the impact of a GTM decision before you execute</p>
							
							<div class="simulation-input-area">
								<textarea 
									bind:value={simulationInput}
									placeholder="Describe a GTM decision you're considering... e.g., 'Launch product on ProductHunt' or 'Partner with 3 influencers' or 'Run LinkedIn ads for ₹50K'"
									rows="2"
								></textarea>
								<button class="simulate-btn" on:click={async () => {
									if (!simulationInput.trim()) return;
									simulationLoading = true;
									
									try {
										// Call the real simulation API
										const response = await fetch(`${API_URL}/api/simulation/run`, {
											method: 'POST',
											headers: {
												'Content-Type': 'application/json',
												'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
											},
											body: JSON.stringify({
												decision: simulationInput,
												context: gtmStrategy ? JSON.stringify({
													stage: gtmStageLocal,
													traction: currentTraction,
													productName: productName
												}) : '',
												companyData: {
													industry: ddqResponses[3]?.[0] || ddqResponses[3] || 'Technology',
													stage: ddqResponses[5] || 'Early-stage',
													teamSize: ddqResponses[6] || '1-5',
													revenue: ddqResponses[9] || 'Pre-revenue',
													challenge: ddqResponses[19]?.[0] || 'Growth'
												},
												timeframe: '6 months'
											})
										});
										
										if (response.ok) {
											const data = await response.json();
											const sim = data.simulation;
											
											// Transform API response to match UI format - use new impactAnalysis structure
											simulationResult = {
												scenario: simulationInput,
												runwayImpact: sim.impactAnalysis?.runway || { 
													value: sim.financialImpact?.runwayChange || 'Impact varies', 
													direction: sim.probability?.success > 60 ? 'positive' : 'neutral' 
												},
												growthImpact: sim.impactAnalysis?.growth || { 
													value: sim.financialImpact?.revenueChange || `${sim.probability?.success || 50}% success likelihood`, 
													direction: sim.probability?.success > 60 ? 'positive' : sim.probability?.success > 40 ? 'neutral' : 'negative' 
												},
												valuationImpact: sim.impactAnalysis?.valuation || { 
													value: sim.bestCase?.timeline || 'Based on execution',
													direction: 'neutral' 
												},
												riskLevel: sim.impactAnalysis?.riskLevel || (sim.keyFactors?.some((f: any) => f.impact === 'high' && !f.controllable) ? 'high' : 'medium'),
												recommendation: sim.recommendation || 'Consider the tradeoffs carefully before proceeding.',
												confidence: sim.probability?.success || 65,
												summary: sim.summary,
												bestCase: sim.bestCase,
												worstCase: sim.worstCase,
												nextSteps: sim.nextSteps,
												alternativeApproaches: sim.alternativeApproaches
											};
										} else {
											const errorData = await response.json().catch(() => ({}));
											console.error('Simulation API error:', errorData);
											throw new Error(errorData.error || 'API call failed');
										}
									} catch (error) {
										console.error('Simulation error:', error);
										// Fallback to local simulation
										const isExpansion = simulationInput.toLowerCase().includes('expand') || simulationInput.toLowerCase().includes('launch') || simulationInput.toLowerCase().includes('new');
										const isHiring = simulationInput.toLowerCase().includes('hire') || simulationInput.toLowerCase().includes('team');
										const isFunding = simulationInput.toLowerCase().includes('raise') || simulationInput.toLowerCase().includes('fund');
										
										simulationResult = {
											scenario: simulationInput,
											runwayImpact: isHiring ? { value: '-2 to -4 months', direction: 'negative' } : isFunding ? { value: '+8 to +12 months', direction: 'positive' } : { value: '-1 to -2 months', direction: 'negative' },
											growthImpact: isExpansion ? { value: '+25-40% potential', direction: 'positive' } : isHiring ? { value: '+15-20% capacity', direction: 'positive' } : { value: '+10-15%', direction: 'positive' },
											valuationImpact: isFunding ? { value: '+20-30% post-money', direction: 'positive' } : isExpansion ? { value: '+15-25% if successful', direction: 'positive' } : { value: '+5-10%', direction: 'neutral' },
											riskLevel: isExpansion ? 'high' : isHiring ? 'medium' : isFunding ? 'medium' : 'low',
											recommendation: isExpansion ? 'Consider pilot testing in one area first before full expansion. Set clear success metrics.' : isHiring ? 'Hire for the bottleneck, not the backlog. Ensure you have 6+ months runway post-hire.' : isFunding ? 'Raise when you have leverage (growth metrics), not when you need it. Have a clear use-of-funds plan.' : 'Proceed with caution. Monitor leading indicators weekly.',
											confidence: isExpansion ? 65 : isHiring ? 75 : isFunding ? 70 : 80
										};
									}
									simulationLoading = false;
								}} disabled={simulationLoading || !simulationInput.trim()}>
									{#if simulationLoading}
										<span class="material-symbols-outlined spinning">progress_activity</span>
										Simulating...
									{:else}
										<span class="material-symbols-outlined">play_arrow</span>
										Simulate Impact
									{/if}
								</button>
							</div>
							
							{#if simulationResult}
								<div class="simulation-results">
									<div class="simulation-scenario">
										<span class="material-symbols-outlined">lightbulb</span>
										<strong>Scenario:</strong> {simulationResult.scenario}
									</div>
									
									{#if simulationResult.summary}
										<div class="simulation-summary">
											<span class="material-symbols-outlined">summarize</span>
											<p>{simulationResult.summary}</p>
										</div>
									{/if}
									
									<div class="simulation-impacts-grid">
										<div class="sim-impact-card {simulationResult.runwayImpact.direction}">
											<span class="sim-icon">💰</span>
											<span class="sim-label">Runway Impact</span>
											<span class="sim-value">{simulationResult.runwayImpact.value}</span>
										</div>
										<div class="sim-impact-card {simulationResult.growthImpact.direction}">
											<span class="sim-icon">📈</span>
											<span class="sim-label">Growth Impact</span>
											<span class="sim-value">{simulationResult.growthImpact.value}</span>
										</div>
										<div class="sim-impact-card {simulationResult.valuationImpact.direction}">
											<span class="sim-icon">💎</span>
											<span class="sim-label">Valuation Impact</span>
											<span class="sim-value">{simulationResult.valuationImpact.value}</span>
										</div>
										<div class="sim-impact-card risk-{simulationResult.riskLevel}">
											<span class="sim-icon">⚠️</span>
											<span class="sim-label">Risk Level</span>
											<span class="sim-value">{simulationResult.riskLevel.toUpperCase()}</span>
										</div>
									</div>
									
									{#if simulationResult.bestCase || simulationResult.worstCase}
										<div class="scenario-cards">
											{#if simulationResult.bestCase}
												<div class="scenario-card best-case">
													<div class="scenario-header">
														<span class="material-symbols-outlined">trending_up</span>
														<strong>Best Case Scenario</strong>
													</div>
													<p class="scenario-desc">{simulationResult.bestCase.description}</p>
													{#if simulationResult.bestCase.metrics?.length}
														<ul class="scenario-list">
															{#each simulationResult.bestCase.metrics as metric}
																<li><span class="material-symbols-outlined">check_circle</span> {metric}</li>
															{/each}
														</ul>
													{/if}
													{#if simulationResult.bestCase.timeline}
														<span class="timeline-badge">⏱️ {simulationResult.bestCase.timeline}</span>
													{/if}
												</div>
											{/if}
											
											{#if simulationResult.worstCase}
												<div class="scenario-card worst-case">
													<div class="scenario-header">
														<span class="material-symbols-outlined">trending_down</span>
														<strong>Worst Case Scenario</strong>
													</div>
													<p class="scenario-desc">{simulationResult.worstCase.description}</p>
													{#if simulationResult.worstCase.risks?.length}
														<div class="risks-section">
															<span class="sub-label">Risks:</span>
															<ul class="scenario-list">
																{#each simulationResult.worstCase.risks as risk}
																	<li><span class="material-symbols-outlined">warning</span> {risk}</li>
																{/each}
															</ul>
														</div>
													{/if}
													{#if simulationResult.worstCase.mitigation?.length}
														<div class="mitigation-section">
															<span class="sub-label">Mitigation:</span>
															<ul class="scenario-list">
																{#each simulationResult.worstCase.mitigation as action}
																	<li><span class="material-symbols-outlined">shield</span> {action}</li>
																{/each}
															</ul>
														</div>
													{/if}
												</div>
											{/if}
										</div>
									{/if}
									
									<div class="simulation-recommendation">
										<div class="rec-header">
											<span class="material-symbols-outlined">gavel</span>
											<strong>Recommendation</strong>
											<span class="confidence-badge">Confidence: {simulationResult.confidence}%</span>
										</div>
										<p>{simulationResult.recommendation}</p>
									</div>
									
									{#if simulationResult.nextSteps?.length}
										<div class="next-steps-section">
											<div class="section-header">
												<span class="material-symbols-outlined">checklist</span>
												<strong>Next Steps</strong>
											</div>
											<ol class="next-steps-list">
												{#each simulationResult.nextSteps as step, i}
													<li>{step}</li>
												{/each}
											</ol>
										</div>
									{/if}
									
									{#if simulationResult.alternativeApproaches?.length}
										<div class="alternatives-section">
											<div class="section-header">
												<span class="material-symbols-outlined">alt_route</span>
												<strong>Alternative Approaches</strong>
											</div>
											<div class="alternatives-grid">
												{#each simulationResult.alternativeApproaches as alt}
													<div class="alternative-card">
														<span class="alt-approach">{alt.approach}</span>
														<span class="alt-tradeoff">↔️ {alt.tradeoff}</span>
													</div>
												{/each}
											</div>
										</div>
									{/if}
									
									<button class="btn-secondary" on:click={() => { simulationResult = null; simulationInput = ''; }}>
										<span class="material-symbols-outlined">refresh</span>
										New Simulation
									</button>
								</div>
							{/if}
						</div>

						{#if gtmError}
							<div class="gtm-error-card minimal-card">
								<span class="material-symbols-outlined">error</span>
								<p>{gtmError}</p>
								<button class="btn-retry" on:click={generateGTMStrategy}>Try Again</button>
							</div>
						{/if}

						{#if gtmLoading}
							<div class="gtm-loading-card minimal-card">
								<div class="loading-spinner"></div>
								<h3>Generating Your GTM Strategy</h3>
								<p>Analyzing your product, market, and competition to create a tailored strategy...</p>
							</div>
						{:else if gtmStrategy}
							<!-- GTM Navigation Tabs -->
							<div class="gtm-nav-tabs">
								<button class="gtm-nav-tab" class:active={activeGtmSection === 'overview'} on:click={() => activeGtmSection = 'overview'}>
									<span class="material-symbols-outlined">dashboard</span>
									Overview
								</button>
								<button class="gtm-nav-tab" class:active={activeGtmSection === 'market'} on:click={() => activeGtmSection = 'market'}>
									<span class="material-symbols-outlined">groups</span>
									Target Market
								</button>
								<button class="gtm-nav-tab" class:active={activeGtmSection === 'positioning'} on:click={() => activeGtmSection = 'positioning'}>
									<span class="material-symbols-outlined">stars</span>
									Positioning
								</button>
								<button class="gtm-nav-tab" class:active={activeGtmSection === 'pricing'} on:click={() => activeGtmSection = 'pricing'}>
									<span class="material-symbols-outlined">payments</span>
									Pricing
								</button>
								<button class="gtm-nav-tab" class:active={activeGtmSection === 'distribution'} on:click={() => activeGtmSection = 'distribution'}>
									<span class="material-symbols-outlined">share</span>
									Distribution
								</button>
								<button class="gtm-nav-tab" class:active={activeGtmSection === 'marketing'} on:click={() => activeGtmSection = 'marketing'}>
									<span class="material-symbols-outlined">campaign</span>
									Marketing
								</button>
								<button class="gtm-nav-tab" class:active={activeGtmSection === 'launch'} on:click={() => activeGtmSection = 'launch'}>
									<span class="material-symbols-outlined">rocket</span>
									Launch Plan
								</button>
								<button class="gtm-nav-tab" class:active={activeGtmSection === 'metrics'} on:click={() => activeGtmSection = 'metrics'}>
									<span class="material-symbols-outlined">analytics</span>
									Metrics
								</button>
								<button class="gtm-nav-tab" class:active={activeGtmSection === 'execution'} on:click={() => activeGtmSection = 'execution'}>
									<span class="material-symbols-outlined">sprint</span>
									90-Day Plan
								</button>
							</div>

							<!-- GTM Content Sections -->
							<div class="gtm-content">
								{#if activeGtmSection === 'overview'}
									<!-- Product Overview Section -->
									<div class="gtm-section-card minimal-card">
										<div class="section-header">
											<span class="material-symbols-outlined">inventory_2</span>
											<h2>Product Overview</h2>
										</div>
										<div class="overview-content">
											<div class="overview-item highlight">
												<span class="item-label">One-Line Description</span>
												<p class="item-value large">{gtmStrategy.productOverview?.oneLineDescription || productName}</p>
											</div>
											<div class="overview-grid">
												<div class="overview-item">
													<span class="item-label">Category</span>
													<p class="item-value">{gtmStrategy.productOverview?.category || 'Technology'}</p>
												</div>
												<div class="overview-item">
													<span class="item-label">Primary Problem Solved</span>
													<p class="item-value">{gtmStrategy.productOverview?.primaryProblem || 'Not specified'}</p>
												</div>
											</div>
											{#if gtmStrategy.productOverview?.whyNow}
												<div class="why-now-box">
													<h4><span class="material-symbols-outlined">schedule</span> Why Now?</h4>
													<div class="why-now-content">
														<div class="why-item">
															<span class="why-label">Market Shift</span>
															<p>{gtmStrategy.productOverview.whyNow.marketShift}</p>
														</div>
														<div class="why-item">
															<span class="why-label">Timing</span>
															<p>{gtmStrategy.productOverview.whyNow.timing}</p>
														</div>
													</div>
												</div>
											{/if}
										</div>
									</div>

									<!-- Value Proposition Section -->
									<div class="gtm-section-card minimal-card">
										<div class="section-header">
											<span class="material-symbols-outlined">diamond</span>
											<h2>Core Value Proposition</h2>
										</div>
										<div class="value-prop-content">
											<div class="value-statement-box">
												<p class="value-statement">"{gtmStrategy.valueProposition?.statement || `${productName} helps ${targetCustomer} achieve their goals.`}"</p>
											</div>
											{#if gtmStrategy.valueProposition?.keyBenefits}
												<div class="benefits-grid">
													{#each gtmStrategy.valueProposition.keyBenefits as benefit, i}
														<div class="benefit-card {benefit.type}">
															<span class="benefit-type">{benefit.type}</span>
															<p class="benefit-text">{benefit.benefit}</p>
															{#if benefit.proof}
																<span class="benefit-proof">{benefit.proof}</span>
															{/if}
														</div>
													{/each}
												</div>
											{/if}
											{#if gtmStrategy.valueProposition?.proofPoints}
												<div class="proof-points">
													<h4>Proof Points</h4>
													<ul>
														{#each gtmStrategy.valueProposition.proofPoints as proof}
															<li><span class="material-symbols-outlined">verified</span> {proof}</li>
														{/each}
													</ul>
												</div>
											{/if}
										</div>
									</div>

									<!-- Hypotheses & Decisions -->
									<div class="gtm-section-card minimal-card">
										<div class="section-header">
											<span class="material-symbols-outlined">science</span>
											<h2>Active GTM Hypotheses</h2>
											<span class="badge-limit">Test & Learn</span>
										</div>
										{#if gtmStrategy.hypotheses}
											<div class="hypotheses-grid">
												{#each gtmStrategy.hypotheses as hypothesis}
													<div class="hypothesis-card {gtmHypothesisStatuses[hypothesis.id] || hypothesis.status?.toLowerCase() || 'active'}">
														<div class="hypothesis-header">
															<span class="hypothesis-id">{hypothesis.id}</span>
															<select 
																class="status-select"
																value={gtmHypothesisStatuses[hypothesis.id] || hypothesis.status}
																on:change={(e) => updateHypothesisStatus(hypothesis.id, e.target.value)}
															>
																<option value="Active">🔬 Active</option>
																<option value="Queued">⏳ Queued</option>
																<option value="Won">✅ Won - Scale</option>
																<option value="Lost">❌ Lost - Kill</option>
															</select>
														</div>
														<p class="hypothesis-text">{hypothesis.hypothesis}</p>
														<div class="hypothesis-details">
															<div class="detail-row">
																<span class="detail-label">Channel:</span>
																<span class="detail-value">{hypothesis.channel}</span>
															</div>
															<div class="detail-row">
																<span class="detail-label">Success Signal:</span>
																<span class="detail-value signal">{hypothesis.successSignal}</span>
															</div>
															<div class="detail-row">
																<span class="detail-label">Timebox:</span>
																<span class="detail-value">{hypothesis.timebox}</span>
															</div>
															<div class="detail-row">
																<span class="detail-label">Cost:</span>
																<span class="detail-value">{hypothesis.cost}</span>
															</div>
														</div>
													</div>
												{/each}
											</div>
										{/if}
									</div>

									<!-- GTM Decisions - Trackable H1/H2/H3 -->
									{#if gtmStrategy.decisions}
										<div class="gtm-section-card minimal-card decisions-trackable">
											<div class="section-header">
												<span class="material-symbols-outlined">gavel</span>
												<h2>GTM Decisions</h2>
												<span class="badge-limit">Track & Execute</span>
											</div>
											<div class="decisions-grid-enhanced">
												<!-- H1: Double Down (AI Generated) -->
												<div class="decision-card-enhanced double-down">
													<div class="decision-header-enhanced">
														<span class="horizon-badge h1">H1</span>
														<span class="material-symbols-outlined">keyboard_double_arrow_up</span>
														<h4>Double Down</h4>
														<span class="ai-badge">AI Generated</span>
													</div>
													<p class="decision-title">{gtmStrategy.decisions.H1_doubleDown?.title || gtmStrategy.decisions.doubleDown?.what || 'Focus on your core channel'}</p>
													<p class="decision-description">{gtmStrategy.decisions.H1_doubleDown?.description || gtmStrategy.decisions.doubleDown?.evidence || ''}</p>
													
													{#if gtmStrategy.decisions.H1_doubleDown?.targetMetric}
														<div class="target-section">
															<span class="target-label">Target:</span>
															<span class="target-value">{gtmStrategy.decisions.H1_doubleDown.targetMetric}: {gtmStrategy.decisions.H1_doubleDown.targetValue}</span>
														</div>
													{/if}
													
													{#if gtmStrategy.decisions.H1_doubleDown?.weeklyMilestones}
														<div class="milestones-mini">
															{#each gtmStrategy.decisions.H1_doubleDown.weeklyMilestones.slice(0, 2) as milestone, i}
																<span class="milestone-tag">W{i+1}: {milestone}</span>
															{/each}
														</div>
													{/if}
													
													{#if !gtmTasks.some(t => t.category === 'double-down' && t.status === 'active')}
														<button class="action-btn accept" on:click={() => {
															taskToStart = {
																taskType: 'H1',
																category: 'double-down',
																...(gtmStrategy.decisions.H1_doubleDown || gtmStrategy.decisions.doubleDown)
															};
															showTaskStartModal = true;
														}}>
															<span class="material-symbols-outlined">check_circle</span>
															Accept & Track
														</button>
													{:else}
														<div class="tracking-status active">
															<span class="material-symbols-outlined">radio_button_checked</span>
															Tracking Active
														</div>
													{/if}
												</div>
												
												<!-- H2: Pause (AI Generated) -->
												<div class="decision-card-enhanced pause">
													<div class="decision-header-enhanced">
														<span class="horizon-badge h2">H2</span>
														<span class="material-symbols-outlined">pause_circle</span>
														<h4>Pause</h4>
														<span class="ai-badge">AI Generated</span>
													</div>
													<p class="decision-title">{gtmStrategy.decisions.H2_pause?.title || gtmStrategy.decisions.pause?.what || 'Deprioritize low-impact activities'}</p>
													<p class="decision-description">{gtmStrategy.decisions.H2_pause?.description || gtmStrategy.decisions.pause?.reason || ''}</p>
													
													{#if gtmStrategy.decisions.H2_pause?.opportunityCost}
														<div class="opportunity-cost">
															<span class="material-symbols-outlined">info</span>
															<span>Opportunity Cost: {gtmStrategy.decisions.H2_pause.opportunityCost}</span>
														</div>
													{/if}
													
													{#if gtmStrategy.decisions.H2_pause?.reviewDate}
														<div class="review-date">
															<span class="material-symbols-outlined">event</span>
															Review: {gtmStrategy.decisions.H2_pause.reviewDate}
														</div>
													{/if}
													
													{#if !gtmTasks.some(t => t.category === 'pause' && t.status === 'active')}
														<button class="action-btn pause" on:click={() => {
															taskToStart = {
																taskType: 'H2',
																category: 'pause',
																...(gtmStrategy.decisions.H2_pause || gtmStrategy.decisions.pause)
															};
															showTaskStartModal = true;
														}}>
															<span class="material-symbols-outlined">schedule</span>
															Accept & Set Review
														</button>
													{:else}
														<div class="tracking-status paused">
															<span class="material-symbols-outlined">pause</span>
															Paused - Review Scheduled
														</div>
													{/if}
												</div>
												
												<!-- H3: Kill (User Created) -->
												<div class="decision-card-enhanced kill">
													<div class="decision-header-enhanced">
														<span class="horizon-badge h3">H3</span>
														<span class="material-symbols-outlined">cancel</span>
														<h4>Kill</h4>
														<span class="user-badge">You Decide</span>
													</div>
													<p class="decision-instruction">What are YOU going to stop doing? Be honest about what's not working.</p>
													
													<!-- User's Kill List -->
													{#if gtmTasks.filter(t => t.category === 'kill').length > 0}
														<div class="kill-list">
															{#each gtmTasks.filter(t => t.category === 'kill') as killTask}
																<div class="kill-item">
																	<span class="material-symbols-outlined">do_not_disturb_on</span>
																	<span>{killTask.title}</span>
																</div>
															{/each}
														</div>
													{:else}
														<p class="no-kills">No items killed yet. What should you stop?</p>
													{/if}
													
													<button class="action-btn kill" on:click={() => showH3Modal = true}>
														<span class="material-symbols-outlined">add</span>
														Add to Kill List
													</button>
												</div>
											</div>
										</div>
									{/if}
									
									<!-- Active GTM Tasks -->
									{#if gtmTasks.filter(t => t.status === 'active').length > 0}
										<div class="gtm-section-card minimal-card">
											<div class="section-header">
												<span class="material-symbols-outlined">checklist</span>
												<h2>Your Active GTM Actions</h2>
												<span class="badge-count">{gtmTasks.filter(t => t.status === 'active').length} active</span>
											</div>
											<div class="active-tasks-list">
												{#each gtmTasks.filter(t => t.status === 'active') as task}
													<div class="active-task-card {task.category}">
														<div class="task-header">
															<span class="horizon-badge {task.taskType?.toLowerCase()}">{task.taskType}</span>
															<h4>{task.title}</h4>
														</div>
														<div class="task-progress">
															<div class="progress-bar">
																<div class="progress-fill" style="width: {task.progress}%"></div>
															</div>
															<span class="progress-text">{task.progress}%</span>
														</div>
														<div class="task-meta">
															<span class="days-remaining">
																<span class="material-symbols-outlined">schedule</span>
																{Math.ceil((new Date(task.deadline) - new Date()) / (1000 * 60 * 60 * 24))} days left
															</span>
															<button class="update-btn" on:click={() => {
																activeFollowup = { taskId: task.taskId, taskTitle: task.title, progress: task.progress };
																taskProgressInput = task.progress;
																showFollowupModal = true;
															}}>
																<span class="material-symbols-outlined">edit</span>
																Update Progress
															</button>
														</div>
													</div>
												{/each}
											</div>
										</div>
									{/if}

								{:else if activeGtmSection === 'market'}
									<!-- Target Market Section -->
									<div class="gtm-section-card minimal-card">
										<div class="section-header">
											<span class="material-symbols-outlined">target</span>
											<h2>Ideal Customer Profile (ICP)</h2>
										</div>
										{#if gtmStrategy.targetMarket?.icp}
											<div class="icp-grid">
												<div class="icp-item">
													<span class="icp-label">Industry</span>
													<span class="icp-value">{gtmStrategy.targetMarket.icp.industry}</span>
												</div>
												<div class="icp-item">
													<span class="icp-label">Company Size</span>
													<span class="icp-value">{gtmStrategy.targetMarket.icp.companySize}</span>
												</div>
												<div class="icp-item">
													<span class="icp-label">Geography</span>
													<span class="icp-value">{gtmStrategy.targetMarket.icp.geography}</span>
												</div>
												<div class="icp-item">
													<span class="icp-label">Decision Maker</span>
													<span class="icp-value">{gtmStrategy.targetMarket.icp.decisionMaker}</span>
												</div>
											</div>
										{/if}
									</div>

									<!-- User Personas -->
									<div class="gtm-section-card minimal-card">
										<div class="section-header">
											<span class="material-symbols-outlined">person</span>
											<h2>User Personas</h2>
										</div>
										{#if gtmStrategy.targetMarket?.personas}
											<div class="personas-grid">
												{#each gtmStrategy.targetMarket.personas as persona, i}
													<div class="persona-card">
														<div class="persona-header">
															<span class="persona-avatar">P{i + 1}</span>
															<div>
																<h4>{persona.name}</h4>
																<p class="persona-role">{persona.role}</p>
															</div>
														</div>
														<div class="persona-section">
															<span class="section-label">Pain Points</span>
															<ul>
																{#each persona.painPoints || [] as pain}
																	<li>{pain}</li>
																{/each}
															</ul>
														</div>
														<div class="persona-section">
															<span class="section-label">Buying Trigger</span>
															<p>{persona.buyingTrigger}</p>
														</div>
														{#if persona.objections}
															<div class="persona-section">
																<span class="section-label">Common Objections</span>
																<ul class="objections-list">
																	{#each persona.objections as objection}
																		<li>{objection}</li>
																	{/each}
																</ul>
															</div>
														{/if}
													</div>
												{/each}
											</div>
										{/if}
									</div>

									<!-- Early Adopters vs Mass Market -->
									<div class="gtm-section-card minimal-card">
										<div class="section-header">
											<span class="material-symbols-outlined">trending_up</span>
											<h2>Market Segmentation</h2>
										</div>
										<div class="market-segments">
											{#if gtmStrategy.targetMarket?.earlyAdopters}
												<div class="segment-card early">
													<h4><span class="material-symbols-outlined">bolt</span> Early Adopters</h4>
													<div class="segment-content">
														<p><strong>Who:</strong> {gtmStrategy.targetMarket.earlyAdopters.who}</p>
														<p><strong>Why they adopt first:</strong> {gtmStrategy.targetMarket.earlyAdopters.why}</p>
														<p><strong>Where to find them:</strong> {gtmStrategy.targetMarket.earlyAdopters.whereToFind}</p>
													</div>
												</div>
											{/if}
											{#if gtmStrategy.targetMarket?.massMarket}
												<div class="segment-card mass">
													<h4><span class="material-symbols-outlined">groups</span> Mass Market</h4>
													<div class="segment-content">
														<p><strong>Who:</strong> {gtmStrategy.targetMarket.massMarket.who}</p>
														<p><strong>Timeline:</strong> {gtmStrategy.targetMarket.massMarket.timeline}</p>
														<p><strong>Requirements:</strong> {gtmStrategy.targetMarket.massMarket.requirements}</p>
													</div>
												</div>
											{/if}
										</div>
									</div>

								{:else if activeGtmSection === 'positioning'}
									<!-- Positioning Section -->
									<div class="gtm-section-card minimal-card">
										<div class="section-header">
											<span class="material-symbols-outlined">stars</span>
											<h2>Product Positioning</h2>
										</div>
										<div class="positioning-content">
											<div class="positioning-statement-box">
												<span class="label">Positioning Statement</span>
												<p class="statement">"{gtmStrategy.positioning?.positioningStatement || 'Not defined'}"</p>
											</div>
											<div class="category-position">
												<span class="label">Category Position</span>
												<span class="position-badge">{gtmStrategy.positioning?.categoryPosition || 'Alternative'}</span>
											</div>
										</div>
									</div>

									<!-- Differentiation Axes -->
									{#if gtmStrategy.positioning?.differentiationAxes}
										<div class="gtm-section-card minimal-card">
											<div class="section-header">
												<span class="material-symbols-outlined">compare</span>
												<h2>Differentiation Axes</h2>
											</div>
											<div class="diff-axes-grid">
												{#each gtmStrategy.positioning.differentiationAxes as axis}
													<div class="diff-axis-card">
														<h4>{axis.axis}</h4>
														<p class="axis-position">{axis.position}</p>
														<p class="axis-vs">vs Competitors: {axis.vsCompetitors}</p>
													</div>
												{/each}
											</div>
										</div>
									{/if}

									<!-- Competitive Response -->
									{#if gtmStrategy.positioning?.competitiveResponse}
										<div class="gtm-section-card minimal-card">
											<div class="section-header">
												<span class="material-symbols-outlined">sports_martial_arts</span>
												<h2>Competitive Response</h2>
											</div>
											<div class="competitive-response">
												<p class="vs-main">{gtmStrategy.positioning.competitiveResponse.vsMainCompetitor}</p>
												<div class="talking-points">
													<h4>Key Talking Points</h4>
													<ul>
														{#each gtmStrategy.positioning.competitiveResponse.keyTalkingPoints || [] as point}
															<li>{point}</li>
														{/each}
													</ul>
												</div>
											</div>
										</div>
									{/if}

								{:else if activeGtmSection === 'pricing'}
									<!-- Pricing Section -->
									<div class="gtm-section-card minimal-card">
										<div class="section-header">
											<span class="material-symbols-outlined">payments</span>
											<h2>Pricing Strategy</h2>
										</div>
										<div class="pricing-model-badge">
											<span class="model-label">Pricing Model:</span>
											<span class="model-value">{gtmStrategy.pricing?.model || 'Subscription'}</span>
										</div>
										{#if gtmStrategy.pricing?.tiers}
											<div class="pricing-tiers">
												{#each gtmStrategy.pricing.tiers as tier, i}
													<div class="pricing-tier" class:recommended={i === 1}>
														{#if i === 1}<span class="recommended-badge">Recommended</span>{/if}
														<h4>{tier.name}</h4>
														<p class="tier-price">{tier.price}</p>
														<p class="tier-target">{tier.targetUser}</p>
														<ul class="tier-features">
															{#each tier.features || [] as feature}
																<li><span class="material-symbols-outlined">check</span> {feature}</li>
															{/each}
														</ul>
													</div>
												{/each}
											</div>
										{/if}
									</div>

									<!-- Pricing Logic -->
									{#if gtmStrategy.pricing?.pricingLogic}
										<div class="gtm-section-card minimal-card">
											<div class="section-header">
												<span class="material-symbols-outlined">psychology</span>
												<h2>Pricing Logic</h2>
											</div>
											<div class="pricing-logic-content">
												<div class="logic-item">
													<span class="logic-label">Approach</span>
													<p>{gtmStrategy.pricing.pricingLogic.approach}</p>
												</div>
												<div class="logic-item">
													<span class="logic-label">Rationale</span>
													<p>{gtmStrategy.pricing.pricingLogic.rationale}</p>
												</div>
												<div class="logic-item">
													<span class="logic-label">Expansion Path</span>
													<p>{gtmStrategy.pricing.pricingLogic.expansionPath}</p>
												</div>
											</div>
										</div>
									{/if}

								{:else if activeGtmSection === 'distribution'}
									<!-- Distribution Channels -->
									<div class="gtm-section-card minimal-card">
										<div class="section-header">
											<span class="material-symbols-outlined">share</span>
											<h2>Distribution Channels</h2>
										</div>
										{#if gtmStrategy.distribution?.primaryChannels}
											<div class="channels-list">
												{#each gtmStrategy.distribution.primaryChannels as channel}
													<div class="channel-card">
														<div class="channel-priority">#{channel.priority}</div>
														<div class="channel-content">
															<h4>{channel.channel}</h4>
															<p class="channel-rationale">{channel.rationale}</p>
															<span class="channel-cac">Expected CAC: {channel.expectedCac}</span>
														</div>
													</div>
												{/each}
											</div>
										{/if}
									</div>

									<!-- Sales Motion -->
									{#if gtmStrategy.distribution?.salesMotion}
										<div class="gtm-section-card minimal-card">
											<div class="section-header">
												<span class="material-symbols-outlined">handshake</span>
												<h2>Sales Motion</h2>
											</div>
											<div class="sales-motion-content">
												<div class="motion-type">
													<span class="type-badge">{gtmStrategy.distribution.salesMotion.type}</span>
												</div>
												<p class="motion-rationale">{gtmStrategy.distribution.salesMotion.rationale}</p>
												<div class="transition-plan">
													<span class="label">Transition Plan:</span>
													<p>{gtmStrategy.distribution.salesMotion.transitionPlan}</p>
												</div>
											</div>
										</div>
									{/if}

									<!-- Channel Ownership -->
									{#if gtmStrategy.distribution?.channelOwnership}
										<div class="gtm-section-card minimal-card">
											<div class="section-header">
												<span class="material-symbols-outlined">assignment_ind</span>
												<h2>Channel Ownership</h2>
											</div>
											<div class="ownership-grid">
												<div class="ownership-item">
													<span class="ownership-label">Lead Generation</span>
													<span class="ownership-value">{gtmStrategy.distribution.channelOwnership.leadGeneration}</span>
												</div>
												<div class="ownership-item">
													<span class="ownership-label">Qualification</span>
													<span class="ownership-value">{gtmStrategy.distribution.channelOwnership.qualification}</span>
												</div>
												<div class="ownership-item">
													<span class="ownership-label">Closing</span>
													<span class="ownership-value">{gtmStrategy.distribution.channelOwnership.closing}</span>
												</div>
												<div class="ownership-item">
													<span class="ownership-label">Onboarding</span>
													<span class="ownership-value">{gtmStrategy.distribution.channelOwnership.onboarding}</span>
												</div>
											</div>
										</div>
									{/if}

								{:else if activeGtmSection === 'marketing'}
									<!-- Demand Generation -->
									{#if gtmStrategy.marketing?.demandGeneration}
										<div class="gtm-section-card minimal-card">
											<div class="section-header">
												<span class="material-symbols-outlined">campaign</span>
												<h2>Demand Generation</h2>
											</div>
											<div class="demand-gen-grid">
												<div class="demand-category">
													<h4><span class="material-symbols-outlined">article</span> Content</h4>
													<ul>
														{#each gtmStrategy.marketing.demandGeneration.content || [] as item}
															<li>{item}</li>
														{/each}
													</ul>
												</div>
												<div class="demand-category">
													<h4><span class="material-symbols-outlined">ads_click</span> Paid Ads</h4>
													<ul>
														{#each gtmStrategy.marketing.demandGeneration.paidAds || [] as item}
															<li>{item}</li>
														{/each}
													</ul>
												</div>
												<div class="demand-category">
													<h4><span class="material-symbols-outlined">forum</span> Community</h4>
													<ul>
														{#each gtmStrategy.marketing.demandGeneration.community || [] as item}
															<li>{item}</li>
														{/each}
													</ul>
												</div>
												<div class="demand-category">
													<h4><span class="material-symbols-outlined">event</span> Events</h4>
													<ul>
														{#each gtmStrategy.marketing.demandGeneration.events || [] as item}
															<li>{item}</li>
														{/each}
													</ul>
												</div>
											</div>
										</div>
									{/if}

									<!-- Brand Messaging -->
									{#if gtmStrategy.marketing?.brandMessaging}
										<div class="gtm-section-card minimal-card">
											<div class="section-header">
												<span class="material-symbols-outlined">chat</span>
												<h2>Brand & Messaging</h2>
											</div>
											<div class="brand-messaging-content">
												<div class="core-narrative">
													<span class="label">Core Narrative</span>
													<p>"{gtmStrategy.marketing.brandMessaging.coreNarrative}"</p>
												</div>
												{#if gtmStrategy.marketing.brandMessaging.channelMessages}
													<div class="channel-messages">
														<h4>Channel-Specific Messages</h4>
														{#each gtmStrategy.marketing.brandMessaging.channelMessages as cm}
															<div class="channel-message">
																<span class="channel-name">{cm.channel}</span>
																<p>{cm.message}</p>
															</div>
														{/each}
													</div>
												{/if}
											</div>
										</div>
									{/if}

									<!-- Objection Handling -->
									{#if gtmStrategy.marketing?.brandMessaging?.objectionHandling}
										<div class="gtm-section-card minimal-card">
											<div class="section-header">
												<span class="material-symbols-outlined">support_agent</span>
												<h2>Objection Handling</h2>
											</div>
											<div class="objections-grid">
												{#each gtmStrategy.marketing.brandMessaging.objectionHandling as obj}
													<div class="objection-card">
														<div class="objection-text">
															<span class="material-symbols-outlined">help</span>
															"{obj.objection}"
														</div>
														<div class="response-text">
															<span class="material-symbols-outlined">lightbulb</span>
															{obj.response}
														</div>
													</div>
												{/each}
											</div>
										</div>
									{/if}

									<!-- Growth Loops -->
									{#if gtmStrategy.marketing?.growthLoops}
										<div class="gtm-section-card minimal-card">
											<div class="section-header">
												<span class="material-symbols-outlined">autorenew</span>
												<h2>Growth Loops</h2>
											</div>
											<div class="growth-loops-grid">
												{#each gtmStrategy.marketing.growthLoops as loop}
													<div class="growth-loop-card">
														<h4>{loop.type}</h4>
														<p class="loop-mechanism">{loop.mechanism}</p>
														{#if loop.incentive}
															<p class="loop-detail"><strong>Incentive:</strong> {loop.incentive}</p>
														{/if}
														{#if loop.kFactor}
															<p class="loop-detail"><strong>K-Factor:</strong> {loop.kFactor}</p>
														{/if}
													</div>
												{/each}
											</div>
										</div>
									{/if}

								{:else if activeGtmSection === 'launch'}
									<!-- Launch Plan -->
									{#if gtmStrategy.launchPlan}
										<div class="gtm-section-card minimal-card">
											<div class="section-header">
												<span class="material-symbols-outlined">rocket</span>
												<h2>Launch Plan</h2>
											</div>
											<div class="launch-phases">
												<!-- Pre-Launch -->
												{#if gtmStrategy.launchPlan.preLaunch}
													<div class="launch-phase pre">
														<div class="phase-header">
															<span class="phase-icon">🎯</span>
															<h4>Pre-Launch</h4>
															<span class="phase-timeline">{gtmStrategy.launchPlan.preLaunch.timeline}</span>
														</div>
														<div class="phase-activities">
															{#each gtmStrategy.launchPlan.preLaunch.activities || [] as activity}
																<div class="activity-item">
																	<span class="activity-name">{activity.activity}</span>
																	<span class="activity-goal">{activity.goal}</span>
																	<span class="activity-timeline">{activity.timeline}</span>
																</div>
															{/each}
														</div>
													</div>
												{/if}

												<!-- Launch -->
												{#if gtmStrategy.launchPlan.launch}
													<div class="launch-phase active">
														<div class="phase-header">
															<span class="phase-icon">🚀</span>
															<h4>Launch Day</h4>
														</div>
														<div class="launch-details">
															<div class="launch-section">
																<span class="label">Day-1 Channels</span>
																<div class="tag-list">
																	{#each gtmStrategy.launchPlan.launch.day1Channels || [] as channel}
																		<span class="tag">{channel}</span>
																	{/each}
																</div>
															</div>
															<div class="launch-section">
																<span class="label">PR & Announcements</span>
																<ul>
																	{#each gtmStrategy.launchPlan.launch.prAnnouncements || [] as pr}
																		<li>{pr}</li>
																	{/each}
																</ul>
															</div>
															<div class="launch-section">
																<span class="label">Promotions</span>
																<ul>
																	{#each gtmStrategy.launchPlan.launch.promotions || [] as promo}
																		<li>{promo}</li>
																	{/each}
																</ul>
															</div>
														</div>
													</div>
												{/if}

												<!-- Post-Launch -->
												{#if gtmStrategy.launchPlan.postLaunch}
													<div class="launch-phase post">
														<div class="phase-header">
															<span class="phase-icon">📈</span>
															<h4>Post-Launch</h4>
														</div>
														<div class="post-launch-details">
															<p><strong>Iteration Cycles:</strong> {gtmStrategy.launchPlan.postLaunch.iterationCycles}</p>
															<div class="launch-section">
																<span class="label">Feature Rollouts</span>
																<ul>
																	{#each gtmStrategy.launchPlan.postLaunch.featureRollouts || [] as feature}
																		<li>{feature}</li>
																	{/each}
																</ul>
															</div>
															<div class="launch-section">
																<span class="label">Expansion Plan</span>
																<ul>
																	{#each gtmStrategy.launchPlan.postLaunch.expansionPlan || [] as expansion}
																		<li>{expansion}</li>
																	{/each}
																</ul>
															</div>
														</div>
													</div>
												{/if}
											</div>
										</div>
									{/if}

									<!-- Customer Success -->
									{#if gtmStrategy.customerSuccess}
										<div class="gtm-section-card minimal-card">
											<div class="section-header">
												<span class="material-symbols-outlined">emoji_events</span>
												<h2>Customer Onboarding & Success</h2>
											</div>
											<div class="customer-success-content">
												{#if gtmStrategy.customerSuccess.firstValueMoment}
													<div class="first-value-box">
														<h4>First Value Moment</h4>
														<p>{gtmStrategy.customerSuccess.firstValueMoment.definition}</p>
														<div class="fvm-metrics">
															<span><strong>Metric:</strong> {gtmStrategy.customerSuccess.firstValueMoment.metric}</span>
															<span><strong>Target:</strong> {gtmStrategy.customerSuccess.firstValueMoment.timeline}</span>
														</div>
													</div>
												{/if}
												{#if gtmStrategy.customerSuccess.onboarding}
													<div class="onboarding-section">
														<h4>Onboarding</h4>
														<p><strong>Support Level:</strong> {gtmStrategy.customerSuccess.onboarding.supportLevel}</p>
														<div class="onboarding-tools">
															<span class="label">Tools:</span>
															<div class="tag-list">
																{#each gtmStrategy.customerSuccess.onboarding.tools || [] as tool}
																	<span class="tag">{tool}</span>
																{/each}
															</div>
														</div>
														<div class="milestones">
															<span class="label">Milestones:</span>
															<ol>
																{#each gtmStrategy.customerSuccess.onboarding.milestones || [] as milestone}
																	<li>{milestone}</li>
																{/each}
															</ol>
														</div>
													</div>
												{/if}
											</div>
										</div>
									{/if}

								{:else if activeGtmSection === 'metrics'}
									<!-- North Star Metric -->
									{#if gtmStrategy.metrics?.northStar}
										<div class="gtm-section-card minimal-card north-star-card">
											<div class="section-header">
												<span class="material-symbols-outlined">star</span>
												<h2>North Star Metric</h2>
											</div>
											<div class="north-star-content">
												<div class="north-star-metric">
													<span class="ns-label">THE ONE METRIC</span>
													<h3>{gtmStrategy.metrics.northStar.metric}</h3>
												</div>
												<div class="ns-details">
													<div class="ns-item">
														<span class="label">Target</span>
														<p>{gtmStrategy.metrics.northStar.target}</p>
													</div>
													<div class="ns-item">
														<span class="label">Rationale</span>
														<p>{gtmStrategy.metrics.northStar.rationale}</p>
													</div>
												</div>
											</div>
										</div>
									{/if}

									<!-- Metrics Grid -->
									<div class="metrics-categories-grid">
										{#if gtmStrategy.metrics?.acquisition}
											<div class="gtm-section-card minimal-card">
												<div class="section-header small">
													<span class="material-symbols-outlined">person_add</span>
													<h3>Acquisition</h3>
												</div>
												<div class="metrics-list">
													<div class="metric-row">
														<span class="metric-name">CAC</span>
														<span class="metric-current">{gtmStrategy.metrics.acquisition.cac?.current || 'TBD'}</span>
														<span class="metric-target">→ {gtmStrategy.metrics.acquisition.cac?.target || 'TBD'}</span>
													</div>
													<div class="metric-row">
														<span class="metric-name">Conversion Rate</span>
														<span class="metric-current">{gtmStrategy.metrics.acquisition.conversionRate?.current || 'TBD'}</span>
														<span class="metric-target">→ {gtmStrategy.metrics.acquisition.conversionRate?.target || 'TBD'}</span>
													</div>
													<div class="metric-row">
														<span class="metric-name">CPL</span>
														<span class="metric-current">{gtmStrategy.metrics.acquisition.cpl?.current || 'TBD'}</span>
														<span class="metric-target">→ {gtmStrategy.metrics.acquisition.cpl?.target || 'TBD'}</span>
													</div>
												</div>
											</div>
										{/if}

										{#if gtmStrategy.metrics?.activation}
											<div class="gtm-section-card minimal-card">
												<div class="section-header small">
													<span class="material-symbols-outlined">bolt</span>
													<h3>Activation</h3>
												</div>
												<div class="metrics-list">
													<div class="metric-row">
														<span class="metric-name">Time to First Value</span>
														<span class="metric-current">{gtmStrategy.metrics.activation.timeToFirstValue?.current || 'TBD'}</span>
														<span class="metric-target">→ {gtmStrategy.metrics.activation.timeToFirstValue?.target || 'TBD'}</span>
													</div>
													<div class="metric-row">
														<span class="metric-name">Activation Rate</span>
														<span class="metric-current">{gtmStrategy.metrics.activation.activationRate?.current || 'TBD'}</span>
														<span class="metric-target">→ {gtmStrategy.metrics.activation.activationRate?.target || 'TBD'}</span>
													</div>
												</div>
											</div>
										{/if}

										{#if gtmStrategy.metrics?.revenue}
											<div class="gtm-section-card minimal-card">
												<div class="section-header small">
													<span class="material-symbols-outlined">currency_rupee</span>
													<h3>Revenue</h3>
												</div>
												<div class="metrics-list">
													<div class="metric-row">
														<span class="metric-name">ARPU</span>
														<span class="metric-current">{gtmStrategy.metrics.revenue.arpu?.current || 'TBD'}</span>
														<span class="metric-target">→ {gtmStrategy.metrics.revenue.arpu?.target || 'TBD'}</span>
													</div>
													<div class="metric-row">
														<span class="metric-name">LTV</span>
														<span class="metric-current">{gtmStrategy.metrics.revenue.ltv?.current || 'TBD'}</span>
														<span class="metric-target">→ {gtmStrategy.metrics.revenue.ltv?.target || 'TBD'}</span>
													</div>
													<div class="metric-row">
														<span class="metric-name">Churn</span>
														<span class="metric-current">{gtmStrategy.metrics.revenue.churn?.current || 'TBD'}</span>
														<span class="metric-target">→ {gtmStrategy.metrics.revenue.churn?.target || 'TBD'}</span>
													</div>
												</div>
											</div>
										{/if}
									</div>

									<!-- Risks -->
									{#if gtmStrategy.risks}
										<div class="gtm-section-card minimal-card">
											<div class="section-header">
												<span class="material-symbols-outlined">warning</span>
												<h2>Risks & Mitigation</h2>
											</div>
											<div class="risks-table">
												<div class="risk-header-row">
													<span>Risk</span>
													<span>Impact</span>
													<span>Mitigation</span>
												</div>
												{#each gtmStrategy.risks as risk}
													<div class="risk-row">
														<span class="risk-name">{risk.risk}</span>
														<span class="risk-impact {risk.impact?.toLowerCase()}">{risk.impact}</span>
														<span class="risk-mitigation">{risk.mitigation}</span>
													</div>
												{/each}
											</div>
										</div>
									{/if}

								{:else if activeGtmSection === 'execution'}
									<!-- 90-Day Execution Plan -->
									{#if gtmStrategy.executionPlan}
										<div class="gtm-section-card minimal-card">
											<div class="section-header">
												<span class="material-symbols-outlined">sprint</span>
												<h2>90-Day Execution Plan</h2>
											</div>
											<div class="execution-timeline">
												{#each ['month1', 'month2', 'month3'] as month, i}
													{#if gtmStrategy.executionPlan[month]}
														<div class="month-card">
															<div class="month-header">
																<span class="month-number">Month {i + 1}</span>
																<span class="month-theme">{gtmStrategy.executionPlan[month].theme}</span>
															</div>
															<div class="month-objectives">
																<h5>Objectives</h5>
																<ul>
																	{#each gtmStrategy.executionPlan[month].objectives || [] as obj}
																		<li>{obj}</li>
																	{/each}
																</ul>
															</div>
															<div class="month-actions">
																<h5>Key Actions</h5>
																<div class="actions-table">
																	{#each gtmStrategy.executionPlan[month].keyActions || [] as action}
																		<div class="action-row">
																			<span class="action-text">{action.action}</span>
																			<span class="action-owner">{action.owner}</span>
																			<span class="action-timeline">{action.timeline}</span>
																		</div>
																	{/each}
																</div>
															</div>
															<div class="month-metrics">
																<h5>Success Metrics</h5>
																<div class="success-tags">
																	{#each gtmStrategy.executionPlan[month].successMetrics || [] as metric}
																		<span class="success-tag">{metric}</span>
																	{/each}
																</div>
															</div>
														</div>
													{/if}
												{/each}
											</div>
										</div>
									{/if}

									<!-- VC-Grade Slides -->
									{#if gtmStrategy.vcSlides}
										<div class="gtm-section-card minimal-card">
											<div class="section-header">
												<span class="material-symbols-outlined">slideshow</span>
												<h2>VC-Grade GTM Slides</h2>
												<span class="badge-limit">3 Slides Only</span>
											</div>
											<div class="vc-slides-grid">
												{#each ['slide1', 'slide2', 'slide3'] as slideKey, i}
													{#if gtmStrategy.vcSlides[slideKey]}
														<div class="vc-slide">
															<div class="slide-number">{String(i + 1).padStart(2, '0')}</div>
															<h4>{gtmStrategy.vcSlides[slideKey].title}</h4>
															<ul>
																{#each gtmStrategy.vcSlides[slideKey].points || [] as point}
																	<li>{point}</li>
																{/each}
															</ul>
														</div>
													{/if}
												{/each}
											</div>
										</div>
									{/if}
								{/if}
							</div>
						{:else}
							<!-- Empty State - No Strategy Generated Yet -->
							<div class="gtm-empty-state minimal-card">
								<div class="empty-icon">
									<span class="material-symbols-outlined">auto_awesome</span>
								</div>
								<h3>Generate Your GTM Strategy</h3>
								<p>Click the button above to generate a comprehensive, investor-grade Go-To-Market strategy tailored to your product and market.</p>
								<ul class="gtm-features">
									<li><span class="material-symbols-outlined">check_circle</span> Target market & personas</li>
									<li><span class="material-symbols-outlined">check_circle</span> Pricing & positioning</li>
									<li><span class="material-symbols-outlined">check_circle</span> Distribution channels</li>
									<li><span class="material-symbols-outlined">check_circle</span> Marketing strategy</li>
									<li><span class="material-symbols-outlined">check_circle</span> 90-day execution plan</li>
									<li><span class="material-symbols-outlined">check_circle</span> VC-ready slides</li>
									</ul>
							</div>
						{/if}
					</div>
				{:else}
					<div class="minimal-card">
						<div class="empty-state">
							<span class="material-symbols-outlined icon-empty">rocket_launch</span>
							<h3>GTM Strategy Ready</h3>
							<p>Complete the assessment to generate your personalized GTM strategy</p>
							<button class="btn-primary" on:click={startDDQ}>
								<span class="material-symbols-outlined">play_arrow</span>
								Start Assessment
							</button>
						</div>
					</div>
				{/if}

			{:else if activeTab === 'advisor'}
				<!-- Strategic Advisor Tab - Clean Card Design -->
				<div class="advisor-page">
					<!-- Main Chat Card -->
					<div class="advisor-card">
						<!-- Chat Messages Area -->
						<div class="advisor-chat-container" bind:this={advisorContainer}>
							{#if advisorMessages.length === 0}
								<div class="advisor-empty-state">
									<div class="empty-icon">
										<span class="material-symbols-outlined">forum</span>
									</div>
									<h2>Strategic Advisor</h2>
									<p>Your AI-powered strategy partner. Ask any question or choose from suggestions below.</p>
									</div>
							{:else}
								{#each advisorMessages as message, index}
									<div class="chat-bubble {message.role}">
										{#if message.role === 'user'}
											<div class="bubble-content user-bubble">
												<p class="bubble-text">{message.content}</p>
											</div>
										{:else}
											<div class="bubble-content assistant-bubble">
												<div class="bubble-header">
														<span class="advisor-label">Strategy Advisor</span>
													{#if message.saved}
														<span class="saved-tag">
															<span class="material-symbols-outlined">check</span>
															Saved to Notes
														</span>
													{/if}
													</div>
												<div class="bubble-text">
													{@html message.content.replace(/\n/g, '<br>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\*(.*?)\*/g, '<em>$1</em>')}
												</div>
											</div>
										{/if}
									</div>
								{/each}
									{#if advisorLoading}
									<div class="chat-bubble assistant">
										<div class="bubble-content assistant-bubble">
											<div class="typing-dots">
												<span></span>
												<span></span>
												<span></span>
											</div>
										</div>
									</div>
								{/if}
							{/if}
						</div>
					</div>

					<!-- Quick Action Buttons -->
					<div class="advisor-quick-actions">
						{#each getAdvisorQuestions() as q}
							<button 
								class="quick-action-btn"
								on:click={() => sendAdvisorMessage(q.question)}
								disabled={advisorLoading}
							>
						{q.question}
							</button>
						{/each}
					</div>

					<!-- Input Bar -->
					<div class="advisor-input-bar">
						<input
							type="text"
							class="advisor-input"
							placeholder="Ask your strategy question..."
							bind:value={advisorInput}
							on:keydown={(e) => e.key === 'Enter' && sendAdvisorMessage()}
							disabled={advisorLoading}
						/>
						<button 
							class="advisor-send-btn"
							on:click={() => sendAdvisorMessage()}
							disabled={advisorLoading || !advisorInput.trim()}
						>
							{#if advisorLoading}
								<span class="material-symbols-outlined rotating">sync</span>
							{:else}
								<span class="material-symbols-outlined">arrow_upward</span>
							{/if}
						</button>
					</div>
					
					<p class="advisor-footer-note">
						<span class="material-symbols-outlined">bookmark</span>
						All responses are auto-saved to Notes under "Strategy Advisor" category
					</p>
				</div>

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

	<!-- GTM Task Start Modal -->
	{#if showTaskStartModal && taskToStart}
		<!-- svelte-ignore a11y-click-events-have-key-events -->
		<!-- svelte-ignore a11y-no-static-element-interactions -->
		<div class="modal-overlay" on:click={() => showTaskStartModal = false}>
			<!-- svelte-ignore a11y-click-events-have-key-events -->
			<!-- svelte-ignore a11y-no-static-element-interactions -->
			<div class="modal-content gtm-task-modal" on:click|stopPropagation>
				<div class="modal-header">
					<h3>
						<span class="material-symbols-outlined">rocket_launch</span>
						Start Tracking: {taskToStart.taskType}
					</h3>
					<button class="btn-icon" on:click={() => showTaskStartModal = false}>
						<span class="material-symbols-outlined">close</span>
					</button>
				</div>
				<div class="modal-body">
					<div class="task-preview">
						<h4>{taskToStart.title || taskToStart.what}</h4>
						<p>{taskToStart.description || taskToStart.evidence || ''}</p>
						
						{#if taskToStart.targetMetric}
							<div class="target-preview">
								<span class="label">Target:</span>
								<span class="value">{taskToStart.targetMetric}: {taskToStart.targetValue}</span>
							</div>
						{/if}
						
						{#if taskToStart.weeklyMilestones}
							<div class="milestones-preview">
								<span class="label">Weekly Milestones:</span>
								<ul>
									{#each taskToStart.weeklyMilestones as milestone, i}
										<li>Week {i+1}: {milestone}</li>
									{/each}
								</ul>
							</div>
						{/if}
					</div>
					
					<div class="commitment-section">
						<h4>Your AI Co-founder will:</h4>
						<ul class="commitment-list">
							<li><span class="material-symbols-outlined">check_circle</span> Check in with you daily on progress</li>
							<li><span class="material-symbols-outlined">check_circle</span> Suggest next steps based on your updates</li>
							<li><span class="material-symbols-outlined">check_circle</span> Help you troubleshoot blockers</li>
							<li><span class="material-symbols-outlined">check_circle</span> Celebrate wins with you</li>
						</ul>
					</div>
					
					<div class="modal-actions">
						<button class="btn-secondary" on:click={() => showTaskStartModal = false}>
							Not Now
						</button>
						<button class="btn-primary" on:click={() => startGTMTask(taskToStart.taskType, taskToStart.category, taskToStart)}>
							<span class="material-symbols-outlined">check</span>
							Accept & Start Tracking
						</button>
					</div>
				</div>
			</div>
		</div>
	{/if}
	
	<!-- GTM Follow-up / Progress Update Modal -->
	{#if showFollowupModal && activeFollowup}
		<!-- svelte-ignore a11y-click-events-have-key-events -->
		<!-- svelte-ignore a11y-no-static-element-interactions -->
		<div class="modal-overlay" on:click={() => showFollowupModal = false}>
			<!-- svelte-ignore a11y-click-events-have-key-events -->
			<!-- svelte-ignore a11y-no-static-element-interactions -->
			<div class="modal-content gtm-followup-modal" on:click|stopPropagation>
				<div class="modal-header">
					<h3>
						<span class="material-symbols-outlined">psychology</span>
						AI Co-founder Check-in
					</h3>
					<button class="btn-icon" on:click={() => showFollowupModal = false}>
						<span class="material-symbols-outlined">close</span>
					</button>
				</div>
				<div class="modal-body">
					<div class="followup-task-info">
						<span class="task-name">{activeFollowup.taskTitle}</span>
						{#if activeFollowup.message}
							<div class="ai-message">
								<span class="ai-avatar">🤖</span>
								<p>{activeFollowup.message}</p>
							</div>
						{/if}
					</div>
					
					<div class="progress-update-section">
						<label>How's it going? Update your progress:</label>
						<div class="progress-slider">
							<input type="range" min="0" max="100" step="5" bind:value={taskProgressInput} />
							<span class="progress-value">{taskProgressInput}%</span>
						</div>
						
						<label>Quick update (optional):</label>
						<textarea 
							bind:value={taskNoteInput}
							placeholder="What did you accomplish? Any blockers? What's next?"
							rows="3"
						></textarea>
					</div>
					
					<div class="modal-actions">
						<button class="btn-secondary" on:click={() => showFollowupModal = false}>
							Later
						</button>
						<button class="btn-primary" on:click={() => updateTaskProgress(activeFollowup.taskId, taskProgressInput, taskNoteInput)}>
							<span class="material-symbols-outlined">send</span>
							Update & Get AI Feedback
						</button>
					</div>
				</div>
			</div>
		</div>
	{/if}
	
	<!-- H3 Kill Modal (User Created) -->
	{#if showH3Modal}
		<!-- svelte-ignore a11y-click-events-have-key-events -->
		<!-- svelte-ignore a11y-no-static-element-interactions -->
		<div class="modal-overlay" on:click={() => showH3Modal = false}>
			<!-- svelte-ignore a11y-click-events-have-key-events -->
			<!-- svelte-ignore a11y-no-static-element-interactions -->
			<div class="modal-content h3-modal" on:click|stopPropagation>
				<div class="modal-header">
					<h3>
						<span class="material-symbols-outlined">cancel</span>
						Add to Kill List (H3)
					</h3>
					<button class="btn-icon" on:click={() => showH3Modal = false}>
						<span class="material-symbols-outlined">close</span>
					</button>
				</div>
				<div class="modal-body">
					<p class="h3-intro">
						Killing things that don't work is just as important as doubling down on what does. 
						Be honest with yourself - what should you stop doing?
					</p>
					
					<div class="form-group">
						<label>What are you killing?</label>
						<input 
							type="text" 
							bind:value={h3Input.title}
							placeholder="e.g., Instagram marketing, Feature X, Partnership with Y"
						/>
					</div>
					
					<div class="form-group">
						<label>Why are you killing it?</label>
						<textarea 
							bind:value={h3Input.reason}
							placeholder="What's not working? What evidence do you have?"
							rows="2"
						></textarea>
					</div>
					
					<div class="form-group">
						<label>Can you restart later? (Reversibility)</label>
						<select bind:value={h3Input.reversibility}>
							<option value="yes">Yes - Can restart anytime</option>
							<option value="maybe">Maybe - Would need effort to restart</option>
							<option value="no">No - Burning this bridge</option>
						</select>
					</div>
					
					<div class="modal-actions">
						<button class="btn-secondary" on:click={() => showH3Modal = false}>
							Cancel
						</button>
						<button class="btn-danger" on:click={addH3Task} disabled={!h3Input.title}>
							<span class="material-symbols-outlined">delete_forever</span>
							Kill It
						</button>
					</div>
				</div>
			</div>
		</div>
	{/if}

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
								{#if message.role === 'assistant'}
									<div class="chat-message-text">{@html parseMarkdownToHtml(message.content)}</div>
								{:else}
									<div class="chat-message-text">{message.content}</div>
								{/if}
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
		grid-template-columns: 160px 1fr;
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

	.infinity-loading {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		padding: 2rem 1rem;
		color: var(--text-secondary);
		font-size: 0.85rem;
	}

	.infinity-loading .material-symbols-outlined {
		font-size: 1.25rem;
		color: #3b82f6;
	}

	.infinity-not-connected {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		padding: 2rem 1rem;
		text-align: center;
	}

	.infinity-not-connected .material-symbols-outlined {
		font-size: 2.5rem;
		color: var(--text-secondary);
		opacity: 0.5;
	}

	.infinity-not-connected p {
		margin: 0;
		font-size: 0.9rem;
		color: var(--text-secondary);
		font-weight: 500;
	}

	.infinity-not-connected .infinity-hint {
		font-size: 0.75rem;
		color: var(--text-secondary);
		opacity: 0.7;
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

	/* Add Action Button in Header */
	.add-action-btn {
		width: 22px;
		height: 22px;
		border-radius: 50%;
		border: none;
		background: linear-gradient(135deg, #10b981, #059669);
		color: white;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: all 0.2s ease;
		box-shadow: 0 2px 4px rgba(16, 185, 129, 0.3);
	}

	.add-action-btn:hover {
		transform: scale(1.1);
		box-shadow: 0 4px 8px rgba(16, 185, 129, 0.4);
	}

	.add-action-btn .material-symbols-outlined {
		font-size: 14px;
		font-weight: 600;
	}

	/* Add Action Form */
	.add-action-form {
		display: flex;
		gap: 0.5rem;
		margin-bottom: 0.75rem;
		padding: 0.5rem;
		background: var(--bg-tertiary);
		border-radius: 8px;
		border: 1px solid var(--border-color);
	}

	.add-action-form input {
		flex: 1;
		padding: 0.5rem 0.75rem;
		border: 1px solid var(--border-color);
		border-radius: 6px;
		background: var(--bg-secondary);
		color: var(--text-primary);
		font-size: 0.8rem;
	}

	.add-action-form input:focus {
		outline: none;
		border-color: #10b981;
		box-shadow: 0 0 0 2px rgba(16, 185, 129, 0.2);
	}

	.add-action-form input::placeholder {
		color: var(--text-tertiary);
	}

	.add-action-submit {
		padding: 0.5rem;
		border: none;
		border-radius: 6px;
		background: linear-gradient(135deg, #10b981, #059669);
		color: white;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: all 0.2s ease;
	}

	.add-action-submit:hover:not(:disabled) {
		transform: scale(1.05);
		box-shadow: 0 2px 8px rgba(16, 185, 129, 0.4);
	}

	.add-action-submit:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.add-action-submit .material-symbols-outlined {
		font-size: 18px;
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
		overflow: visible;
		max-height: none;
	}

	.actions-list {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		width: 100%;
		max-height: 400px;
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
		gap: 0.35rem;
		flex-shrink: 0;
		align-items: center;
	}

	.rag-buttons.small .rag-btn {
		width: 12px;
		height: 12px;
	}

	.rag-btn {
		width: 16px;
		height: 16px;
		border-radius: 50%;
		border: 2px solid transparent;
		cursor: pointer;
		transition: all 0.2s ease;
		opacity: 0.5;
		flex-shrink: 0;
	}

	.rag-btn:hover {
		opacity: 0.85;
		transform: scale(1.15);
	}

	.rag-btn.active {
		opacity: 1;
		border-color: currentColor;
		box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.4);
		transform: scale(1.1);
	}

	.rag-btn.red {
		background: #ef4444;
		color: #ef4444;
	}

	.rag-btn.amber {
		background: #fbbf24;
		color: #fbbf24;
	}

	.rag-btn.green {
		background: #10b981;
		color: #10b981;
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
		width: 12px;
		height: 12px;
		border-width: 1.5px;
	}

	.no-actions-text, .no-backlog-text {
		color: var(--text-secondary);
		font-size: 0.75rem;
		text-align: center;
		padding: 1rem 0.5rem;
	}

	/* Actions Carousel Styles */
	.actions-carousel-card {
		min-height: 280px;
		display: flex;
		flex-direction: column;
	}

	.carousel-tabs {
		display: flex;
		gap: 0;
		border-bottom: 2px solid #eab308;
		margin-bottom: 0;
		align-items: center;
	}

	.carousel-tab {
		padding: 0.75rem 1.25rem;
		background: transparent;
		border: none;
		cursor: pointer;
		font-size: 0.85rem;
		font-weight: 500;
		color: var(--text-secondary);
		position: relative;
		transition: all 0.2s ease;
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.carousel-tab:hover {
		color: var(--text-primary);
	}

	.carousel-tab.active {
		color: var(--text-primary);
		font-weight: 600;
	}

	.carousel-tab.active::after {
		content: '';
		position: absolute;
		bottom: -2px;
		left: 0;
		right: 0;
		height: 2px;
		background: var(--text-primary);
	}

	.tab-count {
		background: var(--accent-color);
		color: white;
		font-size: 0.65rem;
		padding: 0.15rem 0.4rem;
		border-radius: 10px;
		font-weight: 600;
	}

	.carousel-tab-spacer {
		flex: 1;
	}

	.carousel-progress-bar {
		height: 3px;
		background: linear-gradient(90deg, #eab308 0%, #eab308 100%);
		margin-bottom: 1rem;
	}

	.carousel-loading {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		padding: 3rem;
		color: var(--text-secondary);
	}

	.carousel-content {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 1rem;
	}

	.carousel-empty {
		text-align: center;
		color: var(--text-secondary);
		padding: 2rem;
	}

	.carousel-empty .material-symbols-outlined {
		font-size: 3rem;
		opacity: 0.3;
		margin-bottom: 0.5rem;
	}

	.carousel-empty p {
		font-size: 1rem;
		margin-bottom: 0.25rem;
	}

	.carousel-empty .empty-hint {
		font-size: 0.75rem;
		opacity: 0.7;
	}

	.carousel-card-container {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 1rem;
		width: 100%;
		max-width: 600px;
	}

	.carousel-nav {
		width: 48px;
		height: 48px;
		border: 2px solid var(--border-color);
		background: transparent;
		border-radius: 50%;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: all 0.2s ease;
		flex-shrink: 0;
	}

	.carousel-nav:hover:not(:disabled) {
		border-color: var(--accent-color);
		background: rgba(var(--accent-rgb), 0.1);
	}

	.carousel-nav:disabled {
		opacity: 0.3;
		cursor: not-allowed;
	}

	.nav-arrow {
		font-size: 1.5rem;
		font-weight: 300;
		color: var(--text-primary);
		line-height: 1;
	}

	.carousel-action-card {
		flex: 1;
		min-height: 120px;
		max-width: 400px;
		background: var(--card-bg);
		border: 1px solid var(--border-color);
		border-radius: 12px;
		padding: 1.5rem;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		text-align: center;
		position: relative;
	}

	.action-source-badge {
		position: absolute;
		top: 0.5rem;
		left: 0.5rem;
		font-size: 0.65rem;
		font-weight: 600;
		padding: 0.2rem 0.5rem;
		border-radius: 4px;
		text-transform: uppercase;
	}

	.action-source-badge.gtm {
		background: #8b5cf6;
		color: white;
	}

	.action-source-badge.goal {
		background: #0ea5e9;
		color: white;
	}

	.carousel-action-text {
		font-size: 1rem;
		line-height: 1.5;
		color: var(--text-primary);
		margin: 0;
	}

	.carousel-action-index {
		font-size: 0.7rem;
		color: var(--text-secondary);
		margin-top: 1rem;
	}

	.bucket-card {
		background: linear-gradient(135deg, rgba(16, 185, 129, 0.05), rgba(16, 185, 129, 0.02));
		border-color: rgba(16, 185, 129, 0.3);
	}

	.bucket-checkbox-row {
		display: flex;
		align-items: flex-start;
		gap: 0.75rem;
		text-align: left;
		width: 100%;
	}

	.bucket-checkbox {
		width: 20px;
		height: 20px;
		flex-shrink: 0;
		accent-color: #10b981;
		cursor: pointer;
		margin-top: 2px;
	}

	.backlog-card-style {
		background: rgba(0, 0, 0, 0.02);
		border-style: dashed;
	}

	/* Accept/Reject Buttons */
	.carousel-action-buttons {
		display: flex;
		gap: 3rem;
		margin-top: 1.5rem;
	}

	.carousel-btn {
		width: 56px;
		height: 56px;
		border-radius: 50%;
		border: 3px solid;
		background: transparent;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: all 0.2s ease;
	}

	.carousel-btn.reject {
		border-color: #ef4444;
		color: #ef4444;
	}

	.carousel-btn.reject:hover {
		background: #ef4444;
		color: white;
		transform: scale(1.1);
	}

	.carousel-btn.accept {
		border-color: #10b981;
		color: #10b981;
	}

	.carousel-btn.accept:hover {
		background: #10b981;
		color: white;
		transform: scale(1.1);
	}

	.carousel-btn-icon {
		font-size: 1.5rem;
		font-weight: bold;
	}

	/* RAG Pentagon Buttons */
	.carousel-rag-buttons {
		display: flex;
		gap: 2rem;
		margin-top: 1.5rem;
	}

	.rag-btn-large {
		width: 40px;
		height: 40px;
		border: none;
		background: transparent;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: all 0.2s ease;
		opacity: 0.4;
	}

	.rag-btn-large:hover {
		opacity: 0.7;
		transform: scale(1.15);
	}

	.rag-btn-large.active {
		opacity: 1;
		transform: scale(1.2);
	}

	.rag-btn-large .rag-pentagon {
		width: 30px;
		height: 30px;
		clip-path: polygon(50% 0%, 100% 38%, 82% 100%, 18% 100%, 0% 38%);
	}

	.rag-btn-large.red .rag-pentagon {
		background: #ef4444;
	}

	.rag-btn-large.amber .rag-pentagon {
		background: #fbbf24;
	}

	.rag-btn-large.green .rag-pentagon {
		background: #10b981;
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
			grid-template-columns: 140px 1fr;
		}
	}

	@media (max-width: 992px) {
		.home-layout {
			height: auto;
			overflow: auto;
		}
		
		.home-row-top {
			grid-template-columns: 1fr;
		}
		
		.valuation-summary-card {
			grid-column: 1;
		}
		
		.actions-carousel-card {
			grid-column: 1;
		}
	}

	@media (max-width: 768px) {
		.home-row-top, .home-row-bottom {
			grid-template-columns: 1fr;
		}
		
		.actions-carousel-card {
			grid-column: span 1;
			grid-row: auto;
		}
		
		.carousel-tabs {
			flex-wrap: wrap;
		}
		
		.carousel-tab {
			padding: 0.5rem 0.75rem;
			font-size: 0.75rem;
		}
		
		.carousel-card-container {
			gap: 0.5rem;
		}
		
		.carousel-nav {
			width: 36px;
			height: 36px;
		}
		
		.carousel-action-card {
			padding: 1rem;
			min-height: 100px;
		}
		
		.carousel-action-buttons {
			gap: 2rem;
		}
		
		.carousel-btn {
			width: 48px;
			height: 48px;
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

	.autofill-btn {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 8px 14px;
		background: linear-gradient(135deg, #f59e0b, #d97706);
		color: white;
		border: none;
		border-radius: 20px;
		font-size: 0.8rem;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.2s ease;
		white-space: nowrap;
	}

	.autofill-btn:hover {
		transform: translateY(-2px);
		box-shadow: 0 4px 12px rgba(245, 158, 11, 0.3);
	}

	.autofill-btn .material-symbols-outlined {
		font-size: 18px;
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

	/* =====================================================
	   SYNOPSIS AND REFLECTION STYLES
	   ===================================================== */
	
	.history-btn {
		background: rgba(255,255,255,0.2);
		border: none;
		border-radius: 8px;
		padding: 0.5rem;
		cursor: pointer;
		color: white;
		display: flex;
		align-items: center;
	}
	
	.history-btn:hover {
		background: rgba(255,255,255,0.3);
	}
	
	/* Synopsis Card */
	.synopsis-card {
		background: var(--card-bg);
		border: 2px solid var(--accent-primary);
	}
	
	.synopsis-grid {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 1rem;
		margin: 1rem 0;
	}
	
	.synopsis-item {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		padding: 1rem;
		background: var(--bg-secondary);
		border-radius: 10px;
		text-align: center;
	}
	
	.synopsis-label {
		font-size: 0.75rem;
		text-transform: uppercase;
		color: var(--text-secondary);
		letter-spacing: 0.5px;
	}
	
	.synopsis-value {
		font-size: 1.1rem;
		font-weight: 600;
		color: var(--text-primary);
	}
	
	.synopsis-value.has-revenue {
		color: #22c55e;
	}
	
	.synopsis-value.pre-revenue {
		color: #f59e0b;
	}
	
	.current-challenges-box {
		background: linear-gradient(135deg, rgba(239, 68, 68, 0.1), rgba(251, 191, 36, 0.1));
		border: 1px solid rgba(239, 68, 68, 0.2);
		border-radius: 12px;
		padding: 1rem 1.25rem;
		margin: 1rem 0;
	}
	
	.current-challenges-box h4 {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin: 0 0 0.75rem 0;
		font-size: 0.95rem;
		color: var(--text-primary);
	}
	
	.current-challenges-box h4 .material-symbols-outlined {
		color: #ef4444;
		font-size: 1.2rem;
	}
	
	.challenges-tags {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}
	
	.challenge-tag {
		padding: 0.35rem 0.75rem;
		border-radius: 20px;
		font-size: 0.85rem;
		font-weight: 500;
		background: rgba(239, 68, 68, 0.15);
		color: #dc2626;
	}
	
	.challenge-tag.customers { background: rgba(59, 130, 246, 0.15); color: #2563eb; }
	.challenge-tag.product { background: rgba(168, 85, 247, 0.15); color: #9333ea; }
	.challenge-tag.funding { background: rgba(34, 197, 94, 0.15); color: #16a34a; }
	.challenge-tag.team { background: rgba(249, 115, 22, 0.15); color: #ea580c; }
	.challenge-tag.competition { background: rgba(236, 72, 153, 0.15); color: #db2777; }
	
	.goal-tracker {
		background: var(--bg-secondary);
		border-radius: 12px;
		padding: 1rem 1.25rem;
	}
	
	.goal-tracker h4 {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin: 0 0 0.5rem 0;
		font-size: 0.95rem;
	}
	
	.goal-tracker h4 .material-symbols-outlined {
		color: var(--accent-primary);
	}
	
	.goal-text {
		margin: 0 0 0.75rem 0;
		font-style: italic;
		color: var(--text-secondary);
	}
	
	.goal-progress .progress-bar {
		height: 8px;
		background: var(--border-color);
		border-radius: 4px;
		overflow: hidden;
	}
	
	.goal-progress .progress-fill {
		height: 100%;
		background: linear-gradient(90deg, var(--accent-primary), var(--accent-secondary, #6366f1));
		border-radius: 4px;
		transition: width 0.5s ease;
	}
	
	.goal-progress .progress-label {
		font-size: 0.8rem;
		color: var(--text-secondary);
		margin-top: 0.25rem;
		display: block;
	}
	
	.synopsis-empty {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1rem;
		padding: 2rem;
		text-align: center;
	}
	
	.synopsis-empty .material-symbols-outlined {
		font-size: 3rem;
		color: var(--text-secondary);
	}
	
	/* Reflection Card */
	.reflection-card {
		background: var(--card-bg);
	}
	
	.mood-section {
		margin-bottom: 1.5rem;
	}
	
	.mood-section label {
		display: block;
		font-weight: 500;
		margin-bottom: 0.75rem;
		color: var(--text-primary);
	}
	
	.mood-options {
		display: flex;
		gap: 0.75rem;
	}
	
	.mood-btn {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.25rem;
		padding: 0.75rem 1rem;
		background: var(--bg-secondary);
		border: 2px solid transparent;
		border-radius: 12px;
		cursor: pointer;
		transition: all 0.2s ease;
	}
	
	.mood-btn:hover {
		border-color: var(--accent-primary);
		transform: translateY(-2px);
	}
	
	.mood-btn.selected {
		border-color: var(--accent-primary);
		background: rgba(var(--accent-primary-rgb, 99, 102, 241), 0.1);
	}
	
	.mood-btn span:first-child {
		font-size: 1.5rem;
	}
	
	.mood-btn span:last-child {
		font-size: 0.8rem;
		color: var(--text-secondary);
	}
	
	.reflection-section {
		margin-bottom: 1.25rem;
	}
	
	.reflection-section label {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-weight: 500;
		margin-bottom: 0.5rem;
		color: var(--text-primary);
	}
	
	.reflection-section label .material-symbols-outlined {
		font-size: 1.2rem;
		color: var(--accent-primary);
	}
	
	.reflection-section textarea,
	.reflection-section input[type="text"] {
		width: 100%;
		padding: 0.75rem 1rem;
		border: 1px solid var(--border-color);
		border-radius: 10px;
		background: var(--bg-secondary);
		color: var(--text-primary);
		font-size: 0.95rem;
		resize: vertical;
		transition: border-color 0.2s ease;
	}
	
	.reflection-section textarea:focus,
	.reflection-section input[type="text"]:focus {
		outline: none;
		border-color: var(--accent-primary);
	}
	
	.challenges-input-area {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}
	
	.challenge-input-row {
		display: flex;
		gap: 0.5rem;
	}
	
	.challenge-input-row input {
		flex: 1;
		padding: 0.75rem 1rem;
		border: 1px solid var(--border-color);
		border-radius: 10px;
		background: var(--bg-secondary);
		color: var(--text-primary);
	}
	
	.add-challenge-btn {
		padding: 0.75rem;
		background: var(--accent-primary);
		color: white;
		border: none;
		border-radius: 10px;
		cursor: pointer;
		display: flex;
		align-items: center;
	}
	
	.add-challenge-btn:hover {
		opacity: 0.9;
	}
	
	.today-challenges-list {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	
	.today-challenge-item {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.5rem 0.75rem;
		background: rgba(239, 68, 68, 0.1);
		border-radius: 8px;
	}
	
	.remove-challenge {
		background: none;
		border: none;
		color: var(--text-secondary);
		cursor: pointer;
		padding: 0.25rem;
		display: flex;
	}
	
	.remove-challenge:hover {
		color: #ef4444;
	}
	
	.priority-section .priority-input {
		font-size: 1.1rem;
		font-weight: 500;
		border: 2px solid var(--accent-primary);
	}
	
	.reflection-actions {
		display: flex;
		justify-content: flex-end;
		gap: 0.75rem;
		margin-top: 1.5rem;
		padding-top: 1rem;
		border-top: 1px solid var(--border-color);
	}
	
	/* Simulation Card */
	.simulation-card {
		background: var(--card-bg);
	}
	
	.simulation-input-area {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		margin: 1rem 0;
	}
	
	.simulation-input-area textarea {
		width: 100%;
		padding: 0.75rem 1rem;
		border: 1px solid var(--border-color);
		border-radius: 10px;
		background: var(--bg-secondary);
		color: var(--text-primary);
		resize: none;
	}
	
	.simulate-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		padding: 0.75rem 1.5rem;
		background: linear-gradient(135deg, #8b5cf6, #6366f1);
		color: white;
		border: none;
		border-radius: 10px;
		cursor: pointer;
		font-weight: 500;
		transition: all 0.2s ease;
	}
	
	.simulate-btn:hover:not(:disabled) {
		transform: translateY(-2px);
		box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
	}
	
	.simulate-btn:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}
	
	.simulation-results {
		margin-top: 1.5rem;
		padding-top: 1.5rem;
		border-top: 1px solid var(--border-color);
	}
	
	.simulation-scenario {
		display: flex;
		align-items: flex-start;
		gap: 0.5rem;
		padding: 0.75rem 1rem;
		background: var(--bg-secondary);
		border-radius: 10px;
		margin-bottom: 1rem;
	}
	
	.simulation-scenario .material-symbols-outlined {
		color: var(--accent-primary);
	}
	
	.simulation-impacts-grid {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 0.75rem;
		margin-bottom: 1rem;
	}
	
	.sim-impact-card {
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		padding: 1rem;
		background: var(--bg-secondary);
		border-radius: 12px;
		border: 2px solid transparent;
	}
	
	.sim-impact-card.positive {
		border-color: rgba(34, 197, 94, 0.3);
		background: rgba(34, 197, 94, 0.05);
	}
	
	.sim-impact-card.negative {
		border-color: rgba(239, 68, 68, 0.3);
		background: rgba(239, 68, 68, 0.05);
	}
	
	.sim-impact-card.neutral {
		border-color: rgba(234, 179, 8, 0.3);
		background: rgba(234, 179, 8, 0.05);
	}
	
	.sim-impact-card.risk-low {
		border-color: rgba(34, 197, 94, 0.3);
	}
	
	.sim-impact-card.risk-medium {
		border-color: rgba(234, 179, 8, 0.3);
	}
	
	.sim-impact-card.risk-high {
		border-color: rgba(239, 68, 68, 0.3);
	}
	
	.sim-icon {
		font-size: 1.5rem;
		margin-bottom: 0.25rem;
	}
	
	.sim-label {
		font-size: 0.75rem;
		text-transform: uppercase;
		color: var(--text-secondary);
		margin-bottom: 0.25rem;
	}
	
	.sim-value {
		font-size: 0.9rem;
		font-weight: 600;
		color: var(--text-primary);
	}
	
	.simulation-recommendation {
		background: linear-gradient(135deg, rgba(99, 102, 241, 0.1), rgba(139, 92, 246, 0.1));
		border: 1px solid rgba(99, 102, 241, 0.2);
		border-radius: 12px;
		padding: 1rem 1.25rem;
		margin-bottom: 1rem;
	}
	
	.simulation-recommendation .rec-header {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-bottom: 0.5rem;
	}
	
	.simulation-recommendation .rec-header .material-symbols-outlined {
		color: var(--accent-primary);
	}
	
	.confidence-badge {
		margin-left: auto;
		font-size: 0.75rem;
		padding: 0.25rem 0.5rem;
		background: var(--bg-secondary);
		border-radius: 12px;
		color: var(--text-secondary);
	}
	
	.simulation-recommendation p {
		margin: 0;
		color: var(--text-secondary);
		line-height: 1.5;
	}
	
	/* Simulation Summary */
	.simulation-summary {
		display: flex;
		align-items: flex-start;
		gap: 0.75rem;
		padding: 1rem;
		background: linear-gradient(135deg, rgba(99, 102, 241, 0.08), rgba(139, 92, 246, 0.05));
		border-radius: 12px;
		margin-bottom: 1rem;
		border-left: 3px solid var(--accent-primary);
	}
	
	.simulation-summary .material-symbols-outlined {
		color: var(--accent-primary);
		flex-shrink: 0;
	}
	
	.simulation-summary p {
		margin: 0;
		color: var(--text-primary);
		font-size: 0.95rem;
		line-height: 1.6;
	}
	
	/* Scenario Cards (Best/Worst Case) */
	.scenario-cards {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1rem;
		margin-bottom: 1rem;
	}
	
	.scenario-card {
		padding: 1rem;
		border-radius: 12px;
		border: 1px solid var(--border-color);
	}
	
	.scenario-card.best-case {
		background: linear-gradient(135deg, rgba(34, 197, 94, 0.08), rgba(34, 197, 94, 0.02));
		border-color: rgba(34, 197, 94, 0.3);
	}
	
	.scenario-card.worst-case {
		background: linear-gradient(135deg, rgba(239, 68, 68, 0.08), rgba(239, 68, 68, 0.02));
		border-color: rgba(239, 68, 68, 0.3);
	}
	
	.scenario-header {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-bottom: 0.75rem;
	}
	
	.best-case .scenario-header .material-symbols-outlined {
		color: #22c55e;
	}
	
	.worst-case .scenario-header .material-symbols-outlined {
		color: #ef4444;
	}
	
	.scenario-desc {
		font-size: 0.9rem;
		color: var(--text-secondary);
		line-height: 1.5;
		margin-bottom: 0.75rem;
	}
	
	.scenario-list {
		list-style: none;
		padding: 0;
		margin: 0.5rem 0;
	}
	
	.scenario-list li {
		display: flex;
		align-items: flex-start;
		gap: 0.5rem;
		font-size: 0.85rem;
		color: var(--text-secondary);
		padding: 0.25rem 0;
	}
	
	.scenario-list li .material-symbols-outlined {
		font-size: 1rem;
		flex-shrink: 0;
	}
	
	.best-case .scenario-list li .material-symbols-outlined {
		color: #22c55e;
	}
	
	.worst-case .scenario-list li .material-symbols-outlined {
		color: #ef4444;
	}
	
	.sub-label {
		display: block;
		font-size: 0.75rem;
		text-transform: uppercase;
		color: var(--text-tertiary);
		margin-top: 0.5rem;
		margin-bottom: 0.25rem;
	}
	
	.timeline-badge {
		display: inline-block;
		font-size: 0.8rem;
		padding: 0.25rem 0.5rem;
		background: rgba(34, 197, 94, 0.15);
		color: #22c55e;
		border-radius: 6px;
		margin-top: 0.5rem;
	}
	
	/* Next Steps Section */
	.next-steps-section {
		background: var(--bg-secondary);
		border-radius: 12px;
		padding: 1rem;
		margin-bottom: 1rem;
	}
	
	.next-steps-section .section-header {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-bottom: 0.75rem;
	}
	
	.next-steps-section .section-header .material-symbols-outlined {
		color: var(--accent-primary);
	}
	
	.next-steps-list {
		margin: 0;
		padding-left: 1.5rem;
	}
	
	.next-steps-list li {
		font-size: 0.9rem;
		color: var(--text-secondary);
		padding: 0.25rem 0;
		line-height: 1.5;
	}
	
	/* Alternatives Section */
	.alternatives-section {
		margin-bottom: 1rem;
	}
	
	.alternatives-section .section-header {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-bottom: 0.75rem;
	}
	
	.alternatives-section .section-header .material-symbols-outlined {
		color: var(--accent-secondary);
	}
	
	.alternatives-grid {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	
	.alternative-card {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		padding: 0.75rem 1rem;
		background: var(--bg-secondary);
		border-radius: 8px;
		border-left: 3px solid var(--accent-secondary);
	}
	
	.alt-approach {
		font-size: 0.9rem;
		color: var(--text-primary);
		font-weight: 500;
	}
	
	.alt-tradeoff {
		font-size: 0.8rem;
		color: var(--text-secondary);
	}
	
	@media (max-width: 768px) {
		.scenario-cards {
			grid-template-columns: 1fr;
		}
		
		.simulation-impacts-grid {
			grid-template-columns: repeat(2, 1fr);
		}
	}

	/* AI Strategic Question Card */
	.ai-prompt-card {
		background: linear-gradient(135deg, var(--card-bg), rgba(99, 102, 241, 0.05));
		border: 1px solid rgba(99, 102, 241, 0.2);
	}
	
	.strategic-question-box {
		text-align: center;
		padding: 1.5rem;
	}
	
	.strategic-question {
		font-size: 1.2rem;
		font-weight: 500;
		line-height: 1.6;
		color: var(--text-primary);
		margin: 0 0 1.5rem 0;
		font-style: italic;
	}
	
	.ask-daddy-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.75rem 1.5rem;
		background: var(--accent-primary);
		color: white;
		border: none;
		border-radius: 10px;
		cursor: pointer;
		font-weight: 500;
		transition: all 0.2s ease;
	}
	
	.ask-daddy-btn:hover {
		transform: translateY(-2px);
		box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
	}
	
	@media (max-width: 768px) {
		.synopsis-grid {
			grid-template-columns: repeat(2, 1fr);
		}
		
		.simulation-impacts-grid {
			grid-template-columns: repeat(2, 1fr);
		}
		
		.mood-options {
			flex-wrap: wrap;
		}
	}

	/* =====================================================
	   TODAY'S PROBLEM SECTION STYLES
	   ===================================================== */
	
	.todays-problem-card {
		background: linear-gradient(135deg, var(--card-bg), rgba(239, 68, 68, 0.05));
		border: 2px solid rgba(239, 68, 68, 0.3);
	}
	
	.todays-problem-content {
		padding: 0.5rem 0;
	}
	
	.primary-challenge-box {
		display: flex;
		align-items: center;
		gap: 1rem;
		padding: 1.25rem;
		background: linear-gradient(135deg, rgba(239, 68, 68, 0.15), rgba(251, 191, 36, 0.1));
		border-radius: 12px;
		margin-bottom: 1.5rem;
	}
	
	.primary-label {
		font-size: 0.9rem;
		color: var(--text-secondary);
		font-weight: 500;
	}
	
	.primary-value {
		font-size: 1.5rem;
		font-weight: 700;
		color: #ef4444;
	}
	
	.challenge-swot-focus {
		margin-bottom: 1.5rem;
	}
	
	.challenge-swot-focus h4 {
		margin: 0 0 1rem 0;
		font-size: 1rem;
		color: var(--text-primary);
	}
	
	.challenge-swot-grid {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 1rem;
	}
	
	.challenge-swot-item {
		padding: 1rem;
		border-radius: 10px;
		background: var(--bg-secondary);
	}
	
	.challenge-swot-item.leverage {
		border-left: 4px solid #22c55e;
	}
	
	.challenge-swot-item.fix {
		border-left: 4px solid #f59e0b;
	}
	
	.challenge-swot-item.capture {
		border-left: 4px solid #3b82f6;
	}
	
	.challenge-swot-item.mitigate {
		border-left: 4px solid #ef4444;
	}
	
	.csw-header {
		display: block;
		font-size: 0.85rem;
		font-weight: 600;
		margin-bottom: 0.5rem;
		color: var(--text-primary);
	}
	
	.challenge-swot-item p {
		margin: 0;
		font-size: 0.9rem;
		color: var(--text-secondary);
		line-height: 1.5;
	}
	
	.why-this-matters {
		background: var(--bg-secondary);
		border-radius: 12px;
		padding: 1.25rem;
		margin-bottom: 1.5rem;
	}
	
	.why-this-matters h4 {
		margin: 0 0 0.75rem 0;
		font-size: 1rem;
		color: var(--text-primary);
	}
	
	.why-content p {
		margin: 0 0 0.5rem 0;
		font-size: 0.95rem;
		line-height: 1.6;
		color: var(--text-secondary);
	}
	
	.why-content p:last-child {
		margin-bottom: 0;
	}
	
	.secondary-challenges {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding-top: 1rem;
		border-top: 1px solid var(--border-color);
	}
	
	.secondary-label {
		font-size: 0.85rem;
		color: var(--text-secondary);
	}
	
	.secondary-tags {
		display: flex;
		gap: 0.5rem;
	}
	
	.secondary-tag {
		padding: 0.25rem 0.75rem;
		background: var(--bg-secondary);
		border-radius: 16px;
		font-size: 0.8rem;
		color: var(--text-secondary);
	}
	
	.no-challenges {
		text-align: center;
		padding: 2rem;
	}
	
	.no-challenges p {
		color: var(--text-secondary);
		margin-bottom: 1rem;
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

	/* Chat message markdown styles */
	.chat-message-text strong {
		font-weight: 700;
		color: inherit;
	}

	.chat-message-text .chat-list {
		margin: 0.5rem 0;
		padding-left: 0;
		list-style: none;
	}

	.chat-message-text .chat-list li {
		margin: 0.4rem 0;
		padding-left: 0.5rem;
		line-height: 1.5;
	}

	.chat-message-text .chat-list li strong {
		color: var(--accent-primary);
	}

	.chat-message.assistant .chat-message-text strong {
		color: #fbbf24;
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

	/* ===============================================
	   NEW INTROSPECTION METHODOLOGIES STYLES
	   =============================================== */
	
	/* Decision Impact Analysis */
	.decision-impact-grid {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 1.5rem;
		margin-top: 1.5rem;
	}

	.impact-card {
		background: var(--bg-secondary);
		border-radius: 16px;
		padding: 1.5rem;
		border: 1px solid var(--border-color);
		transition: all 0.3s ease;
	}

	.impact-card:hover {
		transform: translateY(-4px);
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1);
	}

	.impact-header {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		margin-bottom: 1rem;
	}

	.impact-header .material-symbols-outlined {
		font-size: 24px;
		padding: 8px;
		border-radius: 10px;
		background: linear-gradient(135deg, var(--accent-primary), var(--accent-secondary));
		color: white;
	}

	.impact-header h4 {
		margin: 0;
		font-size: 1rem;
		font-weight: 600;
		color: var(--text-primary);
	}

	.revenue-impact .impact-header .material-symbols-outlined {
		background: linear-gradient(135deg, #10b981, #059669);
	}

	.cost-impact .impact-header .material-symbols-outlined {
		background: linear-gradient(135deg, #3b82f6, #2563eb);
	}

	.customer-impact .impact-header .material-symbols-outlined {
		background: linear-gradient(135deg, #8b5cf6, #7c3aed);
	}

	.risk-impact .impact-header .material-symbols-outlined {
		background: linear-gradient(135deg, #f59e0b, #d97706);
	}

	.impact-score-ring {
		display: flex;
		align-items: baseline;
		justify-content: center;
		gap: 2px;
		margin: 1rem 0;
	}

	.score-value {
		font-size: 2.5rem;
		font-weight: 700;
		background: linear-gradient(135deg, var(--accent-primary), var(--accent-secondary));
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
		background-clip: text;
	}

	.score-label {
		font-size: 1rem;
		color: var(--text-secondary);
		font-weight: 500;
	}

	.impact-items {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.impact-item {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.75rem 1rem;
		background: var(--bg-tertiary);
		border-radius: 10px;
		font-size: 0.9rem;
		color: var(--text-primary);
	}

	.impact-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--text-secondary);
	}

	.impact-item.positive .impact-dot {
		background: #10b981;
		box-shadow: 0 0 8px rgba(16, 185, 129, 0.5);
	}

	.impact-item.warning .impact-dot {
		background: #f59e0b;
		box-shadow: 0 0 8px rgba(245, 158, 11, 0.5);
	}

	.impact-item.neutral .impact-dot {
		background: #6b7280;
	}

	/* Value Driver Tree */
	.value-tree-container {
		margin-top: 1.5rem;
		padding: 2rem;
		background: var(--bg-secondary);
		border-radius: 16px;
		border: 1px solid var(--border-color);
	}

	.tree-level {
		display: flex;
		justify-content: center;
		gap: 1.5rem;
		flex-wrap: wrap;
	}

	.tree-node {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.5rem;
		padding: 1rem 1.5rem;
		background: var(--bg-tertiary);
		border-radius: 12px;
		border: 1px solid var(--border-color);
		min-width: 120px;
		transition: all 0.3s ease;
	}

	.tree-node:hover {
		transform: scale(1.05);
		box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
	}

	.tree-node .material-symbols-outlined {
		font-size: 24px;
		color: var(--accent-primary);
	}

	.node-label {
		font-size: 0.85rem;
		font-weight: 600;
		color: var(--text-primary);
	}

	.node-value {
		font-size: 0.9rem;
		color: var(--accent-primary);
		font-weight: 600;
	}

	.node-weight {
		font-size: 0.75rem;
		color: var(--text-secondary);
		padding: 0.25rem 0.5rem;
		background: rgba(var(--accent-primary-rgb), 0.1);
		border-radius: 20px;
	}

	.root-node {
		background: linear-gradient(135deg, var(--accent-primary), var(--accent-secondary));
		color: white;
		padding: 1.5rem 2rem;
	}

	.root-node .material-symbols-outlined,
	.root-node .node-label,
	.root-node .node-value {
		color: white;
	}

	.primary-level {
		gap: 1rem;
	}

	.primary-node {
		flex: 1;
		max-width: 180px;
	}

	.revenue-node { border-color: #10b981; }
	.growth-node { border-color: #3b82f6; }
	.profit-node { border-color: #8b5cf6; }
	.risk-node { border-color: #f59e0b; }

	.tree-connector {
		width: 2px;
		height: 30px;
		background: linear-gradient(to bottom, var(--accent-primary), transparent);
		margin: 0.5rem auto;
	}

	.tree-connector.secondary {
		width: 60%;
		height: 2px;
		background: linear-gradient(to right, transparent, var(--border-color), transparent);
		margin: 1rem auto;
	}

	.secondary-level {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 1rem;
	}

	.secondary-node {
		min-width: 100px;
		padding: 0.75rem 1rem;
		background: var(--bg-tertiary);
	}

	.tree-formula {
		font-size: 1.5rem;
		font-weight: 300;
		color: var(--text-secondary);
	}

	.action-level {
		margin-top: 1.5rem;
	}

	.action-metrics {
		display: flex;
		justify-content: center;
		gap: 1rem;
		flex-wrap: wrap;
	}

	.action-metric {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 1rem;
		background: linear-gradient(135deg, rgba(var(--accent-primary-rgb), 0.1), rgba(var(--accent-secondary-rgb), 0.1));
		border-radius: 20px;
		font-size: 0.85rem;
		color: var(--text-primary);
	}

	.metric-icon {
		font-size: 1rem;
	}

	/* Trajectory & Trigger Analysis */
	.trajectory-container {
		margin-top: 1.5rem;
	}

	.trajectory-curve {
		background: var(--bg-secondary);
		border-radius: 16px;
		padding: 2rem;
		border: 1px solid var(--border-color);
		margin-bottom: 1.5rem;
	}

	.curve-phases {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.phase {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.75rem;
		z-index: 1;
	}

	.phase-dot {
		width: 20px;
		height: 20px;
		border-radius: 50%;
		background: var(--border-color);
		border: 3px solid var(--bg-primary);
		transition: all 0.3s ease;
	}

	.phase.completed .phase-dot {
		background: #10b981;
		box-shadow: 0 0 12px rgba(16, 185, 129, 0.5);
	}

	.phase.active .phase-dot {
		background: var(--accent-primary);
		box-shadow: 0 0 16px rgba(var(--accent-primary-rgb), 0.6);
		transform: scale(1.3);
	}

	.phase-label {
		font-size: 0.85rem;
		font-weight: 500;
		color: var(--text-secondary);
	}

	.phase.active .phase-label {
		color: var(--accent-primary);
		font-weight: 600;
	}

	.phase-connector {
		flex: 1;
		height: 3px;
		background: var(--border-color);
		margin: 0 -5px;
		margin-bottom: 2rem;
	}

	.phase-connector.completed {
		background: linear-gradient(90deg, #10b981, #22c55e);
	}

	.current-position {
		text-align: center;
		margin-top: 1.5rem;
		padding-top: 1rem;
		border-top: 1px solid var(--border-color);
	}

	.position-label {
		font-size: 1rem;
		color: var(--text-secondary);
	}

	.position-label strong {
		color: var(--accent-primary);
		font-size: 1.1rem;
	}

	.triggers-grid {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 1.5rem;
	}

	.triggers-section {
		background: var(--bg-secondary);
		border-radius: 16px;
		padding: 1.5rem;
		border: 1px solid var(--border-color);
	}

	.triggers-section h4 {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin: 0 0 1rem 0;
		font-size: 1rem;
		font-weight: 600;
	}

	.positive-triggers h4 {
		color: #10b981;
	}

	.positive-triggers h4 .material-symbols-outlined {
		color: #10b981;
	}

	.risk-triggers h4 {
		color: #ef4444;
	}

	.risk-triggers h4 .material-symbols-outlined {
		color: #ef4444;
	}

	.trigger-list {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.trigger-item {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.75rem 1rem;
		background: var(--bg-tertiary);
		border-radius: 10px;
		font-size: 0.9rem;
	}

	.trigger-timeline {
		padding: 0.25rem 0.5rem;
		border-radius: 6px;
		font-size: 0.7rem;
		font-weight: 600;
		text-transform: uppercase;
		white-space: nowrap;
	}

	.trigger-timeline.imminent {
		background: rgba(239, 68, 68, 0.15);
		color: #ef4444;
	}

	.trigger-timeline.near-term {
		background: rgba(245, 158, 11, 0.15);
		color: #f59e0b;
	}

	.trigger-timeline.long-term {
		background: rgba(107, 114, 128, 0.15);
		color: #6b7280;
	}

	.trigger-text {
		flex: 1;
		color: var(--text-primary);
	}

	.trigger-impact {
		padding: 0.25rem 0.5rem;
		border-radius: 6px;
		font-size: 0.7rem;
		font-weight: 600;
		white-space: nowrap;
	}

	.trigger-impact.high {
		background: rgba(16, 185, 129, 0.15);
		color: #10b981;
	}

	.trigger-impact.medium {
		background: rgba(59, 130, 246, 0.15);
		color: #3b82f6;
	}

	.positive-triggers .trigger-impact.high {
		background: rgba(16, 185, 129, 0.15);
		color: #10b981;
	}

	.risk-triggers .trigger-impact.high {
		background: rgba(239, 68, 68, 0.15);
		color: #ef4444;
	}

	.risk-triggers .trigger-impact.medium {
		background: rgba(245, 158, 11, 0.15);
		color: #f59e0b;
	}

	/* ========================================
	   FOUNDER DECISION INTELLIGENCE ENGINE
	   ======================================== */

	/* Actionable Summary Box */
	.actionable-summary-box {
		background: linear-gradient(135deg, rgba(99, 102, 241, 0.1), rgba(139, 92, 246, 0.05));
		border: 1px solid rgba(99, 102, 241, 0.2);
		border-radius: 16px;
		padding: 1.5rem;
		margin-bottom: 1.5rem;
	}

	.actionable-summary-box .summary-header {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		margin-bottom: 0.75rem;
	}

	.actionable-summary-box .summary-header .material-symbols-outlined {
		font-size: 1.5rem;
		color: #6366f1;
	}

	.actionable-summary-box .summary-header h3 {
		margin: 0;
		font-size: 1.1rem;
		font-weight: 600;
		color: var(--text-primary);
	}

	.actionable-summary-box .summary-text {
		color: var(--text-secondary);
		font-size: 0.95rem;
		line-height: 1.5;
		margin-bottom: 1rem;
	}

	.actionable-summary-box .action-checklist {
		background: rgba(255, 255, 255, 0.05);
		border-radius: 10px;
		padding: 1rem;
	}

	.actionable-summary-box .checklist-title {
		font-weight: 600;
		font-size: 0.9rem;
		color: var(--text-primary);
		margin-bottom: 0.5rem;
	}

	.actionable-summary-box ul {
		margin: 0;
		padding-left: 1.25rem;
		list-style: none;
	}

	.actionable-summary-box li {
		position: relative;
		color: var(--text-secondary);
		font-size: 0.9rem;
		padding: 0.35rem 0;
		padding-left: 0.5rem;
	}

	.actionable-summary-box li::before {
		content: '→';
		position: absolute;
		left: -1rem;
		color: #10b981;
		font-weight: bold;
	}

	.actionable-summary-box li strong {
		color: var(--text-primary);
	}

	/* Actionable Guide (inline) */
	.actionable-guide {
		display: flex;
		align-items: flex-start;
		gap: 0.75rem;
		background: linear-gradient(135deg, rgba(16, 185, 129, 0.1), rgba(6, 182, 212, 0.05));
		border: 1px solid rgba(16, 185, 129, 0.2);
		border-radius: 10px;
		padding: 1rem 1.25rem;
		margin-bottom: 1rem;
	}

	.actionable-guide .guide-icon {
		font-size: 1.25rem;
		flex-shrink: 0;
	}

	.actionable-guide .guide-content {
		font-size: 0.9rem;
		color: var(--text-secondary);
		line-height: 1.5;
	}

	.actionable-guide .guide-content strong {
		color: #10b981;
	}

	.actionable-guide .guide-content em {
		color: #f59e0b;
		font-style: normal;
		font-weight: 500;
	}

	/* GTM Overview specific */
	.gtm-overview {
		background: linear-gradient(135deg, rgba(249, 115, 22, 0.1), rgba(234, 88, 12, 0.05));
		border-color: rgba(249, 115, 22, 0.2);
	}

	.gtm-overview .summary-header .material-symbols-outlined {
		color: #f97316;
	}

	/* Value Driver Analysis */
	.value-drivers-list {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		margin-top: 1.5rem;
	}

	.value-driver-card {
		display: flex;
		align-items: stretch;
		background: var(--bg-secondary);
		border-radius: 12px;
		border: 1px solid var(--border-color);
		overflow: hidden;
		transition: all 0.3s ease;
	}

	.value-driver-card:hover {
		transform: translateX(4px);
		box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
	}

	.value-driver-card.rank-1 {
		border-left: 4px solid #10b981;
	}

	.value-driver-card.rank-2 {
		border-left: 4px solid #3b82f6;
	}

	.value-driver-card.rank-3 {
		border-left: 4px solid #8b5cf6;
	}

	.driver-rank {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 1rem;
		min-width: 80px;
		background: var(--bg-tertiary);
	}

	.rank-1 .driver-rank { background: rgba(16, 185, 129, 0.1); }
	.rank-2 .driver-rank { background: rgba(59, 130, 246, 0.1); }
	.rank-3 .driver-rank { background: rgba(139, 92, 246, 0.1); }

	.rank-number {
		font-size: 1.5rem;
		font-weight: 700;
		color: var(--text-primary);
	}

	.rank-1 .rank-number { color: #10b981; }
	.rank-2 .rank-number { color: #3b82f6; }
	.rank-3 .rank-number { color: #8b5cf6; }

	.rank-label {
		font-size: 0.65rem;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		color: var(--text-secondary);
		margin-top: 0.25rem;
	}

	.driver-content {
		flex: 1;
		padding: 1rem 1.25rem;
	}

	.driver-title {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 1rem;
		font-weight: 600;
		color: var(--text-primary);
		margin: 0 0 0.5rem 0;
	}

	.driver-title .material-symbols-outlined {
		font-size: 1.1rem;
		color: var(--accent-primary);
	}

	.driver-why {
		font-size: 0.85rem;
		color: var(--text-secondary);
		line-height: 1.5;
		margin: 0 0 0.75rem 0;
	}

	.driver-why strong {
		color: var(--text-primary);
		font-weight: 600;
	}

	.driver-metrics {
		display: flex;
		gap: 0.75rem;
		flex-wrap: wrap;
	}

	.metric-badge {
		display: flex;
		flex-direction: column;
		padding: 0.4rem 0.75rem;
		border-radius: 6px;
		font-size: 0.75rem;
	}

	.metric-badge .metric-label {
		font-size: 0.65rem;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		color: var(--text-secondary);
		margin-bottom: 0.1rem;
	}

	.metric-badge .metric-value {
		font-weight: 600;
	}

	.metric-badge.signal-strong {
		background: rgba(16, 185, 129, 0.15);
	}
	.metric-badge.signal-strong .metric-value { color: #10b981; }

	.metric-badge.signal-medium {
		background: rgba(245, 158, 11, 0.15);
	}
	.metric-badge.signal-medium .metric-value { color: #f59e0b; }

	.metric-badge.signal-weak {
		background: rgba(239, 68, 68, 0.15);
	}
	.metric-badge.signal-weak .metric-value { color: #ef4444; }

	.metric-badge.controllable-yes {
		background: rgba(59, 130, 246, 0.1);
	}
	.metric-badge.controllable-yes .metric-value { color: #3b82f6; }

	.metric-badge.controllable-partial {
		background: rgba(139, 92, 246, 0.1);
	}
	.metric-badge.controllable-partial .metric-value { color: #8b5cf6; }

	.driver-impact {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 1rem 1.25rem;
		min-width: 100px;
		background: linear-gradient(135deg, rgba(var(--accent-primary-rgb), 0.1), rgba(var(--accent-secondary-rgb), 0.15));
		border-left: 1px solid var(--border-color);
	}

	.impact-label {
		font-size: 0.65rem;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		color: var(--text-secondary);
		margin-bottom: 0.25rem;
	}

	.impact-value {
		font-size: 1.1rem;
		font-weight: 700;
		color: #10b981;
	}

	/* Decision Impact Analysis */
	.decision-scenarios {
		margin-top: 1.5rem;
	}

	.current-decision {
		background: linear-gradient(135deg, rgba(var(--accent-primary-rgb), 0.1), rgba(var(--accent-secondary-rgb), 0.1));
		border: 1px solid var(--border-color);
		border-radius: 12px;
		padding: 1rem 1.25rem;
		margin-bottom: 1.25rem;
	}

	.current-decision h4 {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.9rem;
		font-weight: 600;
		color: var(--text-primary);
		margin: 0 0 0.5rem 0;
	}

	.current-decision .material-symbols-outlined {
		color: var(--accent-primary);
		font-size: 1.1rem;
	}

	.decision-question {
		font-size: 1rem;
		font-weight: 500;
		color: var(--text-primary);
		margin: 0;
		line-height: 1.4;
	}

	.scenarios-grid {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 1rem;
		margin-bottom: 1.25rem;
	}

	.scenario-card {
		background: var(--bg-secondary);
		border-radius: 12px;
		border: 2px solid var(--border-color);
		overflow: hidden;
		transition: all 0.3s ease;
	}

	.scenario-card:hover {
		transform: translateY(-2px);
		box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
	}

	.scenario-card.act-now {
		border-color: #10b981;
	}

	.scenario-card.delay {
		border-color: #f59e0b;
	}

	.scenario-header {
		padding: 1rem 1.25rem;
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.act-now .scenario-header {
		background: rgba(16, 185, 129, 0.1);
	}

	.delay .scenario-header {
		background: rgba(245, 158, 11, 0.1);
	}

	.scenario-header .material-symbols-outlined {
		font-size: 1.25rem;
	}

	.act-now .scenario-header .material-symbols-outlined { color: #10b981; }
	.delay .scenario-header .material-symbols-outlined { color: #f59e0b; }

	.scenario-header h4 {
		margin: 0;
		font-size: 1rem;
		font-weight: 600;
	}

	.act-now .scenario-header h4 { color: #10b981; }
	.delay .scenario-header h4 { color: #f59e0b; }

	.scenario-impacts {
		padding: 1rem 1.25rem;
	}

	.impact-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.5rem 0;
		border-bottom: 1px solid var(--border-color);
	}

	.impact-row:last-child {
		border-bottom: none;
	}

	.impact-row .impact-label {
		font-size: 0.8rem;
		color: var(--text-secondary);
		text-transform: none;
		letter-spacing: normal;
	}

	.impact-row .impact-value {
		font-size: 0.85rem;
		font-weight: 600;
	}

	.impact-row .impact-value.positive { color: #10b981; }
	.impact-row .impact-value.negative { color: #ef4444; }
	.impact-row .impact-value.warning { color: #f59e0b; }
	.impact-row .impact-value.neutral { color: var(--text-secondary); }

	.decision-recommendation {
		background: linear-gradient(135deg, rgba(16, 185, 129, 0.1), rgba(16, 185, 129, 0.05));
		border: 1px solid rgba(16, 185, 129, 0.3);
		border-radius: 12px;
		padding: 1rem 1.25rem;
	}

	.decision-recommendation h4 {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.85rem;
		font-weight: 600;
		color: #10b981;
		margin: 0 0 0.5rem 0;
	}

	.decision-recommendation .material-symbols-outlined {
		font-size: 1.1rem;
	}

	.recommendation-text {
		font-size: 0.9rem;
		color: var(--text-primary);
		line-height: 1.5;
		margin: 0;
	}

	.recommendation-text strong {
		color: #10b981;
	}

	/* Trajectory & Trigger Analysis */
	.trajectory-analysis {
		margin-top: 1.5rem;
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
	}

	.trajectory-status {
		display: flex;
		align-items: flex-start;
		gap: 1rem;
		padding: 1.25rem;
		border-radius: 12px;
		border: 2px solid var(--border-color);
	}

	.trajectory-status.status-fragile {
		background: rgba(239, 68, 68, 0.08);
		border-color: #ef4444;
	}

	.trajectory-status.status-stable {
		background: rgba(59, 130, 246, 0.08);
		border-color: #3b82f6;
	}

	.trajectory-status.status-accelerating {
		background: rgba(16, 185, 129, 0.08);
		border-color: #10b981;
	}

	.status-indicator {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 48px;
		height: 48px;
		border-radius: 12px;
		flex-shrink: 0;
	}

	.status-fragile .status-indicator {
		background: rgba(239, 68, 68, 0.2);
	}
	.status-fragile .status-indicator .material-symbols-outlined { color: #ef4444; }

	.status-stable .status-indicator {
		background: rgba(59, 130, 246, 0.2);
	}
	.status-stable .status-indicator .material-symbols-outlined { color: #3b82f6; }

	.status-accelerating .status-indicator {
		background: rgba(16, 185, 129, 0.2);
	}
	.status-accelerating .status-indicator .material-symbols-outlined { color: #10b981; }

	.status-indicator .material-symbols-outlined {
		font-size: 1.5rem;
	}

	.status-content h4 {
		margin: 0 0 0.5rem 0;
		font-size: 1rem;
		color: var(--text-primary);
	}

	.trajectory-label {
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	.status-fragile .trajectory-label { color: #ef4444; }
	.status-stable .trajectory-label { color: #3b82f6; }
	.status-accelerating .trajectory-label { color: #10b981; }

	.trajectory-desc {
		font-size: 0.85rem;
		color: var(--text-secondary);
		line-height: 1.5;
		margin: 0;
	}

	.leading-indicators {
		background: var(--bg-secondary);
		border-radius: 12px;
		padding: 1.25rem;
		border: 1px solid var(--border-color);
	}

	.leading-indicators > h4 {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.9rem;
		font-weight: 600;
		color: var(--text-primary);
		margin: 0 0 1rem 0;
	}

	.leading-indicators > h4 .material-symbols-outlined {
		color: var(--accent-primary);
		font-size: 1.1rem;
	}

	.indicators-list {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.indicator-item {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.75rem;
		background: var(--bg-tertiary);
		border-radius: 8px;
	}

	.indicator-icon {
		font-size: 1rem;
	}

	.indicator-content {
		display: flex;
		flex-direction: column;
		gap: 0.1rem;
	}

	.indicator-name {
		font-size: 0.85rem;
		font-weight: 600;
		color: var(--text-primary);
	}

	.indicator-status {
		font-size: 0.75rem;
		color: var(--text-secondary);
	}

	.explicit-triggers {
		background: var(--bg-secondary);
		border-radius: 12px;
		padding: 1.25rem;
		border: 1px solid var(--border-color);
	}

	.explicit-triggers > h4 {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.9rem;
		font-weight: 600;
		color: var(--text-primary);
		margin: 0 0 1rem 0;
	}

	.explicit-triggers > h4 .material-symbols-outlined {
		color: var(--accent-primary);
		font-size: 1.1rem;
	}

	.triggers-list {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.trigger-rule {
		display: flex;
		align-items: stretch;
		background: var(--bg-tertiary);
		border-radius: 10px;
		border: 1px solid var(--border-color);
		overflow: hidden;
	}

	.trigger-rule.positive {
		border-color: rgba(16, 185, 129, 0.3);
		background: rgba(16, 185, 129, 0.05);
	}

	.trigger-condition,
	.trigger-action {
		flex: 1;
		padding: 0.75rem 1rem;
	}

	.trigger-condition {
		background: rgba(239, 68, 68, 0.08);
		border-right: 1px solid var(--border-color);
	}

	.trigger-rule.positive .trigger-condition {
		background: rgba(16, 185, 129, 0.1);
	}

	.trigger-action {
		background: rgba(59, 130, 246, 0.08);
	}

	.trigger-rule.positive .trigger-action {
		background: rgba(16, 185, 129, 0.08);
	}

	.if-label,
	.then-label {
		display: inline-block;
		font-size: 0.65rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		padding: 0.2rem 0.4rem;
		border-radius: 3px;
		margin-bottom: 0.35rem;
	}

	.if-label {
		background: rgba(239, 68, 68, 0.2);
		color: #ef4444;
	}

	.trigger-rule.positive .if-label {
		background: rgba(16, 185, 129, 0.2);
		color: #10b981;
	}

	.then-label {
		background: rgba(59, 130, 246, 0.2);
		color: #3b82f6;
	}

	.trigger-rule.positive .then-label {
		background: rgba(16, 185, 129, 0.2);
		color: #10b981;
	}

	.condition-text,
	.action-text {
		display: block;
		font-size: 0.8rem;
		color: var(--text-primary);
		line-height: 1.4;
	}

	.trigger-arrow {
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 0 0.5rem;
		font-size: 1.25rem;
		font-weight: 700;
		color: var(--text-secondary);
		background: var(--bg-secondary);
	}

	.inaction-warning {
		display: flex;
		align-items: flex-start;
		gap: 0.75rem;
		padding: 1rem 1.25rem;
		background: rgba(239, 68, 68, 0.08);
		border: 1px solid rgba(239, 68, 68, 0.3);
		border-radius: 10px;
	}

	.inaction-warning .material-symbols-outlined {
		color: #ef4444;
		font-size: 1.25rem;
		flex-shrink: 0;
	}

	.inaction-warning h4 {
		margin: 0 0 0.35rem 0;
		font-size: 0.85rem;
		font-weight: 600;
		color: #ef4444;
	}

	.inaction-warning p {
		margin: 0;
		font-size: 0.8rem;
		color: var(--text-secondary);
		line-height: 1.4;
	}

	/* Responsive adjustments for new methodologies */
	@media (max-width: 992px) {
		.decision-impact-grid {
			grid-template-columns: 1fr;
		}
		
		.triggers-grid {
			grid-template-columns: 1fr;
		}

		.scenarios-grid {
			grid-template-columns: 1fr;
		}

		.value-driver-card {
			flex-direction: column;
		}

		.driver-rank {
			flex-direction: row;
			justify-content: flex-start;
			gap: 0.75rem;
			min-width: auto;
		}

		.driver-impact {
			flex-direction: row;
			justify-content: space-between;
			border-left: none;
			border-top: 1px solid var(--border-color);
		}
	}

	@media (max-width: 768px) {
		.value-tree-container {
			padding: 1rem;
		}
		
		.tree-level {
			flex-direction: column;
			align-items: center;
		}
		
		.primary-node {
			max-width: 100%;
			width: 100%;
		}
		
		.secondary-level {
			flex-direction: column;
		}
		
		.tree-formula {
			transform: rotate(90deg);
		}
		
		.curve-phases {
			flex-direction: column;
			gap: 0;
		}
		
		.phase-connector {
			width: 3px;
			height: 30px;
			margin: -5px 0;
		}
		
		.trigger-item {
			flex-wrap: wrap;
			gap: 0.5rem;
		}
		
		.trigger-text {
			width: 100%;
			order: 3;
		}
	}

	/* ========================================
	   STRATEGIC ADVISOR TAB STYLES
	   ======================================== */

	/* ========================================
	   STRATEGIC ADVISOR - CLEAN CARD DESIGN
	   ======================================== */
	.advisor-page {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
		max-width: 900px;
		margin: 0 auto;
		padding: 1rem;
	}

	.advisor-card {
		background: #ffffff;
		border-radius: 16px;
		border: 1px solid #e5e7eb;
		box-shadow: 0 4px 20px rgba(0, 0, 0, 0.06);
		min-height: 400px;
		max-height: 55vh;
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	[data-theme='dark'] .advisor-card {
		background: #1f2937;
		border-color: #374151;
	}

	.advisor-chat-container {
		flex: 1;
		overflow-y: auto;
		padding: 2rem;
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
	}

	/* Empty State */
	.advisor-empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		height: 100%;
		text-align: center;
		padding: 3rem;
	}

	.advisor-empty-state .empty-icon {
		width: 80px;
		height: 80px;
		background: linear-gradient(135deg, #e0e7ff, #c7d2fe);
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		margin-bottom: 1.5rem;
	}

	.advisor-empty-state .empty-icon .material-symbols-outlined {
		font-size: 40px;
		color: #6366f1;
	}

	.advisor-empty-state h2 {
		font-size: 1.5rem;
		font-weight: 700;
		color: #1f2937;
		margin: 0 0 0.5rem 0;
	}

	[data-theme='dark'] .advisor-empty-state h2 {
		color: #f9fafb;
	}

	.advisor-empty-state p {
		font-size: 1rem;
		color: #6b7280;
		margin: 0;
		max-width: 400px;
		line-height: 1.6;
	}

	[data-theme='dark'] .advisor-empty-state p {
		color: #9ca3af;
	}

	/* Chat Bubbles */
	.chat-bubble {
		display: flex;
		animation: bubbleFadeIn 0.3s ease;
	}

	@keyframes bubbleFadeIn {
		from { opacity: 0; transform: translateY(10px); }
		to { opacity: 1; transform: translateY(0); }
	}

	.chat-bubble.user {
		justify-content: flex-end;
	}

	.chat-bubble.assistant {
		justify-content: flex-start;
	}

	.bubble-content {
		max-width: 80%;
		padding: 1rem 1.25rem;
		border-radius: 16px;
		line-height: 1.7;
	}

	.user-bubble {
		background: #6366f1;
		color: white;
		border-bottom-right-radius: 4px;
	}

	.user-bubble .bubble-text {
		font-size: 1rem;
		margin: 0;
	}

	.assistant-bubble {
		background: #f3f4f6;
		color: #1f2937;
		border-bottom-left-radius: 4px;
	}

	[data-theme='dark'] .assistant-bubble {
		background: #374151;
		color: #f9fafb;
	}

	.bubble-header {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		margin-bottom: 0.5rem;
	}

	.advisor-label {
		font-size: 0.8rem;
		font-weight: 600;
		color: #6366f1;
	}

	.saved-tag {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		background: rgba(16, 185, 129, 0.15);
		color: #059669;
		font-size: 0.7rem;
		font-weight: 600;
		padding: 0.2rem 0.6rem;
		border-radius: 12px;
	}

	.saved-tag .material-symbols-outlined {
		font-size: 14px;
	}

	.assistant-bubble .bubble-text {
		font-size: 1rem;
		line-height: 1.8;
	}

	.assistant-bubble .bubble-text strong {
		color: #4f46e5;
		font-weight: 600;
	}

	[data-theme='dark'] .assistant-bubble .bubble-text strong {
		color: #818cf8;
	}

	.assistant-bubble .bubble-text em {
		color: #f59e0b;
		font-style: normal;
	}

	/* Typing Dots */
	.typing-dots {
		display: flex;
		gap: 6px;
		padding: 0.25rem 0;
	}

	.typing-dots span {
		width: 10px;
		height: 10px;
		background: #9ca3af;
		border-radius: 50%;
		animation: dotPulse 1.4s infinite ease-in-out;
	}

	.typing-dots span:nth-child(2) { animation-delay: 0.2s; }
	.typing-dots span:nth-child(3) { animation-delay: 0.4s; }

	@keyframes dotPulse {
		0%, 60%, 100% { transform: scale(0.8); opacity: 0.5; }
		30% { transform: scale(1.2); opacity: 1; }
	}

	/* Quick Action Buttons - 2x2 Grid */
	.advisor-quick-actions {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 0.75rem;
	}

	.quick-action-btn {
		padding: 1rem 1.25rem;
		background: #ffffff;
		border: 1px solid #e5e7eb;
		border-radius: 12px;
		font-size: 0.9rem;
		color: #374151;
		cursor: pointer;
		transition: all 0.2s ease;
		text-align: left;
		white-space: normal;
		line-height: 1.5;
	}

	[data-theme='dark'] .quick-action-btn {
		background: #374151;
		border-color: #4b5563;
		color: #e5e7eb;
	}

	.quick-action-btn:hover:not(:disabled) {
		background: #6366f1;
		border-color: #6366f1;
		color: white;
		transform: translateY(-2px);
		box-shadow: 0 4px 12px rgba(99, 102, 241, 0.25);
	}

	.quick-action-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	/* Input Bar */
	.advisor-input-bar {
		display: flex;
		gap: 0.75rem;
		background: #ffffff;
		border: 1px solid #e5e7eb;
		border-radius: 28px;
		padding: 0.5rem 0.5rem 0.5rem 1.5rem;
		box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
	}

	[data-theme='dark'] .advisor-input-bar {
		background: #1f2937;
		border-color: #374151;
	}

	.advisor-input {
		flex: 1;
		border: none;
		outline: none;
		background: transparent;
		font-size: 1rem;
		color: #1f2937;
	}

	[data-theme='dark'] .advisor-input {
		color: #f9fafb;
	}

	.advisor-input::placeholder {
		color: #9ca3af;
	}

	.advisor-send-btn {
		width: 44px;
		height: 44px;
		background: #6366f1;
		border: none;
		border-radius: 50%;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: all 0.2s ease;
		flex-shrink: 0;
	}

	.advisor-send-btn:hover:not(:disabled) {
		background: #4f46e5;
		transform: scale(1.05);
	}

	.advisor-send-btn:disabled {
		background: #d1d5db;
		cursor: not-allowed;
	}

	[data-theme='dark'] .advisor-send-btn:disabled {
		background: #4b5563;
	}

	.advisor-send-btn .material-symbols-outlined {
		font-size: 22px;
		color: white;
	}

	/* Footer Note */
	.advisor-footer-note {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.4rem;
		font-size: 0.8rem;
		color: #9ca3af;
		margin: 0;
	}

	.advisor-footer-note .material-symbols-outlined {
		font-size: 16px;
	}

	@media (max-width: 768px) {
		.advisor-page {
			padding: 0.5rem;
		}
		
		.advisor-card {
			min-height: 300px;
		}
		
		.advisor-quick-actions {
			grid-template-columns: 1fr;
		}
		
		.quick-action-btn {
			font-size: 0.85rem;
			padding: 0.85rem 1rem;
		}
		
		.bubble-content {
			max-width: 90%;
		}
	}

	.input-container {
		display: flex;
		gap: 0.75rem;
	}

	.advisor-input-area input {
		flex: 1;
		padding: 1rem 1.5rem;
		background: var(--bg-secondary);
		border: 1px solid var(--border-color);
		border-radius: 12px;
		font-size: 1rem;
		color: var(--text-primary);
		transition: all 0.2s ease;
	}

	.advisor-input-area input:focus {
		outline: none;
		border-color: #6366f1;
		box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
	}

	.advisor-input-area input::placeholder {
		color: var(--text-tertiary);
	}

	.send-btn {
		width: 52px;
		height: 52px;
		background: linear-gradient(135deg, #6366f1, #8b5cf6);
		border: none;
		border-radius: 12px;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: all 0.2s ease;
		flex-shrink: 0;
	}

	.send-btn:hover:not(:disabled) {
		transform: scale(1.05);
		box-shadow: 0 4px 15px rgba(99, 102, 241, 0.4);
	}

	.send-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.send-btn .material-symbols-outlined {
		font-size: 24px;
		color: white;
	}

	.input-hint {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		margin: 0.75rem 0 0 0;
		font-size: 0.75rem;
		color: var(--text-tertiary);
	}

	.input-hint .material-symbols-outlined {
		font-size: 14px;
	}

	/* ========================================
	   GTM TAB STYLES
	   ======================================== */

	.gtm-section {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	.gtm-header {
		background: linear-gradient(135deg, rgba(139, 92, 246, 0.1), rgba(59, 130, 246, 0.1));
		border: 1px solid rgba(139, 92, 246, 0.3);
	}

	.gtm-header-content {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		flex-wrap: wrap;
		gap: 1.5rem;
	}

	.gtm-title-section {
		display: flex;
		align-items: center;
		gap: 1rem;
	}

	.gtm-icon {
		font-size: 2.5rem;
		color: #8b5cf6;
	}

	.gtm-title {
		font-size: 1.75rem;
		font-weight: 700;
		color: var(--text-primary);
		margin: 0;
	}

	.gtm-subtitle {
		font-size: 0.9rem;
		color: var(--text-secondary);
		margin: 0.25rem 0 0 0;
	}

	.gtm-philosophy {
		display: flex;
		gap: 1.5rem;
		flex-wrap: wrap;
	}

	.philosophy-item {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		padding: 0.75rem 1rem;
		background: var(--bg-tertiary);
		border-radius: 8px;
		border: 1px solid var(--border-color);
	}

	.philosophy-label {
		font-size: 0.7rem;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		color: var(--text-secondary);
	}

	.philosophy-value {
		font-size: 0.85rem;
		font-weight: 600;
		color: #8b5cf6;
	}

	/* GTM State Card */
	.gtm-state-card {
		border-left: 4px solid #3b82f6;
	}

	.gtm-state-grid {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 1rem;
		margin-top: 1.25rem;
	}

	.state-item {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		padding: 1rem;
		background: var(--bg-tertiary);
		border-radius: 10px;
		border: 1px solid var(--border-color);
	}

	.state-label {
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		color: var(--text-secondary);
	}

	.state-value {
		font-size: 1.1rem;
		font-weight: 600;
		color: var(--text-primary);
	}

	.state-value.stage-pre-revenue {
		color: #f59e0b;
	}

	.state-value.stage-early-traction {
		color: #3b82f6;
	}

	.state-value.stage-scaling {
		color: #10b981;
	}

	.state-value.traction {
		font-size: 0.95rem;
	}

	.gtm-constraint-warning {
		display: flex;
		align-items: flex-start;
		gap: 0.75rem;
		margin-top: 1.25rem;
		padding: 1rem;
		background: rgba(245, 158, 11, 0.1);
		border: 1px solid rgba(245, 158, 11, 0.3);
		border-radius: 10px;
	}

	.gtm-constraint-warning .material-symbols-outlined {
		color: #f59e0b;
		font-size: 1.25rem;
		flex-shrink: 0;
	}

	.gtm-constraint-warning strong {
		color: #f59e0b;
	}

	/* Hypothesis Cards */
	.hypothesis-limit,
	.decision-badge,
	.slides-badge,
	.metrics-badge {
		padding: 0.35rem 0.75rem;
		background: rgba(139, 92, 246, 0.15);
		color: #8b5cf6;
		font-size: 0.75rem;
		font-weight: 600;
		border-radius: 20px;
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	.hypotheses-grid {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 1.25rem;
		margin-top: 1.25rem;
	}

	.hypothesis-card {
		background: var(--bg-secondary);
		border-radius: 12px;
		border: 2px solid var(--border-color);
		overflow: hidden;
		transition: all 0.3s ease;
	}

	.hypothesis-card:hover {
		transform: translateY(-2px);
		box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
	}

	.hypothesis-card.active {
		border-color: #10b981;
	}

	.hypothesis-card.queued {
		border-color: #f59e0b;
		opacity: 0.85;
	}

	.hypothesis-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 1rem 1.25rem;
		background: var(--bg-tertiary);
	}

	.hypothesis-id {
		font-size: 1.25rem;
		font-weight: 700;
		color: var(--text-primary);
	}

	.hypothesis-status {
		font-size: 0.75rem;
		font-weight: 600;
		padding: 0.25rem 0.75rem;
		border-radius: 20px;
	}

	.status-active {
		background: rgba(16, 185, 129, 0.15);
		color: #10b981;
	}

	.status-queued {
		background: rgba(245, 158, 11, 0.15);
		color: #f59e0b;
	}

	.hypothesis-content {
		padding: 1.25rem;
	}

	.hypothesis-field {
		margin-bottom: 0.75rem;
	}

	.field-label {
		display: block;
		font-size: 0.7rem;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		color: var(--text-secondary);
		margin-bottom: 0.25rem;
	}

	.field-value {
		font-size: 0.9rem;
		color: var(--text-primary);
		line-height: 1.4;
	}

	.hypothesis-metrics {
		display: flex;
		gap: 0.75rem;
		margin: 1rem 0;
		flex-wrap: wrap;
	}

	.hypothesis-metrics .metric {
		display: flex;
		flex-direction: column;
		padding: 0.5rem 0.75rem;
		background: var(--bg-tertiary);
		border-radius: 6px;
		flex: 1;
		min-width: 80px;
	}

	.hypothesis-metrics .metric-label {
		font-size: 0.65rem;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		color: var(--text-secondary);
	}

	.hypothesis-metrics .metric-value {
		font-size: 0.85rem;
		font-weight: 600;
		color: var(--text-primary);
	}

	.confidence-high { color: #10b981 !important; }
	.confidence-medium { color: #f59e0b !important; }
	.confidence-low { color: #ef4444 !important; }

	.hypothesis-signal {
		padding: 0.75rem;
		background: rgba(59, 130, 246, 0.1);
		border-radius: 8px;
		margin-top: 0.75rem;
	}

	.signal-label {
		display: block;
		font-size: 0.7rem;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		color: #3b82f6;
		margin-bottom: 0.25rem;
	}

	.signal-value {
		font-size: 0.85rem;
		color: var(--text-primary);
		font-weight: 500;
	}

	.hypothesis-why {
		padding: 1rem 1.25rem;
		background: var(--bg-tertiary);
		font-size: 0.85rem;
		color: var(--text-secondary);
		line-height: 1.5;
	}

	.hypothesis-why strong {
		color: var(--text-primary);
	}

	/* GTM Decisions */
	.gtm-decisions-card {
		border-left: 4px solid #ef4444;
	}

	.decisions-grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 1rem;
		margin-top: 1.25rem;
	}

	.decision-card {
		background: var(--bg-secondary);
		border-radius: 12px;
		border: 2px solid var(--border-color);
		overflow: hidden;
	}

	.decision-card.double-down {
		border-color: #10b981;
	}

	.decision-card.pause {
		border-color: #f59e0b;
	}

	.decision-card.kill {
		border-color: #ef4444;
	}

	.decision-header {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.75rem 1rem;
	}

	.double-down .decision-header {
		background: rgba(16, 185, 129, 0.1);
	}

	.double-down .decision-header .material-symbols-outlined,
	.double-down .decision-header h4 {
		color: #10b981;
	}

	.pause .decision-header {
		background: rgba(245, 158, 11, 0.1);
	}

	.pause .decision-header .material-symbols-outlined,
	.pause .decision-header h4 {
		color: #f59e0b;
	}

	.kill .decision-header {
		background: rgba(239, 68, 68, 0.1);
	}

	.kill .decision-header .material-symbols-outlined,
	.kill .decision-header h4 {
		color: #ef4444;
	}

	.decision-header h4 {
		margin: 0;
		font-size: 1rem;
		font-weight: 600;
	}

	.decision-content {
		padding: 1rem;
	}

	.decision-what {
		font-size: 0.9rem;
		color: var(--text-primary);
		margin-bottom: 0.75rem;
	}

	.decision-evidence {
		padding: 0.75rem;
		background: var(--bg-tertiary);
		border-radius: 8px;
		margin-bottom: 0.75rem;
	}

	.evidence-label {
		display: block;
		font-size: 0.65rem;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		color: var(--text-secondary);
		margin-bottom: 0.25rem;
	}

	.evidence-value {
		font-size: 0.8rem;
		color: var(--text-primary);
		line-height: 1.4;
	}

	.decision-impact {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.decision-impact .impact-item {
		display: flex;
		justify-content: space-between;
		font-size: 0.8rem;
	}

	.decision-impact .impact-label {
		color: var(--text-secondary);
	}

	.decision-impact .impact-value {
		font-weight: 600;
		color: var(--text-primary);
	}

	.decision-impact .impact-value.positive {
		color: #10b981;
	}

	/* ========================================
	   GTM TRACKABLE DECISIONS SYSTEM
	   ======================================== */
	
	.decisions-grid-enhanced {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 1.25rem;
		margin-top: 1.25rem;
	}

	.decision-card-enhanced {
		background: var(--bg-secondary);
		border-radius: 16px;
		border: 2px solid var(--border-color);
		overflow: hidden;
		transition: all 0.3s ease;
		position: relative;
	}

	.decision-card-enhanced:hover {
		transform: translateY(-2px);
		box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15);
	}

	.decision-card-enhanced.h1 {
		border-color: #10b981;
	}

	.decision-card-enhanced.h2 {
		border-color: #f59e0b;
	}

	.decision-card-enhanced.h3 {
		border-color: #ef4444;
	}

	.decision-card-enhanced .card-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 1rem 1.25rem;
		gap: 0.75rem;
	}

	.decision-card-enhanced.h1 .card-header {
		background: linear-gradient(135deg, rgba(16, 185, 129, 0.15), rgba(16, 185, 129, 0.05));
	}

	.decision-card-enhanced.h2 .card-header {
		background: linear-gradient(135deg, rgba(245, 158, 11, 0.15), rgba(245, 158, 11, 0.05));
	}

	.decision-card-enhanced.h3 .card-header {
		background: linear-gradient(135deg, rgba(239, 68, 68, 0.15), rgba(239, 68, 68, 0.05));
	}

	.header-left {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.horizon-badge {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 0.25rem 0.6rem;
		border-radius: 6px;
		font-size: 0.7rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	.horizon-badge.h1 {
		background: #10b981;
		color: white;
	}

	.horizon-badge.h2 {
		background: #f59e0b;
		color: white;
	}

	.horizon-badge.h3 {
		background: #ef4444;
		color: white;
	}

	.card-title-text {
		font-size: 1rem;
		font-weight: 700;
		color: var(--text-primary);
		margin: 0;
	}

	.decision-card-enhanced.h1 .card-title-text {
		color: #10b981;
	}

	.decision-card-enhanced.h2 .card-title-text {
		color: #f59e0b;
	}

	.decision-card-enhanced.h3 .card-title-text {
		color: #ef4444;
	}

	.source-badge {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		padding: 0.2rem 0.6rem;
		border-radius: 12px;
		font-size: 0.65rem;
		font-weight: 600;
		text-transform: uppercase;
	}

	.source-badge.ai-badge {
		background: linear-gradient(135deg, #8b5cf6, #6366f1);
		color: white;
	}

	.source-badge.ai-badge .material-symbols-outlined {
		font-size: 0.75rem;
	}

	.source-badge.user-badge {
		background: linear-gradient(135deg, #3b82f6, #0ea5e9);
		color: white;
	}

	.card-body-enhanced {
		padding: 1.25rem;
	}

	.decision-what-enhanced {
		font-size: 0.95rem;
		font-weight: 600;
		color: var(--text-primary);
		margin-bottom: 1rem;
		line-height: 1.5;
	}

	.decision-details {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
		margin-bottom: 1rem;
		padding: 0.75rem;
		background: var(--bg-tertiary);
		border-radius: 10px;
	}

	.detail-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		font-size: 0.8rem;
	}

	.detail-label {
		color: var(--text-secondary);
	}

	.detail-value {
		font-weight: 600;
		color: var(--text-primary);
	}

	.detail-value.metric {
		color: #8b5cf6;
	}

	.milestones-preview {
		margin-bottom: 1rem;
	}

	.milestones-title {
		font-size: 0.7rem;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		color: var(--text-secondary);
		margin-bottom: 0.5rem;
	}

	.milestone-list {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}

	.milestone-item {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.8rem;
		color: var(--text-secondary);
	}

	.milestone-item .material-symbols-outlined {
		font-size: 0.9rem;
		color: var(--text-tertiary);
	}

	.card-actions {
		padding: 1rem 1.25rem;
		border-top: 1px solid var(--border-color);
		background: var(--bg-tertiary);
	}

	.action-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		width: 100%;
		padding: 0.75rem 1rem;
		border: none;
		border-radius: 10px;
		font-size: 0.85rem;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.action-btn .material-symbols-outlined {
		font-size: 1.1rem;
	}

	.action-btn.track-btn {
		background: linear-gradient(135deg, #10b981, #059669);
		color: white;
	}

	.action-btn.track-btn:hover {
		background: linear-gradient(135deg, #059669, #047857);
		transform: translateY(-1px);
	}

	.action-btn.review-btn {
		background: linear-gradient(135deg, #f59e0b, #d97706);
		color: white;
	}

	.action-btn.review-btn:hover {
		background: linear-gradient(135deg, #d97706, #b45309);
		transform: translateY(-1px);
	}

	.action-btn.add-btn {
		background: linear-gradient(135deg, #ef4444, #dc2626);
		color: white;
	}

	.action-btn.add-btn:hover {
		background: linear-gradient(135deg, #dc2626, #b91c1c);
		transform: translateY(-1px);
	}

	.tracking-status {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.6rem 1rem;
		background: rgba(16, 185, 129, 0.1);
		border-radius: 8px;
		font-size: 0.8rem;
		color: #10b981;
		font-weight: 600;
	}

	.tracking-status .material-symbols-outlined {
		font-size: 1rem;
	}

	/* H3 Kill List */
	.h3-list {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		margin-bottom: 1rem;
	}

	.h3-item {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.75rem;
		background: var(--bg-tertiary);
		border-radius: 8px;
		font-size: 0.85rem;
	}

	.h3-item .material-symbols-outlined {
		color: #ef4444;
		font-size: 1rem;
	}

	.h3-item-text {
		flex: 1;
		color: var(--text-primary);
	}

	.h3-item-reason {
		font-size: 0.75rem;
		color: var(--text-secondary);
	}

	.h3-empty {
		text-align: center;
		padding: 2rem 1rem;
		color: var(--text-secondary);
		font-size: 0.85rem;
	}

	.h3-empty .material-symbols-outlined {
		font-size: 2rem;
		color: var(--text-tertiary);
		margin-bottom: 0.5rem;
		display: block;
	}

	/* Active GTM Tasks Section */
	.active-gtm-tasks {
		margin-top: 2rem;
		padding: 1.5rem;
		background: var(--bg-secondary);
		border-radius: 16px;
		border: 1px solid var(--border-color);
	}

	.active-tasks-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 1.25rem;
	}

	.active-tasks-title {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.active-tasks-title .material-symbols-outlined {
		font-size: 1.5rem;
		color: #8b5cf6;
	}

	.active-tasks-title h3 {
		margin: 0;
		font-size: 1.1rem;
		color: var(--text-primary);
	}

	.task-count-badge {
		background: #8b5cf6;
		color: white;
		padding: 0.2rem 0.6rem;
		border-radius: 12px;
		font-size: 0.75rem;
		font-weight: 600;
	}

	.active-tasks-list {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.active-task-card {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		padding: 1.25rem;
		background: var(--bg-tertiary);
		border-radius: 12px;
		border-left: 4px solid #8b5cf6;
		transition: all 0.2s ease;
	}

	.active-task-card:hover {
		background: var(--bg-hover);
	}

	.task-card-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
	}

	.task-info {
		flex: 1;
	}

	.task-type-badge {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		padding: 0.2rem 0.5rem;
		border-radius: 4px;
		font-size: 0.65rem;
		font-weight: 600;
		text-transform: uppercase;
		margin-bottom: 0.5rem;
	}

	.task-type-badge.h1-task {
		background: rgba(16, 185, 129, 0.15);
		color: #10b981;
	}

	.task-type-badge.h2-task {
		background: rgba(245, 158, 11, 0.15);
		color: #f59e0b;
	}

	.task-title {
		font-size: 0.95rem;
		font-weight: 600;
		color: var(--text-primary);
		margin-bottom: 0.25rem;
	}

	.task-metric {
		font-size: 0.8rem;
		color: var(--text-secondary);
	}

	.task-days-remaining {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 0.25rem;
	}

	.days-count {
		font-size: 1.5rem;
		font-weight: 700;
		color: #8b5cf6;
	}

	.days-label {
		font-size: 0.7rem;
		color: var(--text-secondary);
		text-transform: uppercase;
	}

	.task-progress-section {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.progress-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		font-size: 0.8rem;
	}

	.progress-label {
		color: var(--text-secondary);
	}

	.progress-value {
		font-weight: 600;
		color: #8b5cf6;
	}

	.progress-bar-container {
		height: 8px;
		background: var(--bg-secondary);
		border-radius: 4px;
		overflow: hidden;
	}

	.progress-bar-fill {
		height: 100%;
		background: linear-gradient(90deg, #8b5cf6, #6366f1);
		border-radius: 4px;
		transition: width 0.3s ease;
	}

	.task-last-followup {
		display: flex;
		align-items: flex-start;
		gap: 0.75rem;
		padding: 0.75rem;
		background: rgba(139, 92, 246, 0.1);
		border-radius: 8px;
	}

	.task-last-followup .material-symbols-outlined {
		font-size: 1.25rem;
		color: #8b5cf6;
	}

	.followup-content {
		flex: 1;
	}

	.followup-label {
		font-size: 0.7rem;
		text-transform: uppercase;
		color: var(--text-secondary);
		margin-bottom: 0.25rem;
	}

	.followup-message {
		font-size: 0.85rem;
		color: var(--text-primary);
		line-height: 1.4;
	}

	.task-actions {
		display: flex;
		gap: 0.75rem;
	}

	.task-action-btn {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		padding: 0.6rem 1rem;
		border: none;
		border-radius: 8px;
		font-size: 0.8rem;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.task-action-btn.update-btn {
		background: #8b5cf6;
		color: white;
	}

	.task-action-btn.update-btn:hover {
		background: #7c3aed;
	}

	.task-action-btn.complete-btn {
		background: #10b981;
		color: white;
	}

	.task-action-btn.complete-btn:hover {
		background: #059669;
	}

	.no-active-tasks {
		text-align: center;
		padding: 2rem;
		color: var(--text-secondary);
	}

	.no-active-tasks .material-symbols-outlined {
		font-size: 3rem;
		color: var(--text-tertiary);
		margin-bottom: 0.75rem;
		display: block;
	}

	/* GTM Modals */
	.gtm-modal-overlay {
		position: fixed;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		background: rgba(0, 0, 0, 0.6);
		backdrop-filter: blur(4px);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1000;
		animation: fadeIn 0.2s ease;
	}

	.gtm-modal {
		background: var(--bg-primary);
		border-radius: 20px;
		max-width: 500px;
		width: 90%;
		max-height: 90vh;
		overflow-y: auto;
		box-shadow: 0 25px 50px rgba(0, 0, 0, 0.25);
		animation: slideUp 0.3s ease;
	}

	.gtm-modal-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 1.5rem;
		border-bottom: 1px solid var(--border-color);
	}

	.gtm-modal-header h3 {
		margin: 0;
		font-size: 1.25rem;
		color: var(--text-primary);
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.gtm-modal-header h3 .material-symbols-outlined {
		font-size: 1.5rem;
		color: #8b5cf6;
	}

	.modal-close-btn {
		background: none;
		border: none;
		padding: 0.5rem;
		cursor: pointer;
		color: var(--text-secondary);
		border-radius: 8px;
		transition: all 0.2s ease;
	}

	.modal-close-btn:hover {
		background: var(--bg-tertiary);
		color: var(--text-primary);
	}

	.gtm-modal-body {
		padding: 1.5rem;
	}

	.commitment-section {
		margin-bottom: 1.5rem;
	}

	.commitment-title {
		font-size: 0.9rem;
		font-weight: 600;
		color: var(--text-primary);
		margin-bottom: 0.75rem;
	}

	.commitment-list {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.commitment-item {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.75rem 1rem;
		background: var(--bg-tertiary);
		border-radius: 8px;
		font-size: 0.85rem;
		color: var(--text-primary);
	}

	.commitment-item .material-symbols-outlined {
		font-size: 1.1rem;
		color: #10b981;
	}

	.ai-welcome-message {
		padding: 1rem;
		background: linear-gradient(135deg, rgba(139, 92, 246, 0.1), rgba(99, 102, 241, 0.1));
		border-radius: 12px;
		border-left: 4px solid #8b5cf6;
		margin-bottom: 1.5rem;
	}

	.ai-welcome-header {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-bottom: 0.5rem;
	}

	.ai-welcome-header .material-symbols-outlined {
		font-size: 1.25rem;
		color: #8b5cf6;
	}

	.ai-welcome-header span {
		font-size: 0.8rem;
		font-weight: 600;
		color: #8b5cf6;
	}

	.ai-welcome-text {
		font-size: 0.9rem;
		color: var(--text-primary);
		line-height: 1.5;
	}

	.gtm-modal-footer {
		padding: 1.5rem;
		border-top: 1px solid var(--border-color);
		display: flex;
		gap: 1rem;
	}

	.modal-btn {
		flex: 1;
		padding: 0.85rem 1.5rem;
		border: none;
		border-radius: 10px;
		font-size: 0.9rem;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.modal-btn.cancel-btn {
		background: var(--bg-tertiary);
		color: var(--text-primary);
	}

	.modal-btn.cancel-btn:hover {
		background: var(--bg-hover);
	}

	.modal-btn.confirm-btn {
		background: linear-gradient(135deg, #8b5cf6, #6366f1);
		color: white;
	}

	.modal-btn.confirm-btn:hover {
		background: linear-gradient(135deg, #7c3aed, #4f46e5);
	}

	/* Progress Update Modal */
	.progress-update-section {
		margin-bottom: 1.5rem;
	}

	.progress-slider-label {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 0.75rem;
	}

	.slider-title {
		font-size: 0.9rem;
		font-weight: 600;
		color: var(--text-primary);
	}

	.slider-value {
		font-size: 1.25rem;
		font-weight: 700;
		color: #8b5cf6;
	}

	.progress-slider {
		width: 100%;
		height: 8px;
		-webkit-appearance: none;
		appearance: none;
		background: var(--bg-tertiary);
		border-radius: 4px;
		outline: none;
	}

	.progress-slider::-webkit-slider-thumb {
		-webkit-appearance: none;
		appearance: none;
		width: 20px;
		height: 20px;
		background: #8b5cf6;
		border-radius: 50%;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.progress-slider::-webkit-slider-thumb:hover {
		transform: scale(1.1);
	}

	.note-section {
		margin-bottom: 1.5rem;
	}

	.note-label {
		display: block;
		font-size: 0.9rem;
		font-weight: 600;
		color: var(--text-primary);
		margin-bottom: 0.75rem;
	}

	.note-textarea {
		width: 100%;
		min-height: 100px;
		padding: 1rem;
		border: 1px solid var(--border-color);
		border-radius: 10px;
		background: var(--bg-secondary);
		color: var(--text-primary);
		font-size: 0.9rem;
		resize: vertical;
		outline: none;
		transition: border-color 0.2s ease;
	}

	.note-textarea:focus {
		border-color: #8b5cf6;
	}

	/* H3 Kill Modal */
	.h3-form-group {
		margin-bottom: 1.25rem;
	}

	.h3-form-label {
		display: block;
		font-size: 0.85rem;
		font-weight: 600;
		color: var(--text-primary);
		margin-bottom: 0.5rem;
	}

	.h3-form-input {
		width: 100%;
		padding: 0.85rem 1rem;
		border: 1px solid var(--border-color);
		border-radius: 10px;
		background: var(--bg-secondary);
		color: var(--text-primary);
		font-size: 0.9rem;
		outline: none;
		transition: border-color 0.2s ease;
	}

	.h3-form-input:focus {
		border-color: #ef4444;
	}

	.modal-btn.danger-btn {
		background: linear-gradient(135deg, #ef4444, #dc2626);
		color: white;
	}

	.modal-btn.danger-btn:hover {
		background: linear-gradient(135deg, #dc2626, #b91c1c);
	}

	/* Followup Notification Banner */
	.followup-notification {
		display: flex;
		align-items: center;
		gap: 1rem;
		padding: 1rem 1.25rem;
		background: linear-gradient(135deg, rgba(139, 92, 246, 0.15), rgba(99, 102, 241, 0.1));
		border-radius: 12px;
		border: 1px solid rgba(139, 92, 246, 0.3);
		margin-bottom: 1.5rem;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.followup-notification:hover {
		background: linear-gradient(135deg, rgba(139, 92, 246, 0.2), rgba(99, 102, 241, 0.15));
	}

	.followup-notification .material-symbols-outlined {
		font-size: 1.75rem;
		color: #8b5cf6;
	}

	.followup-notification-content {
		flex: 1;
	}

	.followup-notification-title {
		font-size: 0.95rem;
		font-weight: 600;
		color: var(--text-primary);
		margin-bottom: 0.25rem;
	}

	.followup-notification-text {
		font-size: 0.85rem;
		color: var(--text-secondary);
	}

	.followup-notification-action {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		color: #8b5cf6;
		font-size: 0.85rem;
		font-weight: 600;
	}

	/* Decision Card Header Enhanced */
	.decision-header-enhanced {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 1rem 1.25rem;
		background: var(--bg-tertiary);
	}

	.decision-card-enhanced.double-down .decision-header-enhanced {
		background: linear-gradient(135deg, rgba(16, 185, 129, 0.15), rgba(16, 185, 129, 0.05));
	}

	.decision-card-enhanced.pause .decision-header-enhanced {
		background: linear-gradient(135deg, rgba(245, 158, 11, 0.15), rgba(245, 158, 11, 0.05));
	}

	.decision-card-enhanced.kill .decision-header-enhanced {
		background: linear-gradient(135deg, rgba(239, 68, 68, 0.15), rgba(239, 68, 68, 0.05));
	}

	.decision-header-enhanced h4 {
		margin: 0;
		font-size: 1rem;
		font-weight: 600;
		flex: 1;
	}

	.decision-card-enhanced.double-down .decision-header-enhanced h4,
	.decision-card-enhanced.double-down .decision-header-enhanced .material-symbols-outlined {
		color: #10b981;
	}

	.decision-card-enhanced.pause .decision-header-enhanced h4,
	.decision-card-enhanced.pause .decision-header-enhanced .material-symbols-outlined {
		color: #f59e0b;
	}

	.decision-card-enhanced.kill .decision-header-enhanced h4,
	.decision-card-enhanced.kill .decision-header-enhanced .material-symbols-outlined {
		color: #ef4444;
	}

	.ai-badge {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		padding: 0.2rem 0.5rem;
		background: linear-gradient(135deg, #8b5cf6, #6366f1);
		color: white;
		border-radius: 10px;
		font-size: 0.6rem;
		font-weight: 600;
		text-transform: uppercase;
	}

	.user-badge {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		padding: 0.2rem 0.5rem;
		background: linear-gradient(135deg, #3b82f6, #0ea5e9);
		color: white;
		border-radius: 10px;
		font-size: 0.6rem;
		font-weight: 600;
		text-transform: uppercase;
	}

	.decision-title {
		font-size: 0.95rem;
		font-weight: 600;
		color: var(--text-primary);
		padding: 1rem 1.25rem 0.5rem;
		margin: 0;
	}

	.decision-description {
		font-size: 0.85rem;
		color: var(--text-secondary);
		padding: 0 1.25rem;
		margin: 0;
		line-height: 1.5;
	}

	.target-section {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.75rem 1.25rem;
		margin: 0.75rem 1.25rem;
		background: var(--bg-tertiary);
		border-radius: 8px;
		font-size: 0.85rem;
	}

	.target-label {
		color: var(--text-secondary);
	}

	.target-value {
		font-weight: 600;
		color: #8b5cf6;
	}

	.milestones-mini {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		padding: 0 1.25rem;
		margin-bottom: 0.75rem;
	}

	.milestone-tag {
		display: inline-block;
		padding: 0.25rem 0.6rem;
		background: var(--bg-tertiary);
		border-radius: 6px;
		font-size: 0.75rem;
		color: var(--text-secondary);
	}

	.opportunity-cost, .review-date {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 1.25rem;
		font-size: 0.8rem;
		color: var(--text-secondary);
	}

	.opportunity-cost .material-symbols-outlined,
	.review-date .material-symbols-outlined {
		font-size: 1rem;
		color: #f59e0b;
	}

	.decision-instruction {
		padding: 1rem 1.25rem;
		font-size: 0.9rem;
		color: var(--text-secondary);
		font-style: italic;
		margin: 0;
	}

	.kill-list {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding: 0 1.25rem;
		margin-bottom: 1rem;
	}

	.kill-item {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.6rem 0.75rem;
		background: rgba(239, 68, 68, 0.1);
		border-radius: 8px;
		font-size: 0.85rem;
		color: var(--text-primary);
	}

	.kill-item .material-symbols-outlined {
		font-size: 1rem;
		color: #ef4444;
	}

	.no-kills {
		padding: 1.5rem 1.25rem;
		text-align: center;
		color: var(--text-tertiary);
		font-size: 0.85rem;
		margin: 0;
	}

	.action-btn.accept,
	.action-btn.pause,
	.action-btn.kill {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		margin: 1rem 1.25rem;
		padding: 0.75rem;
		border: none;
		border-radius: 10px;
		font-size: 0.85rem;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.action-btn.accept {
		background: linear-gradient(135deg, #10b981, #059669);
		color: white;
	}

	.action-btn.accept:hover {
		background: linear-gradient(135deg, #059669, #047857);
	}

	.action-btn.pause {
		background: linear-gradient(135deg, #f59e0b, #d97706);
		color: white;
	}

	.action-btn.pause:hover {
		background: linear-gradient(135deg, #d97706, #b45309);
	}

	.action-btn.kill {
		background: linear-gradient(135deg, #ef4444, #dc2626);
		color: white;
	}

	.action-btn.kill:hover {
		background: linear-gradient(135deg, #dc2626, #b91c1c);
	}

	.tracking-status.active,
	.tracking-status.paused {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		margin: 1rem 1.25rem;
		padding: 0.75rem;
		border-radius: 10px;
		font-size: 0.85rem;
		font-weight: 600;
	}

	.tracking-status.active {
		background: rgba(16, 185, 129, 0.15);
		color: #10b981;
	}

	.tracking-status.paused {
		background: rgba(245, 158, 11, 0.15);
		color: #f59e0b;
	}

	/* Active Task Cards */
	.active-task-card {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		padding: 1.25rem;
		background: var(--bg-tertiary);
		border-radius: 12px;
		border-left: 4px solid #8b5cf6;
	}

	.active-task-card.double-down {
		border-left-color: #10b981;
	}

	.active-task-card.pause {
		border-left-color: #f59e0b;
	}

	.task-header {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.task-header h4 {
		margin: 0;
		font-size: 0.95rem;
		font-weight: 600;
		color: var(--text-primary);
	}

	.task-progress {
		display: flex;
		align-items: center;
		gap: 1rem;
	}

	.progress-bar {
		flex: 1;
		height: 8px;
		background: var(--bg-secondary);
		border-radius: 4px;
		overflow: hidden;
	}

	.progress-fill {
		height: 100%;
		background: linear-gradient(90deg, #8b5cf6, #6366f1);
		border-radius: 4px;
		transition: width 0.3s ease;
	}

	.progress-text {
		font-size: 0.8rem;
		font-weight: 600;
		color: #8b5cf6;
		min-width: 40px;
	}

	.task-meta {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.days-remaining {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		font-size: 0.8rem;
		color: var(--text-secondary);
	}

	.days-remaining .material-symbols-outlined {
		font-size: 1rem;
	}

	.update-btn {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		padding: 0.5rem 1rem;
		background: #8b5cf6;
		color: white;
		border: none;
		border-radius: 8px;
		font-size: 0.8rem;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.update-btn:hover {
		background: #7c3aed;
	}

	.update-btn .material-symbols-outlined {
		font-size: 1rem;
	}

	/* GTM Modal Specific Styles */
	.gtm-task-modal,
	.gtm-followup-modal,
	.h3-modal {
		max-width: 520px;
	}

	.task-preview {
		padding: 1.25rem;
		background: var(--bg-tertiary);
		border-radius: 12px;
		margin-bottom: 1.5rem;
	}

	.task-preview h4 {
		margin: 0 0 0.5rem 0;
		font-size: 1rem;
		color: var(--text-primary);
	}

	.task-preview p {
		margin: 0;
		font-size: 0.9rem;
		color: var(--text-secondary);
		line-height: 1.5;
	}

	.target-preview,
	.milestones-preview {
		margin-top: 1rem;
		padding-top: 1rem;
		border-top: 1px solid var(--border-color);
	}

	.target-preview .label,
	.milestones-preview .label {
		font-size: 0.75rem;
		text-transform: uppercase;
		color: var(--text-secondary);
		margin-bottom: 0.35rem;
		display: block;
	}

	.target-preview .value {
		font-size: 0.9rem;
		font-weight: 600;
		color: #8b5cf6;
	}

	.milestones-preview ul {
		margin: 0.5rem 0 0 0;
		padding-left: 1.25rem;
		font-size: 0.85rem;
		color: var(--text-primary);
	}

	.milestones-preview li {
		margin-bottom: 0.35rem;
	}

	.commitment-section {
		padding: 1.25rem;
		background: linear-gradient(135deg, rgba(139, 92, 246, 0.1), rgba(99, 102, 241, 0.05));
		border-radius: 12px;
		margin-bottom: 1.5rem;
	}

	.commitment-section h4 {
		margin: 0 0 0.75rem 0;
		font-size: 0.95rem;
		color: var(--text-primary);
	}

	.commitment-list {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.commitment-list li {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.5rem 0;
		font-size: 0.85rem;
		color: var(--text-secondary);
	}

	.commitment-list .material-symbols-outlined {
		font-size: 1.1rem;
		color: #10b981;
	}

	.followup-task-info {
		margin-bottom: 1.5rem;
	}

	.task-name {
		display: block;
		font-size: 1rem;
		font-weight: 600;
		color: var(--text-primary);
		margin-bottom: 0.75rem;
	}

	.ai-message {
		display: flex;
		gap: 1rem;
		padding: 1rem;
		background: linear-gradient(135deg, rgba(139, 92, 246, 0.1), rgba(99, 102, 241, 0.05));
		border-radius: 12px;
		border-left: 4px solid #8b5cf6;
	}

	.ai-avatar {
		font-size: 1.5rem;
	}

	.ai-message p {
		margin: 0;
		font-size: 0.9rem;
		color: var(--text-primary);
		line-height: 1.5;
	}

	.progress-update-section {
		margin-bottom: 1rem;
	}

	.progress-update-section label {
		display: block;
		font-size: 0.9rem;
		font-weight: 600;
		color: var(--text-primary);
		margin-bottom: 0.5rem;
	}

	.progress-slider {
		display: flex;
		align-items: center;
		gap: 1rem;
		margin-bottom: 1.25rem;
	}

	.progress-slider input[type="range"] {
		flex: 1;
		height: 8px;
		-webkit-appearance: none;
		appearance: none;
		background: var(--bg-tertiary);
		border-radius: 4px;
		outline: none;
	}

	.progress-slider input[type="range"]::-webkit-slider-thumb {
		-webkit-appearance: none;
		appearance: none;
		width: 20px;
		height: 20px;
		background: #8b5cf6;
		border-radius: 50%;
		cursor: pointer;
	}

	.progress-slider .progress-value {
		font-size: 1.1rem;
		font-weight: 700;
		color: #8b5cf6;
		min-width: 45px;
	}

	.progress-update-section textarea {
		width: 100%;
		padding: 0.85rem 1rem;
		border: 1px solid var(--border-color);
		border-radius: 10px;
		background: var(--bg-secondary);
		color: var(--text-primary);
		font-size: 0.9rem;
		resize: vertical;
		outline: none;
		transition: border-color 0.2s ease;
	}

	.progress-update-section textarea:focus {
		border-color: #8b5cf6;
	}

	.h3-intro {
		padding: 1rem;
		background: rgba(239, 68, 68, 0.1);
		border-radius: 10px;
		font-size: 0.9rem;
		color: var(--text-primary);
		line-height: 1.5;
		margin: 0 0 1.5rem 0;
	}

	.h3-modal .form-group {
		margin-bottom: 1.25rem;
	}

	.h3-modal .form-group label {
		display: block;
		font-size: 0.85rem;
		font-weight: 600;
		color: var(--text-primary);
		margin-bottom: 0.5rem;
	}

	.h3-modal .form-group input,
	.h3-modal .form-group textarea,
	.h3-modal .form-group select {
		width: 100%;
		padding: 0.85rem 1rem;
		border: 1px solid var(--border-color);
		border-radius: 10px;
		background: var(--bg-secondary);
		color: var(--text-primary);
		font-size: 0.9rem;
		outline: none;
		transition: border-color 0.2s ease;
	}

	.h3-modal .form-group input:focus,
	.h3-modal .form-group textarea:focus,
	.h3-modal .form-group select:focus {
		border-color: #ef4444;
	}

	.modal-actions {
		display: flex;
		gap: 1rem;
		margin-top: 1.5rem;
	}

	.btn-danger {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		flex: 1;
		padding: 0.85rem 1.25rem;
		background: linear-gradient(135deg, #ef4444, #dc2626);
		color: white;
		border: none;
		border-radius: 10px;
		font-size: 0.9rem;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.btn-danger:hover {
		background: linear-gradient(135deg, #dc2626, #b91c1c);
	}

	.btn-danger:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	/* Badge count for active tasks */
	.badge-count {
		background: #8b5cf6;
		color: white;
		padding: 0.2rem 0.6rem;
		border-radius: 10px;
		font-size: 0.7rem;
		font-weight: 600;
	}

	/* Responsive Design for GTM Trackable */
	@media (max-width: 1024px) {
		.decisions-grid-enhanced {
			grid-template-columns: 1fr;
		}
	}

	/* Action Plan Table */
	.action-plan-table {
		margin-top: 1.25rem;
		border: 1px solid var(--border-color);
		border-radius: 12px;
		overflow: hidden;
	}

	.action-row {
		display: grid;
		grid-template-columns: 2fr 0.75fr 1.25fr 0.75fr;
		gap: 1rem;
		padding: 1rem 1.25rem;
		border-bottom: 1px solid var(--border-color);
		align-items: center;
	}

	.action-row:last-child {
		border-bottom: none;
	}

	.action-row.header {
		background: var(--bg-tertiary);
		font-weight: 600;
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		color: var(--text-secondary);
	}

	.action-row.highlight {
		background: rgba(245, 158, 11, 0.1);
	}

	.action-col.action {
		display: flex;
		align-items: flex-start;
		gap: 0.75rem;
	}

	.action-number {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 24px;
		height: 24px;
		background: var(--accent-primary);
		color: white;
		border-radius: 50%;
		font-size: 0.75rem;
		font-weight: 600;
		flex-shrink: 0;
	}

	/* Risks Grid */
	.risks-grid {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 1.25rem;
		margin-top: 1.25rem;
	}

	.risk-item {
		background: var(--bg-secondary);
		border-radius: 12px;
		padding: 1.25rem;
		border: 1px solid var(--border-color);
	}

	.risk-item.full-width {
		grid-column: 1 / -1;
	}

	.risk-header {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-bottom: 1rem;
	}

	.risk-header .material-symbols-outlined {
		color: #f59e0b;
		font-size: 1.25rem;
	}

	.risk-header h4 {
		margin: 0;
		font-size: 0.95rem;
		font-weight: 600;
		color: var(--text-primary);
	}

	.risk-list {
		margin: 0;
		padding-left: 1.25rem;
	}

	.risk-list li {
		font-size: 0.85rem;
		color: var(--text-secondary);
		margin-bottom: 0.5rem;
		line-height: 1.4;
	}

	.reset-triggers {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.reset-trigger {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.75rem 1rem;
		background: var(--bg-tertiary);
		border-radius: 8px;
		font-size: 0.85rem;
		flex-wrap: wrap;
	}

	.trigger-if,
	.trigger-then {
		font-weight: 700;
		padding: 0.2rem 0.5rem;
		border-radius: 4px;
	}

	.trigger-if {
		background: rgba(239, 68, 68, 0.2);
		color: #ef4444;
	}

	.trigger-then {
		color: var(--text-secondary);
	}

	.trigger-condition {
		color: var(--text-primary);
		flex: 1;
	}

	.trigger-action {
		color: var(--text-secondary);
		font-style: italic;
	}

	/* GTM Slides */
	.gtm-slides-card {
		background: linear-gradient(135deg, rgba(30, 30, 40, 0.8), rgba(40, 40, 55, 0.8));
	}

	.gtm-slides {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 1.25rem;
		margin-top: 1.25rem;
	}

	.gtm-slide {
		background: var(--bg-secondary);
		border-radius: 12px;
		padding: 1.5rem;
		border: 1px solid var(--border-color);
		position: relative;
	}

	.slide-number {
		position: absolute;
		top: 1rem;
		right: 1rem;
		font-size: 2rem;
		font-weight: 700;
		color: rgba(139, 92, 246, 0.2);
	}

	.slide-title {
		font-size: 1rem;
		font-weight: 700;
		color: #8b5cf6;
		margin: 0 0 1rem 0;
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	.slide-content {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.slide-point {
		display: flex;
		gap: 0.5rem;
		font-size: 0.85rem;
		color: var(--text-secondary);
		line-height: 1.5;
		margin: 0;
	}

	.point-marker {
		color: #8b5cf6;
		flex-shrink: 0;
	}

	.slide-point strong {
		color: var(--text-primary);
	}

	/* GTM Metrics */
	.gtm-metrics-card {
		border-left: 4px solid #10b981;
	}

	.metrics-grid {
		display: grid;
		grid-template-columns: repeat(5, 1fr);
		gap: 1rem;
		margin-top: 1.25rem;
	}

	.metric-card {
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		padding: 1.25rem 1rem;
		background: var(--bg-secondary);
		border-radius: 12px;
		border: 1px solid var(--border-color);
	}

	.metric-card .metric-icon {
		font-size: 2rem;
		color: #10b981;
		margin-bottom: 0.75rem;
	}

	.metric-info {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.metric-info .metric-name {
		font-size: 0.85rem;
		font-weight: 600;
		color: var(--text-primary);
	}

	.metric-info .metric-desc {
		font-size: 0.75rem;
		color: var(--text-secondary);
	}

	.metric-info .metric-target {
		font-size: 0.75rem;
		font-weight: 600;
		color: #10b981;
		margin-top: 0.5rem;
	}

	/* ========================================
	   GTM TO-DO LIST & RAG STATUS STYLES
	   ======================================== */

	.custom-todo-section {
		margin-top: 2rem;
		padding-top: 1.5rem;
		border-top: 2px dashed var(--border-color);
	}

	.todo-section-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 1.25rem;
		flex-wrap: wrap;
		gap: 1rem;
	}

	.todo-title-area {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.todo-title-area .material-symbols-outlined {
		font-size: 1.5rem;
		color: #8b5cf6;
	}

	.todo-title-area h3 {
		font-size: 1.1rem;
		font-weight: 600;
		color: var(--text-primary);
		margin: 0;
	}

	.todo-count {
		font-size: 0.75rem;
		padding: 0.25rem 0.6rem;
		background: rgba(139, 92, 246, 0.15);
		color: #8b5cf6;
		border-radius: 12px;
		font-weight: 500;
	}

	.add-todo-btn {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.6rem 1.25rem;
		background: linear-gradient(135deg, #8b5cf6, #7c3aed);
		color: white;
		border: none;
		border-radius: 8px;
		font-size: 0.85rem;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.add-todo-btn:hover {
		transform: translateY(-2px);
		box-shadow: 0 4px 15px rgba(139, 92, 246, 0.3);
	}

	.add-todo-btn .material-symbols-outlined {
		font-size: 1.1rem;
	}

	/* Add Todo Form */
	.add-todo-form {
		background: var(--bg-tertiary);
		border: 1px solid var(--border-color);
		border-radius: 12px;
		padding: 1.5rem;
		margin-bottom: 1.5rem;
		animation: slideDown 0.3s ease;
	}

	@keyframes slideDown {
		from {
			opacity: 0;
			transform: translateY(-10px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	.form-row {
		display: flex;
		gap: 1rem;
		margin-bottom: 1rem;
	}

	.form-row.three-col {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
	}

	.form-field {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	.form-field.full-width {
		flex: 1;
	}

	.form-field label {
		font-size: 0.75rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		color: var(--text-secondary);
	}

	.form-field input,
	.form-field select {
		padding: 0.75rem 1rem;
		background: var(--bg-secondary);
		border: 1px solid var(--border-color);
		border-radius: 8px;
		font-size: 0.9rem;
		color: var(--text-primary);
		transition: all 0.2s ease;
	}

	.form-field input:focus,
	.form-field select:focus {
		outline: none;
		border-color: #8b5cf6;
		box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.15);
	}

	.form-field input::placeholder {
		color: var(--text-tertiary);
	}

	.form-actions {
		display: flex;
		justify-content: flex-end;
		gap: 0.75rem;
		margin-top: 1rem;
	}

	.btn-cancel {
		padding: 0.6rem 1.25rem;
		background: transparent;
		border: 1px solid var(--border-color);
		border-radius: 8px;
		color: var(--text-secondary);
		font-size: 0.85rem;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.btn-cancel:hover {
		background: var(--bg-tertiary);
		border-color: var(--text-secondary);
	}

	.btn-add {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.6rem 1.25rem;
		background: linear-gradient(135deg, #10b981, #059669);
		color: white;
		border: none;
		border-radius: 8px;
		font-size: 0.85rem;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.btn-add:hover:not(:disabled) {
		transform: translateY(-2px);
		box-shadow: 0 4px 15px rgba(16, 185, 129, 0.3);
	}

	.btn-add:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.btn-add .material-symbols-outlined {
		font-size: 1rem;
	}

	/* Todo List */
	.todo-list {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.todo-item {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 1rem 1.25rem;
		background: var(--bg-secondary);
		border-radius: 10px;
		border: 2px solid var(--border-color);
		transition: all 0.2s ease;
		gap: 1rem;
	}

	.todo-item:hover {
		box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
	}

	/* RAG Status Borders */
	.todo-item.rag-not-started {
		border-left: 4px solid #6b7280;
	}

	.todo-item.rag-red {
		border-left: 4px solid #ef4444;
		background: rgba(239, 68, 68, 0.05);
	}

	.todo-item.rag-amber {
		border-left: 4px solid #f59e0b;
		background: rgba(245, 158, 11, 0.05);
	}

	.todo-item.rag-green {
		border-left: 4px solid #10b981;
		background: rgba(16, 185, 129, 0.05);
	}

	.todo-item-main {
		display: flex;
		align-items: flex-start;
		gap: 1rem;
		flex: 1;
	}

	.todo-number {
		display: flex;
		align-items: center;
		justify-content: center;
		min-width: 28px;
		height: 28px;
		background: var(--accent-primary);
		color: white;
		border-radius: 50%;
		font-size: 0.8rem;
		font-weight: 600;
		flex-shrink: 0;
	}

	.todo-content {
		flex: 1;
	}

	.todo-action-text {
		font-size: 0.95rem;
		color: var(--text-primary);
		line-height: 1.4;
	}

	.todo-meta {
		display: flex;
		gap: 1.25rem;
		margin-top: 0.5rem;
		flex-wrap: wrap;
	}

	.todo-meta span {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		font-size: 0.8rem;
		color: var(--text-secondary);
	}

	.todo-meta .material-symbols-outlined {
		font-size: 0.9rem;
		color: var(--text-tertiary);
	}

	.todo-item-controls {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	/* RAG Status Selector */
	.rag-selector {
		display: flex;
		gap: 0.35rem;
		padding: 0.35rem;
		background: var(--bg-tertiary);
		border-radius: 8px;
	}

	.rag-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 32px;
		height: 32px;
		border: none;
		border-radius: 6px;
		cursor: pointer;
		transition: all 0.2s ease;
		opacity: 0.4;
	}

	.rag-btn:hover {
		opacity: 0.7;
		transform: scale(1.1);
	}

	.rag-btn.active {
		opacity: 1;
		transform: scale(1.1);
	}

	.rag-btn .material-symbols-outlined {
		font-size: 1.1rem;
	}

	.rag-btn.not-started {
		background: rgba(107, 114, 128, 0.15);
		color: #6b7280;
	}

	.rag-btn.not-started.active {
		background: rgba(107, 114, 128, 0.25);
		box-shadow: 0 0 0 2px #6b7280;
	}

	.rag-btn.red {
		background: rgba(239, 68, 68, 0.15);
		color: #ef4444;
	}

	.rag-btn.red.active {
		background: rgba(239, 68, 68, 0.25);
		box-shadow: 0 0 0 2px #ef4444;
	}

	.rag-btn.amber {
		background: rgba(245, 158, 11, 0.15);
		color: #f59e0b;
	}

	.rag-btn.amber.active {
		background: rgba(245, 158, 11, 0.25);
		box-shadow: 0 0 0 2px #f59e0b;
	}

	.rag-btn.green {
		background: rgba(16, 185, 129, 0.15);
		color: #10b981;
	}

	.rag-btn.green.active {
		background: rgba(16, 185, 129, 0.25);
		box-shadow: 0 0 0 2px #10b981;
	}

	.delete-todo-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 32px;
		height: 32px;
		background: transparent;
		border: 1px solid rgba(239, 68, 68, 0.3);
		border-radius: 6px;
		color: #ef4444;
		cursor: pointer;
		opacity: 0.5;
		transition: all 0.2s ease;
	}

	.delete-todo-btn:hover {
		opacity: 1;
		background: rgba(239, 68, 68, 0.1);
	}

	.delete-todo-btn .material-symbols-outlined {
		font-size: 1rem;
	}

	/* RAG Summary */
	.rag-summary {
		display: flex;
		gap: 1rem;
		margin-top: 1.25rem;
		padding: 1rem;
		background: var(--bg-tertiary);
		border-radius: 10px;
		flex-wrap: wrap;
	}

	.rag-summary-item {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 1rem;
		border-radius: 8px;
		flex: 1;
		min-width: 120px;
	}

	.rag-summary-item .material-symbols-outlined {
		font-size: 1.25rem;
	}

	.rag-summary-item.not-started {
		background: rgba(107, 114, 128, 0.1);
		color: #6b7280;
	}

	.rag-summary-item.red {
		background: rgba(239, 68, 68, 0.1);
		color: #ef4444;
	}

	.rag-summary-item.amber {
		background: rgba(245, 158, 11, 0.1);
		color: #f59e0b;
	}

	.rag-summary-item.green {
		background: rgba(16, 185, 129, 0.1);
		color: #10b981;
	}

	.rag-label {
		font-size: 0.8rem;
		font-weight: 500;
		flex: 1;
	}

	.rag-count {
		font-size: 1.1rem;
		font-weight: 700;
	}

	/* Empty State */
	.empty-todo-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 2.5rem;
		background: var(--bg-tertiary);
		border: 2px dashed var(--border-color);
		border-radius: 12px;
		text-align: center;
	}

	.empty-todo-state .material-symbols-outlined {
		font-size: 3rem;
		color: var(--text-tertiary);
		margin-bottom: 1rem;
	}

	.empty-todo-state p {
		color: var(--text-secondary);
		font-size: 0.9rem;
		margin: 0;
		max-width: 300px;
	}

	/* Todo Responsive Styles */
	@media (max-width: 992px) {
		.form-row.three-col {
			grid-template-columns: 1fr;
		}

		.todo-item {
			flex-direction: column;
			align-items: stretch;
		}

		.todo-item-controls {
			justify-content: space-between;
			padding-top: 0.75rem;
			border-top: 1px solid var(--border-color);
			margin-top: 0.75rem;
		}

		.rag-summary {
			flex-direction: column;
		}

		.rag-summary-item {
			min-width: auto;
		}
	}

	@media (max-width: 768px) {
		.todo-section-header {
			flex-direction: column;
			align-items: stretch;
		}

		.add-todo-btn {
			justify-content: center;
		}

		.todo-meta {
			flex-direction: column;
			gap: 0.5rem;
		}
	}

	/* ========================================
	   NEW DYNAMIC GTM STYLES
	   ======================================== */

	.gtm-header-card {
		background: linear-gradient(135deg, rgba(139, 92, 246, 0.1), rgba(59, 130, 246, 0.1));
		border: 1px solid rgba(139, 92, 246, 0.3);
		padding: 1.5rem;
	}

	.gtm-header-actions {
		display: flex;
		align-items: center;
		gap: 1rem;
	}

	.gtm-stage-badge {
		padding: 0.5rem 1rem;
		border-radius: 20px;
		font-size: 0.8rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	.gtm-stage-badge.pre-revenue { background: rgba(245, 158, 11, 0.2); color: #f59e0b; }
	.gtm-stage-badge.early-traction { background: rgba(59, 130, 246, 0.2); color: #3b82f6; }
	.gtm-stage-badge.growth { background: rgba(16, 185, 129, 0.2); color: #10b981; }
	.gtm-stage-badge.scaling { background: rgba(139, 92, 246, 0.2); color: #8b5cf6; }

	.btn-generate-gtm {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.75rem 1.5rem;
		background: linear-gradient(135deg, #8b5cf6, #7c3aed);
		color: white;
		border: none;
		border-radius: 10px;
		font-size: 0.9rem;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.3s ease;
	}

	.btn-generate-gtm:hover:not(:disabled) {
		transform: translateY(-2px);
		box-shadow: 0 4px 20px rgba(139, 92, 246, 0.4);
	}

	.btn-generate-gtm:disabled {
		opacity: 0.7;
		cursor: not-allowed;
	}

	.rotating {
		animation: rotate 1s linear infinite;
	}

	@keyframes rotate {
		from { transform: rotate(0deg); }
		to { transform: rotate(360deg); }
	}

	.gtm-quick-stats {
		display: flex;
		gap: 1.5rem;
		margin-top: 1.25rem;
		padding-top: 1.25rem;
		border-top: 1px solid rgba(139, 92, 246, 0.2);
		flex-wrap: wrap;
	}

	.quick-stat {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.quick-stat .stat-label {
		font-size: 0.7rem;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		color: var(--text-secondary);
	}

	.quick-stat .stat-value {
		font-size: 0.95rem;
		font-weight: 600;
		color: var(--text-primary);
	}

	/* GTM Error & Loading States */
	.gtm-error-card {
		display: flex;
		align-items: center;
		gap: 1rem;
		padding: 1.25rem;
		background: rgba(239, 68, 68, 0.1);
		border: 1px solid rgba(239, 68, 68, 0.3);
	}

	.gtm-error-card .material-symbols-outlined {
		color: #ef4444;
		font-size: 1.5rem;
	}

	.gtm-error-card p {
		flex: 1;
		margin: 0;
		color: #ef4444;
	}

	.btn-retry {
		padding: 0.5rem 1rem;
		background: #ef4444;
		color: white;
		border: none;
		border-radius: 6px;
		font-size: 0.85rem;
		cursor: pointer;
	}

	.gtm-loading-card {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 3rem;
		text-align: center;
	}

	.gtm-loading-card h3 {
		margin: 1.5rem 0 0.5rem;
		color: var(--text-primary);
	}

	.gtm-loading-card p {
		color: var(--text-secondary);
		margin: 0;
	}

	.loading-spinner {
		width: 50px;
		height: 50px;
		border: 4px solid var(--border-color);
		border-top-color: #8b5cf6;
		border-radius: 50%;
		animation: rotate 1s linear infinite;
	}

	/* GTM Navigation Tabs */
	.gtm-nav-tabs {
		display: flex;
		gap: 0.5rem;
		padding: 0.75rem;
		background: var(--bg-secondary);
		border-radius: 12px;
		overflow-x: auto;
		flex-wrap: wrap;
	}

	.gtm-nav-tab {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.6rem 1rem;
		background: transparent;
		border: none;
		border-radius: 8px;
		color: var(--text-secondary);
		font-size: 0.85rem;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.2s ease;
		white-space: nowrap;
	}

	.gtm-nav-tab:hover {
		background: var(--bg-tertiary);
		color: var(--text-primary);
	}

	.gtm-nav-tab.active {
		background: linear-gradient(135deg, rgba(139, 92, 246, 0.2), rgba(59, 130, 246, 0.2));
		color: #8b5cf6;
	}

	.gtm-nav-tab .material-symbols-outlined {
		font-size: 1.1rem;
	}

	/* GTM Content Area */
	.gtm-content {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	.gtm-section-card {
		padding: 1.5rem;
	}

	.section-header {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		margin-bottom: 1.25rem;
		padding-bottom: 1rem;
		border-bottom: 1px solid var(--border-color);
	}

	.section-header .material-symbols-outlined {
		font-size: 1.5rem;
		color: #8b5cf6;
	}

	.section-header h2 {
		margin: 0;
		font-size: 1.25rem;
		font-weight: 600;
		color: var(--text-primary);
		flex: 1;
	}

	.section-header.small h3 {
		margin: 0;
		font-size: 1rem;
	}

	.badge-limit {
		padding: 0.35rem 0.75rem;
		background: rgba(139, 92, 246, 0.15);
		color: #8b5cf6;
		font-size: 0.7rem;
		font-weight: 600;
		border-radius: 20px;
		text-transform: uppercase;
	}

	/* Overview Section */
	.overview-content {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
	}

	.overview-item {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.overview-item.highlight {
		padding: 1.25rem;
		background: var(--bg-tertiary);
		border-radius: 10px;
	}

	.overview-item .item-label {
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		color: var(--text-secondary);
	}

	.overview-item .item-value {
		margin: 0;
		color: var(--text-primary);
		line-height: 1.5;
	}

	.overview-item .item-value.large {
		font-size: 1.25rem;
		font-weight: 600;
	}

	.overview-grid {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 1.25rem;
	}

	.why-now-box {
		padding: 1.25rem;
		background: rgba(59, 130, 246, 0.1);
		border: 1px solid rgba(59, 130, 246, 0.2);
		border-radius: 10px;
	}

	.why-now-box h4 {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin: 0 0 1rem;
		color: #3b82f6;
		font-size: 0.95rem;
	}

	.why-now-content {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 1rem;
	}

	.why-item .why-label {
		display: block;
		font-size: 0.7rem;
		text-transform: uppercase;
		color: var(--text-secondary);
		margin-bottom: 0.25rem;
	}

	.why-item p {
		margin: 0;
		color: var(--text-primary);
		font-size: 0.9rem;
	}

	/* Value Proposition */
	.value-prop-content {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	.value-statement-box {
		padding: 1.5rem;
		background: linear-gradient(135deg, rgba(139, 92, 246, 0.1), rgba(59, 130, 246, 0.1));
		border-radius: 12px;
		text-align: center;
	}

	.value-statement {
		margin: 0;
		font-size: 1.25rem;
		font-weight: 600;
		color: var(--text-primary);
		font-style: italic;
		line-height: 1.6;
	}

	.benefits-grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 1rem;
	}

	.benefit-card {
		padding: 1.25rem;
		background: var(--bg-tertiary);
		border-radius: 10px;
		border-left: 3px solid var(--border-color);
	}

	.benefit-card.functional { border-left-color: #3b82f6; }
	.benefit-card.emotional { border-left-color: #ec4899; }
	.benefit-card.social { border-left-color: #8b5cf6; }

	.benefit-type {
		display: inline-block;
		font-size: 0.65rem;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		padding: 0.2rem 0.5rem;
		background: var(--bg-secondary);
		border-radius: 4px;
		color: var(--text-secondary);
		margin-bottom: 0.5rem;
	}

	.benefit-text {
		margin: 0 0 0.5rem;
		color: var(--text-primary);
		font-size: 0.9rem;
		line-height: 1.5;
	}

	.benefit-proof {
		font-size: 0.8rem;
		color: var(--text-tertiary);
		font-style: italic;
	}

	.proof-points {
		padding: 1rem;
		background: var(--bg-tertiary);
		border-radius: 10px;
	}

	.proof-points h4 {
		margin: 0 0 0.75rem;
		font-size: 0.9rem;
		color: var(--text-primary);
	}

	.proof-points ul {
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.proof-points li {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 0;
		font-size: 0.9rem;
		color: var(--text-secondary);
	}

	.proof-points li .material-symbols-outlined {
		color: #10b981;
		font-size: 1rem;
	}

	/* Hypothesis Status Select */
	.status-select {
		padding: 0.35rem 0.75rem;
		background: var(--bg-secondary);
		border: 1px solid var(--border-color);
		border-radius: 6px;
		font-size: 0.8rem;
		color: var(--text-primary);
		cursor: pointer;
	}

	.hypothesis-text {
		margin: 0;
		padding: 1rem 1.25rem;
		font-size: 0.95rem;
		color: var(--text-primary);
		line-height: 1.5;
	}

	.hypothesis-details {
		padding: 0 1.25rem 1.25rem;
	}

	.detail-row {
		display: flex;
		justify-content: space-between;
		padding: 0.5rem 0;
		border-bottom: 1px solid var(--border-color);
	}

	.detail-row:last-child {
		border-bottom: none;
	}

	.detail-label {
		font-size: 0.8rem;
		color: var(--text-secondary);
	}

	.detail-value {
		font-size: 0.85rem;
		color: var(--text-primary);
		font-weight: 500;
	}

	.detail-value.signal {
		color: #10b981;
	}

	/* GTM Decisions Enhanced */
	.decision-header {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 1rem;
		background: var(--bg-tertiary);
	}

	.decision-header h4 {
		margin: 0;
		font-size: 0.9rem;
	}

	.decision-card.double-down .decision-header { background: rgba(16, 185, 129, 0.1); color: #10b981; }
	.decision-card.pause .decision-header { background: rgba(245, 158, 11, 0.1); color: #f59e0b; }
	.decision-card.kill .decision-header { background: rgba(239, 68, 68, 0.1); color: #ef4444; }

	.decision-what, .decision-evidence, .decision-impact {
		margin: 0;
		padding: 0.5rem 1rem;
		font-size: 0.85rem;
	}

	.decision-what {
		padding-top: 1rem;
		font-weight: 600;
		color: var(--text-primary);
	}

	.decision-evidence, .decision-impact {
		color: var(--text-secondary);
	}

	/* ICP Grid */
	.icp-grid {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 1rem;
	}

	.icp-item {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		padding: 1rem;
		background: var(--bg-tertiary);
		border-radius: 10px;
	}

	.icp-label {
		font-size: 0.7rem;
		text-transform: uppercase;
		color: var(--text-secondary);
	}

	.icp-value {
		font-size: 0.95rem;
		font-weight: 600;
		color: var(--text-primary);
	}

	/* Personas */
	.personas-grid {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 1.25rem;
	}

	.persona-card {
		background: var(--bg-secondary);
		border-radius: 12px;
		border: 1px solid var(--border-color);
		overflow: hidden;
	}

	.persona-header {
		display: flex;
		align-items: center;
		gap: 1rem;
		padding: 1.25rem;
		background: var(--bg-tertiary);
	}

	.persona-avatar {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 40px;
		height: 40px;
		background: linear-gradient(135deg, #8b5cf6, #7c3aed);
		color: white;
		border-radius: 50%;
		font-weight: 700;
	}

	.persona-header h4 {
		margin: 0;
		font-size: 1rem;
		color: var(--text-primary);
	}

	.persona-role {
		margin: 0;
		font-size: 0.85rem;
		color: var(--text-secondary);
	}

	.persona-section {
		padding: 1rem 1.25rem;
		border-bottom: 1px solid var(--border-color);
	}

	.persona-section:last-child {
		border-bottom: none;
	}

	.persona-section .section-label {
		display: block;
		font-size: 0.7rem;
		text-transform: uppercase;
		color: var(--text-secondary);
		margin-bottom: 0.5rem;
	}

	.persona-section ul {
		margin: 0;
		padding-left: 1.25rem;
	}

	.persona-section li {
		font-size: 0.85rem;
		color: var(--text-primary);
		margin-bottom: 0.25rem;
	}

	.persona-section p {
		margin: 0;
		font-size: 0.9rem;
		color: var(--text-primary);
	}

	/* Market Segments */
	.market-segments {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 1.25rem;
	}

	.segment-card {
		padding: 1.25rem;
		background: var(--bg-tertiary);
		border-radius: 10px;
	}

	.segment-card.early { border-left: 3px solid #f59e0b; }
	.segment-card.mass { border-left: 3px solid #3b82f6; }

	.segment-card h4 {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin: 0 0 1rem;
		font-size: 0.95rem;
	}

	.segment-content p {
		margin: 0 0 0.75rem;
		font-size: 0.85rem;
		color: var(--text-secondary);
	}

	.segment-content p:last-child {
		margin-bottom: 0;
	}

	/* Positioning */
	.positioning-content {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	.positioning-statement-box {
		padding: 1.5rem;
		background: var(--bg-tertiary);
		border-radius: 10px;
	}

	.positioning-statement-box .label {
		display: block;
		font-size: 0.7rem;
		text-transform: uppercase;
		color: var(--text-secondary);
		margin-bottom: 0.5rem;
	}

	.positioning-statement-box .statement {
		margin: 0;
		font-size: 1.1rem;
		font-style: italic;
		color: var(--text-primary);
		line-height: 1.6;
	}

	.category-position {
		display: flex;
		align-items: center;
		gap: 1rem;
	}

	.position-badge {
		padding: 0.5rem 1rem;
		background: linear-gradient(135deg, #8b5cf6, #7c3aed);
		color: white;
		border-radius: 20px;
		font-weight: 600;
	}

	.diff-axes-grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 1rem;
	}

	.diff-axis-card {
		padding: 1.25rem;
		background: var(--bg-tertiary);
		border-radius: 10px;
	}

	.diff-axis-card h4 {
		margin: 0 0 0.75rem;
		font-size: 0.9rem;
		color: #8b5cf6;
	}

	.axis-position {
		margin: 0 0 0.5rem;
		font-weight: 600;
		color: var(--text-primary);
	}

	.axis-vs {
		margin: 0;
		font-size: 0.85rem;
		color: var(--text-secondary);
	}

	.competitive-response {
		padding: 1.25rem;
	}

	.vs-main {
		margin: 0 0 1.25rem;
		font-size: 1rem;
		font-weight: 600;
		color: var(--text-primary);
	}

	.talking-points h4 {
		margin: 0 0 0.75rem;
		font-size: 0.9rem;
		color: var(--text-secondary);
	}

	.talking-points ul {
		margin: 0;
		padding-left: 1.25rem;
	}

	.talking-points li {
		font-size: 0.9rem;
		color: var(--text-primary);
		margin-bottom: 0.5rem;
	}

	/* Pricing Tiers */
	.pricing-model-badge {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		margin-bottom: 1.5rem;
	}

	.model-label {
		font-size: 0.85rem;
		color: var(--text-secondary);
	}

	.model-value {
		padding: 0.5rem 1rem;
		background: linear-gradient(135deg, #8b5cf6, #7c3aed);
		color: white;
		border-radius: 20px;
		font-weight: 600;
	}

	.pricing-tiers {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 1.25rem;
	}

	.pricing-tier {
		padding: 1.5rem;
		background: var(--bg-secondary);
		border: 2px solid var(--border-color);
		border-radius: 12px;
		position: relative;
	}

	.pricing-tier.recommended {
		border-color: #8b5cf6;
	}

	.recommended-badge {
		position: absolute;
		top: -10px;
		left: 50%;
		transform: translateX(-50%);
		padding: 0.25rem 0.75rem;
		background: #8b5cf6;
		color: white;
		font-size: 0.7rem;
		font-weight: 600;
		border-radius: 20px;
		text-transform: uppercase;
	}

	.pricing-tier h4 {
		margin: 0 0 0.5rem;
		font-size: 1.1rem;
		color: var(--text-primary);
	}

	.tier-price {
		margin: 0 0 0.5rem;
		font-size: 1.5rem;
		font-weight: 700;
		color: #8b5cf6;
	}

	.tier-target {
		margin: 0 0 1rem;
		font-size: 0.85rem;
		color: var(--text-secondary);
	}

	.tier-features {
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.tier-features li {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 0;
		font-size: 0.85rem;
		color: var(--text-primary);
	}

	.tier-features .material-symbols-outlined {
		color: #10b981;
		font-size: 1rem;
	}

	.pricing-logic-content {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.logic-item {
		padding: 1rem;
		background: var(--bg-tertiary);
		border-radius: 8px;
	}

	.logic-label {
		display: block;
		font-size: 0.7rem;
		text-transform: uppercase;
		color: var(--text-secondary);
		margin-bottom: 0.25rem;
	}

	.logic-item p {
		margin: 0;
		font-size: 0.9rem;
		color: var(--text-primary);
	}

	/* Distribution Channels */
	.channels-list {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.channel-card {
		display: flex;
		gap: 1rem;
		padding: 1.25rem;
		background: var(--bg-tertiary);
		border-radius: 10px;
	}

	.channel-priority {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 40px;
		height: 40px;
		background: linear-gradient(135deg, #8b5cf6, #7c3aed);
		color: white;
		border-radius: 50%;
		font-weight: 700;
		flex-shrink: 0;
	}

	.channel-content {
		flex: 1;
	}

	.channel-content h4 {
		margin: 0 0 0.5rem;
		font-size: 1rem;
		color: var(--text-primary);
	}

	.channel-rationale {
		margin: 0 0 0.5rem;
		font-size: 0.85rem;
		color: var(--text-secondary);
	}

	.channel-cac {
		font-size: 0.8rem;
		color: #10b981;
		font-weight: 500;
	}

	.sales-motion-content {
		padding: 1rem;
	}

	.motion-type {
		margin-bottom: 1rem;
	}

	.type-badge {
		padding: 0.5rem 1rem;
		background: var(--bg-tertiary);
		border-radius: 20px;
		font-weight: 600;
		color: #8b5cf6;
	}

	.motion-rationale {
		margin: 0 0 1rem;
		color: var(--text-secondary);
	}

	.transition-plan .label {
		font-weight: 600;
		color: var(--text-primary);
	}

	.transition-plan p {
		margin: 0.25rem 0 0;
		color: var(--text-secondary);
	}

	.ownership-grid {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 1rem;
	}

	.ownership-item {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		padding: 1rem;
		background: var(--bg-tertiary);
		border-radius: 8px;
	}

	.ownership-label {
		font-size: 0.7rem;
		text-transform: uppercase;
		color: var(--text-secondary);
	}

	.ownership-value {
		font-size: 0.9rem;
		font-weight: 600;
		color: var(--text-primary);
	}

	/* Marketing Demand Gen */
	.demand-gen-grid {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 1rem;
	}

	.demand-category {
		padding: 1.25rem;
		background: var(--bg-tertiary);
		border-radius: 10px;
	}

	.demand-category h4 {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin: 0 0 1rem;
		font-size: 0.9rem;
		color: #8b5cf6;
	}

	.demand-category ul {
		margin: 0;
		padding-left: 1.25rem;
	}

	.demand-category li {
		font-size: 0.85rem;
		color: var(--text-primary);
		margin-bottom: 0.5rem;
	}

	.brand-messaging-content {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	.core-narrative {
		padding: 1.5rem;
		background: var(--bg-tertiary);
		border-radius: 10px;
	}

	.core-narrative .label {
		display: block;
		font-size: 0.7rem;
		text-transform: uppercase;
		color: var(--text-secondary);
		margin-bottom: 0.5rem;
	}

	.core-narrative p {
		margin: 0;
		font-size: 1.1rem;
		font-style: italic;
		color: var(--text-primary);
		line-height: 1.6;
	}

	.channel-messages h4 {
		margin: 0 0 1rem;
		font-size: 0.9rem;
		color: var(--text-secondary);
	}

	.channel-message {
		padding: 1rem;
		background: var(--bg-tertiary);
		border-radius: 8px;
		margin-bottom: 0.75rem;
	}

	.channel-name {
		display: inline-block;
		padding: 0.2rem 0.5rem;
		background: #8b5cf6;
		color: white;
		font-size: 0.7rem;
		font-weight: 600;
		border-radius: 4px;
		margin-bottom: 0.5rem;
	}

	.channel-message p {
		margin: 0;
		font-size: 0.9rem;
		color: var(--text-primary);
	}

	.objections-grid {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 1rem;
	}

	.objection-card {
		background: var(--bg-tertiary);
		border-radius: 10px;
		overflow: hidden;
	}

	.objection-text {
		display: flex;
		align-items: flex-start;
		gap: 0.5rem;
		padding: 1rem;
		background: rgba(239, 68, 68, 0.1);
		font-size: 0.9rem;
		color: #ef4444;
	}

	.response-text {
		display: flex;
		align-items: flex-start;
		gap: 0.5rem;
		padding: 1rem;
		font-size: 0.9rem;
		color: var(--text-primary);
	}

	.response-text .material-symbols-outlined {
		color: #10b981;
	}

	.growth-loops-grid {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 1rem;
	}

	.growth-loop-card {
		padding: 1.25rem;
		background: var(--bg-tertiary);
		border-radius: 10px;
		border-left: 3px solid #8b5cf6;
	}

	.growth-loop-card h4 {
		margin: 0 0 0.75rem;
		font-size: 0.95rem;
		color: #8b5cf6;
	}

	.loop-mechanism {
		margin: 0 0 0.75rem;
		font-size: 0.9rem;
		color: var(--text-primary);
	}

	.loop-detail {
		margin: 0 0 0.25rem;
		font-size: 0.85rem;
		color: var(--text-secondary);
	}

	/* Launch Plan */
	.launch-phases {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	.launch-phase {
		background: var(--bg-tertiary);
		border-radius: 12px;
		overflow: hidden;
	}

	.launch-phase.pre { border-left: 4px solid #f59e0b; }
	.launch-phase.active { border-left: 4px solid #10b981; }
	.launch-phase.post { border-left: 4px solid #3b82f6; }

	.phase-header {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 1rem 1.25rem;
		background: var(--bg-secondary);
	}

	.phase-icon {
		font-size: 1.25rem;
	}

	.phase-header h4 {
		margin: 0;
		flex: 1;
		font-size: 1rem;
	}

	.phase-timeline {
		font-size: 0.85rem;
		color: var(--text-secondary);
	}

	.phase-activities {
		padding: 1.25rem;
	}

	.activity-item {
		display: grid;
		grid-template-columns: 2fr 1fr 1fr;
		gap: 1rem;
		padding: 0.75rem;
		background: var(--bg-secondary);
		border-radius: 8px;
		margin-bottom: 0.5rem;
	}

	.activity-name {
		font-weight: 500;
		color: var(--text-primary);
	}

	.activity-goal {
		color: #10b981;
		font-size: 0.85rem;
	}

	.activity-timeline {
		color: var(--text-secondary);
		font-size: 0.85rem;
		text-align: right;
	}

	.launch-details, .post-launch-details {
		padding: 1.25rem;
	}

	.launch-section {
		margin-bottom: 1rem;
	}

	.launch-section:last-child {
		margin-bottom: 0;
	}

	.launch-section .label {
		display: block;
		font-size: 0.75rem;
		text-transform: uppercase;
		color: var(--text-secondary);
		margin-bottom: 0.5rem;
	}

	.tag-list {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.tag {
		padding: 0.35rem 0.75rem;
		background: var(--bg-secondary);
		border-radius: 20px;
		font-size: 0.8rem;
		color: var(--text-primary);
	}

	.launch-section ul {
		margin: 0;
		padding-left: 1.25rem;
	}

	.launch-section li {
		font-size: 0.85rem;
		color: var(--text-primary);
		margin-bottom: 0.25rem;
	}

	/* Customer Success */
	.customer-success-content {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	.first-value-box {
		padding: 1.5rem;
		background: linear-gradient(135deg, rgba(16, 185, 129, 0.1), rgba(59, 130, 246, 0.1));
		border-radius: 10px;
	}

	.first-value-box h4 {
		margin: 0 0 0.75rem;
		color: #10b981;
	}

	.first-value-box p {
		margin: 0 0 1rem;
		font-size: 1rem;
		color: var(--text-primary);
	}

	.fvm-metrics {
		display: flex;
		gap: 2rem;
	}

	.fvm-metrics span {
		font-size: 0.85rem;
		color: var(--text-secondary);
	}

	.onboarding-section h4 {
		margin: 0 0 1rem;
		font-size: 1rem;
	}

	.onboarding-tools {
		margin-bottom: 1rem;
	}

	.onboarding-tools .label {
		font-weight: 600;
		margin-right: 0.5rem;
	}

	.milestones ol {
		margin: 0.5rem 0 0;
		padding-left: 1.25rem;
	}

	.milestones li {
		font-size: 0.9rem;
		color: var(--text-primary);
		margin-bottom: 0.5rem;
	}

	/* North Star & Metrics */
	.north-star-card {
		background: linear-gradient(135deg, rgba(139, 92, 246, 0.15), rgba(59, 130, 246, 0.15));
	}

	.north-star-content {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	.north-star-metric {
		text-align: center;
		padding: 1.5rem;
		background: var(--bg-secondary);
		border-radius: 12px;
	}

	.ns-label {
		display: block;
		font-size: 0.7rem;
		text-transform: uppercase;
		letter-spacing: 1px;
		color: #8b5cf6;
		margin-bottom: 0.5rem;
	}

	.north-star-metric h3 {
		margin: 0;
		font-size: 1.5rem;
		color: var(--text-primary);
	}

	.ns-details {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 1rem;
	}

	.ns-item {
		padding: 1rem;
		background: var(--bg-tertiary);
		border-radius: 8px;
	}

	.ns-item .label {
		display: block;
		font-size: 0.7rem;
		text-transform: uppercase;
		color: var(--text-secondary);
		margin-bottom: 0.25rem;
	}

	.ns-item p {
		margin: 0;
		font-size: 0.9rem;
		color: var(--text-primary);
	}

	.metrics-categories-grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 1.25rem;
	}

	.metrics-list {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.metric-row {
		display: grid;
		grid-template-columns: 1fr 1fr 1fr;
		gap: 0.5rem;
		padding: 0.75rem;
		background: var(--bg-tertiary);
		border-radius: 6px;
		font-size: 0.85rem;
	}

	.metric-name {
		font-weight: 500;
		color: var(--text-primary);
	}

	.metric-current {
		color: var(--text-secondary);
		text-align: center;
	}

	.metric-target {
		color: #10b981;
		text-align: right;
	}

	/* Risks Table */
	.risks-table {
		border: 1px solid var(--border-color);
		border-radius: 10px;
		overflow: hidden;
	}

	.risk-header-row {
		display: grid;
		grid-template-columns: 1.5fr 0.75fr 2fr;
		gap: 1rem;
		padding: 0.75rem 1rem;
		background: var(--bg-tertiary);
		font-size: 0.75rem;
		font-weight: 600;
		text-transform: uppercase;
		color: var(--text-secondary);
	}

	.risk-row {
		display: grid;
		grid-template-columns: 1.5fr 0.75fr 2fr;
		gap: 1rem;
		padding: 1rem;
		border-bottom: 1px solid var(--border-color);
		align-items: center;
	}

	.risk-row:last-child {
		border-bottom: none;
	}

	.risk-name {
		font-weight: 500;
		color: var(--text-primary);
	}

	.risk-impact {
		padding: 0.25rem 0.5rem;
		border-radius: 4px;
		font-size: 0.75rem;
		font-weight: 600;
		text-align: center;
	}

	.risk-impact.high { background: rgba(239, 68, 68, 0.2); color: #ef4444; }
	.risk-impact.medium { background: rgba(245, 158, 11, 0.2); color: #f59e0b; }
	.risk-impact.low { background: rgba(16, 185, 129, 0.2); color: #10b981; }

	.risk-mitigation {
		font-size: 0.85rem;
		color: var(--text-secondary);
	}

	/* Execution Timeline */
	.execution-timeline {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	.month-card {
		background: var(--bg-tertiary);
		border-radius: 12px;
		overflow: hidden;
	}

	.month-header {
		display: flex;
		align-items: center;
		gap: 1rem;
		padding: 1rem 1.25rem;
		background: var(--bg-secondary);
	}

	.month-number {
		padding: 0.5rem 1rem;
		background: linear-gradient(135deg, #8b5cf6, #7c3aed);
		color: white;
		border-radius: 20px;
		font-weight: 700;
		font-size: 0.85rem;
	}

	.month-theme {
		font-weight: 600;
		color: var(--text-primary);
	}

	.month-objectives, .month-actions, .month-metrics {
		padding: 1rem 1.25rem;
		border-bottom: 1px solid var(--border-color);
	}

	.month-metrics {
		border-bottom: none;
	}

	.month-objectives h5, .month-actions h5, .month-metrics h5 {
		margin: 0 0 0.75rem;
		font-size: 0.85rem;
		text-transform: uppercase;
		color: var(--text-secondary);
	}

	.month-objectives ul {
		margin: 0;
		padding-left: 1.25rem;
	}

	.month-objectives li {
		font-size: 0.9rem;
		color: var(--text-primary);
		margin-bottom: 0.5rem;
	}

	.actions-table {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.actions-table .action-row {
		display: grid;
		grid-template-columns: 2fr 1fr 1fr;
		gap: 1rem;
		padding: 0.75rem;
		background: var(--bg-secondary);
		border-radius: 6px;
	}

	.action-text {
		font-size: 0.9rem;
		color: var(--text-primary);
	}

	.action-owner {
		font-size: 0.85rem;
		color: #8b5cf6;
		text-align: center;
	}

	.actions-table .action-timeline {
		font-size: 0.85rem;
		color: var(--text-secondary);
		text-align: right;
	}

	.success-tags {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.success-tag {
		padding: 0.35rem 0.75rem;
		background: rgba(16, 185, 129, 0.15);
		color: #10b981;
		border-radius: 20px;
		font-size: 0.8rem;
	}

	/* VC Slides */
	.vc-slides-grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 1.25rem;
	}

	.vc-slide {
		padding: 1.5rem;
		background: var(--bg-secondary);
		border-radius: 12px;
		border: 1px solid var(--border-color);
		position: relative;
	}

	.vc-slide .slide-number {
		position: absolute;
		top: 1rem;
		right: 1rem;
		font-size: 2rem;
		font-weight: 700;
		color: rgba(139, 92, 246, 0.2);
	}

	.vc-slide h4 {
		margin: 0 0 1rem;
		font-size: 1rem;
		color: #8b5cf6;
		text-transform: uppercase;
	}

	.vc-slide ul {
		margin: 0;
		padding-left: 1.25rem;
	}

	.vc-slide li {
		font-size: 0.85rem;
		color: var(--text-secondary);
		margin-bottom: 0.5rem;
		line-height: 1.5;
	}

	/* GTM Empty State */
	.gtm-empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 3rem;
		text-align: center;
	}

	.empty-icon {
		width: 80px;
		height: 80px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: linear-gradient(135deg, rgba(139, 92, 246, 0.2), rgba(59, 130, 246, 0.2));
		border-radius: 50%;
		margin-bottom: 1.5rem;
	}

	.empty-icon .material-symbols-outlined {
		font-size: 2.5rem;
		color: #8b5cf6;
	}

	.gtm-empty-state h3 {
		margin: 0 0 0.75rem;
		font-size: 1.5rem;
		color: var(--text-primary);
	}

	.gtm-empty-state p {
		margin: 0 0 1.5rem;
		color: var(--text-secondary);
		max-width: 500px;
	}

	.gtm-features {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 1rem;
		list-style: none;
		padding: 0;
		margin: 0;
	}

	.gtm-features li {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.9rem;
		color: var(--text-secondary);
	}

	.gtm-features .material-symbols-outlined {
		color: #10b981;
		font-size: 1.1rem;
	}

	/* GTM Responsive */
	@media (max-width: 1200px) {
		.gtm-state-grid {
			grid-template-columns: repeat(2, 1fr);
		}

		.decisions-grid {
			grid-template-columns: 1fr;
		}

		.gtm-slides {
			grid-template-columns: 1fr;
		}

		.metrics-grid {
			grid-template-columns: repeat(3, 1fr);
		}

		.icp-grid, .ownership-grid, .demand-gen-grid {
			grid-template-columns: repeat(2, 1fr);
		}

		.pricing-tiers, .vc-slides-grid {
			grid-template-columns: 1fr;
		}

		.benefits-grid, .diff-axes-grid {
			grid-template-columns: repeat(2, 1fr);
		}

		.metrics-categories-grid {
			grid-template-columns: 1fr;
		}
	}

	@media (max-width: 992px) {
		.hypotheses-grid {
			grid-template-columns: 1fr;
		}

		.action-row {
			grid-template-columns: 1fr;
			gap: 0.5rem;
		}

		.action-row.header {
			display: none;
		}

		.action-col::before {
			content: attr(data-label);
			font-weight: 600;
			font-size: 0.7rem;
			text-transform: uppercase;
			color: var(--text-secondary);
			display: block;
			margin-bottom: 0.25rem;
		}

		.risks-grid {
			grid-template-columns: 1fr;
		}

		.metrics-grid {
			grid-template-columns: repeat(2, 1fr);
		}
	}

	@media (max-width: 768px) {
		.gtm-header-content {
			flex-direction: column;
		}

		.gtm-philosophy {
			width: 100%;
		}

		.philosophy-item {
			flex: 1;
		}

		.gtm-state-grid {
			grid-template-columns: 1fr;
		}

		.metrics-grid {
			grid-template-columns: 1fr;
		}

		.reset-trigger {
			flex-direction: column;
			align-items: flex-start;
		}
	}
</style>

