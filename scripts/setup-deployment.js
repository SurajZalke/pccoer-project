#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('\n🚀 Automated Deployment Setup\n');
console.log('======================================\n');

// Check if .github/workflows exist
const workflowsDir = path.join(__dirname, '../.github/workflows');
if (!fs.existsSync(workflowsDir)) {
  console.error('❌ .github/workflows directory not found!');
  process.exit(1);
}

console.log('✅ GitHub Actions workflows created\n');

console.log('📋 NEXT STEPS:\n');

console.log('1️⃣  Get Render API Key & Backend Service ID:');
console.log('   - Visit: https://dashboard.render.com/account/api-tokens');
console.log('   - Create API token, copy it');
console.log('   - Go to backend service, copy Service ID from URL\n');

console.log('2️⃣  Get Netlify Credentials:');
console.log('   - Visit: https://app.netlify.com/user/applications/personal-access-tokens');
console.log('   - Create personal access token');
console.log('   - Go to site settings, copy Site ID\n');

console.log('3️⃣  Add GitHub Secrets:');
console.log('   - Go to: https://github.com/your-repo/settings/secrets/actions');
console.log('   - Add these secrets:');
console.log('     • RENDER_API_KEY');
console.log('     • RENDER_BACKEND_SERVICE_ID');
console.log('     • NETLIFY_AUTH_TOKEN');
console.log('     • NETLIFY_SITE_ID');
console.log('     • VITE_API_BASE_URL (Render backend URL)\n');

console.log('4️⃣  Push to GitHub:');
console.log('   - git add .');
console.log('   - git commit -m "Setup automated deployment"');
console.log('   - git push origin main\n');

console.log('5️⃣  Check Deployment:');
console.log('   - Go to: https://github.com/your-repo/actions');
console.log('   - Monitor build and deployment status\n');

console.log('✅ Setup complete! Deployments will now run automatically on push to main\n');
