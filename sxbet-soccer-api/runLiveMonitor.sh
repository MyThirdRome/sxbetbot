#!/bin/bash

# Production script to run live monitor continuously
# Usage: ./runLiveMonitor.sh

echo "🚀 Starting SX.bet Live Monitor"
echo "================================"
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "❌ Error: .env file not found"
    echo "Please create .env with your PRIVATE_KEY and SX_BET_API_KEY"
    exit 1
fi

# Check if node_modules exists
if [ ! -d node_modules ]; then
    echo "📦 Installing dependencies..."
    npm install
    echo ""
fi

# Run with auto-restart on failure
while true; do
    echo "▶️  Starting monitor at $(date)"
    node ablyLiveMonitor.js
    
    EXIT_CODE=$?
    
    if [ $EXIT_CODE -eq 0 ]; then
        echo "✅ Bet placed successfully! Exiting."
        break
    else
        echo "⚠️  Process exited with code $EXIT_CODE"
        echo "🔄 Restarting in 5 seconds..."
        sleep 5
    fi
done

echo ""
echo "👋 Monitor stopped"
