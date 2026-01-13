/**
 * Cost to Serve JavaScript Functions
 * Extracted from bin-packing dashboard for HRP 360 integration
 */

// Make formatCurrency available globally (it's already defined in index.html)
// All functions assume formatCurrency is available

// Render Exec View
function renderExecView(data) {
    const execViewDiv = document.getElementById('hcp-cts-exec-view');
    const loadingDiv = document.getElementById('hcp-cts-loading');
    
    if (!execViewDiv) {
        console.error('Could not find hcp-cts-exec-view element');
        return;
    }
    
    if (loadingDiv) {
        loadingDiv.style.display = 'none';
    }
    execViewDiv.style.display = 'block';
    
    console.log('Rendering Exec View with data:', data);
    
    const months = ['Feb', 'Mar', 'Apr', 'May', 'June', 'July', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan'];
    
    // Calculate totals - use exact values from source of truth
    const totalOriginal = 8.17; // $8.17M - Original Estimate
    const totalForecast = 6.26; // $6.26M - Revised Estimate  
    const totalActual = 6.25; // $6.25M - Realized Savings
    const variance = totalActual - totalForecast; // -$0.01M
    const variancePercent = totalForecast > 0 ? ((variance / totalForecast) * 100).toFixed(2) : 0;
    const achievementRate = totalForecast > 0 ? ((totalActual / totalForecast) * 100).toFixed(2) : 0;
    
    // Executive Summary Cards
    let execHTML = `
        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 1.5rem; margin-bottom: 2rem;">
            <div class="exec-metric-card" style="border-left-color: #3182ce;">
                <div class="exec-metric-label">Total Predicted Savings</div>
                <div class="exec-metric-value" style="color: #3182ce;">${formatCurrency(totalForecast)}</div>
                <div style="font-size: 0.875rem; color: #718096; margin-top: 0.5rem;">FY26 Forecast</div>
            </div>
            <div class="exec-metric-card" style="border-left-color: #059669;">
                <div class="exec-metric-label">Total Actual Savings</div>
                <div class="exec-metric-value" style="color: #059669;">${formatCurrency(totalActual)}</div>
                <div style="font-size: 0.875rem; color: #718096; margin-top: 0.5rem;">Realized Savings</div>
            </div>
            <div class="exec-metric-card" style="border-left-color: ${variance >= 0 ? '#059669' : '#dc2626'};">
                <div class="exec-metric-label">Variance</div>
                <div class="exec-metric-value" style="color: ${variance >= 0 ? '#059669' : '#dc2626'};">
                    ${variance >= 0 ? '+' : ''}${formatCurrency(variance)}
                </div>
                <div style="font-size: 0.875rem; color: #718096; margin-top: 0.5rem;">
                    ${variancePercent >= 0 ? '+' : ''}${variancePercent}% vs Forecast
                </div>
            </div>
            <div class="exec-metric-card" style="border-left-color: #7c3aed;">
                <div class="exec-metric-label">Achievement Rate</div>
                <div class="exec-metric-value" style="color: #7c3aed;">${achievementRate}%</div>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${Math.min(achievementRate, 100)}%;"></div>
                </div>
            </div>
        </div>
    `;
    
    // Cumulative Initiatives Stacked Chart
    execHTML += `
        <div class="exec-chart-container" style="margin-top: 2rem;">
            <h3 style="font-size: 1.25rem; font-weight: 600; color: #2c3e50; margin-bottom: 0.5rem;">FY26 HCP CTS</h3>
            <p style="font-size: 0.875rem; color: #718096; margin-bottom: 1.5rem;">Monthly Cumulative All Initiatives Savings</p>
            <div style="margin-bottom: 2rem;">
                <canvas id="cumulative-initiatives-chart" style="max-height: 450px;"></canvas>
            </div>
        </div>
    `;
    
    // Initiative Performance Charts - Small Multiples
    execHTML += `
        <div class="exec-chart-container" style="margin-top: 2rem;">
            <h3 style="font-size: 1.25rem; font-weight: 600; color: #2c3e50; margin-bottom: 1.5rem;">Initiative Performance Trends</h3>
            <p style="font-size: 0.875rem; color: #718096; margin-bottom: 1.5rem;">Original Estimate vs Actuals by Initiative</p>
            <div id="initiative-charts-grid" style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 2rem; margin-bottom: 2rem;">
                <!-- Individual initiative charts will be rendered here -->
            </div>
        </div>
    `;
    
    // Calculate monthly totals for chart
    const originalMonthly = {};
    const revisedMonthly = {};
    const actualsMonthly = {};
    
    // Use correct Original Forecast values (in millions)
    const originalForecastData = {
        'Feb': 0, 'Mar': 0, 'Apr': 0, 'May': 0,
        'June': 0.83, 'July': 0.84, 'Aug': 0.96, 'Sep': 1.01,
        'Oct': 1.05, 'Nov': 1.10, 'Dec': 1.18, 'Jan': 1.20
    };
    
    // Use correct Revised Forecast values (in millions)
    const revisedForecastData = {
        'Feb': 0.02567565, 'Mar': 0.02604765, 'Apr': 0.13509684, 'May': 0.27098303,
        'June': 0.42167534, 'July': 0.53090595, 'Aug': 0.64357525, 'Sep': 0.68839906,
        'Oct': 0.82882302, 'Nov': 0.87023289, 'Dec': 0.90473725, 'Jan': 0.91289425
    };
    
    // Use correct Actuals values (in millions)
    const actualsData = {
        'Feb': 0.02567565, 'Mar': 0.02604765, 'Apr': 0.13509684, 'May': 0.27098303,
        'June': 0.42167534, 'July': 0.53090595, 'Aug': 0.64357525, 'Sep': 0.68839906,
        'Oct': 0.82882302, 'Nov': 0.87023289, 'Dec': 0.90473725, 'Jan': 0.90473725
    };
    
    months.forEach(month => {
        originalMonthly[month] = originalForecastData[month] || 0;
        revisedMonthly[month] = revisedForecastData[month] || 0;
        actualsMonthly[month] = actualsData[month] || 0;
    });
    
    execViewDiv.innerHTML = execHTML;
    
    // Render charts (passing monthly data calculated above)
    // Note: These functions need to be defined - they're in the bin-packing dashboard
    // For now, we'll add them below
    setTimeout(() => {
        renderCumulativeInitiativesChart(data, months);
        renderInitiativeSmallMultiples();
    }, 100);
}

// Render Cumulative Initiatives Chart
function renderCumulativeInitiativesChart(data, months) {
    const ctx = document.getElementById('cumulative-initiatives-chart');
    if (!ctx) return;
    
    if (window.cumulativeInitiativesChart) {
        window.cumulativeInitiativesChart.destroy();
    }
    
    const initiativesData = [
        { name: 'Improve Bin Packing with Karpenter- Platform', data: [0, 0, 0.06, 0.24, 0.49, 0.76, 1.03, 1.30, 1.58, 1.85, 2.13, 2.41], color: '#3182ce' },
        { name: 'Rightsizing of HCP AddOns- Platform', data: [0, 0, 0.02, 0.04, 0.11, 0.22, 0.37, 0.52, 0.80, 1.13, 1.49, 1.84], color: '#dc2626' },
        { name: 'OVP EBS Prune', data: [0, 0, 0.04, 0.07, 0.11, 0.18, 0.25, 0.36, 0.46, 0.56, 0.66, 0.76], color: '#fbbf24' },
        { name: 'Mesh / IG- Platform', data: [0, 0, 0, 0, 0.04, 0.08, 0.18, 0.31, 0.43, 0.56, 0.68, 0.81], color: '#059669' },
        { name: 'Decom of Redundant Compute- Tenant', data: [0.03, 0.05, 0.08, 0.10, 0.14, 0.17, 0.22, 0.26, 0.30, 0.34, 0.38, 0.43], color: '#f59e0b' }
    ];
    
    const monthLabels = months.map(m => {
        const monthNames = { 'Feb': 'Feb', 'Mar': 'Mar', 'Apr': 'Apr', 'May': 'May', 'June': 'Jun', 'July': 'Jul', 'Aug': 'Aug', 'Sep': 'Sep', 'Oct': 'Oct', 'Nov': 'Nov', 'Dec': 'Dec', 'Jan': 'Jan' };
        return monthNames[m] || m;
    });
    
    const datasets = initiativesData.map((initiative) => ({
        label: initiative.name.length > 40 ? initiative.name.substring(0, 40) + '...' : initiative.name,
        data: initiative.data,
        backgroundColor: initiative.color,
        borderColor: initiative.color,
        borderWidth: 1
    }));
    
    datasets.push({
        label: 'Predicted Savings',
        data: monthLabels.map(() => 6.26),
        type: 'line',
        borderColor: '#9ca3af',
        borderWidth: 2,
        borderDash: [5, 5],
        fill: false,
        pointRadius: 0,
        pointHoverRadius: 0,
        order: 0,
        yAxisID: 'y'
    });
    
    window.cumulativeInitiativesChart = new Chart(ctx, {
        type: 'bar',
        data: { labels: monthLabels, datasets: datasets },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    labels: {
                        font: { family: "'Salesforce Sans', sans-serif", size: 11, weight: '500' },
                        padding: 15,
                        usePointStyle: true,
                        pointStyle: 'circle',
                        boxWidth: 12
                    }
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    padding: 12,
                    titleFont: { family: "'Salesforce Sans', sans-serif", size: 13, weight: '600' },
                    bodyFont: { family: "'Salesforce Sans', sans-serif", size: 12 },
                    callbacks: {
                        label: function(context) {
                            return (context.dataset.label || '') + ': ' + formatCurrency(context.parsed.y);
                        },
                        footer: function(tooltipItems) {
                            let total = 0;
                            tooltipItems.forEach(item => {
                                if (item.dataset.label !== 'Predicted Savings') {
                                    total += item.parsed.y || 0;
                                }
                            });
                            return 'Total: ' + formatCurrency(total);
                        }
                    }
                }
            },
            scales: {
                x: {
                    stacked: true,
                    ticks: { font: { family: "'Salesforce Sans', sans-serif", size: 11 }, color: '#4a5568' },
                    grid: { display: false, drawBorder: false },
                    title: { display: true, text: 'Initiatives', font: { family: "'Salesforce Sans', sans-serif", size: 12, weight: '600' }, color: '#2c3e50', padding: { top: 10, bottom: 10 } }
                },
                y: {
                    stacked: true,
                    beginAtZero: true,
                    max: 8.0,
                    ticks: {
                        stepSize: 2.0,
                        callback: function(value) {
                            let valueInMillions = value < 1000 ? value : (value < 1000000 ? value / 1000 : value / 1000000);
                            return `$${valueInMillions.toFixed(2)}M`;
                        },
                        font: { family: "'Salesforce Sans', sans-serif", size: 11 },
                        color: '#4a5568'
                    },
                    grid: { color: '#e2e8f0', drawBorder: false },
                    title: { display: true, text: 'Cumulative Savings ($M)', font: { family: "'Salesforce Sans', sans-serif", size: 12, weight: '600' }, color: '#2c3e50', padding: { top: 10, bottom: 10 } }
                }
            }
        }
    });
}

// Render Cumulative Forecast vs Actuals Chart
function renderCumulativeForecastActualsChart(data, months, originalMonthly, revisedMonthly, actualsMonthly) {
    const ctx = document.getElementById('cumulative-forecast-actuals-chart');
    if (!ctx) return;
    
    if (window.cumulativeForecastActualsChart) {
        window.cumulativeForecastActualsChart.destroy();
    }
    
    const originalForecastData = { 'Feb': 0, 'Mar': 0, 'Apr': 0, 'May': 0, 'June': 0.83, 'July': 0.84, 'Aug': 0.96, 'Sep': 1.01, 'Oct': 1.05, 'Nov': 1.10, 'Dec': 1.18, 'Jan': 1.20 };
    const revisedForecastData = { 'Feb': 0.02567565, 'Mar': 0.02604765, 'Apr': 0.13509684, 'May': 0.27098303, 'June': 0.42167534, 'July': 0.53090595, 'Aug': 0.64357525, 'Sep': 0.68839906, 'Oct': 0.82882302, 'Nov': 0.87023289, 'Dec': 0.90473725, 'Jan': 0.91289425 };
    const actualsDataChart = { 'Feb': 0.02567565, 'Mar': 0.02604765, 'Apr': 0.13509684, 'May': 0.27098303, 'June': 0.42167534, 'July': 0.53090595, 'Aug': 0.64357525, 'Sep': 0.68839906, 'Oct': 0.82882302, 'Nov': 0.87023289, 'Dec': 0.90473725, 'Jan': 0.90473725 };
    
    let originalCumulative = 0, revisedCumulative = 0, actualsCumulative = 0;
    const originalCumulativeData = months.map(m => { originalCumulative += originalForecastData[m] || originalMonthly[m] || 0; return originalCumulative; });
    const revisedCumulativeData = months.map(m => { revisedCumulative += revisedForecastData[m] || revisedMonthly[m] || 0; return revisedCumulative; });
    const actualsCumulativeData = months.map(m => { actualsCumulative += actualsDataChart[m] || actualsMonthly[m] || 0; return actualsCumulative; });
    
    const monthLabels = months.map(m => {
        const monthNames = { 'Feb': 'Feb', 'Mar': 'Mar', 'Apr': 'Apr', 'May': 'May', 'June': 'Jun', 'July': 'Jul', 'Aug': 'Aug', 'Sep': 'Sep', 'Oct': 'Oct', 'Nov': 'Nov', 'Dec': 'Dec', 'Jan': 'Jan' };
        return monthNames[m] || m;
    });
    
    window.cumulativeForecastActualsChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: monthLabels,
            datasets: [
                { label: 'Cumulative Original Forecast', data: originalCumulativeData, borderColor: '#9ca3af', backgroundColor: 'rgba(156, 163, 175, 0.1)', borderWidth: 3, fill: false, tension: 0.4, pointRadius: 4, pointHoverRadius: 6, pointBackgroundColor: '#9ca3af', pointBorderColor: '#ffffff', pointBorderWidth: 2 },
                { label: 'Cumulative Revised Forecast', data: revisedCumulativeData, borderColor: '#3182ce', backgroundColor: 'rgba(49, 130, 206, 0.1)', borderWidth: 3, borderDash: [5, 5], fill: false, tension: 0.4, pointRadius: 4, pointHoverRadius: 6, pointBackgroundColor: '#3182ce', pointBorderColor: '#ffffff', pointBorderWidth: 2 },
                { label: 'Cumulative Actuals', data: actualsCumulativeData, borderColor: '#059669', backgroundColor: 'rgba(5, 150, 105, 0.1)', borderWidth: 3, fill: false, tension: 0.4, pointRadius: 4, pointHoverRadius: 6, pointBackgroundColor: '#059669', pointBorderColor: '#ffffff', pointBorderWidth: 2 }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { display: true, position: 'top', labels: { font: { family: "'Salesforce Sans', sans-serif", size: 13, weight: '500' }, padding: 20, usePointStyle: true, pointStyle: 'circle' } },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    padding: 12,
                    titleFont: { family: "'Salesforce Sans', sans-serif", size: 13, weight: '600' },
                    bodyFont: { family: "'Salesforce Sans', sans-serif", size: 12 },
                    callbacks: {
                        label: function(context) { return (context.dataset.label || '') + ': ' + formatCurrency(context.parsed.y); },
                        title: function(context) { return 'Month: ' + context[0].label; }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            let valueInMillions = value < 1000 ? value : (value < 1000000 ? value / 1000 : value / 1000000);
                            return `$${valueInMillions.toFixed(2)}M`;
                        },
                        font: { family: "'Salesforce Sans', sans-serif", size: 11 },
                        color: '#4a5568'
                    },
                    grid: { color: '#e2e8f0', drawBorder: false },
                    title: { display: true, text: 'Cumulative Savings ($M)', font: { family: "'Salesforce Sans', sans-serif", size: 12, weight: '600' }, color: '#2c3e50', padding: { top: 10, bottom: 10 } }
                },
                x: {
                    ticks: { font: { family: "'Salesforce Sans', sans-serif", size: 11 }, color: '#4a5568' },
                    grid: { display: false, drawBorder: false },
                    title: { display: true, text: 'Month', font: { family: "'Salesforce Sans', sans-serif", size: 12, weight: '600' }, color: '#2c3e50', padding: { top: 10, bottom: 10 } }
                }
            },
            interaction: { mode: 'nearest', axis: 'x', intersect: false },
            elements: { point: { hoverBorderWidth: 3 } }
        }
    });
}

// Render Monthly Forecast vs Actuals Chart
function renderMonthlyForecastActualsChart(data, months, originalMonthly, revisedMonthly, actualsMonthly) {
    const ctx = document.getElementById('monthly-forecast-actuals-chart');
    if (!ctx) return;
    
    if (window.monthlyForecastActualsChart) {
        window.monthlyForecastActualsChart.destroy();
    }
    
    const originalForecastData = { 'Feb': 0, 'Mar': 0, 'Apr': 0, 'May': 0, 'June': 0.83, 'July': 0.84, 'Aug': 0.96, 'Sep': 1.01, 'Oct': 1.05, 'Nov': 1.10, 'Dec': 1.18, 'Jan': 1.20 };
    const revisedForecastData = { 'Feb': 0.02567565, 'Mar': 0.02604765, 'Apr': 0.13509684, 'May': 0.27098303, 'June': 0.42167534, 'July': 0.53090595, 'Aug': 0.64357525, 'Sep': 0.68839906, 'Oct': 0.82882302, 'Nov': 0.87023289, 'Dec': 0.90473725, 'Jan': 0.91289425 };
    const actualsDataChart = { 'Feb': 0.02567565, 'Mar': 0.02604765, 'Apr': 0.13509684, 'May': 0.27098303, 'June': 0.42167534, 'July': 0.53090595, 'Aug': 0.64357525, 'Sep': 0.68839906, 'Oct': 0.82882302, 'Nov': 0.87023289, 'Dec': 0.90473725, 'Jan': 0.90473725 };
    
    const originalData = months.map(m => originalForecastData[m] || originalMonthly[m] || 0);
    const revisedData = months.map(m => revisedForecastData[m] || revisedMonthly[m] || 0);
    const actualsData = months.map(m => actualsDataChart[m] || actualsMonthly[m] || 0);
    
    const monthLabels = months.map(m => {
        const monthNames = { 'Feb': 'Feb', 'Mar': 'Mar', 'Apr': 'Apr', 'May': 'May', 'June': 'Jun', 'July': 'Jul', 'Aug': 'Aug', 'Sep': 'Sep', 'Oct': 'Oct', 'Nov': 'Nov', 'Dec': 'Dec', 'Jan': 'Jan' };
        return monthNames[m] || m;
    });
    
    window.monthlyForecastActualsChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: monthLabels,
            datasets: [
                { label: 'Original Forecast', data: originalData, borderColor: '#9ca3af', backgroundColor: 'rgba(156, 163, 175, 0.1)', borderWidth: 3, fill: false, tension: 0.4, pointRadius: 4, pointHoverRadius: 6, pointBackgroundColor: '#9ca3af', pointBorderColor: '#ffffff', pointBorderWidth: 2 },
                { label: 'Revised Forecast', data: revisedData, borderColor: '#3182ce', backgroundColor: 'rgba(49, 130, 206, 0.1)', borderWidth: 3, borderDash: [5, 5], fill: false, tension: 0.4, pointRadius: 4, pointHoverRadius: 6, pointBackgroundColor: '#3182ce', pointBorderColor: '#ffffff', pointBorderWidth: 2 },
                { label: 'Actuals', data: actualsData, borderColor: '#059669', backgroundColor: 'rgba(5, 150, 105, 0.1)', borderWidth: 3, fill: false, tension: 0.4, pointRadius: 4, pointHoverRadius: 6, pointBackgroundColor: '#059669', pointBorderColor: '#ffffff', pointBorderWidth: 2 }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { display: true, position: 'top', labels: { font: { family: "'Salesforce Sans', sans-serif", size: 13, weight: '500' }, padding: 20, usePointStyle: true, pointStyle: 'circle' } },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    padding: 12,
                    titleFont: { family: "'Salesforce Sans', sans-serif", size: 13, weight: '600' },
                    bodyFont: { family: "'Salesforce Sans', sans-serif", size: 12 },
                    callbacks: {
                        label: function(context) { return (context.dataset.label || '') + ': ' + formatCurrency(context.parsed.y); },
                        title: function(context) { return 'Month: ' + context[0].label; }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            let valueInMillions = value < 1000 ? value : (value < 1000000 ? value / 1000 : value / 1000000);
                            return `$${valueInMillions.toFixed(2)}M`;
                        },
                        font: { family: "'Salesforce Sans', sans-serif", size: 11 },
                        color: '#4a5568'
                    },
                    grid: { color: '#e2e8f0', drawBorder: false },
                    title: { display: true, text: 'Cost Savings ($M)', font: { family: "'Salesforce Sans', sans-serif", size: 12, weight: '600' }, color: '#2c3e50', padding: { top: 10, bottom: 10 } }
                },
                x: {
                    ticks: { font: { family: "'Salesforce Sans', sans-serif", size: 11 }, color: '#4a5568' },
                    grid: { display: false, drawBorder: false },
                    title: { display: true, text: 'Month', font: { family: "'Salesforce Sans', sans-serif", size: 12, weight: '600' }, color: '#2c3e50', padding: { top: 10, bottom: 10 } }
                }
            },
            interaction: { mode: 'nearest', axis: 'x', intersect: false },
            elements: { point: { hoverBorderWidth: 3 } }
        }
    });
}

// Render Cost to Serve Developers View
function renderCostToServeDevelopersView(data) {
    const devViewDiv = document.getElementById('cost-to-serve-developers-view');
    if (!devViewDiv) {
        console.error('Could not find cost-to-serve-developers-view element');
        return;
    }
    
    // Empty Developers View
    devViewDiv.innerHTML = '';
}

// Render Initiative Small Multiples - Individual charts for each initiative
function renderInitiativeSmallMultiples() {
    const container = document.getElementById('initiative-charts-grid');
    if (!container) return;
    
    // Clear any existing charts
    container.innerHTML = '';
    
    // Initiative data: Original Estimate and Actuals per month (in dollars, will convert to millions)
    const initiativesData = [
        {
            name: 'Improve Bin Packing with Karpenter- Platform',
            original: [0, 0, 0, 0, 340000, 340000, 410000, 410000, 450000, 460000, 510000, 520000],
            actuals: [0, 0, 56052.81, 182939.00, 247071.39, 270730.00, 277983.00, 269015.81, 277983.00, 269015.81, 277983.00, 277983.00]
        },
        {
            name: 'Rightsizing of HCP AddOns- Platform',
            original: [0, 0, 0, 0, 340000, 350000, 400000, 450000, 450000, 450000, 480000, 480000],
            actuals: [0, 0, 15796.38, 24796.40, 64949.00, 114385.00, 149472.00, 149472.00, 280928.77, 331305.84, 356843.00, 356843.00]
        },
        {
            name: 'OVP EBS Prune',
            original: [0, 0, 0, 0, 30000, 30000, 30000, 30000, 30000, 50000, 50000, 50000],
            actuals: [0, 0, 37200.00, 37200.00, 37200.00, 71600.00, 71600.00, 101800.00, 101800.00, 101800.00, 101800.00, 101800.00]
        },
        {
            name: 'Mesh / IG- Platform',
            original: [0, 0, 0, 0, 90000, 90000, 90000, 90000, 90000, 90000, 90000, 100000],
            actuals: [0, 0, 0, 0, 38595.30, 38595.30, 102228.60, 125819.60, 125819.60, 125819.60, 125819.60, 125819.60]
        },
        {
            name: 'Decom of Redundant Compute- Tenant',
            original: [0, 0, 0, 0, 30000, 30000, 30000, 30000, 30000, 50000, 50000, 50000],
            actuals: [25675.65, 26047.65, 26047.65, 26047.65, 33859.65, 35595.65, 42291.65, 42291.65, 42291.65, 42291.65, 42291.65, 42291.65]
        }
    ];
    
    const months = ['Feb', 'Mar', 'Apr', 'May', 'June', 'July', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec', 'Jan'];
    const monthLabels = months.map(m => {
        const monthNames = { 'Feb': 'Feb', 'Mar': 'Mar', 'Apr': 'Apr', 'May': 'May', 'June': 'Jun', 'July': 'Jul', 'Aug': 'Aug', 'Sept': 'Sep', 'Oct': 'Oct', 'Nov': 'Nov', 'Dec': 'Dec', 'Jan': 'Jan' };
        return monthNames[m] || m;
    });
    
    // Color palette for initiatives - each initiative gets different colors, but Original and Actuals use similar shades
    const colors = [
        { original: '#93c5fd', actuals: '#2563eb' }, // Blue shades - Improve Bin Packing
        { original: '#86efac', actuals: '#16a34a' }, // Green shades - Rightsizing HCP AddOns
        { original: '#fbbf24', actuals: '#d97706' }, // Orange shades - OVP EBS Prune
        { original: '#c084fc', actuals: '#9333ea' }, // Purple shades - Mesh / IG Platform
        { original: '#f472b6', actuals: '#db2777' }  // Pink shades - Decom of Redundant Compute
    ];
    
    // Create individual chart for each initiative
    initiativesData.forEach((initiative, index) => {
        const colorSet = colors[index % colors.length];
        const originalInMillions = initiative.original.map(v => v / 1000000);
        const actualsInMillions = initiative.actuals.map(v => v / 1000000);
        
        // Create chart container
        const chartDiv = document.createElement('div');
        chartDiv.style.cssText = 'background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);';
        chartDiv.innerHTML = `
            <h4 style="font-size: 0.95rem; font-weight: 600; color: #2c3e50; margin-bottom: 1rem; text-align: center; line-height: 1.3;">
                ${initiative.name}
            </h4>
            <canvas id="initiative-chart-${index}" style="max-height: 250px;"></canvas>
        `;
        container.appendChild(chartDiv);
        
        // Wait for DOM to be ready, then render chart
        setTimeout(() => {
            const ctx = document.getElementById(`initiative-chart-${index}`);
            if (!ctx) return;
            
            // Destroy existing chart if it exists
            if (window[`initiativeChart${index}`]) {
                window[`initiativeChart${index}`].destroy();
            }
            
            window[`initiativeChart${index}`] = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: monthLabels,
                    datasets: [
                        {
                            label: 'Original Estimate',
                            data: originalInMillions,
                            borderColor: colorSet.original,
                            backgroundColor: 'transparent',
                            borderWidth: 2,
                            borderDash: [5, 5],
                            fill: false,
                            tension: 0.4,
                            pointRadius: 3,
                            pointHoverRadius: 5,
                            pointBackgroundColor: colorSet.original,
                            pointBorderColor: '#ffffff',
                            pointBorderWidth: 1
                        },
                        {
                            label: 'Actuals',
                            data: actualsInMillions,
                            borderColor: colorSet.actuals,
                            backgroundColor: 'transparent',
                            borderWidth: 2,
                            fill: false,
                            tension: 0.4,
                            pointRadius: 3,
                            pointHoverRadius: 5,
                            pointBackgroundColor: colorSet.actuals,
                            pointBorderColor: '#ffffff',
                            pointBorderWidth: 1
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: true,
                    plugins: {
                        legend: {
                            display: true,
                            position: 'top',
                            labels: {
                                font: { family: "'Salesforce Sans', sans-serif", size: 10, weight: '500' },
                                padding: 8,
                                usePointStyle: true,
                                pointStyle: 'circle',
                                boxWidth: 8
                            }
                        },
                        tooltip: {
                            mode: 'index',
                            intersect: false,
                            backgroundColor: 'rgba(0, 0, 0, 0.8)',
                            padding: 10,
                            titleFont: { family: "'Salesforce Sans', sans-serif", size: 12, weight: '600' },
                            bodyFont: { family: "'Salesforce Sans', sans-serif", size: 11 },
                            callbacks: {
                                label: function(context) {
                                    return (context.dataset.label || '') + ': ' + formatCurrency(context.parsed.y);
                                }
                            }
                        }
                    },
                    scales: {
                        x: {
                            ticks: {
                                font: { family: "'Salesforce Sans', sans-serif", size: 9 },
                                color: '#4a5568',
                                maxRotation: 45,
                                minRotation: 45
                            },
                            grid: { color: '#e2e8f0', drawBorder: false },
                            title: {
                                display: true,
                                text: 'Month',
                                font: { family: "'Salesforce Sans', sans-serif", size: 10, weight: '600' },
                                color: '#2c3e50',
                                padding: { top: 8, bottom: 5 }
                            }
                        },
                        y: {
                            beginAtZero: true,
                            ticks: {
                                callback: function(value) {
                                    return `$${value.toFixed(2)}M`;
                                },
                                font: { family: "'Salesforce Sans', sans-serif", size: 9 },
                                color: '#4a5568'
                            },
                            grid: { color: '#e2e8f0', drawBorder: false },
                            title: {
                                display: true,
                                text: 'Savings ($M)',
                                font: { family: "'Salesforce Sans', sans-serif", size: 10, weight: '600' },
                                color: '#2c3e50',
                                padding: { top: 8, bottom: 8 }
                            }
                        }
                    }
                }
            });
        }, 100 * (index + 1)); // Stagger chart creation to avoid DOM issues
    });
}
