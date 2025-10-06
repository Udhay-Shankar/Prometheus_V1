# API Testing Guide

## Testing with cURL (PowerShell)

### 1. Sign Up

```powershell
$body = @{
    email = "test@example.com"
    password = "test123"
    name = "Test CEO"
    companyName = "Test Ventures"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:3001/api/auth/signup" -Method POST -Body $body -ContentType "application/json"
```

### 2. Login

```powershell
$body = @{
    email = "test@example.com"
    password = "test123"
} | ConvertTo-Json

$response = Invoke-RestMethod -Uri "http://localhost:3001/api/auth/login" -Method POST -Body $body -ContentType "application/json"
$token = $response.accessToken
Write-Host "Token: $token"
```

### 3. Save DDQ Response

```powershell
$headers = @{
    "Authorization" = "Bearer $token"
    "Content-Type" = "application/json"
}

$body = @{
    responses = @(
        @{ question = "Team experience?"; answer = "Strong experience"; category = "Team" }
    )
    scores = @{
        teamScore = 4
        productScore = 3
        marketScore = 4
        salesScore = 2
        financingScore = 3
        competitiveScore = 4
    }
} | ConvertTo-Json -Depth 10

Invoke-RestMethod -Uri "http://localhost:3001/api/ddq/save" -Method POST -Headers $headers -Body $body
```

### 4. Calculate Valuation

```powershell
$headers = @{
    "Authorization" = "Bearer $token"
    "Content-Type" = "application/json"
}

$body = @{
    scores = @{
        teamScore = 4
        productScore = 3
        marketScore = 4
        salesScore = 2
        financingScore = 3
        competitiveScore = 4
    }
    companyStage = "seed"
    revenue = 1000000
    fundingNeeded = 5000000
} | ConvertTo-Json -Depth 10

Invoke-RestMethod -Uri "http://localhost:3001/api/valuation/calculate" -Method POST -Headers $headers -Body $body
```

### 5. Get SWOT Analysis

```powershell
$headers = @{
    "Authorization" = "Bearer $token"
    "Content-Type" = "application/json"
}

$body = @{
    companyData = @{
        stage = "seed"
        teamScore = 4
        productScore = 3
        marketScore = 4
        revenue = 1000000
    }
    industry = "Technology"
    competitors = @("Competitor1", "Competitor2")
} | ConvertTo-Json -Depth 10

Invoke-RestMethod -Uri "http://localhost:3001/api/analysis/swot" -Method POST -Headers $headers -Body $body
```

### 6. Get Funding Schemes

```powershell
$headers = @{
    "Authorization" = "Bearer $token"
    "Content-Type" = "application/json"
}

$body = @{
    companyProfile = @{
        stage = "seed"
        industry = "Technology"
        incorporationDate = "2024-01-01"
        revenue = 1000000
        techFocus = "AI/ML"
        location = "Karnataka"
    }
} | ConvertTo-Json -Depth 10

Invoke-RestMethod -Uri "http://localhost:3001/api/analysis/funding-schemes" -Method POST -Headers $headers -Body $body
```

## Testing with Postman

### Collection Setup

1. Create a new collection "CEO Insight Engine"
2. Add environment variable `baseUrl` = `http://localhost:3001`
3. Add environment variable `token` (will be set after login)

### Requests

#### 1. Sign Up
```
POST {{baseUrl}}/api/auth/signup
Content-Type: application/json

{
  "email": "ceo@example.com",
  "password": "securepass123",
  "name": "Priya Sharma",
  "companyName": "TechVentures India"
}
```

#### 2. Login
```
POST {{baseUrl}}/api/auth/login
Content-Type: application/json

{
  "email": "ceo@example.com",
  "password": "securepass123"
}

# Save accessToken to environment variable 'token'
```

#### 3. Get Latest DDQ
```
GET {{baseUrl}}/api/ddq/latest
Authorization: Bearer {{token}}
```

#### 4. Save DDQ
```
POST {{baseUrl}}/api/ddq/save
Authorization: Bearer {{token}}
Content-Type: application/json

{
  "responses": [
    {
      "question": "How would you describe your founding team's experience?",
      "answer": "Strong experience",
      "category": "Team and Execution"
    }
  ],
  "scores": {
    "teamScore": 4,
    "productScore": 3,
    "marketScore": 4,
    "salesScore": 2,
    "financingScore": 3,
    "competitiveScore": 4
  }
}
```

#### 5. Calculate Valuation
```
POST {{baseUrl}}/api/valuation/calculate
Authorization: Bearer {{token}}
Content-Type: application/json

{
  "scores": {
    "teamScore": 4,
    "productScore": 3,
    "marketScore": 4,
    "salesScore": 2,
    "financingScore": 3,
    "competitiveScore": 4
  },
  "companyStage": "seed",
  "revenue": 1000000,
  "fundingNeeded": 5000000
}
```

## Browser Testing

### Using Browser Console

Open http://localhost:5173 and use browser DevTools console:

```javascript
// Sign up
const signup = await fetch('http://localhost:3001/api/auth/signup', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'test@example.com',
    password: 'test123',
    name: 'Test User',
    companyName: 'Test Co'
  })
});
const signupData = await signup.json();
console.log(signupData);

// Login
const login = await fetch('http://localhost:3001/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'test@example.com',
    password: 'test123'
  })
});
const loginData = await login.json();
const token = loginData.accessToken;
console.log('Token:', token);

// Calculate Valuation
const valuation = await fetch('http://localhost:3001/api/valuation/calculate', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    scores: {
      teamScore: 4,
      productScore: 3,
      marketScore: 4,
      salesScore: 2,
      financingScore: 3,
      competitiveScore: 4
    },
    companyStage: 'seed',
    revenue: 1000000,
    fundingNeeded: 5000000
  })
});
const valuationData = await valuation.json();
console.log('Valuation:', valuationData);
```

## Expected Responses

### Successful Sign Up
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "email": "test@example.com",
    "name": "Test CEO",
    "companyName": "Test Ventures"
  }
}
```

### Successful Login
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "email": "test@example.com",
    "name": "Test CEO",
    "companyName": "Test Ventures"
  }
}
```

### Valuation Response
```json
{
  "berkusValuation": 1560000,
  "scorecardValuation": 76300000,
  "finalValuationINR": 53878000,
  "finalValuationUSD": 649012,
  "scorecardMultipliers": {
    "team": 0.2,
    "market": 0.16,
    "product": 0.108,
    "sales": 0.06,
    "financing": 0.06,
    "competitive": 0.096
  },
  "berkusFactors": {
    "soundIdea": 300000,
    "qualityTeam": 400000,
    "prototype": 300000,
    "strategicRelationships": 400000,
    "productRollout": 160000
  },
  "calculatedAt": "2025-10-05T13:30:00.000Z"
}
```

## Error Responses

### Invalid Credentials
```json
{
  "error": "Invalid credentials"
}
```

### Unauthorized
```json
{
  "error": "Access token required"
}
```

### User Already Exists
```json
{
  "error": "User already exists"
}
```

## Health Check

```powershell
# Check if backend is running
Invoke-RestMethod -Uri "http://localhost:3001/api/health" -Method GET
```

If you get a connection error, the server is not running. Start it with:

```powershell
cd "C:\Users\udhay\OneDrive\Desktop\AI Cofounder  Grok\ceo-insight-engine\server"
node server.js
```
