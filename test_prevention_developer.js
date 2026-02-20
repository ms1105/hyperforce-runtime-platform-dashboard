#!/usr/bin/env node

/**
 * Test script for Runtime Availability → Prevention Developer View
 * Tests the structure and content without requiring browser automation
 */

const http = require('http');
const { JSDOM } = require('jsdom');

const TEST_URL = 'http://localhost:8006';

async function fetchPage() {
    return new Promise((resolve, reject) => {
        http.get(TEST_URL, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(data));
        }).on('error', reject);
    });
}

async function runTests() {
    console.log('🧪 Testing Runtime Availability → Prevention Developer View\n');
    console.log('═'.repeat(70));
    
    try {
        // Fetch the HTML
        const html = await fetchPage();
        const dom = new JSDOM(html);
        const doc = dom.window.document;
        
        const results = [];
        let passCount = 0;
        let failCount = 0;
        
        // Helper to add test result
        const test = (name, condition, expected, actual) => {
            const passed = condition;
            if (passed) passCount++;
            else failCount++;
            
            results.push({
                name,
                passed,
                expected,
                actual
            });
        };
        
        // Check 1: Prevention tab exists
        const preventionTab = doc.querySelector('[data-tab="runtime-availability-prevention"]');
        test(
            'Prevention tab navigation item exists',
            preventionTab !== null,
            'Element with data-tab="runtime-availability-prevention"',
            preventionTab ? 'Found' : 'Not found'
        );
        
        // Check 2: Prevention content container exists
        const preventionContent = doc.getElementById('runtime-availability-prevention-content');
        test(
            'Prevention content container exists',
            preventionContent !== null,
            'Element with id="runtime-availability-prevention-content"',
            preventionContent ? 'Found' : 'Not found'
        );
        
        // Check 3: Tab has both view modes
        const tabViewAttr = preventionTab?.getAttribute('data-view');
        test(
            'Prevention tab supports both Exec and Developer views',
            tabViewAttr === 'both',
            'data-view="both"',
            tabViewAttr ? `data-view="${tabViewAttr}"` : 'Attribute not found'
        );
        
        // Check 4: JavaScript file is loaded
        const jsScript = doc.querySelector('script[src*="fkp-dashboard.js"]');
        test(
            'Main JavaScript file is loaded',
            jsScript !== null,
            'Script tag with src containing "fkp-dashboard.js"',
            jsScript ? jsScript.getAttribute('src') : 'Not found'
        );
        
        // Print results
        console.log('\n📊 Test Results:\n');
        
        results.forEach((result, index) => {
            const icon = result.passed ? '✅' : '❌';
            const status = result.passed ? 'PASS' : 'FAIL';
            
            console.log(`${icon} Test ${index + 1}: ${result.name}`);
            console.log(`   Status: ${status}`);
            
            if (!result.passed) {
                console.log(`   Expected: ${result.expected}`);
                console.log(`   Actual: ${result.actual}`);
            }
            console.log('');
        });
        
        console.log('═'.repeat(70));
        console.log(`\n📈 Summary: ${passCount}/${results.length} tests passed`);
        
        if (failCount === 0) {
            console.log('✅ All basic structure tests passed!');
            console.log('\n📝 Note: To fully test Developer view content:');
            console.log('   1. Open http://localhost:8006 in a browser');
            console.log('   2. Click Runtime Availability → Prevention');
            console.log('   3. Click "🔧 Developer View" button');
            console.log('   4. Verify the following structure:\n');
            console.log('   Expected Developer View Structure:');
            console.log('   ─────────────────────────────────────');
            console.log('   • Header: "Hyperforce Runtime Platform (HRP) - Test Inventory"');
            console.log('   • 4 Test Type Cards:');
            console.log('     - 🧑‍💼 Customer Scenario Tests');
            console.log('     - 🔗 Integration Tests');
            console.log('     - 📈 Scale & Perf Tests');
            console.log('     - 🔥 Chaos Tests');
            console.log('   • Product Summary Section');
            console.log('   • Product Filter Dropdown');
            console.log('   • Test Detail Table (changes based on selected test type)');
        } else {
            console.log(`❌ ${failCount} test(s) failed`);
            process.exit(1);
        }
        
    } catch (error) {
        console.error('❌ Error running tests:', error.message);
        console.error('\n💡 Make sure the server is running at http://localhost:8006');
        process.exit(1);
    }
}

// Run tests
runTests();
