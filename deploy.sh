#!/bin/bash

# HOG Backend Deployment Script
# This script helps you deploy to Vercel

echo "🚀 HOG Backend Deployment Helper"
echo "================================"
echo ""

# Check if git is initialized
if [ ! -d .git ]; then
    echo "❌ Git is not initialized. Initializing now..."
    git init
    echo "✅ Git initialized"
fi

# Check if there are changes to commit
if [[ -n $(git status -s) ]]; then
    echo "📝 You have uncommitted changes:"
    git status -s
    echo ""
    read -p "Do you want to commit these changes? (y/n): " commit_choice

    if [ "$commit_choice" = "y" ]; then
        read -p "Enter commit message: " commit_msg
        git add .
        git commit -m "$commit_msg"
        echo "✅ Changes committed"
    fi
else
    echo "✅ No uncommitted changes"
fi

# Check if remote is configured
if ! git remote get-url origin > /dev/null 2>&1; then
    echo ""
    echo "❌ No git remote configured"
    read -p "Enter your GitHub repository URL: " repo_url
    git remote add origin "$repo_url"
    echo "✅ Remote added"
fi

# Ask about branch
current_branch=$(git branch --show-current)
echo ""
echo "Current branch: $current_branch"
read -p "Push to this branch? (y/n): " branch_choice

if [ "$branch_choice" = "y" ]; then
    echo "📤 Pushing to GitHub..."
    git push -u origin "$current_branch"
    echo "✅ Pushed to GitHub"
else
    read -p "Enter branch name to push to: " branch_name
    git push -u origin "$branch_name"
    echo "✅ Pushed to GitHub"
fi

echo ""
echo "✨ Next steps:"
echo "1. Go to https://vercel.com"
echo "2. Click 'Add New Project'"
echo "3. Import your GitHub repository"
echo "4. Add environment variables (see DEPLOYMENT.md)"
echo "5. Click 'Deploy'"
echo ""
echo "📖 Read DEPLOYMENT.md for detailed instructions"
echo ""
