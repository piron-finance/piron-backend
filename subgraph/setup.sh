#!/bin/bash

# Piron Finance Goldsky Subgraph Setup Script

set -e

echo "🚀 Piron Finance Goldsky Subgraph Setup"
echo "========================================"

# Check if we're in the right directory
if [ ! -f "subgraph.yaml" ]; then
    echo "❌ Error: subgraph.yaml not found. Run this from the subgraph/ directory."
    exit 1
fi

# Install dependencies
echo ""
echo "📦 Installing dependencies..."
npm install

# Check if ABIs are accessible
if [ ! -d "abis" ]; then
    echo "⚠️  Warning: abis/ directory not found."
    echo "Creating symlink to ../src/contracts/abis..."
    ln -sf ../src/contracts/abis abis
fi

echo "✅ ABIs linked"

# Prompt for start blocks
echo ""
echo "📍 Contract Deployment Blocks"
echo "------------------------------"
echo "You need to update the startBlock values in networks.json"
echo ""
echo "Get deployment blocks from Base Sepolia explorer:"
echo "https://sepolia.basescan.org"
echo ""

read -p "Enter PoolFactory deployment block (or press Enter to skip): " pool_factory_block
read -p "Enter ManagedPoolFactory deployment block (or press Enter to skip): " managed_factory_block
read -p "Enter Manager deployment block (or press Enter to skip): " manager_block
read -p "Enter StableYieldManager deployment block (or press Enter to skip): " stable_manager_block

# Update networks.json if blocks provided
if [ ! -z "$pool_factory_block" ] && [ ! -z "$managed_factory_block" ]; then
    echo "Updating networks.json..."
    
    # Create backup
    cp networks.json networks.json.backup
    
    # Update with provided blocks (simple sed replacement)
    sed -i.tmp "s/\"startBlock\": 10000000/\"startBlock\": $pool_factory_block/" networks.json
    rm -f networks.json.tmp
    
    echo "✅ networks.json updated (backup saved as networks.json.backup)"
else
    echo "⚠️  Skipped networks.json update. You'll need to update startBlock values manually."
fi

# Generate code
echo ""
echo "🔨 Generating TypeScript types..."
npm run codegen

# Build subgraph
echo ""
echo "🏗️  Building subgraph..."
npm run build

echo ""
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Review and update networks.json with correct startBlock values"
echo "2. Deploy to Goldsky: goldsky subgraph deploy piron-finance-base-sepolia/v1.0.0"
echo "3. Configure webhook URL in Goldsky dashboard"
echo "4. Add GOLDSKY_WEBHOOK_SECRET to backend .env"
echo "5. Start Redis: docker run -d -p 6379:6379 redis:alpine"
echo "6. Restart backend to enable webhook processing"
echo ""
echo "📚 See README.md for full deployment instructions"

