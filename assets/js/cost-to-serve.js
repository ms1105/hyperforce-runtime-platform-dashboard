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
    
    const fy = (typeof window.costToServeFY !== 'undefined' ? window.costToServeFY : 'FY26');
    
    // When FY27 is selected, show FY27 savings (Predicted $7.78M, Actuals $0, Variance -$7.78M, Achievement 0%)
    if (fy === 'FY27') {
        const fy27Predicted = 7.78;
        const fy27Actual = 0;
        const fy27Variance = fy27Actual - fy27Predicted; // -7.78
        const fy27VariancePercent = fy27Predicted > 0 ? ((fy27Variance / fy27Predicted) * 100).toFixed(2) : 0;
        const fy27Achievement = fy27Predicted > 0 ? ((fy27Actual / fy27Predicted) * 100).toFixed(2) : 0;
        execViewDiv.innerHTML = `
            <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 1.5rem; margin-bottom: 2rem;">
                <div class="exec-metric-card" style="border-left-color: #3182ce;">
                    <div class="exec-metric-label">Total Predicted Savings</div>
                    <div class="exec-metric-value" style="color: #3182ce;">${formatCurrency(fy27Predicted)}</div>
                    <div style="font-size: 0.875rem; color: #718096; margin-top: 0.5rem;">FY27 Forecast</div>
                </div>
                <div class="exec-metric-card" style="border-left-color: #059669;">
                    <div class="exec-metric-label">Total Actual Savings</div>
                    <div class="exec-metric-value" style="color: #059669;">${formatCurrency(fy27Actual)}</div>
                    <div style="font-size: 0.875rem; color: #718096; margin-top: 0.5rem;">FY27 Realized Savings</div>
                </div>
                <div class="exec-metric-card" style="border-left-color: #dc2626;">
                    <div class="exec-metric-label">Variance</div>
                    <div class="exec-metric-value" style="color: #dc2626;">${fy27Variance < 0 ? '-' : ''}${formatCurrency(Math.abs(fy27Variance))}</div>
                    <div style="font-size: 0.875rem; color: #718096; margin-top: 0.5rem;">${fy27VariancePercent}% vs Forecast</div>
                </div>
                <div class="exec-metric-card" style="border-left-color: #7c3aed;">
                    <div class="exec-metric-label">Achievement Rate</div>
                    <div class="exec-metric-value" style="color: #7c3aed;">${fy27Achievement}%</div>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: 0%;"></div>
                    </div>
                </div>
            </div>
            <div class="exec-chart-container" style="margin-top: 2rem;">
                <h3 style="font-size: 1.25rem; font-weight: 600; color: #2c3e50; margin-bottom: 0.5rem;">FY27 HRP CTS Initiatives</h3>
                <p style="font-size: 0.875rem; color: #718096; margin-bottom: 1.5rem;">Monthly Cumulative All Initiatives Savings</p>
                <div style="margin-bottom: 2rem;">
                    <canvas id="fy27-initiatives-chart" style="max-height: 450px;"></canvas>
                </div>
            </div>
            <div class="exec-chart-container" style="margin-top: 2rem;">
                <h3 style="font-size: 1.25rem; font-weight: 600; color: #2c3e50; margin-bottom: 1.5rem;">Original Estimate vs Actuals by Initiative</h3>
                <p style="font-size: 0.875rem; color: #718096; margin-bottom: 1.5rem;">FY27 initiative performance trends</p>
                <div id="fy27-initiative-charts-grid" style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 2rem; margin-bottom: 2rem;">
                </div>
            </div>
        `;
        setTimeout(() => {
            renderFY27InitiativesChart();
            renderFY27InitiativeTrendCharts();
        }, 100);
        return;
    }
    
    // FY26: show FY26 savings (current view)
    console.log('Rendering Exec View (FY26) with data:', data);
    
    const months = ['Feb', 'Mar', 'Apr', 'May', 'June', 'July', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan'];
    
    // Calculate totals - use exact values from source of truth
    const totalOriginal = 8.17; // $8.17M - Original Estimate
    const totalForecast = 6.26; // $6.26M - Revised Estimate  
    const totalActual = 6.28; // $6.28M - Realized Savings
    const variance = totalActual - totalForecast; // +$0.02M
    const variancePercent = totalForecast > 0 ? ((variance / totalForecast) * 100).toFixed(2) : 0;
    const achievementRate = totalForecast > 0 ? ((totalActual / totalForecast) * 100).toFixed(2) : 0;
    
    // Executive Summary Cards (FY26 only)
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
                <div style="font-size: 0.875rem; color: #718096; margin-top: 0.5rem;">FY26 Realized Savings</div>
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
        { name: 'Rightsizing of HCP AddOns- Platform', data: [0, 0, 0.02, 0.04, 0.11, 0.22, 0.37, 0.52, 0.80, 1.13, 1.49, 1.87], color: '#dc2626' },
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
    
    // Calculate progressive predicted savings line (linear progression from 0 to 6.26M over 12 months)
    const totalPredictedSavings = 6.26;
    const predictedSavingsData = monthLabels.map((_, index) => {
        // Linear progression: start at 0, end at 6.26M
        return (totalPredictedSavings / (monthLabels.length - 1)) * index;
    });
    
    datasets.push({
        label: 'Predicted Savings',
        data: predictedSavingsData,
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

// FY27 initiatives data (cumulative $M by month: Feb, Mar, Apr, May, Jun, Jul, Aug, Sept, Oct, Nov, Dec, Jan)
const FY27_INITIATIVES_DATA = [
    { name: 'Improve Bin Packing with Karpenter', data: [0, 0, 0.02, 0.17, 0.33, 0.48, 0.77, 1.07, 1.36, 1.65, 2.11, 3.04], color: '#3182ce' },
    { name: 'Rightsizing of HCP AddOns- Platform', data: [0, 0, 0.01, 0.01, 0.07, 0.14, 0.22, 0.29, 0.60, 0.90, 1.21, 1.84], color: '#b91c1c' },
    { name: 'Proactive Container Optimization HRP', data: [0, 0, 0.00, 0.02, 0.04, 0.07, 0.09, 0.17, 0.25, 0.33, 0.49, 0.81], color: '#eab308' },
    { name: 'Proactive Container Optimization Tenant', data: [0, 0, 0.00, 0.00, 0.00, 0.00, 0.00, 0.06, 0.11, 0.17, 0.29, 0.55], color: '#22c55e' },
    { name: 'IG Graviton Migration (Core)', data: [0, 0, 0.00, 0.00, 0.00, 0.00, 0.00, 0.02, 0.04, 0.06, 0.08, 0.11], color: '#f97316' },
    { name: 'IG - Shared Migration Ingress- Core', data: [0, 0, 0.00, 0.00, 0.00, 0.00, 0.00, 0.02, 0.04, 0.06, 0.08, 0.12], color: '#14b8a6' },
    { name: 'Vegacache Graviton Migration', data: [0, 0, 0.00, 0.00, 0.00, 0.00, 0.00, 0.10, 0.20, 0.30, 0.40, 0.60], color: '#38bdf8' },
    { name: 'Sam_processing-1 Right-Sizing', data: [0, 0, 0.00, 0.07, 0.14, 0.21, 0.28, 0.35, 0.43, 0.50, 0.57, 0.71], color: '#dc2626' }
];

// FY27 Tracker: Original Estimate and Actuals only (no Revised Estimate). Monthly values in dollars. Feb-Jan.
function formatDollars(v) {
    if (v === null || v === undefined) return '—';
    const n = Number(v);
    if (isNaN(n)) return '—';
    if (n === 0) return '—';
    return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
const FY27_TRACKER_DATA = [
    { name: 'Improve Bin Packing with Karpenter', status: 'On Track', original: [0, 0, 20000, 154817.65, 154817.65, 154817.65, 290283.10, 290283.10, 290283.10, 290283.10, 464452.96, 464452.96], totalOriginal: 3038944.22, actuals: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], totalActuals: 0 },
    { name: 'Rightsizing of HCP AddOns- Platform', status: 'On Track', original: [0, 0, 5000, 5000, 63170.83, 70810.48, 73170.83, 73170.83, 305972.58, 305972.58, 316171.67, 316171.67], totalOriginal: 1840584.06, actuals: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], totalActuals: 0 },
    { name: 'Proactive Container Optimization HRP', status: 'Not Started', original: [0, 0, 0, 21791.65, 22518.03, 21791.65, 22518.03, 81064.92, 78449.93, 81064.92, 156899.85, 162129.85], totalOriginal: 810358.69, actuals: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], totalActuals: 0 },
    { name: 'Proactive Container Optimization Tenant', status: 'Not Started', original: [0, 0, 0, 0, 0, 0, 56327.97, 54510.94, 56327.97, 124596.43, 128749.65, 128749.65], totalOriginal: 549262.60, actuals: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], totalActuals: 0 },
    { name: 'IG Graviton Migration (Core)', status: 'Not Started', original: [0, 0, 0, 0, 0, 0, 19000, 19000, 19000, 19000, 19000, 19000], totalOriginal: 114000, actuals: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], totalActuals: 0 },
    { name: 'IG - Shared Migration Ingress- (Core)', status: 'Not Started', original: [0, 0, 0, 0, 0, 0, 19662.80, 19662.80, 19662.80, 19662.80, 19662.80, 19662.80], totalOriginal: 117976.78, actuals: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], totalActuals: 0 },
    { name: 'Vegacache Graviton Migration', status: 'Not Started', original: [0, 0, 0, 0, 0, 0, 100000, 100000, 100000, 100000, 100000, 100000], totalOriginal: 600000, actuals: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], totalActuals: 0 },
    { name: 'Sam_processing-1 Right-Sizing', status: 'Delayed', original: [0, 0, 70934, 70934, 70934, 70934, 70934, 70934, 70934, 70934, 70934, 70934], totalOriginal: 709340, actuals: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], totalActuals: 0 }
];

function renderFY27InitiativeTrendCharts() {
    const container = document.getElementById('fy27-initiative-charts-grid');
    if (!container) return;
    container.innerHTML = '';
    const monthLabels = ['Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec', 'Jan'];
    const colors = [
        { original: '#93c5fd', actuals: '#2563eb' },
        { original: '#86efac', actuals: '#16a34a' },
        { original: '#fbbf24', actuals: '#d97706' },
        { original: '#c084fc', actuals: '#9333ea' },
        { original: '#f472b6', actuals: '#db2777' },
        { original: '#67e8f9', actuals: '#0891b2' },
        { original: '#a5f3fc', actuals: '#0e7490' },
        { original: '#fecaca', actuals: '#dc2626' }
    ];
    FY27_TRACKER_DATA.forEach((initiative, index) => {
        const colorSet = colors[index % colors.length];
        const originalInMillions = initiative.original.map(v => (v || 0) / 1000000);
        const actualsInMillions = initiative.actuals.map(v => (v || 0) / 1000000);
        const statusClass = (initiative.status || '').toLowerCase().replace(/\s+/g, '-');
        const statusBadgeClass = statusClass ? `fy27-status fy27-status-${statusClass}` : 'fy27-status';
        const targetM = (initiative.totalOriginal != null ? Number(initiative.totalOriginal) : 0) / 1000000;
        const targetLabel = 'Target: $' + targetM.toFixed(2) + 'M';
        const chartDiv = document.createElement('div');
        chartDiv.style.cssText = 'background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); position: relative;';
        chartDiv.innerHTML = `
            <div style="position: absolute; top: 0.75rem; left: 1rem; z-index: 1;">
                <span class="${statusBadgeClass}" style="display: block; font-size: 0.7rem; font-weight: 600; margin-bottom: 0.35rem;">${initiative.status || '—'}</span>
                <span style="display: block; font-size: 0.7rem; font-weight: 600; color: #4b5563;">${targetLabel}</span>
            </div>
            <h4 style="font-size: 0.95rem; font-weight: 600; color: #2c3e50; margin-bottom: 1rem; text-align: center; line-height: 1.3;">${initiative.name}</h4>
            <canvas id="fy27-initiative-chart-${index}" style="max-height: 250px;"></canvas>
        `;
        container.appendChild(chartDiv);
        setTimeout(() => {
            const ctx = document.getElementById(`fy27-initiative-chart-${index}`);
            if (!ctx) return;
            if (window[`fy27InitiativeChart${index}`]) {
                window[`fy27InitiativeChart${index}`].destroy();
                window[`fy27InitiativeChart${index}`] = null;
            }
            window[`fy27InitiativeChart${index}`] = new Chart(ctx, {
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
                            labels: { font: { size: 10, weight: '500' }, padding: 8, usePointStyle: true, pointStyle: 'circle', boxWidth: 8 }
                        },
                        tooltip: {
                            mode: 'index',
                            intersect: false,
                            backgroundColor: 'rgba(0, 0, 0, 0.8)',
                            padding: 10,
                            callbacks: { label: function(c) { return (c.dataset.label || '') + ': ' + formatCurrency(c.parsed.y); } }
                        }
                    },
                    scales: {
                        x: {
                            ticks: { font: { size: 9 }, color: '#4a5568', maxRotation: 45, minRotation: 45 },
                            grid: { color: '#e2e8f0', drawBorder: false },
                            title: { display: true, text: 'Month', font: { size: 10, weight: '600' }, color: '#2c3e50', padding: { top: 8, bottom: 5 } }
                        },
                        y: {
                            beginAtZero: true,
                            ticks: { callback: v => `$${v.toFixed(2)}M`, font: { size: 9 }, color: '#4a5568' },
                            grid: { color: '#e2e8f0', drawBorder: false },
                            title: { display: true, text: 'Savings ($M)', font: { size: 10, weight: '600' }, color: '#2c3e50', padding: { top: 8, bottom: 8 } }
                        }
                    }
                }
            });
        }, 120 * (index + 1));
    });
}

function renderFY27InitiativesChart() {
    const ctx = document.getElementById('fy27-initiatives-chart');
    if (!ctx) return;
    if (window.fy27InitiativesChart) {
        window.fy27InitiativesChart.destroy();
        window.fy27InitiativesChart = null;
    }
    const months = ['Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec', 'Jan'];
    const monthLabels = months;
    const datasets = FY27_INITIATIVES_DATA.map((init) => ({
        label: init.name.length > 45 ? init.name.substring(0, 45) + '...' : init.name,
        data: init.data,
        backgroundColor: init.color,
        borderColor: init.color,
        borderWidth: 1
    }));
    window.fy27InitiativesChart = new Chart(ctx, {
        type: 'bar',
        data: { labels: monthLabels, datasets: datasets },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: {
                    display: true,
                    position: 'bottom',
                    labels: {
                        font: { family: "'Salesforce Sans', sans-serif", size: 11, weight: '500' },
                        padding: 12,
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
                    callbacks: {
                        label: function(context) {
                            return (context.dataset.label || '') + ': ' + formatCurrency(context.parsed.y);
                        },
                        footer: function(tooltipItems) {
                            let total = 0;
                            tooltipItems.forEach(item => { total += item.parsed.y || 0; });
                            return 'Total: ' + formatCurrency(total);
                        }
                    }
                }
            },
            scales: {
                x: {
                    stacked: true,
                    ticks: { font: { size: 11 }, color: '#4a5568' },
                    grid: { display: false },
                    title: { display: true, text: 'Month', font: { size: 12, weight: '600' }, color: '#2c3e50', padding: { top: 10, bottom: 10 } }
                },
                y: {
                    stacked: true,
                    beginAtZero: true,
                    max: 8,
                    ticks: {
                        stepSize: 2,
                        callback: function(value) {
                            return `$${Number(value).toFixed(2)} M`;
                        },
                        font: { size: 11 },
                        color: '#4a5568'
                    },
                    grid: { color: '#e2e8f0', drawBorder: false },
                    title: { display: true, text: 'Cumulative Savings ($M)', font: { size: 12, weight: '600' }, color: '#2c3e50', padding: { top: 10, bottom: 10 } }
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
    
    const fy = (typeof window.costToServeFY !== 'undefined' ? window.costToServeFY : 'FY26');
    if (fy === 'FY27') {
        devViewDiv.innerHTML = `
            <div style="text-align: center; padding: 3rem 2rem;">
                <h3 style="font-size: 1.25rem; font-weight: 600; color: #2c3e50; margin-bottom: 0.5rem;">FY27 Initiative Details</h3>
                <p style="font-size: 0.95rem; color: #64748b;">FY27 data will be shown here when available. Use the FY26 / FY27 toggle to view FY26.</p>
            </div>
        `;
        return;
    }
    
    // FY26: empty Developers View (current behavior)
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
