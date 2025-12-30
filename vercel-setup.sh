#!/bin/bash

echo "🚀 HOG Backend - Vercel Setup Script"
echo "===================================="
echo ""

# Step 1: Check if vercel is installed
if ! command -v vercel &> /dev/null; then
    echo "❌ Vercel CLI not found. Installing..."
    npm install -g vercel
    echo "✅ Vercel CLI installed"
else
    echo "✅ Vercel CLI found ($(vercel --version))"
fi

echo ""
echo "📝 Next steps:"
echo ""
echo "1. Run: vercel login"
echo "   (This will open your browser to authenticate)"
echo ""
echo "2. Run: vercel"
echo "   (This will link your project and create a preview deployment)"
echo ""
echo "3. Add environment variables:"
echo "   Run the commands below one by one:"
echo ""
echo "   vercel env add NODE_ENV production"
echo "   vercel env add MONGODB_URL production"
echo "   vercel env add JWT_SECRET production"
echo "   vercel env add GOOGLE_CLIENT_ID production"
echo "   vercel env add GOOGLE_CLIENT_SECRET production"
echo "   vercel env add PAYSTACK_MAIN_KEY production"
echo "   vercel env add IMAGEKIT_PUBLIC_KEY production"
echo "   vercel env add IMAGEKIT_PRIVATE_KEY production"
echo "   vercel env add IMAGEKIT_URL_ENDPOINT production"
echo "   vercel env add EXCHANGE_RATE_API_KEY production"
echo "   vercel env add OPEN_EXCHANGE_RATE_API_KEY production"
echo "   vercel env add FRONTEND_URL production"
echo ""
echo "4. Deploy to production:"
echo "   vercel --prod"
echo ""
echo "🎯 After setup, you can always deploy with just: vercel --prod"
echo ""
