# PowerShell script for setting up Local Supabase

Write-Host "🚀 Setting up Local Supabase for Strava Heatmap" -ForegroundColor Green
Write-Host "================================================" -ForegroundColor Green

# Check if Supabase CLI is installed
try {
    $null = Get-Command supabase -ErrorAction Stop
    Write-Host "✅ Supabase CLI found" -ForegroundColor Green
} catch {
    Write-Host "❌ Supabase CLI not found. Installing..." -ForegroundColor Yellow
    npm install -g supabase
}

# Check if Docker is running
try {
    docker info | Out-Null
    Write-Host "✅ Docker is running" -ForegroundColor Green
} catch {
    Write-Host "❌ Docker is not running. Please start Docker and try again." -ForegroundColor Red
    exit 1
}

# Initialize Supabase if not already done
if (-not (Test-Path "supabase/config.toml")) {
    Write-Host "📁 Initializing Supabase project..." -ForegroundColor Yellow
    supabase init
} else {
    Write-Host "✅ Supabase already initialized" -ForegroundColor Green
}

# Start Supabase
Write-Host "🔄 Starting local Supabase..." -ForegroundColor Yellow
supabase start

# Wait a moment for services to start
Start-Sleep -Seconds 5

# Check status
Write-Host "📊 Supabase Status:" -ForegroundColor Cyan
supabase status

Write-Host ""
Write-Host "🎉 Setup complete!" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Next steps:" -ForegroundColor Yellow
Write-Host "1. Copy the credentials above to your .env.local file"
Write-Host "2. Run: supabase db reset"
Write-Host "3. Open Supabase Studio: supabase studio"
Write-Host "4. Start your app: npm run dev"
Write-Host ""
Write-Host "🔗 Useful URLs:" -ForegroundColor Cyan
Write-Host "- Supabase Studio: http://127.0.0.1:54323"
Write-Host "- API URL: http://127.0.0.1:54321"
Write-Host ""
Write-Host "📖 For detailed instructions, see: docs/local-supabase-setup.md" -ForegroundColor Blue 