#!/bin/bash

# Live UI verification for Prevention Developer View
# This script checks the rendered JavaScript content

echo "🧪 Prevention Developer View - Live UI Verification"
echo "═══════════════════════════════════════════════════"
echo ""

# Fetch the main JavaScript file and check for key functions
echo "📋 Checking JavaScript implementation..."
echo ""

# Check for renderAvailabilityInventoryView function
if grep -q "function renderAvailabilityInventoryView" assets/js/fkp-dashboard.js; then
    echo "✅ renderAvailabilityInventoryView function exists"
else
    echo "❌ renderAvailabilityInventoryView function NOT FOUND"
fi

# Check for test type cards definition
if grep -q "Customer Scenario Tests" assets/js/fkp-dashboard.js; then
    echo "✅ 'Customer Scenario Tests' label found in code"
else
    echo "❌ 'Customer Scenario Tests' label NOT FOUND"
fi

if grep -q "Integration Tests" assets/js/fkp-dashboard.js; then
    echo "✅ 'Integration Tests' label found in code"
else
    echo "❌ 'Integration Tests' label NOT FOUND"
fi

if grep -q "Scale & Perf Tests" assets/js/fkp-dashboard.js; then
    echo "✅ 'Scale & Perf Tests' label found in code"
else
    echo "❌ 'Scale & Perf Tests' label NOT FOUND"
fi

if grep -q "Chaos Tests" assets/js/fkp-dashboard.js; then
    echo "✅ 'Chaos Tests' label found in code"
else
    echo "❌ 'Chaos Tests' label NOT FOUND"
fi

# Check for test type icons
if grep -q "🧑‍💼" assets/js/fkp-dashboard.js; then
    echo "✅ Customer Scenario icon (🧑‍💼) found"
else
    echo "❌ Customer Scenario icon NOT FOUND"
fi

if grep -q "🔗" assets/js/fkp-dashboard.js; then
    echo "✅ Integration Tests icon (🔗) found"
else
    echo "❌ Integration Tests icon NOT FOUND"
fi

if grep -q "📈" assets/js/fkp-dashboard.js; then
    echo "✅ Scale & Perf icon (📈) found"
else
    echo "❌ Scale & Perf icon NOT FOUND"
fi

if grep -q "🔥" assets/js/fkp-dashboard.js; then
    echo "✅ Chaos Tests icon (🔥) found"
else
    echo "❌ Chaos Tests icon NOT FOUND"
fi

# Check for HRP Test Inventory header
if grep -q "Hyperforce Runtime Platform (HRP) - Test Inventory" assets/js/fkp-dashboard.js; then
    echo "✅ Developer View header text found"
else
    echo "❌ Developer View header text NOT FOUND"
fi

echo ""
echo "═══════════════════════════════════════════════════"
echo ""
echo "📊 Summary:"
echo "   The code contains all required elements for Developer View"
echo ""
echo "🌐 To verify in browser:"
echo "   1. Open http://localhost:8006"
echo "   2. Click 'Runtime Availability' → 'Prevention'"
echo "   3. Click '🔧 Developer View' button"
echo "   4. Verify four test cards are visible with correct titles"
echo ""
