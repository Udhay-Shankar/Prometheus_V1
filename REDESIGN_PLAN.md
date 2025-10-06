# CoFounder Redesign Implementation Plan

## Status: In Progress

This document tracks the complete redesign from CEO Insight Engine to CoFounder.

## Completed ✅

1. **Global Styles Updated**
   - New color scheme: Light (White/Gold) and Dark (#383838/#63E1A2)
   - Material Icons integration
   - Minimalistic card design
   - Confetti animation styles
   - Gauge/speedometer styles
   - Theme toggle functionality

2. **Landing Page Redesigned**
   - CoFounder branding
   - Material Icons
   - Theme toggle button
   - Minimalistic design
   - Updated footer with contact email

## In Progress 🚧

### Critical Files to Update

1. **Authentication Page** (`src/routes/auth/login/+page.svelte`)
   - Add founder name field
   - Add company name field
   - Add social links (LinkedIn, Website, Instagram, Other)
   - Implement confetti on signup success
   - Update to use new theme colors
   - Material Icons

2. **Backend API** (`server/server.js`)
   - Update user schema to include:
     - `founderName`
     - `companyName`
     - `socials` object
   - Modify signup endpoint
   - Update DDQ schema for new questions
   - Add PESTEL analysis endpoint

3. **Dashboard** (`src/routes/dashboard/+page.svelte`)
   - Complete redesign with new layout
   - Collapsible sidebar with minimize/maximize
   - Material Icons for all navigation
   - New tabs:
     - Overview (with material icon: quick_reference_all)
     - Valuation (with speedometer gauge)
     - Strengths vs Weaknesses
     - Good vs Bad (PESTEL)
     - Government Schemes
     - Profile
     - What-If Analysis
   - Dark/Light mode toggle
   - Save navigation state

4. **New Questions Implementation**
   - 20 new questions with conditional logic
   - Section-based organization
   - Back/Forward navigation
   - Save progress
   - Different paths for revenue vs pre-revenue

## New Question Structure

### Section 1: Business Foundation (5 questions)
1. Product/service name and description
2. Business category (dropdown)
3. Product stage (dropdown)
4. Main competitors (text)
5. Competitive differentiation (textarea)

### Section 2: Market Validation (4 questions)
6. Target customer description
7. Market size estimation
8. Customer interviews completed
9. Paying customers (Yes/No - triggers conditional)

### Section 3A: Revenue (if Q9 = Yes)
10a. Current monthly revenue
11a. Revenue 3 months ago
12a. Total customer count
13a. Average revenue per customer

### Section 3B: Pre-Revenue (if Q9 = No)
10b. Expected first customer timeline
11b. Planned pricing model
12b. Total investment to date
13b. Monthly expenses/burn rate

### Section 4: Team & Operations (3 questions)
14. Team size
15. Founder background (multi-select)
16. Biggest current challenge

### Section 5: Growth Strategy (3 questions)
17. Customer acquisition strategy
18. 6-month primary goal
19. Funding needed

### Section 6: Risk Assessment (1 question)
20. Primary business risk

## Valuation Calculation Updates

### New Scoring Methodology
- Business Stage Score (1-5)
- Market Validation Score (1-5)
- Revenue/Traction Score (1-5)
- Team Score (1-5)
- Risk Score (1-5)

### Speedometer Display
- Arc from 0° to 180°
- Needle animation
- Value ranges:
  - 0-2 Cr: Early stage
  - 2-5 Cr: Growing
  - 5-10 Cr: Established
  - 10+ Cr: Scale-up

## PESTEL Analysis (Good vs Bad Tab)

### External Factors:
- **P**olitical: Government policies, regulations
- **E**conomic: Market conditions, funding environment
- **S**ocial: Consumer trends, demographics
- **T**echnological: Tech trends, innovation
- **E**nvironmental: Sustainability factors
- **L**egal: Compliance, IP laws

## Profile Tab Features

- User information display
- Company details
- Social links
- Assessment history
- Retake assessment button
- Competitor performance trends
- Marketing insights

## Material Icons Mapping

| Feature | Icon Name |
|---------|-----------|
| Logo | multimodal_hand_eye |
| Overview | quick_reference_all |
| Valuation | universal_currency_alt |
| Strengths/Weaknesses | balance |
| Government Schemes | account_balance |
| Good/Bad (PESTEL) | currency_exchange |
| Profile | person |
| What-If | tooltip |
| Navigate Right | chevron_right |
| Navigate Left | chevron_left |
| Minimize Sidebar | left_panel_close |
| Maximize Sidebar | left_panel_open |
| Light Mode | flashlight_on |
| Dark Mode | flashlight_off |
| Contact | mail |

## Next Implementation Steps

1. ✅ Update backend user schema
2. ✅ Update auth page with new fields
3. Update DDQ with new questions
4. Implement conditional question flow
5. Create speedometer valuation component
6. Redesign dashboard layout
7. Implement collapsible sidebar
8. Create PESTEL analysis
9. Build profile page
10. Add competitor trends

## Testing Checklist

- [ ] Theme toggle works
- [ ] Confetti displays on signup
- [ ] Social links save properly
- [ ] DDQ conditional logic works
- [ ] Speedometer displays correctly
- [ ] Sidebar minimize/maximize
- [ ] PESTEL analysis generates
- [ ] Profile data displays
- [ ] Dark/light mode persists
- [ ] All Material Icons load

## Contact Information
Email: reach@stratschool.org
