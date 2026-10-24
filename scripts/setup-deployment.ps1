# Setup GitHub Secrets for Automated Deployment
# Run this script to configure GitHub Actions for automatic deployment

Write-Host "GitHub Secrets Setup for Automated Deployment" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "BACKEND (RENDER) SECRETS:" -ForegroundColor Yellow
Write-Host "1. Get Render API Key:"
Write-Host "   - Go to: https://dashboard.render.com/account/api-tokens"
Write-Host "   - Create new API token"
Write-Host "   - Secret name: RENDER_API_KEY"
Write-Host ""

Write-Host "2. Get Render Backend Service ID:"
Write-Host "   - Go to: https://dashboard.render.com"
Write-Host "   - Click on your backend service (dhole-sir-backend)"
Write-Host "   - Copy Service ID from URL (srv-xxxxxxxxxxxx)"
Write-Host "   - Secret name: RENDER_BACKEND_SERVICE_ID"
Write-Host ""

Write-Host "FRONTEND (NETLIFY) SECRETS:" -ForegroundColor Yellow
Write-Host "1. Get Netlify Auth Token:"
Write-Host "   - Go to: https://app.netlify.com/user/applications/personal-access-tokens"
Write-Host "   - Create new token"
Write-Host "   - Secret name: NETLIFY_AUTH_TOKEN"
Write-Host ""

Write-Host "2. Get Netlify Site ID:"
Write-Host "   - Go to: https://app.netlify.com/sites"
Write-Host "   - Click on your site (vivekdhole-sir)"
Write-Host "   - Go to Site settings > General"
Write-Host "   - Copy Site ID"
Write-Host "   - Secret name: NETLIFY_SITE_ID"
Write-Host ""

Write-Host "3. API Base URL:"
Write-Host "   - Once backend is deployed to Render, you'll get a URL"
Write-Host "   - Format: https://your-service-name.onrender.com"
Write-Host "   - Secret name: VITE_API_BASE_URL"
Write-Host ""

Write-Host "ENVIRONMENT VARIABLES:" -ForegroundColor Yellow
Write-Host "Add these as GitHub Secrets:"
Write-Host "  RENDER_API_KEY"
Write-Host "  RENDER_BACKEND_SERVICE_ID"
Write-Host "  NETLIFY_AUTH_TOKEN"
Write-Host "  NETLIFY_SITE_ID"
Write-Host "  VITE_API_BASE_URL (set after first deployment)"
Write-Host "  VITE_GROQ_API_KEY (from .env)"
Write-Host "  VITE_GEMINI_API_KEY (from .env)"
Write-Host "  VITE_CLOUDINARY_CLOUD_NAME (from .env)"
Write-Host "  VITE_CLOUDINARY_UPLOAD_PRESET (from .env)"
Write-Host ""

Write-Host "HOW TO ADD SECRETS:" -ForegroundColor Cyan
Write-Host "1. Go to: https://github.com/your-repo/settings/secrets/actions"
Write-Host "2. Click 'New repository secret'"
Write-Host "3. Add Name and Value"
Write-Host "4. Click 'Add secret'"
Write-Host ""

Write-Host "AFTER SETUP:" -ForegroundColor Green
Write-Host "✅ Push code to main branch"
Write-Host "✅ GitHub Actions will automatically deploy backend and frontend"
Write-Host "✅ Check Actions tab for deployment status"
Write-Host ""
