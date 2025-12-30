#!/bin/bash

echo "🚀 Quick Deploy to Vercel"
echo "========================="
echo ""

# Check if logged in to Vercel
if ! vercel whoami &> /dev/null; then
    echo "🔐 You need to login to Vercel first..."
    echo "Opening browser for authentication..."
    vercel login

    if [ $? -ne 0 ]; then
        echo "❌ Login failed. Please try again."
        exit 1
    fi
    echo "✅ Login successful"
fi

echo ""
echo "👤 Logged in as: $(vercel whoami)"
echo ""

# Check if project is linked
if [ ! -d .vercel ]; then
    echo "🔗 Linking project to Vercel..."
    echo ""
    echo "   Please answer the prompts:"
    echo "   - Set up and deploy: Yes"
    echo "   - Which scope: Choose your account"
    echo "   - Link to existing project: No"
    echo "   - Project name: hog (or your preferred name)"
    echo "   - Directory: ./"
    echo "   - Override settings: No"
    echo ""

    vercel link

    if [ $? -ne 0 ]; then
        echo "❌ Project linking failed"
        exit 1
    fi

    echo "✅ Project linked"
    echo ""
    echo "⚠️  IMPORTANT: You need to add environment variables!"
    echo ""
    echo "Run these commands to add your environment variables:"
    echo ""
    echo "vercel env add NODE_ENV"
    echo "vercel env add MONGODB_URL"
    echo "vercel env add JWT_SECRET"
    echo "vercel env add GOOGLE_CLIENT_ID"
    echo "vercel env add GOOGLE_CLIENT_SECRET"
    echo "vercel env add PAYSTACK_MAIN_KEY"
    echo "vercel env add IMAGEKIT_PUBLIC_KEY"
    echo "vercel env add IMAGEKIT_PRIVATE_KEY"
    echo "vercel env add IMAGEKIT_URL_ENDPOINT"
    echo "vercel env add EXCHANGE_RATE_API_KEY"
    echo "vercel env add OPEN_EXCHANGE_RATE_API_KEY"
    echo "vercel env add FRONTEND_URL"
    echo ""
    echo "Or use the Vercel dashboard: https://vercel.com/dashboard"
    echo ""
    read -p "Press Enter after adding environment variables..."
fi

echo ""
echo "🚀 Deploying to production..."
vercel --prod

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Deployment successful!"
    echo ""
    echo "🌐 Your API is now live!"
    echo ""
    echo "📝 Next time, just run: vercel --prod"
else
    echo ""
    echo "❌ Deployment failed. Check the error above."
fi
