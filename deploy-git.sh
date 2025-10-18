#!/bin/bash

set -e  # Exit on any error

echo "🚀 Git-Based Deployment Options for Hyperforce Runtime Platform Dashboard"
echo "========================================================================"

echo ""
echo "Choose your deployment platform:"
echo ""
echo "1) 🐙 GitHub + GitHub Pages (Free, Static + Actions)"
echo "2) 🌐 Netlify (Free tier, Full-stack, Best for React)"
echo "3) ▲ Vercel (Free tier, Optimized for React/Node.js)"
echo "4) 📝 Manual Git setup (Just push to repository)"
echo "5) 📚 View deployment guide"
echo ""

read -p "Enter your choice (1-5): " choice

case $choice in
    1)
        echo "🐙 Deploying to GitHub + GitHub Pages..."
        ./deploy-github.sh
        ;;
    2)
        echo "🌐 Deploying to Netlify..."
        ./deploy-netlify.sh
        ;;
    3)
        echo "▲ Deploying to Vercel..."
        ./deploy-vercel.sh
        ;;
    4)
        echo "📝 Manual Git Setup"
        echo "==================="
        echo ""
        echo "Your code is ready to push to any Git repository!"
        echo ""
        echo "🐙 GitHub:"
        echo "  gh repo create hyperforce-runtime-platform-dashboard --public"
        echo "  git remote add origin https://github.com/USERNAME/hyperforce-runtime-platform-dashboard.git"
        echo "  git push -u origin main"
        echo ""
        echo "🦊 GitLab:"
        echo "  git remote add gitlab https://gitlab.com/USERNAME/hyperforce-runtime-platform-dashboard.git"
        echo "  git push -u gitlab main"
        echo ""
        echo "🪣 Bitbucket:"
        echo "  git remote add bitbucket https://bitbucket.org/USERNAME/hyperforce-runtime-platform-dashboard.git"
        echo "  git push -u bitbucket main"
        echo ""
        echo "✅ Your repository is ready with:"
        echo "  - ✅ Complete React dashboard"
        echo "  - ✅ Express.js API server"
        echo "  - ✅ All CSV data files"
        echo "  - ✅ Deployment configurations"
        echo "  - ✅ Documentation"
        ;;
    5)
        echo "📚 Opening deployment guide..."
        if command -v open &> /dev/null; then
            open GIT-DEPLOYMENT-GUIDE.md
        elif command -v xdg-open &> /dev/null; then
            xdg-open GIT-DEPLOYMENT-GUIDE.md
        else
            echo "📖 Please open: GIT-DEPLOYMENT-GUIDE.md"
        fi
        ;;
    *)
        echo "❌ Invalid choice. Please run the script again."
        exit 1
        ;;
esac

echo ""
echo "✅ Git deployment setup complete!"
echo ""
echo "📝 Your project includes:"
echo "  ✅ Full React TypeScript dashboard"
echo "  ✅ Express.js API server with all endpoints"
echo "  ✅ CSV data integration (6+ data files)"
echo "  ✅ Jupyter notebook data extraction"
echo "  ✅ Executive & Developer views"
echo "  ✅ Mobile-responsive design"
echo "  ✅ Health monitoring endpoints"
echo "  ✅ Multiple deployment configurations"
echo ""
echo "🔗 Git workflow for ongoing development:"
echo "  git add ."
echo "  git commit -m 'Your changes'"
echo "  git push origin main"
echo ""
echo "📚 For detailed instructions, see: GIT-DEPLOYMENT-GUIDE.md"
