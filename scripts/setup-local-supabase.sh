#!/bin/bash

echo "🚀 Setting up Local Supabase for Strava Heatmap"
echo "================================================"

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI not found. Installing..."
    npm install -g supabase
else
    echo "✅ Supabase CLI found"
fi

# Check if Docker is running
if ! docker info &> /dev/null; then
    echo "❌ Docker is not running. Please start Docker and try again."
    exit 1
else
    echo "✅ Docker is running"
fi

# Initialize Supabase if not already done
if [ ! -f "supabase/config.toml" ]; then
    echo "📁 Initializing Supabase project..."
    supabase init
else
    echo "✅ Supabase already initialized"
fi

# Start Supabase
echo "🔄 Starting local Supabase..."
supabase start

# Wait a moment for services to start
sleep 5

# Check status
echo "📊 Supabase Status:"
supabase status

echo ""
echo "🎉 Setup complete!"
echo ""
echo "📋 Next steps:"
echo "1. Copy the credentials above to your .env.local file"
echo "2. Run: supabase db reset"
echo "3. Open Supabase Studio: supabase studio"
echo "4. Start your app: npm run dev"
echo ""
echo "🔗 Useful URLs:"
echo "- Supabase Studio: http://127.0.0.1:54323"
echo "- API URL: http://127.0.0.1:54321"
echo ""
echo "📖 For detailed instructions, see: docs/local-supabase-setup.md" 