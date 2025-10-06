<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';

	let theme = 'light';
	let isScrolled = false;

	const features = [
		{ icon: '💰', title: 'Instant Valuation', description: 'Get real-time valuation using proven methodologies' },
		{ icon: '🎯', title: 'SWOT Analysis', description: 'Strategic analysis of strengths, weaknesses, opportunities, threats' },
		{ icon: '📊', title: 'Market Intelligence', description: 'AI-powered market insights and competitive analysis' },
		{ icon: '🚀', title: 'Funding Schemes', description: 'Personalized government funding recommendations' }
	];

	const testimonials = [
		{ quote: 'Transformed our fundraising strategy completely', name: 'Raj Kumar', role: 'CEO, TechStart' },
		{ quote: 'Best valuation tool for Indian startups', name: 'Priya Sharma', role: 'Founder, GrowthCo' },
		{ quote: 'Saved us months of analysis time', name: 'Amit Patel', role: 'COO, ScaleUp' }
	];

	onMount(() => {
		// Check saved theme preference
		const savedTheme = localStorage.getItem('theme') || 'light';
		setTheme(savedTheme);

		// Handle scroll for navbar
		const handleScroll = () => {
			isScrolled = window.scrollY > 50;
		};
		window.addEventListener('scroll', handleScroll);
		return () => window.removeEventListener('scroll', handleScroll);
	});

	function setTheme(newTheme: string) {
		theme = newTheme;
		document.documentElement.setAttribute('data-theme', newTheme);
		localStorage.setItem('theme', newTheme);
	}

	function toggleTheme() {
		setTheme(theme === 'light' ? 'dark' : 'light');
	}

	function navigateToAuth() {
		goto('/auth/login');
	}
</script>

<svelte:head>
	<title>CoFounder - AI-Powered Startup Valuation</title>
</svelte:head>

<div class="landing-page">
	<!-- Theme Toggle -->
	<button class="theme-toggle" on:click={toggleTheme} aria-label="Toggle theme">
		<span class="material-symbols-outlined">
			{theme === 'light' ? 'flashlight_off' : 'flashlight_on'}
		</span>
	</button>

	<!-- Hero Section -->
	<section class="hero-section">
		<div class="hero-content">
			<div class="logo-section">
				<span class="material-symbols-outlined logo-icon">multimodal_hand_eye</span>
				<h1 class="brand-name">CoFounder</h1>
			</div>
			
			<h2 class="hero-title">
				Your AI-Powered<br />
				<span class="accent-text">Startup Valuation Platform</span>
			</h2>
			
			<p class="hero-subtitle">
				Get instant, data-driven valuations and strategic insights to power your fundraising journey.
			</p>

			<div class="cta-buttons">
				<button class="btn-primary" on:click={navigateToAuth}>
					Get Started <span class="material-symbols-outlined">chevron_right</span>
				</button>
			</div>

			<div class="trust-stats">
				<div class="stat">
					<div class="stat-value">500+</div>
					<div class="stat-label">Startups Valued</div>
				</div>
				<div class="stat">
					<div class="stat-value">₹1000Cr+</div>
					<div class="stat-label">Total Valuations</div>
				</div>
				<div class="stat">
					<div class="stat-value">&lt;2 min</div>
					<div class="stat-label">To Complete</div>
				</div>
			</div>
		</div>
	</section>

	<!-- Features -->
	<section class="features-section">
		<h2 class="section-title">Everything You Need</h2>
		
		<div class="features-grid">
			<div class="feature-card minimal-card">
				<span class="material-symbols-outlined feature-icon">universal_currency_alt</span>
				<h3>Instant Valuation</h3>
				<p>AI-driven methodology tailored for Indian startups</p>
			</div>

			<div class="feature-card minimal-card">
				<span class="material-symbols-outlined feature-icon">balance</span>
				<h3>SWOT Analysis</h3>
				<p>Comprehensive strength and weakness assessment</p>
			</div>

			<div class="feature-card minimal-card">
				<span class="material-symbols-outlined feature-icon">currency_exchange</span>
				<h3>Good vs Bad</h3>
				<p>External opportunities and threats analysis</p>
			</div>

			<div class="feature-card minimal-card">
				<span class="material-symbols-outlined feature-icon">account_balance</span>
				<h3>Funding Schemes</h3>
				<p>Government programs matched to your startup</p>
			</div>

			<div class="feature-card minimal-card">
				<span class="material-symbols-outlined feature-icon">query_stats</span>
				<h3>Marketing Trends</h3>
				<p>Competitor analysis and market insights</p>
			</div>

			<div class="feature-card minimal-card">
				<span class="material-symbols-outlined feature-icon">person</span>
				<h3>Profile & DDQ</h3>
				<p>Your assessment answers and company profile</p>
			</div>

			<div class="feature-card minimal-card">
				<span class="material-symbols-outlined feature-icon">psychology</span>
				<h3>Prometheus AI</h3>
				<p>Strategic advisor for what-if scenarios</p>
			</div>
		</div>
	</section>

	<!-- Footer -->
	<footer class="footer">
		<div class="footer-content">
			<div class="footer-brand">
				<span class="material-symbols-outlined">multimodal_hand_eye</span>
				<span>CoFounder</span>
			</div>
			
			<div class="footer-contact">
				<span class="material-symbols-outlined">mail</span>
				<a href="mailto:reach@stratschool.org">reach@stratschool.org</a>
			</div>
		</div>
		
		<div class="footer-bottom">
			<p>© 2025 CoFounder. All rights reserved.</p>
		</div>
	</footer>
</div>

<style>
	.landing-page {
		min-height: 100vh;
		background: var(--bg-primary);
	}

	.hero-section {
		min-height: 90vh;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 2rem;
	}

	.hero-content {
		max-width: 800px;
		text-align: center;
	}

	.logo-section {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 1rem;
		margin-bottom: 2rem;
	}

	.logo-icon {
		font-size: 3rem;
		color: #D4AF37 !important; /* Always golden in both light and dark mode */
	}

	.brand-name {
		font-size: 2.5rem;
		font-weight: 700;
		color: var(--text-primary);
	}

	.hero-title {
		font-size: clamp(2.5rem, 5vw, 4rem);
		font-weight: 800;
		line-height: 1.2;
		margin-bottom: 1.5rem;
		color: var(--text-primary);
	}

	.accent-text {
		color: var(--accent-primary);
	}

	.hero-subtitle {
		font-size: 1.25rem;
		color: var(--text-secondary);
		margin-bottom: 3rem;
		line-height: 1.6;
	}

	.cta-buttons {
		margin-bottom: 4rem;
	}

	.btn-primary {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 1.125rem;
	}

	.trust-stats {
		display: flex;
		justify-content: center;
		gap: 4rem;
		flex-wrap: wrap;
	}

	.stat {
		text-align: center;
	}

	.stat-value {
		font-size: 2rem;
		font-weight: 800;
		color: var(--accent-primary);
		margin-bottom: 0.5rem;
	}

	.stat-label {
		font-size: 0.875rem;
		color: var(--text-tertiary);
		text-transform: uppercase;
		letter-spacing: 1px;
	}

	.features-section {
		padding: 6rem 2rem;
		background: var(--bg-secondary);
	}

	.section-title {
		text-align: center;
		font-size: 2.5rem;
		font-weight: 800;
		color: var(--text-primary);
		margin-bottom: 4rem;
	}

	.features-grid {
		max-width: 1200px;
		margin: 0 auto;
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
		gap: 2rem;
	}

	.feature-card {
		text-align: center;
		padding: 2.5rem 2rem;
	}

	.feature-icon {
		font-size: 3rem;
		color: var(--accent-primary);
		margin-bottom: 1.5rem;
	}

	.feature-card h3 {
		font-size: 1.25rem;
		font-weight: 700;
		color: var(--text-primary);
		margin-bottom: 1rem;
	}

	.feature-card p {
		color: var(--text-secondary);
		line-height: 1.6;
	}

	.footer {
		background: var(--bg-tertiary);
		padding: 3rem 2rem 2rem;
		border-top: 1px solid var(--border-color);
	}

	.footer-content {
		max-width: 1200px;
		margin: 0 auto 2rem;
		display: flex;
		justify-content: space-between;
		align-items: center;
		flex-wrap: wrap;
		gap: 2rem;
	}

	.footer-brand {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		font-size: 1.5rem;
		font-weight: 700;
		color: var(--text-primary);
	}

	.footer-brand .material-symbols-outlined {
		font-size: 2rem;
		color: #D4AF37 !important; /* Always golden in both light and dark mode */
	}

	.footer-contact {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		color: var(--text-secondary);
	}

	.footer-contact .material-symbols-outlined {
		color: var(--accent-primary);
	}

	.footer-contact a {
		color: var(--text-secondary);
		text-decoration: none;
		transition: color 0.3s ease;
	}

	.footer-contact a:hover {
		color: var(--accent-primary);
	}

	.footer-bottom {
		text-align: center;
		padding-top: 2rem;
		border-top: 1px solid var(--border-color);
		color: var(--text-tertiary);
		font-size: 0.875rem;
	}

	@media (max-width: 768px) {
		.trust-stats {
			gap: 2rem;
		}

		.footer-content {
			flex-direction: column;
			text-align: center;
		}
	}
</style>
