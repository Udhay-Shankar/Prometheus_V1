<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { env } from '$env/dynamic/public';

	// API Configuration - use relative URLs in production (same domain)
	const API_URL = typeof window !== 'undefined' && window.location.hostname !== 'localhost' 
		? '' // Use relative URLs in production
		: (env.PUBLIC_VITE_API_URL || import.meta.env.VITE_API_URL || 'http://localhost:3001');

	let isLogin = true;
	let email = '';
	let password = '';
	let founderName = '';
	let companyName = '';
	let linkedIn = '';
	let website = '';
	let instagram = '';
	let other = '';
	let error = '';
	let loading = false;
	let showConfetti = false;
	let toast = { show: false, message: '', type: 'error' }; // error, success, info

	onMount(async () => {
		// Check if user is already logged in with a valid token
		const token = localStorage.getItem('accessToken');
		if (token) {
			// Validate token by making a quick API call
			try {
				const response = await fetch(`${API_URL}/api/auth/validate`, {
					headers: {
						'Authorization': `Bearer ${token}`
					}
				});
				
				if (response.ok) {
					// Token is valid, redirect to dashboard
					goto('/dashboard');
				} else {
					// Token is invalid, clear it
					localStorage.removeItem('accessToken');
					localStorage.removeItem('refreshToken');
					localStorage.removeItem('user');
				}
			} catch (error) {
				// Network error or invalid token, clear it
				console.log('Token validation failed, clearing storage');
				localStorage.removeItem('accessToken');
				localStorage.removeItem('refreshToken');
				localStorage.removeItem('user');
			}
		}
	});

	function showToast(message: string, type: 'error' | 'success' | 'info' = 'error') {
		toast = { show: true, message, type };
		setTimeout(() => {
			toast = { show: false, message: '', type: 'error' };
		}, 4000);
	}

	function triggerConfetti() {
		showConfetti = true;
		setTimeout(() => {
			showConfetti = false;
		}, 5000); // 5 seconds duration for celebration
	}

	function validatePassword(pwd: string): { valid: boolean; errors: string[] } {
		const errors: string[] = [];
		if (pwd.length < 8) errors.push('at least 8 characters');
		if (!/[A-Z]/.test(pwd)) errors.push('one uppercase letter');
		if (!/[a-z]/.test(pwd)) errors.push('one lowercase letter');
		if (!/[0-9]/.test(pwd)) errors.push('one number');
		if (!/[!@#$%^&*(),.?":{}|<>]/.test(pwd)) errors.push('one special character');
		return { valid: errors.length === 0, errors };
	}

	async function handleSubmit() {
		error = '';
		loading = true;

		// Client-side password validation for signup
		if (!isLogin) {
			const pwdValidation = validatePassword(password);
			if (!pwdValidation.valid) {
				showToast(`Password requires: ${pwdValidation.errors.join(', ')}`, 'error');
				loading = false;
				return;
			}
		}

		try {
			const endpoint = isLogin ? '/api/auth/login' : '/api/auth/signup';
			const body = isLogin
				? { email, password }
				: { 
					email, 
					password, 
					name: founderName, 
					companyName,
					socials: {
						linkedIn: linkedIn.trim() || '',
						website: website.trim() || '',
						instagram: instagram.trim() || '',
						other: other.trim() || ''
					}
				};

			const response = await fetch(`${API_URL}${endpoint}`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(body)
			});

			const data = await response.json();

			if (!response.ok) {
				// Handle specific error messages
				if (response.status === 409) {
					showToast('Account already exists with this email. Please login instead.', 'error');
				} else {
					showToast(data.error || 'Authentication failed', 'error');
				}
				throw new Error(data.error || 'Authentication failed');
			}

			// Store tokens
			localStorage.setItem('accessToken', data.accessToken);
			localStorage.setItem('refreshToken', data.refreshToken);
			localStorage.setItem('user', JSON.stringify(data.user));

			// Trigger confetti on successful signup
			if (!isLogin) {
				showToast('Account created successfully! 🎉', 'success');
				triggerConfetti();
				setTimeout(() => {
					goto('/dashboard');
				}, 1500);
			} else {
				showToast('Welcome back! 👋', 'success');
				setTimeout(() => {
					goto('/dashboard');
				}, 800);
			}
		} catch (err: any) {
			error = err.message || 'An error occurred. Please try again.';
		} finally {
			loading = false;
		}
	}

	function toggleMode() {
		isLogin = !isLogin;
		error = '';
		// Clear form fields when switching modes
		email = '';
		password = '';
		founderName = '';
		companyName = '';
		linkedIn = '';
		website = '';
		instagram = '';
		other = '';
	}
</script>

<svelte:head>
	<title>{isLogin ? 'Login' : 'Sign Up'} - Singularity</title>
</svelte:head>

<!-- Toast Notification -->
{#if toast.show}
	<div class="toast toast-{toast.type}">
		<span class="material-symbols-outlined">
			{toast.type === 'success' ? 'check_circle' : toast.type === 'info' ? 'info' : 'error'}
		</span>
		<span>{toast.message}</span>
	</div>
{/if}

{#if showConfetti}
	<div class="confetti-container">
		{#each Array(100) as _, i}
			<div class="confetti-piece" style="
				--delay: {Math.random() * 0.3}s;
				--duration: {0.8 + Math.random() * 0.4}s;
				--left: {Math.random() * 100}%;
				--rotation: {Math.random() * 360}deg;
				--color: {['#D4AF37', '#FFD700', '#FFA500', '#63E1A2', '#4BC98A', '#FF6B6B', '#4ECDC4', '#45B7D1'][Math.floor(Math.random() * 8)]};
			"></div>
		{/each}
	</div>
{/if}

<div class="auth-page">
	<div class="auth-container">
		<div class="auth-card minimal-card">
			<div class="auth-header">
				<div class="logo-section">
					<img src="/logo-dark.png" alt="Singularity" class="logo-icon logo-dark" />
					<img src="/logo-light.png" alt="Singularity" class="logo-icon logo-light" />
					<div class="brand-text">
						<span class="brand-nebulaa">Nebulaa</span>
						<span class="brand-name">Singularity</span>
					</div>
				</div>
				<h2 class="auth-title">{isLogin ? 'Welcome Back' : 'Start Your Journey'}</h2>
				<p class="auth-subtitle">
					{isLogin
						? 'Sign in to access your strategic insights'
						: 'Join founders building the future'}
				</p>
			</div>

			<form on:submit|preventDefault={handleSubmit} class="auth-form">
				{#if !isLogin}
					<div class="form-group">
						<label for="founderName">
							<span class="material-symbols-outlined icon">person</span>
							Founder Name
						</label>
						<input
							type="text"
							id="founderName"
							bind:value={founderName}
							placeholder="Your full name"
							required
						/>
					</div>

					<div class="form-group">
						<label for="companyName">
							<span class="material-symbols-outlined icon">business</span>
							Company Name
						</label>
						<input
							type="text"
							id="companyName"
							bind:value={companyName}
							placeholder="Your company name"
							required
						/>
					</div>
				{/if}

				<div class="form-group">
					<label for="email">
						<span class="material-symbols-outlined icon">mail</span>
						Email Address
					</label>
					<input
						type="email"
						id="email"
						bind:value={email}
						placeholder="founder@company.com"
						required
					/>
				</div>

				<div class="form-group">
					<label for="password">
						<span class="material-symbols-outlined icon">lock</span>
						Password
					</label>
					<input
						type="password"
						id="password"
						bind:value={password}
						placeholder="••••••••"
						required
						minlength="8"
					/>
					{#if !isLogin}
						<p class="password-requirements">
							<span class="material-symbols-outlined info-icon">info</span>
							Min 8 characters with uppercase, lowercase, number & special character (!@#$%^&*)
						</p>
					{/if}
				</div>

				{#if !isLogin}
					<div class="socials-section">
						<h3 class="socials-title">
							<span class="material-symbols-outlined icon">link</span>
							Social Links (Optional)
						</h3>
						
						<div class="form-group">
							<label for="linkedIn">
								<span class="material-symbols-outlined icon">groups</span>
								LinkedIn Profile
							</label>
							<input
								type="url"
								id="linkedIn"
								bind:value={linkedIn}
								placeholder="https://linkedin.com/in/yourprofile"
							/>
						</div>

						<div class="form-group">
							<label for="website">
								<span class="material-symbols-outlined icon">language</span>
								Website
							</label>
							<input
								type="url"
								id="website"
								bind:value={website}
								placeholder="https://yourcompany.com"
							/>
						</div>

						<div class="form-group">
							<label for="instagram">
								<span class="material-symbols-outlined icon">photo_camera</span>
								Instagram
							</label>
							<input
								type="url"
								id="instagram"
								bind:value={instagram}
								placeholder="https://instagram.com/yourprofile"
							/>
						</div>

						<div class="form-group">
							<label for="other">
								<span class="material-symbols-outlined icon">add_link</span>
								Other Link
							</label>
							<input
								type="url"
								id="other"
								bind:value={other}
								placeholder="https://other-platform.com/yourprofile"
							/>
						</div>
					</div>
				{/if}

				{#if error}
					<div class="error-message">
						<span class="material-symbols-outlined icon">error</span>
						{error}
					</div>
				{/if}

				<button type="submit" class="btn-primary submit-btn" disabled={loading}>
					{#if loading}
						<span class="material-symbols-outlined spinning">progress_activity</span>
						Processing...
					{:else if isLogin}
						<span class="material-symbols-outlined icon">login</span>
						Sign In
					{:else}
						<span class="material-symbols-outlined icon">person_add</span>
						Create Account
					{/if}
				</button>
			</form>

			<div class="auth-footer">
				<p class="toggle-text">
					{isLogin ? "Don't have an account?" : 'Already have an account?'}
					<button class="toggle-btn" on:click={toggleMode}>
						{isLogin ? 'Sign Up' : 'Sign In'}
					</button>
				</p>
			</div>
		</div>

		<div class="auth-benefits minimal-card">
			<h3 class="benefits-title">
				<span class="material-symbols-outlined icon">verified</span>
				Why Founders Choose Us
			</h3>
			<div class="benefit-item">
				<span class="material-symbols-outlined benefit-icon">bolt</span>
				<div>
					<h4>Instant Valuations</h4>
					<p>Get comprehensive analysis in under 2 seconds</p>
				</div>
			</div>
			<div class="benefit-item">
				<span class="material-symbols-outlined benefit-icon">psychology</span>
				<div>
					<h4>AI-Powered Insights</h4>
					<p>Real-time market intelligence via Grok API</p>
				</div>
			</div>
			<div class="benefit-item">
				<span class="material-symbols-outlined benefit-icon">trending_up</span>
				<div>
					<h4>Growth Strategies</h4>
					<p>Personalized roadmap for scaling your startup</p>
				</div>
			</div>
		</div>
	</div>
</div>

<style>
	/* Confetti Celebration */
	.confetti-container {
		position: fixed;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		pointer-events: none;
		z-index: 9999;
		overflow: hidden;
	}

	.confetti-piece {
		position: absolute;
		width: 10px;
		height: 10px;
		background: var(--color);
		top: -10%;
		left: var(--left);
		opacity: 1;
		transform: rotate(var(--rotation));
		animation: confetti-fall var(--duration) ease-in var(--delay) forwards;
	}

	@keyframes confetti-fall {
		0% {
			transform: translateY(0) rotate(0deg);
			opacity: 1;
		}
		100% {
			transform: translateY(100vh) rotate(720deg);
			opacity: 0;
		}
	}

	.auth-page {
		min-height: 100vh;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 2rem;
		background: var(--bg-primary);
		transition: background 0.3s ease;
	}

	.auth-container {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 2rem;
		max-width: 1100px;
		width: 100%;
	}

	.auth-card {
		padding: 2.5rem;
		animation: fadeInUp 0.6s ease-out;
	}

	.auth-header {
		text-align: center;
		margin-bottom: 2rem;
	}

	.logo-section {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.75rem;
		margin-bottom: 1.5rem;
	}

	.logo-icon {
		width: 3.5rem;
		height: 3.5rem;
		object-fit: contain;
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
		font-size: 1.5rem;
		color: var(--accent-primary);
		letter-spacing: 0.5px;
		line-height: 1;
	}

	.brand-name {
		font-size: 1.5rem;
		font-weight: 700;
		color: var(--text-primary);
		letter-spacing: 0.5px;
		line-height: 1;
	}

	.auth-title {
		font-size: 1.75rem;
		font-weight: 700;
		color: var(--text-primary);
		margin-bottom: 0.5rem;
	}

	.auth-subtitle {
		color: var(--text-secondary);
		font-size: 0.95rem;
	}

	.auth-form {
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
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-weight: 600;
		color: var(--text-primary);
		font-size: 0.875rem;
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	.form-group label .icon {
		font-size: 1.125rem;
		color: var(--accent-primary);
	}

	.form-group input {
		padding: 0.875rem 1rem;
		border: 1px solid var(--border-color);
		border-radius: 8px;
		background: var(--bg-secondary);
		color: var(--text-primary);
		font-size: 0.95rem;
		transition: all 0.2s ease;
	}

	.form-group input:focus {
		outline: none;
		border-color: var(--accent-primary);
		box-shadow: 0 0 0 3px var(--accent-shadow);
	}

	.form-group input::placeholder {
		color: var(--text-tertiary);
	}

	.password-requirements {
		display: flex;
		align-items: flex-start;
		gap: 0.4rem;
		margin-top: 0.5rem;
		padding: 0.5rem 0.75rem;
		background: rgba(212, 175, 55, 0.08);
		border-radius: 6px;
		border-left: 3px solid var(--accent-primary, #D4AF37);
		font-size: 0.75rem;
		color: var(--text-secondary);
		line-height: 1.4;
	}

	.password-requirements .info-icon {
		font-size: 0.9rem;
		color: var(--accent-primary, #D4AF37);
		flex-shrink: 0;
		margin-top: 0.05rem;
	}

	.socials-section {
		margin-top: 1rem;
		padding-top: 1.5rem;
		border-top: 1px solid var(--border-color);
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.socials-title {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.95rem;
		font-weight: 600;
		color: var(--text-primary);
		margin-bottom: 0.5rem;
	}

	.socials-title .icon {
		font-size: 1.25rem;
		color: var(--accent-primary);
	}

	.submit-btn {
		width: 100%;
		margin-top: 1rem;
		padding: 0.875rem 1.5rem !important;
		font-size: 1rem;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
	}

	.submit-btn .icon {
		font-size: 1.25rem;
	}

	.submit-btn:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.spinning {
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		from { transform: rotate(0deg); }
		to { transform: rotate(360deg); }
	}

	.error-message {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		background: rgba(255, 0, 0, 0.1);
		border: 1px solid rgba(255, 0, 0, 0.3);
		color: #ff6b6b;
		padding: 0.875rem 1rem;
		border-radius: 8px;
		font-size: 0.875rem;
	}

	.error-message .icon {
		font-size: 1.25rem;
	}

	.auth-footer {
		margin-top: 1.5rem;
		text-align: center;
	}

	.toggle-text {
		color: var(--text-secondary);
		font-size: 0.875rem;
	}

	.toggle-btn {
		background: none;
		border: none;
		color: var(--accent-primary);
		font-weight: 600;
		cursor: pointer;
		text-decoration: underline;
		margin-left: 0.5rem;
		transition: color 0.2s ease;
	}

	.toggle-btn:hover {
		color: var(--accent-hover);
	}

	/* Benefits Section */
	.auth-benefits {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
		padding: 2.5rem;
		animation: fadeInUp 0.8s ease-out;
	}

	.benefits-title {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		font-size: 1.5rem;
		font-weight: 700;
		color: var(--text-primary);
		margin-bottom: 0.5rem;
	}

	.benefits-title .icon {
		font-size: 1.75rem;
		color: var(--accent-primary);
	}

	.benefit-item {
		display: flex;
		gap: 1rem;
		align-items: flex-start;
		padding: 1rem;
		border-radius: 8px;
		transition: background 0.2s ease;
	}

	.benefit-item:hover {
		background: var(--bg-secondary);
	}

	.benefit-icon {
		font-size: 2rem;
		min-width: 48px;
		text-align: center;
		color: var(--accent-primary);
	}

	.benefit-item h4 {
		font-size: 1.125rem;
		font-weight: 700;
		color: var(--text-primary);
		margin-bottom: 0.25rem;
	}

	.benefit-item p {
		color: var(--text-secondary);
		line-height: 1.5;
		font-size: 0.9rem;
	}

	/* Toast Notification */
	.toast {
		position: fixed;
		top: 2rem;
		right: 2rem;
		z-index: 9999;
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 1rem 1.5rem;
		border-radius: 12px;
		font-weight: 600;
		font-size: 0.95rem;
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
		animation: slideInRight 0.3s ease-out;
		backdrop-filter: blur(10px);
		max-width: 400px;
	}

	.toast-error {
		background: rgba(239, 68, 68, 0.95);
		color: white;
		border: 1px solid rgba(239, 68, 68, 1);
	}

	.toast-success {
		background: rgba(34, 197, 94, 0.95);
		color: white;
		border: 1px solid rgba(34, 197, 94, 1);
	}

	.toast-info {
		background: rgba(59, 130, 246, 0.95);
		color: white;
		border: 1px solid rgba(59, 130, 246, 1);
	}

	.toast .material-symbols-outlined {
		font-size: 1.5rem;
		flex-shrink: 0;
	}

	@keyframes slideInRight {
		from {
			opacity: 0;
			transform: translateX(100px);
		}
		to {
			opacity: 1;
			transform: translateX(0);
		}
	}

	@keyframes fadeInUp {
		from {
			opacity: 0;
			transform: translateY(20px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	@media (max-width: 968px) {
		.auth-container {
			grid-template-columns: 1fr;
			gap: 1.5rem;
		}

		.auth-benefits {
			order: -1;
		}

		.auth-card {
			padding: 2rem;
		}

		.auth-benefits {
			padding: 2rem;
		}

		.toast {
			top: 1rem;
			right: 1rem;
			left: 1rem;
			max-width: none;
		}
	}
</style>
