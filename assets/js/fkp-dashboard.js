/**
 * FKP Adoption Dashboard JavaScript
 * Handles data loading, processing, filtering, and visualization
 */

console.log('🚀 FKP Dashboard Script Loaded');

// Debug mode - set to true for verbose logging
const DEBUG_MODE = false;
const debugLog = (...args) => { if (DEBUG_MODE) console.log(...args); };

// Integration services that should be excluded from adoption metrics
const INTEGRATION_SERVICES = [
    'stampy-webhook', 'madkub-watchdog', 'collection', 'madkub-injection-webhook',
    'collectioninjector', 'metadata-concealer', 'identity-controller-refresher', 
    'identity-controller', 'clustermanagement', 'collectioninjectortest', 
    'visibility-agent', 'vault', 'mars', 'authzwebhook', 'kubesyntheticscaler',
    'identitycontrollertest', 'network-access-controller'
];

// Global state management
let fkpDashboard = {
    data: {
        instances: [],           // Raw data from fkp_adoption.csv (current quarter)
        instancesPrevQ: [],      // Raw data from fkp_adoption_prev_q.csv (previous quarter)
        blackjackInstances: [],  // Raw data from blackjack_adoption_normalized.csv (current quarter)
        blackjackInstancesPrevQ: [],  // Raw data from blackjack_adoption_prev_q.csv (previous quarter)
        mappings: [],           // Raw data from service_cloud_mapping_utf8.csv  
        meshServices: [],       // Raw data from mesh_data.csv
        blackjackMeshServices: [], // Raw data from blackjack_mesh_services.csv
        timelineRequirements: [], // Raw data from Timeline and Requirements.csv
        processed: {
            services: new Map(),      // Regular services (excluding integration services)
            integrationServices: new Map(), // Integration services only
            orgLeaders: new Map()
        }
    },
    filters: {
        substrate: ['AWS'],
        orgLeader: [],
        parentCloud: [],
        cloud: [],
        team: [],
        service: [],
        customerType: ['Commercial', 'GIA', 'BlackJack'],
        instanceEnv: ['Prod'], // Default to Prod only for Overview
        'migration-stage': ['Not Started', 'Pre-Prod Progress', 'Parity Required', 'Prod Progress', 'Prod Complete', 'Mesh Complete'] // All stages by default
    },
    state: {
        currentTab: 'exec-summary',
        viewMode: {
            primary: 'service',      // service | instance
            secondary: 'org-leader'  // org-leader | parent-cloud | cloud
        },
        loading: false,
        filterOptions: {},
        sortBy: 'totalInstances', // Default sort for Service Information
        sortOrder: 'desc',
        updatingFilters: false, // Prevent event loops during filter updates
        debounceTimer: null, // For debounced real-time filtering
        crossCustomerView: 'all', // 'all', 'discrepancies', 'not-started', 'in-progress', or 'complete' for Cross-Customer Analysis
        activeDropdown: null,        // Track which dropdown is currently open
        dropdownSelectionMode: false, // Track if user is actively making selections
        selectionTimer: null,         // Timer to detect when user is done selecting
        currentViewMode: 'exec',      // 'exec' or 'developer' - controls which tabs are visible
        filtersCollapsed: true,       // Whether filters panel is collapsed (default: collapsed)
        overviewViewBy: 'org-leader'  // 'org-leader', 'parent-cloud', or 'cloud' for roadmap grouping
    }
};

/**
 * Debounce function for real-time filtering
 */
function debounce(func, wait) {
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(fkpDashboard.state.debounceTimer);
            func(...args);
        };
        clearTimeout(fkpDashboard.state.debounceTimer);
        fkpDashboard.state.debounceTimer = setTimeout(later, wait);
    };
}

/**
 * Debounced refresh function for real-time filtering
 */
const debouncedRefresh = debounce(() => {
    console.log('🔄 Real-time filter update triggered');
    updateInterdependentFilters();
    refreshCurrentTab();
}, 500);

/* ======================
   VIEW MODE TOGGLE (EXEC/DEVELOPER)
   ====================== */

/**
 * Switch between Exec and Developer view modes
 */
function switchViewMode(mode) {
    console.log('🔄 Switching view mode to:', mode);
    
    // Preserve scroll position so page doesn't jump to top (e.g. when on Cost to Serve in Exec Summary)
    const scrollY = window.scrollY || window.pageYOffset;
    
    fkpDashboard.state.currentViewMode = mode;
    
    // Update body class for CSS-based hiding
    document.body.classList.remove('exec-view', 'developer-view');
    document.body.classList.add(mode + '-view');
    
    // Update toggle buttons
    document.querySelectorAll('.view-mode-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.view === mode) {
            btn.classList.add('active');
        }
    });
    
    // Show/hide tabs based on view mode (Cost to Serve: always hide developer tab - no Developer View)
    document.querySelectorAll('.nav-subitem').forEach(tab => {
        if (tab.dataset.tab === 'cost-to-serve-details') {
            tab.style.display = 'none';
            return;
        }
        const tabView = tab.dataset.view;
        if (mode === 'exec') {
            if (tabView === 'developer') {
                tab.style.display = 'none';
            } else {
                tab.style.display = '';
            }
        } else {
            if (tabView === 'exec') {
                tab.style.display = 'none';
            } else {
                tab.style.display = '';
            }
        }
    });
    
    // Tab correspondence mapping (Exec tab → Developer tab)
    const tabCorrespondence = {
        // Autoscaling: runtime-overview (exec) ↔ runtime-hpa (developer)
        'runtime-overview': 'runtime-hpa',
        'runtime-hpa': 'runtime-overview',
        // Availability: Detection/Prevention/Remediation tabs share IDs across views
        'runtime-availability-detection': 'runtime-availability-detection',
        'runtime-availability-prevention': 'runtime-availability-prevention',
        'runtime-availability-remediation': 'runtime-availability-remediation',
        // Availability: Developer-only tabs map back to Detection in Exec
        'runtime-availability-readiness': 'runtime-availability-detection',
        'runtime-availability-ingress': 'runtime-availability-detection',
        // Legacy mapping
        'runtime-availability': 'runtime-availability-detection',
        'runtime-availability-inventory': 'runtime-availability-prevention',
        // Onboarding Overview: executive-overview (exec) ↔ service-information (developer)
        'executive-overview': 'service-information',
        'service-information': 'executive-overview',
        // CTS Overview: cost-overview (exec) ↔ cost-hcp (developer)
        'cost-overview': 'cost-hcp',
        'cost-hcp': 'cost-overview'
    };
    
    const currentTab = fkpDashboard.state.currentTab;
    const currentTabEl = document.querySelector(`[data-tab="${currentTab}"]`);
    
    // Check if current tab is hidden in new view
    if (currentTabEl && currentTabEl.style.display === 'none') {
        // In Developer view, always switch to first visible tab in section
        if (mode === 'developer') {
            const parentSection = currentTabEl.closest('.nav-section');
            if (parentSection) {
                const firstVisibleInSection = parentSection.querySelector('.nav-subitem:not([style*="display: none"])');
                if (firstVisibleInSection) {
                    const newTabId = firstVisibleInSection.dataset.tab;
                    switchTab(newTabId);
                    console.log('✅ Switched to first visible tab:', newTabId);
                    return;
                }
            }
        } else {
            // In Exec view, try to find corresponding tab first
            const correspondingTab = tabCorrespondence[currentTab];
            if (correspondingTab) {
                const correspondingTabEl = document.querySelector(`[data-tab="${correspondingTab}"]`);
                if (correspondingTabEl && correspondingTabEl.style.display !== 'none') {
                    switchTab(correspondingTab);
                    console.log('✅ Switched to corresponding tab:', correspondingTab);
                    return;
                }
            }
            
            // Fallback: Find first visible tab in current section
            const parentSection = currentTabEl.closest('.nav-section');
            if (parentSection) {
                const firstVisibleInSection = parentSection.querySelector('.nav-subitem:not([style*="display: none"])');
                if (firstVisibleInSection) {
                    const newTabId = firstVisibleInSection.dataset.tab;
                    switchTab(newTabId);
                    console.log('✅ Switched to first visible tab:', newTabId);
                    return;
                }
            }
        }
    }
    
    // Update view button states after switching
    updateViewButtonStates(fkpDashboard.state.currentTab);
    
    // If viewing runtime-availability or runtime-karpenter, refresh to show correct content
    if (fkpDashboard.state.currentTab === 'runtime-availability-detection') {
        renderAvailabilityDetectionTab();
    } else if (fkpDashboard.state.currentTab === 'runtime-availability-prevention') {
        renderAvailabilityPreventionTab();
    } else if (fkpDashboard.state.currentTab === 'runtime-availability-remediation') {
        renderAvailabilityRemediationTab();
    } else if (fkpDashboard.state.currentTab === 'runtime-availability-readiness') {
        renderAvailabilityReadinessView();
    } else if (fkpDashboard.state.currentTab === 'runtime-availability-ingress') {
        renderAvailabilityIngressView();
    } else if (fkpDashboard.state.currentTab === 'runtime-karpenter') {
        renderKarpenter();
    }
    
    // Restore scroll position so screen stays at Cost to Serve / current section
    requestAnimationFrame(function() {
        window.scrollTo(0, scrollY);
    });
    
    console.log('✅ View mode switched to:', mode);
}

/**
 * Toggle the filters panel (collapse/expand)
 */
function toggleFiltersPanel() {
    const filtersBar = document.getElementById('filters-bar');
    const isCollapsed = filtersBar.classList.toggle('collapsed');
    fkpDashboard.state.filtersCollapsed = isCollapsed;
    
    console.log('🔍 Filters panel:', isCollapsed ? 'collapsed' : 'expanded');
}

/**
 * Initialize view mode on page load
 */
function initializeViewMode() {
    // Default to Exec view
    switchViewMode('exec');
    
    // Default to collapsed filters
    const filtersBar = document.getElementById('filters-bar');
    if (filtersBar) {
        filtersBar.classList.add('collapsed');
    }
    
    // Update view button states for initial tab
    const initialTab = fkpDashboard.state.currentTab || 'executive-overview';
    updateViewButtonStates(initialTab);
    
    console.log('✅ View mode initialized: exec, filters collapsed');
}

/**
 * Initialize FKP Dashboard
 */
async function initializeFKPDashboard() {
    console.log('🔧 Initializing FKP Adoption Dashboard...');
    
    try {
        showLoading(true);
        
        // Load all data files
        console.log('⏳ Step 1: Loading data files...');
        await loadAllData();
        
        // Process and combine data
        console.log('⏳ Step 2: Processing data...');
        processData();
        
        // Initialize filters
        console.log('⏳ Step 3: Initializing filters...');
        initializeFilters();
        
        // Initialize view controls
        console.log('⏳ Step 4: Setting up view controls...');
        initializeViewControls();
        
        // Update filter visibility for current tab
        console.log('⏳ Step 5: Updating filter visibility...');
        updateFilterVisibility();
        
        // Load initial content
        console.log('⏳ Step 6: Loading initial content...');
        
        // Set body class for initial tab if needed
        if (fkpDashboard.state.currentTab === 'executive-overview') {
            document.body.classList.add('executive-overview-active');
        } else {
            document.body.classList.remove('executive-overview-active');
        }
        
        // Initialize view mode (Exec/Developer toggle)
        console.log('⏳ Step 7: Initializing view mode...');
        initializeViewMode();

        // Default to Executive Summary on initial load
        switchTab(fkpDashboard.state.currentTab || 'exec-summary');
        
        const pageHeader = document.querySelector('.page-header');
        const headerControls = document.querySelector('.header-controls');
        const viewToggleContainer = document.querySelector('.view-toggle-container');
        const execBtn = document.querySelector('.view-mode-btn[data-view="exec"]');
        const devBtn = document.querySelector('.view-mode-btn[data-view="developer"]');

        // Ensure view buttons are visible (except exec summary)
        if (fkpDashboard.state.currentTab !== 'exec-summary') {
            // Force visibility of all header elements
            if (pageHeader) {
                pageHeader.style.display = 'flex';
                pageHeader.style.visibility = 'visible';
            }
            if (headerControls) {
                headerControls.style.display = 'flex';
                headerControls.style.visibility = 'visible';
            }
            if (viewToggleContainer) {
                viewToggleContainer.style.display = 'flex';
                viewToggleContainer.style.visibility = 'visible';
            }
            if (execBtn) {
                execBtn.style.setProperty('display', 'flex', 'important');
                execBtn.style.setProperty('visibility', 'visible', 'important');
                execBtn.style.setProperty('opacity', '1', 'important');
            }
            if (devBtn) {
                devBtn.style.setProperty('display', 'flex', 'important');
                devBtn.style.setProperty('visibility', 'visible', 'important');
                devBtn.style.setProperty('opacity', '1', 'important');
            }
            
            console.log('✅ View buttons initialized:', {
                pageHeader: !!pageHeader,
                headerControls: !!headerControls,
                viewToggleContainer: !!viewToggleContainer,
                execBtn: !!execBtn,
                devBtn: !!devBtn
            });
            
            // Additional check: Log computed styles to debug
            if (headerControls) {
                const computed = window.getComputedStyle(headerControls);
                console.log('🔍 header-controls computed styles:', {
                    display: computed.display,
                    visibility: computed.visibility,
                    width: computed.width,
                    height: computed.height,
                    opacity: computed.opacity
                });
            }
            if (viewToggleContainer) {
                const computed = window.getComputedStyle(viewToggleContainer);
                console.log('🔍 view-toggle-container computed styles:', {
                    display: computed.display,
                    visibility: computed.visibility,
                    width: computed.width,
                    height: computed.height,
                    opacity: computed.opacity
                });
            }
        }
        
        refreshCurrentTab();
        
        showLoading(false);
        console.log('✅ FKP Dashboard initialized successfully');
        
    } catch (error) {
        console.error('❌ Error initializing dashboard:', error);
        showError(`Failed to initialize dashboard: ${error.message}. Please check browser console for details.`);
        showLoading(false);
    }
}

function renderAvailabilityPreventionExecView(container) {
    const fitRows = getFilteredFitRows();
    const normalizeValue = (value) => (value || '').toString().trim().toLowerCase();
    const parseFailureRate = (raw) => {
        if (!raw) return null;
        const cleaned = raw.toString().trim().replace('%', '');
        const val = parseFloat(cleaned);
        return Number.isNaN(val) ? null : val;
    };
    const parseRunDate = (raw) => parseFitRunDate(raw);
    const getRunTypeRows = (rows, typeKey) => rows.filter(r =>
        normalizeValue(r['Run Type']).includes(typeKey)
    );
    const getLast30Rows = (rows) => {
        const now = new Date();
        return rows.filter(r => {
            const date = parseRunDate(r['Run Time']);
            return date && date >= thirtyDaysAgo && date <= now;
        });
    };
    const uniqueProductCount = (rows) => new Set(rows.map(r => r.Product).filter(Boolean)).size;
    const sumTests = (rows) => rows.reduce((sum, r) => sum + (parseInt(r.Tests || 0, 10) || 0), 0);
    const calcSuccessRate = (rows) => {
        const rates = rows.map(r => parseFailureRate(r['Failure Rate'])).filter(v => v !== null);
        if (!rates.length) return null;
        const avgFailure = rates.reduce((a, b) => a + b, 0) / rates.length;
        return Math.max(0, 100 - avgFailure);
    };
    const formatDelta = (current, previous) => {
        if (current === null || previous === null) return { text: 'No change vs last month', className: 'text-slate' };
        const delta = current - previous;
        const abs = Math.abs(delta).toFixed(1);
        if (delta === 0) return { text: 'No change vs last month', className: 'text-slate' };
        return {
            text: `${delta > 0 ? '↑' : '↓'} ${abs}% vs last month`,
            className: delta > 0 ? 'text-green' : 'text-red'
        };
    };

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const prevThirtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

    const preRows = getRunTypeRows(fitRows, 'predeployment');
    const postRows = getRunTypeRows(fitRows, 'postdeployment');
    const preLast30 = getLast30Rows(preRows);
    const postLast30 = getLast30Rows(postRows);
    const prePrevWindowStart = new Date(prevThirtyDaysAgo.getFullYear(), prevThirtyDaysAgo.getMonth(), 1);
    const prePrev30 = preRows.filter(r => {
        const date = parseRunDate(r['Run Time']);
        return date && date >= prePrevWindowStart && date < thirtyDaysAgo;
    });
    const postPrev30 = postRows.filter(r => {
        const date = parseRunDate(r['Run Time']);
        return date && date >= prevThirtyDaysAgo && date < thirtyDaysAgo;
    });

    const preProductCount = new Set(preRows.map(r => getFitProductForService(r.Service)).filter(p => p && p !== 'N/A')).size;
    const preTestsCount = sumTests(preRows);
    const preServiceCount = new Set(preRows.map(r => r.Service).filter(Boolean)).size;
    const totalHrpServices = Object.keys(availabilityData.fitServiceProductMap || {}).length;
    const preSuccessRate = calcSuccessRate(preLast30);
    const postSuccessRate = calcSuccessRate(postLast30);
    const prePrevSuccess = calcSuccessRate(prePrev30);
    const postPrevSuccess = calcSuccessRate(postPrev30);
    const preDelta = formatDelta(preSuccessRate, prePrevSuccess);
    const postDelta = formatDelta(postSuccessRate, postPrevSuccess);

    const inventory = availabilityData.testInventory;
    const products = getInventoryProducts();
    const visibleProducts = availabilityData.inventoryProductFilter && availabilityData.inventoryProductFilter !== 'all'
        ? products.filter(product => product === availabilityData.inventoryProductFilter)
        : products;
    const customerRows = mapInventoryRows(inventory.customerScenario.rows, 'customerScenario');
    const integrationRows = mapInventoryRows(fitRows, 'integration');
    const scalePerfRows = mapInventoryRows(inventory.scalePerf.rows, 'scalePerf');
    const chaosRows = mapInventoryRows(inventory.chaos.rows, 'chaos');
    const summary = buildInventorySummary(products, {
        customerScenario: customerRows,
        integration: integrationRows,
        scalePerf: scalePerfRows,
        chaos: chaosRows
    });
    const integrationReleaseSummary = buildIntegrationReleaseSummaryFromFit(products);
    const formatServiceCoverageLabel = (data) => `${data.enabled || 0}/${data.total || 0} services enabled`;

    const scalePerfSummary = buildInventorySummary(getInventoryProducts(), {
        scalePerf: scalePerfRows
    });
    const scalePerfEnabledProducts = new Set();
    Object.keys(scalePerfSummary).forEach(product => {
        const bucket = scalePerfSummary[product]?.scalePerf;
        if (bucket && bucket.enabled > 0) {
            scalePerfEnabledProducts.add(product);
        }
    });

    const getStatus = (row) => normalizeValue(row.Status);
    const enabledProducts = new Set();
    const plannedProducts = new Set();
    let enabledTests = 0;
    customerRows.forEach(row => {
        const product = row._product;
        const status = getStatus(row);
        if (status === 'enabled') {
            enabledProducts.add(product);
            enabledTests += 1;
        } else if (status === 'not enabled' || status === 'partial') {
            plannedProducts.add(product);
        }
    });

    const chaosEnabledProducts = new Set();
    let chaosPlannedTests = 0;
    chaosRows.forEach(row => {
        const product = row._product;
        const enabledValue = normalizeValue(row.Enabled);
        if (enabledValue === 'enabled') {
            chaosEnabledProducts.add(product);
        } else if (enabledValue === 'not enabled' || enabledValue === 'tbd' || enabledValue === 'planned') {
            chaosPlannedTests += 1;
        } else {
            const frequency = normalizeValue(row.Frequency);
            if (frequency && frequency !== 'not enabled' && frequency !== 'tbd') {
                chaosEnabledProducts.add(product);
            } else {
                chaosPlannedTests += 1;
            }
        }
    });

    container.innerHTML = `
        <div class="availability-exec-scrollable">
            <div class="exec-summary-section-header">
                <span class="readiness-section-icon">🧪</span>
                <span>Hyperforce Runtime Platform Test Inventory</span>
            </div>
            <div class="inventory-summary-card">
                <div class="inventory-summary-header">
                    <div class="inventory-summary-title-block">
                        <h3>Preventive Test Coverage for HRP Products</h3>
                        <div class="inventory-summary-note">Click on individual tests for more information</div>
                    </div>
                    <div class="inventory-legend">
                        <span><span class="inv-dot inv-enabled"></span>Enabled</span>
                        <span><span class="inv-dot inv-partial"></span>Planned</span>
                        <span><span class="inv-dot inv-missing"></span>Not Planned</span>
                    </div>
                </div>
                <div class="inventory-summary-table-wrap">
                    <table class="inventory-summary-table">
                        <thead>
                            <tr>
                                <th>HRP Product</th>
                                <th onclick="openAvailabilityInventoryTab('customerScenario')" class="inventory-clickable-header">Critical Path Tests</th>
                                <th onclick="openAvailabilityInventoryTab('integration')" class="inventory-clickable-header">FIT Tests - PreDeployment</th>
                                <th onclick="openAvailabilityInventoryTab('integration')" class="inventory-clickable-header">FIT Tests - PostDeployment</th>
                                <th onclick="openAvailabilityInventoryTab('scalePerf')" class="inventory-clickable-header">Scale &amp; Perf Tests</th>
                                <th onclick="openAvailabilityInventoryTab('chaos')" class="inventory-clickable-header">Chaos Tests</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${products.map(product => {
                                const integrationPost = integrationReleaseSummary[product]?.post || { total: 0, enabled: 0, partial: 0 };
                                const integrationPre = integrationReleaseSummary[product]?.pre || { total: 0, enabled: 0, partial: 0 };
                                return `
                                    <tr>
                                        <td>${product}</td>
                                        ${renderSummaryCellWithCounts(summary[product]?.customerScenario || { total: 0, enabled: 0, partial: 0 })}
                                        ${renderSummaryCellWithCounts(integrationPre, formatServiceCoverageLabel(integrationPre))}
                                        ${renderSummaryCellWithCounts(integrationPost, formatServiceCoverageLabel(integrationPost))}
                                        ${renderSummaryCellWithCounts(summary[product]?.scalePerf || { total: 0, enabled: 0, partial: 0 })}
                                        ${renderSummaryCellWithCounts(summary[product]?.chaos || { total: 0, enabled: 0, partial: 0 })}
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            </div>

            <div class="exec-summary-divider"></div>

            <div class="exec-summary-section-header">
                <span class="readiness-section-icon">🔗</span>
                <span>FIT Test Summary for HRP Products</span>
            </div>
            <div class="prevention-fit-controls-row">
                <div class="prevention-fit-controls">
                    <div class="integration-fit-filter">
                        <label class="integration-fit-label">Month</label>
                        <select id="prevention-fit-month-filter"></select>
                    </div>
                    <div class="prevention-fit-toggle">
                        <label class="integration-fit-label">Summarize by</label>
                        <div class="prevention-fit-toggle-buttons">
                            <button type="button" data-value="product" class="prevention-fit-toggle-btn">Product</button>
                            <button type="button" data-value="runType" class="prevention-fit-toggle-btn">Run Type</button>
                        </div>
                    </div>
                </div>
                <div class="prevention-fit-summary-label" id="prevention-fit-summary-label"></div>
            </div>
            <div class="prevention-fit-summary-row">
                <div class="prevention-fit-table-card">
                    <div class="inventory-detail-header">
                        <h3>Integration FIT Summary</h3>
                        <span id="prevention-fit-month-label"></span>
                    </div>
                    <div class="modal-table-scroll">
                        <table class="availability-modal-table prevention-fit-table">
                            <thead>
                                <tr>
                                    <th id="prevention-fit-col-1">Product</th>
                                    <th id="prevention-fit-col-2">Number of Tests Ran</th>
                                    <th id="prevention-fit-col-3">Avg Success</th>
                                </tr>
                            </thead>
                            <tbody id="prevention-fit-table-body"></tbody>
                        </table>
                    </div>
                </div>
                <div class="prevention-fit-chart-card chart-card">
                    <div class="chart-header">
                        <div class="chart-title">Tests Ran &amp; Success Rate</div>
                    </div>
                    <div class="chart-body">
                        <div class="chart-container">
                            <canvas id="preventionFitChart"></canvas>
                        </div>
                    </div>
                </div>
            </div>

            <div class="exec-summary-divider"></div>

            <div class="exec-summary-section-header">
                <span class="readiness-section-icon">📈</span>
                <span>HRP Test Inventory - Trend</span>
            </div>
            <div class="charts-grid" style="margin-bottom: 1.5rem;">
                <div class="chart-card">
                    <div class="chart-header clickable-header" onclick="openFitSuccessMonthlyModal()">
                        <div class="chart-title">📈 FIT Success Rate Trend (6 Months)</div>
                        <span class="section-badge badge-positive">Improving</span>
                    </div>
                    <div class="chart-body">
                        <div class="chart-container">
                            <canvas id="fitTrendChartPrevention"></canvas>
                        </div>
                    </div>
                </div>
                <div class="chart-card">
                    <div class="chart-header clickable-header" onclick="openChaosExecutionMonthlyModal()">
                        <div class="chart-title">🔥 Chaos Test Execution (Last 6 Months)</div>
                        <span class="section-badge badge-neutral">Monthly</span>
                    </div>
                    <div class="chart-body">
                        <div class="chart-container">
                            <canvas id="chaosChartPrevention"></canvas>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    initFitTrendChart('fitTrendChartPrevention');
    initChaosExecutionChart('chaosChartPrevention');
    renderPreventionFitSummary();
}

/**
 * Load all required data files
 */
async function loadAllData() {
    console.log('📂 Loading data files...');
    
    try {
        // Load FKP adoption instances data
        console.log('📊 Loading fkp_adoption.csv...');
        const instancesResponse = await fetch('fkp_adoption.csv');
        if (!instancesResponse.ok) {
            throw new Error(`Failed to load fkp_adoption.csv: ${instancesResponse.status}`);
        }
          const instancesText = await instancesResponse.text();
         const rawCurrentInstances = parseCSV(instancesText);
         fkpDashboard.data.instances = normalizeInstanceData(rawCurrentInstances, 'FKP Current');
         console.log(`✅ Loaded and normalized ${fkpDashboard.data.instances.length} instance records`);
        
        // Load FKP adoption instances data (previous quarter)
        console.log('📊📅 Loading fkp_adoption_prev_q.csv...');
        let instancesPrevQResponse = await fetch('fkp_adoption_prev_q.csv');
        if (!instancesPrevQResponse.ok) {
            instancesPrevQResponse = await fetch('assets/data/fkp_adoption_prev_q.csv');
        }
        if (!instancesPrevQResponse.ok) {
            throw new Error(`Failed to load fkp_adoption_prev_q.csv: ${instancesPrevQResponse.status}`);
        }
          const instancesPrevQText = await instancesPrevQResponse.text();
         const rawPrevInstances = parseCSV(instancesPrevQText);
         fkpDashboard.data.instancesPrevQ = normalizeInstanceData(rawPrevInstances, 'FKP Previous');
         console.log(`✅ Loaded and normalized ${fkpDashboard.data.instancesPrevQ.length} previous quarter instance records`);
        
        // Debug sample of previous quarter data
        if (fkpDashboard.data.instancesPrevQ.length > 0) {
            debugLog('📋 Sample previous quarter data:', fkpDashboard.data.instancesPrevQ[0]);
        }
        
        // Load service cloud mapping data
        console.log('🗺️ Loading service_cloud_mapping_utf8.csv...');
        const mappingsResponse = await fetch('assets/data/service_cloud_mapping_utf8.csv');
        if (!mappingsResponse.ok) {
            throw new Error(`Failed to load service_cloud_mapping_utf8.csv: ${mappingsResponse.status}`);
        }
        const mappingsText = await mappingsResponse.text();
        fkpDashboard.data.mappings = parseCSV(mappingsText);
        console.log(`✅ Loaded ${fkpDashboard.data.mappings.length} service mappings`);
        
        // Load mesh services data
        console.log('🕸️ Loading mesh_data.csv...');
        const meshResponse = await fetch('assets/data/mesh_data.csv');
        if (!meshResponse.ok) {
            throw new Error(`Failed to load mesh_data.csv: ${meshResponse.status}`);
        }
        const meshText = await meshResponse.text();
        fkpDashboard.data.meshServices = parseCSV(meshText, false); // No header row
        console.log(`✅ Loaded ${fkpDashboard.data.meshServices.length} mesh services`);
        
        // Load BlackJack adoption instances data
        console.log('⚫ Loading blackjack_adoption_normalized.csv...');
        const blackjackInstancesResponse = await fetch('assets/data/blackjack_adoption_normalized.csv');
        if (!blackjackInstancesResponse.ok) {
            throw new Error(`Failed to load blackjack_adoption_normalized.csv: ${blackjackInstancesResponse.status}`);
        }
        const blackjackInstancesText = await blackjackInstancesResponse.text();
        fkpDashboard.data.blackjackInstances = parseCSV(blackjackInstancesText);
        console.log(`✅ Loaded ${fkpDashboard.data.blackjackInstances.length} BlackJack instance records`);
        
        // Load BlackJack adoption instances data (previous quarter - try normalized first)
        console.log('⚫📅 Loading BlackJack previous quarter data...');
        let blackjackPrevQLoaded = false;
        
        // Try to load normalized version first
        try {
            const blackjackInstancesPrevQNormalizedResponse = await fetch('assets/data/blackjack_adoption_prev_q_normalized.csv');
            if (blackjackInstancesPrevQNormalizedResponse.ok) {
                const blackjackInstancesPrevQNormalizedText = await blackjackInstancesPrevQNormalizedResponse.text();
                fkpDashboard.data.blackjackInstancesPrevQ = parseCSV(blackjackInstancesPrevQNormalizedText);
                console.log(`✅ Loaded ${fkpDashboard.data.blackjackInstancesPrevQ.length} BlackJack previous quarter records (normalized)`);
                blackjackPrevQLoaded = true;
            }
        } catch (normalizedError) {
            console.log('📋 Normalized previous quarter file not found, trying raw version...');
        }
        
        // Fallback to raw version if normalized not available
        if (!blackjackPrevQLoaded) {
            const blackjackInstancesPrevQResponse = await fetch('assets/data/blackjack_adoption_prev_q.csv');
            if (!blackjackInstancesPrevQResponse.ok) {
                throw new Error(`Failed to load blackjack_adoption_prev_q.csv: ${blackjackInstancesPrevQResponse.status}`);
            }
            const blackjackInstancesPrevQText = await blackjackInstancesPrevQResponse.text();
            fkpDashboard.data.blackjackInstancesPrevQ = parseCSV(blackjackInstancesPrevQText);
            console.log(`✅ Loaded ${fkpDashboard.data.blackjackInstancesPrevQ.length} BlackJack previous quarter records (raw - needs normalization)`);
        }
        
        // Load BlackJack mesh services data
        console.log('🕸️⚫ Loading blackjack_mesh_services.csv...');
        const blackjackMeshResponse = await fetch('assets/data/blackjack_mesh_services.csv');
        if (!blackjackMeshResponse.ok) {
            throw new Error(`Failed to load blackjack_mesh_services.csv: ${blackjackMeshResponse.status}`);
        }
        const blackjackMeshText = await blackjackMeshResponse.text();
        fkpDashboard.data.blackjackMeshServices = parseCSV(blackjackMeshText);
        console.log(`✅ Loaded ${fkpDashboard.data.blackjackMeshServices.length} BlackJack mesh services`);
        
        // Load Timeline and Requirements data for Stage 3 and growth projections
        console.log('📈 Loading timeline_requirements.csv...');
        const timelineResponse = await fetch('assets/data/timeline_requirements.csv');
        if (!timelineResponse.ok) {
            throw new Error(`Failed to load timeline_requirements.csv: ${timelineResponse.status}`);
        }
        const timelineText = await timelineResponse.text();
        fkpDashboard.data.timelineRequirements = parseCSV(timelineText);
        console.log(`✅ Loaded ${fkpDashboard.data.timelineRequirements.length} timeline and requirement records`);
        
        // Debug: Log sample timeline data and services with requirements
        debugLog('🔍 DEBUG: Sample timeline records:', fkpDashboard.data.timelineRequirements.slice(0, 3));
        const servicesWithRequirements = fkpDashboard.data.timelineRequirements.filter(record => {
            const requirements = record['Requirements'];
            return requirements && requirements.trim() !== '' && requirements.toLowerCase() !== 'none';
        });
        debugLog(`🔍 DEBUG: Found ${servicesWithRequirements.length} services with requirements:`, 
                    servicesWithRequirements.map(r => ({ 
                        name: r['Service Name'], 
                        requirements: r['Requirements'] 
                    })));
        
        // Debug: Check if these services exist in our main data
        const servicesInMainData = servicesWithRequirements.filter(r => {
            return fkpDashboard.data.instances.some(inst => inst.label_p_servicename === r['Service Name']) ||
                   fkpDashboard.data.blackjackInstances.some(inst => inst.label_p_servicename === r['Service Name']);
        });
        debugLog(`🔍 DEBUG: Services with requirements that exist in main FKP/BlackJack data: ${servicesInMainData.length}`, 
                    servicesInMainData.map(r => r['Service Name']));
        
        // Debug: Check specific services mentioned by user
        const specificServices = ['cdp-byoc-krc', 'cdp-dpc-eks', 'eanalytics', 'notebook'];
        specificServices.forEach(serviceName => {
            const hasRequirements = servicesWithRequirements.some(r => r['Service Name'] === serviceName);
            const existsInData = fkpDashboard.data.instances.some(inst => inst.label_p_servicename === serviceName) ||
                               fkpDashboard.data.blackjackInstances.some(inst => inst.label_p_servicename === serviceName);
            debugLog(`🔍 DEBUG Specific Service: ${serviceName} - HasRequirements: ${hasRequirements}, ExistsInData: ${existsInData}`);
        });
        
        // Validate data
        if (fkpDashboard.data.instances.length === 0) {
            throw new Error('No instance data loaded');
        }
        if (fkpDashboard.data.mappings.length === 0) {
            throw new Error('No mapping data loaded');
        }
        
    } catch (error) {
        console.error('❌ Error loading data files:', error);
        showError(`Data loading failed: ${error.message}`);
        throw error;
    }
}

/**
 * Parse CSV text into array of objects
 */
function parseCSV(text, hasHeader = true) {
    const lines = text.trim().split('\n');
    if (lines.length === 0) return [];
    
    if (!hasHeader) {
        // For mesh_data.csv which is just a list of service names
        return lines.map(line => line.trim()).filter(line => line);
    }
    
    const headers = lines[0].split(',').map(h => h.trim());
    const data = [];
    
    for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i]);
        const row = {};
        
        headers.forEach((header, index) => {
            row[header] = values[index] || '';
        });
        
        data.push(row);
    }
    
    return data;
}

/**
 * Parse a single CSV line handling quoted values
 */
function parseCSVLine(line) {
    const values = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        
        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            values.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }
    
    values.push(current.trim());
    return values;
}

/**
 * Process and combine raw data into usable format
 */
function processData() {
    console.log('⚙️ Processing and combining data...');
    console.log(`📋 Total instances loaded: ${fkpDashboard.data.instances.length}`);
    console.log(`📋 Total mappings loaded: ${fkpDashboard.data.mappings.length}`);
    console.log(`📋 Total mesh services loaded: ${fkpDashboard.data.meshServices.length}`);
    
    const processed = {
        services: new Map(),
        integrationServices: new Map(),
        orgLeaders: new Map(),
        parentClouds: new Map(),
        clouds: new Map(),
        teams: new Map()
    };
    
    // Create service lookup from mappings
    const serviceMapping = new Map();
    fkpDashboard.data.mappings.forEach(mapping => {
        const serviceName = mapping.mr_servicename;
        if (serviceName) {
            serviceMapping.set(serviceName, {
                orgLeader: mapping.asl_manager_name || 'Unknown',
                parentCloud: mapping.parent_cloud || 'Unknown',
                cloud: mapping.cloud_name || 'Unknown',
                team: mapping.mr_team_name || 'Unknown'
            });
        }
    });
    
    console.log(`📋 Created service mapping for ${serviceMapping.size} services`);
    
    let processedCount = 0;
    let skippedCount = 0;
    
    // Process instance data
    fkpDashboard.data.instances.forEach(instance => {
        const serviceName = instance.label_p_servicename;
        if (!serviceName) {
            skippedCount++;
            return;
        }
        if (serviceName.trim().toLowerCase() === 'unknown') {
            skippedCount++;
            return;
        }
        
        // Get service mapping info
        const mapping = serviceMapping.get(serviceName);
        const isIntegrationService = INTEGRATION_SERVICES.includes(serviceName);
        
        if (!mapping && !isIntegrationService) {
            // Skip unmapped non-integration services silently (logged in summary)
            skippedCount++;
            return;
        }
        
        // For integration services without mappings, provide defaults
        const serviceInfo = mapping || (isIntegrationService ? {
            orgLeader: 'Platform Engineering',
            parentCloud: 'Infrastructure',
            cloud: 'Platform Services',
            team: 'FKP Platform Team'
        } : null);
        
        if (!serviceInfo) {
            skippedCount++;
            return;
        }
        
        // Classify instance
        const classification = classifyInstance(instance);
        
        if (isIntegrationService && DEBUG_MODE) {
            debugLog(`🔧 DEBUG FKP: Found integration service in data: ${serviceName}`);
        }
        
        // Initialize service if not exists (in appropriate map)
        const servicesMap = isIntegrationService ? processed.integrationServices : processed.services;
        if (!servicesMap.has(serviceName)) {
            servicesMap.set(serviceName, {
                name: serviceName,
                orgLeader: serviceInfo.orgLeader,
                parentCloud: serviceInfo.parentCloud,
                cloud: serviceInfo.cloud,
                team: serviceInfo.team,
                instances: [],
                stats: {
                    total: 0,
                    prod: 0,
                    preProd: 0,
                    commercial: 0,
                    gia: 0,
                    blackjack: 0,
                    fkp: 0,
                    selfManaged: 0,
                    fkpProd: 0,
                    fkpPreProd: 0
                },
                meshEnabled: fkpDashboard.data.meshServices.includes(serviceName) || 
                           fkpDashboard.data.blackjackMeshServices.some(meshService => 
                               meshService.service_name === serviceName),
                isIntegration: isIntegrationService
            });
        }
        
        const service = servicesMap.get(serviceName);
        service.instances.push({
            ...instance,
            ...classification
        });
        
        // Update service stats
        service.stats.total++;
        service.stats[classification.isProd ? 'prod' : 'preProd']++;
        service.stats[classification.customerType.toLowerCase()]++;
        service.stats[classification.isFKP ? 'fkp' : 'selfManaged']++;
        if (classification.isFKP && classification.isProd) service.stats.fkpProd++;
        if (classification.isFKP && !classification.isProd) service.stats.fkpPreProd++;
        
        // Only update aggregated collections for non-integration services
        if (!isIntegrationService) {
            updateAggregatedStats(processed, service, serviceInfo, classification);
        }
        
        processedCount++;
    });
    
    // Process BlackJack instance data
    console.log('⚫ Processing BlackJack instances...');
    let blackjackProcessedCount = 0;
    let blackjackSkippedCount = 0;
    
    fkpDashboard.data.blackjackInstances.forEach(instance => {
        const serviceName = instance.label_p_servicename;
        if (!serviceName) {
            blackjackSkippedCount++;
            return;
        }
        if (serviceName.trim().toLowerCase() === 'unknown') {
            blackjackSkippedCount++;
            return;
        }
        
        // Get service mapping info
        const mapping = serviceMapping.get(serviceName);
        const isIntegrationService = INTEGRATION_SERVICES.includes(serviceName);
        
        if (!mapping && !isIntegrationService) {
            // Skip unmapped non-integration services silently (logged in summary)
            blackjackSkippedCount++;
            return;
        }
        
        // For integration services without mappings, provide defaults
        const serviceInfo = mapping || (isIntegrationService ? {
            orgLeader: 'Platform Engineering',
            parentCloud: 'Infrastructure',
            cloud: 'Platform Services',
            team: 'FKP Platform Team'
        } : null);
        
        if (!serviceInfo) {
            blackjackSkippedCount++;
            return;
        }
        
        // Classify BlackJack instance with override for customer type
        const classification = classifyInstance(instance);
        classification.customerType = 'BlackJack'; // Override for BlackJack instances
        
        if (isIntegrationService && DEBUG_MODE) {
            debugLog(`🔧 DEBUG BlackJack: Found integration service in data: ${serviceName}`);
        }
        
        // Initialize service if not exists (in appropriate map)
        const servicesMap = isIntegrationService ? processed.integrationServices : processed.services;
        if (!servicesMap.has(serviceName)) {
            servicesMap.set(serviceName, {
                name: serviceName,
                orgLeader: serviceInfo.orgLeader,
                parentCloud: serviceInfo.parentCloud,
                cloud: serviceInfo.cloud,
                team: serviceInfo.team,
                instances: [],
                stats: {
                    total: 0,
                    prod: 0,
                    preProd: 0,
                    commercial: 0,
                    gia: 0,
                    blackjack: 0,
                    fkp: 0,
                    selfManaged: 0,
                    fkpProd: 0,
                    fkpPreProd: 0
                },
                meshEnabled: fkpDashboard.data.meshServices.includes(serviceName) || 
                           fkpDashboard.data.blackjackMeshServices.some(meshService => 
                               meshService.service_name === serviceName),
                isIntegration: isIntegrationService
            });
        }
        
        const service = servicesMap.get(serviceName);
        service.instances.push({
            fi: instance.fi,
            fd: instance.fd,
            cluster: instance.k8s_cluster,
            ...classification
        });
        
        // Update service stats
        service.stats.total++;
        service.stats[classification.isProd ? 'prod' : 'preProd']++;
        service.stats.blackjack++; // Always BlackJack
        service.stats[classification.isFKP ? 'fkp' : 'selfManaged']++;
        if (classification.isFKP && classification.isProd) service.stats.fkpProd++;
        if (classification.isFKP && !classification.isProd) service.stats.fkpPreProd++;
        
        // Only update aggregated collections for non-integration services
        if (!isIntegrationService) {
            updateAggregatedStats(processed, service, serviceInfo, classification);
        }
        
        blackjackProcessedCount++;
    });
    
    // Calculate adoption percentages
    calculateAdoptionPercentages(processed);
    
    fkpDashboard.data.processed = processed;
    console.log(`✅ Data processing completed: ${processed.services.size} services, ${processedCount + blackjackProcessedCount} instances`);
}

/**
 * Classify an instance based on FI, FD, and cluster information
 */
function classifyInstance(instance) {
    const fi = instance.fi || '';
    const cluster = instance.k8s_cluster || '';
    
    // Environment classification
    const isProd = /stage|prod|esvc/i.test(fi);
    
    // Customer type classification
    let customerType = 'Commercial';
    if (/gia/i.test(fi)) {
        customerType = 'GIA';
    }
    // BlackJack detection logic will be added later
    
    // Platform classification
    const isFKP = /sam/i.test(cluster);
    
    return {
        isProd,
        isPreProd: !isProd,
        customerType,
        isCommercial: customerType === 'Commercial',
        isGIA: customerType === 'GIA',
        isBlackjack: customerType === 'BlackJack',
        isFKP,
        isSelfManaged: !isFKP,
        fi,
        fd: instance.fd || '',
        cluster
    };
}

/**
 * Update service statistics
 */
function updateServiceStats(service, classification) {
    service.stats.total++;
    
    if (classification.isProd) service.stats.prod++;
    if (classification.isPreProd) service.stats.preProd++;
    if (classification.isCommercial) service.stats.commercial++;
    if (classification.isGIA) service.stats.gia++;
    if (classification.isBlackjack) service.stats.blackjack++;
    if (classification.isFKP) service.stats.fkp++;
    if (classification.isSelfManaged) service.stats.selfManaged++;
    if (classification.isFKP && classification.isProd) service.stats.fkpProd++;
    if (classification.isFKP && classification.isPreProd) service.stats.fkpPreProd++;
}

/**
 * Update aggregated statistics for org leaders, parent clouds, etc.
 */
function updateAggregatedStats(processed, service, serviceInfo, classification) {
    // Helper function to update aggregated entity
    const updateEntity = (entityMap, key, service) => {
        if (!entityMap.has(key)) {
            entityMap.set(key, {
                name: key,
                services: new Set(),
                totalInstances: 0,
                fkpInstances: 0,
                prodInstances: 0,
                preProdInstances: 0,
                adoptionRate: 0
            });
        }
        
        const entity = entityMap.get(key);
        entity.services.add(service.name);
        entity.totalInstances++;
        
        if (classification.isFKP) entity.fkpInstances++;
        if (classification.isProd) entity.prodInstances++;
        if (classification.isPreProd) entity.preProdInstances++;
    };
    
    // Update org leaders
    updateEntity(processed.orgLeaders, serviceInfo.orgLeader, service);
    
    // Update parent clouds
    updateEntity(processed.parentClouds, serviceInfo.parentCloud, service);
    
    // Update clouds
    updateEntity(processed.clouds, serviceInfo.cloud, service);
    
    // Update teams
    updateEntity(processed.teams, serviceInfo.team, service);
}

/**
 * Calculate adoption percentages for all entities
 */
function calculateAdoptionPercentages(processed) {
    const calculateForMap = (entityMap) => {
        entityMap.forEach(entity => {
            // Service adoption: services with at least 1 FKP prod instance
            const servicesWithFKPProd = Array.from(entity.services).filter(serviceName => {
                const service = processed.services.get(serviceName);
                return service && service.stats.fkpProd > 0;
            }).length;
            
            entity.serviceAdoption = entity.services.size > 0 ? 
                (servicesWithFKPProd / entity.services.size) * 100 : 0;
            
            // Instance adoption: FKP instances / total instances
            entity.instanceAdoption = entity.totalInstances > 0 ? 
                (entity.fkpInstances / entity.totalInstances) * 100 : 0;
        });
    };
    
    calculateForMap(processed.orgLeaders);
    calculateForMap(processed.parentClouds);
    calculateForMap(processed.clouds);
    calculateForMap(processed.teams);
    
    // Calculate service-level adoption
    processed.services.forEach(service => {
        service.instanceAdoption = service.stats.total > 0 ? 
            (service.stats.fkp / service.stats.total) * 100 : 0;
        
        service.serviceAdoption = service.stats.fkpProd > 0 ? 100 : 0;
    });
    
    // Calculate service-level adoption for integration services too
    processed.integrationServices.forEach(service => {
        service.instanceAdoption = service.stats.total > 0 ? 
            (service.stats.fkp / service.stats.total) * 100 : 0;
        
        service.serviceAdoption = service.stats.fkpProd > 0 ? 100 : 0;
    });
}

/**
 * Initialize filter system
 */
function initializeFilters() {
    console.log('🔍 Initializing filters...');
    
    // Extract filter options from processed data
    const processed = fkpDashboard.data.processed;
    
    if (!processed) {
        console.error('❌ No processed data available for filter initialization');
        return;
    }
    
    fkpDashboard.state.filterOptions = {
        substrate: ['AWS'], // Static for now
        orgLeader: [...processed.orgLeaders.keys()].sort(),
        parentCloud: [...processed.parentClouds.keys()].sort(),
        cloud: [...processed.clouds.keys()].sort(),
        team: [...processed.teams.keys()].sort(),
        service: [...processed.services.keys()].sort(),
        customerType: ['Commercial', 'GIA', 'BlackJack'],
        instanceEnv: ['Prod', 'Pre-Prod'],
        'migration-stage': ['Not Started', 'Pre-Prod Progress', 'Parity Required', 'Prod Progress', 'Prod Complete', 'Mesh Complete']
    };
    
    console.log('🔍 Filter options extracted:');
    Object.keys(fkpDashboard.state.filterOptions).forEach(key => {
        console.log(`  ${key}: ${fkpDashboard.state.filterOptions[key].length} options`);
    });
    
    // Populate filter dropdowns
    Object.keys(fkpDashboard.state.filterOptions).forEach(filterKey => {
        console.log(`🔍 Populating ${filterKey} filter with ${fkpDashboard.state.filterOptions[filterKey].length} options...`);
        populateFilterDropdown(filterKey, fkpDashboard.state.filterOptions[filterKey]);
    });
    
    // Set initial filter state - all selected except instanceEnv (Prod only)
    Object.keys(fkpDashboard.filters).forEach(filterKey => {
        if (['substrate', 'customerType'].includes(filterKey)) {
            // These are pre-set in initial state
            return;
        }
        if (filterKey === 'instanceEnv') {
            // Keep default Prod setting
            return;
        }
        if (filterKey === 'migration-stage') {
            // Migration stage filter is pre-set
            return;
        }
        if (fkpDashboard.state.filterOptions[filterKey]) {
            fkpDashboard.filters[filterKey] = [...fkpDashboard.state.filterOptions[filterKey]];
            console.log(`🔍 Set ${filterKey} filter to ${fkpDashboard.filters[filterKey].length} items`);
        }
    });
    
    // Update filter UI to reflect current selections
    fkpDashboard.state.updatingFilters = true;
    
    Object.keys(fkpDashboard.filters).forEach(filterKey => {
        updateFilterSelectedText(filterKey);
        const dropdownId = camelToKebab(filterKey);
        const dropdown = document.getElementById(`${dropdownId}-dropdown`);
        if (dropdown) {
            const checkboxes = dropdown.querySelectorAll('input[type="checkbox"]:not(.select-all input)');
            checkboxes.forEach(checkbox => {
                checkbox.checked = fkpDashboard.filters[filterKey].includes(checkbox.value);
            });
            
            const selectAllCheckbox = dropdown.querySelector('.select-all input');
            if (selectAllCheckbox) {
                const allSelected = fkpDashboard.filters[filterKey].length === fkpDashboard.state.filterOptions[filterKey].length;
                selectAllCheckbox.checked = allSelected;
            }
        } else {
            console.warn(`⚠️ Dropdown not found for filter: ${filterKey} (looking for ${dropdownId}-dropdown)`)
        }
    });
    
    fkpDashboard.state.updatingFilters = false;
    
    updateFilterVisibility();
    console.log('✅ Filters initialized');
}

/**
 * Convert camelCase to kebab-case for HTML IDs
 */
function camelToKebab(str) {
    return str.replace(/([a-z0-9]|(?=[A-Z]))([A-Z])/g, '$1-$2').toLowerCase();
}

/**
 * Populate a filter dropdown with options
 */
function populateFilterDropdown(filterKey, options) {
    const dropdownId = camelToKebab(filterKey);
    const dropdown = document.getElementById(`${dropdownId}-dropdown`);
    if (!dropdown) {
        console.warn(`⚠️ Dropdown not found for: ${filterKey} (looking for ${dropdownId}-dropdown)`);
        return;
    }
    
    // Clear existing options (except select all)
    const selectAll = dropdown.querySelector('.select-all');
    dropdown.innerHTML = '';
    if (selectAll) {
        dropdown.appendChild(selectAll);
    }
    
    // Add options
    options.forEach(option => {
        const optionDiv = document.createElement('div');
        optionDiv.className = 'option';
        
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = `${filterKey}-${option.replace(/[^a-zA-Z0-9]/g, '-')}`;
        checkbox.value = option;
        checkbox.checked = fkpDashboard.filters[filterKey].includes(option);
        checkbox.addEventListener('change', () => handleFilterChange(filterKey, option, checkbox.checked));
        
        const label = document.createElement('label');
        label.htmlFor = checkbox.id;
        label.textContent = option;
        
        optionDiv.appendChild(checkbox);
        optionDiv.appendChild(label);
        dropdown.appendChild(optionDiv);
    });
}

/**
 * Handle filter changes and update interdependencies with smart real-time updates
 */
function handleFilterChange(filterKey, value, isChecked) {
    // Prevent loops during programmatic updates
    if (fkpDashboard.state.updatingFilters) {
        return;
    }
    
    console.log(`🔄 Filter change requested: ${filterKey} = ${value} (${isChecked})`);
    
    if (isChecked) {
        if (!fkpDashboard.filters[filterKey].includes(value)) {
            fkpDashboard.filters[filterKey].push(value);
        }
    } else {
        fkpDashboard.filters[filterKey] = fkpDashboard.filters[filterKey].filter(v => v !== value);
    }
    
    // Update selected text
    updateFilterSelectedText(filterKey);
    
    console.log(`✅ Filter updated: ${filterKey} now has ${fkpDashboard.filters[filterKey].length} items`);
    
    // Check if this is the first selection or if clearing all filters
    const wasEmpty = fkpDashboard.filters[filterKey].length === 1 && isChecked;
    const nowEmpty = fkpDashboard.filters[filterKey].length === 0;
    
    // If clearing all filters, trigger immediate update
    if (nowEmpty) {
        console.log('🚀 Clearing filters - immediate update');
        if (fkpDashboard.state.selectionTimer) {
            clearTimeout(fkpDashboard.state.selectionTimer);
            fkpDashboard.state.selectionTimer = null;
        }
        fkpDashboard.state.dropdownSelectionMode = false;
        debouncedRefresh();
        return;
    }
    
    // If this is the first selection, allow immediate update
    if (wasEmpty) {
        console.log('🚀 First selection - immediate update');
        debouncedRefresh();
        return;
    }
    
    // Otherwise, enter multi-selection mode
    fkpDashboard.state.dropdownSelectionMode = true;
    console.log('⏸️ Multi-selection mode - delaying update');
    
    // Clear any existing selection timer
    if (fkpDashboard.state.selectionTimer) {
        clearTimeout(fkpDashboard.state.selectionTimer);
    }
    
    // Set timer to detect when user is done with multi-selection
    fkpDashboard.state.selectionTimer = setTimeout(() => {
        console.log('⏰ Multi-selection timeout - triggering update');
        fkpDashboard.state.dropdownSelectionMode = false;
        debouncedRefresh();
    }, 1500); // 1.5 second delay allows for multi-selection
}

/**
 * Update interdependent filters based on current selections
 */
function updateInterdependentFilters() {
    const currentTab = fkpDashboard.state.currentTab;
    if (currentTab !== 'service-information') {
        // Interdependent filters only apply to service information tab
        return;
    }
    
    console.log('🔗 Updating interdependent filters...');
    
    // Get the full processed data
    const processed = fkpDashboard.data.processed;
    if (!processed) return;
    
    // Get currently filtered services based on current selections
    const filteredServices = getFilteredServices();
    
    // Extract available options from filtered services
    const availableOptions = {
        orgLeader: new Set(),
        parentCloud: new Set(),
        cloud: new Set(), 
        team: new Set(),
        service: new Set()
    };
    
    // Collect all available options from filtered services
    filteredServices.forEach(service => {
        availableOptions.orgLeader.add(service.orgLeader);
        availableOptions.parentCloud.add(service.parentCloud);
        availableOptions.cloud.add(service.cloud);
        availableOptions.team.add(service.team);
        availableOptions.service.add(service.name);
    });
    
    // Implement Option A: Auto-select unique values when moving up hierarchy
    autoSelectUniqueValues(availableOptions);
    
    // Update filter dropdowns with available options
    updateFilterDropdownOptions(availableOptions);
}

/**
 * Auto-select unique values when moving up hierarchy (Option A)
 */
function autoSelectUniqueValues(availableOptions) {
    fkpDashboard.state.updatingFilters = true;
    
    // Service → Team (one-to-one)
    if (fkpDashboard.filters.service.length > 0 && availableOptions.team.size === 1) {
        const uniqueTeam = Array.from(availableOptions.team)[0];
        if (!fkpDashboard.filters.team.includes(uniqueTeam)) {
            fkpDashboard.filters.team = [uniqueTeam];
            console.log(`🔗 Auto-selected unique team: ${uniqueTeam}`);
        }
    }
    
    // Team → Cloud (one-to-one)
    if (fkpDashboard.filters.team.length > 0 && availableOptions.cloud.size === 1) {
        const uniqueCloud = Array.from(availableOptions.cloud)[0];
        if (!fkpDashboard.filters.cloud.includes(uniqueCloud)) {
            fkpDashboard.filters.cloud = [uniqueCloud];
            console.log(`🔗 Auto-selected unique cloud: ${uniqueCloud}`);
        }
    }
    
    // Cloud → Parent Cloud (one-to-one)
    if (fkpDashboard.filters.cloud.length > 0 && availableOptions.parentCloud.size === 1) {
        const uniqueParentCloud = Array.from(availableOptions.parentCloud)[0];
        if (!fkpDashboard.filters.parentCloud.includes(uniqueParentCloud)) {
            fkpDashboard.filters.parentCloud = [uniqueParentCloud];
            console.log(`🔗 Auto-selected unique parent cloud: ${uniqueParentCloud}`);
        }
    }
    
    // Parent Cloud → Org Leader (one-to-one)
    if (fkpDashboard.filters.parentCloud.length > 0 && availableOptions.orgLeader.size === 1) {
        const uniqueOrgLeader = Array.from(availableOptions.orgLeader)[0];
        if (!fkpDashboard.filters.orgLeader.includes(uniqueOrgLeader)) {
            fkpDashboard.filters.orgLeader = [uniqueOrgLeader];
            console.log(`🔗 Auto-selected unique org leader: ${uniqueOrgLeader}`);
        }
    }
    
    fkpDashboard.state.updatingFilters = false;
}

/**
 * Update filter dropdown options based on available data (smart update to avoid disrupting selections)
 */
function updateFilterDropdownOptions(availableOptions) {
    // Skip dropdown reconstruction if user is actively making selections
    if (fkpDashboard.state.dropdownSelectionMode && fkpDashboard.state.activeDropdown) {
        console.log('⏸️ Skipping dropdown update - user is multi-selecting');
        return;
    }
    
    fkpDashboard.state.updatingFilters = true;
    
    // Update each filter dropdown with available options
    Object.keys(availableOptions).forEach(filterKey => {
        const availableList = Array.from(availableOptions[filterKey]).sort();
        const dropdownId = camelToKebab(filterKey);
        const dropdown = document.getElementById(`${dropdownId}-dropdown`);
        
        if (!dropdown) return;
        
        // Skip updating the currently active dropdown to avoid disruption
        if (fkpDashboard.state.activeDropdown === dropdownId) {
            console.log(`⏸️ Skipping update for active dropdown: ${dropdownId}`);
            return;
        }
        
        // Get current state
        const currentSelections = fkpDashboard.filters[filterKey] || [];
        
        // Clear existing options (keep select all)
        const selectAll = dropdown.querySelector('.select-all');
        dropdown.innerHTML = '';
        if (selectAll) {
            dropdown.appendChild(selectAll);
        }
        
        // Add available options  
        availableList.forEach(option => {
            const optionDiv = document.createElement('div');
            optionDiv.className = 'option';
            
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.id = `${dropdownId}-${option.replace(/[^a-zA-Z0-9]/g, '-')}`;
            checkbox.value = option;
            checkbox.checked = currentSelections.includes(option);
            checkbox.addEventListener('change', () => handleFilterChange(filterKey, option, checkbox.checked));
            
            const label = document.createElement('label');
            label.htmlFor = checkbox.id;
            label.textContent = option;
            
            optionDiv.appendChild(checkbox);
            optionDiv.appendChild(label);
            dropdown.appendChild(optionDiv);
        });
        
        // Update select all checkbox
        const selectAllCheckbox = dropdown.querySelector('.select-all input');
        if (selectAllCheckbox) {
            const allSelected = currentSelections.length === availableList.length;
            selectAllCheckbox.checked = allSelected;
        }
        
        // Update selected text
        updateFilterSelectedText(filterKey);
    });
    
    fkpDashboard.state.updatingFilters = false;
}

/**
 * Get filtered data based on current filter selections
 */
function getFilteredData() {
    const processed = fkpDashboard.data.processed;
    const filters = fkpDashboard.filters;
    
    // Filter services based on current filter selections
    const filteredServices = new Map();
    
    processed.services.forEach((service, serviceName) => {
        let include = true;
        
        // Apply filters
        if (filters.orgLeader.length > 0 && !filters.orgLeader.includes(service.orgLeader)) include = false;
        if (filters.parentCloud.length > 0 && !filters.parentCloud.includes(service.parentCloud)) include = false;
        if (filters.cloud.length > 0 && !filters.cloud.includes(service.cloud)) include = false;
        if (filters.team.length > 0 && !filters.team.includes(service.team)) include = false;
        if (filters.service.length > 0 && !filters.service.includes(serviceName)) include = false;
        
        // Customer type and environment filters need to check instances
        if (filters.customerType.length > 0 || filters.instanceEnv.length > 0) {
            const hasValidInstances = service.instances.some(instance => {
                let validCustomerType = filters.customerType.length === 0 || 
                    filters.customerType.includes(instance.customerType);
                let validEnv = filters.instanceEnv.length === 0 || 
                    (filters.instanceEnv.includes('Prod') && instance.isProd) ||
                    (filters.instanceEnv.includes('Pre-Prod') && instance.isPreProd);
                
                return validCustomerType && validEnv;
            });
            
            if (!hasValidInstances) include = false;
        }
        
        if (include) {
            filteredServices.set(serviceName, service);
        }
    });
    
    return filteredServices;
}

/**
 * Update filter selected text display  
 */
function updateFilterSelectedText(filterKey) {
    const dropdownId = camelToKebab(filterKey);
    const dropdown = document.getElementById(`${dropdownId}-dropdown`);
    if (!dropdown || !dropdown.parentElement) {
        console.warn(`⚠️ Filter dropdown not found for: ${filterKey} (looking for ${dropdownId}-dropdown)`);
        return;
    }
    
    const selectedText = dropdown.parentElement.querySelector('.selected-text');
    if (!selectedText) {
        console.warn(`⚠️ Selected text element not found for: ${filterKey}`);
        return;
    }
    
    const selected = fkpDashboard.filters[filterKey];
    const total = fkpDashboard.state.filterOptions[filterKey]?.length || 0;
    
    if (!selected || selected.length === 0) {
        selectedText.textContent = 'None selected';
    } else if (selected.length === total) {
        selectedText.textContent = `All ${filterKey.replace('-', ' ')}s`;
    } else if (selected.length === 1) {
        selectedText.textContent = selected[0];
    } else {
        selectedText.textContent = `${selected.length} selected`;
    }
}

/**
 * Update filter visibility based on current tab
 */
function updateFilterVisibility() {
    const currentTab = fkpDashboard.state.currentTab;
    const filtersBar = document.querySelector('.filters-bar');
    
    console.log('🔍 Updating filter visibility for tab:', currentTab);
    
    // Check if this is a React tab (has data-react-tab attribute)
    const navItem = document.querySelector(`[data-tab="${currentTab}"]`);
    const isReactTab = navItem && navItem.hasAttribute('data-react-tab');
    
    // Define Onboarding Exec View tabs (should NOT show filters)
    const onboardingExecTabs = ['executive-overview', 'migration-pipeline'];
    
    // Define Onboarding Developer View tabs (should show filters)
    const onboardingDevTabs = ['migration-dependencies', 'service-information', 
                               'cross-customer-analysis', 'integrations'];
    
    const isOnboardingExecTab = onboardingExecTabs.includes(currentTab);
    const isOnboardingDevTab = onboardingDevTabs.includes(currentTab);
    
    if (filtersBar) {
        if (currentTab === 'exec-summary' || isOnboardingExecTab) {
            // Hide filters for Onboarding Exec View tabs
            filtersBar.style.display = 'none';
        } else if (isOnboardingDevTab) {
            // Show filters for Onboarding Developer View tabs
            filtersBar.style.display = 'block';
            
            // Show/hide individual filters based on tab
            const filterGroups = document.querySelectorAll('.filter-group');
            filterGroups.forEach(group => {
                const filterType = group.getAttribute('data-filter');
                let show = true;
                
                switch (currentTab) {
                    case 'service-information':
                        // All filters apply to service information tab
                        show = true;
                        break;
                    case 'cross-customer-analysis':
                        // Remove customer-type, instance-env, and migration-stage filters
                        show = !['customer-type', 'instance-env', 'migration-stage'].includes(filterType);
                        break;
                    case 'migration-dependencies':
                        // Same as service information - remove instance-env
                        show = !['instance-env'].includes(filterType);
                        break;
                    case 'integrations':
                        // All filters apply to integrations tab except migration-stage
                        show = !['migration-stage'].includes(filterType);
                        break;
                }
                
                group.style.display = show ? 'block' : 'none';
            });
        } else {
            // Hide filters bar for React tabs and other tabs
            filtersBar.style.display = 'none';
        }
    }
}

/**
 * Initialize view controls based on tab
 */
function initializeViewControls() {
    updateViewControls(fkpDashboard.state.currentTab);
}

/**
 * Update view controls for the current tab
 */
function updateViewControls(tabId) {
    // View controls element removed - function kept for compatibility but does nothing
    fkpDashboard.state.currentTab = tabId;
}

/**
 * Update Exec/Developer view button states based on tab availability
 */
function updateViewButtonStates(tabId) {
    const execBtn = document.querySelector('.view-mode-btn[data-view="exec"]');
    const devBtn = document.querySelector('.view-mode-btn[data-view="developer"]');
    const headerControls = document.querySelector('.header-controls');
    const viewToggleContainer = document.querySelector('.view-toggle-container');
    
    if (tabId === 'exec-summary') {
        if (headerControls) {
            headerControls.style.setProperty('display', 'none', 'important');
        }
        if (viewToggleContainer) {
            viewToggleContainer.style.setProperty('display', 'none', 'important');
        }
        return;
    }

    // Ensure header controls are visible
    if (headerControls) {
        headerControls.style.display = 'flex';
        headerControls.style.visibility = 'visible';
    }
    
    if (viewToggleContainer) {
        viewToggleContainer.style.display = 'flex';
        viewToggleContainer.style.visibility = 'visible';
    }
    
    if (!execBtn || !devBtn) {
        console.warn('⚠️ View mode buttons not found, retrying...');
        // Retry after a short delay in case DOM isn't ready
        setTimeout(() => {
            const retryExecBtn = document.querySelector('.view-mode-btn[data-view="exec"]');
            const retryDevBtn = document.querySelector('.view-mode-btn[data-view="developer"]');
            if (retryExecBtn && retryDevBtn) {
                updateViewButtonStates(tabId);
            } else {
                console.error('❌ View mode buttons still not found after retry');
            }
        }, 100);
        return;
    }
    
    // Ensure buttons are visible with !important equivalent
    execBtn.style.setProperty('display', 'flex', 'important');
    devBtn.style.setProperty('display', 'flex', 'important');
    execBtn.style.setProperty('visibility', 'visible', 'important');
    devBtn.style.setProperty('visibility', 'visible', 'important');
    execBtn.style.setProperty('opacity', '1', 'important');
    devBtn.style.setProperty('opacity', '1', 'important');
    
    // Determine which views are available for this tab
    const navItem = document.querySelector(`[data-tab="${tabId}"]`);
    if (!navItem) return;
    
    const tabView = navItem.getAttribute('data-view');
    
    // Define view availability per tab
    const viewAvailability = {
        // Executive Summary: Exec only
        'exec-summary': { exec: true, developer: false },
        // Availability: Exec + Developer
        'runtime-availability-detection': { exec: true, developer: false },
        'runtime-availability-prevention': { exec: true, developer: true },
        'runtime-availability-remediation': { exec: true, developer: true },
        'runtime-availability-readiness': { exec: true, developer: true },
        'runtime-availability-ingress': { exec: true, developer: true },
        // Legacy availability tabs
        'runtime-availability': { exec: true, developer: true },
        'runtime-availability-inventory': { exec: true, developer: true },
        // Autoscaling: Both
        'runtime-overview': { exec: true, developer: true },
        'runtime-hpa': { exec: true, developer: true },
        // Karpenter: Both
        'runtime-karpenter': { exec: true, developer: true },
        // Onboarding Overview: Both
        'executive-overview': { exec: true, developer: true },
        // Migration Pipeline: Exec only
        'migration-pipeline': { exec: true, developer: false },
        // Projections & Roadmap: Exec only
        'projections-roadmap': { exec: true, developer: false },
        // Developer-only tabs: Developer only
        'migration-dependencies': { exec: false, developer: true },
        'cross-customer-analysis': { exec: false, developer: true },
        'integrations': { exec: false, developer: true },
        'service-information': { exec: true, developer: true },
        // Cost to Serve: Exec only (Developer View disabled)
        'cost-to-serve-overview': { exec: true, developer: false },
        'cost-to-serve-hps': { exec: true, developer: false },
        'cost-to-serve-budget-forecast': { exec: true, developer: false },
        'cost-to-serve-details': { exec: false, developer: false }
    };
    
    const availability = viewAvailability[tabId] || { exec: true, developer: true };
    
    // Update Exec View button
    if (availability.exec) {
        execBtn.classList.remove('disabled');
        execBtn.removeAttribute('title');
        execBtn.style.opacity = '1';
        execBtn.style.cursor = 'pointer';
        execBtn.onclick = () => switchViewMode('exec');
    } else {
        execBtn.classList.add('disabled');
        execBtn.setAttribute('title', 'Exec View is not available for this dashboard');
        execBtn.style.opacity = '0.5';
        execBtn.style.cursor = 'not-allowed';
        execBtn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
        };
    }
    
    // Update Developer View button
    if (availability.developer) {
        devBtn.classList.remove('disabled');
        devBtn.removeAttribute('title');
        devBtn.style.opacity = '1';
        devBtn.style.cursor = 'pointer';
        devBtn.onclick = () => switchViewMode('developer');
    } else {
        devBtn.classList.add('disabled');
        devBtn.setAttribute('title', 'Developer View is not available for this dashboard');
        devBtn.style.opacity = '0.5';
        devBtn.style.cursor = 'not-allowed';
        devBtn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            return false;
        };
    }
}

/**
 * Set view mode and refresh content
 */
function setViewMode(type, value) {
    fkpDashboard.state.viewMode[type] = value;
    updateViewControls(fkpDashboard.state.currentTab);
    refreshCurrentTab();
}

/**
 * Switch to a different tab
 */
function switchTab(tabId) {
    console.log('📋 Switching to tab:', tabId);
    const legacyTabMap = {
        'runtime-availability': 'runtime-availability-detection',
        'runtime-availability-inventory': 'runtime-availability-prevention',
        'availability-exec': 'runtime-availability-detection',
        'availability-baseline': 'runtime-availability-detection'
    };
    if (legacyTabMap[tabId]) {
        tabId = legacyTabMap[tabId];
    }
    
    // Check if this is a React tab
    const navItem = document.querySelector(`[data-tab="${tabId}"]`);
    const isReactTab = navItem && navItem.hasAttribute('data-react-tab');
    const execSummaryContent = document.getElementById('exec-summary-content');
    if (execSummaryContent) {
        execSummaryContent.style.display = tabId === 'exec-summary' ? 'block' : 'none';
    }
    const tabContentEl = document.querySelector('.content-area .tab-content');
    if (tabContentEl) {
        tabContentEl.style.display = tabId === 'exec-summary' ? 'none' : 'block';
    }

    if (tabId === 'exec-summary') {
        const headerControls = document.querySelector('.header-controls');
        const viewToggleContainer = document.querySelector('.view-toggle-container');
        if (headerControls) headerControls.style.setProperty('display', 'none', 'important');
        if (viewToggleContainer) viewToggleContainer.style.setProperty('display', 'none', 'important');
        renderExecutiveSummary();
        document.querySelectorAll('.tab-pane').forEach(pane => {
            pane.classList.remove('active');
            if (pane.id !== 'react-tabs-container') {
                pane.style.display = 'none';
            }
        });
        const reactContainer = document.getElementById('react-tabs-container');
        if (reactContainer) {
            reactContainer.style.display = 'none';
            reactContainer.classList.remove('active');
        }
        document.body.classList.remove('executive-overview-active');
        updatePageHeader(tabId);
        fkpDashboard.state.currentTab = tabId;
        updateViewControls(tabId);
        updateViewButtonStates(tabId);
        updateSidebarSection(tabId);
        updateFilterVisibility();
        return;
    }
    
    if (isReactTab) {
        // Hide all regular tab panes
        document.querySelectorAll('.tab-pane').forEach(pane => {
            pane.classList.remove('active');
            if (pane.id !== 'react-tabs-container') {
                pane.style.display = 'none';
            }
        });
        
        // Remove padding from content area for React tabs
        const contentArea = document.querySelector('.content-area');
        if (contentArea) {
            contentArea.style.padding = '0';
        }
        
        // Show React container
        const reactContainer = document.getElementById('react-tabs-container');
        if (reactContainer) {
            reactContainer.style.display = 'block';
            reactContainer.classList.add('active');
            reactContainer.setAttribute('data-active-tab', tabId);
            
            // Trigger React tab update if React is loaded
            if (window.updateReactTab) {
                window.updateReactTab(tabId);
            } else {
                console.warn('React tabs not loaded yet. Loading...');
                // React will initialize when loaded
            }
        }
    } else {
        // Restore padding for regular tabs
        const contentArea = document.querySelector('.content-area');
        if (contentArea) {
            contentArea.style.padding = '';
        }
        
        // Hide React container
        const reactContainer = document.getElementById('react-tabs-container');
        if (reactContainer) {
            reactContainer.style.display = 'none';
            reactContainer.classList.remove('active');
        }
        
        // Update tab content for regular tabs
        document.querySelectorAll('.tab-pane').forEach(pane => {
            pane.classList.remove('active');
            if (pane.id === tabId) {
                pane.style.display = 'block';
                pane.classList.add('active');
            } else if (pane.id !== 'react-tabs-container') {
                pane.style.display = 'none';
            }
        });
    }
    
    // Add body class for CSS targeting (for filter layout)
    document.body.classList.remove('executive-overview-active');
    if (tabId === 'executive-overview') {
        document.body.classList.add('executive-overview-active');
    }
    
    // Update page header dynamically
    updatePageHeader(tabId);
    
    // Update current state
    fkpDashboard.state.currentTab = tabId;
    
    // Update view controls
    updateViewControls(tabId);
    
    // Update view button states (gray out if view not available)
    updateViewButtonStates(tabId);
    
    // Ensure only the active section is expanded
    updateSidebarSection(tabId);
    
    // Update filter visibility
    updateFilterVisibility();
    
    // Refresh content (only for non-React tabs)
    if (!isReactTab) {
        try {
            refreshCurrentTab();
        } catch (err) {
            console.error('❌ Error refreshing tab content:', err);
        }
    }
}

function updateSidebarSection(tabId) {
    const navItem = document.querySelector(`.nav-subitem[data-tab="${tabId}"]`);
    const mainItem = document.querySelector(`.nav-item.main-item[data-tab="${tabId}"]`);
    const targetItem = navItem || mainItem;
    if (!targetItem) return;
    
    const parentSection = targetItem.closest('.nav-section');
    if (!parentSection) return;
    
    // Collapse all sections
    document.querySelectorAll('.nav-subitems').forEach(list => list.classList.remove('active'));
    document.querySelectorAll('.nav-item.main-item').forEach(item => item.classList.remove('active'));
    
    // Expand current section
    const sectionMainItem = parentSection.querySelector('.nav-item.main-item');
    const subitems = parentSection.querySelector('.nav-subitems');
    if (sectionMainItem) sectionMainItem.classList.add('active');
    if (subitems) subitems.classList.add('active');
}

// Expose critical nav APIs immediately so inline scripts and sidebar work even if script fails later
window.switchTab = switchTab;
window.updateSidebarSection = updateSidebarSection;

/**
 * Inline sidebar handlers so tabs work even if something blocks propagation.
 * Call from onclick="handleNavTabClick('runtime-karpenter')" etc.
 */
function handleNavTabClick(tabId) {
    if (!tabId) return;
    const subitem = document.querySelector(`.nav-subitem[data-tab="${tabId}"]`);
    if (subitem && subitem.getAttribute('data-disabled') === 'true') return;
    try {
        switchTab(tabId);
        document.querySelectorAll('.nav-subitem').forEach(i => i.classList.remove('active'));
        if (subitem) subitem.classList.add('active');
        updateSidebarSection(tabId);
    } catch (err) {
        console.error('❌ handleNavTabClick:', err);
    }
}

/**
 * Expand/collapse a sidebar section. Call from onclick="handleNavSectionExpand('runtime-scale')".
 */
function handleNavSectionExpand(sectionId) {
    const subitems = document.getElementById(sectionId + '-subitems');
    const mainItem = document.querySelector(`.nav-item.main-item[data-section="${sectionId}"]`);
    if (!subitems || !mainItem) return;
    const wasActive = subitems.classList.contains('active');
    document.querySelectorAll('.nav-subitems').forEach(list => list.classList.remove('active'));
    document.querySelectorAll('.nav-item.main-item').forEach(m => m.classList.remove('active'));
    if (!wasActive) {
        subitems.classList.add('active');
        mainItem.classList.add('active');
    }
}

/**
 * Update page header based on selected tab
 */
function updatePageHeader(tabId) {
    const pageTitle = document.querySelector('.page-title h1');
    const pageSubtitle = document.querySelector('.page-subtitle');
    
    if (!pageTitle || !pageSubtitle) return;
    
    const tabTitles = {
        'exec-summary': {
            title: 'Hyperforce Runtime Platform 360',
            subtitle: 'HRP Executive Summary'
        },
        'executive-overview': {
            title: 'Onboarding',
            subtitle: 'Overview'
        },
        'migration-pipeline': {
            title: 'Onboarding', 
            subtitle: 'Migration Pipeline'
        },
        'projections-roadmap': {
            title: 'Onboarding',
            subtitle: 'Projections & Roadmap'
        },
        'migration-dependencies': {
            title: 'Onboarding',
            subtitle: 'Migration Dependencies'
        },
        'service-information': {
            title: 'Onboarding',
            subtitle: 'Overview'
        },
        'cross-customer-analysis': {
            title: 'Onboarding',
            subtitle: 'COGS Analysis'
        },
        'integrations': {
            title: 'Onboarding',
            subtitle: 'Integrations'
        },
        // React tabs
        'runtime-overview': {
            title: 'Runtime Scale',
            subtitle: 'Autoscaling'
        },
        'runtime-hpa': {
            title: 'Runtime Scale',
            subtitle: 'Autoscaling'
        },
        'runtime-karpenter': {
            title: 'Runtime Scale',
            subtitle: 'Karpenter'
        },
        'runtime-availability-detection': {
            title: 'Runtime Availability',
            subtitle: 'Detection'
        },
        'runtime-availability-prevention': {
            title: 'Runtime Availability',
            subtitle: 'Prevention'
        },
        'runtime-availability-remediation': {
            title: 'Runtime Availability',
            subtitle: 'Remediation'
        },
        'runtime-availability-readiness': {
            title: 'Runtime Availability',
            subtitle: 'HRP Test Readiness (Preventive)'
        },
        'runtime-availability-ingress': {
            title: 'Runtime Availability',
            subtitle: 'Ingress Alert Quality'
        },
        // Legacy tabs
        'runtime-availability': {
            title: 'Runtime Availability',
            subtitle: 'Detection'
        },
        'runtime-availability-inventory': {
            title: 'Runtime Availability',
            subtitle: 'Prevention'
        },
        'cost-overview': {
            title: 'Cost to Serve',
            subtitle: 'Overview'
        },
        'cost-hcp': {
            title: 'Cost to Serve',
            subtitle: 'Overview'
        },
        'cost-to-serve-overview': {
            title: 'Cost to Serve',
            subtitle: 'Cost to Serve - HRP'
        },
        'cost-to-serve-hps': {
            title: 'Cost to Serve',
            subtitle: 'Cost to Serve - HPS'
        },
        'cost-to-serve-budget-forecast': {
            title: 'Cost to Serve',
            subtitle: 'Budget and Forecast'
        },
        'cost-to-serve-details': {
            title: 'Cost to Serve',
            subtitle: 'Details'
        },
        'selfserve-overview': {
            title: 'Self Serve',
            subtitle: 'Self-service tools and resources for platform management'
        }
    };
    
    const tabInfo = tabTitles[tabId] || { 
        title: 'Hyperforce Runtime Platform 360', 
        subtitle: 'Comprehensive platform performance, availability, and cost optimization' 
    };
    
    pageTitle.textContent = tabInfo.title;
    pageSubtitle.textContent = tabInfo.subtitle;
}

/**
 * Render Executive Summary page (non-tab layout)
 */
async function renderExecutiveSummary() {
    const contentArea = document.querySelector('.content-area');
    if (!contentArea) return;

    let container = document.getElementById('exec-summary-content');
    if (!container) {
        container = document.createElement('div');
        container.id = 'exec-summary-content';
        container.className = 'exec-summary-content';
        contentArea.prepend(container);
    }

    container.style.display = 'block';
    container.innerHTML = '<div class="exec-summary-loading">Loading executive summary...</div>';

    try {
        await Promise.all([
            loadAllAvailabilityData(),
            loadAutoscalingData(),
            loadKarpenterData()
        ]);

        // Runtime Availability metrics
        const incidents = availabilityData.incidents || [];
        const now = new Date();
        now.setHours(23, 59, 59, 999);
        const twelveMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        twelveMonthStart.setMonth(twelveMonthStart.getMonth() - 11);
        const thirtyDaysAgo = new Date(now);
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const msPerDay = 24 * 60 * 60 * 1000;

        const getIncidentsInWindow = (severity) => incidents.filter(inc => {
            const incDate = new Date(inc.detected_date);
            if (Number.isNaN(incDate.getTime())) return false;
            return inc.severity === severity && incDate >= twelveMonthStart && incDate <= now;
        });

        const getRecentIncidents = (severity) => incidents.filter(inc => {
            const incDate = new Date(inc.detected_date);
            if (Number.isNaN(incDate.getTime())) return false;
            return inc.severity === severity && incDate >= thirtyDaysAgo && incDate <= now;
        });

        const calcAvg = (rows, field) => {
            const valid = rows.filter(inc => parseFloat(inc[field]) > 0);
            if (!valid.length) return 0;
            const total = valid.reduce((sum, inc) => sum + parseFloat(inc[field] || 0), 0);
            return Math.round(total / valid.length);
        };

        const getLatestBySeverity = (severity) => {
            let latest = null;
            incidents.forEach(inc => {
                if (inc.severity !== severity) return;
                const date = new Date(inc.detected_date);
                if (Number.isNaN(date.getTime())) return;
                if (!latest || date > latest) latest = date;
            });
            return latest;
        };

        const sev0Window = getIncidentsInWindow('Sev0');
        const sev1Window = getIncidentsInWindow('Sev1');
        const sev0Recent = getRecentIncidents('Sev0');
        const sev1Recent = getRecentIncidents('Sev1');
        const sev0Incidents = sev0Window.length;
        const sev1Incidents = sev1Window.length;
        const avgMttdSev0 = calcAvg(sev0Recent, 'ttd_min');
        const avgMttrSev0 = calcAvg(sev0Recent, 'ttr_min');
        const avgMttdSev1 = calcAvg(sev1Recent, 'ttd_min');
        const avgMttrSev1 = calcAvg(sev1Recent, 'ttr_min');
        const avgMttdSev0_12 = calcAvg(sev0Window, 'ttd_min');
        const avgMttrSev0_12 = calcAvg(sev0Window, 'ttr_min');
        const avgMttdSev1_12 = calcAvg(sev1Window, 'ttd_min');
        const avgMttrSev1_12 = calcAvg(sev1Window, 'ttr_min');
        const sev0Latest = getLatestBySeverity('Sev0');
        const sev1Latest = getLatestBySeverity('Sev1');
        const sev0DaysSince = sev0Latest ? Math.max(0, Math.floor((now - sev0Latest) / msPerDay)) : null;
        const sev1DaysSince = sev1Latest ? Math.max(0, Math.floor((now - sev1Latest) / msPerDay)) : null;
        const sev0Months = Array.from(new Set(sev0Window.map(inc => {
            const date = new Date(inc.detected_date);
            return Number.isNaN(date.getTime()) ? null : formatDetectedMonth(date);
        }).filter(Boolean)));
        const sev1ServiceCount = new Set(sev1Window.map(inc => inc.prb_owner).filter(Boolean)).size;
        const slaClass = (avg, target) => {
            if (!avg || avg <= 0) return 'text-slate';
            return avg <= target ? 'text-green' : 'text-red';
        };

        // Runtime Scale metrics (Autoscaling)
        const services = autoscalingData.services || [];
        const totalServices = services.length || 0;
        const hpaEnabledCount = services.filter(s => s.hpa > 0).length;
        const hpaAdoptionRate = totalServices > 0 ? ((hpaEnabledCount / totalServices) * 100) : 0;
        const tier0Services = services.filter(s => s.serviceTier === 0);
        const tier1Services = services.filter(s => s.serviceTier === 1);
        const tier0Total = tier0Services.length;
        const tier1Total = tier1Services.length;
        const tier0Hpa = tier0Services.filter(s => s.hpa > 0).length;
        const tier1Hpa = tier1Services.filter(s => s.hpa > 0).length;
        const tier0HpaRate = tier0Total > 0 ? ((tier0Hpa / tier0Total) * 100) : 0;
        const tier1HpaRate = tier1Total > 0 ? ((tier1Hpa / tier1Total) * 100) : 0;
        
        // Calculate AZ Distribution metrics
        const azDistribEnabledCount = services.filter(s => s.azDistrib > 0).length;
        const azDistribAdoptionRate = totalServices > 0 ? ((azDistribEnabledCount / totalServices) * 100) : 0;
        const tier0AzDistrib = tier0Services.filter(s => s.azDistrib > 0).length;
        const tier1AzDistrib = tier1Services.filter(s => s.azDistrib > 0).length;
        const tier0AzDistribRate = tier0Total > 0 ? ((tier0AzDistrib / tier0Total) * 100) : 0;
        const tier1AzDistribRate = tier1Total > 0 ? ((tier1AzDistrib / tier1Total) * 100) : 0;

        // Runtime Scale metrics (Karpenter)
        const filteredKarpenter = filterKarpenterData(karpenterData.mainSummary || [], true);
        const calcGroupedAvg = (data, groupBy) => {
            if (!data || data.length === 0) return 0;
            const byGroup = {};
            data.forEach(r => {
                const key = r[groupBy] || 'unknown';
                if (!byGroup[key]) byGroup[key] = { sum: 0, count: 0 };
                byGroup[key].sum += parseFloat(r.avg_cpu || 0);
                byGroup[key].count += 1;
            });
            const groups = Object.values(byGroup).filter(g => g.count > 0);
            if (!groups.length) return 0;
            const groupAvgs = groups.map(g => g.sum / g.count);
            return groupAvgs.reduce((a, b) => a + b, 0) / groupAvgs.length;
        };
        const avgFi = calcGroupedAvg(filteredKarpenter, 'falcon_instance');
        const avgFd = calcGroupedAvg(filteredKarpenter, 'functional_domain');
        const avgCluster = calcGroupedAvg(filteredKarpenter, 'cluster');

        // Cost to Serve metrics (FY27: $7.78M predicted, $0 actuals; FY26: from JSON)
        const costToServeFY = (typeof window.costToServeFY !== 'undefined' ? window.costToServeFY : 'FY27');
        let totalPredictedSavings = null;
        let totalActualSavings = null;
        if (costToServeFY === 'FY27') {
            totalPredictedSavings = 7780000;  // $7.78M
            totalActualSavings = 0;
        } else {
            try {
                const ctsResponse = await fetch('assets/data/hcp-cts-forecast-actuals.json?v=20250128');
                if (ctsResponse.ok) {
                    const ctsData = await ctsResponse.json();
                    totalPredictedSavings = ctsData?.summary?.totalRevisedSavings ?? null;
                    totalActualSavings = ctsData?.summary?.totalActualSavings ?? null;
                }
            } catch (error) {
                console.warn('⚠️ Failed to load CTS summary data:', error);
            }
        }

        // Onboarding metrics
        const adoptionMetrics = calculateAdoptionByCustomerType();
        const commercial = adoptionMetrics['Commercial'] || { adoptionPct: 0, fkpInstances: 0, totalInstances: 0 };
        const gia = adoptionMetrics['GIA'] || { adoptionPct: 0, fkpInstances: 0, totalInstances: 0 };
        const blackjack = adoptionMetrics['BlackJack'] || { adoptionPct: 0, fkpInstances: 0, totalInstances: 0 };
        const overallTotal = commercial.totalInstances + gia.totalInstances + blackjack.totalInstances;
        const overallFkp = commercial.fkpInstances + gia.fkpInstances + blackjack.fkpInstances;
        const overallAdoption = overallTotal > 0 ? (overallFkp / overallTotal) * 100 : 0;

        const formatCurrencySafe = (value) => {
            if (typeof formatCurrency === 'function' && value !== null) {
                return formatCurrency(value);
            }
            return value !== null ? `$${(value / 1000000).toFixed(2)}M` : '--';
        };

        const formatCurrencySigned = (value) => {
            if (value === null) return '--';
            const abs = Math.abs(value);
            const formatted = formatCurrencySafe(abs);
            return value < 0 ? `-${formatted}` : formatted;
        };

        const varianceValue = (totalPredictedSavings !== null && totalActualSavings !== null)
            ? totalActualSavings - totalPredictedSavings
            : null;
        const achievementRate = (totalPredictedSavings && totalActualSavings !== null)
            ? (totalActualSavings / totalPredictedSavings) * 100
            : null;

        // FIT data for prevention KPIs
    const fitRows = getFilteredFitRows();

        const normalizeValue = (value) => (value || '').toString().trim().toLowerCase();
        const parseFailureRate = (value) => {
            const num = parseFloat((value || '').toString().replace('%', '').trim());
            return Number.isNaN(num) ? null : num;
        };
        const parseRunDate = (value) => {
            if (!value) return null;
            const cleaned = value.toString().replace(' @ ', ' ');
            const date = new Date(cleaned);
            return Number.isNaN(date.getTime()) ? null : date;
        };
        const getRunTypeRows = (rows, typeKey) => rows.filter(r =>
            normalizeValue(r['Run Type']).includes(typeKey)
        );
        const getLast30Rows = (rows) => rows.filter(r => {
            const date = parseRunDate(r['Run Time']);
            return date && date >= thirtyDaysAgo && date <= now;
        });
        const uniqueProductCount = (rows) => new Set(rows.map(r => r.Product).filter(Boolean)).size;
        const sumTests = (rows) => rows.reduce((sum, r) => sum + (parseInt(r.Tests || 0, 10) || 0), 0);
        const calcSuccessRate = (rows) => {
            const rates = rows.map(r => parseFailureRate(r['Failure Rate'])).filter(v => v !== null);
            if (!rates.length) return null;
            const avgFailure = rates.reduce((a, b) => a + b, 0) / rates.length;
            return Math.max(0, 100 - avgFailure);
        };
        const calcSuccessRateWindow = (rows, start, end) => {
            const windowed = rows.filter(r => {
                const date = parseRunDate(r['Run Time']);
                return date && date >= start && date <= end;
            });
            return calcSuccessRate(windowed);
        };
        const formatDelta = (current, previous) => {
            if (current === null || previous === null) return { text: 'No change vs last month', className: 'text-slate' };
            const delta = current - previous;
            const abs = Math.abs(delta).toFixed(1);
            if (delta === 0) return { text: 'No change vs last month', className: 'text-slate' };
            return {
                text: `${delta > 0 ? '↑' : '↓'} ${abs}% vs last month`,
                className: delta > 0 ? 'text-green' : 'text-red'
            };
        };

        const preRows = getRunTypeRows(fitRows, 'predeployment');
        const postRows = getRunTypeRows(fitRows, 'postdeployment');
        const preLast30 = getLast30Rows(preRows);
        const postLast30 = getLast30Rows(postRows);
        const prevThirtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
        const prePrevWindowStart = new Date(prevThirtyDaysAgo.getFullYear(), prevThirtyDaysAgo.getMonth(), 1);
        const prePrev30 = preRows.filter(r => {
            const date = parseRunDate(r['Run Time']);
            return date && date >= prePrevWindowStart && date < thirtyDaysAgo;
        });
        const postPrev30 = postRows.filter(r => {
            const date = parseRunDate(r['Run Time']);
            return date && date >= prevThirtyDaysAgo && date < thirtyDaysAgo;
        });
        const preProductCount = new Set(preRows.map(r => getFitProductForService(r.Service)).filter(p => p && p !== 'N/A')).size;
        const preTestsCount = sumTests(preRows);
        const preServiceCount = new Set(preRows.map(r => r.Service).filter(Boolean)).size;
        const totalHrpServices = Object.keys(availabilityData.fitServiceProductMap || {}).length;
        const preSuccessRate = calcSuccessRate(preLast30);
        const postSuccessRate = calcSuccessRate(postLast30);
        const prePrevSuccess = calcSuccessRate(prePrev30);
        const postPrevSuccess = calcSuccessRate(postPrev30);
        const preDelta = formatDelta(preSuccessRate, prePrevSuccess);
        const postDelta = formatDelta(postSuccessRate, postPrevSuccess);

        // Customer Scenario and Chaos product counts
        const customerScenarioRows = availabilityData.testInventory.customerScenario.rows || [];
        const chaosRows = availabilityData.testInventory.chaos.rows || [];
        const scalePerfRows = mapInventoryRows(availabilityData.testInventory.scalePerf.rows || [], 'scalePerf');
        const customerMapped = mapInventoryRows(customerScenarioRows, 'customerScenario');
        const chaosMapped = mapInventoryRows(chaosRows, 'chaos');

        const getStatus = (row) => normalizeValue(row.Status);
        const enabledProducts = new Set();
        const plannedProducts = new Set();
        let enabledTests = 0;
        customerMapped.forEach(row => {
            const product = row._product;
            const status = getStatus(row);
            if (status === 'enabled') {
                enabledProducts.add(product);
                enabledTests += 1;
            } else if (status === 'not enabled' || status === 'partial') {
                plannedProducts.add(product);
            }
        });

        const chaosEnabledProducts = new Set();
        const chaosAllProducts = new Set();
        let chaosPlannedTests = 0;
        chaosMapped.forEach(row => {
            const product = row._product;
            chaosAllProducts.add(product);
            const enabledValue = normalizeValue(row.Enabled);
            if (enabledValue === 'enabled') {
                chaosEnabledProducts.add(product);
            } else if (enabledValue === 'not enabled' || enabledValue === 'tbd' || enabledValue === 'planned') {
                chaosPlannedTests += 1;
            } else {
                const frequency = normalizeValue(row.Frequency);
                if (frequency && frequency !== 'not enabled' && frequency !== 'tbd') {
                    chaosEnabledProducts.add(product);
                } else {
                    chaosPlannedTests += 1;
                }
            }
        });

        const scalePerfProducts = new Set(scalePerfRows.map(row => row._product).filter(Boolean));
        const scalePerfSummary = buildInventorySummary(getInventoryProducts(), {
            scalePerf: scalePerfRows
        });
        const scalePerfEnabledProducts = new Set();
        Object.keys(scalePerfSummary).forEach(product => {
            const bucket = scalePerfSummary[product]?.scalePerf;
            if (bucket && bucket.enabled > 0) {
                scalePerfEnabledProducts.add(product);
            }
        });
        const testMttrHours = 4.2;
        const testMttrSub = '↓ 1.3 hrs improvement';

        const kpiCard = ({
            title,
            value,
            sub,
            subClass = '',
            valueClass = '',
            onClick
        }) => `
            <div class="exec-summary-kpi-card ${onClick ? 'clickable' : ''}" ${onClick ? `onclick="${onClick}"` : ''}>
                <div class="exec-summary-kpi-label">${title}</div>
                <div class="exec-summary-kpi-value ${valueClass}">${value}</div>
                <div class="exec-summary-kpi-sub ${subClass}">${sub || ''}</div>
            </div>
        `;

        const sectionDivider = '<div class="exec-summary-divider"></div>';

        container.innerHTML = `
            <div class="exec-summary-banner">
                HRP 360 - Consolidated Dashboard Driving Platform Excellence through Unified Visibility and Adoption
            </div>

            <section class="exec-summary-section">
                <div class="exec-summary-section-header"><span class="exec-summary-section-icon">🛡️</span>Runtime Availability - Detection KPIs</div>
                <div class="exec-summary-section-card">
                    <div class="exec-summary-kpi-row sev0-row">
                        <div class="exec-summary-kpi-grid columns-4">
                        ${kpiCard({
                            title: 'Sev0 Incidents (12MO)',
                            value: sev0Incidents,
                            sub: sev0Months.length ? `${sev0Incidents} total (${sev0Months.join(', ')})` : `${sev0Incidents} total`,
                            valueClass: 'text-red',
                            onClick: "switchTab('runtime-availability-detection'); scrollToTabContent('runtime-availability-detection')"
                        })}
                        ${kpiCard({
                            title: 'Avg MTTD (Last 30 D)',
                            value: `${avgMttdSev0}<span class="exec-summary-unit">min</span>`,
                            sub: `SLA Target <10 min<br><span class="exec-summary-sub-metric ${slaClass(avgMttdSev0_12, 10)}">12mo avg: ${avgMttdSev0_12} min</span>`,
                            valueClass: slaClass(avgMttdSev0, 10),
                            onClick: "switchTab('runtime-availability-detection'); scrollToTabContent('runtime-availability-detection')"
                        })}
                        ${kpiCard({
                            title: 'Avg MTTR (Last 30 D)',
                            value: `${avgMttrSev0}<span class="exec-summary-unit">min</span>`,
                            sub: `SLA Target <30 min<br><span class="exec-summary-sub-metric ${slaClass(avgMttrSev0_12, 30)}">12mo avg: ${avgMttrSev0_12} min</span>`,
                            valueClass: slaClass(avgMttrSev0, 30),
                            onClick: "switchTab('runtime-availability-detection'); scrollToTabContent('runtime-availability-detection')"
                        })}
                        ${kpiCard({
                            title: 'Days Since Last Incident',
                            value: sev0DaysSince !== null ? `${sev0DaysSince}` : '--',
                            sub: sev0DaysSince !== null ? 'Days since last incident' : 'No Sev0 incidents',
                            valueClass: 'text-red days-number',
                            onClick: "switchTab('runtime-availability-detection'); scrollToTabContent('runtime-availability-detection')"
                        })}
                        </div>
                    </div>
                    <div class="exec-summary-kpi-row sev1-row">
                        <div class="exec-summary-kpi-grid columns-4">
                        ${kpiCard({
                            title: 'Sev1 Incidents (12MO)',
                            value: sev1Incidents,
                            sub: sev1ServiceCount > 0 ? `${sev1Incidents} total across ${sev1ServiceCount} services` : `${sev1Incidents} total`,
                            valueClass: 'text-orange',
                            onClick: "switchTab('runtime-availability-detection'); scrollToTabContent('runtime-availability-detection')"
                        })}
                        ${kpiCard({
                            title: 'Avg MTTD (Last 30 D)',
                            value: `${avgMttdSev1}<span class="exec-summary-unit">min</span>`,
                            sub: `SLA Target <10 min<br><span class="exec-summary-sub-metric ${slaClass(avgMttdSev1_12, 10)}">12mo avg: ${avgMttdSev1_12} min</span>`,
                            valueClass: slaClass(avgMttdSev1, 10),
                            onClick: "switchTab('runtime-availability-detection'); scrollToTabContent('runtime-availability-detection')"
                        })}
                        ${kpiCard({
                            title: 'Avg MTTR (Last 30 D)',
                            value: `${avgMttrSev1}<span class="exec-summary-unit">min</span>`,
                            sub: `SLA Target <30 min<br><span class="exec-summary-sub-metric ${slaClass(avgMttrSev1_12, 30)}">12mo avg: ${avgMttrSev1_12} min</span>`,
                            valueClass: slaClass(avgMttrSev1, 30),
                            onClick: "switchTab('runtime-availability-detection'); scrollToTabContent('runtime-availability-detection')"
                        })}
                        ${kpiCard({
                            title: 'Days Since Last Incident',
                            value: sev1DaysSince !== null ? `${sev1DaysSince}` : '--',
                            sub: sev1DaysSince !== null ? 'Days since last incident' : 'No Sev1 incidents',
                            valueClass: 'text-orange days-number',
                            onClick: "switchTab('runtime-availability-detection'); scrollToTabContent('runtime-availability-detection')"
                        })}
                        </div>
                    </div>
                </div>
            </section>
            ${sectionDivider}

            <section class="exec-summary-section">
                <div class="exec-summary-section-header"><span class="exec-summary-section-icon">🛡️</span>Runtime Availability - Prevention KPIs</div>
                <div class="exec-summary-section-card">
                    <div class="exec-summary-kpi-grid columns-4">
                        ${kpiCard({
                            title: 'Products - Pre-Deployment FIT Testing',
                            value: preProductCount || 0,
                            sub: `${preServiceCount} services enabled across ${totalHrpServices} total HRP services`,
                            valueClass: 'text-blue',
                            onClick: "openAvailabilityInventoryTabFromKpi('integration','PreDeployment')"
                        })}
                        ${kpiCard({
                            title: 'Pre-Deployment FIT Test Success Rate (Last 30 D)',
                            value: preSuccessRate !== null ? `${preSuccessRate.toFixed(1)}%` : 'TBD',
                            sub: preDelta.text,
                            subClass: preDelta.className,
                            valueClass: preSuccessRate !== null ? 'text-blue' : 'text-blue',
                            onClick: "openAvailabilityInventoryTabFromKpi('integration','PreDeployment')"
                        })}
                        ${kpiCard({
                            title: 'Post-Deployment FIT Test Success Rate (Last 30 D)',
                            value: postSuccessRate !== null ? `${postSuccessRate.toFixed(1)}%` : 'TBD',
                            sub: postDelta.text,
                            subClass: postDelta.className,
                            valueClass: postSuccessRate !== null ? 'text-blue' : 'text-blue',
                            onClick: "openAvailabilityInventoryTabFromKpi('integration','PostDeployment')"
                        })}
                        ${kpiCard({
                            title: 'Products - Scale and Perf Testing',
                            value: scalePerfEnabledProducts.size || 0,
                            sub: scalePerfRows.length ? `${scalePerfRows.length} tests` : '0 tests',
                            valueClass: 'text-blue',
                            onClick: "openAvailabilityInventoryTabFromKpi('scalePerf')"
                        })}
                        ${kpiCard({
                            title: 'Products - Critical Path Testing',
                            value: enabledProducts.size || 0,
                            sub: `${plannedProducts.size} planned`,
                            valueClass: 'text-blue',
                            onClick: "openAvailabilityInventoryTabFromKpi('customerScenario')"
                        })}
                        ${kpiCard({
                            title: 'Customer-Release Test Success Rate (Last 30 D)',
                            value: '0%',
                            sub: `${enabledTests} tests enabled`,
                            valueClass: 'text-blue',
                            onClick: "openAvailabilityInventoryTabFromKpi('customerScenario')"
                        })}
                        ${kpiCard({
                            title: 'Products - Chaos Testing',
                            value: chaosEnabledProducts.size || 0,
                            sub: `${chaosPlannedTests} tests planned`,
                            valueClass: 'text-blue',
                            onClick: "openAvailabilityInventoryTabFromKpi('chaos')"
                        })}
                        ${kpiCard({
                            title: 'Chaos Test MTTR',
                            value: `${testMttrHours}<span class="exec-summary-unit">hrs</span>`,
                            sub: testMttrSub,
                            subClass: 'text-green',
                            valueClass: 'text-blue',
                            onClick: "openAvailabilityInventoryTabFromKpi('chaos')"
                        })}
                    </div>
                </div>
            </section>
            ${sectionDivider}

            <section class="exec-summary-section">
                <div class="exec-summary-section-header"><span class="exec-summary-section-icon">⚙️</span>Runtime Service Standards</div>
                <div class="exec-summary-section-card">
                    <!-- Row 1: HPA Adoption Rates -->
                    <div class="exec-summary-kpi-grid columns-3">
                        ${kpiCard({
                            title: 'Overall HPA Adoption Rate',
                            value: `${hpaAdoptionRate.toFixed(1)}%`,
                            sub: `${hpaEnabledCount.toLocaleString()}/${totalServices.toLocaleString()} services`,
                            valueClass: 'text-blue',
                            onClick: "switchTab('runtime-overview'); scrollToTabContent('runtime-overview')"
                        })}
                        ${kpiCard({
                            title: 'Tier 0 HPA Adoption Rate',
                            value: `${tier0HpaRate.toFixed(1)}%`,
                            sub: `${tier0Hpa.toLocaleString()}/${tier0Total.toLocaleString()} services`,
                            valueClass: 'text-blue',
                            onClick: "switchTab('runtime-overview'); scrollToTabContent('runtime-overview')"
                        })}
                        ${kpiCard({
                            title: 'Tier 1 HPA Adoption Rate',
                            value: `${tier1HpaRate.toFixed(1)}%`,
                            sub: `${tier1Hpa.toLocaleString()}/${tier1Total.toLocaleString()} services`,
                            valueClass: 'text-blue',
                            onClick: "switchTab('runtime-overview'); scrollToTabContent('runtime-overview')"
                        })}
                    </div>
                    <!-- Row 2: AZ Distribution Rates -->
                    <div class="exec-summary-kpi-grid columns-3" style="margin-top: 1rem;">
                        ${kpiCard({
                            title: 'Overall AZ Distribution Rate',
                            value: `${azDistribAdoptionRate.toFixed(1)}%`,
                            sub: `${azDistribEnabledCount.toLocaleString()}/${totalServices.toLocaleString()} services`,
                            valueClass: 'text-blue',
                            onClick: "switchTab('runtime-overview'); scrollToTabContent('runtime-overview')"
                        })}
                        ${kpiCard({
                            title: 'Tier 0 AZ Distribution Rate',
                            value: `${tier0AzDistribRate.toFixed(1)}%`,
                            sub: `${tier0AzDistrib.toLocaleString()}/${tier0Total.toLocaleString()} services`,
                            valueClass: 'text-blue',
                            onClick: "switchTab('runtime-overview'); scrollToTabContent('runtime-overview')"
                        })}
                        ${kpiCard({
                            title: 'Tier 1 AZ Distribution Rate',
                            value: `${tier1AzDistribRate.toFixed(1)}%`,
                            sub: `${tier1AzDistrib.toLocaleString()}/${tier1Total.toLocaleString()} services`,
                            valueClass: 'text-blue',
                            onClick: "switchTab('runtime-overview'); scrollToTabContent('runtime-overview')"
                        })}
                    </div>
                    <!-- Row 3: Avg. CPU Allocation rate -->
                    <div class="exec-summary-kpi-grid columns-3" style="margin-top: 1rem;">
                        ${kpiCard({
                            title: 'Avg. CPU Allocation rate - FI',
                            value: `${avgFi.toFixed(1)}%`,
                            sub: 'Avg across FI',
                            valueClass: 'text-green',
                            onClick: "switchTab('runtime-karpenter'); scrollToTabContent('runtime-karpenter')"
                        })}
                        ${kpiCard({
                            title: 'Avg. CPU Allocation rate - FD',
                            value: `${avgFd.toFixed(1)}%`,
                            sub: 'Avg across FD',
                            valueClass: 'text-green',
                            onClick: "switchTab('runtime-karpenter'); scrollToTabContent('runtime-karpenter')"
                        })}
                        ${kpiCard({
                            title: 'Avg. CPU Allocation rate - Cluster',
                            value: `${avgCluster.toFixed(1)}%`,
                            sub: 'Avg across clusters',
                            valueClass: 'text-green',
                            onClick: "switchTab('runtime-karpenter'); scrollToTabContent('runtime-karpenter')"
                        })}
                    </div>
                </div>
            </section>
            ${sectionDivider}

            <section class="exec-summary-section">
                <div class="exec-summary-section-header" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem;">
                    <span><span class="exec-summary-section-icon">💰</span>Cost to Serve and Budget</span>
                    <div class="cts-fy-toggle" role="group" aria-label="Fiscal year">
                        <button type="button" class="cts-fy-btn ${costToServeFY === 'FY27' ? 'active' : ''}" data-fy="FY27" onclick="setCostToServeFY('FY27', this); if (typeof renderExecutiveSummary === 'function') renderExecutiveSummary();">FY27</button>
                        <button type="button" class="cts-fy-btn ${costToServeFY === 'FY26' ? 'active' : ''}" data-fy="FY26" onclick="setCostToServeFY('FY26', this); if (typeof renderExecutiveSummary === 'function') renderExecutiveSummary();">FY26</button>
                    </div>
                </div>
                <div class="exec-summary-section-card">
                    <div class="exec-summary-kpi-grid columns-4">
                        ${kpiCard({
                            title: 'Total Projected Savings',
                            value: formatCurrencySafe(totalPredictedSavings),
                            sub: costToServeFY + ' Forecast',
                            valueClass: 'text-blue',
                            onClick: "switchTab('cost-to-serve-overview'); scrollToTabContent('cost-to-serve-overview')"
                        })}
                        ${kpiCard({
                            title: 'Total Actual Savings Achieved',
                            value: formatCurrencySafe(totalActualSavings),
                            sub: costToServeFY === 'FY27' ? 'Realized Savings' : 'Realized Savings',
                            valueClass: 'text-green',
                            onClick: "switchTab('cost-to-serve-overview'); scrollToTabContent('cost-to-serve-overview')"
                        })}
                        ${kpiCard({
                            title: 'Variance',
                            value: formatCurrencySigned(varianceValue),
                            sub: 'Actual - Projected',
                            valueClass: varianceValue !== null && varianceValue < 0 ? 'text-red' : 'text-green',
                            onClick: "switchTab('cost-to-serve-overview'); scrollToTabContent('cost-to-serve-overview')"
                        })}
                        ${kpiCard({
                            title: 'Achievement Rate',
                            value: achievementRate !== null ? `${achievementRate.toFixed(1)}%` : '--',
                            sub: totalActualSavings !== null && totalPredictedSavings !== null
                                ? `${formatCurrencySafe(totalActualSavings)} / ${formatCurrencySafe(totalPredictedSavings)}`
                                : 'TBD',
                            valueClass: 'text-blue',
                            onClick: "switchTab('cost-to-serve-overview'); scrollToTabContent('cost-to-serve-overview')"
                        })}
                    </div>
                </div>
            </section>
            ${sectionDivider}

            <section class="exec-summary-section">
                <div class="exec-summary-section-header"><span class="exec-summary-section-icon">📊</span>Onboarding</div>
                <div class="exec-summary-section-subheader">Falcon Kubernetes Platform</div>
                <div class="exec-summary-section-card">
                    <div class="exec-summary-kpi-grid columns-4">
                        ${kpiCard({
                            title: 'Overall Adoption Rate',
                            value: `${overallAdoption.toFixed(1)}%`,
                            sub: `${overallFkp.toLocaleString()}/${overallTotal.toLocaleString()} service instances`,
                            valueClass: 'text-blue',
                            onClick: "switchTab('executive-overview'); scrollToTabContent('executive-overview')"
                        })}
                        ${kpiCard({
                            title: 'Commercial Adoption',
                            value: `${commercial.adoptionPct.toFixed(1)}%`,
                            sub: `${commercial.fkpInstances.toLocaleString()}/${commercial.totalInstances.toLocaleString()} service instances`,
                            valueClass: 'text-blue',
                            onClick: "switchTab('executive-overview'); scrollToTabContent('executive-overview')"
                        })}
                        ${kpiCard({
                            title: 'GIA2H Adoption',
                            value: `${gia.adoptionPct.toFixed(1)}%`,
                            sub: `${gia.fkpInstances.toLocaleString()}/${gia.totalInstances.toLocaleString()} service instances`,
                            valueClass: 'text-blue',
                            onClick: "switchTab('executive-overview'); scrollToTabContent('executive-overview')"
                        })}
                        ${kpiCard({
                            title: 'BlackJack Adoption',
                            value: `${blackjack.adoptionPct.toFixed(1)}%`,
                            sub: `${blackjack.fkpInstances.toLocaleString()}/${blackjack.totalInstances.toLocaleString()} service instances`,
                            valueClass: 'text-blue',
                            onClick: "switchTab('executive-overview'); scrollToTabContent('executive-overview')"
                        })}
                    </div>
                </div>
            </section>
        `;
    } catch (error) {
        console.error('❌ Failed to render executive summary:', error);
        container.innerHTML = '<div class="exec-summary-loading">Failed to load executive summary.</div>';
    }
}

/**
 * Refresh content for the current tab
 */
function refreshCurrentTab() {
    const currentTab = fkpDashboard.state.currentTab;
    
    switch (currentTab) {
        case 'exec-summary':
            renderExecutiveSummary();
            break;
        case 'executive-overview':
            renderExecutiveOverview();
            break;
        case 'migration-pipeline':
            renderMigrationPipeline();
            break;
        case 'projections-roadmap':
            renderProjectionsRoadmap();
            break;
        case 'service-information':
            renderServiceInformation();
            break;
        case 'cross-customer-analysis':
            renderCrossCustomerAnalysis();
            break;
        case 'migration-dependencies':
            renderMigrationDependencies();
            break;
        case 'integrations':
            renderIntegrations();
            break;
        case 'runtime-overview':
            renderAutoscalingExecView();
            break;
        case 'runtime-hpa':
            renderAutoscalingDeveloperView();
            break;
        case 'runtime-availability-detection':
            renderAvailabilityDetectionTab();
            break;
        case 'runtime-availability-prevention':
            renderAvailabilityPreventionTab();
            break;
        case 'runtime-availability-remediation':
            renderAvailabilityRemediationTab();
            break;
        case 'runtime-availability-readiness':
            renderAvailabilityReadinessView();
            break;
        case 'runtime-availability-ingress':
            renderAvailabilityIngressView();
            break;
        case 'runtime-karpenter':
            renderKarpenter();
            break;
        case 'availability-exec':
            // Legacy tab - redirect to Detection
            console.warn('⚠️ availability-exec is deprecated, using runtime-availability-detection');
            switchTab('runtime-availability-detection');
            break;
        case 'availability-baseline':
            // Legacy tab - redirect to Detection
            console.warn('⚠️ availability-baseline is deprecated, using runtime-availability-detection');
            switchTab('runtime-availability-detection');
            break;
        case 'runtime-availability':
            console.warn('⚠️ runtime-availability is deprecated, using runtime-availability-detection');
            switchTab('runtime-availability-detection');
            break;
        case 'runtime-availability-inventory':
            console.warn('⚠️ runtime-availability-inventory is deprecated, using runtime-availability-prevention');
            switchTab('runtime-availability-prevention');
            break;
        case 'cost-to-serve-overview':
        case 'cost-to-serve-hps':
        case 'cost-to-serve-budget-forecast':
        case 'cost-to-serve-details':
            if (typeof window.loadCostToServeDataIfNeeded === 'function') {
                window.loadCostToServeDataIfNeeded();
            }
            break;
    }
}

function setExecSummaryView() {
    if (fkpDashboard.state.currentViewMode === 'developer') {
        window.location.reload();
        return;
    }
    fkpDashboard.state.currentViewMode = 'exec';
    switchTab('exec-summary');
}
window.setExecSummaryView = setExecSummaryView;

function scrollToTabContent(tabId) {
    const containerId = `${tabId}-content`;
    const container = document.getElementById(containerId);
    if (container) {
        container.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
    }
    const pane = document.getElementById(tabId);
    if (pane) {
        pane.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

/**
 * Render Runtime Availability - Detection tab
 */
async function renderAvailabilityDetectionTab() {
    console.log('🛡️ Rendering Runtime Availability - Detection tab...');
    
    const container = document.getElementById('runtime-availability-detection-content');
    if (!container) {
        console.error('❌ Container runtime-availability-detection-content not found');
        return;
    }
    
    // Check if tab pane is visible
    const tabPane = container.closest('.tab-pane');
    console.log('🛡️ Tab pane:', tabPane);
    console.log('🛡️ Tab pane has active class:', tabPane?.classList.contains('active'));
    console.log('🛡️ Tab pane display style:', tabPane?.style.display);
    console.log('🛡️ Tab pane computed display:', tabPane ? window.getComputedStyle(tabPane).display : 'N/A');
    
    // Show loading state first
    container.innerHTML = `
        <div class="placeholder-message" style="text-align: center; padding: 40px;">
            <div class="placeholder-icon">🛡️</div>
            <h3>Loading Availability Data...</h3>
        </div>
    `;
    
    console.log('🛡️ Loading state set, container.innerHTML length:', container.innerHTML.length);
    
    try {
        // Load data
        await loadAllAvailabilityData();
        
        // Check if data loaded successfully - check summaryMetrics as primary source
        if (!availabilityData.loaded || !availabilityData.summaryMetrics || availabilityData.summaryMetrics.length === 0) {
            console.warn('⚠️ No summary metrics available');
            container.innerHTML = `
                <div class="placeholder-message" style="text-align: center; padding: 40px;">
                    <div class="placeholder-icon">⚠️</div>
                    <h3>No Data Available</h3>
                    <p>Could not load availability data. Please check the console for errors.</p>
                </div>
            `;
            return;
        }
        
        console.log('🛡️ Data loaded, calling renderAvailabilityExecView...');
        console.log('🛡️ Summary metrics:', availabilityData.summaryMetrics.length);
        console.log('🛡️ Container element:', container);
        
        // Render comprehensive scrollable Exec View
        renderAvailabilityExecView(container, { includeReadiness: false });

        console.log('✅ Runtime Availability - Detection rendered');
        console.log('🛡️ Container innerHTML length after render:', container.innerHTML.length);
    } catch (error) {
        console.error('❌ Error rendering Availability:', error);
        container.innerHTML = `
            <div class="placeholder-message" style="text-align: center; padding: 40px;">
                <div class="placeholder-icon">❌</div>
                <h3>Error Loading Availability</h3>
                <p>${error.message || 'An error occurred while loading availability data'}</p>
            </div>
        `;
    }
}

/**
 * Render Runtime Availability - Prevention tab
 */
function renderAvailabilityPreventionTab() {
    const container = document.getElementById('runtime-availability-prevention-content');
    if (!container) {
        console.error('❌ Container runtime-availability-prevention-content not found');
        return;
    }

    if (!availabilityData.loaded) {
        container.innerHTML = `
            <div class="placeholder-message" style="text-align: center; padding: 40px;">
                <div class="placeholder-icon">🧪</div>
                <h3>Loading Prevention Data...</h3>
            </div>
        `;
        loadAllAvailabilityData().then(renderAvailabilityPreventionTab);
        return;
    }

    if (fkpDashboard.state.currentViewMode === 'developer') {
        const shouldDrill = availabilityData.preventionDevPendingDrill === true;
        availabilityData.preventionDevEntry = shouldDrill ? 'drill' : 'nav';
        availabilityData.preventionDevShowDetails = shouldDrill;
        if (!shouldDrill) {
            availabilityData.inventoryTestTypeFilter = '';
            availabilityData.inventoryProductFilter = 'all';
            availabilityData.integrationFitMonthFilter = '';
            inventoryActiveTab = '';
        }
        availabilityData.preventionDevPendingDrill = false;
        renderAvailabilityInventoryView({
            containerId: 'runtime-availability-prevention-content',
            hideAllSummary: true,
            defaultTab: 'customerScenario'
        });
        return;
    }

    renderAvailabilityPreventionExecView(container);
}

/**
 * Render Runtime Availability - Remediation tab (placeholder)
 */
function renderAvailabilityRemediationTab() {
    const container = document.getElementById('runtime-availability-remediation-content');
    if (!container) {
        console.error('❌ Container runtime-availability-remediation-content not found');
        return;
    }
    container.innerHTML = `
        <div class="placeholder-message" style="text-align: center; padding: 40px;">
            <div class="placeholder-icon">🛠️</div>
            <h3>This is under construction</h3>
        </div>
    `;
}

/**
 * Render comprehensive Availability Exec View (scrollable)
 */
function getDetectionProductOptions() {
    const hrpProductMap = availabilityData.hrpProductPrbOwnerMap || {};
    return Object.keys(hrpProductMap).filter(p => p !== 'MAPS');
}

function getSelectedDetectionProduct() {
    const options = getDetectionProductOptions();
    const selected = availabilityData.detectionProductFilter;
    return options.includes(selected) ? selected : 'All HRP Products';
}

function filterIncidentsByProduct(rows, product) {
    if (!product || product === 'All HRP Products') return rows;
    const hrpProductMap = availabilityData.hrpProductPrbOwnerMap || {};
    const owners = new Set((hrpProductMap[product] || []).map(o => (o || '').toLowerCase()));
    if (!owners.size) return [];
    return rows.filter(row => owners.has((row.prb_owner || '').toLowerCase()));
}

function buildDetectionMonthlyBuckets(startDate) {
    const incidentsByMonth = {};
    const monthKeys = [];
    const monthLabels = [];
    for (let i = 0; i < 12; i++) {
        const d = new Date(startDate.getFullYear(), startDate.getMonth() + i, 1);
        const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        monthKeys.push(monthKey);
        monthLabels.push(d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }));
        incidentsByMonth[monthKey] = {
            name: d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
            incidents: [],
            key: monthKey
        };
    }
    const startLabel = incidentsByMonth[monthKeys[0]]?.name || monthLabels[0] || '';
    const endLabel = incidentsByMonth[monthKeys[monthKeys.length - 1]]?.name || monthLabels[monthLabels.length - 1] || '';
    const rangeLabel = startLabel && endLabel ? `${startLabel} - ${endLabel} (12 months)` : 'Last 12 months';
    return { incidentsByMonth, monthKeys, monthLabels, rangeLabel };
}

function buildMonthlyChartData(incidentsByMonth, monthKeys, monthLabels) {
    const monthlyChartData = {
        labels: monthLabels,
        mttd: [],
        mttr: [],
        incidents: []
    };
    monthKeys.forEach(monthKey => {
        const monthData = incidentsByMonth[monthKey];
        if (monthData && monthData.incidents.length > 0) {
            const incs = monthData.incidents;
            const validMttd = incs.filter(i => parseFloat(i.ttd_min) > 0);
            const validMttr = incs.filter(i => parseFloat(i.ttr_min) > 0);
            const avgMttd = validMttd.length > 0
                ? Math.round(validMttd.reduce((sum, i) => sum + parseFloat(i.ttd_min), 0) / validMttd.length)
                : 0;
            const avgMttr = validMttr.length > 0
                ? Math.round(validMttr.reduce((sum, i) => sum + parseFloat(i.ttr_min), 0) / validMttr.length)
                : 0;
            monthlyChartData.mttd.push(avgMttd);
            monthlyChartData.mttr.push(avgMttr);
            monthlyChartData.incidents.push(incs.length);
        } else {
            monthlyChartData.mttd.push(0);
            monthlyChartData.mttr.push(0);
            monthlyChartData.incidents.push(0);
        }
    });
    return monthlyChartData;
}

function updateMttdMttrTrendChart(monthlyData) {
    if (!mttdMttrTrendChart) {
        initMttdMttrTrendChart(monthlyData);
        return;
    }
    const datasets = mttdMttrTrendChart.data.datasets;
    mttdMttrTrendChart.data.labels = monthlyData.labels;
    if (datasets[0]) datasets[0].data = monthlyData.mttd;
    if (datasets[1]) datasets[1].data = monthlyData.mttr;
    mttdMttrTrendChart.update();
}

function buildIncidentKpiRows({ products, kpiSource, allSevIncidents, now, mttdTarget, mttrTarget }) {
    return products.map(product => {
        const productIncidents = filterIncidentsByProduct(kpiSource, product);
        const sev0Count = productIncidents.filter(inc => inc.severity === 'Sev0').length;
        const sev1Count = productIncidents.filter(inc => inc.severity === 'Sev1').length;
        const validMttd = productIncidents.filter(inc => parseFloat(inc.ttd_min) > 0);
        const validMttr = productIncidents.filter(inc => parseFloat(inc.ttr_min) > 0);
        const avgMttd = validMttd.length
            ? Math.round(validMttd.reduce((sum, inc) => sum + parseFloat(inc.ttd_min || 0), 0) / validMttd.length)
            : 0;
        const avgMttr = validMttr.length
            ? Math.round(validMttr.reduce((sum, inc) => sum + parseFloat(inc.ttr_min || 0), 0) / validMttr.length)
            : 0;
        const productAllSev = filterIncidentsByProduct(allSevIncidents, product);
        const latest = productAllSev
            .map(inc => new Date(inc.detected_date))
            .filter(date => !Number.isNaN(date.getTime()))
            .sort((a, b) => b - a)[0];
        const daysSince = latest ? Math.max(0, Math.floor((now - latest) / (24 * 60 * 60 * 1000))) : null;
        return {
            product,
            sev0: sev0Count,
            sev1: sev1Count,
            mttd: avgMttd,
            mttr: avgMttr,
            daysSince,
            mttdBreached: avgMttd > mttdTarget,
            mttrBreached: avgMttr > mttrTarget,
            mttdMet: avgMttd > 0 && avgMttd <= mttdTarget,
            mttrMet: avgMttr > 0 && avgMttr <= mttrTarget
        };
    });
}

function updateDetectionExecWidgets() {
    const cache = availabilityData.detectionCache;
    if (!cache) return;
    const selectedProduct = getSelectedDetectionProduct();
    const kpiWindow = availabilityData.detectionKpiWindow || '12m';
    const kpiSource = kpiWindow === '30d' ? cache.recentIncidents : cache.window12Sev;

    const chartIncidents = filterIncidentsByProduct(cache.window12Sev, selectedProduct);
    const buckets = buildDetectionMonthlyBuckets(cache.twelveMonthStart);
    chartIncidents.forEach(inc => {
        const date = new Date(inc.detected_date);
        if (Number.isNaN(date.getTime())) return;
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        if (buckets.incidentsByMonth[monthKey]) {
            buckets.incidentsByMonth[monthKey].incidents.push(inc);
        }
    });
    const monthlyChartData = buildMonthlyChartData(buckets.incidentsByMonth, buckets.monthKeys, buckets.monthLabels);
    updateMttdMttrTrendChart(monthlyChartData);

    const tableBody = document.querySelector('.incident-kpi-table tbody');
    if (tableBody) {
        const rows = buildIncidentKpiRows({
            products: getDetectionProductOptions(),
            kpiSource,
            allSevIncidents: cache.allSevIncidents,
            now: cache.now,
            mttdTarget: cache.mttdTarget,
            mttrTarget: cache.mttrTarget
        });
        tableBody.innerHTML = rows.map(row => `
            <tr>
                <td>${row.product}</td>
                <td class="align-center">${row.sev0}</td>
                <td class="align-center">${row.sev1}</td>
                <td class="align-center${row.mttdBreached ? ' sla-breach' : row.mttdMet ? ' sla-met' : ''}">${row.mttd || '—'}</td>
                <td class="align-center${row.mttrBreached ? ' sla-breach' : row.mttrMet ? ' sla-met' : ''}">${row.mttr || '—'}</td>
                <td class="align-center">${row.daysSince !== null ? row.daysSince : '—'}</td>
            </tr>
        `).join('');
    }

    document.querySelectorAll('.incident-kpi-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.window === kpiWindow);
    });
}

function renderAvailabilityExecView(container, options = {}) {
    console.log('🛡️ renderAvailabilityExecView called, container:', container);
    
    if (!container) {
        console.error('❌ Container is null or undefined');
        return;
    }
    const { includeReadiness = true } = options;
    
    // Check if data is loaded
    if (!availabilityData.loaded || !availabilityData.summaryMetrics || availabilityData.summaryMetrics.length === 0) {
        console.warn('⚠️ No availability data available');
        container.innerHTML = `
            <div class="placeholder-message" style="text-align: center; padding: 40px;">
                <div class="placeholder-icon">⚠️</div>
                <h3>No Data Available</h3>
                <p>Could not load availability data</p>
            </div>
        `;
        return;
    }
    
    try {
    // Get data from loaded CSVs
    const summaryMetrics = availabilityData.summaryMetrics;
    const monthlyTrend = availabilityData.monthlyTrend || [];
    const services = availabilityData.services || [];
    const themes = availabilityData.themes || [];
    const slaData = availabilityData.slaData || [];
    const incidents = availabilityData.incidents || [];
    const serviceReadiness = availabilityData.serviceReadiness || [];
    
    const now = new Date();
    now.setHours(23, 59, 59, 999);
    const twelveMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    twelveMonthStart.setMonth(twelveMonthStart.getMonth() - 11);
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const window12Incidents = incidents.filter(inc => {
        const incDate = new Date(inc.detected_date);
        if (Number.isNaN(incDate.getTime())) return false;
        return incDate >= twelveMonthStart && incDate <= now;
    });

    const hrpProductOptions = getDetectionProductOptions();
    const selectedProduct = getSelectedDetectionProduct();

        // Calculate KPI metrics from incidents_e360_total.csv (last 12 months)
    const sev0Incidents = window12Incidents.filter(inc => inc.severity === 'Sev0').length;
    const sev1Incidents = window12Incidents.filter(inc => inc.severity === 'Sev1').length;
    
    // Get Sev0 incident months for trend text
    const sev0IncidentMonths = window12Incidents
        .filter(inc => inc.severity === 'Sev0')
        .map(inc => {
            const date = new Date(inc.detected_date);
            return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
        })
        .join(', ');
    
    // Count unique services with Sev1 incidents
    const sev1Services = new Set(window12Incidents.filter(inc => inc.severity === 'Sev1').map(inc => inc.prb_owner)).size;
    
    // Calculate Avg MTTD and MTTR for last 30 days (Sev0/Sev1 only)
    const recentIncidents = incidents.filter(inc => {
        const incDate = new Date(inc.detected_date);
        if (Number.isNaN(incDate.getTime())) return false;
        return (inc.severity === 'Sev0' || inc.severity === 'Sev1') &&
            incDate >= thirtyDaysAgo && incDate <= now;
    });
    
    // Calculate averages for 30-day period
    let avgMttd = 0;
    let avgMttr = 0;
    
    if (recentIncidents.length > 0) {
        const validMttd = recentIncidents.filter(inc => parseFloat(inc.ttd_min) > 0);
        const validMttr = recentIncidents.filter(inc => parseFloat(inc.ttr_min) > 0);
        
        if (validMttd.length > 0) {
            const totalMttd = validMttd.reduce((sum, inc) => sum + parseFloat(inc.ttd_min || 0), 0);
            avgMttd = Math.round(totalMttd / validMttd.length);
        }
        
        if (validMttr.length > 0) {
            const totalMttr = validMttr.reduce((sum, inc) => sum + parseFloat(inc.ttr_min || 0), 0);
            avgMttr = Math.round(totalMttr / validMttr.length);
        }
    }

    // Calculate Avg MTTD/MTTR for last 12 months (Sev0/Sev1 only)
    const window12Sev = window12Incidents.filter(inc => inc.severity === 'Sev0' || inc.severity === 'Sev1');
    const validMttd12 = window12Sev.filter(inc => parseFloat(inc.ttd_min) > 0);
    const validMttr12 = window12Sev.filter(inc => parseFloat(inc.ttr_min) > 0);
    const avgMttd12 = validMttd12.length
        ? Math.round(validMttd12.reduce((sum, inc) => sum + parseFloat(inc.ttd_min || 0), 0) / validMttd12.length)
        : 0;
    const avgMttr12 = validMttr12.length
        ? Math.round(validMttr12.reduce((sum, inc) => sum + parseFloat(inc.ttr_min || 0), 0) / validMttr12.length)
        : 0;
    
    // HRP Service Readiness Score - placeholder (will be updated later)
    const observabilityCoverage = 65;
    
    // Build trend text
    const sev0Trend = sev0IncidentMonths ? `${sev0Incidents} total (${sev0IncidentMonths})` : `${sev0Incidents} total incidents`;
    const sev1Trend = `${sev1Incidents} total across ${sev1Services} services`;
    
    // Legacy metric references for compatibility
    const mttdMetric = { target: 10 };
    const mttrMetric = { target: 30 };
    
        console.log('🛡️ Calculated from incidents_e360_total.csv:', {
        sev0Incidents,
        sev1Incidents,
        avgMttd,
        avgMttr,
        recentIncidentsCount: recentIncidents.length
    });
    
    const chartIncidents = filterIncidentsByProduct(window12Sev, selectedProduct);
    const buckets = buildDetectionMonthlyBuckets(twelveMonthStart);
    chartIncidents.forEach(inc => {
        const date = new Date(inc.detected_date);
        if (Number.isNaN(date.getTime())) return;
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        if (buckets.incidentsByMonth[monthKey]) {
            buckets.incidentsByMonth[monthKey].incidents.push(inc);
        }
    });
    
    const currentMonthKey = buckets.monthKeys[buckets.monthKeys.length - 1];
    const lastMonthKey = buckets.monthKeys[buckets.monthKeys.length - 2];
    
    const currentMonthData = buckets.incidentsByMonth[currentMonthKey] || { name: 'N/A', incidents: [] };
    const lastMonthData = buckets.incidentsByMonth[lastMonthKey] || { name: 'N/A', incidents: [] };

    const rangeLabel = buckets.rangeLabel;
    
    // Calculate current month metrics
    const calcMonthMetrics = (monthData) => {
        const incs = monthData.incidents;
        if (incs.length === 0) return { mttd: 0, mttr: 0, count: 0 };
        
        const validMttd = incs.filter(i => parseFloat(i.ttd_min) > 0);
        const validMttr = incs.filter(i => parseFloat(i.ttr_min) > 0);
        
        const mttd = validMttd.length > 0 
            ? Math.round(validMttd.reduce((sum, i) => sum + parseFloat(i.ttd_min), 0) / validMttd.length) 
            : 0;
        const mttr = validMttr.length > 0 
            ? Math.round(validMttr.reduce((sum, i) => sum + parseFloat(i.ttr_min), 0) / validMttr.length) 
            : 0;
        
        return { mttd, mttr, count: incs.length };
    };
    
    const currentMonth = { ...calcMonthMetrics(currentMonthData), name: currentMonthData.name };
    const lastMonth = { ...calcMonthMetrics(lastMonthData), name: lastMonthData.name };
    
    // Calculate 11-month weighted average (total sum / total incidents)
    const allValidMttd = window12Incidents.filter(i => parseFloat(i.ttd_min) > 0);
    const allValidMttr = window12Incidents.filter(i => parseFloat(i.ttr_min) > 0);
    
    const yearAverage = {
        mttd: allValidMttd.length > 0 
            ? Math.round(allValidMttd.reduce((sum, i) => sum + parseFloat(i.ttd_min), 0) / allValidMttd.length) 
            : 0,
        mttr: allValidMttr.length > 0 
            ? Math.round(allValidMttr.reduce((sum, i) => sum + parseFloat(i.ttr_min), 0) / allValidMttr.length) 
            : 0
    };
    
    // SLA Targets
    const slaTargets = { mttd: 10, mttr: 60 };
    
    // Calculate trend indicators
    const mttdVsLast = currentMonth.mttd - lastMonth.mttd;
    const mttrVsLast = currentMonth.mttr - lastMonth.mttr;
    const mttdVsAvg = currentMonth.mttd - yearAverage.mttd;
    const mttrVsAvg = currentMonth.mttr - yearAverage.mttr;
    
    // SLA Status
    const mttdSlaMet = currentMonth.mttd <= slaTargets.mttd;
    const mttrSlaMet = currentMonth.mttr <= slaTargets.mttr;
    
    console.log('🛡️ SLA Compliance metrics:', {
        currentMonth,
        lastMonth,
        yearAverage,
        mttdVsLast,
        mttrVsLast,
        mttdVsAvg,
        mttrVsAvg,
        mttdSlaMet,
        mttrSlaMet
    });
    
    const monthlyChartData = buildMonthlyChartData(
        buckets.incidentsByMonth,
        buckets.monthKeys,
        buckets.monthLabels
    );
    
    console.log('🛡️ Monthly chart data:', monthlyChartData);
    
    const readinessTableRows = buildReadinessTableRows(serviceReadiness);
    const readinessSectionHtml = includeReadiness ? `
            <div class="readiness-section">
                <div class="readiness-section-header">
                    <div class="readiness-section-title">
                        <span class="readiness-section-icon">🧪</span>
                        <h3>HRP Test Readiness (Preventive)</h3>
                    </div>
                </div>
                <div class="readiness-card">
                    <div class="readiness-card-header">
                        <span>📊 E2E Testing Matrix</span>
                    </div>
                    <div class="readiness-table-wrapper">
                        <table class="readiness-table">
                            <thead>
                                <tr>
                                    <th style="text-align: left;">HRP Service</th>
                                    <th>Pre-Deployment FIT</th>
                                    <th>Post-Deployment FIT</th>
                                    <th>E2E Critical FIT</th>
                                    <th>Scale &amp; Perf Tests</th>
                                    <th>Chaos Tests</th>
                                    <th>Overall Score</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${readinessTableRows || `<tr><td colspan="8" class="readiness-empty">No readiness data available</td></tr>`}
                            </tbody>
                        </table>
                    </div>
                    <div class="readiness-legend">
                        <div class="readiness-legend-items">
                            <div class="readiness-legend-item">
                                <span class="readiness-legend-dot complete"></span>
                                <span>Complete = 2</span>
                            </div>
                            <div class="readiness-legend-item">
                                <span class="readiness-legend-dot partial"></span>
                                <span>Partial = 1</span>
                            </div>
                            <div class="readiness-legend-item">
                                <span class="readiness-legend-dot missing"></span>
                                <span>Missing = 0</span>
                            </div>
                            <div class="readiness-legend-item">
                                <span class="readiness-legend-dot planned"></span>
                                <span>Planned = 0.5</span>
                            </div>
                        </div>
                        <div class="readiness-legend-note">Overall Score = Total Points out of Max Possible Points</div>
                    </div>
                </div>
            </div>
    ` : '';
    
    // Map services data for MTTD/MTTR charts
    const serviceMetrics = services.map(row => {
        let serviceName = row.name || row.id;
        // Rename "Vega Cache" to "Vegacache" (one word)
        if (serviceName === 'Vega Cache') {
            serviceName = 'Vegacache';
        }
        return {
            service: serviceName,
            mttd: parseFloat(row.mttd_min || 0),
            mttr: parseFloat(row.mttr_min || 0),
            alerts: row.alerts || 'Missing',
            tracer: row.tracer || 'Missing',
            dep_map: row.dep_map || 'Missing',
            ...row
        };
    });
    
    // Count services with complete coverage (alerts AND tracer complete)
    // FKP, Ingress, Vegacache have Complete alerts+tracer = 3
    // Mesh has Complete tracer (Partial alerts) - counting as 4th for 4/6 total
    const completeCount = services.filter(s => {
        const alerts = (s.alerts || '').toLowerCase();
        const tracer = (s.tracer || '').toLowerCase();
        // Count if both Complete, OR if tracer is Complete (for Mesh)
        return (alerts === 'complete' && tracer === 'complete') || 
               (tracer === 'complete' && alerts === 'partial');
    }).length;
    
    // Build HTML - use renderNow for timestamp (now is already used for 30-day calculation)
    const renderNow = new Date();
    const formattedDate = renderNow.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const formattedTime = renderNow.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    
    const kpiWindow = availabilityData.detectionKpiWindow || '12m';
    const kpiSource = kpiWindow === '30d' ? recentIncidents : window12Sev;
    const productList = hrpProductOptions;
    const productKpiRows = buildIncidentKpiRows({
        products: productList,
        kpiSource,
        allSevIncidents: incidents.filter(inc => inc.severity === 'Sev0' || inc.severity === 'Sev1'),
        now,
        mttdTarget: mttdMetric.target,
        mttrTarget: mttrMetric.target
    });

    availabilityData.detectionCache = {
        incidents,
        window12Incidents,
        window12Sev,
        recentIncidents,
        allSevIncidents: incidents.filter(inc => inc.severity === 'Sev0' || inc.severity === 'Sev1'),
        now,
        twelveMonthStart,
        mttdTarget: mttdMetric.target,
        mttrTarget: mttrMetric.target
    };

    console.log('🛡️ About to set innerHTML, variables:', {
        sev0Incidents,
        sev1Incidents,
        avgMttd,
        avgMttr,
        observabilityCoverage,
        completeCount,
        servicesLength: services.length
    });
    
    try {
    container.innerHTML = `
        <div class="availability-exec-scrollable">
            <!-- Header -->
        <div class="availability-dashboard-header">
                <div class="availability-dashboard-brand">
                    <div class="availability-dashboard-logo">⚡</div>
                    <div class="availability-dashboard-text">
                        <h1 class="availability-dashboard-title">HRP Availability Scorecard - Exec View</h1>
                    <div class="availability-dashboard-subtitle">Hyperforce Runtime Platform • Data: ${rangeLabel}</div>
                    </div>
                </div>
                <div class="availability-header-badges">
                    <span class="last-updated">Last Updated: ${formattedDate} @ ${formattedTime}</span>
                </div>
            </div>
            <hr class="availability-header-divider">
            
            <div class="incident-kpi-header">
                <div class="incident-kpi-title">HRP Product Incident KPIs</div>
                <div class="incident-kpi-toggle">
                    <button class="incident-kpi-btn ${kpiWindow === '12m' ? 'active' : ''}" data-window="12m">Last 12 months</button>
                    <button class="incident-kpi-btn ${kpiWindow === '30d' ? 'active' : ''}" data-window="30d">Last 30 days</button>
                </div>
            </div>
            <div class="incident-kpi-table-wrap">
                <table class="availability-modal-table incident-kpi-table">
                    <thead>
                        <tr>
                            <th>Product</th>
                            <th>Sev0</th>
                            <th>Sev1</th>
                            <th>
                                <div class="incident-kpi-header-label">
                                    Avg MTTD
                                    <div class="incident-kpi-sla">SLA Target &lt;${mttdMetric.target} min</div>
                                </div>
                            </th>
                            <th>
                                <div class="incident-kpi-header-label">
                                    Avg MTTR
                                    <div class="incident-kpi-sla">SLA Target &lt;${mttrMetric.target} min</div>
                                </div>
                            </th>
                            <th>Days Since Last Incident</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${productKpiRows.map(row => `
                            <tr>
                                <td>${row.product}</td>
                                <td class="align-center">${row.sev0}</td>
                                <td class="align-center">${row.sev1}</td>
                                <td class="align-center${row.mttdBreached ? ' sla-breach' : row.mttdMet ? ' sla-met' : ''}">${row.mttd || '—'}</td>
                                <td class="align-center${row.mttrBreached ? ' sla-breach' : row.mttrMet ? ' sla-met' : ''}">${row.mttr || '—'}</td>
                                <td class="align-center">${row.daysSince !== null ? row.daysSince : '—'}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
            
            <!-- SLA Compliance Section -->
            <div class="sla-compliance-header">
                <div class="sla-header-brand">
                    <div class="sla-header-logo">📋</div>
                    <div class="sla-header-text">
                        <h2>SLA Compliance</h2>
                    </div>
                </div>
                <div class="sla-header-meta">
                    <span class="sla-period-label">Current Period:</span>
                    <span class="sla-period-value">${currentMonth.name}</span>
                </div>
            </div>
            
            <!-- MTTD/MTTR Trend Section Title -->
            <div class="sla-section-title">
                <h3>📈 MTTD / MTTR Trend</h3>
            </div>
            
            
            <!-- MTTD/MTTR Trend Chart -->
            <div class="sla-chart-section">
                <div class="sla-chart-header">
                <div class="sla-chart-title">📉 12-Month Trend (${rangeLabel})</div>
                <div class="sla-chart-filter">
                    <label for="sla-product-filter">HRP Product</label>
                    <select id="sla-product-filter">
                        <option value="All HRP Products"${selectedProduct === 'All HRP Products' ? ' selected' : ''}>All HRP Products</option>
                        ${productList.map(product => `
                            <option value="${product}"${selectedProduct === product ? ' selected' : ''}>${product}</option>
                        `).join('')}
                    </select>
                </div>
                    <div class="sla-chart-tabs">
                        <button class="sla-chart-tab active" data-metric="both">Both</button>
                        <button class="sla-chart-tab" data-metric="mttd">MTTD Only</button>
                        <button class="sla-chart-tab" data-metric="mttr">MTTR Only</button>
                    </div>
                </div>
                <div class="sla-chart-body">
                    <div class="sla-chart-container">
                        <canvas id="mttdMttrTrendChart"></canvas>
                    </div>
                </div>
                <div class="sla-chart-legend">
                    <div class="sla-legend-item">
                        <span class="sla-legend-dot" style="background: #0176d3"></span>
                        <span>MTTD (min)</span>
                    </div>
                    <div class="sla-legend-item">
                        <span class="sla-legend-dot" style="background: #ec6a6a"></span>
                        <span>MTTR (min)</span>
                    </div>
                </div>
            </div>
            
            ${readinessSectionHtml}
            
            <!-- Service Impact Analysis Section -->
            <div class="sla-section-divider"></div>
            
            <div class="sla-impact-header">
                <div class="sla-impact-brand">
                    <div class="sla-impact-logo">🔍</div>
                    <div class="sla-impact-text">
                        <h2>Service Impact Analysis (Root Cause)</h2>
                    </div>
                </div>
            </div>

            <!-- Service Impact Breakdown Table -->
            <div class="sla-coverage-section">
                <div class="sla-coverage-header">
                <div class="sla-coverage-title">📊 Service Impact Breakdown (${rangeLabel})</div>
                </div>
                <table class="sla-coverage-table">
                    <thead>
                        <tr>
                            <th style="width: 200px;">Service Impact Category</th>
                            <th>Incidents</th>
                            <th>% of Total</th>
                            <th>Avg MTTD</th>
                            <th>Avg MTTR</th>
                            <th>Repeat Incidents</th>
                        </tr>
                    </thead>
                    <tbody id="rootCauseTableBody">
                        <!-- Populated by JS -->
                    </tbody>
                </table>
            </div>
            
            <!-- Service Impact by Service Table -->
            <div class="sla-coverage-section" style="margin-top: 1.5rem;">
                <div class="sla-coverage-header">
                    <div class="sla-coverage-title">🔧 Customer Impact by Service</div>
                </div>
                <table class="sla-coverage-table">
                    <thead>
                        <tr>
                            <th style="width: 120px;">Service</th>
                            <th>Total Incidents</th>
                            <th>Customer Impact Severity</th>
                            <th>Customer Experience Impact</th>
                            <th>Average Duration</th>
                            <th>Repeat Incidents</th>
                        </tr>
                    </thead>
                    <tbody id="serviceRootCauseTableBody">
                        <!-- Populated by JS -->
                    </tbody>
                </table>
            </div>

            <div class="sla-section-divider"></div>
            <div class="sla-impact-header">
                <div class="sla-impact-brand">
                    <div class="sla-impact-logo">📣</div>
                    <div class="sla-impact-text">
                        <h2>Detection - Incident Alert Quality</h2>
                    </div>
                </div>
            </div>

            <div class="sla-coverage-section ingress-alert-quality-section">
                <div class="sla-coverage-header">
                    <div class="sla-coverage-title">Related Incidents + Alert Quality (Last 6 months)</div>
                    <div class="ingress-alert-filter">
                        <label for="ingress-alert-product-filter">HRP Product</label>
                        <select id="ingress-alert-product-filter"></select>
                    </div>
                </div>
                <div class="ingress-alert-quality-grid">
                    <div class="ingress-alert-kpis" id="ingress-alert-quality-kpis"></div>
                    <div class="ingress-alert-chart">
                        <div class="ingress-alert-chart-title">Probable Causes for False Positives</div>
                        <div class="ingress-alert-chart-container">
                            <canvas id="ingressAlertQualityPie"></canvas>
                        </div>
                    </div>
                </div>
                <div class="ingress-alert-table">
                    <table class="sla-coverage-table">
                        <thead>
                            <tr>
                                <th style="width: 160px;">Incident</th>
                                <th style="width: 180px;">Probable Cause</th>
                                <th>Root Cause Summary</th>
                                <th style="width: 180px;">Link to Slack Thread</th>
                                <th style="width: 140px;">HRP Cause or not</th>
                            </tr>
                        </thead>
                        <tbody id="ingress-alert-quality-table"></tbody>
                    </table>
                </div>
            </div>
            
        </div>
    `;
    
    console.log('🛡️ HTML set to container, length:', container.innerHTML.length);
    } catch (templateError) {
        console.error('❌ Error in template string:', templateError);
        console.error('❌ Template error details:', templateError.message, templateError.stack);
        container.innerHTML = `
            <div class="placeholder-message" style="text-align: center; padding: 40px;">
                <div class="placeholder-icon">❌</div>
                <h3>Error Rendering Template</h3>
                <p>${templateError.message || 'Template rendering error'}</p>
            </div>
        `;
        return;
    }
    console.log('🛡️ Container element:', container);
    console.log('🛡️ Container parent:', container.parentElement);
    console.log('🛡️ Container parent display:', container.parentElement?.style.display);
    console.log('🛡️ Container parent classList:', container.parentElement?.classList);
    
    // Verify HTML was actually set
    if (container.innerHTML.length < 100) {
        console.error('❌ HTML not set properly! Length:', container.innerHTML.length);
        console.error('❌ Container innerHTML:', container.innerHTML);
    }

    const productSelect = document.getElementById('sla-product-filter');
    if (productSelect) {
        productSelect.addEventListener('change', (e) => {
            availabilityData.detectionProductFilter = e.target.value || 'All HRP Products';
            updateDetectionExecWidgets();
        });
    }
    document.querySelectorAll('.incident-kpi-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            availabilityData.detectionKpiWindow = btn.dataset.window || '12m';
            updateDetectionExecWidgets();
        });
    });
    
    // Render charts and tables
    console.log('🛡️ Rendering charts and tables...');
    
    // Initialize MTTD/MTTR Trend Chart (Chart.js)
    try {
        initMttdMttrTrendChart(monthlyChartData);
        console.log('✅ MTTD/MTTR trend chart rendered');
    } catch (e) {
        console.error('❌ Error rendering MTTD/MTTR trend chart:', e);
    }
    
    // Render Service Impact Analysis tables
    try {
        renderServiceImpactBreakdown(window12Incidents);
        console.log('✅ Service Impact Breakdown rendered');
    } catch (e) {
        console.error('❌ Error rendering Service Impact Breakdown:', e);
    }
    
    try {
        renderServiceImpactByService(window12Incidents);
        console.log('✅ Service Impact by Service rendered');
    } catch (e) {
        console.error('❌ Error rendering Service Impact by Service:', e);
    }

    try {
        renderIngressIncidentAlertQuality();
        console.log('✅ Ingress alert quality rendered');
    } catch (e) {
        console.error('❌ Error rendering ingress alert quality:', e);
    }
    
    console.log('✅ Availability Exec View rendered');
    } catch (error) {
        console.error('❌ Error in renderAvailabilityExecView:', error);
        container.innerHTML = `
            <div class="placeholder-message" style="text-align: center; padding: 40px;">
                <div class="placeholder-icon">❌</div>
                <h3>Error Rendering Availability</h3>
                <p>${error.message || 'An error occurred while rendering'}</p>
            </div>
        `;
    }
}

function normalizeReadinessStatus(value) {
    const normalized = (value || '').toString().trim().toLowerCase();
    if (normalized === 'yes' || normalized === 'complete') return 'complete';
    if (normalized === 'partial') return 'partial';
    if (normalized === 'planned') return 'planned';
    if (normalized === 'no' || normalized === 'missing' || normalized === '') return 'missing';
    return 'missing';
}

function getReadinessScoreFromStatus(status) {
    switch (status) {
        case 'complete':
            return 2;
        case 'partial':
            return 1;
        case 'planned':
            return 0.5;
        default:
            return 0;
    }
}

function formatReadinessScore(value) {
    if (typeof value !== 'number' || Number.isNaN(value)) return '0';
    if (Number.isInteger(value)) return String(value);
    const rounded = Math.round(value * 10) / 10;
    return rounded.toFixed(1).replace(/\.0$/, '');
}

function getReadinessOverallClass(percent) {
    if (typeof percent !== 'number' || Number.isNaN(percent)) return 'medium';
    if (percent >= 75) return 'high';
    if (percent >= 60) return 'medium';
    return 'low';
}

function buildReadinessTableRows(data) {
    if (!Array.isArray(data) || data.length === 0) {
        return '';
    }
    
    const serviceColorMap = {
        Mesh: '#1b96ff',
        Ingress: '#2e844a',
        FKP: '#0176d3',
        Vegacache: '#c23934',
        MQ: '#fe9339',
        MAPS: '#2e844a'
    };
    
    const columns = [
        { statusKey: 'Pre-Release FIT', scoreKey: 'Pre-Release FIT Score' },
        { statusKey: 'Post-Release FIT', scoreKey: 'Post-Release FIT Score' },
        { statusKey: 'E2E Critical FIT', scoreKey: 'E2E Critical FIT Score' },
        { statusKey: 'Scale Tests', scoreKey: 'Scale Tests Score' },
        { statusKey: 'Perf Tests', scoreKey: 'Perf Tests Score' },
        { statusKey: 'Chaos Tests', scoreKey: 'Chaos Tests Score' }
    ];
    
    return data
        .filter(row => (row.Service || row.service || '').toLowerCase() !== 'total')
        .map(row => {
            const serviceName = row.Service || row.service || 'Unknown';
            const serviceColor = serviceColorMap[serviceName] || '#706e6b';
            const cellsHtml = columns.map(column => {
                const status = normalizeReadinessStatus(row[column.statusKey]);
                const scoreValue = parseFloat(row[column.scoreKey]);
                const score = Number.isNaN(scoreValue) ? getReadinessScoreFromStatus(status) : scoreValue;
                return `<td class="readiness-score ${status}">${formatReadinessScore(score)}</td>`;
            }).join('');
            
            const totalPointsValue = parseFloat(row['Total Points']);
            const maxPointsValue = parseFloat(row['Max Possible Points']);
            const totalPoints = Number.isNaN(totalPointsValue) ? 0 : totalPointsValue;
            const maxPoints = Number.isNaN(maxPointsValue) ? 0 : maxPointsValue;
            
            const percentValue = parseFloat((row['Service Score Percentage'] || '').replace('%', ''));
            const derivedPercent = maxPoints > 0 ? (totalPoints / maxPoints) * 100 : percentValue;
            const overallClass = getReadinessOverallClass(Number.isNaN(percentValue) ? derivedPercent : percentValue);
            
            return `
                <tr>
                    <td class="readiness-service">
                        <span class="readiness-service-dot" style="background: ${serviceColor};"></span>
                        ${serviceName}
                    </td>
                    ${cellsHtml}
                    <td class="readiness-overall-score ${overallClass}">
                        ${formatReadinessScore(totalPoints)}/${formatReadinessScore(maxPoints || 12)}
                    </td>
                </tr>
            `;
        })
        .join('');
}

/**
 * Render Availability Developer View (HRP Test Readiness)
 */
async function renderAvailabilityReadinessView() {
    console.log('🧪 Rendering Availability Readiness View...');
    
    const container = document.getElementById('runtime-availability-readiness-content');
    if (!container) {
        console.error('❌ Container runtime-availability-readiness-content not found');
        return;
    }
    
    container.innerHTML = `
        <div class="placeholder-message" style="text-align: center; padding: 40px;">
            <div class="placeholder-icon">🧪</div>
            <h3>Loading Service Readiness...</h3>
        </div>
    `;
    
    try {
        await loadAllAvailabilityData();
        
        const readinessRows = availabilityData.serviceReadiness || [];
        const serviceRows = readinessRows.filter(row => (row.Service || '').toLowerCase() !== 'total');
        const totalServices = serviceRows.length || 0;
        
        const criticalCount = serviceRows.filter(row => {
            const status = normalizeReadinessStatus(row['E2E Critical FIT']);
            return status === 'complete' || status === 'partial';
        }).length;
        
        const chaosCount = serviceRows.filter(row => {
            const status = normalizeReadinessStatus(row['Chaos Tests']);
            return status === 'complete' || status === 'partial';
        }).length;
        
        const criticalPct = totalServices ? Math.round((criticalCount / totalServices) * 100) : 0;
        const chaosPct = totalServices ? Math.round((chaosCount / totalServices) * 100) : 0;
        
        const modalExists = document.getElementById('availability-readiness-modal');
        container.innerHTML = `
            <div class="availability-dev">
                <div class="availability-dev-container">
                    <header class="header preventive-header">
                        <div class="header-brand">
                            <div class="logo">🧪</div>
                            <div class="header-text">
                                <h1>HRP Test Readiness (Preventive) - Developer View</h1>
                            </div>
                        </div>
                        <button class="back-link" onclick="openAvailabilityPreventionExecView()">
                            <span>←</span>
                            <span>Back to Exec View</span>
                        </button>
                    </header>

                    <div class="kpi-grid">
                        <div class="kpi-card" onclick="showCardDetail('criticalCoverage')">
                            <div class="kpi-label">Critical Test Coverage</div>
                            <div class="kpi-value" style="color: var(--warning);">${criticalPct}<span class="unit">%</span></div>
                            <div class="kpi-trend neutral">${criticalCount}/${totalServices} services with E2E critical</div>
                        </div>
                        <div class="kpi-card" onclick="showCardDetail('fitSuccess')">
                            <div class="kpi-label">FIT Success Rate (30d)</div>
                            <div class="kpi-value" style="color: var(--positive);">94.2<span class="unit">%</span></div>
                            <div class="kpi-trend positive">↑ 2.1% from last month</div>
                        </div>
                        <div class="kpi-card" onclick="showCardDetail('chaosAdoption')">
                            <div class="kpi-label">Chaos Test Adoption</div>
                            <div class="kpi-value" style="color: var(--positive);">${chaosPct}<span class="unit">%</span></div>
                            <div class="kpi-trend positive">${chaosCount}/${totalServices} services active</div>
                        </div>
                        <div class="kpi-card" onclick="showCardDetail('incidentsAvoided')">
                            <div class="kpi-label">Incidents Avoided</div>
                            <div class="kpi-value" style="color: var(--info);">3</div>
                            <div class="kpi-trend positive">↓ 12% incident rate</div>
                        </div>
                        <div class="kpi-card" onclick="showCardDetail('testMTTR')">
                            <div class="kpi-label">Test MTTR</div>
                            <div class="kpi-value" style="color: var(--accent);">4.2<span class="unit">hrs</span></div>
                            <div class="kpi-trend positive">↓ 1.3 hrs improvement</div>
                        </div>
                    </div>

                    <div class="charts-grid">
                        <div class="chart-card">
                            <div class="chart-header clickable-header" onclick="openFitSuccessMonthlyModal()">
                                <div class="chart-title">📈 FIT Success Rate Trend (6 Months)</div>
                                <span class="section-badge badge-positive">Improving</span>
                            </div>
                            <div class="chart-body">
                                <div class="chart-container">
                                    <canvas id="fitTrendChart"></canvas>
                                </div>
                            </div>
                        </div>
                        <div class="chart-card">
                            <div class="chart-header clickable-header" onclick="openChaosExecutionMonthlyModal()">
                                <div class="chart-title">🔥 Chaos Test Execution (Last 6 Months)</div>
                                <span class="section-badge badge-info">6 tests this month</span>
                            </div>
                            <div class="chart-body">
                                <div class="chart-container">
                                    <canvas id="chaosChart"></canvas>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="business-impact">
                        <div class="section-header-dev">
                            <h2 class="section-title-dev">💰 Business Impact</h2>
                            <span class="section-badge badge-positive">Positive ROI</span>
                        </div>
                        <div class="impact-grid">
                            <div class="impact-card" onclick="showCardDetail('incidentsAvoidedImpact')">
                                <div class="impact-icon green">🛡️</div>
                                <div class="impact-value green">3</div>
                                <div class="impact-label">Sev0/Sev1 Incidents Avoided</div>
                            </div>
                            <div class="impact-card" onclick="showCardDetail('serviceHealth')">
                                <div class="impact-icon blue">🏥</div>
                                <div class="impact-value blue">92%</div>
                                <div class="impact-label">Service Health Score</div>
                            </div>
                            <div class="impact-card" onclick="showCardDetail('customerImpact')">
                                <div class="impact-icon orange">⏱️</div>
                                <div class="impact-value orange">127</div>
                                <div class="impact-label">Customer Impact Hours Avoided</div>
                            </div>
                            <div class="impact-card" onclick="showCardDetail('releaseConfidence')">
                                <div class="impact-icon purple">📊</div>
                                <div class="impact-value purple">89%</div>
                                <div class="impact-label">Release Confidence Score</div>
                            </div>
                        </div>
                    </div>

                    <div class="priority-actions">
                        <div class="section-header-dev">
                            <h2 class="section-title-dev">🎯 Priority Actions</h2>
                        </div>
                        <div class="coverage-section">
                            <table class="coverage-table">
                                <thead>
                                    <tr>
                                        <th style="width:50px;">#</th>
                                        <th style="text-align:left;">Action Item</th>
                                        <th style="width:120px;">Service</th>
                                        <th style="width:100px;">Priority</th>
                                        <th style="width:100px;">ETA</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td>1</td>
                                        <td style="text-align:left;">Enable Pre-Deployment FIT for Mesh</td>
                                        <td>Mesh</td>
                                        <td><span class="section-badge badge-negative">High</span></td>
                                        <td>Q1 FY27</td>
                                    </tr>
                                    <tr>
                                        <td>2</td>
                                        <td style="text-align:left;">Define E2E Critical Scenarios for MQ</td>
                                        <td>MQ</td>
                                        <td><span class="section-badge badge-negative">High</span></td>
                                        <td>Feb 2027</td>
                                    </tr>
                                    <tr>
                                        <td>3</td>
                                        <td style="text-align:left;">Complete Scale Test Documentation for MAPS</td>
                                        <td>MAPS</td>
                                        <td><span class="section-badge badge-warning">Medium</span></td>
                                        <td>Mar 2027</td>
                                    </tr>
                                    <tr>
                                        <td>4</td>
                                        <td style="text-align:left;">Document Vegacache Perf Test Limits</td>
                                        <td>Vegacache</td>
                                        <td><span class="section-badge badge-warning">Medium</span></td>
                                        <td>Q2 FY27</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>

            ${modalExists ? '' : `
            <div class="modal" id="availability-readiness-modal" onclick="closeAvailabilityReadinessModal(event)">
                <div class="modal-content" onclick="event.stopPropagation()">
                    <div class="modal-header">
                        <h3 id="availability-readiness-modal-title">Card Details</h3>
                        <button class="modal-close" onclick="closeAvailabilityReadinessModal()">&times;</button>
                    </div>
                    <div class="modal-body" id="availability-readiness-modal-body">
                        <div class="modal-text">Select a card to view details.</div>
                    </div>
                </div>
            </div>
            `}
        `;
        
        initFitTrendChart();
        initChaosExecutionChart();
        
        console.log('✅ Availability Developer View rendered');
    } catch (error) {
        console.error('❌ Error rendering Availability Developer View:', error);
        container.innerHTML = `
            <div class="placeholder-message" style="text-align: center; padding: 40px;">
                <div class="placeholder-icon">❌</div>
                <h3>Error Loading Developer View</h3>
                <p>${error.message || 'An error occurred while rendering'}</p>
            </div>
        `;
    }
}

let inventoryHideAllSummary = false;

function renderAvailabilityInventoryView(options = {}) {
    const {
        containerId = 'runtime-availability-prevention-content',
        hideAllSummary = false,
        defaultTab
    } = options;
    const container = document.getElementById(containerId);
    if (!container) {
        console.error(`❌ Container ${containerId} not found`);
        return;
    }
    
    if (!availabilityData.loaded) {
        container.innerHTML = `
            <div class="placeholder-message" style="text-align: center; padding: 40px;">
                <div class="placeholder-icon">🧪</div>
                <h3>Loading Test Inventory...</h3>
            </div>
        `;
        loadAllAvailabilityData().then(() => renderAvailabilityInventoryView(options));
        return;
    }

    inventoryHideAllSummary = hideAllSummary;
    const showDetails = availabilityData.preventionDevShowDetails;
    const initialTab = availabilityData.inventoryTestTypeFilter || (showDetails ? (defaultTab || 'customerScenario') : '');
    
    const inventory = availabilityData.testInventory;
    const products = getInventoryProducts();
    const fitRows = getFilteredFitRows();
    const customerRows = mapInventoryRows(inventory.customerScenario.rows, 'customerScenario');
    const integrationRows = mapInventoryRows(fitRows, 'integration');
    const scalePerfRows = mapInventoryRows(inventory.scalePerf.rows, 'scalePerf');
    const chaosRows = mapInventoryRows(inventory.chaos.rows, 'chaos');
    const testCounts = {
        customerScenario: customerRows.length,
        integration: fitRows.length,
        scalePerf: scalePerfRows.length,
        chaos: chaosRows.length
    };
    const testTypeCards = [
        { key: 'customerScenario', label: 'Critical Path Tests', icon: '🧑‍💼' },
        { key: 'integration', label: 'Falcon Integration Tests (FIT)', icon: '🔗' },
        { key: 'scalePerf', label: 'Scale & Perf Tests', icon: '📈' },
        { key: 'chaos', label: 'Chaos Tests', icon: '🔥' }
    ];
    
    container.innerHTML = `
        <div class="availability-dev-content">
            <div class="tab-header">
                <h2>Hyperforce Runtime Platform (HRP) - Test Inventory</h2>
                <p>Product-level coverage and test inventory details</p>
            </div>
            
            <div class="exec-summary-kpi-grid columns-4 prevention-testtype-cards">
                ${testTypeCards.map(card => `
                    <div class="exec-summary-kpi-card inventory-tab-card inventory-tab-card--${card.key} ${initialTab === card.key ? 'active' : ''}" data-inventory-tab="${card.key}" onclick="setInventoryTab('${card.key}', this)">
                        <div class="inventory-card-title">${card.icon} ${card.label}</div>
                    </div>
                `).join('')}
            </div>

            ${showDetails ? `
                <div class="autoscaling-filters inventory-filter-bar">
                    <div class="autoscaling-filter-group">
                        <label class="autoscaling-filter-label">Select Product</label>
                        <select id="inventory-product-filter"></select>
                    </div>
                    <div class="autoscaling-filter-group" id="integration-fit-runtype-filter-block"></div>
                    <div class="autoscaling-filter-group" id="integration-fit-month-filter-block"></div>
                    <div class="autoscaling-filter-actions">
                        <button class="autoscaling-reset-btn" onclick="resetInventoryFilters()">🔄 Reset Filters</button>
                    </div>
                </div>
                <div class="product-summary-kpis" id="inventory-product-kpis"></div>
                <div class="inventory-detail" id="inventory-detail"></div>
            ` : `
                <div class="inventory-banner">Click on a Preventive Test Inventory to drill down</div>
            `}
        </div>
    `;

    const productSelect = document.getElementById('inventory-product-filter');
    if (productSelect) {
        productSelect.innerHTML = `
            <option value="all">All Products</option>
            ${products.map(product => `<option value="${product}">${normalizeProductName(product)}</option>`).join('')}
        `;
        productSelect.value = availabilityData.inventoryProductFilter || 'all';
        productSelect.addEventListener('change', (e) => {
            availabilityData.inventoryProductFilter = e.target.value;
            renderInventoryDetail(inventoryActiveTab);
        });
    }

    inventoryActiveTab = initialTab || inventoryActiveTab;
    if (showDetails) {
        renderInventoryProductSummary(inventoryActiveTab);
        renderInventoryDetail(inventoryActiveTab);
    }
}

function resetInventoryFilters() {
    availabilityData.inventoryProductFilter = 'all';
    availabilityData.inventoryRunTypeFilter = 'all';
    availabilityData.integrationFitMonthFilter = '';
    const productSelect = document.getElementById('inventory-product-filter');
    if (productSelect) productSelect.value = 'all';
    const runTypeSelect = document.getElementById('integration-fit-runtype-filter');
    if (runTypeSelect) runTypeSelect.value = 'all';
    const monthSelect = document.getElementById('integration-fit-month-filter');
    if (monthSelect) monthSelect.value = '';
    renderInventoryProductSummary(inventoryActiveTab);
    renderInventoryDetail(inventoryActiveTab);
}

function renderAvailabilityIngressView() {
    const container = document.getElementById('runtime-availability-ingress-content');
    if (!container) {
        console.error('❌ Container runtime-availability-ingress-content not found');
        return;
    }
    
    if (!availabilityData.loaded) {
        container.innerHTML = `
            <div class="placeholder-message" style="text-align: center; padding: 40px;">
                <div class="placeholder-icon">🧪</div>
                <h3>Loading Ingress Alert Quality...</h3>
            </div>
        `;
        loadAllAvailabilityData().then(renderAvailabilityIngressView);
        return;
    }
    
    const alerts = availabilityData.ingressAlerts.rows || [];
    const totalPages = alerts.length;
    const confirmedIssues = alerts.filter(row => (row['Is_Ingress_Issue?'] || '').toLowerCase() === 'yes').length;
    const falsePositives = alerts.filter(row => (row['Is_Ingress_Issue?'] || '').toLowerCase() === 'no').length;
    const noiseRatio = confirmedIssues > 0 ? (totalPages / confirmedIssues) : 0;
    const falsePositivePct = totalPages > 0 ? Math.round((falsePositives / totalPages) * 100) : 0;
    
    const onCallImpact = falsePositivePct > 50 ? 'High' : falsePositivePct < 20 ? 'Low' : 'Medium';
    
    const reasons = alerts
        .filter(row => (row['Is_Ingress_Issue?'] || '').toLowerCase() === 'no')
        .map(row => `${row.Reason || ''} ${row.Message || ''}`.toLowerCase());
    
    const reasonCounts = {};
    const categoryMap = (reason) => {
        if (reason.includes('kms') || reason.includes('crypto') || reason.includes('vault')) {
            return 'KMS / Crypto / Vault';
        }
        if (reason.includes('security') || reason.includes('ddos')) {
            return 'Security / DDoS';
        }
        if (reason.includes('platform') || reason.includes('infra') || reason.includes('network') || reason.includes('funnel') || reason.includes('cloud') || reason.includes('scrt')) {
            return 'Platform / Infra';
        }
        if (reason.includes('dependency') || reason.includes('upstream')) {
            return 'Upstream Dependencies';
        }
        return 'Platform / Infra';
    };
    
    reasons.forEach(reason => {
        const category = categoryMap(reason);
        reasonCounts[category] = (reasonCounts[category] || 0) + 1;
    });
    
    const topCauses = Object.entries(reasonCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([cause, count]) => {
            const pct = falsePositives > 0 ? Math.round((count / falsePositives) * 100) : 0;
            return { cause, count, pct };
        });
    
    const distribution = availabilityData.ingressDistribution.rows || [];
    const accuracyTrend = availabilityData.ingressAccuracy.rows || [];
    
    container.innerHTML = `
        <div class="availability-dev">
            <div class="availability-dev-container">
                <header class="header preventive-header ingress-header">
                    <div class="header-brand">
                        <div class="logo ingress-logo">🔍</div>
                        <div class="header-text">
                            <h1>Ingress Alert Quality Dashboard</h1>
                            <div class="inventory-subtitle">Tracking False Positives in the Last 90 Days</div>
                        </div>
                    </div>
                    <button class="back-link" onclick="openAvailabilityDetectionExecView()">
                        <span>←</span>
                        <span>Back to Exec View</span>
                    </button>
                </header>
                
                <div class="ingress-kpi-grid">
                    <div class="ingress-kpi-card accent-blue">
                        <div class="ingress-kpi-label">Total Pages to Ingress</div>
                        <div class="ingress-kpi-value">${totalPages}</div>
                    </div>
                    <div class="ingress-kpi-card accent-green">
                        <div class="ingress-kpi-label">Confirmed Ingress Issues</div>
                        <div class="ingress-kpi-value ingress-kpi-value-green">${confirmedIssues} <span class="ingress-kpi-sub">(${Math.round((confirmedIssues / (totalPages || 1)) * 100)}%)</span></div>
                    </div>
                    <div class="ingress-kpi-card accent-red">
                        <div class="ingress-kpi-label">False Positives</div>
                        <div class="ingress-kpi-value ingress-kpi-value-red">${falsePositives} <span class="ingress-kpi-sub">(${falsePositivePct}%)</span></div>
                    </div>
                    <div class="ingress-kpi-card accent-blue">
                        <div class="ingress-kpi-label">Noise Ratio</div>
                        <div class="ingress-kpi-value">${noiseRatio.toFixed(1)}<span class="ingress-kpi-sub">x</span></div>
                    </div>
                </div>
                
                <div class="ingress-callout">⚠️ Nearly 3 out of 4 Ingress pages were caused by upstream or adjacent systems.</div>
                
                <div class="ingress-grid">
                    <div class="ingress-card">
                        <div class="ingress-card-title">📊 Alert Attribution Breakdown</div>
                        <div class="ingress-donut-row">
                            <div class="ingress-chart-container">
                                <canvas id="ingress-alert-donut"></canvas>
                            </div>
                            <div class="ingress-legend" id="ingress-alert-legend"></div>
                        </div>
                    </div>
                    <div class="ingress-card">
                        <div class="ingress-card-title">🧭 Top False Positive Causes</div>
                        <table class="ingress-table">
                            <thead>
                                <tr><th>Cause</th><th>Count</th><th>%</th></tr>
                            </thead>
                            <tbody>
                                ${topCauses.map(cause => `
                                    <tr>
                                        <td>${cause.cause}</td>
                                        <td class="align-center">${cause.count}</td>
                                        <td class="align-center">${cause.pct}%</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
                
                <div class="ingress-grid">
                    <div class="ingress-card">
                        <div class="ingress-card-title">📉 Ingress Page Accuracy (Last 12 Weeks)</div>
                        <div class="ingress-chart-container">
                            <canvas id="ingress-accuracy-line"></canvas>
                        </div>
                    </div>
                    <div class="ingress-card">
                        <div class="ingress-card-title">⚡ Operational Impact of False Positives</div>
                        <div class="ingress-impact">
                            <div class="ingress-impact-row">
                                <span>Unnecessary IG Pages</span>
                                <strong>${falsePositives}</strong>
                            </div>
                            <div class="ingress-impact-row">
                                <span>Avoidable Escalations</span>
                                <strong>${falsePositivePct}%</strong>
                            </div>
                            <div class="ingress-impact-row">
                                <span>On-Call Time Wasted</span>
                                <strong>${onCallImpact}</strong>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    initIngressDonut(distribution);
    initIngressAccuracyLine(accuracyTrend);
}

function renderPreventionFitSummary() {
    const fitRows = getFilteredFitRows();
    const monthSelect = document.getElementById('prevention-fit-month-filter');
    const tableBody = document.getElementById('prevention-fit-table-body');
    const monthLabel = document.getElementById('prevention-fit-month-label');
    const chartCanvas = document.getElementById('preventionFitChart');
    const groupButtons = document.querySelectorAll('.prevention-fit-toggle-btn');
    const summaryLabel = document.getElementById('prevention-fit-summary-label');
    const col1 = document.getElementById('prevention-fit-col-1');
    const col2 = document.getElementById('prevention-fit-col-2');
    if (!monthSelect || !tableBody || !chartCanvas) return;

    const monthKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const monthLabelText = (date) => date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    const monthOptions = Array.from(new Set(
        fitRows.map(r => parseFitRunDate(r['Run Time'])).filter(Boolean).map(monthKey)
    )).sort().reverse();
    const labelMap = monthOptions.reduce((acc, key) => {
        const [year, month] = key.split('-').map(Number);
        acc[key] = monthLabelText(new Date(year, month - 1, 1));
        return acc;
    }, {});

    const currentMonthKey = monthKey(new Date());
    const defaultMonth = monthOptions.includes(currentMonthKey) ? currentMonthKey : (monthOptions[0] || '');
    if (!availabilityData.preventionFitMonthFilter) {
        availabilityData.preventionFitMonthFilter = defaultMonth;
    }

    monthSelect.innerHTML = monthOptions.map(key => `
        <option value="${key}"${availabilityData.preventionFitMonthFilter === key ? ' selected' : ''}>${labelMap[key]}</option>
    `).join('');

    const filteredRows = fitRows.filter(row => {
        const date = parseFitRunDate(row['Run Time']);
        return date && monthKey(date) === availabilityData.preventionFitMonthFilter;
    });

    const normalizeRunType = (raw) => {
        const cleaned = (raw || '').toString().trim();
        const val = cleaned.toLowerCase();
        if (val.includes('predeployment')) return 'PreDeployment';
        if (val.includes('postdeployment')) return 'PostDeployment';
        return cleaned || 'Unknown';
    };

    const groupBy = 'product';
    availabilityData.preventionFitGroupBy = 'product';
    groupButtons.forEach(btn => {
        if (btn.dataset.value === 'runType') {
            btn.style.display = 'none';
        } else {
            btn.style.display = '';
        }
        btn.classList.toggle('active', btn.dataset.value === groupBy);
    });

    const summaryByKey = new Map();
    filteredRows.forEach(row => {
        const service = row.Service || 'Unknown';
        const product = normalizeProductName(getFitProductForService(service));
        const runType = normalizeRunType(row['Run Type']);
        const key = groupBy === 'product' ? product : runType;
        if (!summaryByKey.has(key)) {
            summaryByKey.set(key, { key, tests: [], failures: [] });
        }
        const bucket = summaryByKey.get(key);
        const tests = parseInt(row.Tests || 0, 10);
        if (!Number.isNaN(tests)) bucket.tests.push(tests);
        const success = parseSuccessRate(row['Success Rate'], row['Failure Rate']);
        if (success !== null) bucket.failures.push(100 - success);
    });

    const summaryRows = Array.from(summaryByKey.values()).sort((a, b) => a.key.localeCompare(b.key));
    const selection = availabilityData.preventionFitSelection || '';

    if (summaryLabel) {
        if (selection) {
            summaryLabel.textContent = groupBy === 'product'
                ? `Summarizing Run Type Details for the month of ${labelMap[availabilityData.preventionFitMonthFilter] || ''}, for the Product: ${selection}`
                : `Summarizing Product Details for the month of ${labelMap[availabilityData.preventionFitMonthFilter] || ''}, for the RunType: ${selection}`;
        } else {
            summaryLabel.textContent = groupBy === 'product'
                ? 'Click on a Product to view RunType details'
                : 'Click on a RunType to view Product details';
        }
    }
    if (col1 && col2) {
        col1.textContent = groupBy === 'product' ? 'Product' : 'Run Type';
        col2.textContent = 'Number of Tests Ran';
    }

    const detailMap = new Map();
    const normalizedSelection = normalizeProductName(selection).toLowerCase().trim();
    filteredRows.forEach(row => {
        const service = row.Service || 'Unknown';
        const product = normalizeProductName(getFitProductForService(service));
        const runType = normalizeRunType(row['Run Type']);
        if (groupBy === 'product' && selection && product.toLowerCase().trim() !== normalizedSelection) return;
        if (groupBy === 'runType' && selection && runType !== selection) return;
        const key = groupBy === 'product' ? runType : product;
        if (!detailMap.has(key)) {
            detailMap.set(key, { key, tests: [], failures: [] });
        }
        const bucket = detailMap.get(key);
        const tests = parseInt(row.Tests || 0, 10);
        if (!Number.isNaN(tests)) bucket.tests.push(tests);
        const raw = (row['Failure Rate'] || '').toString().trim().replace('%', '');
        const failure = parseFloat(raw);
        if (!Number.isNaN(failure)) bucket.failures.push(failure);
    });

    const detailRows = Array.from(detailMap.values()).sort((a, b) => a.key.localeCompare(b.key));

    const rowsToRender = selection ? detailRows : summaryRows;
    const isClickable = !selection;
    tableBody.innerHTML = rowsToRender.map(row => {
        const testsSum = row.tests.reduce((a, b) => a + b, 0);
        const avgFailure = row.failures.length ? (row.failures.reduce((a, b) => a + b, 0) / row.failures.length) : null;
        const avgSuccess = avgFailure !== null ? Math.max(0, 100 - avgFailure) : null;
        const cellClass = isClickable ? 'prevention-fit-clickable' : '';
        const dataKey = isClickable ? ` data-key="${row.key}"` : '';
        return `
            <tr>
                <td class="${cellClass}"${dataKey}>${row.key}</td>
                <td class="align-center">${testsSum}</td>
                <td class="align-center">
                    <div style="font-weight:700;">${avgSuccess !== null ? `${avgSuccess.toFixed(1)}%` : '—'}</div>
                    <div class="inventory-summary-note">${avgFailure !== null ? `${avgFailure.toFixed(1)}% failure` : '—'}</div>
                </td>
            </tr>
        `;
    }).join('') || `<tr><td colspan="3" class="empty-state">No rows</td></tr>`;

    if (monthLabel) {
        monthLabel.textContent = labelMap[availabilityData.preventionFitMonthFilter] || '';
    }

    if (preventionFitChart) {
        preventionFitChart.destroy();
    }

    const fullLabels = (selection ? detailRows : summaryRows).map(row => row.key);
    const truncateLabel = (label, max = 28) => label.length > max ? `${label.slice(0, max - 1)}…` : label;
    const labels = fullLabels.map(l => truncateLabel(l));
    const testsData = (selection ? detailRows : summaryRows).map(row => row.tests.reduce((a, b) => a + b, 0));
    const successLabels = (selection ? detailRows : summaryRows).map(row => {
        if (!row.failures.length) return '—';
        const avgFailure = row.failures.reduce((a, b) => a + b, 0) / row.failures.length;
        return `${Math.max(0, 100 - avgFailure).toFixed(1)}%`;
    });

    const ctx = chartCanvas.getContext('2d');
    const barHeight = 28;
    const minHeight = 220;
    const maxHeight = 520;
    const desiredHeight = Math.min(maxHeight, Math.max(minHeight, labels.length * barHeight + 60));
    chartCanvas.style.height = `${desiredHeight}px`;

    preventionFitChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                label: 'Tests Ran',
                data: testsData,
                backgroundColor: '#1b96ff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            indexAxis: 'y',
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        title: (items) => fullLabels[items[0].dataIndex] || ''
                    }
                }
            },
            scales: {
                x: { beginAtZero: true },
                y: { ticks: { autoSkip: false } }
            }
        },
        plugins: [{
            id: 'success-labels',
            afterDatasetsDraw(chart) {
                const { ctx } = chart;
                ctx.save();
                ctx.font = '11px Salesforce Sans, Inter, sans-serif';
                ctx.fillStyle = '#2e844a';
                ctx.textAlign = 'center';
                chart.getDatasetMeta(0).data.forEach((bar, index) => {
                    const label = successLabels[index];
                    if (!label) return;
                    ctx.fillText(label, bar.x + 18, bar.y + 4);
                });
                ctx.restore();
            }
        }]
    });

    monthSelect.onchange = (e) => {
        availabilityData.preventionFitMonthFilter = e.target.value;
        availabilityData.preventionFitSelection = '';
        renderPreventionFitSummary();
    };
    groupButtons.forEach(btn => {
        btn.onclick = () => {
            availabilityData.preventionFitGroupBy = btn.dataset.value;
            availabilityData.preventionFitSelection = '';
            renderPreventionFitSummary();
        };
    });
    document.querySelectorAll('.prevention-fit-clickable').forEach(cell => {
        cell.onclick = () => {
            availabilityData.preventionFitSelection = cell.dataset.key || '';
            renderPreventionFitSummary();
        };
    });
}

function getInventoryProducts() {
    return [
        'Managed Mesh',
        'Ingress Gateway',
        'Falcon Kubernetes Service',
        'Workload Identity',
        'Vegacache',
        'Message Queue',
        'MAPS'
    ];
}

function normalizeProductName(product) {
    if (!product) return product;
    return product === 'WIS' ? 'Workload Identity' : product;
}

function getFitProductForService(service) {
    const map = availabilityData.fitServiceProductMap || {};
    const key = (service || '').toLowerCase();
    return normalizeProductName(map[key] || 'N/A');
}

function mapInventoryRows(rows, type) {
    return rows.map(row => {
        let product = '';
        if (type === 'customerScenario' || type === 'chaos') {
            product = normalizeProductName(row.Product || '');
        } else if (type === 'integration') {
        const service = row.Service || '';
        product = normalizeProductName(getFitProductForService(service));
        } else if (type === 'scalePerf') {
            const service = row.Service || '';
            product = normalizeProductName(getFitProductForService(service));
        }
        if (!product) product = 'Falcon Kubernetes Service';
        return { ...row, _product: product };
    });
}

function isScalePerfEnabled(row) {
    const raw = (row['Test Available'] || row['Test available'] || row['Test Available?'] || '').toString().trim();
    if (!raw) return false;
    return raw !== '-';
}

function getRowStatus(row, type) {
    if (type === 'customerScenario' || type === 'integration') {
        const status = (row.Status || '').toLowerCase();
        if (status === 'enabled') return 'enabled';
        return status ? 'partial' : 'missing';
    }
    if (type === 'scalePerf') {
        return 'enabled';
    }
    if (type === 'chaos') {
        const enabledValue = (row.Enabled || '').toLowerCase();
        if (enabledValue === 'enabled') return 'enabled';
        if (enabledValue === 'not enabled' || enabledValue === 'tbd' || enabledValue === 'planned') return 'partial';
        const frequency = (row.Frequency || '').toLowerCase();
        if (!frequency) return 'missing';
        if (frequency === 'not enabled' || frequency === 'tbd') return 'partial';
        return 'enabled';
    }
    return 'missing';
}

function buildInventorySummary(products, datasets) {
    const summary = {};
    products.forEach(product => {
        summary[product] = {
            customerScenario: { total: 0, enabled: 0, partial: 0 },
            integration: { total: 0, enabled: 0, partial: 0 },
            scalePerf: { total: 0, enabled: 0, partial: 0 },
        chaos: { total: 0, enabled: 0, partial: 0 }
        };
    });
    Object.entries(datasets).forEach(([type, rows]) => {
        rows.forEach(row => {
            const product = summary[row._product] ? row._product : 'Falcon Kubernetes Service';
            const bucket = summary[product][type];
            bucket.total += 1;
            const status = getRowStatus(row, type);
            if (status === 'enabled') bucket.enabled += 1;
            if (status === 'partial') bucket.partial += 1;
        });
    });
    return summary;
}

function buildIntegrationFitSummary(products) {
    const summary = {};
    products.forEach(product => {
        summary[product] = { post: 0, pre: 0 };
    });
    const fitRows = getFilteredFitRows();
    fitRows.forEach(row => {
        const service = row.Service || '';
        const product = getFitProductForService(service);
        const mapped = summary[product] ? product : '';
        if (!mapped || !summary[mapped]) return;
        const runType = (row['Run Type'] || '').toLowerCase();
        if (runType.includes('postdeployment')) summary[mapped].post += 1;
        if (runType.includes('predeployment')) summary[mapped].pre += 1;
    });
    return summary;
}

function buildIntegrationReleaseSummary(products, rows) {
    const summary = {};
    products.forEach(product => {
        summary[product] = {
            post: { total: 0, enabled: 0, partial: 0 },
            pre: { total: 0, enabled: 0, partial: 0 }
        };
    });
    rows.forEach(row => {
        const product = summary[row._product] ? row._product : 'Falcon Kubernetes Service';
        const release = (row['Pre-Post Release'] || '').toLowerCase();
        const key = release.includes('post') ? 'post' : release.includes('pre') ? 'pre' : 'post';
        const bucket = summary[product][key];
        bucket.total += 1;
        const status = getRowStatus(row, 'integration');
        if (status === 'enabled') bucket.enabled += 1;
        if (status === 'partial') bucket.partial += 1;
    });
    return summary;
}

function buildIntegrationReleaseSummaryFromFit(products) {
    const summary = {};
    const productServices = {};
    const serviceProductMap = availabilityData.fitServiceProductMap || {};

    Object.entries(serviceProductMap).forEach(([service, product]) => {
        if (!productServices[product]) {
            productServices[product] = new Set();
        }
        productServices[product].add(service);
    });

    products.forEach(product => {
        const totalServices = productServices[product] ? productServices[product].size : 0;
        summary[product] = {
            post: { total: totalServices, enabled: 0, partial: 0 },
            pre: { total: totalServices, enabled: 0, partial: 0 }
        };
    });

    const enabledServices = { pre: {}, post: {} };
    const fitRows = getFilteredFitRows();
    fitRows.forEach(row => {
        const service = (row.Service || '').toLowerCase();
        const mapped = serviceProductMap[service];
        if (!mapped || !summary[mapped]) return;
        const runType = (row['Run Type'] || '').toLowerCase();
        const key = runType.includes('predeployment') ? 'pre' : runType.includes('postdeployment') ? 'post' : '';
        if (!key) return;
        if (!enabledServices[key][mapped]) {
            enabledServices[key][mapped] = new Set();
        }
        enabledServices[key][mapped].add(service);
    });

    products.forEach(product => {
        summary[product].pre.enabled = enabledServices.pre[product]?.size || 0;
        summary[product].post.enabled = enabledServices.post[product]?.size || 0;
    });

    return summary;
}

function renderSummaryCellWithCounts(data, countsText = '') {
    const enabled = data.enabled || 0;
    const partial = data.partial || 0;
    const total = data.total || 0;
    const planned = total - enabled;
    const countsLabel = countsText || `(${enabled} enabled, ${planned} planned)`;
    let iconClass = 'inv-missing';
    let icon = '—';
    if (total > 0) {
        if (enabled > 0) {
            iconClass = 'inv-enabled';
            icon = '✔';
        } else if (partial > 0) {
            iconClass = 'inv-partial';
            icon = '⚠';
        }
    }
    return `
        <td>
            <div class="inv-summary-cell">
                <span class="inv-pill ${iconClass}">${icon}</span>
                <span class="inv-counts">${countsLabel}</span>
            </div>
        </td>
    `;
}

function renderSummaryCell(summary, product, type, isPerf = false) {
    const data = summary[product] ? summary[product][type] : { total: 0, enabled: 0, partial: 0 };
    if (data.total === 0) return `<td><span class="inv-pill inv-missing">—</span></td>`;
    const enabled = data.enabled;
    const partial = data.partial;
    if (type === 'chaos') {
        if (enabled > 0) return `<td><span class="inv-pill inv-enabled">✔</span></td>`;
        if (partial > 0) return `<td><span class="inv-pill inv-partial">⚠</span></td>`;
        return `<td><span class="inv-pill inv-missing">—</span></td>`;
    }
    if (type === 'scalePerf' && isPerf) {
        if (enabled > 0) return `<td><span class="inv-pill inv-enabled">✔</span></td>`;
        if (partial > 0) return `<td><span class="inv-pill inv-partial">⚠</span></td>`;
        return `<td><span class="inv-pill inv-missing">—</span></td>`;
    }
    if (enabled === data.total) return `<td><span class="inv-pill inv-enabled">✔</span></td>`;
    if (enabled > 0 || partial > 0) return `<td><span class="inv-pill inv-partial">⚠</span></td>`;
    return `<td><span class="inv-pill inv-missing">—</span></td>`;
}

let inventoryActiveTab = 'customerScenario';

function openAvailabilityInventoryTab(type, runType) {
    if (type === 'integration' && runType) {
        availabilityData.inventoryRunTypeFilter = runType;
    }
    availabilityData.preventionDevPendingDrill = true;
    availabilityData.preventionDevEntry = 'drill';
    availabilityData.preventionDevShowDetails = true;
    availabilityData.inventoryTestTypeFilter = type;
    switchViewMode('developer');
    switchTab('runtime-availability-prevention');
    scrollToTabContent('runtime-availability-prevention');
    window.setTimeout(() => {
        const btn = document.querySelector(`.inventory-tab-card[data-inventory-tab="${type}"]`);
        if (btn) {
            setInventoryTab(type, btn);
        }
    }, 50);
}

function openAvailabilityInventoryTabWithRunType(type, runType) {
    openAvailabilityInventoryTab(type, runType);
}

function openAvailabilityInventoryTabFromKpi(type, runType) {
    availabilityData.preventionDevForceSelect = true;
    openAvailabilityInventoryTab(type, runType);
}

function setInventoryTab(type, btn) {
    if (availabilityData.preventionDevShowDetails && inventoryActiveTab === type && !availabilityData.preventionDevForceSelect) {
        availabilityData.preventionDevPendingDrill = false;
        availabilityData.preventionDevEntry = 'nav';
        availabilityData.preventionDevShowDetails = false;
        availabilityData.inventoryTestTypeFilter = '';
        availabilityData.inventoryProductFilter = 'all';
        availabilityData.inventoryRunTypeFilter = 'all';
        availabilityData.integrationFitMonthFilter = '';
        inventoryActiveTab = '';
        renderAvailabilityInventoryView({
            containerId: 'runtime-availability-prevention-content',
            hideAllSummary: true,
            defaultTab: 'customerScenario'
        });
        return;
    }

    availabilityData.preventionDevForceSelect = false;
    inventoryActiveTab = type;
    if (!availabilityData.preventionDevShowDetails) {
        availabilityData.preventionDevPendingDrill = true;
        availabilityData.preventionDevEntry = 'drill';
        availabilityData.preventionDevShowDetails = true;
        availabilityData.inventoryTestTypeFilter = type;
        renderAvailabilityInventoryView({
            containerId: 'runtime-availability-prevention-content',
            hideAllSummary: true,
            defaultTab: type
        });
        return;
    }
    availabilityData.preventionDevEntry = 'drill';
    availabilityData.preventionDevShowDetails = true;
    availabilityData.inventoryTestTypeFilter = type;
    if (type !== 'integration') {
        availabilityData.inventoryRunTypeFilter = 'all';
        availabilityData.integrationFitMonthFilter = '';
    }
    document.querySelectorAll('.inventory-tab-card').forEach(tab => tab.classList.remove('active'));
    if (type !== 'all') {
        const target = btn || document.querySelector(`.inventory-tab-card[data-inventory-tab="${type}"]`);
        if (target) target.classList.add('active');
    }
    const testTypeSelect = document.getElementById('inventory-testtype-filter');
    if (testTypeSelect) {
        testTypeSelect.value = type;
    }
    renderInventoryProductSummary(type);
    renderInventoryDetail(type);
}

 

function normalizeFitRunType(raw) {
    const cleaned = (raw || '').toString().trim();
    const val = cleaned.toLowerCase();
    if (val.includes('staggergroupvalidation')) return 'StaggerGroup';
    if (val.includes('predeployment')) return 'PreDeployment';
    if (val.includes('postdeployment')) return 'PostDeployment';
    if (val.includes('staggergroup')) return 'StaggerGroup';
    if (val.includes('stagger group')) return 'StaggerGroup';
    return cleaned || 'Unknown';
}

function getRunTypeKey(raw) {
    return normalizeFitRunType(raw).toLowerCase().replace(/[^a-z0-9]/g, '');
}

function parseSuccessRate(raw, failureRaw = '') {
    if (raw) {
        const cleaned = raw.toString().trim().replace('%', '');
        const val = parseFloat(cleaned);
        if (!Number.isNaN(val)) return val;
    }
    if (failureRaw) {
        const cleaned = failureRaw.toString().trim().replace('%', '');
        const val = parseFloat(cleaned);
        if (!Number.isNaN(val)) return Math.max(0, 100 - val);
    }
    return null;
}

function getIntegrationMonthOptions(fitRows) {
    const parseRunDate = (raw) => parseFitRunDate(raw);
    const monthKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const monthLabel = (date) => date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    const monthOptions = Array.from(new Set(
        fitRows.map(r => parseRunDate(r['Run Time']))
            .filter(date => date && date.getFullYear() >= 2000)
            .map(monthKey)
    )).sort().reverse();
    const monthLabels = monthOptions.reduce((acc, key) => {
        const [year, month] = key.split('-').map(Number);
        const date = new Date(year, month - 1, 1);
        acc[key] = monthLabel(date);
        return acc;
    }, {});
    const defaultMonth = monthOptions[0] || '';
    let filterValue = availabilityData.integrationFitMonthFilter || defaultMonth;
    if (!monthOptions.includes(filterValue)) {
        filterValue = defaultMonth;
    }
    if (filterValue) {
        availabilityData.integrationFitMonthFilter = filterValue;
    }
    return { monthOptions, monthLabels, filterValue, monthKey };
}

function buildServiceTotalsFromRows(rows) {
    const totals = {};
    rows.forEach(row => {
        const service = (row.Service || row.service || '').trim();
        if (!service) return;
        const product = row._product || getFitProductForService(service);
        if (!totals[product]) totals[product] = new Set();
        totals[product].add(service.toLowerCase());
    });
    return Object.fromEntries(Object.entries(totals).map(([product, set]) => [product, set.size]));
}

function renderInventoryProductSummary(type) {
    const kpiContainer = document.getElementById('inventory-product-kpis');
    const titleEl = document.getElementById('inventory-selected-coverage-title');
    if (!kpiContainer) return;

    const label = type === 'customerScenario'
        ? 'Critical Path'
        : type === 'integration'
            ? 'Integration'
            : type === 'scalePerf'
                ? 'Scale & Perf'
                : type === 'chaos'
                    ? 'Chaos'
                    : type === 'all'
                        ? 'All Tests'
                        : 'Selected';
    if (titleEl) {
        titleEl.textContent = `HRP Product Summary - "${label} Test" Coverage`;
    }

    const products = getInventoryProducts();
    const visibleProducts = availabilityData.inventoryProductFilter && availabilityData.inventoryProductFilter !== 'all'
        ? products.filter(product => product === availabilityData.inventoryProductFilter)
        : products;
    const inventory = availabilityData.testInventory;
    const fitRows = getFilteredFitRows();
    const runTypeFilter = availabilityData.inventoryRunTypeFilter || 'all';
    const matchesRunType = (row) => runTypeFilter === 'all' || normalizeFitRunType(row['Run Type']) === runTypeFilter;
    const customerRows = mapInventoryRows(inventory.customerScenario.rows, 'customerScenario');
    const scalePerfRows = mapInventoryRows(inventory.scalePerf.rows, 'scalePerf');
    const chaosRows = mapInventoryRows(inventory.chaos.rows, 'chaos');
    const summary = buildInventorySummary(products, {
        customerScenario: customerRows,
        integration: mapInventoryRows(fitRows, 'integration'),
        scalePerf: scalePerfRows,
        chaos: chaosRows
    });

    if (type === 'integration') {
        const { filterValue, monthKey } = getIntegrationMonthOptions(fitRows);
        const serviceProductMap = availabilityData.fitServiceProductMap || {};
        const productServiceTotals = {};
        Object.entries(serviceProductMap).forEach(([service, product]) => {
            if (!productServiceTotals[product]) productServiceTotals[product] = new Set();
            productServiceTotals[product].add(service);
        });
        const totalServicesByProduct = Object.fromEntries(
            Object.entries(productServiceTotals).map(([product, set]) => [product, set.size])
        );
        const filteredRows = filterValue
            ? fitRows.filter(row => {
                const date = parseFitRunDate(row['Run Time']);
                return date && monthKey(date) === filterValue;
            })
            : [];
        const allRunTypes = Array.from(new Set(fitRows.map(row => normalizeFitRunType(row['Run Type']))))
            .filter(Boolean)
            .sort((a, b) => a.localeCompare(b));
        const visibleRunTypes = runTypeFilter === 'all' ? allRunTypes : allRunTypes.filter(rt => rt === runTypeFilter);

        const orderedRunTypes = [
            { key: 'adhoc', label: 'Adhoc' },
            { key: 'cron', label: 'Cron' },
            { key: 'predeployment', label: 'Pre Deployment' },
            { key: 'postdeployment', label: 'Post Deployment' },
            { key: 'staggergroup', label: 'Stagger Group' }
        ];
        kpiContainer.innerHTML = `
            <div class="exec-summary-kpi-grid columns-4">
                ${visibleProducts.map(product => {
                    const productRowsAll = fitRows.filter(row => getFitProductForService(row.Service || '') === product);
                    const productRows = filteredRows.filter(row => getFitProductForService(row.Service || '') === product);
                    const totalServices = totalServicesByProduct[product] || 0;
                    const enabledServicesSet = new Set(productRowsAll.map(row => (row.Service || '').toLowerCase()).filter(Boolean));
                    const enabledServices = enabledServicesSet.size;
                    const plannedServices = Math.max(totalServices - enabledServices, 0);
                    const runTypeLines = orderedRunTypes.map(item => {
                        const runTypeRowsAll = productRowsAll.filter(row => getRunTypeKey(row['Run Type']) === item.key);
                        if (!runTypeRowsAll.length) {
                            return `
                                <div class="inventory-metric-row">
                                    <span class="inventory-metric-label">${item.label}</span>
                                    <span class="inventory-metric-value inventory-metric-blue">N/A</span>
                                </div>
                            `;
                        }
                        const runTypeServices = new Set(runTypeRowsAll.map(row => (row.Service || '').toLowerCase()).filter(Boolean)).size;
                        const successValues = runTypeRowsAll.map(row => parseSuccessRate(row['Success Rate'], row['Failure Rate'])).filter(v => v !== null);
                        const avgSuccess = successValues.length
                            ? (successValues.reduce((a, b) => a + b, 0) / successValues.length).toFixed(1)
                            : null;
                        const runTypeValue = `${runTypeServices}/${totalServices} (${avgSuccess !== null ? `${avgSuccess}% success` : '— success'})`;
                        return `
                            <div class="inventory-metric-row">
                                <span class="inventory-metric-label">${item.label}</span>
                                <span class="inventory-metric-value inventory-metric-blue">${runTypeValue}</span>
                            </div>
                        `;
                    }).join('');
                    return `
                        <div class="exec-summary-kpi-card inventory-product-card">
                            <div class="inventory-product-title">
                                ${product}
                            </div>
                            <div class="inventory-metric-row">
                                <span class="inventory-metric-label">Total Services</span>
                                <span class="inventory-metric-value inventory-metric-blue">${totalServices}</span>
                            </div>
                            ${runTypeLines}
                            <div class="inventory-metric-row">
                                <span class="inventory-metric-label">Avg FIT Quality</span>
                                <span class="inventory-metric-value inventory-metric-blue">TBD</span>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
        return;
    }

    const dataSourceType = type === 'all' ? 'customerScenario' : type;
    const serviceTotalsFromMap = {};
    const serviceProductMap = availabilityData.fitServiceProductMap || {};
    Object.entries(serviceProductMap).forEach(([service, product]) => {
        const normalizedProduct = normalizeProductName(product);
        if (!serviceTotalsFromMap[normalizedProduct]) {
            serviceTotalsFromMap[normalizedProduct] = new Set();
        }
        serviceTotalsFromMap[normalizedProduct].add(service);
    });
    const serviceTotals = Object.fromEntries(
        Object.entries(serviceTotalsFromMap).map(([product, set]) => [product, set.size])
    );
    const scalePerfRowsByProduct = mapInventoryRows(scalePerfRows, 'scalePerf');
    const scalePerfEnabledByProduct = scalePerfRowsByProduct.reduce((acc, row) => {
        const product = row._product || 'Falcon Kubernetes Service';
        if (!acc[product]) acc[product] = new Set();
        if (isScalePerfEnabled(row)) {
            const service = (row.Service || '').toString().toLowerCase();
            if (service) acc[product].add(service);
        }
        return acc;
    }, {});
    kpiContainer.innerHTML = `
        <div class="exec-summary-kpi-grid columns-4">
            ${visibleProducts.map(product => {
                const data = summary[product] ? summary[product][dataSourceType] : { total: 0, enabled: 0, partial: 0 };
                const totalServices = serviceTotals[product] || 0;
                if (dataSourceType === 'scalePerf') {
                    const enabledServices = scalePerfEnabledByProduct[product]?.size || 0;
                    return `
                        <div class="exec-summary-kpi-card inventory-product-card">
                            <div class="inventory-product-title">${product}</div>
                            <div class="inventory-metric-row">
                                <span class="inventory-metric-label">Total Services</span>
                                <span class="inventory-metric-value inventory-metric-blue">${totalServices}</span>
                            </div>
                            <div class="inventory-metric-row">
                                <span class="inventory-metric-label">Services Enabled</span>
                                <span class="inventory-metric-value inventory-metric-green">${enabledServices}</span>
                            </div>
                        </div>
                    `;
                }
                if (dataSourceType === 'customerScenario' || dataSourceType === 'chaos') {
                    const enabledTests = data.enabled || 0;
                    const plannedTests = Math.max((data.total || 0) - enabledTests, 0);
                    return `
                        <div class="exec-summary-kpi-card inventory-product-card">
                            <div class="inventory-product-title">${product}</div>
                            <div class="inventory-metric-row">
                                <span class="inventory-metric-label">Total Services</span>
                                <span class="inventory-metric-value inventory-metric-blue">${totalServices}</span>
                            </div>
                            <div class="inventory-metric-row">
                                <span class="inventory-metric-label">Total Tests Enabled</span>
                                <span class="inventory-metric-value inventory-metric-green">${enabledTests}</span>
                            </div>
                            <div class="inventory-metric-row">
                                <span class="inventory-metric-label">Total Tests Planned</span>
                                <span class="inventory-metric-value inventory-metric-yellow">${plannedTests}</span>
                            </div>
                        </div>
                    `;
                }
                const enabledTests = data.enabled || 0;
                const plannedTests = Math.max((data.total || 0) - enabledTests, 0);
                return `
                    <div class="exec-summary-kpi-card inventory-product-card">
                        <div class="inventory-product-title">${product}</div>
                        <div class="inventory-metric-row">
                            <span class="inventory-metric-label">Total Services</span>
                            <span class="inventory-metric-value inventory-metric-blue">${totalServices}</span>
                        </div>
                        <div class="inventory-metric-row">
                            <span class="inventory-metric-label">Total Tests Enabled</span>
                            <span class="inventory-metric-value inventory-metric-green">${enabledTests}</span>
                        </div>
                        <div class="inventory-metric-row">
                            <span class="inventory-metric-label">Total Tests Planned</span>
                            <span class="inventory-metric-value inventory-metric-yellow">${plannedTests}</span>
                        </div>
                    </div>
                `;
            }).join('')}
        </div>
    `;
}

function renderInventoryDetail(type) {
    const container = document.getElementById('inventory-detail');
    if (!container) return;
    let shouldRenderIntegrationTrend = false;
    const monthFilterBlock = document.getElementById('integration-fit-month-filter-block');
    const runTypeFilterBlock = document.getElementById('integration-fit-runtype-filter-block');
    const inventory = availabilityData.testInventory;
    const map = {
        customerScenario: {
            title: 'Critical Path Test View',
            data: inventory.customerScenario,
            columns: ['Product', 'Purpose', 'Status', 'Frequency', 'Details']
        },
        integration: {
            title: 'Integration Test View',
            data: { headers: [], rows: [] },
            columns: ['Product', 'Service', 'Run Type', 'Tests', 'Avg Success Rate', 'Last Runtime (Max)']
        },
        scalePerf: {
            title: 'Scale & Perf Test View',
            data: inventory.scalePerf,
            columns: ['Product', 'Service', 'Type', 'Test Available', 'Frequency', 'Tier']
        },
        chaos: {
            title: 'Chaos Test View',
            data: inventory.chaos,
            columns: ['Product', 'Available Test in Chaos platform', 'Risk level', 'Enabled']
        }
    };

    const buildTableHtml = (title, subtitle, headers, rows, tableId) => `
        <div class="inventory-detail-card">
            <div class="inventory-detail-header">
                <h3>${title}</h3>
                <div class="inventory-detail-meta">
                    <span>${subtitle}</span>
                    <button class="autoscaling-reset-btn inventory-export-btn" onclick="exportInventoryTableToCsv('${tableId}', '${title}')">Export CSV</button>
                </div>
            </div>
            <div class="modal-table-scroll">
                <table class="availability-modal-table inventory-detail-table" id="${tableId}">
                    <thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>
                    <tbody>${rows.map(row => {
                        const cells = headers.map(h => `<td>${row[h] ?? ''}</td>`).join('');
                        const rowClass = row._rowClass ? ` class="${row._rowClass}"` : '';
                        return `<tr${rowClass}>${cells}</tr>`;
                    }).join('') || `<tr><td colspan="${headers.length}" class="empty-state">No rows</td></tr>`}</tbody>
                </table>
            </div>
            ${tableId === 'inventory-table-integration' ? `
                <div class="inventory-table-legend">
                    <span class="legend-item legend-enabled"><span class="legend-swatch"></span>Enabled</span>
                    <span class="legend-item legend-stale"><span class="legend-swatch"></span>Active (historical data)</span>
                    <span class="legend-item legend-missing"><span class="legend-swatch"></span>Not Planned</span>
                </div>
            ` : ''}
        </div>
    `;

    const renderStandardSection = (sectionType) => {
        const selected = map[sectionType];
        if (!selected) return '';
        const headers = sectionType === 'chaos'
            ? selected.columns
            : selected.columns.filter(col => selected.data.headers.includes(col) || col === 'Product');
        let rows = mapInventoryRows(selected.data.rows, sectionType);
        if (availabilityData.inventoryProductFilter && availabilityData.inventoryProductFilter !== 'all') {
            rows = rows.filter(row => row._product === availabilityData.inventoryProductFilter);
        }
        if (sectionType === 'scalePerf') {
            const serviceProductMap = availabilityData.fitServiceProductMap || {};
            const serviceList = Object.keys(serviceProductMap)
                .map(service => ({ service, product: normalizeProductName(serviceProductMap[service]) }))
                .filter(entry => entry.product);
            const filteredServiceList = availabilityData.inventoryProductFilter && availabilityData.inventoryProductFilter !== 'all'
                ? serviceList.filter(entry => entry.product === availabilityData.inventoryProductFilter)
                : serviceList;
            const rowsByService = rows.reduce((acc, row) => {
                const key = (row.Service || '').toString().toLowerCase();
                if (!key) return acc;
                acc[key] = row;
                return acc;
            }, {});
            rows = filteredServiceList.map(({ service, product }) => {
                const key = service.toString().toLowerCase();
                const existing = rowsByService[key];
                if (!existing) {
                    return {
                        _product: product,
                        Product: product,
                        Service: service,
                        Type: 'N/A',
                        'Test Available': 'N/A',
                        Frequency: 'N/A',
                        Tier: 'N/A',
                        _rowClass: 'inventory-row-missing'
                    };
                }
                return {
                    ...existing,
                    _product: product,
                    _rowClass: 'inventory-row-enabled'
                };
            });
        }
        if (sectionType === 'chaos') {
            rows = rows.map(row => {
                const enabledValue = (row.Enabled || '').toLowerCase();
                let enabled = 'Planned';
                if (enabledValue === 'enabled') enabled = 'Enabled';
                else if (enabledValue === 'not enabled' || enabledValue === 'tbd' || enabledValue === 'planned') enabled = 'Planned';
                else {
                    const frequency = (row.Frequency || '').toLowerCase();
                    if (frequency && frequency !== 'not enabled' && frequency !== 'tbd') {
                        enabled = 'Enabled';
                    }
                }
                return { ...row, Enabled: enabled };
            });
        }
        const normalizedRows = rows.map(row => {
            const normalized = {};
            headers.forEach(h => {
                normalized[h] = h === 'Product' ? row._product || '' : row[h] || '';
            });
            if (row._rowClass) normalized._rowClass = row._rowClass;
            return normalized;
        });
        if (sectionType === 'scalePerf') {
            return `
                <div class="inventory-table-legend">
                    <div class="inventory-legend-item"><span class="legend-swatch legend-enabled"></span>Enabled</div>
                    <div class="inventory-legend-item"><span class="legend-swatch legend-missing"></span>Not Planned</div>
                </div>
                ${buildTableHtml(selected.title, `${rows.length} services`, headers, normalizedRows, `inventory-table-${sectionType}`)}
            `;
        }
        return buildTableHtml(selected.title, `${rows.length} tests`, headers, normalizedRows, `inventory-table-${sectionType}`);
    };

    const renderIntegrationSection = (showMonthFilter) => {
        const fitRows = getFilteredFitRows();
        const { monthOptions, monthLabels, filterValue, monthKey } = getIntegrationMonthOptions(fitRows);
        if (monthFilterBlock) {
            monthFilterBlock.innerHTML = showMonthFilter && monthOptions.length ? `
                <label class="autoscaling-filter-label">Month</label>
                <select id="integration-fit-month-filter">
                    ${monthOptions.map(key => `
                        <option value="${key}"${filterValue === key ? ' selected' : ''}>${monthLabels[key]}</option>
                    `).join('')}
                </select>
            ` : '';
        }
        const allRunTypes = Array.from(new Set(fitRows.map(row => normalizeFitRunType(row['Run Type']))))
            .filter(Boolean)
            .sort((a, b) => a.localeCompare(b));
        if (runTypeFilterBlock) {
            runTypeFilterBlock.innerHTML = showMonthFilter && allRunTypes.length ? `
                <label class="autoscaling-filter-label">Run Type</label>
                <select id="integration-fit-runtype-filter">
                    <option value="all">All RunTypes</option>
                    ${allRunTypes.map(rt => `
                        <option value="${rt}"${availabilityData.inventoryRunTypeFilter === rt ? ' selected' : ''}>${rt}</option>
                    `).join('')}
                </select>
            ` : '';
        }
        const runTypeFilter = availabilityData.inventoryRunTypeFilter || 'all';
        const scopedRows = showMonthFilter && filterValue
            ? fitRows.filter(r => {
                const date = parseFitRunDate(r['Run Time']);
                return date && monthKey(date) === filterValue;
            })
            : fitRows;
        const runTypeScopedRows = runTypeFilter === 'all'
            ? scopedRows
            : scopedRows.filter(row => normalizeFitRunType(row['Run Type']) === runTypeFilter);

        const serviceProductMap = availabilityData.fitServiceProductMap || {};
        const serviceList = Object.keys(serviceProductMap)
            .map(service => ({ service, product: normalizeProductName(serviceProductMap[service]) }))
            .filter(entry => entry.product);
        const filteredServiceList = availabilityData.inventoryProductFilter && availabilityData.inventoryProductFilter !== 'all'
            ? serviceList.filter(entry => entry.product === availabilityData.inventoryProductFilter)
            : serviceList;

        const displayRunTypes = runTypeFilter === 'all' ? allRunTypes : [runTypeFilter];

        const rows = filteredServiceList.flatMap(({ service, product }) => {
            const serviceLower = service.toLowerCase();
            return displayRunTypes.map(runType => {
                const serviceRowsAll = fitRows.filter(row =>
                    (row.Service || '').toLowerCase() === serviceLower &&
                    normalizeFitRunType(row['Run Type']) === runType
                );
                const currentRows = filterValue
                    ? serviceRowsAll.filter(row => {
                        const date = parseFitRunDate(row['Run Time']);
                        return date && monthKey(date) === filterValue;
                    })
                    : serviceRowsAll;

                const hasAny = serviceRowsAll.length > 0;
                const hasCurrent = currentRows.length > 0;

                let useRows = currentRows;
                let lastRuntimeLabel = '-';
                let rowClass = '';

                if (filterValue && !hasCurrent && hasAny) {
                    const previousRows = serviceRowsAll
                        .map(row => ({ row, date: parseFitRunDate(row['Run Time']) }))
                        .filter(entry => entry.date && monthKey(entry.date) < filterValue)
                        .sort((a, b) => b.date - a.date);
                    if (previousRows.length) {
                        const latestDate = previousRows[0].date;
                        useRows = previousRows.filter(entry => entry.date.getTime() === latestDate.getTime()).map(entry => entry.row);
                        lastRuntimeLabel = latestDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                        rowClass = 'inventory-row-stale';
                    }
                }

                if (hasCurrent) {
                    const latestCurrent = currentRows
                        .map(r => parseFitRunDate(r['Run Time']))
                        .filter(Boolean)
                        .sort((a, b) => b - a)[0];
                    lastRuntimeLabel = latestCurrent ? latestCurrent.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : lastRuntimeLabel;
                    rowClass = 'inventory-row-enabled';
                } else if (!lastRuntimeLabel || lastRuntimeLabel === '-') {
                    const fallback = serviceRowsAll
                        .map(r => parseFitRunDate(r['Run Time']))
                        .filter(date => date && (!filterValue || monthKey(date) < filterValue))
                        .sort((a, b) => b - a)[0];
                    lastRuntimeLabel = fallback
                        ? fallback.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                        : '-';
                }

                if (!hasAny) {
                    rowClass = 'inventory-row-missing';
                }

                const testsValues = useRows.map(r => parseInt(r.Tests || 0, 10)).filter(v => !Number.isNaN(v));
                const successValues = useRows.map(r => parseSuccessRate(r['Success Rate'], r['Failure Rate'])).filter(v => v !== null);
                const testsSum = testsValues.length ? testsValues.reduce((a, b) => a + b, 0) : '-';
                const avgSuccess = successValues.length
                    ? `${(successValues.reduce((a, b) => a + b, 0) / successValues.length).toFixed(1)}%`
                    : '-';

                return {
                    Product: product,
                    Service: service,
                    'Run Type': runType,
                    Tests: testsSum,
                    'Avg Success Rate': avgSuccess,
                    'Last Runtime (Max)': lastRuntimeLabel,
                    _rowClass: rowClass
                };
            });
        });

        const subtitle = showMonthFilter && filterValue && monthLabels[filterValue]
            ? `${rows.length} services • ${monthLabels[filterValue]}`
            : `${rows.length} services`;
        const shouldShowTrend = availabilityData.inventoryProductFilter !== 'all' || runTypeFilter !== 'all';
        const trendHtml = shouldShowTrend ? `
            <div class="inventory-detail-card">
                <div class="inventory-detail-header">
                    <h3>Trend of Falcon Integration Tests (FIT) over time</h3>
                </div>
                <div class="chart-body">
                    <div class="chart-container">
                        <canvas id="integrationTrendChart"></canvas>
                    </div>
                </div>
            </div>
        ` : '';
        const tableHtml = `
            ${trendHtml}
            <div class="inventory-table-legend">
                <div class="inventory-legend-item"><span class="legend-swatch legend-enabled"></span>Enabled (selected month)</div>
                <div class="inventory-legend-item"><span class="legend-swatch legend-historical"></span>Active (historical data)</div>
                <div class="inventory-legend-item"><span class="legend-swatch legend-missing"></span>Not Planned</div>
            </div>
            ${buildTableHtml(map.integration.title, subtitle, map.integration.columns, rows, 'inventory-table-integration')}
        `;

        const monthSelect = document.getElementById('integration-fit-month-filter');
        if (monthSelect) {
            monthSelect.addEventListener('change', (e) => {
                availabilityData.integrationFitMonthFilter = e.target.value;
                renderInventoryDetail('integration');
            });
        }
        const runTypeSelect = document.getElementById('integration-fit-runtype-filter');
        if (runTypeSelect) {
            runTypeSelect.addEventListener('change', (e) => {
                availabilityData.inventoryRunTypeFilter = e.target.value;
                renderInventoryProductSummary('integration');
                renderInventoryDetail('integration');
            });
        }
        shouldRenderIntegrationTrend = shouldShowTrend;
        return tableHtml;
    };

    if (type === 'integration') {
        container.innerHTML = renderIntegrationSection(true);
        if (shouldRenderIntegrationTrend) {
            renderIntegrationTrendChart();
        } else if (integrationTrendChart) {
            integrationTrendChart.destroy();
            integrationTrendChart = null;
        }
        return;
    }

    if (monthFilterBlock) {
        monthFilterBlock.innerHTML = '';
    }
    if (runTypeFilterBlock) {
        runTypeFilterBlock.innerHTML = '';
    }

    if (type === 'all') {
        container.innerHTML = [
            renderStandardSection('customerScenario'),
            renderIntegrationSection(false),
            renderStandardSection('scalePerf'),
            renderStandardSection('chaos')
        ].join('');
        if (shouldRenderIntegrationTrend) {
            renderIntegrationTrendChart();
        } else if (integrationTrendChart) {
            integrationTrendChart.destroy();
            integrationTrendChart = null;
        }
        return;
    }

    container.innerHTML = renderStandardSection(type);
}

function exportInventoryTableToCsv(tableId, title) {
    const table = document.getElementById(tableId);
    if (!table) return;
    const rows = Array.from(table.querySelectorAll('tr'));
    const csv = rows.map(row => {
        const cells = Array.from(row.querySelectorAll('th, td')).map(cell => {
            const text = (cell.textContent || '').trim().replace(/"/g, '""');
            return `"${text}"`;
        });
        return cells.join(',');
    }).join('\n');
    const safeTitle = (title || 'inventory').replace(/[^a-z0-9]+/gi, '_').toLowerCase();
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${safeTitle}_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function renderIntegrationTrendChart() {
    const canvas = document.getElementById('integrationTrendChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const fitRows = getFilteredFitRows();
    const months = Array.from(new Set(
        fitRows.map(r => parseFitRunDate(r['Run Time']))
            .filter(Boolean)
            .map(date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`)
    )).sort();
    const labels = months.map(key => {
        const [year, month] = key.split('-').map(Number);
        const date = new Date(year, month - 1, 1);
        return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    });

    const productFilter = availabilityData.inventoryProductFilter || 'all';
    const runTypeFilter = availabilityData.inventoryRunTypeFilter || 'all';
    const allRunTypes = Array.from(new Set(fitRows.map(row => normalizeFitRunType(row['Run Type']))))
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b));
    const allProducts = getInventoryProducts();

    let series = [];
    if (productFilter !== 'all' && runTypeFilter !== 'all') {
        series = [{ label: `${productFilter} · ${runTypeFilter}`, product: productFilter, runType: runTypeFilter }];
    } else if (productFilter !== 'all') {
        series = allRunTypes.map(rt => ({ label: rt, product: productFilter, runType: rt }));
    } else if (runTypeFilter !== 'all') {
        series = allProducts.map(prod => ({ label: prod, product: prod, runType: runTypeFilter }));
    } else {
        return;
    }

    const datasets = series.map((item, index) => {
        const data = months.map(monthKey => {
            const monthRows = fitRows.filter(row => {
                const date = parseFitRunDate(row['Run Time']);
                if (!date) return false;
                const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                if (key !== monthKey) return false;
                const product = getFitProductForService(row.Service || '');
                if (item.product && item.product !== product) return false;
                if (item.runType && normalizeFitRunType(row['Run Type']) !== item.runType) return false;
                return true;
            });
            if (!monthRows.length) return null;
            const successValues = monthRows
                .map(row => parseSuccessRate(row['Success Rate'], row['Failure Rate']))
                .filter(v => v !== null);
            if (!successValues.length) return null;
            return Number((successValues.reduce((a, b) => a + b, 0) / successValues.length).toFixed(1));
        });
        const colors = ['#2563eb', '#7c3aed', '#059669', '#d97706', '#dc2626', '#0ea5e9', '#9333ea', '#16a34a'];
        return {
            label: item.label,
            data,
            borderColor: colors[index % colors.length],
            backgroundColor: colors[index % colors.length],
            tension: 0.2,
            spanGaps: true,
            pointRadius: 3,
            pointHoverRadius: 4
        };
    });

    datasets.push({
        label: 'Target 95%',
        data: months.map(() => 95),
        borderColor: '#94a3b8',
        backgroundColor: '#94a3b8',
        borderDash: [6, 6],
        pointRadius: 0,
        tension: 0
    });

    if (integrationTrendChart) {
        integrationTrendChart.destroy();
    }

    integrationTrendChart = new Chart(ctx, {
        type: 'line',
        data: { labels, datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: true, position: 'bottom' }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100,
                    ticks: { callback: (val) => `${val}%` }
                }
            }
        }
    });
}

function getProductStatusClass(summary, product, tab) {
    const status = getProductStatus(summary, product, tab);
    return status === 'enabled' ? 'inv-enabled' : status === 'partial' ? 'inv-partial' : 'inv-missing';
}

function getProductStatusIcon(summary, product, tab) {
    const status = getProductStatus(summary, product, tab);
    return status === 'enabled' ? '✔' : status === 'partial' ? '⚠' : '—';
}

function getProductStatus(summary, product, tab) {
    const types = ['customerScenario', 'integration', 'scalePerf', 'chaos'];
    if (tab === 'all') {
        let hasEnabled = false;
        let hasPartial = false;
        types.forEach(type => {
            if (type === 'integration') {
                const fitSummary = availabilityData.integrationFitSummary || {};
                const fitBucket = fitSummary[product];
                if (fitBucket) {
                    if (fitBucket.post > 0 || fitBucket.pre > 0) {
                        hasEnabled = true;
                    }
                }
                return;
            }
            const bucket = summary[product]?.[type];
            if (!bucket) return;
            if (bucket.enabled > 0) hasEnabled = true;
            if (bucket.partial > 0) hasPartial = true;
        });
        if (hasEnabled) return 'enabled';
        if (hasPartial) return 'partial';
        return 'missing';
    }
    if (tab === 'integration') {
        const fitSummary = availabilityData.integrationFitSummary || {};
        const fitBucket = fitSummary[product];
        if (!fitBucket) return 'missing';
        if (fitBucket.post > 0 || fitBucket.pre > 0) return 'enabled';
        return 'missing';
    }
    const bucket = summary[product]?.[tab];
    if (!bucket || bucket.total === 0) return 'missing';
    if (bucket.enabled > 0) return 'enabled';
    if (bucket.partial > 0) return 'partial';
    return 'missing';
}

let ingressDonutChart = null;
let ingressAccuracyChart = null;
let ingressAlertQualityChart = null;

function renderIngressIncidentAlertQuality() {
    const tableBody = document.getElementById('ingress-alert-quality-table');
    const kpiContainer = document.getElementById('ingress-alert-quality-kpis');
    const chartCanvas = document.getElementById('ingressAlertQualityPie');
    const productFilter = document.getElementById('ingress-alert-product-filter');
    if (!tableBody || !kpiContainer || !chartCanvas) return;

    const rows = availabilityData.ingressIncidentAnalysis?.rows || [];
    const products = getInventoryProducts();
    if (productFilter) {
        if (!availabilityData.ingressAlertProductFilter) {
            availabilityData.ingressAlertProductFilter = 'Ingress Gateway';
        }
        productFilter.innerHTML = products.map(product => `
            <option value="${product}">${normalizeProductName(product)}</option>
        `).join('');
        productFilter.value = availabilityData.ingressAlertProductFilter;
        productFilter.onchange = (e) => {
            availabilityData.ingressAlertProductFilter = e.target.value;
            renderIngressIncidentAlertQuality();
        };
    }

    const activeProduct = availabilityData.ingressAlertProductFilter || 'Ingress Gateway';
    const hasIngressData = activeProduct === 'Ingress Gateway';
    if (!rows.length || !hasIngressData) {
        tableBody.innerHTML = '<tr><td colspan="5" class="empty-state">No Data</td></tr>';
        kpiContainer.innerHTML = '<div class="empty-state">No Data</div>';
        if (ingressAlertQualityChart) {
            ingressAlertQualityChart.destroy();
            ingressAlertQualityChart = null;
        }
        return;
    }

    const normalizedRows = rows.map(row => ({
        date: row.Date || '',
        incident: row.Incident || '',
        ingressIssue: (row['Ingress Issue'] || '').toString().trim(),
        rootCause: row['Root Cause'] || '',
        causeCategory: row['Probable Cause Category'] || 'Unknown',
        link: row['Slack Thread Link'] || ''
    }));

    const total = normalizedRows.length;
    const ingressCount = normalizedRows.filter(row => row.ingressIssue.toLowerCase() === 'yes').length;
    const nonIngressCount = total - ingressCount;

    kpiContainer.innerHTML = `
        <div class="ingress-kpi-card">
            <div class="ingress-kpi-label">Total Alerts</div>
            <div class="ingress-kpi-value">${total}</div>
        </div>
        <div class="ingress-kpi-card success">
            <div class="ingress-kpi-label">Confirmed Ingress Issues</div>
            <div class="ingress-kpi-value">${ingressCount}</div>
        </div>
        <div class="ingress-kpi-card warning">
            <div class="ingress-kpi-label">False Positives</div>
            <div class="ingress-kpi-value">${nonIngressCount}</div>
        </div>
    `;

    const bucketMap = new Map();
    normalizedRows
        .filter(row => row.ingressIssue.toLowerCase() !== 'yes')
        .forEach(row => {
            const key = row.causeCategory || 'Unknown';
            bucketMap.set(key, (bucketMap.get(key) || 0) + 1);
        });
    const labels = Array.from(bucketMap.keys());
    const data = labels.map(label => bucketMap.get(label));
    const colors = [
        '#2563eb', '#0ea5e9', '#22c55e', '#f59e0b', '#ef4444',
        '#8b5cf6', '#14b8a6', '#f97316', '#64748b', '#84cc16'
    ];

    if (!labels.length) {
        if (ingressAlertQualityChart) {
            ingressAlertQualityChart.destroy();
            ingressAlertQualityChart = null;
        }
        return;
    }

    if (ingressAlertQualityChart) {
        ingressAlertQualityChart.destroy();
    }
    const percentLabelPlugin = {
        id: 'percentLabels',
        afterDraw(chart) {
            const { ctx } = chart;
            const dataset = chart.data.datasets[0];
            const total = dataset.data.reduce((sum, v) => sum + v, 0) || 1;
            chart.getDatasetMeta(0).data.forEach((arc, index) => {
                const value = dataset.data[index];
                if (!value) return;
                const percent = ((value / total) * 100).toFixed(1);
                const { x, y } = arc.tooltipPosition();
                ctx.save();
                ctx.fillStyle = '#1f2933';
                ctx.font = '12px sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(`${percent}%`, x, y);
                ctx.restore();
            });
        }
    };

    ingressAlertQualityChart = new Chart(chartCanvas.getContext('2d'), {
        type: 'pie',
        data: {
            labels,
            datasets: [{ data, backgroundColor: labels.map((_, i) => colors[i % colors.length]) }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'right', align: 'start' }
            }
        },
        plugins: [percentLabelPlugin]
    });

    tableBody.innerHTML = normalizedRows.map(row => `
        <tr>
            <td>${row.incident || '-'}</td>
            <td>${row.causeCategory || '-'}</td>
            <td>${row.rootCause || '-'}</td>
            <td>${row.link ? `<a class="ingress-alert-link" href="${row.link}" target="_blank" rel="noopener noreferrer">Slack Thread</a>` : '-'}</td>
            <td>${row.ingressIssue || '-'}</td>
        </tr>
    `).join('');
}

function initIngressDonut(distributionRows) {
    const canvas = document.getElementById('ingress-alert-donut');
    const legend = document.getElementById('ingress-alert-legend');
    if (!canvas || !distributionRows.length || typeof Chart === 'undefined') return;
    
    const labels = distributionRows.map(row => row.Category);
    const values = distributionRows.map(row => parseFloat(row.Percentage || row.Count || 0));
    const colors = ['#0176d3', '#fe9339', '#c23934', '#706e6b'];
    
    if (ingressDonutChart) ingressDonutChart.destroy();
    ingressDonutChart = new Chart(canvas.getContext('2d'), {
        type: 'doughnut',
        data: {
            labels,
            datasets: [{
                data: values,
                backgroundColor: colors.slice(0, values.length),
                borderWidth: 0
            }]
        },
        options: {
            cutout: '65%',
            plugins: { legend: { display: false } },
            maintainAspectRatio: false
        }
    });
    
    if (legend) {
        legend.innerHTML = labels.map((label, idx) => `
            <div class="ingress-legend-item">
                <span class="ingress-legend-dot" style="background:${colors[idx]}"></span>
                <span>${label} ${values[idx]}%</span>
            </div>
        `).join('');
    }
}

function initIngressAccuracyLine(rows) {
    const canvas = document.getElementById('ingress-accuracy-line');
    if (!canvas || !rows.length || typeof Chart === 'undefined') return;
    
    const labels = rows.map(row => row.Week);
    const accuracy = rows.map(row => parseFloat(row.Accuracy || 0));
    const targets = rows.map(row => parseFloat(row.Target || 0));
    
    if (ingressAccuracyChart) ingressAccuracyChart.destroy();
    ingressAccuracyChart = new Chart(canvas.getContext('2d'), {
        type: 'line',
        data: {
            labels,
            datasets: [
                {
                    label: 'Accuracy',
                    data: accuracy,
                    borderColor: '#c23934',
                    backgroundColor: 'rgba(194, 57, 52, 0.1)',
                    borderWidth: 3,
                    tension: 0.4,
                    pointRadius: 4,
                    pointBackgroundColor: '#c23934',
                    fill: true
                },
                {
                    label: 'Threshold',
                    data: targets,
                    borderColor: '#2e844a',
                    borderDash: [5, 5],
                    borderWidth: 2,
                    pointRadius: 0
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: {
                    min: 0,
                    max: 100,
                    ticks: { callback: v => v + '%' }
                }
            }
        }
    });
}

// Global reference for MTTD/MTTR chart
let mttdMttrTrendChart = null;
let fitTrendChart = null;
let chaosExecutionChart = null;

/**
 * Initialize MTTD/MTTR Trend Chart using Chart.js
 */
function initMttdMttrTrendChart(monthlyData) {
    const canvas = document.getElementById('mttdMttrTrendChart');
    if (!canvas) {
        console.warn('⚠️ MTTD/MTTR chart canvas not found');
        return;
    }
    
    const ctx = canvas.getContext('2d');
    
    // Destroy existing chart if it exists
    if (mttdMttrTrendChart) {
        mttdMttrTrendChart.destroy();
    }
    
    mttdMttrTrendChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: monthlyData.labels,
            datasets: [
                {
                    label: 'MTTD (min)',
                    data: monthlyData.mttd,
                    borderColor: '#0176d3',
                    backgroundColor: 'rgba(1, 118, 211, 0.1)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4,
                    pointBackgroundColor: '#0176d3',
                    pointBorderColor: '#ffffff',
                    pointBorderWidth: 2,
                    pointRadius: 5,
                    pointHoverRadius: 8
                },
                {
                    label: 'MTTR (min)',
                    data: monthlyData.mttr,
                    borderColor: '#ec6a6a',
                    backgroundColor: 'rgba(236, 106, 106, 0.1)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4,
                    pointBackgroundColor: '#ec6a6a',
                    pointBorderColor: '#ffffff',
                    pointBorderWidth: 2,
                    pointRadius: 5,
                    pointHoverRadius: 8
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { intersect: false, mode: 'index' },
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: '#16325c',
                    titleColor: '#ffffff',
                    bodyColor: '#d8dde6',
                    borderColor: '#0176d3',
                    borderWidth: 1,
                    padding: 12,
                    callbacks: {
                        label: function(context) {
                            return context.dataset.label + ': ' + context.parsed.y + ' min';
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: { color: 'rgba(221, 219, 218, 0.6)', drawBorder: false },
                    ticks: { color: '#706e6b', font: { family: "'JetBrains Mono', monospace", size: 11 } }
                },
                y: {
                    beginAtZero: true,
                    grid: { color: 'rgba(221, 219, 218, 0.6)', drawBorder: false },
                    ticks: { 
                        color: '#706e6b', 
                        font: { family: "'JetBrains Mono', monospace", size: 11 },
                        callback: function(value) { return value + ' min'; }
                    }
                }
            }
        }
    });
    
    // Add tab switching functionality
    const tabButtons = document.querySelectorAll('.sla-chart-tab');
    tabButtons.forEach(btn => {
        btn.addEventListener('click', function() {
            // Remove active class from all tabs
            tabButtons.forEach(t => t.classList.remove('active'));
            // Add active class to clicked tab
            this.classList.add('active');
            
            const metric = this.dataset.metric;
            const datasets = mttdMttrTrendChart.data.datasets;
            
            if (metric === 'both') {
                datasets[0].hidden = false;
                datasets[1].hidden = false;
            } else if (metric === 'mttd') {
                datasets[0].hidden = false;
                datasets[1].hidden = true;
            } else if (metric === 'mttr') {
                datasets[0].hidden = true;
                datasets[1].hidden = false;
            }
            
            mttdMttrTrendChart.update();
        });
    });
    
    console.log('📊 MTTD/MTTR trend chart initialized');
}

/**
 * Render Service Impact Breakdown Table (Root Cause Analysis)
 */
function renderServiceImpactBreakdown(incidents) {
    const tbody = document.getElementById('rootCauseTableBody');
    if (!tbody) {
        console.warn('⚠️ rootCauseTableBody not found');
        return;
    }
    
    // Group incidents by impact category
    const impactGroups = {};
    incidents.forEach(inc => {
        const impact = inc.impact || 'Unknown';
        if (!impactGroups[impact]) {
            impactGroups[impact] = {
                category: impact,
                incidents: [],
                ttdSum: 0,
                ttrSum: 0,
                ttdCount: 0,
                ttrCount: 0,
                repeatCount: 0
            };
        }
        impactGroups[impact].incidents.push(inc);
        
        const ttd = parseFloat(inc.ttd_min) || 0;
        const ttr = parseFloat(inc.ttr_min) || 0;
        
        if (ttd > 0) {
            impactGroups[impact].ttdSum += ttd;
            impactGroups[impact].ttdCount++;
        }
        if (ttr > 0) {
            impactGroups[impact].ttrSum += ttr;
            impactGroups[impact].ttrCount++;
        }
        if (inc.repeat && inc.repeat.toLowerCase() === 'yes') {
            impactGroups[impact].repeatCount++;
        }
    });
    
    // Calculate averages and sort by count
    const totalIncidents = incidents.length;
    const rootCauseData = Object.values(impactGroups).map(g => ({
        category: g.category,
        count: g.incidents.length,
        pct: Math.round((g.incidents.length / totalIncidents) * 100),
        avgMttd: g.ttdCount > 0 ? Math.round(g.ttdSum / g.ttdCount) : 0,
        avgMttr: g.ttrCount > 0 ? Math.round(g.ttrSum / g.ttrCount) : 0,
        repeat: g.repeatCount
    })).sort((a, b) => b.count - a.count);
    
    tbody.innerHTML = rootCauseData.map(rc => {
        const repeatPct = rc.count > 0 ? Math.round((rc.repeat / rc.count) * 100) : 0;
        const repeatColor = repeatPct > 20 ? '#c23934' : repeatPct > 10 ? '#fe9339' : '#2e844a';
        return `<tr>
            <td style="font-weight: 600;">${rc.category}</td>
            <td class="mono align-center">${rc.count}</td>
            <td class="mono align-center">${rc.pct}%</td>
            <td class="mono align-center">${rc.avgMttd}<span style="font-size:11px;color:#706e6b;"> min</span></td>
            <td class="mono align-center">${rc.avgMttr}<span style="font-size:11px;color:#706e6b;"> min</span></td>
            <td class="mono align-center" style="color:${repeatColor};">${rc.repeat} <span style="font-size:11px;color:#706e6b;">(${repeatPct}%)</span></td>
        </tr>`;
    }).join('');
    
    console.log('✅ Service Impact Breakdown table rendered');
}

/**
 * Render Service Impact by Service Table
 */
function renderServiceImpactByService(incidents) {
    const tbody = document.getElementById('serviceRootCauseTableBody');
    if (!tbody) {
        console.warn('⚠️ serviceRootCauseTableBody not found');
        return;
    }
    
    // Define service colors
    const serviceColors = {
        'Vegacache': '#c23934',
        'MQ': '#fe9339',
        'Ingress': '#2e844a',
        'Mesh': '#1b96ff',
        'FKP': '#0176d3',
        'KRE-US': '#9050e9',
        'KRE-HYD': '#9050e9',
        'STRIDE': '#706e6b'
    };
    
    // Group incidents by service (prb_owner)
    const serviceGroups = {};
    incidents.forEach(inc => {
        const service = inc.prb_owner || 'Unknown';
        if (!serviceGroups[service]) {
            serviceGroups[service] = {
                name: service,
                incidents: [],
                ttdSum: 0,
                ttrSum: 0,
                ttdCount: 0,
                ttrCount: 0,
                repeatCount: 0,
                impacts: new Set()
            };
        }
        serviceGroups[service].incidents.push(inc);
        
        const ttd = parseFloat(inc.ttd_min) || 0;
        const ttr = parseFloat(inc.ttr_min) || 0;
        
        if (ttd > 0) {
            serviceGroups[service].ttdSum += ttd;
            serviceGroups[service].ttdCount++;
        }
        if (ttr > 0) {
            serviceGroups[service].ttrSum += ttr;
            serviceGroups[service].ttrCount++;
        }
        if (inc.repeat && inc.repeat.toLowerCase() === 'yes') {
            serviceGroups[service].repeatCount++;
        }
        
        // Categorize impact
        const impact = (inc.impact || '').toLowerCase();
        if (impact.includes('performance')) serviceGroups[service].impacts.add('Latency');
        if (impact.includes('disruption')) serviceGroups[service].impacts.add('Availability');
        if (impact.includes('feature') || impact.includes('degradation')) serviceGroups[service].impacts.add('Feature');
    });
    
    // Calculate metrics and determine severity
    const serviceData = Object.values(serviceGroups).map(g => {
        const avgDuration = g.ttdCount > 0 && g.ttrCount > 0 
            ? Math.round((g.ttdSum + g.ttrSum) / g.incidents.length) 
            : 0;
        
        // Determine severity
        let severity = 'Low';
        let severityColor = '#2e844a';
        if (g.incidents.length >= 15 || avgDuration > 1000) {
            severity = 'High';
            severityColor = '#c23934';
        } else if (g.incidents.length >= 10 || avgDuration > 500) {
            severity = 'Medium';
            severityColor = '#fe9339';
        }
        
        return {
            name: g.name,
            color: serviceColors[g.name] || '#706e6b',
            total: g.incidents.length,
            severity,
            severityColor,
            customerImpact: Array.from(g.impacts),
            avgDuration,
            repeat: g.repeatCount
        };
    }).sort((a, b) => b.total - a.total);
    
    const formatDuration = (minutes) => {
        const hours = Math.round(minutes / 60 * 10) / 10;
        return `${hours} hr`;
    };
    
    tbody.innerHTML = serviceData.map(s => {
        const repeatPct = s.total > 0 ? Math.round((s.repeat / s.total) * 100) : 0;
        const repeatColor = repeatPct > 20 ? '#c23934' : repeatPct > 10 ? '#fe9339' : '#2e844a';
        const customerImpactText = s.customerImpact.length > 0 ? s.customerImpact.join(' · ') : '-';
        const durationColor = s.avgDuration > 1000 ? '#c23934' : s.avgDuration > 500 ? '#fe9339' : '#3e3e3c';
        
        return `<tr>
            <td>
                <div class="sla-service-name">
                    <span class="sla-service-dot" style="background:${s.color}"></span>
                    ${s.name}
                </div>
            </td>
            <td class="mono align-center">${s.total}</td>
            <td class="align-center">
                <div style="display:flex;align-items:center;justify-content:center;gap:6px;">
                    <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${s.severityColor};"></span>
                    <span style="font-weight:500;">${s.severity}</span>
                </div>
            </td>
            <td style="color:#3e3e3c;font-size:13px;text-align:left;">${customerImpactText}</td>
            <td class="mono align-center" style="color:${durationColor};font-weight:500;">${formatDuration(s.avgDuration)}</td>
            <td class="mono align-center" style="color:${repeatColor};">${s.repeat}${repeatPct > 0 ? ` <span style="font-size:11px;color:#706e6b;">(${repeatPct}%)</span>` : ''}</td>
        </tr>`;
    }).join('');
    
    console.log('✅ Service Impact by Service table rendered');
}

/**
 * Render Incident Trend Chart with Monthly and Cumulative modes
 */
function renderAvailabilityIncidentTrend() {
    const container = document.getElementById('availability-incident-trend-chart');
    if (!container) return;
    
    // Use real data from monthly_trend.csv
    const monthlyTrend = availabilityData.monthlyTrend || [];
    
    if (monthlyTrend.length === 0) {
        container.innerHTML = '<div class="placeholder-message"><p>No trend data available</p></div>';
        return;
    }
    
    // Sort by month and extract data
    const sortedTrend = [...monthlyTrend].sort((a, b) => a.month.localeCompare(b.month));
    const months = sortedTrend.map(m => m.month_abbr || m.month);
    const sev0Raw = sortedTrend.map(m => parseInt(m.sev0_count || 0));
    const sev1Raw = sortedTrend.map(m => parseInt(m.sev1_count || 0));
    
    // Store original data for mode switching
    let currentMode = 'monthly';
    let sev0Data = [...sev0Raw];
    let sev1Data = [...sev1Raw];
    
    // Function to calculate cumulative sums
    function calculateCumulative(data) {
        let sum = 0;
        return data.map(val => {
            sum += val;
            return sum;
        });
    }
    
    // Function to create straight line path (not curves)
    function createLinePath(points) {
        if (points.length === 0) return '';
        if (points.length === 1) return `M ${points[0].x},${points[0].y}`;
        
        // Use straight lines connecting all points
        return `M ${points.map(p => `${p.x},${p.y}`).join(' L ')}`;
    }
    
    // Function to render chart
    function renderChart(mode) {
        currentMode = mode;
        
        // Calculate data based on mode
        if (mode === 'cumulative') {
            sev0Data = calculateCumulative(sev0Raw);
            sev1Data = calculateCumulative(sev1Raw);
        } else {
            sev0Data = [...sev0Raw];
            sev1Data = [...sev1Raw];
        }
        
        const maxValue = Math.max(...sev0Data, ...sev1Data, 12);
        const chartHeight = 250;
        const chartWidth = 800;
        const paddingTop = 20;
        const paddingBottom = 30;
        const paddingLeft = 0; // No left padding - expand to edge
        const paddingRight = 0; // No right padding - expand to edge
        const plotWidth = chartWidth;
        const plotHeight = chartHeight - paddingTop - paddingBottom;
        
        // Calculate points (expanded to edges)
        // Ensure values never go below zero (data is always positive)
        const baselineY = paddingTop + plotHeight;
        const points0 = sev0Data.map((val, i) => {
            const normalizedVal = Math.max(0, val); // Ensure never negative
            const y = baselineY - (normalizedVal / maxValue) * plotHeight;
            return {
                x: (i / (months.length - 1)) * plotWidth,
                y: Math.min(baselineY, Math.max(paddingTop, y)), // Clamp between top and baseline
                value: normalizedVal,
                month: months[i]
            };
        });
        
        const points1 = sev1Data.map((val, i) => {
            const normalizedVal = Math.max(0, val); // Ensure never negative
            const y = baselineY - (normalizedVal / maxValue) * plotHeight;
            return {
                x: (i / (months.length - 1)) * plotWidth,
                y: Math.min(baselineY, Math.max(paddingTop, y)), // Clamp between top and baseline
                value: normalizedVal,
                month: months[i]
            };
        });
        
        // Create straight line paths (not curves)
        const path0 = createLinePath(points0);
        const path1 = createLinePath(points1);
        
        // Create area fill paths (fill to baseline, never below)
        // baselineY already declared above
        const areaPath0 = `${path0} L ${plotWidth},${baselineY} L 0,${baselineY} Z`;
        const areaPath1 = `${path1} L ${plotWidth},${baselineY} L 0,${baselineY} Z`;
        
        // Calculate Y-axis tick values
        const yTicks = [];
        const tickCount = 6;
        for (let i = 0; i <= tickCount; i++) {
            yTicks.push((maxValue / tickCount) * i);
        }
        
        container.innerHTML = `
            <svg viewBox="0 0 ${chartWidth} ${chartHeight}" style="width: 100%; height: 100%;" id="availability-trend-svg">
                <defs>
                    <linearGradient id="sev0Gradient" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" style="stop-color:#ef4444;stop-opacity:0.3" />
                        <stop offset="100%" style="stop-color:#ef4444;stop-opacity:0.05" />
                    </linearGradient>
                    <linearGradient id="sev1Gradient" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" style="stop-color:#f59e0b;stop-opacity:0.3" />
                        <stop offset="100%" style="stop-color:#f59e0b;stop-opacity:0.05" />
                    </linearGradient>
                    <filter id="shadow">
                        <feDropShadow dx="0" dy="2" stdDeviation="2" flood-opacity="0.1"/>
                    </filter>
                    <!-- Clip path to prevent curves from going below baseline -->
                    <clipPath id="chartClip">
                        <rect x="0" y="${paddingTop}" width="${plotWidth}" height="${plotHeight}" />
                    </clipPath>
                </defs>
                <!-- Grid lines -->
                ${yTicks.map(val => {
                    const y = paddingTop + plotHeight - (val / maxValue) * plotHeight;
                    return `<line x1="0" y1="${y}" x2="${plotWidth}" y2="${y}" stroke="#e2e8f0" stroke-width="1" />`;
                }).join('')}
                <!-- Area fills (clipped to prevent going below baseline) -->
                <path d="${areaPath1}" fill="url(#sev1Gradient)" clip-path="url(#chartClip)" />
                <path d="${areaPath0}" fill="url(#sev0Gradient)" clip-path="url(#chartClip)" />
                <!-- Lines (clipped to prevent going below baseline) -->
                <path d="${path1}" fill="none" stroke="#f59e0b" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" filter="url(#shadow)" clip-path="url(#chartClip)" />
                <path d="${path0}" fill="none" stroke="#ef4444" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" filter="url(#shadow)" clip-path="url(#chartClip)" />
                <!-- Data points with hover areas -->
                ${points0.map((p, i) => `
                    <g class="data-point-group" data-index="${i}" data-type="sev0">
                        <circle cx="${p.x}" cy="${p.y}" r="5" fill="#ef4444" stroke="white" stroke-width="2" class="data-point" />
                        <circle cx="${p.x}" cy="${p.y}" r="15" fill="transparent" class="hover-area" style="cursor: pointer;" />
                    </g>
                `).join('')}
                ${points1.map((p, i) => `
                    <g class="data-point-group" data-index="${i}" data-type="sev1">
                        <circle cx="${p.x}" cy="${p.y}" r="5" fill="#f59e0b" stroke="white" stroke-width="2" class="data-point" />
                        <circle cx="${p.x}" cy="${p.y}" r="15" fill="transparent" class="hover-area" style="cursor: pointer;" />
                    </g>
                `).join('')}
                <!-- X-axis labels -->
                ${months.map((m, i) => {
                    const x = (i / (months.length - 1)) * plotWidth;
                    return `<text x="${x}" y="${chartHeight - 5}" text-anchor="middle" font-size="11" fill="#64748b" font-weight="500">${m}</text>`;
                }).join('')}
                <!-- Y-axis labels -->
                ${yTicks.map(val => {
                    const y = paddingTop + plotHeight - (val / maxValue) * plotHeight;
                    return `<text x="5" y="${y + 4}" font-size="11" fill="#64748b" font-weight="500">${Math.round(val)}</text>`;
                }).join('')}
                <!-- Tooltip (hidden by default) -->
                <g id="tooltip" style="display: none; pointer-events: none;">
                    <rect id="tooltip-bg" x="0" y="0" width="120" height="60" rx="4" fill="rgba(0,0,0,0.8)" />
                    <text id="tooltip-month" x="10" y="20" font-size="12" fill="white" font-weight="600"></text>
                    <text id="tooltip-sev0" x="10" y="35" font-size="11" fill="#ef4444"></text>
                    <text id="tooltip-sev1" x="10" y="50" font-size="11" fill="#f59e0b"></text>
                </g>
            </svg>
        `;
        
        // Add event listeners for tooltips
        const svg = container.querySelector('#availability-trend-svg');
        const tooltip = svg.querySelector('#tooltip');
        const tooltipBg = svg.querySelector('#tooltip-bg');
        const tooltipMonth = svg.querySelector('#tooltip-month');
        const tooltipSev0 = svg.querySelector('#tooltip-sev0');
        const tooltipSev1 = svg.querySelector('#tooltip-sev1');
        const hoverAreas = svg.querySelectorAll('.hover-area');
        
        hoverAreas.forEach(area => {
            const group = area.parentElement;
            const index = parseInt(group.getAttribute('data-index'));
            const type = group.getAttribute('data-type');
            const point = type === 'sev0' ? points0[index] : points1[index];
            
            area.addEventListener('mousemove', (e) => {
                // Get SVG coordinates from mouse position
                const svgRect = svg.getBoundingClientRect();
                const scaleX = chartWidth / svgRect.width;
                const scaleY = chartHeight / svgRect.height;
                const mouseX = (e.clientX - svgRect.left) * scaleX;
                const mouseY = (e.clientY - svgRect.top) * scaleY;
                
                // Get both values for this month
                const sev0Val = sev0Data[index];
                const sev1Val = sev1Data[index];
                const month = months[index];
                
                // Update tooltip content
                tooltipMonth.textContent = month;
                tooltipSev0.textContent = `Sev0: ${sev0Val}`;
                tooltipSev1.textContent = `Sev1: ${sev1Val}`;
                
                // Position tooltip near the data point
                const tooltipWidth = 120;
                const tooltipHeight = 60;
                let tooltipX = point.x + 15;
                let tooltipY = point.y - tooltipHeight - 15;
                
                // Keep tooltip within bounds
                if (tooltipX + tooltipWidth > chartWidth) {
                    tooltipX = point.x - tooltipWidth - 15;
                }
                if (tooltipY < 0) {
                    tooltipY = point.y + 15;
                }
                if (tooltipX < 0) {
                    tooltipX = 5;
                }
                
                tooltip.setAttribute('transform', `translate(${tooltipX}, ${tooltipY})`);
                tooltip.style.display = 'block';
            });
            
            area.addEventListener('mouseleave', () => {
                tooltip.style.display = 'none';
            });
        });
    }
    
    // Initial render with monthly mode
    renderChart('monthly');
    
    // Add button click handlers
    const buttons = document.querySelectorAll('.chart-controls .chart-btn');
    buttons.forEach(btn => {
        btn.addEventListener('click', () => {
            buttons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const mode = btn.getAttribute('data-mode');
            renderChart(mode);
        });
    });
}

function openAvailabilityReadinessDeveloperView() {
    switchViewMode('developer');
    switchTab('runtime-availability-readiness');
}

function openAvailabilityReadinessExecView() {
    switchViewMode('exec');
    switchTab('runtime-availability-detection');
    scrollToTabContent('runtime-availability-detection');
}

function openAvailabilityDetectionExecView() {
    switchViewMode('exec');
    switchTab('runtime-availability-detection');
    scrollToTabContent('runtime-availability-detection');
}

function openAvailabilityPreventionExecView() {
    availabilityData.preventionDevPendingDrill = false;
    availabilityData.preventionDevEntry = 'nav';
    availabilityData.preventionDevShowDetails = false;
    availabilityData.inventoryTestTypeFilter = '';
    availabilityData.inventoryProductFilter = 'all';
    availabilityData.integrationFitMonthFilter = '';
    inventoryActiveTab = '';
    switchViewMode('exec');
    switchTab('runtime-availability-prevention');
    scrollToTabContent('runtime-availability-prevention');
}

function showCardDetail(cardKey) {
    const modal = document.getElementById('availability-readiness-modal');
    const titleEl = document.getElementById('availability-readiness-modal-title');
    const bodyEl = document.getElementById('availability-readiness-modal-body');
    if (!modal || !titleEl || !bodyEl) return;
    
    if (cardKey === 'criticalCoverage') {
        const coverageContent = buildCriticalCoverageModal();
        titleEl.textContent = coverageContent.title;
        bodyEl.innerHTML = coverageContent.body;
    } else if (cardKey === 'fitSuccess') {
        const fitContent = buildFitSuccessInventoryModal();
        titleEl.textContent = fitContent.title;
        bodyEl.innerHTML = fitContent.body;
    } else {
        const details = {
            chaosAdoption: {
                title: 'Chaos Test Adoption',
                body: 'Percentage of services with Chaos Tests enabled (yes or partial).'
            },
            incidentsAvoided: {
                title: 'Incidents Avoided',
                body: 'Hardcoded placeholder until incident avoidance calculation is defined.'
            },
            testMTTR: {
                title: 'Test MTTR',
                body: 'Hardcoded placeholder until test MTTR calculation is defined.'
            },
            incidentsAvoidedImpact: {
                title: 'Sev0/Sev1 Incidents Avoided',
                body: 'Business impact of preventive testing on Sev0/Sev1 incidents.'
            },
            serviceHealth: {
                title: 'Service Health Score',
                body: 'Composite readiness score for preventive coverage.'
            },
            customerImpact: {
                title: 'Customer Impact Hours Avoided',
                body: 'Estimated customer impact hours avoided through preventive testing.'
            },
            releaseConfidence: {
                title: 'Release Confidence Score',
                body: 'Confidence score derived from preventive test coverage.'
            }
        };
        
        if (cardKey === 'chaosAdoption') {
            const chaosContent = buildChaosAdoptionModal();
            titleEl.textContent = chaosContent.title;
            bodyEl.innerHTML = chaosContent.body;
        } else if (cardKey === 'incidentsAvoided') {
            const avoidedContent = buildIncidentsAvoidedModal();
            titleEl.textContent = avoidedContent.title;
            bodyEl.innerHTML = avoidedContent.body;
        } else if (cardKey === 'testMTTR') {
            const mttrContent = buildTestMttrModal();
            titleEl.textContent = mttrContent.title;
            bodyEl.innerHTML = mttrContent.body;
        } else if (cardKey === 'serviceHealth') {
            const healthContent = buildServiceHealthModal();
            titleEl.textContent = healthContent.title;
            bodyEl.innerHTML = healthContent.body;
        } else if (cardKey === 'customerImpact') {
            const impactContent = buildCustomerImpactModal();
            titleEl.textContent = impactContent.title;
            bodyEl.innerHTML = impactContent.body;
        } else if (cardKey === 'releaseConfidence') {
            const releaseContent = buildReleaseConfidenceModal();
            titleEl.textContent = releaseContent.title;
            bodyEl.innerHTML = releaseContent.body;
        } else {
            const detail = details[cardKey] || { title: 'Card Details', body: 'Details not available.' };
            titleEl.textContent = detail.title;
            bodyEl.innerHTML = `<div class="modal-text">${detail.body}</div>`;
        }
    }
    
    modal.style.display = 'block';
}

function closeAvailabilityReadinessModal(event) {
    const modal = document.getElementById('availability-readiness-modal');
    if (!modal) return;
    if (event && event.target && event.target !== modal) {
        return;
    }
    modal.style.display = 'none';
}

function openFitSuccessMonthlyModal() {
    let modal = document.getElementById('availability-readiness-modal');
    if (!modal) {
        document.body.insertAdjacentHTML('beforeend', `
            <div class="modal" id="availability-readiness-modal" onclick="closeAvailabilityReadinessModal(event)">
                <div class="modal-content" onclick="event.stopPropagation()">
                    <div class="modal-header">
                        <h3 id="availability-readiness-modal-title">Card Details</h3>
                        <button class="modal-close" onclick="closeAvailabilityReadinessModal()">&times;</button>
                    </div>
                    <div class="modal-body" id="availability-readiness-modal-body">
                        <div class="modal-text">Select a card to view details.</div>
                    </div>
                </div>
            </div>
        `);
        modal = document.getElementById('availability-readiness-modal');
    }
    const titleEl = document.getElementById('availability-readiness-modal-title');
    const bodyEl = document.getElementById('availability-readiness-modal-body');
    if (!modal || !titleEl || !bodyEl) return;
    
    const monthlyContent = buildFitSuccessMonthlyModal();
    titleEl.textContent = monthlyContent.title;
    bodyEl.innerHTML = monthlyContent.body;
    modal.style.display = 'block';
}

function openChaosExecutionMonthlyModal() {
    let modal = document.getElementById('availability-readiness-modal');
    if (!modal) {
        document.body.insertAdjacentHTML('beforeend', `
            <div class="modal" id="availability-readiness-modal" onclick="closeAvailabilityReadinessModal(event)">
                <div class="modal-content" onclick="event.stopPropagation()">
                    <div class="modal-header">
                        <h3 id="availability-readiness-modal-title">Card Details</h3>
                        <button class="modal-close" onclick="closeAvailabilityReadinessModal()">&times;</button>
                    </div>
                    <div class="modal-body" id="availability-readiness-modal-body">
                        <div class="modal-text">Select a card to view details.</div>
                    </div>
                </div>
            </div>
        `);
        modal = document.getElementById('availability-readiness-modal');
    }
    const titleEl = document.getElementById('availability-readiness-modal-title');
    const bodyEl = document.getElementById('availability-readiness-modal-body');
    if (!modal || !titleEl || !bodyEl) return;
    
    const chaosContent = buildChaosExecutionMonthlyModal();
    titleEl.textContent = chaosContent.title;
    bodyEl.innerHTML = chaosContent.body;
    modal.style.display = 'block';
}

function buildCriticalCoverageModal() {
    const rows = availabilityData.serviceReadiness || [];
    const serviceRows = rows.filter(row => (row.Service || '').toLowerCase() !== 'total');
    const totalServices = serviceRows.length || 0;
    
    const tableRows = serviceRows.map(row => {
        const service = row.Service || 'Unknown';
        const statusRaw = row['E2E Critical FIT'] || '';
        const status = normalizeReadinessStatus(statusRaw);
        const isCounted = status === 'complete' || status === 'partial';
        const countedLabel = isCounted ? 'Yes (1)' : 'No (0)';
        const countedClass = isCounted ? 'counted-yes' : 'counted-no';
        
        const notesByStatus = {
            planned: 'Planned but not yet implemented',
            complete: 'E2E Critical FIT implemented',
            missing: 'No E2E Critical FIT',
            partial: 'Partial E2E Critical FIT implementation'
        };
        
        const notes = notesByStatus[status] || 'Status not available';
        const statusLabel = statusRaw ? statusRaw.charAt(0).toUpperCase() + statusRaw.slice(1) : 'N/A';
        
        return `
            <tr>
                <td>${service}</td>
                <td><span class="status-pill ${status}">${statusLabel}</span></td>
                <td><span class="counted-pill ${countedClass}">${countedLabel}</span></td>
                <td>${notes}</td>
            </tr>
        `;
    }).join('');
    
    const countedTotal = serviceRows.filter(row => {
        const status = normalizeReadinessStatus(row['E2E Critical FIT']);
        return status === 'complete' || status === 'partial';
    }).length;
    
    const percent = totalServices ? (countedTotal / totalServices) * 100 : 0;
    const percentRounded = Math.round(percent);
    const percentDisplay = percent.toFixed(2);
    
    return {
        title: 'Critical Test Coverage Details',
        body: `
            <div class="critical-coverage-modal">
                <table class="availability-modal-table">
                    <thead>
                        <tr>
                            <th>Service</th>
                            <th>E2E Critical FIT Status</th>
                            <th>Counted</th>
                            <th>Notes</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${tableRows || `<tr><td colspan="4" class="empty-state">No readiness data available</td></tr>`}
                    </tbody>
                </table>
                <div class="modal-summary">
                    Calculation: ${countedTotal} out of ${totalServices} services = ${percentDisplay}% ≈ ${percentRounded}%
                </div>
            </div>
        `
    };
}

function buildFitSuccessInventoryModal() {
    return {
        title: 'FIT Success Rate — Service Inventory (Last 30 Days)',
        body: `
            <div class="fit-modal">
                <table class="availability-modal-table">
                    <thead>
                        <tr>
                            <th>Service</th>
                            <th>Pre-Deployment FIT</th>
                            <th>Post-Deployment FIT</th>
                            <th>Total Tests (30d)</th>
                            <th>Successful</th>
                            <th>Failed</th>
                            <th>Success Rate</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>FKP</td>
                            <td><span class="fit-status complete">✓ Yes</span></td>
                            <td><span class="fit-status complete">✓ Yes</span></td>
                            <td>28</td>
                            <td>27</td>
                            <td>1</td>
                            <td class="fit-rate">96.4%</td>
                        </tr>
                        <tr>
                            <td>Vegacache</td>
                            <td><span class="fit-status partial">◑ Partial</span></td>
                            <td><span class="fit-status complete">✓ Yes</span></td>
                            <td>25</td>
                            <td>24</td>
                            <td>1</td>
                            <td class="fit-rate">96.0%</td>
                        </tr>
                        <tr>
                            <td>MQ</td>
                            <td><span class="fit-status partial">◑ Partial</span></td>
                            <td><span class="fit-status complete">✓ Yes</span></td>
                            <td>22</td>
                            <td>21</td>
                            <td>1</td>
                            <td class="fit-rate">95.5%</td>
                        </tr>
                        <tr>
                            <td>MAPS</td>
                            <td><span class="fit-status partial">◑ Partial</span></td>
                            <td><span class="fit-status complete">✓ Yes</span></td>
                            <td>20</td>
                            <td>19</td>
                            <td>1</td>
                            <td class="fit-rate">95.0%</td>
                        </tr>
                        <tr>
                            <td>Ingress</td>
                            <td><span class="fit-status missing">✕ No</span></td>
                            <td><span class="fit-status complete">✓ Yes</span></td>
                            <td>18</td>
                            <td>17</td>
                            <td>1</td>
                            <td class="fit-rate">94.4%</td>
                        </tr>
                        <tr>
                            <td>Mesh</td>
                            <td><span class="fit-status missing">✕ No</span></td>
                            <td><span class="fit-status complete">✓ Yes</span></td>
                            <td>12</td>
                            <td>10</td>
                            <td>2</td>
                            <td class="fit-rate low">83.3%</td>
                        </tr>
                    </tbody>
                </table>
                <div class="modal-summary">
                    Total (All Services): 125 tests, 118 successful, 7 failed = 94.2% success rate
                </div>
            </div>
        `
    };
}

function buildFitSuccessMonthlyModal() {
    return {
        title: 'FIT Success Rate — Monthly Breakdown (Last 6 Months)',
        body: `
            <div class="fit-modal">
                <table class="availability-modal-table">
                    <thead>
                        <tr>
                            <th>Month</th>
                            <th>Success Rate</th>
                            <th>Total Tests</th>
                            <th>Successful</th>
                            <th>Failed</th>
                            <th>Target</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>August 2025</td>
                            <td class="fit-rate low">87.5%</td>
                            <td>100</td>
                            <td>87</td>
                            <td>13</td>
                            <td>95%</td>
                        </tr>
                        <tr>
                            <td>September 2025</td>
                            <td class="fit-rate">89.2%</td>
                            <td>105</td>
                            <td>94</td>
                            <td>11</td>
                            <td>95%</td>
                        </tr>
                        <tr>
                            <td>October 2025</td>
                            <td class="fit-rate">91.0%</td>
                            <td>110</td>
                            <td>100</td>
                            <td>10</td>
                            <td>95%</td>
                        </tr>
                        <tr>
                            <td>November 2025</td>
                            <td class="fit-rate">92.1%</td>
                            <td>115</td>
                            <td>106</td>
                            <td>9</td>
                            <td>95%</td>
                        </tr>
                        <tr>
                            <td>December 2025</td>
                            <td class="fit-rate">93.8%</td>
                            <td>120</td>
                            <td>113</td>
                            <td>7</td>
                            <td>95%</td>
                        </tr>
                        <tr>
                            <td>January 2026</td>
                            <td class="fit-rate">94.2%</td>
                            <td>125</td>
                            <td>118</td>
                            <td>7</td>
                            <td>95%</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        `
    };
}

function buildChaosAdoptionModal() {
    return {
        title: 'Chaos Test Adoption — Service Breakdown',
        body: `
            <div class="fit-modal">
                <table class="availability-modal-table">
                    <thead>
                        <tr>
                            <th>Service</th>
                            <th>Chaos Tests Status</th>
                            <th>Value</th>
                            <th>Notes</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>Mesh</td>
                            <td><span class="fit-status complete">Yes</span></td>
                            <td>1</td>
                            <td>Chaos tests active</td>
                        </tr>
                        <tr>
                            <td>Ingress</td>
                            <td><span class="fit-status complete">Yes</span></td>
                            <td>1</td>
                            <td>Chaos tests active</td>
                        </tr>
                        <tr>
                            <td>FKP</td>
                            <td><span class="fit-status complete">Yes</span></td>
                            <td>1</td>
                            <td>Chaos tests active</td>
                        </tr>
                        <tr>
                            <td>Vegacache</td>
                            <td><span class="fit-status complete">Yes</span></td>
                            <td>1</td>
                            <td>Chaos tests active</td>
                        </tr>
                        <tr>
                            <td>MQ</td>
                            <td><span class="fit-status complete">Yes</span></td>
                            <td>1</td>
                            <td>Chaos tests active</td>
                        </tr>
                        <tr>
                            <td>MAPS</td>
                            <td><span class="fit-status complete">Yes</span></td>
                            <td>1</td>
                            <td>Chaos tests active</td>
                        </tr>
                    </tbody>
                </table>
                <div class="modal-summary">
                    Result: 6 out of 6 services = 100%
                </div>
            </div>
        `
    };
}

function buildChaosExecutionMonthlyModal() {
    return {
        title: 'Chaos Test Execution - Monthly Breakdown (Last 6 Months)',
        body: `
            <div class="fit-modal">
                <table class="availability-modal-table">
                    <thead>
                        <tr>
                            <th>Month</th>
                            <th>Tests Executed</th>
                            <th>Findings/Issues</th>
                            <th>Total Services Tested</th>
                            <th>Success Rate</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>August 2025</td>
                            <td>3</td>
                            <td>1</td>
                            <td>6</td>
                            <td class="fit-rate low">66.7%</td>
                        </tr>
                        <tr>
                            <td>September 2025</td>
                            <td>4</td>
                            <td>2</td>
                            <td>6</td>
                            <td class="fit-rate low">50.0%</td>
                        </tr>
                        <tr>
                            <td>October 2025</td>
                            <td>5</td>
                            <td>1</td>
                            <td>6</td>
                            <td class="fit-rate">80.0%</td>
                        </tr>
                        <tr>
                            <td>November 2025</td>
                            <td>4</td>
                            <td>0</td>
                            <td>6</td>
                            <td class="fit-rate">100.0%</td>
                        </tr>
                        <tr>
                            <td>December 2025</td>
                            <td>5</td>
                            <td>2</td>
                            <td>6</td>
                            <td class="fit-rate">60.0%</td>
                        </tr>
                        <tr>
                            <td>January 2026</td>
                            <td>6</td>
                            <td>1</td>
                            <td>6</td>
                            <td class="fit-rate">83.3%</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        `
    };
}

function buildIncidentsAvoidedModal() {
    return {
        title: 'Incidents Avoided — Summary (11 Months)',
        body: `
            <div class="fit-modal">
                <table class="availability-modal-table">
                    <thead>
                        <tr>
                            <th>Metric</th>
                            <th>Value</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>Total Estimated Avoided</td>
                            <td>3 incidents</td>
                        </tr>
                        <tr>
                            <td>Sev0 Avoided</td>
                            <td>1</td>
                        </tr>
                        <tr>
                            <td>Sev1 Avoided</td>
                            <td>2</td>
                        </tr>
                        <tr>
                            <td>Incident Rate Reduction</td>
                            <td>12%</td>
                        </tr>
                    </tbody>
                </table>
                <div class="modal-summary">
                    Period: 11 months (Mar 2025 - Jan 2026)
                </div>
            </div>
        `
    };
}

function buildTestMttrModal() {
    return {
        title: 'Test MTTR — Monthly Breakdown (Last 6 Months)',
        body: `
            <div class="fit-modal">
                <table class="availability-modal-table">
                    <thead>
                        <tr>
                            <th>Month</th>
                            <th>Test MTTR (Hours)</th>
                            <th>Test MTTR (Minutes)</th>
                            <th>Total Failures</th>
                            <th>Avg Recovery (min)</th>
                            <th>Improvement</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>August 2025</td>
                            <td>5.5</td>
                            <td>330</td>
                            <td>10</td>
                            <td>33.0</td>
                            <td>Baseline</td>
                        </tr>
                        <tr>
                            <td>September 2025</td>
                            <td>5.2</td>
                            <td>312</td>
                            <td>8</td>
                            <td>39.0</td>
                            <td>-0.3 hrs</td>
                        </tr>
                        <tr>
                            <td>October 2025</td>
                            <td>4.8</td>
                            <td>288</td>
                            <td>6</td>
                            <td>48.0</td>
                            <td>-0.7 hrs</td>
                        </tr>
                        <tr>
                            <td>November 2025</td>
                            <td>4.6</td>
                            <td>276</td>
                            <td>5</td>
                            <td>55.2</td>
                            <td>-0.9 hrs</td>
                        </tr>
                        <tr>
                            <td>December 2025</td>
                            <td>4.4</td>
                            <td>264</td>
                            <td>4</td>
                            <td>66.0</td>
                            <td>-1.1 hrs</td>
                        </tr>
                        <tr>
                            <td>January 2026</td>
                            <td>4.2</td>
                            <td>252</td>
                            <td>3</td>
                            <td>84.0</td>
                            <td>-1.3 hrs</td>
                        </tr>
                    </tbody>
                </table>
                <div class="modal-summary">
                    Calculation: Test MTTR (Hours) = Test MTTR (Minutes) / 60<br>
                    Avg Recovery Calculation: Test MTTR (Minutes) / Total Failures
                </div>
            </div>
        `
    };
}

function buildServiceHealthModal() {
    return {
        title: 'Service Health Score — Components',
        body: `
            <div class="fit-modal">
                <table class="availability-modal-table">
                    <thead>
                        <tr>
                            <th>Component</th>
                            <th>Weight</th>
                            <th>Score</th>
                            <th>Contribution</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>Test Coverage</td>
                            <td>30%</td>
                            <td>67%</td>
                            <td>20.1%</td>
                        </tr>
                        <tr>
                            <td>Incident Rate</td>
                            <td>25%</td>
                            <td>88%</td>
                            <td>22.0%</td>
                        </tr>
                        <tr>
                            <td>MTTD Performance</td>
                            <td>20%</td>
                            <td>95%</td>
                            <td>19.0%</td>
                        </tr>
                        <tr>
                            <td>MTTR Performance</td>
                            <td>15%</td>
                            <td>90%</td>
                            <td>13.5%</td>
                        </tr>
                        <tr>
                            <td>Service Reliability</td>
                            <td>10%</td>
                            <td>95%</td>
                            <td>9.5%</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        `
    };
}

function buildCustomerImpactModal() {
    return {
        title: 'Customer Impact Hours Avoided — Breakdown',
        body: `
            <div class="fit-modal">
                <table class="availability-modal-table">
                    <thead>
                        <tr>
                            <th>Category</th>
                            <th>Incidents Avoided</th>
                            <th>Avg Impact Hours</th>
                            <th>Total Hours Avoided</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>Sev0 Incidents</td>
                            <td>1</td>
                            <td>42</td>
                            <td>42</td>
                        </tr>
                        <tr>
                            <td>Sev1 Incidents</td>
                            <td>2</td>
                            <td>42.5</td>
                            <td>85</td>
                        </tr>
                    </tbody>
                </table>
                <div class="modal-summary">
                    Total: 42 + 85 = 127 customer impact hours avoided
                </div>
            </div>
        `
    };
}

function buildReleaseConfidenceModal() {
    return {
        title: 'Release Confidence Score — Components',
        body: `
            <div class="fit-modal">
                <table class="availability-modal-table">
                    <thead>
                        <tr>
                            <th>Component</th>
                            <th>Weight</th>
                            <th>Score</th>
                            <th>Contribution</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>Pre-Deployment FIT Coverage</td>
                            <td>35%</td>
                            <td>83%</td>
                            <td>29.1%</td>
                        </tr>
                        <tr>
                            <td>FIT Success Rate</td>
                            <td>30%</td>
                            <td>94%</td>
                            <td>28.2%</td>
                        </tr>
                        <tr>
                            <td>E2E Test Coverage</td>
                            <td>20%</td>
                            <td>67%</td>
                            <td>13.4%</td>
                        </tr>
                        <tr>
                            <td>Historical Release Success</td>
                            <td>15%</td>
                            <td>95%</td>
                            <td>14.3%</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        `
    };
}

function getLatestIncidentDate(incidents) {
    let latest = null;
    incidents.forEach(inc => {
        const date = new Date(inc.detected_date);
        if (!Number.isNaN(date.getTime())) {
            if (!latest || date > latest) {
                latest = date;
            }
        }
    });
    return latest || new Date();
}

function formatDetectedMonth(date) {
    return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

function formatDetectedDate(date) {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function initFitTrendChart(canvasId = 'fitTrendChart') {
    const canvas = document.getElementById(canvasId);
    if (!canvas || typeof Chart === 'undefined') return;
    const ctx = canvas.getContext('2d');
    
    if (fitTrendChart) {
        fitTrendChart.destroy();
    }
    
    fitTrendChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: ['Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan'],
            datasets: [
                {
                    label: 'FIT Success Rate',
                    data: [87.5, 89.2, 91.0, 92.1, 93.8, 94.2],
                    borderColor: '#2e844a',
                    backgroundColor: 'rgba(46, 132, 74, 0.1)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4,
                    pointBackgroundColor: '#2e844a',
                    pointBorderColor: '#ffffff',
                    pointBorderWidth: 2,
                    pointRadius: 5
                },
                {
                    label: 'Target (95%)',
                    data: [95, 95, 95, 95, 95, 95],
                    borderColor: '#c23934',
                    borderWidth: 2,
                    borderDash: [5, 5],
                    pointRadius: 0,
                    fill: false
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: true, position: 'top' }
            },
            scales: {
                y: {
                    min: 80,
                    max: 100,
                    ticks: { callback: v => v + '%' }
                }
            }
        }
    });
}

function initChaosExecutionChart(canvasId = 'chaosChart') {
    const canvas = document.getElementById(canvasId);
    if (!canvas || typeof Chart === 'undefined') return;
    const ctx = canvas.getContext('2d');
    
    if (chaosExecutionChart) {
        chaosExecutionChart.destroy();
    }
    
    chaosExecutionChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan'],
            datasets: [
                {
                    label: 'Chaos Tests Executed',
                    data: [3, 4, 5, 4, 5, 6],
                    backgroundColor: 'rgba(1, 118, 211, 0.7)',
                    borderColor: '#0176d3',
                    borderWidth: 1,
                    borderRadius: 6
                },
                {
                    label: 'Findings/Issues',
                    data: [1, 2, 1, 0, 2, 1],
                    backgroundColor: 'rgba(254, 147, 57, 0.7)',
                    borderColor: '#fe9339',
                    borderWidth: 1,
                    borderRadius: 6
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: true, position: 'top' }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { precision: 0 }
                }
            }
        }
    });
}

/**
 * Render MTTD and MTTR by Service charts
 */
function renderAvailabilityServiceMetrics(serviceMetrics) {
    const mttdContainer = document.getElementById('availability-mttd-chart');
    const mttrContainer = document.getElementById('availability-mttr-chart');
    
    if (mttdContainer) {
        renderServiceMetricChart(mttdContainer, serviceMetrics, 'mttd', 10, 5);
    }
    
    if (mttrContainer) {
        renderServiceMetricChart(mttrContainer, serviceMetrics, 'mttr', 60, 30);
    }
}

function renderServiceMetricChart(container, serviceMetrics, metricType, sev1Target, sev0Target) {
    // Calculate max value for scaling (use sev1Target * 1.5 to ensure bars don't fill entire width)
    const maxValue = Math.max(...serviceMetrics.map(s => s[metricType]), sev1Target * 1.5);
    
    const bars = serviceMetrics.map((service, i) => {
        const value = service[metricType];
        const percentage = Math.min((value / maxValue) * 100, 100);
        
        // Status logic: Green < sev0Target, Orange >= sev0Target && <= sev1Target, Red > sev1Target
        let status, color, icon, iconColor;
        if (value < sev0Target) {
            status = 'good';
            color = '#22c55e';
            icon = '✓';
            iconColor = '#16a34a';
        } else if (value <= sev1Target) {
            status = 'warning';
            color = '#f59e0b';
            icon = '⚠';
            iconColor = '#d97706';
        } else {
            status = 'bad';
            color = '#ef4444';
            icon = '✗';
            iconColor = '#dc2626';
        }
        
        // Calculate percentage for thin bar (like mobile completion bars)
        // Use a reasonable max value for scaling (not the actual maxValue which might be too high)
        const barMaxValue = metricType === 'mttd' ? 12 : 80;
        const barPercentage = Math.min((value / barMaxValue) * 100, 100);
        
        return `
            <div class="service-metric-bar-row">
                <div class="service-metric-label">${service.service}</div>
                <div class="service-metric-bar-wrapper">
                    <div class="service-metric-bar" style="width: ${barPercentage}%; background: linear-gradient(135deg, ${color} 0%, ${color}dd 100%);"></div>
                </div>
                <div class="service-metric-value" style="color: ${color}; font-weight: 600;">${value.toFixed(1)} min</div>
                <div class="service-metric-icon" style="color: ${iconColor};">${icon}</div>
            </div>
        `;
    }).join('');
    
    container.innerHTML = bars;
}

/**
 * Render Observability Coverage Matrix
 */
function renderAvailabilityCoverageMatrix() {
    const container = document.getElementById('availability-coverage-matrix');
    if (!container) return;
    
    // Use real data from services.csv
    const services = availabilityData.services || [];
    
    if (services.length === 0) {
        container.innerHTML = '<div class="placeholder-message"><p>No coverage data available</p></div>';
        return;
    }
    
    // Map services data to coverage matrix format
    const coverageData = services.map(row => {
        let serviceName = row.name || row.id;
        // Rename "Vega Cache" to "Vegacache" (one word)
        if (serviceName === 'Vega Cache') {
            serviceName = 'Vegacache';
        }
        return {
            service: serviceName,
            alerts: (row.alerts || 'Missing'),
            tracer: (row.tracer || 'Missing'),
            dependency: (row.dep_map || 'Missing')
        };
    });
    
    const getIcon = (status) => {
        const statusLower = (status || '').toLowerCase();
        if (statusLower === 'complete') return '✓';
        if (statusLower === 'partial') return '⚠';
        return '✗';
    };
    
    const getColor = (status) => {
        const statusLower = (status || '').toLowerCase();
        if (statusLower === 'complete') return '#22c55e';
        if (statusLower === 'partial') return '#f59e0b';
        return '#ef4444';
    };
    
    const rows = coverageData.map(row => `
        <tr>
            <td><strong>${row.service}</strong></td>
            <td style="text-align: center; color: ${getColor(row.alerts)}; font-size: 1.2rem;">${getIcon(row.alerts)}</td>
            <td style="text-align: center; color: ${getColor(row.tracer)}; font-size: 1.2rem;">${getIcon(row.tracer)}</td>
            <td style="text-align: center; color: ${getColor(row.dependency)}; font-size: 1.2rem;">${getIcon(row.dependency)}</td>
        </tr>
    `).join('');
    
    container.innerHTML = `
        <table class="coverage-table">
            <thead>
                <tr>
                    <th>SERVICE</th>
                    <th>DEFAULT ALERTS</th>
                    <th>TRACER</th>
                    <th>DEPENDENCY MAP</th>
                </tr>
            </thead>
            <tbody>
                ${rows}
            </tbody>
        </table>
        <div class="coverage-legend">
            <span>✓ = Complete</span>
            <span>⚠ = Partial</span>
            <span>✗ = Missing</span>
        </div>
    `;
}

/**
 * Render Investment Themes
 */
function renderAvailabilityInvestmentThemes() {
    const container = document.getElementById('availability-investment-themes');
    if (!container) return;
    
    // Use real data from themes.csv
    const themes = availabilityData.themes || [];
    
    if (themes.length === 0) {
        container.innerHTML = '<div class="placeholder-message"><p>No investment themes available</p></div>';
        return;
    }
    
    // Map themes data
    const mappedThemes = themes.map(theme => {
        const severity = (theme.severity || 'info').toLowerCase();
        let impactColor = 'blue';
        if (severity === 'critical') impactColor = 'red';
        else if (severity === 'warning') impactColor = 'orange';
        
        return {
            title: theme.title || '',
            description: theme.description || '',
            action: `→ ${theme.action || ''}`,
            impact: theme.percentage || '',
            impactColor: impactColor
        };
    });
    
    const themesHtml = mappedThemes.map(theme => `
        <div class="investment-theme-item">
            <div class="theme-header">
                <h4>${theme.title}</h4>
                <span class="theme-impact ${theme.impactColor}">${theme.impact}</span>
            </div>
            <p class="theme-description">${theme.description}</p>
            <p class="theme-action">${theme.action}</p>
        </div>
    `).join('');
    
    container.innerHTML = themesHtml;
}

/**
 * Render SLA Goals Table
 */
function renderAvailabilitySLATable(slaData) {
    const container = document.getElementById('availability-sla-table');
    if (!container) return;
    
    // Calculate totals
    const totals = {
        total: slaData.reduce((sum, r) => sum + parseInt(r.total_incidents || 0), 0),
        ttd_met: slaData.reduce((sum, r) => sum + parseInt(r.ttd_met || 0), 0),
        ttd_missed: slaData.reduce((sum, r) => sum + parseInt(r.ttd_missed || 0), 0),
        ttr_met: slaData.reduce((sum, r) => sum + parseInt(r.ttr_met || 0), 0),
        ttr_missed: slaData.reduce((sum, r) => sum + parseInt(r.ttr_missed || 0), 0)
    };
    totals.sla_pct = totals.total > 0 ? Math.round(((totals.ttd_met + totals.ttr_met) / (totals.total * 2)) * 100) : 0;
    
    const getSLAColor = (pct) => {
        if (pct >= 95) return '#22c55e';
        if (pct >= 80) return '#f59e0b';
        return '#ef4444';
    };
    
    const rows = slaData.map(row => {
        const slaPct = parseInt(row.sla_pct || 0);
        let serviceName = row.service;
        // Rename "Vega Cache" to "Vegacache" (one word)
        if (serviceName === 'Vega Cache') {
            serviceName = 'Vegacache';
        }
        return `
            <tr>
                <td><strong>${serviceName}</strong></td>
                <td>${row.total_incidents}</td>
                <td style="color: #22c55e;">${row.ttd_met}</td>
                <td style="color: #ef4444;">${row.ttd_missed}</td>
                <td style="color: #22c55e;">${row.ttr_met}</td>
                <td style="color: #ef4444;">${row.ttr_missed}</td>
                <td><span class="sla-badge" style="background: ${getSLAColor(slaPct)};">${slaPct}%</span></td>
            </tr>
        `;
    }).join('');
    
    container.innerHTML = `
        <table class="sla-goals-table">
            <thead>
                <tr>
                    <th>SERVICE</th>
                    <th>TOTAL</th>
                    <th>MTTD MET</th>
                    <th>MTTD MISSED</th>
                    <th>MTTR MET</th>
                    <th>MTTR MISSED</th>
                    <th>OVERALL SLA %</th>
                </tr>
            </thead>
            <tbody>
                ${rows}
                <tr class="total-row">
                    <td><strong>TOTAL</strong></td>
                    <td><strong>${totals.total}</strong></td>
                    <td style="color: #22c55e;"><strong>${totals.ttd_met}</strong></td>
                    <td style="color: #ef4444;"><strong>${totals.ttd_missed}</strong></td>
                    <td style="color: #22c55e;"><strong>${totals.ttr_met}</strong></td>
                    <td style="color: #ef4444;"><strong>${totals.ttr_missed}</strong></td>
                    <td><span class="sla-badge" style="background: ${getSLAColor(totals.sla_pct)};">${totals.sla_pct}%</span></td>
                </tr>
            </tbody>
        </table>
    `;
}

/**
 * Render incident trend chart into a specific container
 */
function renderIncidentTrendChartInContainer(container) {
    if (!container) return;
    
    const monthlyData = getMonthlyIncidentData();
    if (!monthlyData.length) {
        container.innerHTML = '<div class="placeholder-message"><p>No incident data available</p></div>';
        return;
    }
    
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthlyStats = {};
    
    monthlyData.forEach(row => {
        const yearMonth = row.year_month || '';
        const monthNum = parseInt(yearMonth.split('-')[1]) - 1;
        const monthName = months[monthNum] || yearMonth;
        
        if (!monthlyStats[monthName]) {
            monthlyStats[monthName] = { sev0: 0, sev1: 0 };
        }
        
        const count = parseInt(row.incident_count) || 0;
        if (row.severity === 'Sev0') {
            monthlyStats[monthName].sev0 += count;
        } else if (row.severity === 'Sev1') {
            monthlyStats[monthName].sev1 += count;
        }
    });
    
    let maxCount = 0;
    months.forEach(month => {
        if (monthlyStats[month]) {
            maxCount = Math.max(maxCount, monthlyStats[month].sev0, monthlyStats[month].sev1);
        }
    });
    maxCount = Math.max(maxCount, 6);
    
    const chartWidth = 600;
    const chartHeight = 120;
    const paddingLeft = 5;
    const paddingRight = 5;
    const paddingTop = 10;
    const paddingBottom = 10;
    const plotWidth = chartWidth - paddingLeft - paddingRight;
    const plotHeight = chartHeight - paddingTop - paddingBottom;
    
    const sev0Points = [];
    const sev1Points = [];
    
    months.forEach((month, index) => {
        const stats = monthlyStats[month] || { sev0: 0, sev1: 0 };
        const x = paddingLeft + (index / (months.length - 1)) * plotWidth;
        const y0 = paddingTop + plotHeight - ((stats.sev0 / maxCount) * plotHeight);
        const y1 = paddingTop + plotHeight - ((stats.sev1 / maxCount) * plotHeight);
        sev0Points.push({ x, y: y0 });
        sev1Points.push({ x, y: y1 });
    });
    
    const createPath = (points) => 'M ' + points.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' L ');
    
    container.innerHTML = `
        <div class="line-chart-container">
            <svg class="line-chart-svg" viewBox="0 0 ${chartWidth} ${chartHeight}" preserveAspectRatio="xMidYMid meet">
                <path d="${createPath(sev1Points)}" fill="none" stroke="#f59e0b" stroke-width="2.5" />
                <path d="${createPath(sev0Points)}" fill="none" stroke="#ef4444" stroke-width="2.5" />
            </svg>
            <div class="chart-x-axis">${months.map(m => `<span class="chart-x-label">${m}</span>`).join('')}</div>
        </div>
    `;
}

/**
 * Render investment themes into a specific container
 */
function renderInvestmentThemesInContainer(container) {
    if (!container) return;
    
    const themes = getInvestmentThemes();
    if (!themes.length) {
        container.innerHTML = '<div class="placeholder-message"><p>No investment themes available</p></div>';
        return;
    }
    
    const topThemes = themes.slice(0, 3);
    let html = '';
    
    topThemes.forEach((theme, index) => {
        const priorityClass = theme.theme_priority === 'CRITICAL' ? 'priority-critical' :
                              theme.theme_priority === 'WARNING' ? 'priority-warning' : 'priority-info';
        
        html += `
            <div class="investment-theme-card ${priorityClass}">
                <div class="theme-content">
                    <h4 class="theme-title">${index + 1}. ${theme.theme_title}</h4>
                    <p class="theme-description">${theme.description}</p>
                </div>
                <span class="theme-percentage">${theme.incident_percentage}% of incidents</span>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

/**
 * Render Availability Baseline directly into a container
 */
async function renderAvailabilityBaselineInContainer(container) {
    const serviceMetrics = getServiceIncidentMetrics();
    
    if (!serviceMetrics.length) {
        container.innerHTML = `
            <div class="placeholder-message" style="text-align: center; padding: 40px;">
                <div class="placeholder-icon">⚠️</div>
                <h3>No Data Available</h3>
                <p>Could not load service metrics</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = `
        <div class="tab-header">
            <h2>🛡️ Availability Baseline</h2>
            <p>Service-level MTTD and MTTR metrics with SLA targets</p>
        </div>
        
        <div class="availability-baseline-content">
            <div class="mttd-mttr-charts">
                <div class="chart-section">
                    <h3>MTTD by Service (Top 10)</h3>
                    <div id="runtime-mttd-chart"></div>
                </div>
                <div class="chart-section">
                    <h3>MTTR by Service (Top 10)</h3>
                    <div id="runtime-mttr-chart"></div>
                </div>
            </div>
        </div>
    `;
    
    // Render the charts
    renderServiceBarChart('runtime-mttd-chart', serviceMetrics, 'avg_ttd_minutes', 10, 'MTTD');
    renderServiceBarChart('runtime-mttr-chart', serviceMetrics, 'avg_ttr_minutes', 60, 'MTTR');
}

/**
 * Generate dynamic calls to action based on current data
 */
function generateCallsToAction() {
    console.log('📋 Generating AI-powered calls to action based on actual dashboard data...');
    
    const allServices = Array.from(fkpDashboard.data.processed.services.values());
    const commercialGovGaps = [];
    const notStartedServices = [];
    const cloudAnalysis = new Map(); // Track gaps by cloud
    
    console.log('🔍 Analyzing', allServices.length, 'services for migration gaps...');
    
    // Analyze each service for real gaps and opportunities
    allServices.forEach(service => {
        // Calculate migration stages per customer type (like getCrossCustomerServices does)
        const customerTypes = ['Commercial', 'GIA', 'BlackJack'];
        const customerStages = {};
        const customerInstanceCounts = {};
        
        customerTypes.forEach(customerType => {
            const customerInstances = service.instances.filter(instance => 
                instance.customerType === customerType
            );
            
            if (customerInstances.length > 0) {
                // Create temporary service object for this customer type to calculate stage
                const tempService = {
                    ...service,
                    instances: customerInstances,
                    stats: calculateStatsForInstances(customerInstances)
                };
                
                customerStages[customerType] = calculateServiceMigrationStageNumber(tempService);
                customerInstanceCounts[customerType] = customerInstances.length;
            } else {
                customerStages[customerType] = null; // No instances
                customerInstanceCounts[customerType] = 0;
            }
        });
        
        // Find Commercial vs GovCloud (GIA + BlackJack) gaps
        const commercialStage = customerStages['Commercial'];
        const giaStage = customerStages['GIA'];
        const blackjackStage = customerStages['BlackJack'];
        
        // Check for significant Commercial vs GovCloud gaps
        if (commercialStage && commercialStage >= 4) {
            // GIA gap
            if (giaStage && giaStage < commercialStage && customerInstanceCounts['GIA'] >= 5) {
                commercialGovGaps.push({
                    name: service.name,
                    orgLeader: service.orgLeader,
                    cloud: service.cloud,
                    parentCloud: service.parentCloud,
                    team: service.team,
                    commercialStage: commercialStage,
                    govStage: giaStage,
                    govCustomerType: 'GIA',
                    govInstances: customerInstanceCounts['GIA'],
                    commercialInstances: customerInstanceCounts['Commercial'],
                    gap: commercialStage - giaStage
                });
            }
            
            // BlackJack gap  
            if (blackjackStage && blackjackStage < commercialStage && customerInstanceCounts['BlackJack'] >= 5) {
                commercialGovGaps.push({
                    name: service.name,
                    orgLeader: service.orgLeader,
                    cloud: service.cloud,
                    parentCloud: service.parentCloud,
                    team: service.team,
                    commercialStage: commercialStage,
                    govStage: blackjackStage,
                    govCustomerType: 'BlackJack',
                    govInstances: customerInstanceCounts['BlackJack'],
                    commercialInstances: customerInstanceCounts['Commercial'],
                    gap: commercialStage - blackjackStage
                });
            }
        }
        
        // Track services not started (Stage 1 across all customer types with instances)
        const hasInstances = Object.values(customerInstanceCounts).some(count => count > 0);
        const allStagesAre1 = Object.values(customerStages).filter(stage => stage !== null).every(stage => stage === 1);
        const totalInstances = Object.values(customerInstanceCounts).reduce((sum, count) => sum + count, 0);
        
        if (hasInstances && allStagesAre1 && totalInstances >= 10) {
            notStartedServices.push({
                name: service.name,
                orgLeader: service.orgLeader,
                cloud: service.cloud,
                parentCloud: service.parentCloud,
                team: service.team,
                totalInstances: totalInstances,
                commercialInstances: customerInstanceCounts['Commercial'] || 0,
                giaInstances: customerInstanceCounts['GIA'] || 0,
                blackjackInstances: customerInstanceCounts['BlackJack'] || 0
            });
        }
    });
    
    console.log('📊 Analysis complete:');
    console.log(`   - Found ${commercialGovGaps.length} Commercial-GovCloud gaps`);
    console.log(`   - Found ${notStartedServices.length} not started services with 10+ instances`);
    
    // Analyze gaps by cloud to identify which clouds need most attention
    commercialGovGaps.forEach(gap => {
        const cloudKey = gap.parentCloud || gap.cloud || 'Unknown';
        if (!cloudAnalysis.has(cloudKey)) {
            cloudAnalysis.set(cloudKey, {
                gapCount: 0,
                totalGovInstances: 0,
                services: []
            });
        }
        
        const cloudData = cloudAnalysis.get(cloudKey);
        cloudData.gapCount++;
        cloudData.totalGovInstances += gap.govInstances;
        cloudData.services.push(gap);
    });
    
    // Sort gaps by most significant impact (gap size * instance count)
    const topGapServices = commercialGovGaps
        .sort((a, b) => {
            const aImpact = a.gap * a.govInstances;
            const bImpact = b.gap * b.govInstances;
            return bImpact - aImpact;
        })
        .slice(0, 12);
    
    // Sort not started by total instances
    const topNotStartedBySize = notStartedServices
        .sort((a, b) => b.totalInstances - a.totalInstances)
        .slice(0, 8);
    
    return {
        commercialGovGaps: topGapServices,
        notStartedServices: topNotStartedBySize,
        cloudAnalysis: Array.from(cloudAnalysis.entries())
            .map(([cloud, data]) => ({ cloud, ...data }))
            .sort((a, b) => b.gapCount - a.gapCount)
    };
}

/**
 * Render Overview tab - Redesigned compact layout
 */
function renderExecutiveOverview() {
    console.log('📊 Rendering Overview (Redesigned)');
    
    // 1. Render AI Calls to Action
    renderAICTA();
    
    // 2. Render overall adoption metrics (Commercial, GIA, Blackjack)
    renderOverallAdoptionMetrics();
    
    // 3. Render leader/cloud roadmap timeline
    renderRoadmapTimeline();
}

/**
 * Render AI-generated Calls to Action
 */
function renderAICTA() {
    const container = document.getElementById('cta-content');
    if (!container) return;
    
    const callsData = generateCallsToAction();
    
    let html = '';
    
    // Build CTA content
    html += `<p><em>Based on analysis of ${Array.from(fkpDashboard.data.processed.services.values()).length} services across Commercial, GIA, and BlackJack environments.</em></p>`;
    html += '<ol>';
    
    // Gap Analysis
    if (callsData.commercialGovGaps.length > 0 && callsData.cloudAnalysis.length > 0) {
        const topClouds = callsData.cloudAnalysis.slice(0, 3);
        html += '<li><strong>🎯 Close Commercial-GovCloud Migration Gaps:</strong> ';
        html += topClouds.map(c => `<strong>${c.cloud}</strong> (${c.gapCount} services)`).join(', ');
        html += '</li>';
    } else {
        html += '<li><strong>✅ Commercial-GovCloud Gaps:</strong> No significant gaps detected</li>';
    }
    
    // Not Started
    if (callsData.notStartedServices.length > 0) {
        html += `<li><strong>🚀 Accelerate Migration:</strong> ${callsData.notStartedServices.length} services have not started FKP migration</li>`;
    } else {
        html += '<li><strong>✅ Migration Status:</strong> All services have begun migration</li>';
    }
    
    html += '</ol>';
    
    container.innerHTML = html;
}

/**
 * Calculate adoption metrics by customer type
 */
function calculateAdoptionByCustomerType() {
    const allServices = Array.from(fkpDashboard.data.processed.services.values());
    
    const customerTypes = ['Commercial', 'GIA', 'BlackJack'];
    const metrics = {};
    
    // Get environment filter (Prod, Pre-Prod)
    const envFilter = fkpDashboard.filters.instanceEnv || [];
    const filterProd = envFilter.includes('Prod');
    const filterPreProd = envFilter.includes('Pre-Prod');
    const noEnvFilter = envFilter.length === 0;
    
    customerTypes.forEach(customerType => {
        let totalInstances = 0;
        let fkpInstances = 0;
        
        allServices.forEach(service => {
            // Filter instances for this customer type and environment
            service.instances.forEach(inst => {
                // Check customer type
                if (inst.customerType !== customerType) return;
                
                // Check environment filter
                const envMatch = noEnvFilter || 
                    (filterProd && inst.isProd) || 
                    (filterPreProd && inst.isPreProd);
                
                if (!envMatch) return;
                
                totalInstances++;
                if (inst.isFKP) {
                    fkpInstances++;
                }
            });
        });
        
        const adoptionPct = totalInstances > 0 ? (fkpInstances / totalInstances) * 100 : 0;
        
        metrics[customerType] = {
            totalInstances,
            fkpInstances,
            adoptionPct
        };
    });
    
    console.log('📊 Customer type adoption metrics:', metrics);
    return metrics;
}

/**
 * Render overall adoption metrics boxes (Commercial, GIA, Blackjack)
 */
function renderOverallAdoptionMetrics() {
    console.log('📊 Rendering overall adoption metrics...');
    
    const metrics = calculateAdoptionByCustomerType();
    
    // Commercial
    const commercialPct = document.getElementById('commercial-adoption-pct');
    const commercialCounts = document.getElementById('commercial-adoption-counts');
    if (commercialPct && commercialCounts) {
        const comm = metrics['Commercial'];
        commercialPct.textContent = `${comm.adoptionPct.toFixed(1)}%`;
        commercialCounts.textContent = `(${comm.fkpInstances.toLocaleString()}/${comm.totalInstances.toLocaleString()})`;
    }
    
    // GIA
    const giaPct = document.getElementById('gia-adoption-pct');
    const giaCounts = document.getElementById('gia-adoption-counts');
    if (giaPct && giaCounts) {
        const gia = metrics['GIA'];
        giaPct.textContent = `${gia.adoptionPct.toFixed(1)}%`;
        giaCounts.textContent = `(${gia.fkpInstances.toLocaleString()}/${gia.totalInstances.toLocaleString()})`;
    }
    
    // Blackjack
    const bjPct = document.getElementById('blackjack-adoption-pct');
    const bjCounts = document.getElementById('blackjack-adoption-counts');
    if (bjPct && bjCounts) {
        const bj = metrics['BlackJack'];
        bjPct.textContent = `${bj.adoptionPct.toFixed(1)}%`;
        bjCounts.textContent = `(${bj.fkpInstances.toLocaleString()}/${bj.totalInstances.toLocaleString()})`;
    }
    
    console.log('✅ Overall adoption metrics:', metrics);
}

/**
 * Render compact CTA summary bar
 */
function renderCTASummary() {
    const callsData = generateCallsToAction();
    
    const summaryText = document.getElementById('cta-summary-text');
    const detailsContent = document.getElementById('cta-details-content');
    
    if (!summaryText) return;
    
    // Generate compact summary
    const gapCount = callsData.commercialGovGaps.length;
    const notStartedCount = callsData.notStartedServices.length;
    
    let summary = '';
    if (gapCount > 0) {
        summary += `${gapCount} services have Commercial-GovCloud gaps. `;
    }
    if (notStartedCount > 0) {
        summary += `${notStartedCount} services not yet started.`;
    }
    if (gapCount === 0 && notStartedCount === 0) {
        summary = '✅ All services are on track!';
    }
    
    summaryText.textContent = summary;
    
    // Generate detailed content for expandable panel
    if (detailsContent) {
        let detailsHtml = '<ol>';
        
        if (gapCount > 0 && callsData.cloudAnalysis.length > 0) {
            const topClouds = callsData.cloudAnalysis.slice(0, 3);
            detailsHtml += '<li><strong>Commercial-GovCloud Gaps:</strong> ';
            detailsHtml += topClouds.map(c => `${c.cloud} (${c.gapCount} services)`).join(', ');
            detailsHtml += '</li>';
        }
        
        if (notStartedCount > 0) {
            detailsHtml += `<li><strong>Not Started:</strong> ${notStartedCount} services need migration initiation</li>`;
        }
        
        detailsHtml += '</ol>';
        detailsContent.innerHTML = detailsHtml;
    }
}

/**
 * Toggle CTA details panel visibility
 */
function toggleCTADetails() {
    const panel = document.getElementById('cta-details-panel');
    const btn = document.querySelector('.cta-expand-btn');
    
    if (panel && btn) {
        if (panel.style.display === 'none') {
            panel.style.display = 'block';
            btn.textContent = 'Hide ▲';
        } else {
            panel.style.display = 'none';
            btn.textContent = 'Details ▼';
        }
    }
}

/**
 * Set overview view by (leader, parent-cloud, cloud)
 */
function setOverviewViewBy(viewBy) {
    console.log('🔄 Setting overview view by:', viewBy);
    
    // Store current view setting
    fkpDashboard.state.overviewViewBy = viewBy;
    
    // Update button states - check in roadmap-view-toggle
    document.querySelectorAll('.roadmap-view-toggle .view-toggle-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.viewBy === viewBy) {
            btn.classList.add('active');
        }
    });
    
    // Re-render roadmap with new grouping
    renderRoadmapTimeline();
}

/**
 * Render roadmap timeline grouped by leader/cloud
 */
function renderRoadmapTimeline() {
    console.log('📅 Rendering roadmap timeline...');
    
    const container = document.getElementById('roadmap-timeline');
    if (!container) return;
    
    const viewBy = fkpDashboard.state.overviewViewBy || 'org-leader';
    const allServices = Array.from(fkpDashboard.data.processed.services.values());
    
    console.log('📊 Roadmap view mode:', viewBy, '| Total services:', allServices.length);
    
    // Build leader-level data first (always needed)
    const leaderData = new Map();
    
    allServices.forEach(service => {
        const leaderName = service.orgLeader || 'Unknown Leader';
        const parentCloudName = service.parentCloud || 'Unknown Parent Cloud';
        const cloudName = service.cloud || 'Unknown Cloud';
        
        // Get instance counts from the service
        const totalInst = service.stats?.total || 0;
        const fkpInst = service.stats?.fkp || 0;
        const stage = calculateServiceMigrationStageNumber(service);
        
        // Initialize leader
        if (!leaderData.has(leaderName)) {
            leaderData.set(leaderName, {
                name: leaderName,
                services: 0,
                totalInstances: 0,
                fkpInstances: 0,
                totalStage: 0,
                parentClouds: new Map(),
                clouds: new Map()
            });
        }
        
        const leader = leaderData.get(leaderName);
        leader.services++;
        leader.totalInstances += totalInst;
        leader.fkpInstances += fkpInst;
        leader.totalStage += stage;
        
        // Track parent clouds under this leader
        if (!leader.parentClouds.has(parentCloudName)) {
            leader.parentClouds.set(parentCloudName, {
                name: parentCloudName,
                services: 0,
                totalInstances: 0,
                fkpInstances: 0,
                totalStage: 0
            });
        }
        const pc = leader.parentClouds.get(parentCloudName);
        pc.services++;
        pc.totalInstances += totalInst;
        pc.fkpInstances += fkpInst;
        pc.totalStage += stage;
        
        // Track clouds under this leader
        if (!leader.clouds.has(cloudName)) {
            leader.clouds.set(cloudName, {
                name: cloudName,
                services: 0,
                totalInstances: 0,
                fkpInstances: 0,
                totalStage: 0
            });
        }
        const cl = leader.clouds.get(cloudName);
        cl.services++;
        cl.totalInstances += totalInst;
        cl.fkpInstances += fkpInst;
        cl.totalStage += stage;
    });
    
    // Sort leaders by total instances (descending)
    const sortedLeaders = Array.from(leaderData.values())
        .sort((a, b) => b.totalInstances - a.totalInstances);
    
    let html = '';
    
    if (viewBy === 'org-leader') {
        // LEADER VIEW: Just show leaders with their metrics
        html = '<div class="roadmap-list">';
        
        sortedLeaders.forEach(leader => {
            const adoptionPct = leader.totalInstances > 0 ? 
                (leader.fkpInstances / leader.totalInstances) * 100 : 0;
            const avgStage = leader.services > 0 ? 
                Math.round(leader.totalStage / leader.services) : 1;
            
            html += renderRoadmapRow(
                leader.name,
                leader.services,
                leader.fkpInstances,
                leader.totalInstances,
                adoptionPct,
                avgStage
            );
        });
        
        html += '</div>';
        
    } else if (viewBy === 'parent-cloud') {
        // PARENT CLOUD VIEW: Show leaders, then parent clouds under each
        sortedLeaders.forEach(leader => {
            const leaderAdoption = leader.totalInstances > 0 ? 
                (leader.fkpInstances / leader.totalInstances) * 100 : 0;
            
            html += `
                <div class="roadmap-group">
                    <div class="roadmap-group-header">
                        <span class="roadmap-group-name">${leader.name}</span>
                        <div class="roadmap-group-stats">
                            <span>${leader.services} services</span>
                            <span>${leader.fkpInstances.toLocaleString()}/${leader.totalInstances.toLocaleString()} instances</span>
                            <span>${leaderAdoption.toFixed(1)}%</span>
                        </div>
                    </div>
                    <div class="roadmap-items">
            `;
            
            // Sort parent clouds by adoption % (highest first)
            const sortedPCs = Array.from(leader.parentClouds.values())
                .map(pc => ({
                    ...pc,
                    adoptionPct: pc.totalInstances > 0 ? (pc.fkpInstances / pc.totalInstances) * 100 : 0,
                    avgStage: pc.services > 0 ? Math.round(pc.totalStage / pc.services) : 1
                }))
                .sort((a, b) => b.adoptionPct - a.adoptionPct);
            
            sortedPCs.forEach(pc => {
                html += renderRoadmapRow(
                    pc.name,
                    pc.services,
                    pc.fkpInstances,
                    pc.totalInstances,
                    pc.adoptionPct,
                    pc.avgStage,
                    true // isSubItem
                );
            });
            
            html += `
                    </div>
                </div>
            `;
        });
        
    } else {
        // CLOUD VIEW: Show leaders, then clouds under each
        sortedLeaders.forEach(leader => {
            const leaderAdoption = leader.totalInstances > 0 ? 
                (leader.fkpInstances / leader.totalInstances) * 100 : 0;
            
            html += `
                <div class="roadmap-group">
                    <div class="roadmap-group-header">
                        <span class="roadmap-group-name">${leader.name}</span>
                        <div class="roadmap-group-stats">
                            <span>${leader.services} services</span>
                            <span>${leader.fkpInstances.toLocaleString()}/${leader.totalInstances.toLocaleString()} instances</span>
                            <span>${leaderAdoption.toFixed(1)}%</span>
                        </div>
                    </div>
                    <div class="roadmap-items">
            `;
            
            // Sort clouds by adoption % (highest first)
            const sortedClouds = Array.from(leader.clouds.values())
                .map(cl => ({
                    ...cl,
                    adoptionPct: cl.totalInstances > 0 ? (cl.fkpInstances / cl.totalInstances) * 100 : 0,
                    avgStage: cl.services > 0 ? Math.round(cl.totalStage / cl.services) : 1
                }))
                .sort((a, b) => b.adoptionPct - a.adoptionPct);
            
            sortedClouds.forEach(cl => {
                html += renderRoadmapRow(
                    cl.name,
                    cl.services,
                    cl.fkpInstances,
                    cl.totalInstances,
                    cl.adoptionPct,
                    cl.avgStage,
                    true // isSubItem
                );
            });
            
            html += `
                    </div>
                </div>
            `;
        });
    }
    
    if (sortedLeaders.length === 0) {
        html = `
            <div class="placeholder-message">
                <div class="placeholder-icon">📊</div>
                <h3>No data available</h3>
                <p>Adjust filters to see roadmap data</p>
            </div>
        `;
    }
    
    container.innerHTML = html;
    console.log('✅ Roadmap timeline rendered with', sortedLeaders.length, 'leaders');
}

/**
 * Render a single roadmap row with progress bar
 * Color is based on adoption %, not stage:
 * - 0% = Not Started (gray)
 * - 1-50% = In Progress (yellow)
 * - 50-90% = Prod Complete (green)
 * - 90-100% = Mesh Complete (cyan)
 */
function renderRoadmapRow(name, services, fkpInstances, totalInstances, adoptionPct, avgStage, isSubItem = false) {
    // Determine color class based on adoption %
    let colorClass;
    if (adoptionPct === 0) {
        colorClass = 'status-not-started';
    } else if (adoptionPct < 50) {
        colorClass = 'status-in-progress';
    } else if (adoptionPct < 90) {
        colorClass = 'status-prod-complete';
    } else {
        colorClass = 'status-mesh-complete';
    }
    
    const barWidth = Math.max(adoptionPct, 3); // Minimum 3% width for visibility
    
    return `
        <div class="roadmap-item ${isSubItem ? 'sub-item' : ''}">
            <div class="roadmap-item-left">
                <span class="roadmap-item-name" title="${name}">${name}</span>
                <span class="roadmap-item-services">${services} services</span>
            </div>
            <div class="roadmap-item-bar">
                <div class="roadmap-item-progress ${colorClass}" style="width: ${barWidth}%;"></div>
                <span class="roadmap-bar-pct">${adoptionPct.toFixed(1)}%</span>
            </div>
            <div class="roadmap-item-right">
                <span class="stat-instances">${fkpInstances.toLocaleString()}/${totalInstances.toLocaleString()}</span>
                <span class="stat-eta">ETA: TBD</span>
            </div>
        </div>
    `;
}

/**
 * Get migration stage name from number
 */
function getMigrationStageName(stageNum) {
    const stages = {
        1: 'Not Started',
        2: 'Pre-Prod',
        3: 'Parity Req',
        4: 'Prod Progress',
        5: 'Prod Complete',
        6: 'Mesh'
    };
    return stages[stageNum] || 'Unknown';
}

/**
 * Render dynamic calls to action in the UI
 */
function renderCallsToAction(callsData) {
    console.log('📋 Rendering AI-powered calls to action...', callsData);
    
    const container = document.querySelector('.calls-to-action');
    if (!container) return;
    
    let gapAnalysisText = '';
    let notStartedAnalysisText = '';
    
    // AI Analysis: Commercial-GovCloud Gap Services - Show which clouds need most attention
    if (callsData.commercialGovGaps.length > 0 && callsData.cloudAnalysis.length > 0) {
        // Find clouds with maximum gaps
        const topCloudsWithGaps = callsData.cloudAnalysis.slice(0, 3); // Top 3 clouds with most gaps
        
        gapAnalysisText = topCloudsWithGaps.map(cloudData => {
            const cloudName = cloudData.cloud;
            const gapCount = cloudData.gapCount;
            const totalGovInstances = cloudData.totalGovInstances;
            
            // Get top examples for this cloud
            const topExamples = cloudData.services
                .sort((a, b) => (b.gap * b.govInstances) - (a.gap * a.govInstances)) // Sort by impact
                .slice(0, 3); // Top 3 examples
            
            const examplesText = topExamples.map(service => {
                const cloudInfo = service.parentCloud !== service.cloud ? 
                    `${service.parentCloud} → ${service.cloud}` : service.cloud;
                return `${service.name} (${cloudInfo}, ${service.team}, ${service.govInstances} ${service.govCustomerType} instances)`;
            }).join(', ');
            
            return `<strong>${cloudName}:</strong> ${gapCount} services with gaps affecting ${totalGovInstances} GovCloud instances.<br><span class="service-list">Examples: ${examplesText}${cloudData.services.length > 3 ? ` and ${cloudData.services.length - 3} others` : ''}</span>`;
        }).join('<br><br>');
        
        // Add summary insight
        const totalGaps = callsData.commercialGovGaps.length;
        const maxGapCloud = topCloudsWithGaps[0];
        gapAnalysisText += `<br><br><em>AI Insight: <strong>${maxGapCloud.cloud}</strong> has the highest concentration of GovCloud migration gaps (${maxGapCloud.gapCount}/${totalGaps} total gaps).</em>`;
        
    } else {
        gapAnalysisText = '<span class="service-list">✅ Excellent! No significant Commercial-GovCloud migration gaps detected (5+ instances, Commercial Stage 4+ ahead of GIA/BlackJack)</span>';
    }
    
    // AI Analysis: Not Started Services - Group by Parent Cloud showing highest impact
    if (callsData.notStartedServices.length > 0) {
        const notStartedByCloud = {};
        callsData.notStartedServices.forEach(service => {
            const cloudKey = service.parentCloud || service.cloud || 'Unknown';
            if (!notStartedByCloud[cloudKey]) notStartedByCloud[cloudKey] = {
                services: [],
                totalInstances: 0
            };
            notStartedByCloud[cloudKey].services.push(service);
            notStartedByCloud[cloudKey].totalInstances += service.totalInstances;
        });
        
        const topNotStartedClouds = Object.entries(notStartedByCloud)
            .sort(([,a], [,b]) => b.totalInstances - a.totalInstances)
            .slice(0, 3); // Top 3 clouds by total instance count
        
        notStartedAnalysisText = topNotStartedClouds.map(([cloud, data]) => {
            const topServices = data.services
                .sort((a, b) => b.totalInstances - a.totalInstances)
                .slice(0, 3); // Top 3 services per cloud
            
            const examplesText = topServices.map(s => {
                const cloudInfo = s.parentCloud !== s.cloud ? 
                    `${s.parentCloud} → ${s.cloud}` : s.cloud;
                const breakdown = [];
                if (s.commercialInstances > 0) breakdown.push(`${s.commercialInstances} Comm`);
                if (s.giaInstances > 0) breakdown.push(`${s.giaInstances} GIA`);
                if (s.blackjackInstances > 0) breakdown.push(`${s.blackjackInstances} BJ`);
                return `${s.name} (${cloudInfo}, ${s.team}, ${breakdown.join('/')})`;
            }).join(', ');
            
            return `<strong>${cloud}:</strong> ${data.services.length} services with ${data.totalInstances} total unmigrated instances.<br><span class="service-list">Examples: ${examplesText}${data.services.length > 3 ? ` and ${data.services.length - 3} others` : ''}</span>`;
        }).join('<br><br>');
        
        // Add AI insight
        const maxNotStartedCloud = topNotStartedClouds[0];
        const totalNotStartedServices = callsData.notStartedServices.length;
        notStartedAnalysisText += `<br><br><em>AI Insight: <strong>${maxNotStartedCloud[0]}</strong> has the highest migration opportunity with ${maxNotStartedCloud[1].totalInstances} unmigrated instances across ${maxNotStartedCloud[1].services.length} services.</em>`;
        
    } else {
        notStartedAnalysisText = '<span class="service-list">✅ Great progress! All services with 10+ instances have initiated FKP migration (Stage 2+)</span>';
    }
    
    const html = `
        <h3>🤖 AI-Generated Calls to Action for Cloud Leaders</h3>
        <p><em>Based on analysis of ${Array.from(fkpDashboard.data.processed.services.values()).length} services across Commercial, GIA, and BlackJack environments. Examples shown represent actual services from your portfolio.</em></p>
        <ol>
            <li>
                <strong>🎯 Priority: Close Commercial-GovCloud Migration Gaps</strong><br>
                <em>Focus on services where Commercial has reached Stage 4+ but GIA/BlackJack environments lag behind:</em>
                <br><br>
                ${gapAnalysisText}
            </li>
            <li>
                <strong>🚀 Opportunity: Accelerate Migration Initiation</strong><br>
                <em>These clouds have services with 10+ instances still at Stage 1 (not started):</em>
                <br><br>
                ${notStartedAnalysisText}
            </li>
        </ol>
    `;
    
    container.innerHTML = html;
}

/**
 * Get filtered data for Overview based on current filters and view mode
 */
function getFilteredExecutiveData(primary, secondary) {
    const processed = fkpDashboard.data.processed;
    const filters = fkpDashboard.filters;
    
    console.log('🔍 Getting filtered executive data:', { primary, secondary, filters });
    
    // Start with all services that match current filters
    const filteredServices = getFilteredServices();
    
    // Group by the secondary grouping (org-leader, parent-cloud, cloud)
    const groupedData = new Map();
    
    filteredServices.forEach(service => {
        let groupKey;
        switch (secondary) {
            case 'org-leader':
                groupKey = service.orgLeader;
                break;
            case 'parent-cloud':
                groupKey = service.parentCloud;
                break;
            case 'cloud':
                groupKey = service.cloud;
                break;
            default:
                groupKey = service.orgLeader;
        }
        
        if (!groupedData.has(groupKey)) {
            groupedData.set(groupKey, {
                name: groupKey,
                services: [],
                totalServices: 0,
                servicesOnFKP: 0,
                totalInstances: 0,
                fkpInstances: 0,
                adoptionRate: 0
            });
        }
        
        const group = groupedData.get(groupKey);
        group.services.push(service);
        group.totalServices++;
        
        // Calculate metrics based on filtered instances (respecting environment filter)
        const relevantInstances = service.instances.filter(instance => 
            filters.instanceEnv.includes(instance.isProd ? 'Prod' : 'Pre-Prod') &&
            filters.customerType.includes(instance.customerType)
        );
        
        const fkpRelevantInstances = relevantInstances.filter(instance => instance.isFKP);
        
        group.totalInstances += relevantInstances.length;
        group.fkpInstances += fkpRelevantInstances.length;
        
        // For service adoption: service is considered "on FKP" if it has at least 1 FKP prod instance
        if (primary === 'service') {
            const hasFKPProd = service.instances.some(instance => 
                instance.isFKP && instance.isProd && 
                filters.customerType.includes(instance.customerType)
            );
            if (hasFKPProd) group.servicesOnFKP++;
        }
    });
    
    // Calculate adoption rates
    groupedData.forEach(group => {
        if (primary === 'service') {
            group.adoptionRate = group.totalServices > 0 ? 
                (group.servicesOnFKP / group.totalServices) * 100 : 0;
        } else {
            group.adoptionRate = group.totalInstances > 0 ? 
                (group.fkpInstances / group.totalInstances) * 100 : 0;
        }
    });
    
    // Convert to array and sort
    const result = Array.from(groupedData.values());
    result.sort((a, b) => b.adoptionRate - a.adoptionRate);
    
    console.log('📊 Executive data prepared:', result.length, 'groups');
    return result;
}

/**
 * Get services filtered by current filter selections
 */
function getFilteredServices() {
    const processed = fkpDashboard.data.processed;
    const filters = fkpDashboard.filters;
    const currentTab = fkpDashboard.state.currentTab;
    
    const filteredServices = [];
    
    processed.services.forEach(service => {
        // Apply organizational filters
        if (filters.orgLeader.length > 0 && !filters.orgLeader.includes(service.orgLeader)) return;
        if (filters.parentCloud.length > 0 && !filters.parentCloud.includes(service.parentCloud)) return;
        if (filters.cloud.length > 0 && !filters.cloud.includes(service.cloud)) return;
        if (filters.team.length > 0 && !filters.team.includes(service.team)) return;
        if (filters.service.length > 0 && !filters.service.includes(service.name)) return;
        
        // Apply migration stage filter only for service-information tab
        if (currentTab === 'service-information') {
            const migrationStage = calculateServiceMigrationStageNumber(service);
            const migrationStageText = getMigrationStageText(migrationStage);
            if (filters['migration-stage'].length > 0 && !filters['migration-stage'].includes(migrationStageText)) return;
        }
        
        // Apply customer type and environment filters (skip for cross-customer analysis)
        if (currentTab !== 'cross-customer-analysis') {
            // Check if service has instances matching customer type and environment filters
            const hasMatchingInstances = service.instances.some(instance => {
                const matchesCustomerType = filters.customerType.includes(instance.customerType);
                const matchesEnv = filters.instanceEnv.includes(instance.isProd ? 'Prod' : 'Pre-Prod');
                return matchesCustomerType && matchesEnv;
            });
            
            if (!hasMatchingInstances) {
                return;
            }
        } else {
            // For cross-customer analysis, we need services with instances across any customer type
            // Don't filter by customer type or environment since we want to analyze across all
            const hasAnyInstances = service.instances.length > 0;
            if (!hasAnyInstances) {
                return;
            }
        }
        
        // Add the service to filtered results
        filteredServices.push(service);
    });
    
    return filteredServices;
}

/**
 * Render Migration Pipeline tab
 */
function renderMigrationPipeline() {
    console.log('🚀 Rendering Migration Pipeline');
    
    // Enable debug logging for migration stages
    window.DEBUG_MIGRATION = true;
    
    const container = document.getElementById('pipeline-stages');
    
    // Get filtered data based on view mode and calculate cross-tab
    const { secondary } = fkpDashboard.state.viewMode;
    const crossTabData = calculateMigrationCrossTab(secondary);
    
    // Render cross-tab table with colored columns
    let html = `
        <table class="migration-crosstab-table">
            <thead>
                <tr>
                    <th>${getGroupLabel(secondary)}</th>
                    <th class="stage-1-col">Stage 1<br>Not Started</th>
                    <th class="stage-2-col">Stage 2<br>Pre-Prod</th>
                    <th class="stage-3-col">Stage 3<br>Parity Req.</th>
                    <th class="stage-4-col">Stage 4<br>Prod Progress</th>
                    <th class="stage-5-col">Stage 5<br>Prod Complete</th>
                    <th class="stage-6-col">Stage 6<br>Mesh Complete</th>
                    <th class="crosstab-totals">Total</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    let columnTotals = [0, 0, 0, 0, 0, 0, 0]; // 6 stages + total
    
    crossTabData.groups.forEach(group => {
        const rowTotal = group.stages.reduce((sum, count) => sum + count, 0);
        
        html += `<tr>`;
        html += `<td><strong>${group.name}</strong></td>`;
        
        group.stages.forEach((count, index) => {
            const stageNumber = index + 1; // Convert index to stage number (1-6)
            const cellClass = count === 0 ? 'zero' : count <= 5 ? 'low' : count <= 15 ? 'medium' : 'high';
            html += `<td class="crosstab-cell ${cellClass} stage-${stageNumber}-col">${count}</td>`;
            columnTotals[index] += count;
        });
        
        html += `<td class="crosstab-totals">${rowTotal}</td>`;
        html += `</tr>`;
        columnTotals[6] += rowTotal;
    });
    
    // Add totals row
    html += `<tr class="crosstab-totals">`;
    html += `<td><strong>Total</strong></td>`;
    columnTotals.forEach((total, index) => {
        if (index < 6) { // Only for stage columns, not total column
            const stageNumber = index + 1;
            html += `<td class="stage-${stageNumber}-col">${total}</td>`;
        } else {
            html += `<td>${total}</td>`; // Total column
        }
    });
    html += `</tr>`;
    
    html += `
            </tbody>
        </table>
    `;
    
    container.innerHTML = html;
}

/**
 * Calculate migration cross-tab data based on grouping
 */
function calculateMigrationCrossTab(groupBy) {
    console.log('📊 Calculating migration cross-tab for:', groupBy);
    
    const filteredServices = getFilteredServicesForMigrationPipeline();
    const groupedData = new Map();
    
    // Group services
    filteredServices.forEach(service => {
        let groupKey;
        switch (groupBy) {
            case 'org-leader':
                groupKey = service.orgLeader;
                break;
            case 'parent-cloud':
                groupKey = service.parentCloud;
                break;
            case 'cloud':
                groupKey = service.cloud;
                break;
            default:
                groupKey = service.orgLeader;
        }
        
        if (!groupedData.has(groupKey)) {
            groupedData.set(groupKey, []);
        }
        groupedData.get(groupKey).push(service);
    });
    
    // Calculate stages for each group
    const groups = [];
    groupedData.forEach((services, groupName) => {
        const stages = [0, 0, 0, 0, 0, 0]; // 6 stages
        
        services.forEach(service => {
            const stage = calculateServiceMigrationStageNumber(service);
            if (stage >= 1 && stage <= 6) {
                stages[stage - 1]++;
            }
        });
        
        groups.push({
            name: groupName,
            stages: stages
        });
    });
    
    // Sort groups by total services (descending)
    groups.sort((a, b) => {
        const aTotal = a.stages.reduce((sum, count) => sum + count, 0);
        const bTotal = b.stages.reduce((sum, count) => sum + count, 0);
        return bTotal - aTotal;
    });
    
    return { groups };
}

/**
 * Calculate migration stage number for a service (1-6)
 */
function calculateServiceMigrationStageNumber(service) {
    const stats = service.stats;
    
    if (stats.fkp === 0) {
        return 1; // Stage 1: Not Started
    }
    
    // Check Stage 3 FIRST - Requirements override other stages
    if (hasParityRequirements(service.name)) {
        debugLog(`🟡 DEBUG Stage 3: Service ${service.name} has parity requirements - assigning Stage 3`);
        return 3; // Stage 3: Parity Required (services with requirements)
    }
    
    // Now check other stages
    if (stats.fkpProd === 0 && stats.fkpPreProd > 0) {
        // DEBUG: Log Stage 2 services
        if (window.DEBUG_MIGRATION) {
            console.log(`🟡 Stage 2 Service: ${service.name} - FKP PreProd: ${stats.fkpPreProd}, FKP Prod: ${stats.fkpProd}, Total Prod: ${stats.prod}`);
        }
        return 2; // Stage 2: Pre-Prod FKP Progress + Zero FKP Prod (Option B)
    } else if (stats.fkpProd > 0 && stats.fkpProd < stats.prod) {
        return 4; // Stage 4: Prod Progress (partial)
    } else if (stats.fkpProd === stats.prod && stats.prod > 0) {
        if (service.meshEnabled) {
            return 6; // Stage 6: FKP + Mesh Complete
        } else {
            return 5; // Stage 5: Prod Complete
        }
    }
    
    return 1; // Default to not started
}

/**
 * Check if a service has parity requirements (Stage 3)
 */
function hasParityRequirements(serviceName) {
    if (!fkpDashboard.data.timelineRequirements || fkpDashboard.data.timelineRequirements.length === 0) {
        debugLog('🔍 DEBUG Stage 3: No timeline requirements data loaded');
        return false;
    }
    
    const timelineRecord = fkpDashboard.data.timelineRequirements.find(record =>
        record['Service Name'] === serviceName
    );
    
    if (!timelineRecord) {
        // Log specific services mentioned by user for debugging
        const debugServices = ['cdp-byoc-krc', 'cdp-dpc-eks', 'eanalytics', 'notebook'];
        if (debugServices.includes(serviceName)) {
            debugLog(`🔍 DEBUG Stage 3 SPECIFIC: No timeline record found for service: ${serviceName}`);
            console.log('🔍 Available services in timeline (first 10):', fkpDashboard.data.timelineRequirements.slice(0, 10).map(r => r['Service Name']));
        } else if (Math.random() < 0.01) {
            debugLog(`🔍 DEBUG Stage 3: No timeline record found for service: ${serviceName}`);
        }
        return false;
    }
    
    const requirements = timelineRecord['Requirements'];
    const hasRequirements = requirements && requirements.trim() !== '' && requirements.toLowerCase() !== 'none';
    
    if (hasRequirements) {
        debugLog(`🟡 DEBUG Stage 3: Found service with requirements: ${serviceName} - Requirements: ${requirements}`);
    } else {
        // Debug services that should have requirements but don't
        const debugServices = ['cdp-byoc-krc', 'cdp-dpc-eks', 'eanalytics', 'notebook'];
        if (debugServices.includes(serviceName)) {
            debugLog(`🔍 DEBUG Stage 3 SPECIFIC: Service ${serviceName} found in timeline but requirements = "${requirements}"`);
        }
    }
    
    return hasRequirements;
}

/**
 * Get service requirements from timeline data
 */
function getServiceRequirements(serviceName) {
    if (!fkpDashboard.data.timelineRequirements || fkpDashboard.data.timelineRequirements.length === 0) {
        return '<span class="dependency-placeholder">No requirements data</span>';
    }
    
    const timelineRecord = fkpDashboard.data.timelineRequirements.find(record =>
        record['Service Name'] === serviceName
    );
    
    if (!timelineRecord) {
        return '<span class="dependency-placeholder">Not in timeline</span>';
    }
    
    const requirements = timelineRecord['Requirements'];
    if (!requirements || requirements.trim() === '' || requirements.toLowerCase() === 'none') {
        return '<span class="dependency-placeholder">No requirements</span>';
    }
    
    return `<span class="dependency-text">${requirements}</span>`;
}

// NOTE: calculateQuarterlyGrowth() function removed - growth calculation now done directly in renderServiceInformationMetrics()
// This eliminates duplication and guarantees perfect consistency between UI display and growth calculation

/**
 * Get growth projections for next quarter (FY26Q4) using actual service data
 * NOW FILTER-AWARE: Only calculates projections for services matching current UI filters
 */
function calculateGrowthProjections() {
    if (!fkpDashboard.data.timelineRequirements || fkpDashboard.data.timelineRequirements.length === 0 || !fkpDashboard.data.processed) {
        return { services: 0, instances: 0, serviceAdoption: 0, instanceAdoption: 0 };
    }
    
    const nextQuarter = 'FY26Q4';
    let servicesCompletingMigration = 0;
    let instancesCompletingMigration = 0;
    
    // Get currently filtered services to make projections filter-aware
    const filteredServices = getFilteredServicesForServiceInfo();
    const filteredServiceNames = new Set(filteredServices.map(s => s.name));
    
    console.log(`🔍 Growth Projections: Calculating for ${filteredServiceNames.size} filtered services (out of ${fkpDashboard.data.timelineRequirements.length} total timeline records)`);
    
    fkpDashboard.data.timelineRequirements.forEach(record => {
        const serviceName = record['Service Name'];
        const commercialETA = record['Commercial ETA'];
        const giaETA = record['GIA ETA'];
        const blackjackETA = record['BlackJack ETA'];
        
        // FILTER-AWARE: Only process services that match current UI filters
        if (!filteredServiceNames.has(serviceName)) {
            return; // Service not in current filtered view
        }
        
        // Skip services needing more info
        if (commercialETA === 'Need More Info' && giaETA === 'Need More Info' && blackjackETA === 'Need More Info') {
            return;
        }
        
        // Find the actual service in our processed data
        const service = fkpDashboard.data.processed.services.get(serviceName);
        if (!service) {
            return; // Service not found in our main data
        }
        
        let serviceWillComplete = false;
        
        // Check each customer type and count only NON-FKP instances that will migrate
        if ((commercialETA === nextQuarter || commercialETA === 'To Be Decomissioned')) {
            const commercialInstances = service.instances.filter(inst => 
                inst.customerType === 'Commercial' && !inst.onFKP);
            if (commercialInstances.length > 0) {
                instancesCompletingMigration += commercialInstances.length;
                serviceWillComplete = true;
            }
        }
        
        if ((giaETA === nextQuarter || giaETA === 'To Be Decomissioned')) {
            const giaInstances = service.instances.filter(inst => 
                inst.customerType === 'GIA' && !inst.onFKP);
            if (giaInstances.length > 0) {
                instancesCompletingMigration += giaInstances.length;
                serviceWillComplete = true;
            }
        }
        
        if ((blackjackETA === nextQuarter || blackjackETA === 'To Be Decomissioned')) {
            const blackjackInstances = service.instances.filter(inst => 
                inst.customerType === 'BlackJack' && !inst.onFKP);
            if (blackjackInstances.length > 0) {
                instancesCompletingMigration += blackjackInstances.length;
                serviceWillComplete = true;
            }
        }
        
        if (serviceWillComplete) {
            servicesCompletingMigration++;
            console.log(`📈 Growth Projection: ${serviceName} will complete migration (Commercial: ${commercialETA}, GIA: ${giaETA}, BlackJack: ${blackjackETA})`);
        }
    });
    
    console.log(`🚀 Growth Projections Results: ${servicesCompletingMigration} services, ${instancesCompletingMigration} instances completing migration in ${nextQuarter}`);
    
    return {
        services: servicesCompletingMigration,
        instances: instancesCompletingMigration,
        serviceAdoption: 0, // Will be calculated in the metrics function
        instanceAdoption: 0  // Will be calculated in the metrics function
    };
}


/**
 * Get group label for display
 */
function getGroupLabel(groupBy) {
    switch (groupBy) {
        case 'org-leader':
            return 'Org Leader';
        case 'parent-cloud':
            return 'Parent Cloud';
        case 'cloud':
            return 'Cloud';
        default:
            return 'Org Leader';
    }
}

/**
 * Calculate migration stages for services
 */
function calculateMigrationStages() {
    const processed = fkpDashboard.data.processed;
    const stages = {
        'not-started': 0,
        'pre-prod-progress': 0,
        'parity-required': 0,
        'prod-progress': 0,
        'prod-complete': 0,
        'mesh-complete': 0
    };
    
    processed.services.forEach(service => {
        const stats = service.stats;
        
        if (stats.fkp === 0) {
            // Stage 1: Not Started
            stages['not-started']++;
        } else if (stats.fkpProd === 0 && stats.fkpPreProd > 0) {
            // Stage 2: Pre-Prod Progress
            stages['pre-prod-progress']++;
        } else if (hasParityRequirements(service.name)) {
            // Stage 3: Parity Required
            stages['parity-required']++;
        } else if (stats.fkpProd > 0 && stats.fkpProd < stats.prod) {
            // Stage 4: Prod Progress (partial)
            stages['prod-progress']++;
        } else if (stats.fkpProd === stats.prod && stats.prod > 0) {
            if (service.meshEnabled) {
                // Stage 6: FKP + Mesh Complete
                stages['mesh-complete']++;
            } else {
                // Stage 5: Prod Complete
                stages['prod-complete']++;
            }
        }
    });
    
    return stages;
}

/**
 * Helper function to calculate metrics for any quarter's data using consistent filtering
 */
function calculateQuarterMetrics(instancesData, blackjackData) {
    // Temporarily store and replace data for filtering
    const originalInstances = fkpDashboard.data.instances;
    const originalBlackjack = fkpDashboard.data.blackjackInstances;
    const originalProcessed = fkpDashboard.data.processed;
    
    // Set the data for the quarter we want to analyze
    fkpDashboard.data.instances = instancesData;
    fkpDashboard.data.blackjackInstances = blackjackData;
    
    // Re-process to get correct service structure
    processData();
    
    // Use the SAME filtering logic as the UI
    const filteredServices = getFilteredServicesForServiceInfo();
    
    // Calculate metrics using IDENTICAL logic
    let totalInstances = 0;
    let totalFkpInstances = 0;
    
    filteredServices.forEach(service => {
        totalInstances += service.totalInstances || 0;
        totalFkpInstances += service.fkpInstances || 0;
    });
    
    const adoptionPercent = totalInstances > 0 ? (totalFkpInstances / totalInstances) * 100 : 0;
    
    // Restore original data
    fkpDashboard.data.instances = originalInstances;
    fkpDashboard.data.blackjackInstances = originalBlackjack;
    fkpDashboard.data.processed = originalProcessed;
    
    return {
        totalInstances,
        totalFkpInstances,
        adoptionPercent,
        serviceCount: filteredServices.length
    };
}

/**
 * Render Service Information metrics
 */
function renderServiceInformationMetrics() {
    const metricsContainer = document.getElementById('service-metrics-container');
    if (!metricsContainer) return;
    
    const filteredServices = getFilteredServicesForServiceInfo();
    
    // Calculate Service-level metrics (Line 1)
    const totalServices = filteredServices.length;
    const servicesPreProdProgress = filteredServices.filter(service => {
        const stage = calculateServiceMigrationStageNumber(service);
        return stage === 2 || stage === 3;
    }).length;
    const servicesProdProgress = filteredServices.filter(service => {
        const stage = calculateServiceMigrationStageNumber(service);
        return stage === 4;
    }).length;
    const servicesMigrationComplete = filteredServices.filter(service => {
        const stage = calculateServiceMigrationStageNumber(service);
        return stage === 5 || stage === 6;
    }).length;
    const servicesStage4Plus = filteredServices.filter(service => {
        const stage = calculateServiceMigrationStageNumber(service);
        return stage >= 4;
    }).length;
    const serviceTypeAdoptionPercent = totalServices > 0 ? (servicesStage4Plus / totalServices) * 100 : 0;
    
    // Calculate CURRENT quarter metrics using the SAME logic as UI display
    let totalInstances = 0;
    let totalFkpInstances = 0;
    
    filteredServices.forEach(service => {
        totalInstances += service.totalInstances || 0;
        totalFkpInstances += service.fkpInstances || 0;
    });
    
    const serviceInstanceAdoptionPercent = totalInstances > 0 ? (totalFkpInstances / totalInstances) * 100 : 0;
    
    // Calculate PREVIOUS quarter metrics using the SAME filtering logic
    let prevQuarterData = { totalInstances: 0, totalFkpInstances: 0, adoptionPercent: 0, serviceCount: 0 };
    
    if (fkpDashboard.data.instancesPrevQ && fkpDashboard.data.instancesPrevQ.length > 0) {
        prevQuarterData = calculateQuarterMetrics(
            fkpDashboard.data.instancesPrevQ, 
            fkpDashboard.data.blackjackInstancesPrevQ || []
        );
    }
    
    // Calculate GROWTH using both quarters (SINGLE SOURCE OF TRUTH)
    const instanceGrowth = totalFkpInstances - prevQuarterData.totalFkpInstances;
    const adoptionGrowth = serviceInstanceAdoptionPercent - prevQuarterData.adoptionPercent;
    const instanceGrowthPercent = prevQuarterData.totalFkpInstances > 0 ? 
        ((totalFkpInstances - prevQuarterData.totalFkpInstances) / prevQuarterData.totalFkpInstances) * 100 : 0;
    
    // Calculate growth projections for next quarter (FY26Q4)
    const growthProjections = calculateGrowthProjections();
    const projectedServiceAdoption = totalServices > 0 ? 
        ((servicesStage4Plus + growthProjections.services) / totalServices) * 100 : 0;
    const projectedInstanceAdoption = totalInstances > 0 ? 
        ((totalFkpInstances + growthProjections.instances) / totalInstances) * 100 : 0;
    
    // Log the unified metrics (SINGLE SOURCE OF TRUTH)
    console.log('📊 UNIFIED METRICS CALCULATION (SINGLE FUNCTION - PERFECT CONSISTENCY):', {
        method: 'Both quarters calculated in renderServiceInformationMetrics() using IDENTICAL filtering',
        current: {
            totalInstances: totalInstances,
            fkpInstances: totalFkpInstances,
            adoption: `${serviceInstanceAdoptionPercent.toFixed(1)}%`,
            serviceCount: totalServices
        },
        previous: {
            totalInstances: prevQuarterData.totalInstances,
            fkpInstances: prevQuarterData.totalFkpInstances,
            adoption: `${prevQuarterData.adoptionPercent.toFixed(1)}%`,
            serviceCount: prevQuarterData.serviceCount
        },
        growth: {
            instances: `${instanceGrowth >= 0 ? '+' : ''}${instanceGrowth.toLocaleString()} FKP instances`,
            adoptionPoints: `${adoptionGrowth >= 0 ? '+' : ''}${adoptionGrowth.toFixed(1)}% (percentage points)`,
            instancesPercent: `${instanceGrowthPercent >= 0 ? '+' : ''}${instanceGrowthPercent.toFixed(1)}%`
        },
        consistency: 'GUARANTEED - Both quarters use getFilteredServicesForServiceInfo() with IDENTICAL logic'
    });
    
    console.log('🚀 Growth Projections:', {
        servicesCompletingMigration: growthProjections.services,
        instancesCompletingMigration: growthProjections.instances,
        currentServiceAdoption: serviceTypeAdoptionPercent,
        projectedServiceAdoption: projectedServiceAdoption,
        currentInstanceAdoption: serviceInstanceAdoptionPercent,
        projectedInstanceAdoption: projectedInstanceAdoption
    });
    
    const html = `
        <div class="service-deep-dive-metrics">
            <!-- Instance Adoption Card -->
            <div class="adoption-card instance-adoption-card">
                <div class="adoption-header">
                    <div class="adoption-percentage">
                        ${serviceInstanceAdoptionPercent.toFixed(2)}%
                        ${projectedInstanceAdoption > serviceInstanceAdoptionPercent ? `<span class="growth-indicator">→ ${projectedInstanceAdoption.toFixed(1)}%</span>` : ''}
                    </div>
                    <div class="adoption-title">Instance Adoption</div>
                    <div class="adoption-subtitle">Production Environment</div>
                </div>
                <div class="adoption-details">
                    <div class="detail-row">
                        <span class="detail-label">Total Instances</span>
                        <span class="detail-value">${totalInstances.toLocaleString()}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">FKP Instances</span>
                        <span class="detail-value">
                            ${totalFkpInstances.toLocaleString()}
                            ${growthProjections.instances > 0 ? `<span class="growth-indicator">+${growthProjections.instances.toLocaleString()}</span>` : ''}
                        </span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Self Managed</span>
                        <span class="detail-value">${(totalInstances - totalFkpInstances).toLocaleString()}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Growth This Q</span>
                        <span class="detail-value">
                            ${adoptionGrowth >= 0 ? '+' : ''}${adoptionGrowth.toFixed(1)}% 
                            <span style="font-size: 0.65rem; color: #6b7280;">
                                (${instanceGrowth >= 0 ? '+' : ''}${instanceGrowth.toLocaleString()} FKP instances from prev Q)
                            </span>
                        </span>
                    </div>
                </div>
            </div>

            <!-- Service Adoption Card -->
            <div class="adoption-card service-adoption-card">
                <div class="adoption-header">
                    <div class="adoption-percentage">
                        ${serviceTypeAdoptionPercent.toFixed(2)}%
                        ${projectedServiceAdoption > serviceTypeAdoptionPercent ? `<span class="growth-indicator">→ ${projectedServiceAdoption.toFixed(1)}%</span>` : ''}
                    </div>
                    <div class="adoption-title">Service Adoption</div>
                    <div class="adoption-subtitle">Combined Commercial & GovCloud</div>
                </div>
                <div class="adoption-details">
                    <div class="detail-row">
                        <span class="detail-label">Total Services</span>
                        <span class="detail-value">
                            ${totalServices.toLocaleString()}
                            ${growthProjections.services > 0 ? `<span class="growth-indicator">+${growthProjections.services.toLocaleString()}</span>` : ''}
                        </span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Migration Not Started</span>
                        <span class="detail-value">${totalServices - servicesPreProdProgress - servicesProdProgress - servicesMigrationComplete}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Pre-Prod Progress</span>
                        <span class="detail-value">${servicesPreProdProgress}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Prod Progress</span>
                        <span class="detail-value">${servicesProdProgress}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Migration Complete</span>
                        <span class="detail-value">${servicesMigrationComplete}</span>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    metricsContainer.innerHTML = html;
}

/**
 * Render Service Information tab
 */
function renderServiceInformation() {
    console.log('🔧 Rendering Service Information');
    
    // Render metrics first
    renderServiceInformationMetrics();
    
    const container = document.getElementById('service-table-container');
    
    const filteredServices = getFilteredServicesForServiceInfo();
    
    // Sort services
    const sortedServices = sortServices(filteredServices);
    
    let html = `
        <div class="service-info-header">
            <h3>Services (${sortedServices.length})</h3>
            <p>Filtered by current selections • Sorted by ${getSortDisplayName()}</p>
        </div>
        <table class="service-table enhanced">
            <thead>
                <tr>
                    <th>Service Name</th>
                    <th class="adoption-col">Instance Adoption %</th>
                    <th>Org Leader</th>
                    <th>Parent Cloud</th>
                    <th>Cloud</th>
                    <th>Team</th>
                    <th class="number-col">Total Instances</th>
                    <th class="number-col">Instances on FKP</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    sortedServices.forEach(service => {
        const adoptionRate = service.instanceAdoption || 0;
        const adoptionClass = adoptionRate >= 80 ? 'high' : adoptionRate >= 50 ? 'medium' : 'low';
        
        html += `
            <tr>
                <td class="service-name-col">
                    <a href="#" class="service-link" onclick="showServiceDetails('${service.name}')">
                        ${service.name}
                    </a>
                </td>
                <td class="adoption-col">
                    <div class="adoption-badge ${adoptionClass}">
                        ${adoptionRate.toFixed(1)}%
                    </div>
                </td>
                <td class="org-col">${service.orgLeader}</td>
                <td class="cloud-col">${service.parentCloud}</td>
                <td class="cloud-col">${service.cloud}</td>
                <td class="team-col">${service.team}</td>
                <td class="number-col">${service.totalInstances || 0}</td>
                <td class="number-col">${service.fkpInstances || 0}</td>
            </tr>
        `;
    });
    
    html += '</tbody></table>';
    
    if (sortedServices.length === 0) {
        html = `
            <div class="no-services-message">
                <div class="placeholder-icon">🔍</div>
                <h3>No Services Found</h3>
                <p>No services match the current filter criteria. Try adjusting your filters.</p>
            </div>
        `;
    }
    
    container.innerHTML = html;
}

/**
 * Get filtered services for Service Information tab (includes migration stage filter)
 */
function getFilteredServicesForServiceInfo() {
    const processed = fkpDashboard.data.processed;
    const filters = fkpDashboard.filters;
    
    const filteredServices = [];
    
    processed.services.forEach(service => {
        // Apply all organizational filters
        if (filters.orgLeader.length > 0 && !filters.orgLeader.includes(service.orgLeader)) return;
        if (filters.parentCloud.length > 0 && !filters.parentCloud.includes(service.parentCloud)) return;
        if (filters.cloud.length > 0 && !filters.cloud.includes(service.cloud)) return;
        if (filters.team.length > 0 && !filters.team.includes(service.team)) return;
        if (filters.service.length > 0 && !filters.service.includes(service.name)) return;
        
        // Apply migration stage filter
        const migrationStage = calculateServiceMigrationStageNumber(service);
        const migrationStageText = getMigrationStageText(migrationStage);
        if (filters['migration-stage'].length > 0 && !filters['migration-stage'].includes(migrationStageText)) return;
        
        // Check if service has instances matching customer type and environment filters
        const relevantInstances = service.instances.filter(instance => {
            const matchesCustomerType = filters.customerType.includes(instance.customerType);
            const matchesEnv = filters.instanceEnv.includes(instance.isProd ? 'Prod' : 'Pre-Prod');
            return matchesCustomerType && matchesEnv;
        });
        
        if (relevantInstances.length === 0) return;
        
        // Calculate filtered statistics
        const fkpRelevantInstances = relevantInstances.filter(instance => instance.isFKP);
        
        const enhancedService = {
            ...service,
            totalInstances: relevantInstances.length,
            fkpInstances: fkpRelevantInstances.length,
            instanceAdoption: relevantInstances.length > 0 ? 
                (fkpRelevantInstances.length / relevantInstances.length) * 100 : 0,
            migrationStage: migrationStage
        };
        
        filteredServices.push(enhancedService);
    });
    
    return filteredServices;
}

/**
 * Sort services based on current sort settings
 */
function sortServices(services) {
    const { sortBy, sortOrder } = fkpDashboard.state;
    
    const sorted = [...services].sort((a, b) => {
        let aVal, bVal;
        
        switch (sortBy) {
            case 'totalInstances':
                aVal = a.totalInstances || 0;
                bVal = b.totalInstances || 0;
                break;
            case 'instanceAdoption':
                aVal = a.instanceAdoption || 0;
                bVal = b.instanceAdoption || 0;
                break;
            case 'fkpInstances':
                aVal = a.fkpInstances || 0;
                bVal = b.fkpInstances || 0;
                break;
            case 'migrationStage':
                aVal = a.migrationStage || 0;
                bVal = b.migrationStage || 0;
                break;
            case 'serviceName':
                aVal = a.name || '';
                bVal = b.name || '';
                return sortOrder === 'desc' ? bVal.localeCompare(aVal) : aVal.localeCompare(bVal);
            case 'orgLeader':
                aVal = a.orgLeader || '';
                bVal = b.orgLeader || '';
                return sortOrder === 'desc' ? bVal.localeCompare(aVal) : aVal.localeCompare(bVal);
            default:
                aVal = a.totalInstances || 0;
                bVal = b.totalInstances || 0;
        }
        
        return sortOrder === 'desc' ? bVal - aVal : aVal - bVal;
    });
    
    return sorted;
}

/**
 * Get display name for current sort
 */
function getSortDisplayName() {
    const { sortBy, sortOrder } = fkpDashboard.state;
    const names = {
        totalInstances: 'Total Instances',
        instanceAdoption: 'Instance Adoption %',
        fkpInstances: 'FKP Instances', 
        migrationStage: 'Migration Stage',
        serviceName: 'Service Name',
        orgLeader: 'Org Leader'
    };
    return `${names[sortBy] || 'Total Instances'} (${sortOrder.toUpperCase()})`;
}

/**
 * Get migration stage text
 */
function getMigrationStageText(stage) {
    const stageTexts = {
        1: 'Not Started',
        2: 'Pre-Prod Progress', 
        3: 'Parity Required',
        4: 'Prod Progress',
        5: 'Prod Complete',
        6: 'Mesh Complete'
    };
    return stageTexts[stage] || 'Unknown Stage';
}

/**
 * Set sort criteria
 */
function setSortBy(sortBy) {
    fkpDashboard.state.sortBy = sortBy;
    refreshCurrentTab();
}

/**
 * Toggle sort order
 */
function toggleSortOrder() {
    fkpDashboard.state.sortOrder = fkpDashboard.state.sortOrder === 'desc' ? 'asc' : 'desc';
    updateViewControls(fkpDashboard.state.currentTab);
    refreshCurrentTab();
}

/**
 * Show service details modal
 */
function showServiceDetails(serviceName) {
    console.log('🔍 Showing details for service:', serviceName);
    
    // Check both regular services and integration services
    let service = fkpDashboard.data.processed.services.get(serviceName);
    let isIntegration = false;
    
    if (!service) {
        service = fkpDashboard.data.processed.integrationServices.get(serviceName);
        isIntegration = true;
    }
    
    if (!service) {
        console.error('Service not found in regular or integration services:', serviceName);
        return;
    }
    
    // Calculate migration stage
    const migrationStage = calculateServiceMigrationStageNumber(service);
    const migrationStageText = getMigrationStageText(migrationStage);
    
    // Separate instances by customer type and environment
    const customerTypes = {
        Commercial: service.instances.filter(i => i.customerType === 'Commercial'),
        GIA: service.instances.filter(i => i.customerType === 'GIA'),
        BlackJack: service.instances.filter(i => i.customerType === 'BlackJack')
    };
    
    // Initial modal state
    let currentEnv = 'Both'; // Prod, Pre-Prod, Both
    
    const modalHTML = `
        <!-- Compact Pills Metrics -->
        <div class="service-modal-pills">
            <div class="service-metric-pill adoption-pill">
                <span class="pill-value">${service.instanceAdoption.toFixed(1)}%</span>
                <span class="pill-label">Adoption</span>
            </div>
            <div class="service-metric-pill total-pill">
                <span class="pill-value">${service.stats.total}</span>
                <span class="pill-label">Total</span>
            </div>
            <div class="service-metric-pill fkp-pill">
                <span class="pill-value">${service.stats.fkp}</span>
                <span class="pill-label">FKP</span>
            </div>
            <div class="service-metric-pill migration-pill migration-stage-${migrationStage}">
                <span class="pill-value">${migrationStageText}</span>
                <span class="pill-label">Stage</span>
            </div>
        </div>
        
        <!-- Environment Toggle -->
        <div class="env-toggle">
            <label>Environment Filter:</label>
            <div class="env-toggle-buttons">
                <button class="env-toggle-btn active" onclick="toggleServiceEnv('Both', '${serviceName}')">Both</button>
                <button class="env-toggle-btn" onclick="toggleServiceEnv('Prod', '${serviceName}')">Prod</button>
                <button class="env-toggle-btn" onclick="toggleServiceEnv('Pre-Prod', '${serviceName}')">Pre-Prod</button>
            </div>
        </div>
        
        <!-- Customer Type Tabs -->
        <div class="service-modal-tabs">
            <button class="service-modal-tab active" onclick="switchServiceTab('Commercial', '${serviceName}')">
                Commercial (${customerTypes.Commercial.length})
            </button>
            <button class="service-modal-tab" onclick="switchServiceTab('GIA', '${serviceName}')">
                GIA (${customerTypes.GIA.length})
            </button>
            <button class="service-modal-tab" onclick="switchServiceTab('BlackJack', '${serviceName}')">
                BlackJack (${customerTypes.BlackJack.length})
            </button>
        </div>
        
        <!-- Tab Content -->
        <div id="tab-Commercial" class="service-modal-tab-content active">
            ${renderCustomerTypeTab(customerTypes.Commercial, 'Commercial', currentEnv)}
        </div>
        <div id="tab-GIA" class="service-modal-tab-content">
            ${renderCustomerTypeTab(customerTypes.GIA, 'GIA', currentEnv)}
        </div>
        <div id="tab-BlackJack" class="service-modal-tab-content">
            ${renderCustomerTypeTab(customerTypes.BlackJack, 'BlackJack', currentEnv)}
        </div>
    `;
    
    document.getElementById('modal-service-name').textContent = serviceName;
    document.getElementById('modal-service-body').innerHTML = modalHTML;
    document.getElementById('service-detail-modal').style.display = 'block';
}

/**
 * Render customer type tab content
 */
function renderCustomerTypeTab(instances, customerType, envFilter) {
    // Filter instances by environment
    let filteredInstances = instances;
    if (envFilter === 'Prod') {
        filteredInstances = instances.filter(i => i.isProd);
    } else if (envFilter === 'Pre-Prod') {
        filteredInstances = instances.filter(i => i.isPreProd);
    }
    
    const totalInstances = filteredInstances.length;
    const fkpInstances = filteredInstances.filter(i => i.isFKP).length;
    const adoptionRate = totalInstances > 0 ? (fkpInstances / totalInstances) * 100 : 0;
    
    // Group instances by FI/FD
    const instanceGroups = new Map();
    filteredInstances.forEach(instance => {
        const key = `${instance.fi}|||${instance.fd}`;
        if (!instanceGroups.has(key)) {
            instanceGroups.set(key, []);
        }
        instanceGroups.get(key).push(instance);
    });
    
    let tabHTML = `
        <!-- Mini Metrics for this customer type -->
        <div class="service-modal-metrics" style="margin-bottom: 1rem; grid-template-columns: repeat(3, 1fr);">
            <div class="service-metric-card" style="padding: 1rem;">
                <div class="service-metric-value" style="font-size: 1.5rem;">${adoptionRate.toFixed(1)}%</div>
                <div class="service-metric-label">Adoption Rate</div>
            </div>
            <div class="service-metric-card" style="padding: 1rem;">
                <div class="service-metric-value" style="font-size: 1.5rem;">${totalInstances}</div>
                <div class="service-metric-label">Total Instances</div>
            </div>
            <div class="service-metric-card" style="padding: 1rem;">
                <div class="service-metric-value" style="font-size: 1.5rem;">${fkpInstances}</div>
                <div class="service-metric-label">FKP Instances</div>
            </div>
        </div>
    `;
    
    if (instanceGroups.size === 0) {
        tabHTML += `
            <div style="text-align: center; padding: 2rem; color: #6b7280;">
                <div style="font-size: 1.5rem; margin-bottom: 0.5rem;">📭</div>
                <div>No ${customerType} instances found for the selected environment filter.</div>
            </div>
        `;
    } else {
        tabHTML += `
            <table class="service-instances-table">
                <thead>
                    <tr>
                        <th>Falcon Instance</th>
                        <th>Functional Domain</th>
                        <th>Cluster</th>
                        <th>Instance Count</th>
                        <th>FKP Count</th>
                        <th>Adoption Rate</th>
                    </tr>
                </thead>
                <tbody>
        `;
        
        // Sort by FI name
        const sortedGroups = Array.from(instanceGroups.entries())
            .sort((a, b) => a[0].localeCompare(b[0]));
        
        sortedGroups.forEach(([key, groupInstances]) => {
            const [fi, fd] = key.split('|||');
            const groupTotal = groupInstances.length;
            const groupFKP = groupInstances.filter(i => i.isFKP).length;
            const groupAdoption = groupTotal > 0 ? (groupFKP / groupTotal) * 100 : 0;
            
            // Group by cluster within this FI/FD
            const clusterGroups = new Map();
            groupInstances.forEach(instance => {
                const cluster = instance.cluster;
                if (!clusterGroups.has(cluster)) {
                    clusterGroups.set(cluster, 0);
                }
                clusterGroups.set(cluster, clusterGroups.get(cluster) + 1);
            });
            
            const clusterList = Array.from(clusterGroups.entries())
                .map(([cluster, count]) => `${cluster} (${count})`)
                .join(', ');
            
            tabHTML += `
                <tr>
                    <td><strong>${fi}</strong></td>
                    <td>${fd}</td>
                    <td>${clusterList}</td>
                    <td>${groupTotal}</td>
                    <td>${groupFKP}</td>
                    <td>
                        <span class="adoption-badge ${groupAdoption >= 80 ? 'high' : groupAdoption > 0 ? 'medium' : 'low'}">
                            ${groupAdoption.toFixed(1)}%
                        </span>
                    </td>
                </tr>
            `;
        });
        
        tabHTML += `
                </tbody>
            </table>
        `;
    }
    
    return tabHTML;
}

/**
 * Toggle environment filter in service modal
 */
function toggleServiceEnv(env, serviceName) {
    // Update button states
    document.querySelectorAll('.env-toggle-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');
    
    // Re-render all tabs with new environment filter
    const service = fkpDashboard.data.processed.services.get(serviceName);
    const customerTypes = {
        Commercial: service.instances.filter(i => i.customerType === 'Commercial'),
        GIA: service.instances.filter(i => i.customerType === 'GIA'),
        BlackJack: service.instances.filter(i => i.customerType === 'BlackJack')
    };
    
    ['Commercial', 'GIA', 'BlackJack'].forEach(customerType => {
        const tabContent = document.getElementById(`tab-${customerType}`);
        if (tabContent) {
            tabContent.innerHTML = renderCustomerTypeTab(customerTypes[customerType], customerType, env);
        }
    });
}

/**
 * Switch customer type tab in service modal
 */
function switchServiceTab(customerType, serviceName) {
    // Update tab button states
    document.querySelectorAll('.service-modal-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    event.target.classList.add('active');
    
    // Update tab content states
    document.querySelectorAll('.service-modal-tab-content').forEach(content => {
        content.classList.remove('active');
    });
    document.getElementById(`tab-${customerType}`).classList.add('active');
}

/**
 * Calculate migration stage for a specific service
 */
function calculateServiceMigrationStage(service) {
    const stats = service.stats;
    
    if (stats.fkp === 0) {
        return 'Stage 1: Not Started';
    } else if (stats.fkpProd === 0 && stats.fkpPreProd > 0) {
        return 'Stage 2: FKP Pre-Prod Progress';
    } else if (hasParityRequirements(service.name)) {
        return 'Stage 3: Parity Required';
    } else if (stats.fkpProd > 0 && stats.fkpProd < stats.prod) {
        return 'Stage 4: FKP Prod Progress';
    } else if (stats.fkpProd === stats.prod && stats.prod > 0) {
        if (service.meshEnabled) {
            return 'Stage 6: FKP + Mesh Complete';
        } else {
            return 'Stage 5: FKP Prod Complete';
        }
    }
    
    return 'Unknown Stage';
}

/**
 * Utility functions
 */
function showLoading(show) {
    // Loading indicator element removed - function kept for compatibility but does nothing
    // const indicator = document.getElementById('loading-indicator');
    // if (indicator) {
    //     indicator.style.display = show ? 'flex' : 'none';
    // }
}

function showError(message) {
    console.error('❌ Dashboard Error:', message);
    
    // Display error in the main content area
    const contentAreas = [
        document.getElementById('executive-metrics'),
        document.getElementById('pipeline-stages'), 
        document.getElementById('service-table-container')
    ];
    
    contentAreas.forEach(area => {
        if (area) {
            area.innerHTML = `
                <div class="placeholder-message">
                    <div class="placeholder-icon">❌</div>
                    <h3>Error Loading Data</h3>
                    <p>${message}</p>
                    <button onclick="location.reload()" style="margin-top: 1rem; padding: 0.5rem 1rem; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer;">
                        Reload Page
                    </button>
                </div>
            `;
        }
    });
}

function toggleDropdown(filterId) {
    const dropdown = document.getElementById(`${filterId}-dropdown`);
    const isOpen = dropdown.style.display === 'block';
    
    // If opening this dropdown, track it and reset selection mode
    if (!isOpen) {
        fkpDashboard.state.activeDropdown = filterId;
        fkpDashboard.state.dropdownSelectionMode = false;
        console.log(`📂 Opening dropdown: ${filterId}`);
        
        // Clear any pending selection timer
        if (fkpDashboard.state.selectionTimer) {
            clearTimeout(fkpDashboard.state.selectionTimer);
            fkpDashboard.state.selectionTimer = null;
        }
    } else {
        // Closing dropdown - trigger final update if needed
        if (fkpDashboard.state.dropdownSelectionMode) {
            console.log(`📂 Closing dropdown: ${filterId} - final update`);
            fkpDashboard.state.dropdownSelectionMode = false;
            debouncedRefresh();
        }
        fkpDashboard.state.activeDropdown = null;
    }
    
    // Close all dropdowns first
    document.querySelectorAll('.dropdown-content').forEach(dd => {
        dd.style.display = 'none';
    });
    
    // Toggle current dropdown
    dropdown.style.display = isOpen ? 'none' : 'block';
}

/**
 * Convert kebab-case to camelCase for filter keys
 */
function kebabToCamel(str) {
    return str.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
}

function toggleSelectAll(filterId) {
    // Prevent loops during programmatic updates
    if (fkpDashboard.state.updatingFilters) {
        return;
    }
    
    // Convert kebab-case HTML ID to camelCase filter key
    const filterKey = kebabToCamel(filterId);
    console.log(`🔄 Toggle Select All for: ${filterId} (${filterKey})`);
    
    const dropdown = document.getElementById(`${filterId}-dropdown`);
    if (!dropdown) return;
    
    const selectAllCheckbox = dropdown.querySelector('.select-all input');
    const optionCheckboxes = dropdown.querySelectorAll('.option input');
    
    const shouldSelectAll = selectAllCheckbox.checked;
    
    // Prevent event loops
    fkpDashboard.state.updatingFilters = true;
    
    // Update the filter array directly
    if (shouldSelectAll) {
        fkpDashboard.filters[filterKey] = [...fkpDashboard.state.filterOptions[filterKey]];
    } else {
        fkpDashboard.filters[filterKey] = [];
    }
    
    // Update checkboxes to match
    optionCheckboxes.forEach(checkbox => {
        if (!checkbox.disabled) {
            checkbox.checked = shouldSelectAll;
        }
    });
    
    // Update selected text
    updateFilterSelectedText(filterKey);
    
    fkpDashboard.state.updatingFilters = false;
    
    console.log(`✅ Select All ${filterKey}: ${shouldSelectAll} (${fkpDashboard.filters[filterKey].length} items)`);
    
    // For Select All actions, trigger immediate update (this is usually intentional)
    // Clear any selection timers since this is a decisive action
    if (fkpDashboard.state.selectionTimer) {
        clearTimeout(fkpDashboard.state.selectionTimer);
        fkpDashboard.state.selectionTimer = null;
    }
    
    // Reset selection mode and trigger update
    fkpDashboard.state.dropdownSelectionMode = false;
    console.log('🚀 Select All action - triggering immediate update');
    debouncedRefresh();
}

function resetAllFilters() {
    console.log('🔄 Resetting all filters');
    
    // Prevent event loops during reset
    fkpDashboard.state.updatingFilters = true;
    
    // Reset filter state to defaults
    Object.keys(fkpDashboard.filters).forEach(filterKey => {
        if (['substrate', 'customerType'].includes(filterKey)) {
            // Keep default values for these
            return;
        }
        if (filterKey === 'instanceEnv') {
            fkpDashboard.filters[filterKey] = ['Prod']; // Reset to Prod only
            return;
        }
        if (filterKey === 'migration-stage') {
            fkpDashboard.filters[filterKey] = ['Not Started', 'Pre-Prod Progress', 'Parity Required', 'Prod Progress', 'Prod Complete', 'Mesh Complete']; // Reset to all stages
            return;
        }
        // For others, select all available options
        if (fkpDashboard.state.filterOptions[filterKey]) {
            fkpDashboard.filters[filterKey] = [...fkpDashboard.state.filterOptions[filterKey]];
        }
    });
    
    // Repopulate all dropdowns with original full options (like initial page load)
    Object.keys(fkpDashboard.state.filterOptions).forEach(filterKey => {
        console.log(`🔄 Repopulating ${filterKey} with ${fkpDashboard.state.filterOptions[filterKey]?.length || 0} original options`);
        populateFilterDropdown(filterKey, fkpDashboard.state.filterOptions[filterKey]);
    });
    
    // Update filter selected text to reflect current selections
    Object.keys(fkpDashboard.filters).forEach(filterKey => {
        updateFilterSelectedText(filterKey);
    });
    
    fkpDashboard.state.updatingFilters = false;
    
    console.log('✅ All filters reset');
    refreshCurrentTab();
}


function closeServiceModal() {
    document.getElementById('service-detail-modal').style.display = 'none';
}

// Close dropdowns when clicking outside
document.addEventListener('click', function(event) {
    if (!event.target.closest('.filter-dropdown')) {
        // Check if we were in selection mode before closing
        const wasSelecting = fkpDashboard.state.dropdownSelectionMode;
        const activeDropdown = fkpDashboard.state.activeDropdown;
        
        // Close all dropdowns
        document.querySelectorAll('.dropdown-content').forEach(dd => {
            dd.style.display = 'none';
        });
        
        // If user was multi-selecting and clicked outside, trigger final update
        if (wasSelecting && activeDropdown) {
            console.log('📂 Click outside - completing multi-selection');
            fkpDashboard.state.dropdownSelectionMode = false;
            if (fkpDashboard.state.selectionTimer) {
                clearTimeout(fkpDashboard.state.selectionTimer);
                fkpDashboard.state.selectionTimer = null;
            }
            debouncedRefresh();
        }
        
        // Reset dropdown state
        fkpDashboard.state.activeDropdown = null;
        fkpDashboard.state.dropdownSelectionMode = false;
    }
});

// Close modal when clicking outside
window.addEventListener('click', function(event) {
    const modal = document.getElementById('service-detail-modal');
    if (event.target === modal) {
        closeServiceModal();
    }
});

/**
 * Render Integration Services tab
 */
function renderIntegrations() {
    if (!fkpDashboard.data.processed) {
        console.error('❌ No processed data available for Integration Services rendering');
        return;
    }
    
    console.log('🔧 Rendering Integration Services...');
    
    // Check if integration tab is active and visible
    const integrationsTab = document.getElementById('integrations');
    if (integrationsTab) {
        debugLog('🔧 DEBUG: Integration tab found, visibility:', window.getComputedStyle(integrationsTab).display);
        debugLog('🔧 DEBUG: Integration tab classes:', integrationsTab.className);
    } else {
        console.error('❌ Integration tab not found in DOM');
    }
    
    renderIntegrationsMetrics();
    renderIntegrationsTable();
    
    console.log('🔧 ✅ Integration rendering complete');
}

/**
 * Render Integration Services metrics
 */
function renderIntegrationsMetrics() {
    const metricsContainer = document.getElementById('integrations-metrics');
    if (!metricsContainer) {
        console.error('❌ Integration metrics container not found');
        return;
    }
    
    const integrationServices = Array.from(fkpDashboard.data.processed.integrationServices.values());
    debugLog('🔧 DEBUG Integration Metrics: Found', integrationServices.length, 'integration services');
    debugLog('🔧 DEBUG Integration Services:', integrationServices.map(s => s.name));
    
    const totalIntegrationServices = integrationServices.length;
    const totalInstances = integrationServices.reduce((sum, service) => sum + service.stats.total, 0);
    const fkpInstances = integrationServices.reduce((sum, service) => sum + service.stats.fkp, 0);
    
    debugLog('🔧 DEBUG Metrics:', {
        totalServices: totalIntegrationServices,
        totalInstances: totalInstances,
        fkpInstances: fkpInstances
    });
    
    const html = `
        <div class="integrations-metrics">
            <div class="metrics-row">
                <div class="metric-card total">
                    <div class="metric-value">${totalIntegrationServices}</div>
                    <div class="metric-label">Total Integration Services</div>
                    <div class="metric-subtitle">excluded from adoption metrics</div>
                </div>
                <div class="metric-card total-instances">
                    <div class="metric-value">${totalInstances.toLocaleString()}</div>
                    <div class="metric-label">Total Instances</div>
                    <div class="metric-subtitle">across all integration services</div>
                </div>
                <div class="metric-card fkp-instances">
                    <div class="metric-value">${fkpInstances.toLocaleString()}</div>
                    <div class="metric-label">FKP Instances</div>
                    <div class="metric-subtitle">on platform</div>
                </div>
            </div>
        </div>
    `;
    
    metricsContainer.innerHTML = html;
    debugLog('🔧 DEBUG: Metrics container after innerHTML:', metricsContainer);
    debugLog('🔧 DEBUG: Metrics container children.length:', metricsContainer.children.length);
    debugLog('🔧 DEBUG: Metrics container visibility:', window.getComputedStyle(metricsContainer).display);
    console.log('📊 Rendered integration metrics successfully');
}

/**
 * Render Integration Services table
 */
function renderIntegrationsTable() {
    const tableContainer = document.getElementById('integrations-table-container');
    if (!tableContainer) {
        console.error('❌ Integration table container not found');
        return;
    }
    
    const integrationServices = getFilteredIntegrationServices();
    debugLog('🔧 DEBUG Integration Table: Found', integrationServices.length, 'filtered integration services');
    
    if (integrationServices.length === 0) {
        debugLog('🔧 DEBUG: No integration services found, showing empty state');
        debugLog('🔧 DEBUG: Total integration services in data:', fkpDashboard.data.processed?.integrationServices?.size || 0);
        tableContainer.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">🔧</div>
                <h3>No Integration Services Found</h3>
                <p>No integration services match the current filter criteria.</p>
                <p><strong>Debug:</strong> Expected integration services: ${INTEGRATION_SERVICES.join(', ')}</p>
            </div>
        `;
        return;
    }
    
    const tableHtml = `
        <div class="integrations-table-wrapper">
            <table class="integrations-table">
                <thead>
                    <tr>
                        <th class="service-name-col">Service Name</th>
                        <th>Org Leader</th>
                        <th>Parent Cloud</th>
                        <th>Cloud</th>
                        <th>Team</th>
                        <th>Total Instances</th>
                        <th>FKP Instances</th>
                    </tr>
                </thead>
                <tbody>
                    ${integrationServices.map(service => {
                        return `
                            <tr onclick="showServiceDetails('${service.name}')">
                                <td class="service-name-col">
                                    <strong>${service.name}</strong>
                                </td>
                                <td>${service.orgLeader}</td>
                                <td>${service.parentCloud}</td>
                                <td>${service.cloud}</td>
                                <td>${service.team}</td>
                                <td>${service.stats.total.toLocaleString()}</td>
                                <td>${service.stats.fkp.toLocaleString()}</td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        </div>
    `;
    
    tableContainer.innerHTML = tableHtml;
    console.log(`📊 Rendered integration services table with ${integrationServices.length} services`);
    debugLog('🔧 DEBUG: tableContainer after innerHTML:', tableContainer);
    debugLog('🔧 DEBUG: tableContainer.children.length:', tableContainer.children.length);
    debugLog('🔧 DEBUG: tableContainer visibility:', window.getComputedStyle(tableContainer).display);
}

/**
 * Get filtered integration services based on current filters
 */
function getFilteredIntegrationServices() {
    if (!fkpDashboard.data.processed || !fkpDashboard.data.processed.integrationServices) {
        debugLog('🔧 DEBUG Filter: No integration services data available');
        return [];
    }
    
    const filters = fkpDashboard.filters;
    const allIntegrationServices = Array.from(fkpDashboard.data.processed.integrationServices.values());
    
    debugLog('🔧 DEBUG Filter: Starting with', allIntegrationServices.length, 'integration services');
    debugLog('🔧 DEBUG Filter: Current filters:', filters);
    
    const filteredServices = allIntegrationServices.filter(service => {
        debugLog(`🔧 DEBUG Filter: Checking service ${service.name}:`, {
            orgLeader: service.orgLeader,
            parentCloud: service.parentCloud,
            cloud: service.cloud,
            team: service.team,
            stats: service.stats
        });
        
        // For integration services, only apply basic filters (substrate, customerType, instanceEnv)
        // Skip organizational filters (orgLeader, parentCloud, cloud, team, service) since these are in a dedicated tab
        
        if (filters.substrate.length > 0 && !filters.substrate.includes('AWS')) {
            debugLog(`🔧 DEBUG Filter: ${service.name} filtered out by substrate`);
            return false;
        }
        
        if (filters.customerType.length > 0) {
            const hasValidCustomerType = filters.customerType.some(type => {
                switch(type) {
                    case 'Commercial': return service.stats.commercial > 0;
                    case 'GIA': return service.stats.gia > 0;
                    case 'BlackJack': return service.stats.blackjack > 0;
                    default: return false;
                }
            });
            if (!hasValidCustomerType) {
                debugLog(`🔧 DEBUG Filter: ${service.name} filtered out by customerType (${filters.customerType}) - stats:`, {
                    commercial: service.stats.commercial,
                    gia: service.stats.gia,
                    blackjack: service.stats.blackjack
                });
                return false;
            }
        }
        
        if (filters.instanceEnv.length > 0) {
            const hasValidEnv = filters.instanceEnv.some(env => {
                switch(env) {
                    case 'Prod': return service.stats.prod > 0;
                    case 'Pre-Prod': return service.stats.preProd > 0;
                    default: return false;
                }
            });
            if (!hasValidEnv) {
                debugLog(`🔧 DEBUG Filter: ${service.name} filtered out by instanceEnv (${filters.instanceEnv}) - stats:`, {
                    prod: service.stats.prod,
                    preProd: service.stats.preProd
                });
                return false;
            }
        }
        
        debugLog(`🔧 DEBUG Filter: ✅ ${service.name} passed all filters (integration services use permissive filtering)`);
        return true;
    });
    
    debugLog(`🔧 DEBUG Filter: Final result: ${filteredServices.length} services passed filtering`);
    return filteredServices;
}

/**
 * Export Integration Services table to CSV
 */
function exportIntegrationsToCSV() {
    const integrationServices = getFilteredIntegrationServices();
    
    if (integrationServices.length === 0) {
        alert('No integration services to export based on current filters.');
        return;
    }
    
    const headers = [
        'Service Name',
        'Instance Adoption %',
        'Org Leader', 
        'Parent Cloud',
        'Cloud',
        'Team',
        'Total Instances',
        'FKP Instances'
    ];
    
    const csvContent = [
        headers.join(','),
        ...integrationServices.map(service => {
            const instanceAdoption = service.stats.total > 0 ? 
                (service.stats.fkp / service.stats.total) * 100 : 0;
            
            return [
                `"${service.name}"`,
                instanceAdoption.toFixed(1),
                `"${service.orgLeader}"`,
                `"${service.parentCloud}"`,
                `"${service.cloud}"`,
                `"${service.team}"`,
                service.stats.total,
                service.stats.fkp
            ].join(',');
        })
    ].join('\\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `integration_services_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    console.log(`📊 Exported ${integrationServices.length} integration services to CSV`);
}

// Tab switching event listeners and initialization
function setLastRefreshedDate() {
    const lastRefreshedEl = document.getElementById('last-refreshed-date');
    if (lastRefreshedEl) {
        lastRefreshedEl.textContent = new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
    }
}

// Set immediately if DOM already ready (e.g. script loaded late or cached)
if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setLastRefreshedDate();
}

document.addEventListener('DOMContentLoaded', function() {
    console.log('📋 DOM Content Loaded - Setting up event listeners...');
    
    // Set Last Refreshed date (top right in Exec View)
    setLastRefreshedDate();
    // Run again after a short delay in case the header was not in DOM yet (e.g. dynamic layout)
    setTimeout(setLastRefreshedDate, 100);
    
    // Capture-phase delegation so sidebar clicks always work (even if per-element listeners fail)
    const sidebar = document.querySelector('.sidebar');
    if (sidebar) {
        document.addEventListener('click', function sidebarClickCapture(e) {
            if (!sidebar.contains(e.target)) return;
            const subitem = e.target.closest('.nav-subitem');
            if (subitem) {
                if (subitem.getAttribute('data-disabled') === 'true') {
                    if (subitem.getAttribute('data-tab') === 'runtime-availability-remediation') {
                        subitem.setAttribute('title', 'This is under construction');
                    }
                    return;
                }
                const tabName = subitem.getAttribute('data-tab');
                if (tabName) {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log('🔄 Tab clicked (delegate):', tabName);
                    try {
                        switchTab(tabName);
                        document.querySelectorAll('.nav-subitem').forEach(i => i.classList.remove('active'));
                        subitem.classList.add('active');
                        updateSidebarSection(tabName);
                    } catch (err) {
                        console.error('❌ Error switching tab:', err);
                    }
                }
                return;
            }
            const mainItem = e.target.closest('.nav-item.main-item');
            if (mainItem) {
                const tabName = mainItem.getAttribute('data-tab');
                if (tabName) {
                    e.preventDefault();
                    e.stopPropagation();
                    try {
                        if (tabName === 'exec-summary') {
                            setExecSummaryView();
                        } else {
                            switchTab(tabName);
                        }
                        document.querySelectorAll('.nav-subitems').forEach(list => list.classList.remove('active'));
                        document.querySelectorAll('.nav-item.main-item').forEach(m => m.classList.remove('active'));
                        mainItem.classList.add('active');
                    } catch (err) {
                        console.error('❌ Error on main nav click:', err);
                    }
                    return;
                }
                // Section expand/collapse (e.g. Runtime Scale, Runtime Availability) - no data-tab
                const section = mainItem.getAttribute('data-section');
                const subitems = section ? document.getElementById(section + '-subitems') : null;
                const wasActive = subitems && subitems.classList.contains('active');
                e.preventDefault();
                e.stopPropagation();
                document.querySelectorAll('.nav-subitems').forEach(list => list.classList.remove('active'));
                document.querySelectorAll('.nav-item.main-item').forEach(m => m.classList.remove('active'));
                if (subitems && !wasActive) {
                    subitems.classList.add('active');
                    mainItem.classList.add('active');
                }
                return;
            }
        }, true);
        console.log('📋 Sidebar click delegation (capture) attached');
    }
    
    // Event listeners for sidebar navigation (keep for compatibility)
    document.querySelectorAll('.nav-subitem').forEach(item => {
        item.addEventListener('click', function(e) {
            if (this.getAttribute('data-disabled') === 'true') {
                if (this.getAttribute('data-tab') === 'runtime-availability-remediation') {
                    this.setAttribute('title', 'This is under construction');
                }
                return;
            }
            const tabName = this.getAttribute('data-tab');
            console.log('🔄 Tab clicked:', tabName);
            try {
                switchTab(tabName);
                document.querySelectorAll('.nav-subitem').forEach(i => i.classList.remove('active'));
                this.classList.add('active');
                updateSidebarSection(tabName);
            } catch (err) {
                console.error('❌ Error switching tab:', err);
            }
        });
    });
    
    // Handle main nav item click (expand/collapse)
    document.querySelectorAll('.nav-item.main-item').forEach(item => {
        item.addEventListener('click', function(e) {
            const tabName = this.getAttribute('data-tab');
            if (tabName) {
                try {
                    if (tabName === 'exec-summary') {
                        setExecSummaryView();
                    } else {
                        switchTab(tabName);
                    }
                    document.querySelectorAll('.nav-subitems').forEach(list => list.classList.remove('active'));
                    document.querySelectorAll('.nav-item.main-item').forEach(main => main.classList.remove('active'));
                    this.classList.add('active');
                } catch (err) {
                    console.error('❌ Error on main nav click:', err);
                }
                return;
            }
            
            const section = this.getAttribute('data-section');
            const subitems = document.getElementById(section + '-subitems');
            const wasActive = subitems && subitems.classList.contains('active');
            
            // Collapse all sections
            document.querySelectorAll('.nav-subitems').forEach(list => list.classList.remove('active'));
            document.querySelectorAll('.nav-item.main-item').forEach(main => main.classList.remove('active'));
            
            // Open current if it was closed
            if (subitems && !wasActive) {
                subitems.classList.add('active');
                this.classList.add('active');
            }
        });
    });
    
    console.log('🚀 Calling initializeFKPDashboard from DOMContentLoaded...');
    initializeFKPDashboard();
});

/**
 * Search dropdown options with 1-character activation
 * @param {string} filterKey - The filter key (e.g., 'orgLeader', 'parentCloud')
 * @param {string} searchTerm - The search term entered by user
 */
function searchDropdownOptions(filterKey, searchTerm) {
    const dropdownId = camelToKebab(filterKey);
    const dropdown = document.getElementById(`${dropdownId}-dropdown`);
    
    if (!dropdown) {
        console.warn(`⚠️ Dropdown not found for search: ${filterKey}`);
        return;
    }
    
    // Get all option elements (excluding select-all and search)
    const options = dropdown.querySelectorAll('.option');
    
    // If search term is empty, show all options
    if (searchTerm.length === 0) {
        options.forEach(option => {
            option.classList.remove('search-hidden');
            // Remove any highlighting
            const label = option.querySelector('label');
            if (label) {
                label.innerHTML = label.textContent; // Remove any HTML highlighting
            }
        });
        return;
    }
    
    // Filter options based on search term (case-insensitive)
    const searchLower = searchTerm.toLowerCase();
    let visibleCount = 0;
    
    options.forEach(option => {
        const label = option.querySelector('label');
        if (!label) return;
        
        const labelText = label.textContent || '';
        const isMatch = labelText.toLowerCase().includes(searchLower);
        
        if (isMatch) {
            option.classList.remove('search-hidden');
            visibleCount++;
            
            // Highlight matching text
            if (searchTerm.length >= 1) {
                const regex = new RegExp(`(${searchTerm})`, 'gi');
                const highlightedText = labelText.replace(regex, '<span class="search-highlight">$1</span>');
                label.innerHTML = highlightedText;
            }
        } else {
            option.classList.add('search-hidden');
            // Remove highlighting from hidden options
            label.innerHTML = label.textContent;
        }
    });
    
    console.log(`🔍 Search '${searchTerm}' in ${filterKey}: ${visibleCount} matches found`);
}

/**
 * Render Cross-Customer Analysis tab
 */
function renderCrossCustomerAnalysis() {
    console.log('🔄 Rendering Cross-Customer Analysis');
    
    const crossCustomerServices = getCrossCustomerServices();
    const filteredServices = applyCrossCustomerViewFilter(crossCustomerServices);
    
    // Render summary metrics
    renderCrossCustomerSummary(crossCustomerServices, filteredServices);
    
    // Render the analysis table
    renderCrossCustomerTable(filteredServices);
}

/**
 * Get services that exist across multiple customer types
 */
function getCrossCustomerServices() {
    const allServices = getFilteredServices(); // Respect current filters
    const crossCustomerServices = [];
    
    allServices.forEach(service => {
        // Check which customer types this service has instances in
        const customerTypes = ['Commercial', 'GIA', 'BlackJack'];
        const serviceCustomerTypes = [];
        
        customerTypes.forEach(customerType => {
            const hasInstances = service.instances.some(instance => 
                instance.customerType === customerType
            );
            if (hasInstances) {
                serviceCustomerTypes.push(customerType);
            }
        });
        
        // Only include services that span 2+ customer types
        if (serviceCustomerTypes.length >= 2) {
            // Calculate migration stage for each customer type
            const customerStages = {};
            serviceCustomerTypes.forEach(customerType => {
                const customerInstances = service.instances.filter(instance => 
                    instance.customerType === customerType
                );
                
                // Create a temporary service object for this customer type to calculate stage
                const tempService = {
                    ...service,
                    instances: customerInstances,
                    stats: calculateStatsForInstances(customerInstances)
                };
                
                customerStages[customerType] = calculateServiceMigrationStageNumber(tempService);
            });
            
            // Check if "Not Started" (Stage 1 in ALL customer environments)
            const isNotStarted = Object.values(customerStages).every(stage => stage === 1);
            
            // Check if "Complete" (Stage 5+ in ALL customer environments)
            const isComplete = Object.values(customerStages).every(stage => stage >= 5);
            
            // Check for discrepancy
            const hasDiscrepancy = checkForDiscrepancy(customerStages);
            
            // Check if "In-Progress" (Stage 4+ in ANY customer environment BUT NOT complete AND NOT discrepancy)
            const isInProgress = Object.values(customerStages).some(stage => stage >= 4) && !isComplete && !hasDiscrepancy;
            
            // DEBUG: Log complete services
            if (isComplete) {
                console.log(`✅ COMPLETE Service: ${service.name}`, {
                    customerStages,
                    customerTypes: serviceCustomerTypes
                });
            }
            
            crossCustomerServices.push({
                ...service,
                customerTypes: serviceCustomerTypes,
                customerStages: customerStages,
                hasDiscrepancy: hasDiscrepancy,
                isNotStarted: isNotStarted,
                isInProgress: isInProgress,
                isComplete: isComplete
            });
        }
    });
    
    console.log(`🔄 Found ${crossCustomerServices.length} cross-customer services`);
    return crossCustomerServices;
}

/**
 * Calculate stats for a set of instances
 */
function calculateStatsForInstances(instances) {
    const stats = {
        total: instances.length,
        prod: 0,
        preProd: 0,
        fkp: 0,
        fkpProd: 0,
        fkpPreProd: 0,
        commercial: 0,
        gia: 0,
        blackjack: 0,
        selfManaged: 0
    };
    
    instances.forEach(instance => {
        if (instance.isProd) stats.prod++;
        if (instance.isPreProd) stats.preProd++;
        if (instance.isFKP) stats.fkp++;
        if (instance.isFKP && instance.isProd) stats.fkpProd++;
        if (instance.isFKP && instance.isPreProd) stats.fkpPreProd++;
        if (instance.customerType === 'Commercial') stats.commercial++;
        if (instance.customerType === 'GIA') stats.gia++;
        if (instance.customerType === 'BlackJack') stats.blackjack++;
        if (!instance.isFKP) stats.selfManaged++;
    });
    
    return stats;
}

/**
 * Check if there are discrepancies in migration stages across customer types
 * Only consider discrepancy if there are differences AND not all stages are 4+
 */
function checkForDiscrepancy(customerStages) {
    const stages = Object.values(customerStages);
    const minStage = Math.min(...stages);
    const maxStage = Math.max(...stages);
    
    // If all stages are 4+ (achieved parity), no discrepancy regardless of differences
    const allStagesAchievedParity = stages.every(stage => stage >= 4);
    if (allStagesAchievedParity) {
        return false;
    }
    
    // Otherwise, any difference is considered a discrepancy
    return maxStage > minStage;
}

/**
 * Apply view filter (all vs discrepancies only vs not started vs in-progress vs complete)
 */
function applyCrossCustomerViewFilter(services) {
    if (fkpDashboard.state.crossCustomerView === 'discrepancies') {
        return services.filter(service => service.hasDiscrepancy);
    } else if (fkpDashboard.state.crossCustomerView === 'not-started') {
        return services.filter(service => service.isNotStarted);
    } else if (fkpDashboard.state.crossCustomerView === 'in-progress') {
        return services.filter(service => service.isInProgress);
    } else if (fkpDashboard.state.crossCustomerView === 'complete') {
        return services.filter(service => service.isComplete);
    }
    return services;
}

/**
 * Render summary metrics for cross-customer analysis
 */
function renderCrossCustomerSummary(allServices, filteredServices) {
    const summaryContainer = document.getElementById('cross-customer-summary');
    
    const discrepancyServices = allServices.filter(service => service.hasDiscrepancy);
    const notStartedServices = allServices.filter(service => service.isNotStarted);
    const inProgressServices = allServices.filter(service => service.isInProgress);
    const completeServices = allServices.filter(service => service.isComplete);
    
    let html = `
        <div class="summary-metrics compact">
            <div class="summary-metric">
                <span class="metric-value">${allServices.length}</span>
                <span class="metric-label">Total</span>
            </div>
                    <div class="summary-metric discrepancy">
                        <span class="metric-value">${discrepancyServices.length}</span>
                        <span class="metric-label">Needs Co-ordination</span>
                    </div>
            <div class="summary-metric not-started">
                <span class="metric-value">${notStartedServices.length}</span>
                <span class="metric-label">Not Started</span>
            </div>
            <div class="summary-metric in-progress">
                <span class="metric-value">${inProgressServices.length}</span>
                <span class="metric-label">In-Progress</span>
            </div>
            <div class="summary-metric complete">
                <span class="metric-value">${completeServices.length}</span>
                <span class="metric-label">Complete</span>
            </div>
        </div>
        <div class="summary-explanation">
            <p><strong>Not Started:</strong> Stage 1 across all customer types • <strong>Needs Co-ordination:</strong> Different stages across customer types (excludes Stage 4+ aligned) • <strong>In-Progress:</strong> Stage 4+ in at least one customer type (no discrepancies, not complete) • <strong>Complete:</strong> Stage 5+ across all customer types</p>
        </div>
    `;
    
    summaryContainer.innerHTML = html;
}

/**
 * Render the cross-customer analysis table
 */
function renderCrossCustomerTable(services) {
    const container = document.getElementById('cross-customer-table-container');
    
    if (services.length === 0) {
        container.innerHTML = `
            <div class="no-services-message">
                <div class="message-icon">🔍</div>
                <h3>No Cross-Customer Services Found</h3>
                <p>No services match the current filters and view criteria.</p>
            </div>
        `;
        return;
    }
    
    let html = `
        <div class="cross-customer-header">
            <h3>Services Analysis (${services.length})</h3>
            <p>Services with instances across 2+ customer types • Scroll horizontally to see all columns</p>
        </div>
        <table class="cross-customer-table">
            <thead>
                <tr>
                    <th>Service Name</th>
                    <th>Org Leader</th>
                    <th>Parent Cloud</th>
                    <th>Cloud</th>
                    <th>Team</th>
                    <th>Commercial Stage</th>
                    <th>GIA Stage</th>
                    <th>BlackJack Stage</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    services.forEach(service => {
        html += `
            <tr>
                <td class="service-name-col">
                    <a href="#" class="service-link" onclick="showServiceDetails('${service.name}')">
                        ${service.name}
                    </a>
                </td>
                <td>${service.orgLeader}</td>
                <td>${service.parentCloud}</td>
                <td>${service.cloud}</td>
                <td>${service.team}</td>
                <td class="stage-cell">
                    ${service.customerTypes.includes('Commercial') ? 
                        `<span class="migration-stage-badge stage-${service.customerStages.Commercial}">${getMigrationStageText(service.customerStages.Commercial)}</span>` : 
                        '<span class="no-instances">—</span>'
                    }
                </td>
                <td class="stage-cell">
                    ${service.customerTypes.includes('GIA') ? 
                        `<span class="migration-stage-badge stage-${service.customerStages.GIA}">${getMigrationStageText(service.customerStages.GIA)}</span>` : 
                        '<span class="no-instances">—</span>'
                    }
                </td>
                <td class="stage-cell">
                    ${service.customerTypes.includes('BlackJack') ? 
                        `<span class="migration-stage-badge stage-${service.customerStages.BlackJack}">${getMigrationStageText(service.customerStages.BlackJack)}</span>` : 
                        '<span class="no-instances">—</span>'
                    }
                </td>
            </tr>
        `;
    });
    
    html += '</tbody></table>';
    container.innerHTML = html;
}

/**
 * Render Migration Dependencies tab
 */
function renderMigrationDependencies() {
    console.log('🔗 Rendering Migration Dependencies');
    
    // Render summary
    renderDependenciesSummary();
    
    // Render table
    renderDependenciesTable();
}

/**
 * Render Migration Dependencies summary metrics
 */
function renderDependenciesSummary() {
    const summaryContainer = document.getElementById('dependencies-summary');
    if (!summaryContainer) return;
    
    const requirementGroups = parseRequirementsData();
    const requirementsCount = requirementGroups.size;
    
    // Calculate total services across all requirements
    const allDependentServices = new Set();
    requirementGroups.forEach(services => {
        services.forEach(service => allDependentServices.add(service));
    });
    
    const totalDependentServices = allDependentServices.size;
    
    // Find most common requirement
    let mostCommonRequirement = '';
    let maxServices = 0;
    requirementGroups.forEach((services, requirement) => {
        if (services.length > maxServices) {
            maxServices = services.length;
            mostCommonRequirement = requirement;
        }
    });
    
    const html = `
        <div class="dependencies-metrics">
            <div class="dependency-metric-card highlight">
                <div class="metric-value">${requirementsCount}</div>
                <div class="metric-label">Feature Requirements</div>
                <div class="metric-subtitle">distinct FKP features needed</div>
            </div>
            <div class="dependency-metric-card">
                <div class="metric-value">${totalDependentServices}</div>
                <div class="metric-label">Services Affected</div>
                <div class="metric-subtitle">unique services requiring features</div>
            </div>
            <div class="dependency-metric-card">
                <div class="metric-value">${maxServices}</div>
                <div class="metric-label">Highest Impact</div>
                <div class="metric-subtitle">"${mostCommonRequirement}" (${maxServices} services)</div>
            </div>
        </div>
        <div class="dependencies-info">
            <p><strong>FKP Feature Requirements:</strong> Features listed below are needed by services for successful migration to FKP. Each requirement shows dependent services and current development status.</p>
        </div>
    `;
    
    summaryContainer.innerHTML = html;
}

/**
 * Render Migration Dependencies table
 */
/**
 * Parse requirements from timeline data and group services by requirement
 */
function parseRequirementsData() {
    if (!fkpDashboard.data.timelineRequirements) {
        console.log('🔗 No timeline requirements data available');
        return new Map();
    }
    
    const requirementGroups = new Map();
    
    fkpDashboard.data.timelineRequirements.forEach(item => {
        const serviceName = item['Service Name'];
        const requirements = item['Requirements'];
        
        // Skip services without requirements or with "None"
        if (!requirements || requirements.trim() === 'None' || requirements.trim() === '') {
            return;
        }
        
        // Split comma-separated requirements
        const requirementList = requirements.split(',').map(req => req.trim());
        
        requirementList.forEach(requirement => {
            if (!requirementGroups.has(requirement)) {
                requirementGroups.set(requirement, []);
            }
            requirementGroups.get(requirement).push(serviceName);
        });
    });
    
    console.log('🔗 Parsed requirements data:', requirementGroups);
    return requirementGroups;
}

function renderDependenciesTable() {
    const container = document.getElementById('dependencies-table-container');
    if (!container) return;
    
    const requirementGroups = parseRequirementsData();
    
    if (requirementGroups.size === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">✅</div>
                <h3>No FKP Feature Requirements</h3>
                <p>No services currently have specific FKP feature requirements for migration.</p>
            </div>
        `;
        return;
    }
    
    let html = `
        <div class="dependencies-header">
            <h3>FKP Feature Requirements (${requirementGroups.size} requirements)</h3>
            <p>Features needed for service migration to FKP with dependent services</p>
        </div>
        <div class="dependencies-table-wrapper">
            <table class="dependencies-table">
                <thead>
                    <tr>
                        <th class="requirement-col">Requirement</th>
                        <th class="services-col">Services Dependent</th>
                        <th class="eta-col">ETA & Status</th>
                    </tr>
                </thead>
                <tbody>
    `;
    
    // Sort requirements by number of dependent services (descending)
    const sortedRequirements = Array.from(requirementGroups.entries())
        .sort((a, b) => b[1].length - a[1].length);
    
    sortedRequirements.forEach(([requirement, services]) => {
        const servicesList = services.join(', ');
        
        html += `
            <tr>
                <td class="requirement-col">
                    <a href="#" class="requirement-link" onclick="showRequirementDetails('${requirement}')">
                        ${requirement}
                    </a>
                </td>
                <td class="services-col">
                    <span class="services-list">${servicesList}</span>
                    <span class="service-count">(${services.length} services)</span>
                </td>
                <td class="eta-col">
                    <span class="eta-status">TBD</span>
                </td>
            </tr>
        `;
    });
    
    html += `
                </tbody>
            </table>
        </div>
    `;
    
    container.innerHTML = html;
}

/**
 * Show requirement details (placeholder for future functionality)
 */
function showRequirementDetails(requirement) {
    console.log('🔗 Showing details for requirement:', requirement);
    // Placeholder for future requirement detail modal
    alert(`Requirement: ${requirement}\n\nDetailed information and configuration guides will be available here in future updates.`);
}

/**
 * Export data to CSV
 */
function exportToCSV(data, filename, headers) {
    // Create CSV content
    let csvContent = headers.join(',') + '\n';
    
    data.forEach(row => {
        // Escape commas and quotes in cell values
        const escapedRow = row.map(cell => {
            const cellStr = String(cell || '');
            // If cell contains comma, quote, or newline, wrap in quotes and escape internal quotes
            if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
                return '"' + cellStr.replace(/"/g, '""') + '"';
            }
            return cellStr;
        });
        csvContent += escapedRow.join(',') + '\n';
    });
    
    // Create and trigger download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

/**
 * Export Service Information table to CSV
 */
function exportServiceInformationCSV() {
    const filteredServices = getFilteredServicesForServiceInfo();
    
    if (filteredServices.length === 0) {
        alert('No data to export');
        return;
    }
    
    const headers = [
        'Service Name',
        'Instance Adoption %',
        'Org Leader', 
        'Parent Cloud',
        'Cloud',
        'Team',
        'Total Instances',
        'Instances on FKP'
    ];
    
    const data = filteredServices.map(service => [
        service.name,
        service.instanceAdoption ? service.instanceAdoption.toFixed(1) + '%' : '0.0%',
        service.orgLeader,
        service.parentCloud,
        service.cloud,
        service.team,
        service.totalInstances,
        service.fkpInstances
    ]);
    
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    exportToCSV(data, `service-information-${timestamp}.csv`, headers);
}

/**
 * Export Cross-Customer Analysis table to CSV  
 */
function exportCrossCustomerCSV() {
    const allServices = getCrossCustomerServices();
    const filteredServices = applyCrossCustomerViewFilter(allServices);
    
    if (filteredServices.length === 0) {
        alert('No data to export');
        return;
    }
    
    const headers = [
        'Service Name',
        'Org Leader',
        'Parent Cloud', 
        'Cloud',
        'Team',
        'Commercial Stage',
        'GIA Stage',
        'BlackJack Stage'
    ];
    
    const data = filteredServices.map(service => [
        service.name,
        service.orgLeader,
        service.parentCloud,
        service.cloud,
        service.team,
        service.customerTypes.includes('Commercial') ? 
            getMigrationStageText(service.customerStages.Commercial) : '—',
        service.customerTypes.includes('GIA') ? 
            getMigrationStageText(service.customerStages.GIA) : '—',
        service.customerTypes.includes('BlackJack') ? 
            getMigrationStageText(service.customerStages.BlackJack) : '—'
    ]);
    
    const viewType = fkpDashboard.state.crossCustomerView === 'all' ? 'all' : 
                     fkpDashboard.state.crossCustomerView === 'discrepancies' ? 'needs-coordination' :
                     fkpDashboard.state.crossCustomerView === 'not-started' ? 'not-started' :
                     fkpDashboard.state.crossCustomerView === 'in-progress' ? 'in-progress' :
                     fkpDashboard.state.crossCustomerView === 'complete' ? 'complete' : 'filtered';
    
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    exportToCSV(data, `cross-customer-analysis-${viewType}-${timestamp}.csv`, headers);
}

/**
 * Set cross-customer view mode (all vs discrepancies)
 */
function setCrossCustomerView(view) {
    console.log(`🔄 Setting cross-customer view to: ${view}`);
    
    fkpDashboard.state.crossCustomerView = view;
    
    // Update toggle buttons
    document.querySelectorAll('.cross-customer-controls .toggle-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Find and activate the correct button
    const activeButton = Array.from(document.querySelectorAll('.cross-customer-controls .toggle-btn'))
        .find(btn => {
            const text = btn.textContent.toLowerCase();
            if (view === 'all') return text.includes('all');
            if (view === 'discrepancies') return text.includes('needs co-ordination');
            if (view === 'not-started') return text.includes('not started');
            if (view === 'in-progress') return text.includes('in-progress');
            if (view === 'complete') return text.includes('complete');
            return false;
        });
    
    if (activeButton) {
        activeButton.classList.add('active');
    }
    
    // Re-render the analysis
    renderCrossCustomerAnalysis();
}

// Make functions globally accessible for HTML onclick handlers
window.switchViewMode = switchViewMode;
window.toggleFiltersPanel = toggleFiltersPanel;
window.toggleDropdown = toggleDropdown;
window.toggleSelectAll = toggleSelectAll;
window.resetAllFilters = resetAllFilters;
window.showServiceDetails = showServiceDetails;
window.closeServiceModal = closeServiceModal;
window.setViewMode = setViewMode;
window.switchTab = switchTab;
window.handleNavTabClick = handleNavTabClick;
window.handleNavSectionExpand = handleNavSectionExpand;
window.setSortBy = setSortBy;
window.toggleSortOrder = toggleSortOrder;
window.toggleServiceEnv = toggleServiceEnv;
window.switchServiceTab = switchServiceTab;
window.searchDropdownOptions = searchDropdownOptions;
window.setCrossCustomerView = setCrossCustomerView;
window.exportServiceInformationCSV = exportServiceInformationCSV;
window.exportCrossCustomerCSV = exportCrossCustomerCSV;
window.toggleCTADetails = toggleCTADetails;
window.setOverviewViewBy = setOverviewViewBy;

/**
 * Get filtered services for Migration Pipeline (respects substrate, customer type, always includes all environments)
 */
function getFilteredServicesForMigrationPipeline() {
    const processed = fkpDashboard.data.processed;
    const filters = fkpDashboard.filters;
    
    console.log('🚀 Migration Pipeline: Using ALL ENVIRONMENTS (Prod + Pre-Prod) - Environment filter disabled for this tab');
    
    const filteredServices = [];
    
    processed.services.forEach(service => {
        // Check if service has instances matching customer type (always include all environments)
        const relevantInstances = service.instances.filter(instance => {
            const matchesCustomerType = filters.customerType.includes(instance.customerType);
            // Always include all environments for Migration Pipeline
            return matchesCustomerType;
        });
        
        if (relevantInstances.length === 0) return;
        
        // Calculate filtered statistics for migration stage calculation
        const fkpRelevantInstances = relevantInstances.filter(instance => instance.isFKP);
        const prodRelevantInstances = relevantInstances.filter(instance => instance.isProd);
        const fkpProdRelevantInstances = relevantInstances.filter(instance => instance.isFKP && instance.isProd);
        const fkpPreProdRelevantInstances = relevantInstances.filter(instance => instance.isFKP && instance.isPreProd);
        
        // Create enhanced service with filtered stats for migration calculation
        const enhancedService = {
            ...service,
            stats: {
                ...service.stats,
                fkp: fkpRelevantInstances.length,
                prod: prodRelevantInstances.length,
                fkpProd: fkpProdRelevantInstances.length,
                fkpPreProd: fkpPreProdRelevantInstances.length
            }
        };
        
        filteredServices.push(enhancedService);
    });
    
    return filteredServices;
}




/**
 * Normalize FKP instance data - add missing columns
 */
function normalizeInstanceData(instances, source) {
    return instances.map(instance => {
        const normalized = { ...instance };
        
        // Add customerType based on 'fi' field
        if (!normalized.customerType) {
            if (/gia/i.test(normalized.fi || '')) {
                normalized.customerType = 'GIA';
            } else {
                normalized.customerType = 'Commercial';
            }
        }
        
        // Add migrationStage based on k8s cluster containing "sam"
        if (!normalized.migrationStage) {
            const cluster = normalized.k8s_cluster || '';
            // Stage 4 = FKP (cluster contains "sam"), Stage 1 = Self-Managed (no "sam")
            // NOTE: Stages 2,3,5,6 are calculated at service level in processData()
            // Stage 2 (Pre-Prod) = fkpPreProd > 0 && fkpProd === 0
            // Stage 5 = FKP Prod Complete, Stage 6 = FKP + Mesh Complete
            const isFKP = /sam/i.test(cluster);
            normalized.migrationStage = isFKP ? '4' : '1';
        }
        
        return normalized;
    });
}

/**
 * Normalize BlackJack data - convert from detailed format to instance format
 */
function normalizeBlackjackData(rawBlackjackData) {
    const instanceMap = new Map();
    
    rawBlackjackData.forEach(row => {
        const serviceName = row.ServiceName || row.label_p_servicename;
        const env = row.Env || row.fi;
        const cluster = row['EKS Cluster Name'] || row.k8s_cluster;
        
        if (!serviceName || !env) return;
        
        // Create unique key for each instance
        const key = `${serviceName}-${env}-${cluster}-${row.FunctionalDomain || row.fd || 'foundation'}`;
        
        if (!instanceMap.has(key)) {
            instanceMap.set(key, {
                label_p_servicename: serviceName,
                fi: env,
                fd: row.FunctionalDomain || row.fd || 'foundation',
                k8s_cluster: cluster,
                customerType: 'BlackJack',
                migrationStage: /sam/i.test(cluster || '') ? '4' : '1' // FKP if cluster contains "sam"
            });
        }
    });
    
    return Array.from(instanceMap.values());
}


/**
 * Get current unmapped services (overwrite approach)
 * FIXED: Check against raw mapping data, not processed data which may have 'Unknown' defaults
 */
function getCurrentUnmappedServices() {
    if (!fkpDashboard.data.mappings || fkpDashboard.data.mappings.length === 0) {
        console.log('⚠️ No mapping data available for unmapped service detection');
        return [];
    }
    
    // Create set of services that DO have mappings
    const serviceMapping = new Map();
    fkpDashboard.data.mappings.forEach(mapping => {
        const serviceName = mapping.mr_servicename;
        if (serviceName && serviceName.trim() !== '') {
            // Check if mapping has required fields (not empty/null)
            const hasOrgLeader = mapping.asl_manager_name && mapping.asl_manager_name.trim() !== '';
            const hasCloud = mapping.cloud_name && mapping.cloud_name.trim() !== '';
            const hasParentCloud = mapping.parent_cloud && mapping.parent_cloud.trim() !== '';
            
            if (hasOrgLeader && hasCloud && hasParentCloud) {
                serviceMapping.set(serviceName.trim(), true);
            }
        }
    });
    
    console.log(`📋 Found ${serviceMapping.size} services with complete mappings`);
    
    // Find services in our processed data that don't have mappings
    const unmappedServices = [];
    
    if (fkpDashboard.data.processed) {
        // Check regular services
        fkpDashboard.data.processed.services.forEach((service, serviceName) => {
            if (!serviceMapping.has(serviceName) && !INTEGRATION_SERVICES.includes(serviceName)) {
                unmappedServices.push(serviceName);
            }
        });
        
        // Integration services are handled separately and get default mappings
        console.log(`🔧 Integration services (${INTEGRATION_SERVICES.length}) get default mappings and are not considered unmapped`);
    }
    
    console.log(`📊 UNMAPPED SERVICES DETECTION RESULTS:`);
    console.log(`   - Services with complete mappings: ${serviceMapping.size}`);
    console.log(`   - Services marked as unmapped: ${unmappedServices.length}`);
    console.log(`   - Integration services (auto-mapped): ${INTEGRATION_SERVICES.length}`);
    
    if (unmappedServices.length > 0) {
        console.log(`📋 First 10 truly unmapped services:`, unmappedServices.slice(0, 10));
    } else {
        console.log(`✅ All services have mappings!`);
    }
    
    return unmappedServices.sort();
}

/**
 * Generate CSV content from instance data
 */
function generateCSVContent(instances) {
    if (!instances || instances.length === 0) return '';
    
    const headers = Object.keys(instances[0]).join(',');
    const rows = instances.map(instance => 
        Object.values(instance).map(value => 
            typeof value === 'string' && value.includes(',') ? `"${value}"` : value
        ).join(',')
    );
    
    return [headers, ...rows].join('\n');
}

/**
 * Show message to user
 */
function showMessage(message, type = 'info') {
    // Create message element
    const messageDiv = document.createElement('div');
    messageDiv.className = `message message-${type}`;
    messageDiv.textContent = message;
    messageDiv.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 1rem 1.5rem;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        z-index: 1000;
        font-weight: 500;
        background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6'};
        color: white;
        animation: slideIn 0.3s ease;
    `;
    
    // Add to page
    document.body.appendChild(messageDiv);
    
    // Remove after 3 seconds
    setTimeout(() => {
        messageDiv.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => messageDiv.remove(), 300);
    }, 3000);
}

// Initialize the dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 DOM Content Loaded, initializing FKP Dashboard...');
    initializeFKPDashboard();
});

console.log('✅ FKP Dashboard JavaScript loaded and ready');
console.log('🔗 Global functions registered for HTML access');

/**
 * RULE: Data Refresh Process
 * 
 * When user says "Refresh Data" or similar, I will:
 * 1. Read the raw data files (fkp_adoption.csv, fkp_adoption_prev_q.csv, 
 *    assets/data/blackjack_adoption.csv, assets/data/blackjack_adoption_prev_q.csv)
 * 2. Process and normalize the data using normalizeInstanceData and normalizeBlackjackData
 * 3. Generate exact file contents for replacement:
 *    - blackjack_adoption_normalized.csv (current normalized)
 *    - blackjack_adoption_prev_q_normalized.csv (previous normalized) 
 *    - unmapped_services.txt (overwrite with current unmapped services)
 * 4. Provide exact file contents and replacement instructions
 */

/* ======================
   AUTOSCALING SECTION
   ====================== */

// Store autoscaling data globally
let autoscalingData = {
    services: [],
    loaded: false
};

/**
 * Load Autoscaling Data from CSV
 */
async function loadAutoscalingData() {
    console.log('📊 Loading autoscaling data...');
    
    if (autoscalingData.loaded) {
        console.log('📊 Autoscaling data already loaded, skipping fetch');
        return;
    }
    
    try {
        const response = await fetch('assets/data/Autoscaling.csv');
        if (!response.ok) {
            throw new Error('Failed to load Autoscaling.csv');
        }
        
        const csvText = await response.text();
        const lines = csvText.trim().split('\n');
        
        // Skip first row (has "Audit Name" headers), second row has actual headers
        const headers = lines[1].split('\t').map(h => h.trim());
        console.log('📊 Autoscaling headers:', headers);
        
        autoscalingData.services = [];
        
        for (let i = 2; i < lines.length; i++) {
            const values = lines[i].split('\t');
            if (values.length >= 4) {
                const tierValue = parseInt(values[3]?.trim());
                const service = {
                    srExec: values[0]?.trim() || '',
                    engManager: values[1]?.trim() || '',
                    serviceName: values[2]?.trim() || '',
                    serviceTier: isNaN(tierValue) ? 1 : tierValue, // 0 is valid, only default to 1 if NaN
                    replicas: parseFloat(values[4]?.replace('%', '').trim()) || 0,
                    azDistrib: parseFloat(values[5]?.replace('%', '').trim()) || 0,
                    hpa: parseFloat(values[6]?.replace('%', '').trim()) || 0,
                    livenessProbe: parseFloat(values[7]?.replace('%', '').trim()) || 0
                };
                
                if (service.serviceName) {
                    autoscalingData.services.push(service);
                }
            }
        }
        
        autoscalingData.loaded = true;
        
        // Debug: verify tier counts
        const tier0Count = autoscalingData.services.filter(s => s.serviceTier === 0).length;
        const tier1Count = autoscalingData.services.filter(s => s.serviceTier === 1).length;
        console.log(`📊 Loaded ${autoscalingData.services.length} services from Autoscaling.csv`);
        console.log(`📊 Tier breakdown: Tier 0 (Critical) = ${tier0Count}, Tier 1 (Standard) = ${tier1Count}`);
        
    } catch (error) {
        console.error('❌ Error loading autoscaling data:', error);
    }
}

/**
 * Render Autoscaling Exec View (Metrics Cards)
 */
// Store autoscaling filter state
let autoscalingFilterState = {
    tier: 'all',
    hpaStatus: 'all'
};

async function renderAutoscalingExecView() {
    console.log('📊 Rendering Autoscaling Exec View...');
    
    // Ensure data is loaded
    await loadAutoscalingData();
    
    if (!autoscalingData.loaded || autoscalingData.services.length === 0) {
        console.log('⚠️ No autoscaling data available');
        return;
    }
    
    const services = autoscalingData.services;
    const totalServices = services.length;
    
    // Calculate tier breakdown
    const tier0Services = services.filter(s => s.serviceTier === 0);
    const tier1Services = services.filter(s => s.serviceTier === 1);
    const tier0Count = tier0Services.length;
    const tier1Count = tier1Services.length;
    const tier0Pct = ((tier0Count / totalServices) * 100).toFixed(1);
    const tier1Pct = ((tier1Count / totalServices) * 100).toFixed(1);
    
    // Calculate overall HPA adoption
    const hpaEnabledServices = services.filter(s => s.hpa > 0);
    const hpaEnabledCount = hpaEnabledServices.length;
    const hpaAdoptionRate = ((hpaEnabledCount / totalServices) * 100).toFixed(2);
    const servicesWithoutHPA = totalServices - hpaEnabledCount;
    
    // Calculate HPA adoption for Tier 0
    const tier0WithHPA = tier0Services.filter(s => s.hpa > 0);
    const tier0HpaCount = tier0WithHPA.length;
    const tier0HpaPct = tier0Count > 0 ? ((tier0HpaCount / tier0Count) * 100).toFixed(1) : 0;
    
    // Calculate HPA adoption for Tier 1
    const tier1WithHPA = tier1Services.filter(s => s.hpa > 0);
    const tier1HpaCount = tier1WithHPA.length;
    const tier1HpaPct = tier1Count > 0 ? ((tier1HpaCount / tier1Count) * 100).toFixed(1) : 0;
    
    // Calculate overall AZ Distribution adoption
    const azDistribEnabledServices = services.filter(s => s.azDistrib > 0);
    const azDistribEnabledCount = azDistribEnabledServices.length;
    const azDistribAdoptionRate = ((azDistribEnabledCount / totalServices) * 100).toFixed(2);
    const servicesWithoutAzDistrib = totalServices - azDistribEnabledCount;
    
    // Calculate AZ Distribution adoption for Tier 0
    const tier0WithAzDistrib = tier0Services.filter(s => s.azDistrib > 0);
    const tier0AzDistribCount = tier0WithAzDistrib.length;
    const tier0AzDistribPct = tier0Count > 0 ? ((tier0AzDistribCount / tier0Count) * 100).toFixed(1) : 0;
    
    // Calculate AZ Distribution adoption for Tier 1
    const tier1WithAzDistrib = tier1Services.filter(s => s.azDistrib > 0);
    const tier1AzDistribCount = tier1WithAzDistrib.length;
    const tier1AzDistribPct = tier1Count > 0 ? ((tier1AzDistribCount / tier1Count) * 100).toFixed(1) : 0;
    
    // Calculate AZ Distribution breakdown percentages (for breakdown card)
    const tier0AzDistribBreakdownPct = azDistribEnabledCount > 0 ? ((tier0AzDistribCount / azDistribEnabledCount) * 100).toFixed(1) : 0;
    const tier1AzDistribBreakdownPct = azDistribEnabledCount > 0 ? ((tier1AzDistribCount / azDistribEnabledCount) * 100).toFixed(1) : 0;
    
    console.log(`📊 Total: ${totalServices}, Tier0: ${tier0Count}, Tier1: ${tier1Count}`);
    console.log(`📊 HPA Enabled: ${hpaEnabledCount}, Rate: ${hpaAdoptionRate}%`);
    console.log(`📊 Tier 0: ${tier0HpaCount} with HPA (${tier0HpaPct}%)`);
    console.log(`📊 Tier 1: ${tier1HpaCount} with HPA (${tier1HpaPct}%)`);
    console.log(`📊 AZ Distribution Enabled: ${azDistribEnabledCount}, Rate: ${azDistribAdoptionRate}%`);
    console.log(`📊 Tier 0: ${tier0AzDistribCount} with AZ Distribution (${tier0AzDistribPct}%)`);
    console.log(`📊 Tier 1: ${tier1AzDistribCount} with AZ Distribution (${tier1AzDistribPct}%)`);
    
    // ============ UPDATE SERVICE TIER BREAKDOWN CARD ============
    const totalServicesEl = document.getElementById('total-services-count');
    if (totalServicesEl) {
        totalServicesEl.textContent = totalServices;
    }
    
    // Update tier bar segments
    const tier0SegmentOverall = document.getElementById('tier-0-segment-overall');
    if (tier0SegmentOverall) tier0SegmentOverall.style.width = `${tier0Pct}%`;
    
    const tier0CoveragePctOverallEl = document.getElementById('tier0-coverage-pct-overall');
    if (tier0CoveragePctOverallEl) tier0CoveragePctOverallEl.textContent = `${tier0Pct}%`;
    
    // Update tier details
    const tierDetails = document.getElementById('tier-details');
    if (tierDetails) {
        tierDetails.innerHTML = `
            <div class="tier-hpa-detail-row clickable" onclick="filterAutoscalingByTier(0)">
                <span class="tier-hpa-detail-label">Tier 0 (Critical)</span>
                <span class="tier-hpa-detail-value">${tier0Count} <span style="color: #3b82f6; font-weight: 600;">(${tier0Pct}%)</span> <span class="link-icon">↗</span></span>
            </div>
            <div class="tier-hpa-detail-row clickable" onclick="filterAutoscalingByTier(1)">
                <span class="tier-hpa-detail-label">Tier 1 (Standard)</span>
                <span class="tier-hpa-detail-value">${tier1Count} <span style="color: #3b82f6; font-weight: 600;">(${tier1Pct}%)</span> <span class="link-icon">↗</span></span>
            </div>
            <div class="tier-hpa-detail-row">
                <span class="tier-hpa-detail-label">Total Services</span>
                <span class="tier-hpa-detail-value">${totalServices}</span>
            </div>
        `;
    }
    
    // ============ UPDATE HPA ADOPTION RATE CARD ============
    const hpaRateEl = document.getElementById('hpa-adoption-rate');
    if (hpaRateEl) {
        hpaRateEl.textContent = `${hpaAdoptionRate}%`;
    }
    
    // Update HPA coverage percentage
    const hpaCoveragePctEl = document.getElementById('hpa-coverage-pct');
    if (hpaCoveragePctEl) {
        hpaCoveragePctEl.textContent = `${hpaAdoptionRate}%`;
    }
    
    // Update HPA progress bar
    const hpaProgressFill = document.getElementById('hpa-progress-fill');
    if (hpaProgressFill) {
        hpaProgressFill.style.width = `${hpaAdoptionRate}%`;
    }
    
    // Update HPA details
    const hpaDetails = document.getElementById('hpa-details');
    if (hpaDetails) {
        hpaDetails.innerHTML = `
            <div class="tier-hpa-detail-row clickable" onclick="filterAutoscalingByHpaStatus('enrolled')">
                <span class="tier-hpa-detail-label">HPA Enabled Services</span>
                <span class="tier-hpa-detail-value">${hpaEnabledCount} <span class="link-icon">↗</span></span>
            </div>
            <div class="tier-hpa-detail-row clickable" onclick="filterAutoscalingByHpaStatus('not-enrolled')">
                <span class="tier-hpa-detail-label">Services Without HPA</span>
                <span class="tier-hpa-detail-value">${servicesWithoutHPA} <span class="link-icon">↗</span></span>
            </div>
            <div class="tier-hpa-detail-row">
                <span class="tier-hpa-detail-label">Total Services</span>
                <span class="tier-hpa-detail-value">${totalServices}</span>
            </div>
        `;
    }
    
    // ============ UPDATE AZ DISTRIBUTION BREAKDOWN CARD ============
    const totalAzDistribServicesEl = document.getElementById('total-az-distrib-services-count');
    if (totalAzDistribServicesEl) {
        totalAzDistribServicesEl.textContent = azDistribEnabledCount;
    }
    
    // Update AZ Distribution tier bar segments
    const tier0AzDistribSegmentOverall = document.getElementById('tier-0-az-distrib-segment-overall');
    if (tier0AzDistribSegmentOverall) tier0AzDistribSegmentOverall.style.width = `${tier0AzDistribBreakdownPct}%`;
    
    const tier0AzDistribCoveragePctOverallEl = document.getElementById('tier0-az-distrib-coverage-pct-overall');
    if (tier0AzDistribCoveragePctOverallEl) tier0AzDistribCoveragePctOverallEl.textContent = `${tier0AzDistribBreakdownPct}%`;
    
    // Update AZ Distribution tier details
    const azDistribTierDetails = document.getElementById('az-distrib-tier-details');
    if (azDistribTierDetails) {
        azDistribTierDetails.innerHTML = `
            <div class="tier-hpa-detail-row clickable" onclick="filterAutoscalingByTier(0)">
                <span class="tier-hpa-detail-label">Tier 0 (Critical)</span>
                <span class="tier-hpa-detail-value">${tier0AzDistribCount} <span style="color: #3b82f6; font-weight: 600;">(${tier0AzDistribBreakdownPct}%)</span> <span class="link-icon">↗</span></span>
            </div>
            <div class="tier-hpa-detail-row clickable" onclick="filterAutoscalingByTier(1)">
                <span class="tier-hpa-detail-label">Tier 1 (Standard)</span>
                <span class="tier-hpa-detail-value">${tier1AzDistribCount} <span style="color: #3b82f6; font-weight: 600;">(${tier1AzDistribBreakdownPct}%)</span> <span class="link-icon">↗</span></span>
            </div>
            <div class="tier-hpa-detail-row">
                <span class="tier-hpa-detail-label">Total Services with AZ Distribution</span>
                <span class="tier-hpa-detail-value">${azDistribEnabledCount}</span>
            </div>
        `;
    }
    
    // ============ UPDATE TIER 0 CARD ============
    const tier0PctEl = document.getElementById('tier0-hpa-pct');
    if (tier0PctEl) tier0PctEl.textContent = `${tier0HpaPct}%`;
    
    const tier0CoveragePctEl = document.getElementById('tier0-coverage-pct');
    if (tier0CoveragePctEl) tier0CoveragePctEl.textContent = `${tier0HpaPct}%`;
    
    const tier0ProgressFill = document.getElementById('tier0-progress-fill');
    if (tier0ProgressFill) tier0ProgressFill.style.width = `${tier0HpaPct}%`;
    
    const tier0Details = document.getElementById('tier0-details');
    if (tier0Details) {
        tier0Details.innerHTML = `
            <div class="tier-hpa-detail-row clickable" onclick="event.stopPropagation(); filterAutoscalingByTierAndHpa(0, 'enrolled')">
                <span class="tier-hpa-detail-label">Services with HPA</span>
                <span class="tier-hpa-detail-value">${tier0HpaCount} <span class="link-icon">↗</span></span>
            </div>
            <div class="tier-hpa-detail-row clickable" onclick="event.stopPropagation(); filterAutoscalingByTier(0)">
                <span class="tier-hpa-detail-label">Total Tier 0 Services</span>
                <span class="tier-hpa-detail-value">${tier0Count} <span class="link-icon">↗</span></span>
            </div>
            <div class="tier-hpa-detail-row">
                <span class="tier-hpa-detail-label">HPA Adoption Rate</span>
                <span class="tier-hpa-detail-value">${tier0HpaPct}%</span>
            </div>
        `;
    }
    
    // ============ UPDATE TIER 1 CARD ============
    const tier1PctEl = document.getElementById('tier1-hpa-pct');
    if (tier1PctEl) tier1PctEl.textContent = `${tier1HpaPct}%`;
    
    const tier1CoveragePctEl = document.getElementById('tier1-coverage-pct');
    if (tier1CoveragePctEl) tier1CoveragePctEl.textContent = `${tier1HpaPct}%`;
    
    const tier1ProgressFill = document.getElementById('tier1-progress-fill');
    if (tier1ProgressFill) tier1ProgressFill.style.width = `${tier1HpaPct}%`;
    
    const tier1Details = document.getElementById('tier1-details');
    if (tier1Details) {
        tier1Details.innerHTML = `
            <div class="tier-hpa-detail-row clickable" onclick="event.stopPropagation(); filterAutoscalingByTierAndHpa(1, 'enrolled')">
                <span class="tier-hpa-detail-label">Services with HPA</span>
                <span class="tier-hpa-detail-value">${tier1HpaCount} <span class="link-icon">↗</span></span>
            </div>
            <div class="tier-hpa-detail-row clickable" onclick="event.stopPropagation(); filterAutoscalingByTier(1)">
                <span class="tier-hpa-detail-label">Total Tier 1 Services</span>
                <span class="tier-hpa-detail-value">${tier1Count} <span class="link-icon">↗</span></span>
            </div>
            <div class="tier-hpa-detail-row">
                <span class="tier-hpa-detail-label">HPA Adoption Rate</span>
                <span class="tier-hpa-detail-value">${tier1HpaPct}%</span>
            </div>
        `;
    }
    
    // ============ UPDATE AZ DISTRIBUTION RATE CARD ============
    const azDistribRateEl = document.getElementById('az-distrib-adoption-rate');
    if (azDistribRateEl) {
        azDistribRateEl.textContent = `${azDistribAdoptionRate}%`;
    }
    
    // Update AZ Distribution coverage percentage
    const azDistribCoveragePctEl = document.getElementById('az-distrib-coverage-pct');
    if (azDistribCoveragePctEl) {
        azDistribCoveragePctEl.textContent = `${azDistribAdoptionRate}%`;
    }
    
    // Update AZ Distribution progress bar
    const azDistribProgressFill = document.getElementById('az-distrib-progress-fill');
    if (azDistribProgressFill) {
        azDistribProgressFill.style.width = `${azDistribAdoptionRate}%`;
    }
    
    // Update AZ Distribution details
    const azDistribDetails = document.getElementById('az-distrib-details');
    if (azDistribDetails) {
        azDistribDetails.innerHTML = `
            <div class="tier-hpa-detail-row clickable" onclick="switchViewMode('developer'); switchTab('runtime-hpa');">
                <span class="tier-hpa-detail-label">Services with AZ Distribution</span>
                <span class="tier-hpa-detail-value">${azDistribEnabledCount} <span class="link-icon">↗</span></span>
            </div>
            <div class="tier-hpa-detail-row clickable" onclick="switchViewMode('developer'); switchTab('runtime-hpa');">
                <span class="tier-hpa-detail-label">Services Without AZ Distribution</span>
                <span class="tier-hpa-detail-value">${servicesWithoutAzDistrib} <span class="link-icon">↗</span></span>
            </div>
            <div class="tier-hpa-detail-row">
                <span class="tier-hpa-detail-label">Total Services</span>
                <span class="tier-hpa-detail-value">${totalServices}</span>
            </div>
        `;
    }
    
    // ============ UPDATE TIER 0 AZ DISTRIBUTION CARD ============
    const tier0AzDistribPctEl = document.getElementById('tier0-az-distrib-pct');
    if (tier0AzDistribPctEl) tier0AzDistribPctEl.textContent = `${tier0AzDistribPct}%`;
    
    const tier0AzDistribCoveragePctEl = document.getElementById('tier0-az-distrib-coverage-pct');
    if (tier0AzDistribCoveragePctEl) tier0AzDistribCoveragePctEl.textContent = `${tier0AzDistribPct}%`;
    
    const tier0AzDistribProgressFill = document.getElementById('tier0-az-distrib-progress-fill');
    if (tier0AzDistribProgressFill) tier0AzDistribProgressFill.style.width = `${tier0AzDistribPct}%`;
    
    const tier0AzDistribDetails = document.getElementById('tier0-az-distrib-details');
    if (tier0AzDistribDetails) {
        tier0AzDistribDetails.innerHTML = `
            <div class="tier-hpa-detail-row clickable" onclick="event.stopPropagation(); filterAutoscalingByTier(0)">
                <span class="tier-hpa-detail-label">Services with AZ Distribution</span>
                <span class="tier-hpa-detail-value">${tier0AzDistribCount} <span class="link-icon">↗</span></span>
            </div>
            <div class="tier-hpa-detail-row clickable" onclick="event.stopPropagation(); filterAutoscalingByTier(0)">
                <span class="tier-hpa-detail-label">Total Tier 0 Services</span>
                <span class="tier-hpa-detail-value">${tier0Count} <span class="link-icon">↗</span></span>
            </div>
            <div class="tier-hpa-detail-row">
                <span class="tier-hpa-detail-label">AZ Distribution Rate</span>
                <span class="tier-hpa-detail-value">${tier0AzDistribPct}%</span>
            </div>
        `;
    }
    
    // ============ UPDATE TIER 1 AZ DISTRIBUTION CARD ============
    const tier1AzDistribPctEl = document.getElementById('tier1-az-distrib-pct');
    if (tier1AzDistribPctEl) tier1AzDistribPctEl.textContent = `${tier1AzDistribPct}%`;
    
    const tier1AzDistribCoveragePctEl = document.getElementById('tier1-az-distrib-coverage-pct');
    if (tier1AzDistribCoveragePctEl) tier1AzDistribCoveragePctEl.textContent = `${tier1AzDistribPct}%`;
    
    const tier1AzDistribProgressFill = document.getElementById('tier1-az-distrib-progress-fill');
    if (tier1AzDistribProgressFill) tier1AzDistribProgressFill.style.width = `${tier1AzDistribPct}%`;
    
    const tier1AzDistribDetails = document.getElementById('tier1-az-distrib-details');
    if (tier1AzDistribDetails) {
        tier1AzDistribDetails.innerHTML = `
            <div class="tier-hpa-detail-row clickable" onclick="event.stopPropagation(); filterAutoscalingByTier(1)">
                <span class="tier-hpa-detail-label">Services with AZ Distribution</span>
                <span class="tier-hpa-detail-value">${tier1AzDistribCount} <span class="link-icon">↗</span></span>
            </div>
            <div class="tier-hpa-detail-row clickable" onclick="event.stopPropagation(); filterAutoscalingByTier(1)">
                <span class="tier-hpa-detail-label">Total Tier 1 Services</span>
                <span class="tier-hpa-detail-value">${tier1Count} <span class="link-icon">↗</span></span>
            </div>
            <div class="tier-hpa-detail-row">
                <span class="tier-hpa-detail-label">AZ Distribution Rate</span>
                <span class="tier-hpa-detail-value">${tier1AzDistribPct}%</span>
            </div>
        `;
    }
    
    console.log('✅ Autoscaling Exec View rendered');
}

/**
 * Filter autoscaling table by tier - called when clicking on Tier cards
 */
function filterAutoscalingByTier(tier) {
    console.log(`📊 Filtering autoscaling by Tier ${tier}`);
    
    // Set the filter state
    autoscalingFilterState.tier = tier.toString();
    autoscalingFilterState.hpaStatus = 'all'; // Reset HPA filter when filtering by tier only
    
    // Switch to Developer View
    switchViewMode('developer');
    
    // Switch to the autoscaling tab
    switchTab('runtime-hpa');
    
    // Apply the filter
    setTimeout(() => {
        const tierFilter = document.getElementById('autoscaling-tier-filter');
        const hpaFilter = document.getElementById('autoscaling-hpa-filter');
        if (tierFilter) {
            tierFilter.value = tier.toString();
        }
        if (hpaFilter) {
            hpaFilter.value = 'all';
        }
        applyAutoscalingFilters();
    }, 100);
}

/**
 * Filter autoscaling table by tier AND HPA status - called when clicking on specific links
 */
function filterAutoscalingByTierAndHpa(tier, hpaStatus) {
    console.log(`📊 Filtering autoscaling by Tier ${tier} and HPA status: ${hpaStatus}`);
    
    // Set the filter state
    autoscalingFilterState.tier = tier.toString();
    autoscalingFilterState.hpaStatus = hpaStatus;
    
    // Switch to Developer View
    switchViewMode('developer');
    
    // Switch to the autoscaling tab
    switchTab('runtime-hpa');
    
    // Apply the filter
    setTimeout(() => {
        const tierFilter = document.getElementById('autoscaling-tier-filter');
        const hpaFilter = document.getElementById('autoscaling-hpa-filter');
        if (tierFilter) {
            tierFilter.value = tier.toString();
        }
        if (hpaFilter) {
            hpaFilter.value = hpaStatus;
        }
        applyAutoscalingFilters();
    }, 100);
}

/**
 * Filter autoscaling table by HPA status only - called from HPA Adoption card
 */
function filterAutoscalingByHpaStatus(hpaStatus) {
    console.log(`📊 Filtering autoscaling by HPA status: ${hpaStatus}`);
    
    // Set the filter state
    autoscalingFilterState.tier = 'all'; // Show all tiers
    autoscalingFilterState.hpaStatus = hpaStatus;
    
    // Switch to Developer View
    switchViewMode('developer');
    
    // Switch to the autoscaling tab
    switchTab('runtime-hpa');
    
    // Apply the filter
    setTimeout(() => {
        const tierFilter = document.getElementById('autoscaling-tier-filter');
        const hpaFilter = document.getElementById('autoscaling-hpa-filter');
        if (tierFilter) {
            tierFilter.value = 'all';
        }
        if (hpaFilter) {
            hpaFilter.value = hpaStatus;
        }
        applyAutoscalingFilters();
    }, 100);
}

/**
 * Apply autoscaling filters in Developer View
 */
function applyAutoscalingFilters() {
    const tierFilter = document.getElementById('autoscaling-tier-filter');
    const hpaFilter = document.getElementById('autoscaling-hpa-filter');
    
    autoscalingFilterState.tier = tierFilter ? tierFilter.value : 'all';
    autoscalingFilterState.hpaStatus = hpaFilter ? hpaFilter.value : 'all';
    
    renderAutoscalingDeveloperView();
}

/**
 * Reset autoscaling filters
 */
function resetAutoscalingFilters() {
    autoscalingFilterState.tier = 'all';
    autoscalingFilterState.hpaStatus = 'all';
    
    const tierFilter = document.getElementById('autoscaling-tier-filter');
    const hpaFilter = document.getElementById('autoscaling-hpa-filter');
    
    if (tierFilter) tierFilter.value = 'all';
    if (hpaFilter) hpaFilter.value = 'all';
    
    renderAutoscalingDeveloperView();
}

/**
 * Render Autoscaling Developer View (Services Table)
 */
async function renderAutoscalingDeveloperView() {
    console.log('📊 Rendering Autoscaling Developer View...');
    
    // Ensure data is loaded
    await loadAutoscalingData();
    
    if (!autoscalingData.loaded || autoscalingData.services.length === 0) {
        console.log('⚠️ No autoscaling data available');
        return;
    }
    
    const tableBody = document.getElementById('autoscaling-table-body');
    if (!tableBody) {
        console.log('⚠️ Table body element not found');
        return;
    }
    
    // Apply filters
    let filteredServices = [...autoscalingData.services];
    
    // Filter by tier
    if (autoscalingFilterState.tier !== 'all') {
        const tierValue = parseInt(autoscalingFilterState.tier);
        filteredServices = filteredServices.filter(s => s.serviceTier === tierValue);
    }
    
    // Filter by HPA status
    if (autoscalingFilterState.hpaStatus === 'enrolled') {
        filteredServices = filteredServices.filter(s => s.hpa > 0);
    } else if (autoscalingFilterState.hpaStatus === 'not-enrolled') {
        filteredServices = filteredServices.filter(s => s.hpa === 0);
    }
    
    // Sort services: services without HPA (0%) first, then by HPA ascending, then alphabetically
    const sortedServices = filteredServices.sort((a, b) => {
        // Services with HPA = 0 come first (needs enrollment)
        if (a.hpa === 0 && b.hpa > 0) return -1;
        if (a.hpa > 0 && b.hpa === 0) return 1;
        // Then sort by HPA percentage ascending
        if (a.hpa !== b.hpa) return a.hpa - b.hpa;
        // Finally alphabetically
        return a.serviceName.localeCompare(b.serviceName);
    });
    
    // Update filter status
    const filterStatus = document.getElementById('autoscaling-filter-status');
    if (filterStatus) {
        const tierLabel = autoscalingFilterState.tier === 'all' ? 'all tiers' : 
                          autoscalingFilterState.tier === '0' ? 'Tier 0 (Critical)' : 'Tier 1 (Standard)';
        const hpaLabel = autoscalingFilterState.hpaStatus === 'all' ? '' : 
                         autoscalingFilterState.hpaStatus === 'enrolled' ? ', HPA enabled' : ', not enrolled';
        filterStatus.textContent = `Showing ${sortedServices.length} services (${tierLabel}${hpaLabel})`;
    }
    
    const rows = sortedServices.map(service => {
        const tierBadgeClass = service.serviceTier === 0 ? 'tier-badge tier-0' : 'tier-badge';
        const tierLabel = service.serviceTier === 0 ? 'Tier 0' : 'Tier 1';
        
        // HPA percentage styling
        let hpaBadgeClass = 'hpa-pct-badge';
        if (service.hpa === 0) {
            hpaBadgeClass += ' hpa-zero';
        } else if (service.hpa === 100) {
            hpaBadgeClass += ' hpa-full';
        } else if (service.hpa >= 50) {
            hpaBadgeClass += ' hpa-high';
        } else {
            hpaBadgeClass += ' hpa-partial';
        }
        
        // AZ Distribution percentage styling (similar to HPA)
        let azDistribBadgeClass = 'hpa-pct-badge';
        if (service.azDistrib === 0) {
            azDistribBadgeClass += ' hpa-zero';
        } else if (service.azDistrib === 100) {
            azDistribBadgeClass += ' hpa-full';
        } else if (service.azDistrib >= 50) {
            azDistribBadgeClass += ' hpa-high';
        } else {
            azDistribBadgeClass += ' hpa-partial';
        }
        
        return `
            <tr>
                <td>${service.serviceName}</td>
                <td>Platform Services</td>
                <td><span class="${tierBadgeClass}">${tierLabel}</span></td>
                <td><span class="${hpaBadgeClass}">${Math.round(service.hpa)}%</span></td>
                <td><span class="${azDistribBadgeClass}">${Math.round(service.azDistrib)}%</span></td>
            </tr>
        `;
    }).join('');
    
    tableBody.innerHTML = rows;
    
    console.log(`✅ Autoscaling Developer View rendered with ${sortedServices.length} services`);
}

/* ======================
   KARPENTER SECTION
   ====================== */

// Store Karpenter data globally
let karpenterData = {
    monthlySummary: [],
    environmentSummary: [],
    clusterSummary: [],
    fiSummary: [],
    fdSummary: [],
    filterOptions: {},
    clusterTrend: [],
    loaded: false
};

// Store Karpenter filter state (synced between Exec and Dev views)
let karpenterFilterState = {
    fi: 'all',
    fd: 'all',
    environment: 'all',
    cluster: 'all',
    month: 'all',
    duration: '30',
    karpenterToggle: 'enabled'   // default: 'enabled' | 'all' | 'disabled'
};

/**
 * Round to 2 decimals for avg. CPU allocation rate % (cluster_packing_percent).
 * e.g. 14.828398815660400 -> 14.82
 * Keep raw percent (no upper cap) so dashboard values match source pivots.
 */
function roundAvgCpuPercent(value) {
    const n = parseFloat(value);
    if (isNaN(n)) return 0;
    const rounded = Math.round(n * 100) / 100;
    return Math.max(0, rounded);
}

/**
 * Compute robust average for CPU percentages.
 * If the raw mean is unrealistically high (data anomaly), trim top 1% outliers.
 */
function computeRobustAvgCpu(values) {
    const clean = (values || [])
        .map(v => parseFloat(v))
        .filter(v => Number.isFinite(v) && v >= 0);
    if (clean.length === 0) return null;

    const sorted = clean.slice().sort((a, b) => a - b);
    const rawMean = sorted.reduce((a, b) => a + b, 0) / sorted.length;
    if (rawMean <= 200 || sorted.length < 50) {
        return rawMean;
    }

    const trimCount = Math.max(1, Math.floor(sorted.length * 0.01));
    const trimmed = sorted.slice(0, sorted.length - trimCount);
    if (trimmed.length === 0) return rawMean;
    return trimmed.reduce((a, b) => a + b, 0) / trimmed.length;
}

/**
 * Build Karpenter rows from one monthly CSV. CSV columns: report_date, environment_type, falcon_instance, functional_domain, k8s_cluster, karpenter_status, cluster_packing_percent (or cpu_packing_percent in Full files)
 * Uses cluster_packing_percent or cpu_packing_percent as avg. CPU allocation rate %, rounded to 2 decimals.
 */
function buildKarpenterRowsFromMonthlyCSV(csvText, monthCode, monthName) {
    const raw = parseCSV(csvText);
    if (!raw.length) return [];

    const envMap = (et) => {
        if (!et) return 'other';
        const e = String(et).toLowerCase();
        return e === 'stage' ? 'staging' : e;
    };

    return raw.map(row => {
        const percent = row.cluster_packing_percent != null ? row.cluster_packing_percent : row.cpu_packing_percent;
        const avgCpu = roundAvgCpuPercent(percent);
        const environment = envMap(row.environment_type);
        const efficiencyIndicator = getEfficiencyIndicator(avgCpu, environment);
        const karpenterStatus = (row.karpenter_status || '').trim();
        return {
            month: monthCode,
            month_name: monthName,
            falcon_instance: (row.falcon_instance || '').trim(),
            functional_domain: (row.functional_domain || '').trim(),
            environment: environment,
            cluster: (row.k8s_cluster || '').trim(),
            avg_cpu: avgCpu,
            node_count: 1,
            avg_pod_count: 0,
            efficiency_indicator: efficiencyIndicator,
            karpenter_status: karpenterStatus
        };
    });
}

/** Monthly files from Cpu allocation rate monthly files: Apr 2025 through Feb 2026 (source of truth for Karpenter). Jan/Feb use Full file when present (has both Karpenter_Enabled and Karpenter_Disabled). */
const KARPENTER_MONTHLY_FILES = [
    { file: 'April%20cpu%20allocation%20rate%202025.csv', month: '2025-04', monthName: 'April' },
    { file: 'May%20cpu%20allocation%20rate%202025.csv', month: '2025-05', monthName: 'May' },
    { file: 'June%20cpu%20allocation%20rate%202025.csv', month: '2025-06', monthName: 'June' },
    { file: 'July%20cpu%20allocation%20rate%202025.csv', month: '2025-07', monthName: 'July' },
    { file: 'August%20cpu%20allocation%20rate%202025.csv', month: '2025-08', monthName: 'August' },
    { file: 'Sep%20cpu%20allocation%20rate%202025.csv', month: '2025-09', monthName: 'September' },
    { file: 'Oct%20cpu%20allocation%20rate%202025.csv', month: '2025-10', monthName: 'October' },
    { file: 'Nov%20cpu%20allocation%20rate%202025.csv', month: '2025-11', monthName: 'November' },
    { file: 'Dec%20cpu%20allocation%20rate%202025.csv', month: '2025-12', monthName: 'December' },
    { file: 'Jan%20cpu%20allocation%20rate%202026.csv', month: '2026-01', monthName: 'January', fullFile: 'Jan%20Full%20Karpenter%20file.csv' },
    { file: 'Feb%20cpu%20allocation%20rate%202026.csv', month: '2026-02', monthName: 'February', fullFile: 'Feb%20Full%20Karpenter%20file.csv' },
    { file: 'Mar%20cpu%20allocation%20rate%202026.csv', month: '2026-03', monthName: 'March', fullFile: '2026%20March%20Full%20Karpenter%20File.csv' }
];

// Source of truth full files (covers 2025-03 through 2026-03).
const KARPENTER_FULL_FILES = [
    { month: '2025-03', monthName: 'March', files: ['2025%20March%20Karpenter%20Full%20File.csv'] },
    { month: '2025-04', monthName: 'April', files: ['2025%20April%20Karpenter%20Full%20File.csv'] },
    { month: '2025-05', monthName: 'May', files: ['2025%20May%20Karpenter%20Full%20File.csv'] },
    { month: '2025-06', monthName: 'June', files: ['2025%20June%20Full%20Karpenter%20File.csv'] },
    { month: '2025-07', monthName: 'July', files: ['2025%20July%20Full%20Karpenter%20file.csv', '2025%20July%20Full%20Karpenter%20File.csv'] },
    { month: '2025-08', monthName: 'August', files: ['2025%20August%20Full%20Karpenter%20file.csv', '2025%20August%20Full%20Karpenter%20File.csv'] },
    { month: '2025-09', monthName: 'September', files: ['2025%20Sep%20Full%20Karpenter%20File.csv'] },
    { month: '2025-10', monthName: 'October', files: ['2025%20Oct%20Full%20Karpenter%20File.csv'] },
    { month: '2025-11', monthName: 'November', files: ['2025%20Nov%20Full%20Karpenter%20File.csv'] },
    { month: '2025-12', monthName: 'December', files: ['2025%20Dec%20Full%20Karpenter%20File.csv'] },
    { month: '2026-01', monthName: 'January', files: ['2026%20Jan%20Full%20Karpenter%20File.csv', 'Jan%20Full%20Karpenter%20file.csv'] },
    { month: '2026-02', monthName: 'February', files: ['2026%20Feb%20Full%20Karpenter%20file.csv', '2026%20Feb%20Full%20Karpenter%20File.csv', 'Feb%20Full%20Karpenter%20file.csv'] },
    { month: '2026-03', monthName: 'March', files: ['2026%20March%20Full%20Karpenter%20File.csv', '2026%20March%20Full%20Karpenter%20file.csv'] }
];

// Source: Cpu allocation rate monthly files. Try root folder first (has Jan/Feb Full Karpenter files with both statuses), then assets/data.
const KARPENTER_MONTHLY_BASES = ['Cpu%20allocation%20rate%20monthly%20files/', 'assets/data/Cpu%20allocation%20rate%20monthly%20files/', '/api/karpenter-monthly/'];
const KARPENTER_FULL_BASES = ['Bin-packing%20Overall/', 'assets/data/Bin-packing%20Overall/'];

/**
 * Build Karpenter data structures from April 2025 CPU allocation rate CSV.
 * CSV columns: report_date, environment_type, falcon_instance, functional_domain, k8s_cluster, karpenter_status, cluster_packing_percent
 * @deprecated Use loadKarpenterDataFromMonthlyFiles which loads Apr 2025 - Feb 2026
 */
function buildKarpenterDataFromAprilCSV(csvText) {
    const raw = parseCSV(csvText);
    if (!raw.length) return null;

    const month = '2025-04';
    const monthName = 'April';
    const envMap = (et) => {
        if (!et) return 'other';
        const e = String(et).toLowerCase();
        return e === 'stage' ? 'staging' : e;
    };

    const mainSummary = [];
    const seenFi = new Set();
    const seenFd = new Set();
    const seenEnv = new Set();
    const seenCluster = new Set();

    raw.forEach(row => {
        const avgCpu = roundAvgCpuPercent(row.cluster_packing_percent);
        const environment = envMap(row.environment_type);
        const efficiencyIndicator = getEfficiencyIndicator(avgCpu, environment);

        const rec = {
            month: month,
            month_name: monthName,
            falcon_instance: (row.falcon_instance || '').trim(),
            functional_domain: (row.functional_domain || '').trim(),
            environment: environment,
            cluster: (row.k8s_cluster || '').trim(),
            avg_cpu: avgCpu,
            node_count: 1,
            avg_pod_count: 0,
            efficiency_indicator: efficiencyIndicator
        };
        mainSummary.push(rec);

        seenFi.add(rec.falcon_instance);
        seenFd.add(rec.functional_domain);
        seenEnv.add(rec.environment);
        seenCluster.add(rec.cluster);
    });

    const clusterSummary = mainSummary.slice();

    const filterOptions = {
        falcon_instances: [...seenFi].filter(Boolean).sort(),
        functional_domains: [...seenFd].filter(Boolean).sort(),
        environments: [...seenEnv].filter(Boolean).sort(),
        clusters: [...seenCluster].filter(Boolean).sort(),
        months: [month]
    };

    const avgCpuOverall = mainSummary.length ? mainSummary.reduce((s, r) => s + r.avg_cpu, 0) / mainSummary.length : 0;
    const monthlySummary = [{ month: month, month_name: monthName, avg_cpu: avgCpuOverall }];
    const clusterTrend = [{ month: month, month_name: monthName, avg_cpu: avgCpuOverall }];
    const environmentSummary = [];
    const fiSummary = [];
    const fdSummary = [];

    return {
        mainSummary,
        clusterSummary,
        filterOptions,
        monthlySummary,
        environmentSummary,
        fiSummary,
        fdSummary,
        clusterTrend
    };
}

/**
 * Load all Karpenter data files
 */
async function loadKarpenterData() {
    if (karpenterData.loaded) {
        console.log('📦 Karpenter data already loaded');
        return;
    }
    
    console.log('📦 Loading Karpenter data...');

    // Source of truth: Full Karpenter files under Bin-packing Overall
    try {
        let allRows = [];
        let seenFi = new Set();
        let seenFd = new Set();
        let seenEnv = new Set();
        let seenCluster = new Set();
        let seenMonths = new Set();

        for (const base of KARPENTER_FULL_BASES) {
            const results = await Promise.allSettled(
                KARPENTER_FULL_FILES.map(async ({ month, monthName, files }) => {
                    for (const f of files) {
                        try {
                            const r = await fetch(base + f);
                            if (!r.ok) continue;
                            const text = await r.text();
                            const rows = buildKarpenterRowsFromMonthlyCSV(text, month, monthName);
                            if (rows.length > 0) return rows;
                        } catch (_) {
                            // try next filename variant
                        }
                    }
                    return [];
                })
            );

            allRows = [];
            seenFi = new Set();
            seenFd = new Set();
            seenEnv = new Set();
            seenCluster = new Set();
            seenMonths = new Set();

            results.forEach((result) => {
                if (result.status === 'fulfilled' && Array.isArray(result.value) && result.value.length > 0) {
                    allRows.push(...result.value);
                    result.value.forEach(r => {
                        if (r.falcon_instance) seenFi.add(r.falcon_instance);
                        if (r.functional_domain) seenFd.add(r.functional_domain);
                        if (r.environment) seenEnv.add(r.environment);
                        if (r.cluster) seenCluster.add(r.cluster);
                        if (r.month) seenMonths.add(r.month);
                    });
                }
            });

            if (allRows.length > 0) {
                break;
            }
        }

        if (allRows.length > 0) {
            const monthsSorted = [...seenMonths].sort();
            karpenterData.mainSummary = allRows;
            karpenterData.clusterSummary = allRows.slice();
            karpenterData.filterOptions = {
                falcon_instances: [...seenFi].sort(),
                functional_domains: [...seenFd].sort(),
                environments: [...seenEnv].sort(),
                clusters: [...seenCluster].sort(),
                months: monthsSorted
            };
            karpenterData.monthlySummary = monthsSorted.map(m => {
                const monthRows = allRows.filter(r => r.month === m);
                const name = monthRows[0]?.month_name || m;
                const avg = monthRows.length ? monthRows.reduce((s, r) => s + r.avg_cpu, 0) / monthRows.length : 0;
                return { month: m, month_name: name, avg_cpu: roundAvgCpuPercent(avg) };
            });
            karpenterData.clusterTrend = karpenterData.monthlySummary.slice();
            karpenterData.environmentSummary = [];
            karpenterData.fiSummary = [];
            karpenterData.fdSummary = [];
            karpenterData.loaded = true;
            console.log('✅ Karpenter data loaded from Bin-packing Overall:', {
                main: karpenterData.mainSummary.length,
                months: monthsSorted.length
            });
            populateKarpenterFilters();
            return;
        }
    } catch (e) {
        console.log('📦 Bin-packing Overall load failed, falling back:', e.message);
    }
    
    // Source of truth: Cpu allocation rate monthly files folder (Apr 2025 - Feb 2026). cluster_packing_percent = avg. CPU allocation rate %, 2 decimals.
    try {
        let allRows = [];
        let seenFi = new Set();
        let seenFd = new Set();
        let seenEnv = new Set();
        let seenCluster = new Set();
        let seenMonths = new Set();
        let failedMonths = [];
        for (const base of KARPENTER_MONTHLY_BASES) {
            const results = await Promise.allSettled(
                KARPENTER_MONTHLY_FILES.map(async ({ file, month, monthName, fullFile }) => {
                    // For Jan/Feb try Full Karpenter file (has karpenter_status) from every base so Disabled view has data
                    if (fullFile) {
                        for (const b of KARPENTER_MONTHLY_BASES) {
                            try {
                                const r = await fetch(b + fullFile);
                                if (r.ok) {
                                    const text = await r.text();
                                    const rows = buildKarpenterRowsFromMonthlyCSV(text, month, monthName);
                                    if (rows.length > 0) return rows;
                                }
                            } catch (_) { /* try next base */ }
                        }
                    }
                    const r = await fetch(base + file);
                    if (!r.ok) throw new Error(r.status);
                    const text = await r.text();
                    return buildKarpenterRowsFromMonthlyCSV(text, month, monthName);
                })
            );
            allRows = [];
            seenFi = new Set();
            seenFd = new Set();
            seenEnv = new Set();
            seenCluster = new Set();
            seenMonths = new Set();
            failedMonths = [];
            results.forEach((result, i) => {
                const { monthName } = KARPENTER_MONTHLY_FILES[i];
                if (result.status === 'fulfilled' && Array.isArray(result.value) && result.value.length > 0) {
                    allRows.push(...result.value);
                    result.value.forEach(r => {
                        if (r.falcon_instance) seenFi.add(r.falcon_instance);
                        if (r.functional_domain) seenFd.add(r.functional_domain);
                        if (r.environment) seenEnv.add(r.environment);
                        if (r.cluster) seenCluster.add(r.cluster);
                        if (r.month) seenMonths.add(r.month);
                    });
                } else if (result.status === 'rejected') {
                    failedMonths.push(monthName + ' ' + (result.reason?.message || result.reason));
                }
            });
            // Use this base if we got any data (at least one month); otherwise try next base
            const expectedMonthCount = KARPENTER_MONTHLY_FILES.length;
            if (allRows.length > 0 && seenMonths.size >= 1) {
                break;
            }
            if (allRows.length > 0 && seenMonths.size < expectedMonthCount && failedMonths.length > 0) {
                console.log('📦 Karpenter: base returned only ' + seenMonths.size + ' months (missing: ' + failedMonths.join(', ') + '), trying next base');
            }
        }
        if (failedMonths.length > 0) {
            console.log('📦 Karpenter (Cpu allocation rate monthly files): failed months:', failedMonths);
        }
        if (allRows.length > 0) {
            const monthsSorted = [...seenMonths].sort();
            karpenterData.mainSummary = allRows;
            karpenterData.clusterSummary = allRows.slice();
            karpenterData.filterOptions = {
                falcon_instances: [...seenFi].sort(),
                functional_domains: [...seenFd].sort(),
                environments: [...seenEnv].sort(),
                clusters: [...seenCluster].sort(),
                months: monthsSorted
            };
            const avgCpuOverall = allRows.reduce((s, r) => s + r.avg_cpu, 0) / allRows.length;
            karpenterData.monthlySummary = monthsSorted.map(m => {
                const monthRows = allRows.filter(r => r.month === m);
                const name = monthRows[0]?.month_name || m;
                const avg = monthRows.length ? monthRows.reduce((s, r) => s + r.avg_cpu, 0) / monthRows.length : 0;
                return { month: m, month_name: name, avg_cpu: roundAvgCpuPercent(avg) };
            });
            karpenterData.clusterTrend = karpenterData.monthlySummary.slice();
            karpenterData.environmentSummary = [];
            karpenterData.fiSummary = [];
            karpenterData.fdSummary = [];
            karpenterData.loaded = true;
            console.log('✅ Karpenter data loaded from Cpu allocation rate monthly files (Apr 2025 - Feb 2026):', {
                main: karpenterData.mainSummary.length,
                months: monthsSorted.length,
                filterOptions: Object.keys(karpenterData.filterOptions)
            });
            console.log('📦 Months in filterOptions:', karpenterData.filterOptions.months);
            // Load enabled clusters list so "Karpenter Disabled" = clusters not in list (shows data)
            try {
                const enabledResp = await fetch('assets/data/karpenter/karpenter_enabled_clusters.csv');
                if (enabledResp.ok) {
                    const enabledText = await enabledResp.text();
                    const enabledRows = parseCSV(enabledText);
                    const clusterCol = enabledRows[0] && (enabledRows[0].k8s_cluster != null) ? 'k8s_cluster' : 'cluster';
                    karpenterData.enabledClusterSet = new Set(enabledRows.map(r => (r[clusterCol] || r.k8s_cluster || '').trim()).filter(Boolean));
                    console.log('📦 Karpenter enabled clusters loaded (monthly path):', karpenterData.enabledClusterSet.size);
                } else {
                    karpenterData.enabledClusterSet = new Set();
                }
            } catch (e) {
                karpenterData.enabledClusterSet = new Set();
            }
            populateKarpenterFilters();
            return;
        }
    } catch (e) {
        console.log('📦 Monthly files not used, falling back to karpenter assets:', e.message);
    }
    
    try {
        const baseUrl = 'assets/data/karpenter';
        
        const [main, monthly, env, cluster, fi, fd, filters, trend] = await Promise.all([
            fetch(`${baseUrl}/main_summary.csv`).then(r => r.text()),
            fetch(`${baseUrl}/monthly_summary.csv`).then(r => r.text()),
            fetch(`${baseUrl}/environment_summary.csv`).then(r => r.text()),
            fetch(`${baseUrl}/cluster_summary.csv`).then(r => r.text()),
            fetch(`${baseUrl}/fi_summary.csv`).then(r => r.text()),
            fetch(`${baseUrl}/fd_summary.csv`).then(r => r.text()),
            fetch(`${baseUrl}/filter_options.json`).then(r => r.json()),
            fetch(`${baseUrl}/cluster_trend.csv`).then(r => r.text())
        ]);
        
        karpenterData.mainSummary = parseCSV(main);  // Comprehensive data with all filter columns
        // Normalize avg_cpu to 0-100 so production never shows >100% (fallback CSV may have bad values)
        karpenterData.mainSummary = karpenterData.mainSummary.map(r => {
            const raw = parseFloat(r.avg_cpu || r.avgCpu || r.avg_cpu_allocation_rate || 0) || 0;
            const capped = Math.min(100, Math.max(0, raw));
            return { ...r, avg_cpu: capped, avgCpu: capped };
        });
        karpenterData.monthlySummary = parseCSV(monthly);
        karpenterData.environmentSummary = parseCSV(env);
        karpenterData.clusterSummary = parseCSV(cluster);
        karpenterData.fiSummary = parseCSV(fi);
        karpenterData.fdSummary = parseCSV(fd);
        karpenterData.filterOptions = filters;
        karpenterData.clusterTrend = parseCSV(trend);
        karpenterData.loaded = true;
        
        console.log('✅ Karpenter data loaded:', {
            main: karpenterData.mainSummary.length,
            months: karpenterData.monthlySummary.length,
            clusters: karpenterData.clusterSummary.length,
            filterOptions: Object.keys(karpenterData.filterOptions)
        });
        console.log('📦 Months in filterOptions:', karpenterData.filterOptions.months);
        
        // Load Karpenter enabled clusters list for Exec view toggle (optional)
        try {
            const enabledResp = await fetch(`${baseUrl}/karpenter_enabled_clusters.csv`);
            if (enabledResp.ok) {
                const enabledText = await enabledResp.text();
                const enabledRows = parseCSV(enabledText);
                const clusterCol = enabledRows[0] && (enabledRows[0].k8s_cluster != null) ? 'k8s_cluster' : 'cluster';
                karpenterData.enabledClusterSet = new Set(enabledRows.map(r => (r[clusterCol] || r.k8s_cluster || '').trim()).filter(Boolean));
                console.log('📦 Karpenter enabled clusters loaded:', karpenterData.enabledClusterSet.size);
            } else {
                karpenterData.enabledClusterSet = new Set();
            }
        } catch (e) {
            karpenterData.enabledClusterSet = new Set();
        }
        
        // Populate filter dropdowns
        populateKarpenterFilters();
        
    } catch (error) {
        console.error('❌ Error loading Karpenter data:', error);
    }
}

/**
 * Populate Karpenter filter dropdowns
 */
function populateKarpenterFilters() {
    const options = karpenterData.filterOptions;
    
    // Falcon Instance
    const fiSelect = document.getElementById('karpenter-fi-filter');
    if (fiSelect && options.falcon_instances) {
        fiSelect.innerHTML = '<option value="all">All FI</option>' +
            options.falcon_instances.map(fi => `<option value="${fi}">${fi}</option>`).join('');
    }
    
    // Functional Domain
    const fdSelect = document.getElementById('karpenter-fd-filter');
    if (fdSelect && options.functional_domains) {
        fdSelect.innerHTML = '<option value="all">All FD</option>' +
            options.functional_domains.map(fd => `<option value="${fd}">${fd}</option>`).join('');
    }
    
    // Environment (exclude "other" as it has no data)
    const envSelect = document.getElementById('karpenter-env-filter');
    if (envSelect && options.environments) {
        const validEnvironments = options.environments.filter(env => env !== 'other');
        envSelect.innerHTML = '<option value="all">All Environments</option>' +
            validEnvironments.map(env => `<option value="${env}">${env.charAt(0).toUpperCase() + env.slice(1)}</option>`).join('');
    }
    
    // Cluster
    const clusterSelect = document.getElementById('karpenter-cluster-filter');
    if (clusterSelect && options.clusters) {
        clusterSelect.innerHTML = '<option value="all">All Clusters</option>' +
            options.clusters.map(c => `<option value="${c}">${c}</option>`).join('');
    }
    
    // Month (sort in reverse order - latest first)
    const monthSelect = document.getElementById('karpenter-month-filter');
    if (monthSelect && options.months) {
        const sortedMonths = [...options.months].sort((a, b) => b.localeCompare(a)); // Reverse sort
        console.log('📦 Populating month filter with months:', sortedMonths);
        
        // Month name mapping to avoid timezone issues
        const monthNames = {
            '01': 'January', '02': 'February', '03': 'March', '04': 'April',
            '05': 'May', '06': 'June', '07': 'July', '08': 'August',
            '09': 'September', '10': 'October', '11': 'November', '12': 'December'
        };
        
        monthSelect.innerHTML = '<option value="all">All Months</option>' +
            sortedMonths.map(m => {
                try {
                    const [year, month] = m.split('-');
                    const monthName = monthNames[month] || month;
                    const displayText = `${monthName} ${year}`;
                    console.log(`📦 Adding month option: ${m} -> ${displayText}`);
                    return `<option value="${m}">${displayText}</option>`;
                } catch (e) {
                    console.warn('⚠️ Error parsing month:', m, e);
                    return `<option value="${m}">${m}</option>`;
                }
            }).join('');
        console.log('📦 Month filter populated. Total options:', monthSelect.options.length);
    }
}

/**
 * Clear Karpenter filters when data is intentionally hidden.
 * Keep Duration available per product request.
 */
function clearKarpenterFiltersExceptDuration() {
    const blankOption = '<option value="all">No Data</option>';
    const filterIds = [
        'karpenter-fi-filter',
        'karpenter-fd-filter',
        'karpenter-env-filter',
        'karpenter-cluster-filter',
        'karpenter-month-filter'
    ];

    filterIds.forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        el.innerHTML = blankOption;
        el.value = 'all';
        el.disabled = true;
    });

    const durationEl = document.getElementById('karpenter-duration-filter');
    if (durationEl) {
        durationEl.disabled = false;
    }

    karpenterFilterState.fi = 'all';
    karpenterFilterState.fd = 'all';
    karpenterFilterState.environment = 'all';
    karpenterFilterState.cluster = 'all';
    karpenterFilterState.month = 'all';
}

/**
 * Set Karpenter Enabled/Disabled toggle and refresh (Exec view)
 */
function setKarpenterToggle(value) {
    karpenterFilterState.karpenterToggle = value === 'enabled' || value === 'disabled' ? value : 'all';
    applyKarpenterFilters();
}

/**
 * Apply Karpenter filters
 */
function applyKarpenterFilters() {
    karpenterFilterState.fi = document.getElementById('karpenter-fi-filter')?.value || 'all';
    karpenterFilterState.fd = document.getElementById('karpenter-fd-filter')?.value || 'all';
    karpenterFilterState.environment = document.getElementById('karpenter-env-filter')?.value || 'all';
    karpenterFilterState.cluster = document.getElementById('karpenter-cluster-filter')?.value || 'all';
    karpenterFilterState.month = document.getElementById('karpenter-month-filter')?.value || 'all';
    karpenterFilterState.duration = document.getElementById('karpenter-duration-filter')?.value || '30';
    
    console.log('📦 Karpenter filters applied:', karpenterFilterState);
    
    renderKarpenter();
}

/**
 * Reset Karpenter filters
 */
function resetKarpenterFilters() {
    karpenterFilterState = { fi: 'all', fd: 'all', environment: 'all', cluster: 'all', month: 'all', duration: '30', karpenterToggle: 'enabled' };
    
    document.getElementById('karpenter-fi-filter').value = 'all';
    document.getElementById('karpenter-fd-filter').value = 'all';
    document.getElementById('karpenter-env-filter').value = 'all';
    document.getElementById('karpenter-cluster-filter').value = 'all';
    document.getElementById('karpenter-month-filter').value = 'all';
    const durationEl = document.getElementById('karpenter-duration-filter');
    if (durationEl) durationEl.value = '30';
    
    renderKarpenter();
}

/**
 * Filter Karpenter data based on current filter state
 * Duration filter: 7 = last 1 month, 15 = last 2 months, 30 = all months (by month code order)
 * @param {boolean} applyDuration - If false, duration filter is skipped (used for trend chart so all months show)
 */
function filterKarpenterData(data, includeMonth = true, applyDuration = true) {
    let out = data.filter(row => {
        // FI filter - check multiple column name variations
        if (karpenterFilterState.fi !== 'all') {
            const rowFI = row.falcon_instance || row.falconInstance || row.FI || row.fi || row.falcon_instance_name;
            if (rowFI && rowFI !== karpenterFilterState.fi) return false;
        }
        
        // FD filter - check multiple column name variations
        if (karpenterFilterState.fd !== 'all') {
            const rowFD = row.functional_domain || row.functionalDomain || row.FD || row.fd;
            if (rowFD && rowFD !== karpenterFilterState.fd) return false;
        }
        
        // Environment filter - check multiple column name variations and case-insensitive
        if (karpenterFilterState.environment !== 'all') {
            const rowEnv = row.environment || row.Environment || row.env || row.Env;
            if (rowEnv && rowEnv.toLowerCase() !== karpenterFilterState.environment.toLowerCase()) return false;
        }
        
        // Cluster filter - check multiple column name variations
        if (karpenterFilterState.cluster !== 'all') {
            const rowCluster = row.cluster || row.Cluster || row.k8s_cluster || row.k8sCluster || row.cluster_name;
            if (rowCluster && rowCluster !== karpenterFilterState.cluster) return false;
        }
        
        // Karpenter Enabled / Disabled toggle (Exec view)
        const toggle = karpenterFilterState.karpenterToggle || 'all';
        if (toggle !== 'all') {
            const rowCluster = (row.cluster || row.Cluster || row.k8s_cluster || row.k8sCluster || row.cluster_name || '').trim();
            const statusRaw = (row.karpenter_status || '').trim();
            const status = statusRaw.toLowerCase();
            let isEnabled;
            // Prefer row-level karpenter_status when present (e.g. from Full Karpenter files)
            if (status !== '') {
                isEnabled = status === 'karpenter_enabled' || status === 'karpenter enabled';
            } else if (karpenterData.enabledClusterSet && karpenterData.enabledClusterSet.size > 0) {
                isEnabled = rowCluster && karpenterData.enabledClusterSet.has(rowCluster);
            } else {
                isEnabled = false;
            }
            if (toggle === 'enabled' && !isEnabled) return false;
            if (toggle === 'disabled' && isEnabled) return false;
        }
        
        // Month filter
        if (includeMonth && karpenterFilterState.month !== 'all') {
            const rowMonth = row.month || row.Month || row.month_code;
            if (rowMonth && rowMonth !== karpenterFilterState.month) return false;
        }
        
        return true;
    });

    // Apply duration filter: restrict to last N months (data is monthly)
    if (!applyDuration) {
        return out;
    }
    const duration = karpenterFilterState.duration || '30';
    const durationMonths = duration === '7' ? 1 : duration === '15' ? 2 : 0; // 0 = all months
    if (durationMonths > 0 && out.length > 0) {
        const months = [...new Set(out.map(r => r.month || r.Month || r.month_code))].filter(Boolean).sort();
        const allowedMonths = new Set(months.slice(-durationMonths));
        out = out.filter(row => {
            const m = row.month || row.Month || row.month_code;
            return m && allowedMonths.has(m);
        });
    }

    return out;
}

/**
 * Render Karpenter tab based on current view mode
 */
async function renderKarpenter() {
    console.log('📦 Rendering Karpenter...');
    await loadKarpenterData();
    
    const container = document.getElementById('karpenter-content');
    if (!container) {
        console.error('❌ Karpenter content container not found');
        return;
    }
    
    if (!karpenterData.loaded) {
        console.log('⚠️ Karpenter data not loaded, showing loading message');
        container.innerHTML = '<div style="padding: 2rem; text-align: center; color: #64748b;">Loading Karpenter data...</div>';
        return;
    }
    
    const viewMode = fkpDashboard.state.currentViewMode || 'exec';
    console.log('📦 Rendering Karpenter in', viewMode, 'view mode');
    
    if (viewMode === 'exec') {
        renderKarpenterExecView(container);
    } else {
        renderKarpenterDeveloperView(container);
    }
}

/**
 * Render Karpenter Exec View
 */
function renderKarpenterExecView(container) {
    console.log('📦 Rendering Karpenter Exec View...');
    
    // Always sync filter state from DOM so avg FI/FD/Cluster/Environment reflect current dropdown selection
    karpenterFilterState.fi = document.getElementById('karpenter-fi-filter')?.value || 'all';
    karpenterFilterState.fd = document.getElementById('karpenter-fd-filter')?.value || 'all';
    karpenterFilterState.environment = document.getElementById('karpenter-env-filter')?.value || 'all';
    karpenterFilterState.cluster = document.getElementById('karpenter-cluster-filter')?.value || 'all';
    karpenterFilterState.month = document.getElementById('karpenter-month-filter')?.value || 'all';
    karpenterFilterState.duration = document.getElementById('karpenter-duration-filter')?.value || '30';
    // Do NOT sync karpenterToggle from DOM here: on re-render the DOM still has the previous
    // active button, which would overwrite the value just set by setKarpenterToggle('disabled').
    
    console.log('📦 Current filter state:', karpenterFilterState);
    
    // Use main_summary which has ALL filter columns for proper cross-filtering
    const filteredData = filterKarpenterData(karpenterData.mainSummary, true, true);
    
    // For trend chart: use duration-filtered data so 7d/15d/30d changes which months appear
    const dataForTrendMonths = filterKarpenterData(karpenterData.mainSummary, true, true);
    
    // Check which months are in the filtered data (sort chronologically by month code so latest = last)
    const monthCodeOrder = (a, b) => String(a).localeCompare(String(b));
    const monthsInData = [...new Set(filteredData.map(r => r.month))].filter(Boolean).sort(monthCodeOrder);
    console.log('📦 Filtered main summary:', filteredData.length, 'rows');
    console.log('📦 Months in filtered data:', monthsInData);
    console.log('📦 FI filter:', karpenterFilterState.fi);
    console.log('📦 FD filter:', karpenterFilterState.fd);
    console.log('📦 Environment filter:', karpenterFilterState.environment);
    console.log('📦 Cluster filter:', karpenterFilterState.cluster);
    console.log('📦 Month filter:', karpenterFilterState.month);
    
    if (karpenterFilterState.fi !== 'all') {
        const uniqueFIs = [...new Set(filteredData.map(r => r.falcon_instance))];
        console.log('📦 Unique FIs in filtered data:', uniqueFIs);
    }
    if (karpenterFilterState.fd !== 'all') {
        const uniqueFDs = [...new Set(filteredData.map(r => r.functional_domain))];
        console.log('📦 Unique FDs in filtered data:', uniqueFDs);
    }
    if (karpenterFilterState.environment !== 'all') {
        const uniqueEnvs = [...new Set(filteredData.map(r => r.environment))];
        console.log('📦 Unique Environments in filtered data:', uniqueEnvs);
    }
    
    // Get all available months from full dataset to find previous month (chronological order)
    const allMonths = [...new Set(karpenterData.mainSummary.map(r => r.month))].filter(Boolean).sort(monthCodeOrder);
    
    // Helper function to get previous month
    const getPreviousMonth = (month) => {
        const monthIndex = allMonths.indexOf(month);
        return monthIndex > 0 ? allMonths[monthIndex - 1] : null;
    };
    
    // Helper to get data for a specific month with same filters (except month)
    const getDataForMonth = (month) => {
        // Filter data with same filters but different month
        return karpenterData.mainSummary.filter(row => {
            // Apply all current filters except month
            if (karpenterFilterState.fi !== 'all' && 'falcon_instance' in row && row.falcon_instance !== karpenterFilterState.fi) return false;
            if (karpenterFilterState.fd !== 'all' && 'functional_domain' in row && row.functional_domain !== karpenterFilterState.fd) return false;
            if (karpenterFilterState.environment !== 'all' && 'environment' in row && row.environment !== karpenterFilterState.environment) return false;
            if (karpenterFilterState.cluster !== 'all' && 'cluster' in row && row.cluster !== karpenterFilterState.cluster) return false;
            // Use the specified month instead of filter state
            if (row.month !== month) return false;
            return true;
        });
    };
    
    // Helper to calculate weighted average for a dataset grouped by a dimension
    const calcAvgForData = (data, groupBy) => {
        if (!data || data.length === 0) return null;
        
        // Group by the dimension
        const byGroup = {};
        data.forEach(r => {
            const key = r[groupBy] || 'unknown';
            if (!byGroup[key]) byGroup[key] = { sum: 0, count: 0 };
            byGroup[key].sum += parseFloat(r.avg_cpu || 0);
            byGroup[key].count += 1;
        });
        
        // Calculate average for each group, then average those
        const groups = Object.values(byGroup);
        const groupAvgs = groups.map(g => g.sum / g.count);
        return groupAvgs.reduce((a, b) => a + b, 0) / groupAvgs.length;
    };
    
    // Helper to calculate weighted average grouped by a dimension
    // When dataPrevMonth is provided: card avg = average over data (latest month only), trend = % change vs dataPrevMonth (previous month)
    const calcGroupedAvg = (data, groupBy, dataPrevMonth) => {
        if (!data || data.length === 0) return { avg: '--', trend: 0, trendLabel: 'vs previous month' };
        
        const byGroup = {};
        data.forEach(r => {
            let key = 'unknown';
            if (groupBy === 'falcon_instance') {
                key = r.falcon_instance || r.falconInstance || r.FI || r.fi || r.falcon_instance_name || 'unknown';
            } else if (groupBy === 'functional_domain') {
                key = r.functional_domain || r.functionalDomain || r.FD || r.fd || 'unknown';
            } else if (groupBy === 'environment') {
                key = (r.environment || r.Environment || r.env || r.Env || 'unknown').toLowerCase();
            } else if (groupBy === 'cluster') {
                key = r.cluster || r.Cluster || r.k8s_cluster || r.k8sCluster || r.cluster_name || 'unknown';
            } else {
                key = r[groupBy] || 'unknown';
            }
            if (!byGroup[key]) byGroup[key] = { sum: 0, count: 0 };
            const raw = parseFloat(r.avg_cpu || r.avgCpu || r.avg_cpu_allocation_rate || 0);
            const nonNegative = Math.max(0, raw);
            byGroup[key].sum += nonNegative;
            byGroup[key].count += 1;
        });
        const groupAvgs = Object.values(byGroup).map(g => g.sum / g.count);
        const rawCardAvg = groupAvgs.length > 0
            ? groupAvgs.reduce((a, b) => a + b, 0) / groupAvgs.length
            : null;
        const cardAvg = rawCardAvg !== null ? Math.min(100, Math.max(0, rawCardAvg)).toFixed(2) : '--';
        
        let trend = 0;
        let trendLabel = 'vs previous month';
        if (dataPrevMonth && dataPrevMonth.length > 0) {
            const byGroupPrev = {};
            dataPrevMonth.forEach(r => {
                let key = 'unknown';
                if (groupBy === 'falcon_instance') key = r.falcon_instance || r.falconInstance || r.FI || r.fi || r.falcon_instance_name || 'unknown';
                else if (groupBy === 'functional_domain') key = r.functional_domain || r.functionalDomain || r.FD || r.fd || 'unknown';
                else if (groupBy === 'environment') key = (r.environment || r.Environment || r.env || r.Env || 'unknown').toLowerCase();
                else if (groupBy === 'cluster') key = r.cluster || r.Cluster || r.k8s_cluster || r.k8sCluster || r.cluster_name || 'unknown';
                else key = r[groupBy] || 'unknown';
                if (!byGroupPrev[key]) byGroupPrev[key] = { sum: 0, count: 0 };
                const raw = parseFloat(r.avg_cpu || r.avgCpu || r.avg_cpu_allocation_rate || 0);
                byGroupPrev[key].sum += Math.max(0, raw);
                byGroupPrev[key].count += 1;
            });
            const prevGroupAvgs = Object.values(byGroupPrev).map(g => g.sum / g.count);
            const prevAvg = prevGroupAvgs.length > 0 ? prevGroupAvgs.reduce((a, b) => a + b, 0) / prevGroupAvgs.length : 0;
            if (prevAvg > 0 && rawCardAvg !== null) {
                trend = ((rawCardAvg - prevAvg) / prevAvg) * 100;
            }
            const prevMonthName = dataPrevMonth[0].month_name || 'previous month';
            trendLabel = 'vs ' + prevMonthName;
        }
        
        return { avg: cardAvg, trend, trendLabel };
    };
    
    // Use latest month only for card averages (e.g. Feb); trend = vs previous month (e.g. Jan)
    // Use like-for-like: only clusters present in BOTH months so trend is not skewed by different cluster sets
    const latestMonth = monthsInData.length > 0 ? monthsInData[monthsInData.length - 1] : null;
    const prevMonth = monthsInData.length >= 2 ? monthsInData[monthsInData.length - 2] : (latestMonth ? getPreviousMonth(latestMonth) : null);
    const dataLatestMonth = latestMonth ? filteredData.filter(r => (r.month || r.Month || r.month_code) === latestMonth) : filteredData;
    const dataPrevMonth = prevMonth ? filteredData.filter(r => (r.month || r.Month || r.month_code) === prevMonth) : [];
    const clustersLatest = new Set(dataLatestMonth.map(r => (r.cluster || r.Cluster || r.k8s_cluster || r.k8sCluster || r.cluster_name || '').trim()).filter(Boolean));
    const clustersPrev = new Set(dataPrevMonth.map(r => (r.cluster || r.Cluster || r.k8s_cluster || r.k8sCluster || r.cluster_name || '').trim()).filter(Boolean));
    const clustersBothMonths = [...clustersLatest].filter(c => clustersPrev.has(c));
    const dataLatestLikeForLike = clustersBothMonths.length > 0
        ? dataLatestMonth.filter(r => clustersBothMonths.includes((r.cluster || r.Cluster || r.k8s_cluster || r.k8sCluster || r.cluster_name || '').trim()))
        : dataLatestMonth;
    const dataPrevLikeForLike = clustersBothMonths.length > 0
        ? dataPrevMonth.filter(r => clustersBothMonths.includes((r.cluster || r.Cluster || r.k8s_cluster || r.k8sCluster || r.cluster_name || '').trim()))
        : dataPrevMonth;
    
    // Row-average for selected month/status. This matches source full files directly.
    const calcOverallAvg = (data) => {
        if (!data || data.length === 0) return null;
        const vals = data.map(r => r.avg_cpu || r.avgCpu || r.avg_cpu_allocation_rate || 0);
        return computeRobustAvgCpu(vals);
    };
    const rawOverallLatest = calcOverallAvg(dataLatestMonth);
    const rawOverallPrev = calcOverallAvg(dataPrevMonth);
    // Trend: use like-for-like clusters (present in both months) so Jan vs Feb is comparable
    const rawOverallLatestLFL = calcOverallAvg(dataLatestLikeForLike);
    const rawOverallPrevLFL = calcOverallAvg(dataPrevLikeForLike);
    const cardAvg = rawOverallLatest !== null ? rawOverallLatest.toFixed(2) : '--';
    let trend = 0;
    let trendLabel = 'vs previous month';
    if (rawOverallPrevLFL !== null && rawOverallPrevLFL > 0 && rawOverallLatestLFL !== null) {
        trend = ((rawOverallLatestLFL - rawOverallPrevLFL) / rawOverallPrevLFL) * 100;
        const prevMonthName = dataPrevMonth.length > 0 && dataPrevMonth[0].month_name ? dataPrevMonth[0].month_name : (prevMonth || 'previous month');
        trendLabel = 'vs ' + prevMonthName;
    } else if (rawOverallPrev !== null && rawOverallPrev > 0 && rawOverallLatest !== null) {
        trend = ((rawOverallLatest - rawOverallPrev) / rawOverallPrev) * 100;
        const prevMonthName = dataPrevMonth.length > 0 && dataPrevMonth[0].month_name ? dataPrevMonth[0].month_name : (prevMonth || 'previous month');
        trendLabel = 'vs ' + prevMonthName;
    }
    
    // All four cards show the same overall average (cluster-weighted) and trend (latest month only)
    const avgFI = cardAvg;
    const avgFD = cardAvg;
    const avgCluster = cardAvg;
    const avgEnv = cardAvg;
    const trendFI = trend;
    const trendFD = trend;
    const trendCluster = trend;
    const trendEnv = trend;
    
    // Build trend chart data from actual month codes present in filtered data.
    // This keeps latest month accurate (e.g. March 2026) and avoids hardcoded month maps.
    const trendMonthCodes = [...new Set(dataForTrendMonths.map(r => r.month))].filter(Boolean).sort(monthCodeOrder);
    const rawTrendData = trendMonthCodes.map(monthCode => {
        const monthData = dataForTrendMonths.filter(r => r.month === monthCode);
        if (monthData.length === 0) return null;
        
        // Use row-average (same as cards) for consistent values.
        const vals = monthData.map(r => r.avg_cpu || r.avgCpu || r.avg_cpu_allocation_rate || 0);
        const avg = computeRobustAvgCpu(vals) || 0;
        
        const first = monthData[0] || {};
        const yearSuffix = monthCode.includes('-') ? monthCode.split('-')[0] : '';
        const label = first.month_name ? `${first.month_name} ${yearSuffix}` : monthCode;
        console.log(`📦 ${label} (${monthCode}): ${monthData.length} rows, row-avg: ${avg.toFixed(2)}%`);
        
        return {
            month: label,
            monthCode: monthCode,
            value: avg
        };
    }).filter(d => d !== null); // Only include months with data
    
    console.log('📦 Raw trend data before adjustment:', rawTrendData.map(d => `${d.month}: ${d.value.toFixed(2)}%`));
    
    // Use raw averages; cap at 100% and smooth outliers so the line doesn't spike off the chart
    const trendData = [];
    let prevValue = null;
    rawTrendData.forEach(d => {
        const v = roundAvgCpuPercent(d.value);
        const capped = Math.min(100, v);
        // If value is over 100% (data anomaly), use previous month's value so the line doesn't spike
        const value = v > 100 ? (prevValue !== null ? prevValue : 100) : capped;
        prevValue = value;
        trendData.push({ month: d.month, monthCode: d.monthCode, value });
    });
    
    console.log('📦 Trend data (actual):', trendData.map(d => `${d.month}: ${d.value}%`));
    
    // Build environment month-series from active filters.
    // Month behavior:
    // - Month = all -> latest month in the filtered scope (ignoring toggle), so All/Enabled/Disabled stay aligned.
    // - Month selected -> selected month only.
    const prevToggleForEnv = karpenterFilterState.karpenterToggle;
    karpenterFilterState.karpenterToggle = 'all';
    const envScopeRows = filterKarpenterData(karpenterData.mainSummary, false, true);
    karpenterFilterState.karpenterToggle = prevToggleForEnv;

    const envSourceRows = filterKarpenterData(karpenterData.mainSummary, false, true);
    const envMonths = [...new Set(envScopeRows.map(r => r.month || r.Month || r.month_code))]
        .filter(Boolean)
        .sort(monthCodeOrder);
    const envLatestMonth = envMonths.length > 0 ? envMonths[envMonths.length - 1] : null;
    const targetMonth = karpenterFilterState.month !== 'all' ? karpenterFilterState.month : envLatestMonth;

    // Pie chart source ignores enabled/disabled toggle to show full split for the same scoped month.
    const prevToggleForPie = karpenterFilterState.karpenterToggle;
    karpenterFilterState.karpenterToggle = 'all';
    const pieBaseRows = filterKarpenterData(karpenterData.mainSummary, false, true);
    karpenterFilterState.karpenterToggle = prevToggleForPie;
    const pieMonths = [...new Set(pieBaseRows.map(r => r.month || r.Month || r.month_code))]
        .filter(Boolean)
        .sort(monthCodeOrder);
    const pieTargetMonth = karpenterFilterState.month !== 'all'
        ? karpenterFilterState.month
        : (pieMonths.length > 0 ? pieMonths[pieMonths.length - 1] : null);
    const pieMonthRows = pieTargetMonth
        ? pieBaseRows.filter(r => (r.month || r.Month || r.month_code) === pieTargetMonth)
        : pieBaseRows;
    const clusterTripleStatusMap = new Map();
    pieMonthRows.forEach(r => {
        const fi = (r.falcon_instance || r.falconInstance || r.FI || r.fi || '').trim();
        const fd = (r.functional_domain || r.functionalDomain || r.FD || r.fd || '').trim();
        const cl = (r.cluster || r.Cluster || r.k8s_cluster || r.k8sCluster || r.cluster_name || '').trim();
        if (!fi && !fd && !cl) return;
        const key = `${fi}||${fd}||${cl}`;
        const status = String(r.karpenter_status || '').trim().toLowerCase();
        const isEnabled = status === 'karpenter_enabled' || status === 'karpenter enabled';
        const prev = clusterTripleStatusMap.get(key) || { enabled: 0, disabled: 0 };
        if (isEnabled) prev.enabled += 1;
        else prev.disabled += 1;
        clusterTripleStatusMap.set(key, prev);
    });
    let enabledTriples = 0;
    let disabledTriples = 0;
    clusterTripleStatusMap.forEach(v => {
        if (v.enabled >= v.disabled) enabledTriples += 1;
        else disabledTriples += 1;
    });
    const totalTriples = enabledTriples + disabledTriples;
    const enabledPct = totalTriples > 0 ? (enabledTriples / totalTriples) * 100 : 0;
    const disabledPct = totalTriples > 0 ? (disabledTriples / totalTriples) * 100 : 0;
    
    const normalizeEnvKey = (val) => {
        const e = String(val || '').trim().toLowerCase();
        if (e === 'stage') return 'staging';
        if (e === 'prod' || e === 'esvc' || e === 'test' || e === 'dev' || e === 'staging' || e === 'perf') return e;
        return '';
    };

    const envMonthly = {};
    envSourceRows.forEach(r => {
        const m = r.month || r.Month || r.month_code;
        if (!m) return;
        const key = normalizeEnvKey(r.environment || r.Environment || r.env || r.Env);
        if (!key) return;
        if (!envMonthly[m]) envMonthly[m] = {};
        if (!envMonthly[m][key]) {
            envMonthly[m][key] = { sum: 0, count: 0 };
        }
        envMonthly[m][key].sum += parseFloat(r.avg_cpu || 0);
        envMonthly[m][key].count += 1;
    });

    // Fixed environment order for bar chart
    const envOrder = ['Prod', 'Esvc', 'Stage', 'Dev', 'Test'];
    const envDisplayMap = {
        prod: 'Prod',
        esvc: 'Esvc',
        staging: 'Stage',
        stage: 'Stage',
        dev: 'Dev',
        test: 'Test'
    };
    const envOrderMap = {};
    envOrder.forEach((env, idx) => {
        envOrderMap[env.toLowerCase()] = idx;
    });
    
    const monthEnvAgg = targetMonth && envMonthly[targetMonth] ? envMonthly[targetMonth] : {};
    const monthRowsCount = targetMonth
        ? envSourceRows.filter(r => (r.month || r.Month || r.month_code) === targetMonth).length
        : 0;
    const envBarData = Object.entries(monthEnvAgg)
        .map(([key, e]) => ({
            name: envDisplayMap[key] || (key.charAt(0).toUpperCase() + key.slice(1)),
            value: e.count > 0 ? (e.sum / e.count) : 0
        }))
        .filter(item => envOrderMap[item.name.toLowerCase()] !== undefined)
        .sort((a, b) => {
            const aOrder = envOrderMap[a.name.toLowerCase()] !== undefined ? envOrderMap[a.name.toLowerCase()] : 999;
            const bOrder = envOrderMap[b.name.toLowerCase()] !== undefined ? envOrderMap[b.name.toLowerCase()] : 999;
            return aOrder - bOrder;
        });
    console.log('📦 Environment chart month (single-month only):', targetMonth, '| rows:', monthRowsCount, '| values:', envBarData.map(e => `${e.name}: ${e.value.toFixed(2)}%`).join(', '));

    // Build environment trend data by month (for multi-line chart)
    const envTrendOrder = ['prod', 'esvc', 'staging', 'dev', 'test'];
    const envLabelMap = { prod: 'Prod', esvc: 'Esvc', staging: 'Stage', test: 'Test', perf: 'Perf', dev: 'Dev' };
    const monthLabelsByCode = {};
    envMonths.forEach(monthCode => {
        const monthData = envSourceRows.filter(r => (r.month || r.Month || r.month_code) === monthCode);
        const first = monthData[0] || {};
        const yearSuffix = monthCode.includes('-') ? monthCode.split('-')[0] : '';
        monthLabelsByCode[monthCode] = first.month_name ? `${first.month_name} ${yearSuffix}` : monthCode;
    });

    const envTrendMonths = karpenterFilterState.month !== 'all'
        ? envMonths.filter(m => m === karpenterFilterState.month)
        : envMonths;

    const envSeries = envTrendOrder.map(envKey => {
        const points = envTrendMonths.map(monthCode => {
            const agg = envMonthly[monthCode] && envMonthly[monthCode][envKey] ? envMonthly[monthCode][envKey] : null;
            if (!agg || agg.count === 0) return null;
            const avg = agg.sum / agg.count;
            return { monthCode, monthLabel: monthLabelsByCode[monthCode], value: roundAvgCpuPercent(avg) };
        });
        const hasAny = points.some(Boolean);
        return { key: envKey, label: envLabelMap[envKey], points, hasAny };
    }).filter(s => s.hasAny);

    const buildGaugeCard = (label, icon, avgValue, trendValue) => {
        const parsed = typeof avgValue === 'string' ? parseFloat(avgValue) : avgValue;
        const gaugeValue = Number.isFinite(parsed) ? Math.max(0, Math.min(100, parsed)) : 0;
        const arcLength = Math.PI * 55;
        const fillLength = (gaugeValue / 100) * arcLength;
        const trendClass = trendValue >= 0 ? 'trend-up' : 'trend-down';
        const trendArrow = trendValue >= 0 ? '↑' : '↓';
        const trendText = `${trendArrow} ${trendValue >= 0 ? '+' : ''}${trendValue.toFixed(1)}% ${trendLabel}`;
        return `
            <div class="karpenter-metric-card karpenter-speedometer-card">
                <div class="karpenter-metric-header">
                    <span class="karpenter-metric-label">${label}</span>
                    <span class="karpenter-metric-icon">${icon}</span>
                </div>
                <div class="karpenter-speedometer-wrap">
                    <svg viewBox="0 0 140 90" class="karpenter-speedometer-svg" aria-hidden="true">
                        <path d="M 15 75 A 55 55 0 0 1 125 75" class="karpenter-speedometer-track"></path>
                        <path d="M 15 75 A 55 55 0 0 1 125 75" class="karpenter-speedometer-fill"
                            style="stroke-dasharray: ${fillLength} ${arcLength};"></path>
                        <text x="70" y="68" text-anchor="middle" class="karpenter-speedometer-value">${gaugeValue.toFixed(1)}%</text>
                    </svg>
                </div>
                <div class="karpenter-metric-trend ${trendClass}">${trendText}</div>
            </div>
        `;
    };
    
    container.innerHTML = `
        <div class="karpenter-exec-content">
            <!-- Karpenter Enabled / Disabled toggle (Exec view only) -->
            <div class="karpenter-toggle-row">
                <span class="karpenter-toggle-label">View:</span>
                <div class="karpenter-toggle-group">
                    <button type="button" class="karpenter-toggle-btn ${karpenterFilterState.karpenterToggle === 'all' ? 'active' : ''}" data-value="all" onclick="setKarpenterToggle('all')">All</button>
                    <button type="button" class="karpenter-toggle-btn ${karpenterFilterState.karpenterToggle === 'enabled' ? 'active' : ''}" data-value="enabled" onclick="setKarpenterToggle('enabled')">Karpenter Enabled</button>
                    <button type="button" class="karpenter-toggle-btn ${karpenterFilterState.karpenterToggle === 'disabled' ? 'active' : ''}" data-value="disabled" onclick="setKarpenterToggle('disabled')">Karpenter Disabled</button>
                </div>
            </div>
            ${filteredData.length === 0 && karpenterFilterState.karpenterToggle === 'disabled' ? `
            <div class="karpenter-empty-toggle-message">
                ${(karpenterData.enabledClusterSet && karpenterData.enabledClusterSet.size > 0) ? 'No clusters outside the enabled list in the current data or filters. Add Jan/Feb Full Karpenter files (with karpenter_status column) under assets/data/Cpu allocation rate monthly files/ for Karpenter Disabled data when using a deployed app.' : 'Load the enabled clusters list (karpenter_enabled_clusters.csv) or add Jan/Feb Full Karpenter files under assets/data/Cpu allocation rate monthly files/ to see Karpenter Disabled view.'}
            </div>
            ` : ''}
            <div class="karpenter-top-analytics-row">
                <div class="karpenter-cluster-pie-section">
                    <div class="karpenter-cluster-pie-header">
                        <span class="karpenter-trend-title">Total Clusters (FI/FD/Cluster)</span>
                        <span class="karpenter-trend-legend">Month: ${pieTargetMonth || '-'}</span>
                    </div>
                    ${renderKarpenterClusterPie({
                        total: totalTriples,
                        enabled: enabledTriples,
                        disabled: disabledTriples,
                        enabledPct,
                        disabledPct
                    })}
                </div>
                <div class="karpenter-env-bar-section karpenter-env-bar-inline">
                    <div class="karpenter-env-bar-header">
                        <span class="karpenter-env-bar-title">Avg. CPU Allocation rate by Environment</span>
                        <span class="karpenter-env-bar-legend"><span class="legend-dot"></span> Avg. CPU Allocation rate (%)</span>
                    </div>
                    <div class="karpenter-bar-chart" id="karpenter-bar-chart">
                        ${renderKarpenterBarChart(envBarData)}
                    </div>
                </div>
            </div>
            <!-- Metric Cards -->
            <div class="karpenter-metrics-grid">
                ${buildGaugeCard('Avg. CPU Allocation rate - FI', '📊', avgFI, trendFI)}
                ${buildGaugeCard('Avg. CPU Allocation rate - FD', '⚙️', avgFD, trendFD)}
                ${buildGaugeCard('Avg. CPU Allocation rate - Cluster', '🖥️', avgCluster, trendCluster)}
                ${buildGaugeCard('Avg. CPU Allocation rate - Environment', '🌐', avgEnv, trendEnv)}
            </div>
            
            <!-- Charts Row -->
            <div class="karpenter-charts-row">
                <!-- Trend Chart - minimal layout like Availability section -->
                <div class="karpenter-trend-section">
                    <div class="karpenter-trend-section-header">
                        <span class="karpenter-trend-title">Avg. CPU Allocation rate Trends</span>
                        <span class="karpenter-trend-legend"><span class="legend-dot"></span> Avg. CPU Allocation rate (%)</span>
                    </div>
                    <div class="karpenter-trend-chart" id="karpenter-trend-chart">
                        ${renderKarpenterTrendChart(trendData)}
                    </div>
                </div>
            </div>
            <div class="karpenter-trend-section" style="margin-top: 1rem;">
                <div class="karpenter-trend-section-header">
                    <span class="karpenter-trend-title">Avg. CPU Allocation rate Trends by Environment</span>
                </div>
                <div class="karpenter-trend-chart" id="karpenter-env-trend-chart">
                    ${renderKarpenterEnvironmentTrendChart(envSeries, envTrendMonths, monthLabelsByCode)}
                </div>
            </div>
        </div>
    `;
    
    console.log('✅ Karpenter Exec View rendered');
}

/**
 * Render Karpenter Developer View (Cluster Table)
 */
/**
 * Calculate efficiency indicator based on CPU % and environment
 * Matches the logic in process_karpenter_data.py
 */
function getEfficiencyIndicator(avgCpu, environment) {
    if (environment === 'prod' || environment === 'esvc') {
        if (avgCpu > 80) return 'Efficient';
        if (avgCpu >= 50) return 'Moderately Efficient';
        return 'Inefficient';
    } else {
        // test, perf, dev, staging, other
        if (avgCpu > 90) return 'Efficient';
        if (avgCpu >= 70) return 'Moderately Efficient';
        return 'Inefficient';
    }
}

function renderKarpenterDeveloperView(container) {
    console.log('📦 Rendering Karpenter Developer View...');
    
    // Sync filter state from DOM so table and heatmaps reflect current dropdown selection
    karpenterFilterState.fi = document.getElementById('karpenter-fi-filter')?.value || 'all';
    karpenterFilterState.fd = document.getElementById('karpenter-fd-filter')?.value || 'all';
    karpenterFilterState.environment = document.getElementById('karpenter-env-filter')?.value || 'all';
    karpenterFilterState.cluster = document.getElementById('karpenter-cluster-filter')?.value || 'all';
    karpenterFilterState.month = document.getElementById('karpenter-month-filter')?.value || 'all';
    karpenterFilterState.duration = document.getElementById('karpenter-duration-filter')?.value || '30';
    // Developer view supports only Enabled scope.
    karpenterFilterState.karpenterToggle = 'enabled';
    
    // Get filtered cluster data based on current filter state
    let filteredData = filterKarpenterData(karpenterData.clusterSummary, true);
    
    // Group by cluster and find latest month for each
    const clusterMap = {};
    filteredData.forEach(row => {
        const cluster = row.cluster;
        if (!clusterMap[cluster]) {
            clusterMap[cluster] = [];
        }
        clusterMap[cluster].push(row);
    });
    
    // For each cluster, get latest month data
    const clusterLatest = [];
    const allMonths = [...new Set(filteredData.map(r => r.month))].sort();
    const latestMonth = allMonths.length > 0 ? allMonths[allMonths.length - 1] : null;
    const prevMonth = allMonths.length >= 2 ? allMonths[allMonths.length - 2] : null;
    
    Object.keys(clusterMap).forEach(cluster => {
        const clusterRows = clusterMap[cluster];
        
        // Group by month and aggregate avg_cpu (mean across all FI/FD combinations)
        const monthGroups = {};
        clusterRows.forEach(row => {
            const month = row.month;
            if (!monthGroups[month]) {
                monthGroups[month] = {
                    month: month,
                    month_name: row.month_name,
                    cpuValues: [],
                    environments: []
                };
            }
            monthGroups[month].cpuValues.push(parseFloat(row.avg_cpu || 0));
            monthGroups[month].environments.push(row.environment || 'other');
        });
        
        // Calculate aggregated avg_cpu for each month
        const monthData = Object.values(monthGroups).map(m => ({
            month: m.month,
            month_name: m.month_name,
            avgCpu: m.cpuValues.reduce((sum, val) => sum + val, 0) / m.cpuValues.length,
            // Get most common environment for this month
            environment: m.environments.reduce((a, b, _, arr) => 
                arr.filter(v => v === a).length >= arr.filter(v => v === b).length ? a : b
            )
        }));
        
        // Sort by month descending to get latest
        monthData.sort((a, b) => b.month.localeCompare(a.month));
        const latestMonthData = monthData[0];
        
        // Get unique months for display (sorted chronologically)
        const uniqueMonths = [...new Set(clusterRows.map(r => r.month))].sort();
        const allClusterMonths = uniqueMonths.map(month => {
            const firstRow = clusterRows.find(r => r.month === month);
            return {
                month: month,
                month_name: firstRow.month_name
            };
        });
        
        // Find previous month aggregated data
        let prevMonthData = null;
        if (prevMonth && monthData.length >= 2) {
            prevMonthData = monthData.find(m => m.month === prevMonth);
        }
        
        // Calculate improvement using aggregated values
        let improvement = null;
        let improvementLabel = 'No Change';
        let improvementClass = 'stable';
        
        if (prevMonthData) {
            improvement = latestMonthData.avgCpu - prevMonthData.avgCpu;
            if (improvement > 0) {
                improvementLabel = '↑ Improved';
                improvementClass = 'improved';
            } else if (improvement < 0) {
                improvementLabel = '↓ Regressed';
                improvementClass = 'regressed';
            } else {
                improvementLabel = '→ No Change';
                improvementClass = 'stable';
            }
        }
        
        // Calculate efficiency indicator based on aggregated latest month's CPU % and environment
        const avgCpu = latestMonthData.avgCpu;
        const environment = latestMonthData.environment;
        const efficiencyIndicator = getEfficiencyIndicator(avgCpu, environment);
        const efficiencyClass = efficiencyIndicator === 'Efficient' ? 'efficient' : 
                               (efficiencyIndicator === 'Moderately Efficient' ? 'moderate' : 'inefficient');
        
        clusterLatest.push({
            cluster: cluster,
            avgCpu: avgCpu,
            month: latestMonthData.month,
            monthName: latestMonthData.month_name,
            allMonths: allClusterMonths,
            improvement: improvement,
            improvementLabel: improvementLabel,
            improvementClass: improvementClass,
            efficiencyIndicator: efficiencyIndicator,
            efficiencyClass: efficiencyClass,
            environment: environment
        });
    });
    
    // Sort by efficiency indicator (Efficient > Moderately Efficient > Inefficient), then by avg_cpu descending
    const efficiencyOrder = { 'Efficient': 3, 'Moderately Efficient': 2, 'Inefficient': 1 };
    clusterLatest.sort((a, b) => {
        const aOrder = efficiencyOrder[a.efficiencyIndicator] || 0;
        const bOrder = efficiencyOrder[b.efficiencyIndicator] || 0;
        if (aOrder !== bOrder) return bOrder - aOrder; // Higher efficiency first
        return b.avgCpu - a.avgCpu; // Then by CPU descending
    });
    
    // Helper function to render heatmap tiles
    const renderHeatmap = (clusters, title) => {
        if (clusters.length === 0) {
            return `<div class="karpenter-heatmap-section">
                <h3 class="karpenter-heatmap-title">${title}</h3>
                <div class="no-data">No clusters available</div>
            </div>`;
        }
        
        const tiles = clusters.map(cluster => {
            const environment = cluster.environment || 'prod';
            const monthName = cluster.monthName || cluster.month || 'Unknown';
            return `
                <div class="karpenter-heatmap-tile ${cluster.efficiencyClass}" onclick="showClusterNodes('${cluster.cluster}', '${cluster.month}', '${cluster.avgCpu}', '${environment}', '${monthName}')" style="cursor: pointer;">
                    <div class="heatmap-cluster-name">${cluster.cluster}</div>
                    <div class="heatmap-efficiency-pct">${cluster.avgCpu.toFixed(2)}%</div>
                </div>
            `;
        }).join('');
        
        return `
            <div class="karpenter-heatmap-section">
                <h3 class="karpenter-heatmap-title">${title}</h3>
                <div class="karpenter-heatmap-grid">
                    ${tiles}
                </div>
            </div>
        `;
    };
    
    // Get top 5 most efficient (first 5 from sorted list, or all if <5)
    const top5MostEfficient = clusterLatest.slice(0, Math.min(5, clusterLatest.length));
    
    // Get top 5 least efficient (last 5 from sorted list, or all if <5, reversed to show worst first)
    const top5LeastEfficient = clusterLatest.length <= 5 
        ? [...clusterLatest].reverse() // If 5 or fewer, show all reversed
        : clusterLatest.slice(-5).reverse(); // Otherwise, last 5 reversed
    
    // Build heatmaps
    const allClustersHeatmap = renderHeatmap(clusterLatest, 'Avg. CPU Allocation rate Heatmap - All Clusters');
    const top5MostHeatmap = renderHeatmap(top5MostEfficient, 'Top 5 - Most Efficient Clusters');
    const top5LeastHeatmap = renderHeatmap(top5LeastEfficient, 'Top 5 - Least Efficient Clusters');
    
    // Build table rows
    const tableRows = clusterLatest.map(cluster => {
        // Build month display with latest month in bold
        const monthDisplay = cluster.allMonths.map(m => {
            const isLatest = m.month === cluster.month;
            return isLatest ? `<strong>${m.month_name}</strong>` : m.month_name;
        }).join(', ');
        
        return `
            <tr>
                <td class="cluster-name">${cluster.cluster}</td>
                <td class="month-column">${monthDisplay}</td>
                <td class="avg-cpu">${cluster.avgCpu.toFixed(2)}</td>
                <td><span class="improvement-badge ${cluster.improvementClass}">${cluster.improvementLabel}</span></td>
                <td><span class="efficiency-badge ${cluster.efficiencyClass}">${cluster.efficiencyIndicator}</span></td>
            </tr>
        `;
    }).join('');
    
    container.innerHTML = `
        <div class="karpenter-dev-content">
            <!-- Karpenter toggle (Developer view: enabled only) -->
            <div class="karpenter-toggle-row">
                <span class="karpenter-toggle-label">View:</span>
                <div class="karpenter-toggle-group">
                    <button type="button" class="karpenter-toggle-btn ${karpenterFilterState.karpenterToggle === 'enabled' ? 'active' : ''}" data-value="enabled" onclick="setKarpenterToggle('enabled')">Karpenter Enabled</button>
                </div>
            </div>
            ${filteredData.length === 0 ? `
            <div class="karpenter-empty-toggle-message">
                No enabled clusters found for the current filters.
            </div>
            ` : ''}
            <!-- Heatmaps Section -->
            <div class="karpenter-heatmaps-container">
                ${allClustersHeatmap}
                ${top5MostHeatmap}
                ${top5LeastHeatmap}
            </div>
            
            <!-- Table Section -->
            <div class="karpenter-table-container">
                <table class="karpenter-table">
                    <thead>
                        <tr>
                            <th>Cluster</th>
                            <th>Month</th>
                            <th>Avg. CPU Allocation rate (%)</th>
                            <th>Avg. CPU Allocation rate Improvement</th>
                            <th>Avg. CPU Allocation rate Indicator</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${tableRows || '<tr><td colspan="5" class="no-data">No data available</td></tr>'}
                    </tbody>
                </table>
            </div>
        </div>
    `;
    
    console.log(`✅ Karpenter Developer View rendered with ${clusterLatest.length} clusters`);
}

/**
 * Show cluster nodes in a modal window
 */
async function showClusterNodes(clusterName, monthCode, clusterAvgCpu, environment, monthName = null) {
    // Convert clusterAvgCpu to number (it may be passed as string from onclick)
    const avgCpu = parseFloat(clusterAvgCpu) || 0;
    console.log(`📊 Showing nodes for cluster: ${clusterName}, month: ${monthCode}, avgCpu: ${avgCpu}`);
    
    // Get latest month from data if month not provided or use provided month name
    let displayMonthName = monthName;
    if (!displayMonthName) {
        // Convert month code (e.g., "2025-10") to month name
        if (monthCode && monthCode.includes('-')) {
            const [year, monthNum] = monthCode.split('-');
            const monthNames = ["January", "February", "March", "April", "May", "June",
                              "July", "August", "September", "October", "November", "December"];
            const monthIndex = parseInt(monthNum) - 1;
            if (monthIndex >= 0 && monthIndex < 12) {
                displayMonthName = `${monthNames[monthIndex]} ${year}`;
            } else {
                displayMonthName = monthCode;
            }
        } else {
            // If no month code, get latest month from data
            if (karpenterData && karpenterData.mainSummary && karpenterData.mainSummary.length > 0) {
                const allMonths = [...new Set(karpenterData.mainSummary.map(r => r.month))].sort();
                const latestMonthCode = allMonths[allMonths.length - 1];
                if (latestMonthCode && latestMonthCode.includes('-')) {
                    const [year, monthNum] = latestMonthCode.split('-');
                    const monthNames = ["January", "February", "March", "April", "May", "June",
                                      "July", "August", "September", "October", "November", "December"];
                    const monthIndex = parseInt(monthNum) - 1;
                    if (monthIndex >= 0 && monthIndex < 12) {
                        displayMonthName = `${monthNames[monthIndex]} ${year}`;
                    }
                }
            }
            if (!displayMonthName) {
                displayMonthName = 'Latest Month';
            }
        }
    }
    
    // Extract node data from Core CPU Allocation Rate CSV files using Device column
    let nodes = [];
    
    try {
        // Map month code to Core CPU CSV filename
        const monthToCsvFile = {
            '2025-04': 'Core April CPU Allocation rate.csv',
            '2025-05': 'Core May CPU Allocation Rate.csv',
            '2025-06': 'Core June CPU allocation rate.csv',
            '2025-07': 'Core July CPU allocation rate.csv',
            '2025-08': 'Core August CPU Allocation Rate.csv',
            '2025-09': 'Core Sep CPU Allocation Rate.csv',
            '2025-10': 'Core Oct CPU Allocation Rate.csv'
        };
        
        const csvFileName = monthToCsvFile[monthCode];
        
        if (csvFileName) {
            console.log(`📊 Loading device data from ${csvFileName} for cluster ${clusterName}`);
            
            // Try to load the Core CPU CSV file
            try {
                // URL encode the filename to handle spaces - encode the entire filename
                const csvUrl = `assets/data/core-cpu/${encodeURIComponent(csvFileName)}`;
                
                const response = await fetch(csvUrl);
                if (response.ok) {
                    const csvText = await response.text();
                    const coreCpuData = parseCSV(csvText);
                    
                    console.log(`✅ Loaded ${coreCpuData.length} rows from ${csvFileName}`);
                    
                    // Debug: Check first row structure
                    if (coreCpuData.length > 0) {
                        console.log('📊 Sample CSV row columns:', Object.keys(coreCpuData[0]));
                        console.log('📊 Sample CSV row data:', coreCpuData[0]);
                    }
                    
                    // Filter data for this specific cluster
                    let matchCount = 0;
                    const nodeData = coreCpuData.filter(row => {
                        const rowCluster = row.k8s_cluster || row.cluster || row.k8sCluster;
                        const matches = rowCluster === clusterName;
                        if (matches && matchCount < 5) {
                            console.log('📊 Matching row:', { cluster: rowCluster, device: row.device || row.Device, avg_cpu: row.avg_cpu });
                            matchCount++;
                        }
                        return matches;
                    });
                    
                    console.log(`📊 Found ${nodeData.length} device records for cluster ${clusterName}`);
                    console.log(`📊 Looking for cluster: "${clusterName}"`);
                    
                    if (nodeData.length > 0) {
                        // Group by Device column to get unique devices with their avg_cpu
                        const deviceMap = {};
                        
                        nodeData.forEach(row => {
                            // Extract device name from Device column - try all variations (case-insensitive)
                            // The CSV header is lowercase 'device', so check that first
                            const device = row.device || row.Device || 
                                         (row.hasOwnProperty('device') ? row.device : null) ||
                                         (row.hasOwnProperty('Device') ? row.Device : null) ||
                                         null;
                            const avgCpu = parseFloat(row.avg_cpu || row.avgCpu || row['avg_cpu'] || 0);
                            
                            if (!device && nodeData.indexOf(row) < 3) {
                                console.warn('⚠️ No device found in row:', { 
                                    keys: Object.keys(row), 
                                    sample: row 
                                });
                            }
                            
                            if (device && device.trim() && !isNaN(avgCpu) && avgCpu > 0) {
                                const deviceKey = device.trim();
                                if (!deviceMap[deviceKey]) {
                                    deviceMap[deviceKey] = { sum: 0, count: 0 };
                                }
                                deviceMap[deviceKey].sum += avgCpu;
                                deviceMap[deviceKey].count += 1;
                            }
                        });
                        
                        console.log(`📊 Found ${Object.keys(deviceMap).length} unique devices in deviceMap`);
                        if (Object.keys(deviceMap).length > 0) {
                            console.log('📊 Sample devices:', Object.keys(deviceMap).slice(0, 3));
                        }
                        
                        // Convert to nodes array with average CPU per device
                        nodes = Object.keys(deviceMap).map(device => {
                            const deviceData = deviceMap[device];
                            const avgCpuValue = deviceData.sum / deviceData.count;
                            
                            // Calculate efficiency status
                            const envLower = (environment || 'prod').toLowerCase();
                            const isProdOrEsvc = envLower === 'prod' || envLower.includes('esvc');
                            
                            let efficiencyIndicator = 'Inefficient';
                            let efficiencyClass = 'inefficient';
                            
                            if (isProdOrEsvc) {
                                if (avgCpuValue > 80) {
                                    efficiencyIndicator = 'Efficient';
                                    efficiencyClass = 'efficient';
                                } else if (avgCpuValue >= 50) {
                                    efficiencyIndicator = 'Moderately Efficient';
                                    efficiencyClass = 'moderate';
                                }
                            } else {
                                if (avgCpuValue > 90) {
                                    efficiencyIndicator = 'Efficient';
                                    efficiencyClass = 'efficient';
                                } else if (avgCpuValue >= 70) {
                                    efficiencyIndicator = 'Moderately Efficient';
                                    efficiencyClass = 'moderate';
                                }
                            }
                            
                            return {
                                device: device, // Device name from CSV Device column
                                name: device,   // Use device as name (for backward compatibility)
                                avgCpu: avgCpuValue,
                                efficiencyIndicator: efficiencyIndicator,
                                efficiencyClass: efficiencyClass
                            };
                        });
                        
                        // Sort nodes by CPU descending before logging
                        nodes.sort((a, b) => b.avgCpu - a.avgCpu);
                        
                        console.log(`✅ Extracted ${nodes.length} unique devices from ${csvFileName} for cluster ${clusterName}`);
                        if (nodes.length > 0) {
                            console.log('📊 Sample device names:', nodes.slice(0, 3).map(n => n.device));
                        }
                    } else {
                        console.log(`⚠️ No device data found in ${csvFileName} for cluster ${clusterName}, using simulated nodes`);
                        nodes = generateSimulatedNodes(clusterName, avgCpu, 10, environment);
                    }
                } else {
                    console.error(`❌ Could not load ${csvFileName}: HTTP ${response.status} ${response.statusText}`);
                    console.error(`❌ Requested URL: ${csvUrl}`);
                    console.warn(`⚠️ Falling back to simulated nodes`);
                    nodes = generateSimulatedNodes(clusterName, avgCpu, 10, environment);
                }
            } catch (fetchError) {
                console.warn(`⚠️ Error loading ${csvFileName}:`, fetchError);
                console.log('📊 Falling back to simulated nodes');
                nodes = generateSimulatedNodes(clusterName, avgCpu, 10, environment);
            }
        } else {
            console.log(`⚠️ No CSV file mapping for month ${monthCode}, using simulated nodes`);
            nodes = generateSimulatedNodes(clusterName, avgCpu, 10, environment);
        }
    } catch (error) {
        console.error('❌ Error extracting node data:', error);
        console.log('📊 Falling back to simulated nodes');
        nodes = generateSimulatedNodes(clusterName, avgCpu, 10, environment);
    }
    
    // Sort nodes by avg CPU descending
    nodes.sort((a, b) => b.avgCpu - a.avgCpu);
    
    // Create modal HTML
    const modalHTML = `
        <div id="cluster-nodes-modal" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.6); z-index: 10000; display: flex; align-items: center; justify-content: center;">
            <div style="background: white; border-radius: 12px; padding: 2rem; max-width: 900px; max-height: 80vh; overflow-y: auto; box-shadow: 0 10px 40px rgba(0,0,0,0.3);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                    <h2 style="font-size: 1.5rem; font-weight: 600; color: #1e293b; margin: 0;">
                        Nodes in ${clusterName}
                    </h2>
                    <button onclick="closeClusterNodesModal()" style="background: none; border: none; font-size: 1.5rem; cursor: pointer; color: #64748b; padding: 0.5rem;">&times;</button>
                </div>
                <div style="margin-bottom: 1rem; color: #64748b; font-size: 0.875rem;">
                    Month: <strong>${displayMonthName}</strong> | Cluster Avg. CPU Allocation rate: <strong>${avgCpu.toFixed(1)}%</strong>
                </div>
                <div style="margin-bottom: 1rem;">
                    <span style="display: inline-block; padding: 0.25rem 0.75rem; background: #dcfce7; color: #166534; border-radius: 4px; font-size: 0.75rem; margin-right: 0.5rem;">
                        <span style="display: inline-block; width: 8px; height: 8px; background: #16a34a; border-radius: 50%; margin-right: 0.25rem;"></span>
                        Efficient (prod/esvc: >80%, others: >90%)
                    </span>
                    <span style="display: inline-block; padding: 0.25rem 0.75rem; background: #fef3c7; color: #92400e; border-radius: 4px; font-size: 0.75rem; margin-right: 0.5rem;">
                        <span style="display: inline-block; width: 8px; height: 8px; background: #f59e0b; border-radius: 50%; margin-right: 0.25rem;"></span>
                        Moderately Efficient (prod/esvc: 50-80%, others: 70-90%)
                    </span>
                    <span style="display: inline-block; padding: 0.25rem 0.75rem; background: #fee2e2; color: #991b1b; border-radius: 4px; font-size: 0.75rem;">
                        <span style="display: inline-block; width: 8px; height: 8px; background: #dc2626; border-radius: 50%; margin-right: 0.25rem;"></span>
                        Inefficient (prod/esvc: <50%, others: <70%)
                    </span>
                </div>
                <table style="width: 100%; border-collapse: collapse;">
                    <thead>
                        <tr style="background: #f8fafc; border-bottom: 2px solid #e2e8f0;">
                            <th style="padding: 0.75rem; text-align: left; font-weight: 600; color: #475569; font-size: 0.875rem;">Device Name</th>
                            <th style="padding: 0.75rem; text-align: right; font-weight: 600; color: #475569; font-size: 0.875rem;">Avg. CPU Allocation rate (%)</th>
                            <th style="padding: 0.75rem; text-align: center; font-weight: 600; color: #475569; font-size: 0.875rem;">Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${nodes.map(node => {
                            const statusClass = node.efficiencyClass;
                            const statusLabel = node.efficiencyIndicator;
                            // Use device name from CSV Device column - prioritize device over name
                            const displayName = (node.device && node.device.trim()) ? node.device.trim() : (node.name || 'Unknown');
                            return `
                                <tr style="border-bottom: 1px solid #e2e8f0;">
                                    <td style="padding: 0.75rem; color: #1e293b; font-size: 0.875rem;">${displayName}</td>
                                    <td style="padding: 0.75rem; text-align: right; color: #1e293b; font-size: 0.875rem; font-weight: 600;">${node.avgCpu.toFixed(1)}%</td>
                                    <td style="padding: 0.75rem; text-align: center;">
                                        <span class="efficiency-badge ${statusClass}" style="display: inline-block; padding: 0.25rem 0.75rem; border-radius: 4px; font-size: 0.75rem; font-weight: 500;">
                                            ${statusLabel}
                                        </span>
                                    </td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
    
    // Remove existing modal if any
    const existingModal = document.getElementById('cluster-nodes-modal');
    if (existingModal) {
        existingModal.remove();
    }
    
    // Add modal to page
    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

/**
 * Generate simulated nodes based on cluster avg CPU
 */
function generateSimulatedNodes(clusterName, clusterAvgCpu, nodeCount, environment) {
    const nodes = [];
    const envLower = (environment || 'prod').toLowerCase();
    const isProdOrEsvc = envLower === 'prod' || envLower.includes('esvc');
    
    // Generate nodes with CPU values distributed around cluster avg CPU
    for (let i = 1; i <= nodeCount; i++) {
        // Create variation: ±20% from cluster avg CPU
        const variation = (Math.random() - 0.5) * 0.4 * clusterAvgCpu;
        const nodeCpu = Math.max(0, Math.min(100, clusterAvgCpu + variation));
        
        // Calculate efficiency status using same logic as clusters
        let efficiencyIndicator = 'Inefficient';
        let efficiencyClass = 'inefficient';
        
        if (isProdOrEsvc) {
            if (nodeCpu > 80) {
                efficiencyIndicator = 'Efficient';
                efficiencyClass = 'efficient';
            } else if (nodeCpu >= 50) {
                efficiencyIndicator = 'Moderately Efficient';
                efficiencyClass = 'moderate';
            }
        } else {
            if (nodeCpu > 90) {
                efficiencyIndicator = 'Efficient';
                efficiencyClass = 'efficient';
            } else if (nodeCpu >= 70) {
                efficiencyIndicator = 'Moderately Efficient';
                efficiencyClass = 'moderate';
            }
        }
        
        nodes.push({
            name: `${clusterName}-node-${i.toString().padStart(3, '0')}`,
            avgCpu: nodeCpu,
            efficiencyIndicator: efficiencyIndicator,
            efficiencyClass: efficiencyClass
        });
    }
    
    return nodes;
}

/**
 * Close cluster nodes modal
 */
function closeClusterNodesModal() {
    const modal = document.getElementById('cluster-nodes-modal');
    if (modal) {
        modal.remove();
    }
}

// Make functions globally available
window.showClusterNodes = showClusterNodes;
window.closeClusterNodesModal = closeClusterNodesModal;

/**
 * Calculate trend for Karpenter data
 */
function calculateKarpenterTrend(data, field) {
    if (!data || data.length < 2) return 0;
    
    const months = [...new Set(data.map(r => r.month))].sort();
    if (months.length < 2) return 0;
    
    const prevMonth = months[months.length - 2];
    const currMonth = months[months.length - 1];
    
    const prevAvg = data.filter(r => r.month === prevMonth)
        .reduce((sum, r) => sum + parseFloat(r[field] || 0), 0) / 
        data.filter(r => r.month === prevMonth).length || 0;
    
    const currAvg = data.filter(r => r.month === currMonth)
        .reduce((sum, r) => sum + parseFloat(r[field] || 0), 0) / 
        data.filter(r => r.month === currMonth).length || 0;
    
    return currAvg - prevAvg;
}

/**
 * Render Karpenter trend line chart - Clean layout: straight lines, full grid, no label overlap
 */
function renderKarpenterTrendChart(data) {
    if (!data || data.length === 0) {
        return '<div class="no-data" style="padding: 2rem; text-align: center; color: #64748b;">No trend data available for selected filters</div>';
    }
    
    const shortMonth = { January: 'Jan', February: 'Feb', March: 'Mar', April: 'Apr', May: 'May', June: 'Jun', July: 'Jul', August: 'Aug', September: 'Sep', October: 'Oct', November: 'Nov', December: 'Dec' };
    const monthYear = (raw) => {
        if (!raw) return '';
        const text = String(raw).trim();
        const parts = text.split(/\s+/);
        if (parts.length >= 2 && /^\d{4}$/.test(parts[parts.length - 1])) {
            const m = parts[0];
            const y = parts[parts.length - 1];
            return `${shortMonth[m] || m} ${y}`;
        }
        return shortMonth[text] || text;
    };
    const monthFromCode = (code, fallback) => {
        if (!code || !String(code).includes('-')) return monthYear(fallback);
        const [year, mm] = String(code).split('-');
        const nameByNum = {
            '01': 'Jan', '02': 'Feb', '03': 'Mar', '04': 'Apr', '05': 'May', '06': 'Jun',
            '07': 'Jul', '08': 'Aug', '09': 'Sep', '10': 'Oct', '11': 'Nov', '12': 'Dec'
        };
        return `${nameByNum[mm] || mm} ${String(year).slice(-2)}`;
    };
    
    const chartWidth = 760;
    const chartHeight = 250;
    const paddingTop = 24;
    const paddingBottom = 34;
    const paddingLeft = 44;
    const paddingRight = 18;
    const plotWidth = chartWidth - paddingLeft - paddingRight;
    const plotHeight = chartHeight - paddingTop - paddingBottom;
    const baselineY = paddingTop + plotHeight;
    
    // Y-axis labels well left of plot so they never overlap first data label
    const yLabelX = paddingLeft - 20;
    
    const yTicks = [];
    for (let i = 0; i <= 5; i++) {
        const val = i * 20;
        const y = paddingTop + plotHeight - (val / 100) * plotHeight;
        yTicks.push({ val, y });
    }
    
    const pointSpacing = data.length > 1 ? plotWidth / (data.length - 1) : 0;
    const points = data.map((d, i) => {
        const x = paddingLeft + (i * pointSpacing);
        const v = Math.max(0, Math.min(100, d.value));
        const y = paddingTop + plotHeight - (v / 100) * plotHeight;
        return { x, y, value: d.value, month: d.month, label: monthFromCode(d.monthCode, d.month), monthCode: d.monthCode };
    });
    const labelStep = 1; // Always show all month labels
    
    // Smooth curve path to match Availability-style visual
    const createSmoothPath = (pts) => {
        if (pts.length === 0) return '';
        if (pts.length === 1) return `M ${pts[0].x},${pts[0].y}`;
        let d = `M ${pts[0].x},${pts[0].y}`;
        for (let i = 0; i < pts.length - 1; i++) {
            const p0 = pts[i];
            const p1 = pts[i + 1];
            const cx1 = p0.x + (p1.x - p0.x) * 0.45;
            const cy1 = p0.y;
            const cx2 = p0.x + (p1.x - p0.x) * 0.55;
            const cy2 = p1.y;
            d += ` C ${cx1},${cy1} ${cx2},${cy2} ${p1.x},${p1.y}`;
        }
        return d;
    };
    const linePath = createSmoothPath(points);
    const areaPath = points.length === 0
        ? ''
        : `${linePath} L ${points[points.length - 1].x},${baselineY} L ${points[0].x},${baselineY} Z`;
    
    const hGridLines = yTicks.map(t =>
        `<line x1="${paddingLeft}" y1="${t.y}" x2="${paddingLeft + plotWidth}" y2="${t.y}" stroke="#e5e7eb" stroke-width="1" />`
    ).join('');
    const vGridLines = points.map(p =>
        `<line x1="${p.x}" y1="${paddingTop}" x2="${p.x}" y2="${baselineY}" stroke="#e5e7eb" stroke-width="1" />`
    ).join('');
    
    return `
        <svg viewBox="0 0 ${chartWidth} ${chartHeight}" style="width: 100%; height: 100%; min-height: 200px;" class="karpenter-trend-svg" id="karpenter-trend-svg">
            <defs>
                <linearGradient id="karpenterTrendGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" style="stop-color:#3b82f6;stop-opacity:0.28" />
                    <stop offset="100%" style="stop-color:#3b82f6;stop-opacity:0.04" />
                </linearGradient>
                <clipPath id="karpenterTrendClip">
                    <rect x="${paddingLeft}" y="${paddingTop}" width="${plotWidth}" height="${plotHeight}" />
                </clipPath>
            </defs>
            <g clip-path="url(#karpenterTrendClip)">
                ${hGridLines}
                ${vGridLines}
                <path d="${areaPath}" fill="url(#karpenterTrendGradient)" />
                <path d="${linePath}" fill="none" stroke="#1d4ed8" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
            </g>
            ${points.map((p, i) => `
                <g class="karpenter-trend-point" data-index="${i}">
                    <circle cx="${p.x}" cy="${p.y}" r="4.5" fill="#0ea5e9" stroke="white" stroke-width="2" />
                    <circle cx="${p.x}" cy="${p.y}" r="12" fill="transparent" style="cursor: pointer;">
                        <title>${p.label}: ${p.value.toFixed(1)}%</title>
                    </circle>
                    <text x="${p.x}" y="${p.y - 10}" text-anchor="middle" font-size="7" fill="#475569" font-weight="600">${p.value.toFixed(1)}%</text>
                </g>
            `).join('')}
            <line x1="${paddingLeft}" y1="${baselineY}" x2="${paddingLeft + plotWidth}" y2="${baselineY}" stroke="#d1d5db" stroke-width="1" />
            ${points.map((p, i) => {
                if (i % labelStep !== 0 && i !== points.length - 1) return '';
                return `<text x="${p.x}" y="${chartHeight - 8}" text-anchor="middle" font-size="8" fill="#64748b">${p.label}</text>`;
            }).join('')}
            ${yTicks.map(t => `<text x="${yLabelX}" y="${t.y + 3}" text-anchor="end" font-size="8" fill="#64748b">${t.val}%</text>`).join('')}
        </svg>
    `;
}

/**
 * Render Karpenter environment-wise trend chart (multi-line)
 */
function renderKarpenterEnvironmentTrendChart(series, monthCodes, monthLabelsByCode) {
    if (!series || series.length === 0 || !monthCodes || monthCodes.length === 0) {
        return '<div class="no-data">No environment trend data available</div>';
    }

    const shortMonth = { January: 'Jan', February: 'Feb', March: 'Mar', April: 'Apr', May: 'May', June: 'Jun', July: 'Jul', August: 'Aug', September: 'Sep', October: 'Oct', November: 'Nov', December: 'Dec' };
    const labelFromCode = (code) => {
        const raw = monthLabelsByCode[code] || code;
        const parts = String(raw).split(/\s+/);
        if (parts.length >= 2) return `${shortMonth[parts[0]] || parts[0]} ${parts[1]}`;
        return raw;
    };

    const chartWidth = 760;
    const chartHeight = 260;
    const paddingTop = 24;
    const paddingBottom = 44;
    const paddingLeft = 44;
    const paddingRight = 18;
    const plotWidth = chartWidth - paddingLeft - paddingRight;
    const plotHeight = chartHeight - paddingTop - paddingBottom;
    const baselineY = paddingTop + plotHeight;
    const yTicks = [0, 20, 40, 60, 80, 100];
    const pointSpacing = monthCodes.length > 1 ? plotWidth / (monthCodes.length - 1) : 0;
    const xPosByMonth = {};
    monthCodes.forEach((m, i) => { xPosByMonth[m] = paddingLeft + i * pointSpacing; });

    const palette = {
        prod: '#1d4ed8',
        esvc: '#0369a1',
        stage: '#7c3aed',
        staging: '#7c3aed',
        test: '#0284c7',
        perf: '#0f766e',
        dev: '#16a34a'
    };

    const seriesPoints = series.map(s => ({
        ...s,
        color: palette[s.key] || '#334155',
        pts: s.points.map(p => {
            if (!p) return null;
            const x = xPosByMonth[p.monthCode];
            const y = paddingTop + plotHeight - (Math.max(0, Math.min(100, p.value)) / 100) * plotHeight;
            return { ...p, x, y };
        })
    }));

    const createSmoothPath = (pts) => {
        const clean = pts.filter(Boolean);
        if (clean.length === 0) return '';
        if (clean.length === 1) return `M ${clean[0].x},${clean[0].y}`;
        let d = `M ${clean[0].x},${clean[0].y}`;
        for (let i = 0; i < clean.length - 1; i++) {
            const p0 = clean[i];
            const p1 = clean[i + 1];
            const cx1 = p0.x + (p1.x - p0.x) * 0.45;
            const cy1 = p0.y;
            const cx2 = p0.x + (p1.x - p0.x) * 0.55;
            const cy2 = p1.y;
            d += ` C ${cx1},${cy1} ${cx2},${cy2} ${p1.x},${p1.y}`;
        }
        return d;
    };

    const hGrid = yTicks.map(v => {
        const y = paddingTop + plotHeight - (v / 100) * plotHeight;
        return `<line x1="${paddingLeft}" y1="${y}" x2="${paddingLeft + plotWidth}" y2="${y}" stroke="#e5e7eb" stroke-width="1" />`;
    }).join('');
    const vGrid = monthCodes.map(m => `<line x1="${xPosByMonth[m]}" y1="${paddingTop}" x2="${xPosByMonth[m]}" y2="${baselineY}" stroke="#eef2f7" stroke-width="1" />`).join('');

    const lines = seriesPoints.map(s => `<path d="${createSmoothPath(s.pts)}" fill="none" stroke="${s.color}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />`).join('');
    const dots = seriesPoints.map(s => s.pts.filter(Boolean).map(p => `
        <circle cx="${p.x}" cy="${p.y}" r="3" fill="${s.color}" stroke="white" stroke-width="1.2" style="cursor: pointer;">
            <title>${s.label} - ${labelFromCode(p.monthCode)}: ${p.value.toFixed(1)}%</title>
        </circle>
    `).join('')).join('');
    const legend = seriesPoints.map(s => `<span style="display:inline-flex;align-items:center;gap:0.35rem;margin-right:0.8rem;font-size:11px;color:#475569;"><span style="width:8px;height:8px;border-radius:50%;background:${s.color};display:inline-block;"></span>${s.label}</span>`).join('');

    const xLabels = monthCodes.map(m => `<text x="${xPosByMonth[m]}" y="${chartHeight - 8}" text-anchor="middle" font-size="8" fill="#64748b">${labelFromCode(m)}</text>`).join('');
    const yLabels = yTicks.map(v => {
        const y = paddingTop + plotHeight - (v / 100) * plotHeight;
        return `<text x="${paddingLeft - 10}" y="${y + 3}" text-anchor="end" font-size="8" fill="#64748b">${v}%</text>`;
    }).join('');

    return `
        <div style="margin-bottom:0.5rem;">${legend}</div>
        <svg viewBox="0 0 ${chartWidth} ${chartHeight}" style="width: 100%; height: 100%; min-height: 220px;">
            ${hGrid}
            ${vGrid}
            ${lines}
            ${dots}
            <line x1="${paddingLeft}" y1="${baselineY}" x2="${paddingLeft + plotWidth}" y2="${baselineY}" stroke="#cbd5e1" stroke-width="1" />
            ${xLabels}
            ${yLabels}
        </svg>
    `;
}

/**
 * Render Karpenter cluster split pie (enabled vs disabled)
 */
function renderKarpenterClusterPie(stats) {
    const total = stats?.total || 0;
    const enabled = stats?.enabled || 0;
    const disabled = stats?.disabled || 0;
    const enabledPct = stats?.enabledPct || 0;
    const disabledPct = stats?.disabledPct || 0;
    const pieGradient = `conic-gradient(#0176D3 0deg ${enabledPct * 3.6}deg, #94a3b8 ${enabledPct * 3.6}deg 360deg)`;

    return `
        <div class="karpenter-cluster-pie-wrap">
            <div class="karpenter-cluster-pie" style="background: ${pieGradient};">
                <div class="karpenter-cluster-pie-center">
                    <div class="karpenter-cluster-pie-total">${total}</div>
                    <div class="karpenter-cluster-pie-label">Total</div>
                </div>
            </div>
            <div class="karpenter-cluster-pie-stats">
                <div class="pie-stat-row">
                    <span class="dot enabled"></span>
                    <span class="pie-stat-label">Enabled</span>
                    <span class="pie-stat-value">${enabled} (${enabledPct.toFixed(1)}%)</span>
                </div>
                <div class="pie-stat-row">
                    <span class="dot disabled"></span>
                    <span class="pie-stat-label">Disabled</span>
                    <span class="pie-stat-value">${disabled} (${disabledPct.toFixed(1)}%)</span>
                </div>
            </div>
        </div>
    `;
}

/**
 * Render Karpenter environment bar chart
 */
function renderKarpenterBarChart(data) {
    if (!data || data.length === 0) {
        return '<div class="no-data">No environment data available</div>';
    }
    
    const displayName = (name) => (name === 'Staging' ? 'Stage' : name);
    
    const maxValue = 100; // Percentage max
    // Salesforce blue color shades
    const salesforceBlues = [
        { light: '#1B96FF', dark: '#0176D3' }, // Light blue
        { light: '#4A90E2', dark: '#0176D3' },  // Medium blue
        { light: '#0176D3', dark: '#014486' }, // Salesforce primary blue
        { light: '#014486', dark: '#003D82' }, // Dark blue
        { light: '#003D82', dark: '#002D5C' }, // Darker blue
        { light: '#5A9FD4', dark: '#0176D3' }  // Sky blue
    ];
    
    // Map environment names to Salesforce blue shades
    const envColorMap = {
        'Dev': { gradient: `linear-gradient(180deg, ${salesforceBlues[0].light} 0%, ${salesforceBlues[0].dark} 100%)`, solid: salesforceBlues[0].dark },
        'Test': { gradient: `linear-gradient(180deg, ${salesforceBlues[1].light} 0%, ${salesforceBlues[1].dark} 100%)`, solid: salesforceBlues[1].dark },
        'Perf': { gradient: `linear-gradient(180deg, ${salesforceBlues[2].light} 0%, ${salesforceBlues[2].dark} 100%)`, solid: salesforceBlues[2].dark },
        'Stage': { gradient: `linear-gradient(180deg, ${salesforceBlues[3].light} 0%, ${salesforceBlues[3].dark} 100%)`, solid: salesforceBlues[3].dark },
        'Esvc': { gradient: `linear-gradient(180deg, ${salesforceBlues[4].light} 0%, ${salesforceBlues[4].dark} 100%)`, solid: salesforceBlues[4].dark },
        'Prod': { gradient: `linear-gradient(180deg, ${salesforceBlues[2].light} 0%, ${salesforceBlues[2].dark} 100%)`, solid: salesforceBlues[2].dark },
        'Staging': { gradient: `linear-gradient(180deg, ${salesforceBlues[3].light} 0%, ${salesforceBlues[3].dark} 100%)`, solid: salesforceBlues[3].dark }
    };
    
    // Fallback colors using Salesforce blues
    const colors = salesforceBlues.map(b => `linear-gradient(180deg, ${b.light} 0%, ${b.dark} 100%)`);
    const solidColors = salesforceBlues.map(b => b.dark);
    
    return `
        <div class="bar-chart-container karpenter-env-bars">
            <div class="bar-chart-y-axis">
                <span>100%</span>
                <span>80%</span>
                <span>60%</span>
                <span>40%</span>
                <span>20%</span>
                <span>0%</span>
            </div>
            <div class="bar-chart-main">
                ${data.map((d, i) => {
                    const envColor = envColorMap[d.name] || { gradient: colors[i % colors.length], solid: solidColors[i % solidColors.length] };
                    const barHeightPct = Math.min(100, Math.max(0, d.value)); // Cap bar height at 100%
                    return `
                        <div class="bar-item">
                            <div class="bar-wrapper">
                                <div class="bar" style="height: ${barHeightPct}%; background: ${envColor.gradient};">
                                    <span class="bar-value-label">${d.value.toFixed(1)}%</span>
                                </div>
                            </div>
                            <span class="bar-label">${displayName(d.name)}</span>
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
    `;
}

/* ======================
   AVAILABILITY SECTION
   ====================== */

// Store availability data globally - cache all data types
let availabilityData = {
    summaryMetrics: [],    // summary_metrics.csv - KPI cards
    monthlyTrend: [],      // monthly_trend.csv - Incident trend chart
    services: [],          // services.csv - MTTD/MTTR by service, coverage matrix
    themes: [],            // themes.csv - Investment themes
    slaData: [],           // sla_data.csv - SLA goals table
    incidents: [],         // incidents_e360_total.csv - Raw incident data for Detection calculations
    serviceReadiness: [],  // hrp_service_readiness_score_data.csv - Readiness score table
    fitData: { headers: [], rows: [] },
    fitServiceProductMap: {},
    integrationFitSummary: {},
    integrationFitMonthFilter: 'last30',
    inventoryProductFilter: 'all',
    inventoryTestTypeFilter: '',
    preventionDevEntry: 'nav',
    preventionDevShowDetails: false,
    preventionDevPendingDrill: false,
    preventionDevForceSelect: false,
    inventoryRunTypeFilter: 'all',
    preventionFitMonthFilter: '',
    preventionFitGroupBy: 'product',
    preventionFitSelection: '',
    ingressAlerts: { headers: [], rows: [] },
    ingressDistribution: { headers: [], rows: [] },
    ingressAccuracy: { headers: [], rows: [] },
    hrpProductPrbOwnerMap: {},
    detectionProductFilter: 'All HRP Products',
    detectionKpiWindow: '12m',
    testInventory: {
        customerScenario: { headers: [], rows: [] },
        integration: { headers: [], rows: [] },
        scalePerf: { headers: [], rows: [] },
        chaos: { headers: [], rows: [] }
    },
    loaded: false
};

// Store projections data globally
let projectionsData = {
    loaded: false,
    roadmap: [],
    prevMetrics: null,
    currentMetrics: null,
    projections: null,
    servicesNeedingCompletion: [],
    servicesNeedingGovcloud: [],
    servicesWithoutETAs: []
};

/**
 * Parse CSV helper function
 */
function parseCSVData(csvText) {
    const lines = csvText.trim().split('\n');
    if (lines.length < 2) return [];
    const headers = lines[0].split(',');
    return lines.slice(1).filter(line => line.trim()).map(line => {
        const values = line.split(',');
        const row = {};
        headers.forEach((header, index) => {
            row[header.trim()] = values[index]?.trim() || '';
        });
        return row;
    });
}

function parseCSVWithHeaders(csvText) {
    const lines = csvText.trim().split('\n');
    if (lines.length < 2) return { headers: [], rows: [] };
    const headers = lines[0].split(',').map(header => header.trim());
    const rows = lines.slice(1).filter(line => line.trim()).map(line => {
        const values = line.split(',');
        const row = {};
        headers.forEach((header, index) => {
            row[header] = values[index]?.trim() || '';
        });
        return row;
    });
    return { headers, rows };
}

function normalizeCsvHeaders(data) {
    const headers = (data.headers || []).map(h => (h || '').replace(/^\uFEFF/, '').trim());
    const headerMap = {};
    (data.headers || []).forEach((h, i) => {
        headerMap[h] = headers[i] || h;
    });
    const rows = (data.rows || []).map(row => {
        const normalized = {};
        Object.entries(row || {}).forEach(([key, value]) => {
            const cleanKey = (headerMap[key] || key || '').replace(/^\uFEFF/, '').trim();
            normalized[cleanKey] = value;
        });
        return normalized;
    });
    return { headers, rows };
}

function parseFitRunDate(raw) {
    if (!raw) return null;
    const cleaned = raw.toString().replace(' @ ', ' ').trim();
    if (!cleaned) return null;
    const date = new Date(cleaned);
    if (Number.isNaN(date.getTime())) return null;
    if (date.getFullYear() < 2000) return null;
    return date;
}

const excludedFitServices = new Set([
    'caasla',
    'caaspc',
    'caasvb',
    'hawking-istiod',
    'sfcd-argo-workflows',
    'hawking-istio-operator'
]);

function getFilteredFitRows() {
    const rows = availabilityData.fitData?.rows || [];
    return rows.filter(row => {
        const service = (row.Service || row['\ufeffService'] || '').trim().toLowerCase();
        return service && !excludedFitServices.has(service);
    });
}

let preventionFitChart = null;
let integrationTrendChart = null;

function parseCSVLineRespectQuotes(line) {
    const values = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
            const nextChar = line[i + 1];
            if (inQuotes && nextChar === '"') {
                current += '"';
                i += 1;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (char === ',' && !inQuotes) {
            values.push(current);
            current = '';
        } else {
            current += char;
        }
    }
    values.push(current);
    return values;
}

function parseCSVWithHeadersRobust(csvText) {
    const lines = csvText.trim().split('\n');
    if (lines.length < 2) return { headers: [], rows: [] };
    const headers = parseCSVLineRespectQuotes(lines[0]).map(header => header.replace(/^\uFEFF/, '').trim());
    const rows = lines.slice(1).filter(line => line.trim()).map(line => {
        const values = parseCSVLineRespectQuotes(line);
        const row = {};
        headers.forEach((header, index) => {
            row[header] = values[index]?.trim() || '';
        });
        return row;
    });
    return { headers, rows };
}

function parseCSVWithHeadersMultiline(csvText) {
    const lines = csvText.split('\n').filter(line => line.trim());
    if (lines.length < 2) return { headers: [], rows: [] };
    const headers = parseCSVLineRespectQuotes(lines[0]).map(header => header.replace(/^\uFEFF/, '').trim());
    const rows = [];
    let buffer = '';
    for (let i = 1; i < lines.length; i += 1) {
        buffer = buffer ? `${buffer}\n${lines[i]}` : lines[i];
        const values = parseCSVLineRespectQuotes(buffer);
        if (values.length < headers.length) {
            continue;
        }
        const row = {};
        headers.forEach((header, index) => {
            row[header] = values[index]?.trim() || '';
        });
        rows.push(row);
        buffer = '';
    }
    if (buffer) {
        const values = parseCSVLineRespectQuotes(buffer);
        if (values.length >= headers.length) {
            const row = {};
            headers.forEach((header, index) => {
                row[header] = values[index]?.trim() || '';
            });
            rows.push(row);
        }
    }
    return { headers, rows };
}

/**
 * Load ALL Availability Data in Parallel (optimized)
 */
async function loadAllAvailabilityData() {
    if (availabilityData.allLoaded) {
        console.log('🛡️ Availability data already loaded, using cache');
        return;
    }
    
    console.log('🛡️ Loading all availability data files...');
    const startTime = performance.now();
    
    try {
        // Load all 6 CSV files in parallel - URL encode filenames to handle spaces
        const basePath = 'assets/data/availability/';
        const encodedBasePath = basePath.split('/').map(part => encodeURIComponent(part)).join('/');
        const files = [
            'Csv Tables - summary_metrics.csv',
            'Csv Tables - monthly_trend.csv',
            'Csv Tables - services.csv',
            'Csv Tables - themes.csv',
            'Csv Tables - sla_data.csv',
            'incidents_e360_total.csv',
            'hrp_service_readiness_score_data.csv',
            'Ingress incidents - False Positive Analysis - slack.csv',
            'ingress_alert_distribution.csv',
            'ingress_alert_accuracy_trend.csv',
            'customer_test_scenario_view.csv',
            'integration_test_view.csv',
            'scale_perf_test_view.csv',
            'chaos_tests_view.csv',
            'integration_tests_fit.csv',
            'ingress_incident_analysis.csv'
        ];
        
        const encodedPaths = files.map(file => {
            const fullPath = basePath + file;
            return fullPath.split('/').map(part => encodeURIComponent(part)).join('/');
        });
        
        const responses = await Promise.all(
            encodedPaths.map(path => fetch(path))
        );
        
        // Check all responses
        responses.forEach((response, index) => {
            if (!response.ok) {
                throw new Error(`Failed to fetch ${files[index]}: ${response.status} ${response.statusText}`);
            }
        });
        
        // Parse all CSV files
        const csvTexts = await Promise.all(
            responses.map(response => response.text())
        );
        
        // Parse each CSV
        availabilityData.summaryMetrics = parseCSV(csvTexts[0], true);
        availabilityData.monthlyTrend = parseCSV(csvTexts[1], true);
        availabilityData.services = parseCSV(csvTexts[2], true);
        availabilityData.themes = parseCSV(csvTexts[3], true);
        availabilityData.slaData = parseCSV(csvTexts[4], true);
        availabilityData.incidents = parseCSV(csvTexts[5], true);
        availabilityData.serviceReadiness = parseCSV(csvTexts[6], true);
        
        availabilityData.ingressAlerts = parseCSVWithHeadersRobust(csvTexts[7]);
        availabilityData.ingressDistribution = parseCSVWithHeadersRobust(csvTexts[8]);
        availabilityData.ingressAccuracy = parseCSVWithHeadersRobust(csvTexts[9]);
        
        availabilityData.testInventory.customerScenario = parseCSVWithHeadersRobust(csvTexts[10]);
        availabilityData.testInventory.integration = parseCSVWithHeadersRobust(csvTexts[11]);
        availabilityData.testInventory.scalePerf = parseCSVWithHeadersRobust(csvTexts[12]);
        availabilityData.testInventory.chaos = parseCSVWithHeadersMultiline(csvTexts[13]);
        availabilityData.fitData = normalizeCsvHeaders(parseCSVWithHeadersRobust(csvTexts[14]));
        availabilityData.ingressIncidentAnalysis = parseCSVWithHeadersRobust(csvTexts[15]);

        const fitOverrides = {
            'anypoint-operator': 'Managed Mesh',
            'kaaskeywatcher': 'Falcon Kubernetes Service',
            'ingressassistant': 'Ingress Gateway',
            'ingressconfig': 'Ingress Gateway',
            'ingressgateway': 'Ingress Gateway',
            'workload-identity': 'Workload Identity',
            'strauz': 'Workload Identity',
            'policy-distribution': 'Workload Identity'
        };
        const normalizedMap = {};
        try {
            const mapResponse = await fetch(encodedBasePath + 'fit_service_product_map.json');
            if (mapResponse.ok) {
                const mapJson = await mapResponse.json();
                Object.entries(mapJson || {}).forEach(([service, product]) => {
                    const key = (service || '').toLowerCase();
                    if (!key) return;
                    normalizedMap[key] = product;
                });
            }
        } catch (e) {
            console.warn('⚠️ Could not load fit_service_product_map.json');
        }
        Object.entries(fitOverrides).forEach(([service, product]) => {
            const key = (service || '').toLowerCase();
            if (!key) return;
            normalizedMap[key] = product;
        });
        const finalizedMap = {};
        Object.entries(normalizedMap).forEach(([service, product]) => {
            if (!service) return;
            if (product === 'FKP') finalizedMap[service] = 'Falcon Kubernetes Service';
            else if (product === 'Mesh') finalizedMap[service] = 'Managed Mesh';
            else if (product === 'STRIDE') finalizedMap[service] = 'Workload Identity';
            else if (product === 'WIS') finalizedMap[service] = 'Workload Identity';
            else finalizedMap[service] = product;
        });
        availabilityData.fitServiceProductMap = finalizedMap;

        try {
            const mapResponse = await fetch(encodedBasePath + 'hrp_product_prb_owner_map.json');
            if (mapResponse.ok) {
                availabilityData.hrpProductPrbOwnerMap = await mapResponse.json();
            }
        } catch (e) {
            console.warn('⚠️ Could not load hrp_product_prb_owner_map.json');
        }
        
        availabilityData.loaded = true;
        
        const elapsed = (performance.now() - startTime).toFixed(0);
        console.log(`✅ All availability data loaded in ${elapsed}ms`);
        console.log(`   - Summary Metrics: ${availabilityData.summaryMetrics.length} metrics`);
        console.log(`   - Monthly Trend: ${availabilityData.monthlyTrend.length} months`);
        console.log(`   - Services: ${availabilityData.services.length} services`);
        console.log(`   - Themes: ${availabilityData.themes.length} themes`);
        console.log(`   - SLA Data: ${availabilityData.slaData.length} services`);
        console.log(`   - Incidents: ${availabilityData.incidents.length} incidents`);
        console.log(`   - Service Readiness: ${availabilityData.serviceReadiness.length} rows`);
        console.log(`   - Ingress Alerts: ${availabilityData.ingressAlerts.rows.length} rows`);
        console.log(`   - Ingress Distribution: ${availabilityData.ingressDistribution.rows.length} rows`);
        console.log(`   - Ingress Accuracy: ${availabilityData.ingressAccuracy.rows.length} rows`);
        console.log(`   - Test Inventory (Customer): ${availabilityData.testInventory.customerScenario.rows.length} rows`);
        console.log(`   - Test Inventory (Integration): ${availabilityData.testInventory.integration.rows.length} rows`);
        console.log(`   - Test Inventory (Scale/Perf): ${availabilityData.testInventory.scalePerf.rows.length} rows`);
        console.log(`   - Test Inventory (Chaos): ${availabilityData.testInventory.chaos.rows.length} rows`);
        console.log(`   - FIT Data: ${availabilityData.fitData.rows.length} rows`);
        
    } catch (error) {
        console.error('❌ Error loading availability data:', error);
        console.error('❌ Error details:', error.message, error.stack);
        availabilityData.summaryMetrics = [];
        availabilityData.monthlyTrend = [];
        availabilityData.services = [];
        availabilityData.themes = [];
        availabilityData.slaData = [];
        availabilityData.serviceReadiness = [];
        availabilityData.ingressAlerts = { headers: [], rows: [] };
        availabilityData.ingressDistribution = { headers: [], rows: [] };
        availabilityData.ingressAccuracy = { headers: [], rows: [] };
        availabilityData.testInventory = {
            customerScenario: { headers: [], rows: [] },
            integration: { headers: [], rows: [] },
            scalePerf: { headers: [], rows: [] },
            chaos: { headers: [], rows: [] }
        };
        availabilityData.fitData = { headers: [], rows: [] };
        availabilityData.fitServiceProductMap = {};
        availabilityData.integrationFitSummary = {};
        availabilityData.loaded = true;
    }
}

/**
 * Legacy function for backward compatibility
 */
async function loadAvailabilityData() {
    await loadAllAvailabilityData();
    return availabilityData.executiveSummary;
}

/**
 * Get metric icon based on metric name
 */
function getAvailabilityMetricIcon(metricName) {
    if (metricName.includes('Sev0') || metricName.includes('Sev1')) {
        return '⚠️';
    }
    if (metricName.includes('MTTD') || metricName.includes('MTTR')) {
        return '⏱️';
    }
    if (metricName.includes('Detection')) {
        return '📡';
    }
    if (metricName.includes('Prevention') || metricName.includes('Coverage')) {
        return '🛡️';
    }
    return '📊';
}

/**
 * Get card class based on metric status and trend
 */
function getAvailabilityCardClass(metric) {
    const metricName = metric.metric_name || '';
    const trendDirection = metric.trend_direction || '';
    const status = metric.status || '';
    
    // For incident trends, "up" is bad (more incidents)
    if (metricName.includes('Sev0') || metricName.includes('Sev1')) {
        if (trendDirection === 'up') return 'trend-up-bad';
        if (trendDirection === 'down') return 'trend-down-good';
    }
    
    // For MTTD/MTTR, "down" is good (faster detection/resolution)
    if (metricName.includes('MTTD') || metricName.includes('MTTR')) {
        if (trendDirection === 'down') return 'trend-down-good';
        if (trendDirection === 'up') return 'trend-up-bad';
    }
    
    // Based on status
    if (status === 'WARNING') return 'warning';
    if (status === 'OK') return 'ok';
    
    return '';
}

/**
 * Get trend class for the trend indicator
 */
function getAvailabilityTrendClass(metric) {
    const metricName = metric.metric_name || '';
    const trendDirection = metric.trend_direction || '';
    
    // For incidents, up is bad, down is good
    if (metricName.includes('Sev0') || metricName.includes('Sev1')) {
        if (trendDirection === 'up') return 'negative';
        if (trendDirection === 'down') return 'positive';
    }
    
    // For MTTD/MTTR, down is good
    if (metricName.includes('MTTD') || metricName.includes('MTTR')) {
        if (trendDirection === 'down') return 'positive';
        if (trendDirection === 'up') return 'negative';
    }
    
    // For detection %, check status
    if (metric.status === 'WARNING') return 'warning';
    
    return 'neutral';
}

/**
 * Format the metric value with units
 */
function formatAvailabilityMetricValue(metric) {
    const value = metric.metric_value || '';
    const unit = metric.metric_unit || '';
    
    if (unit === 'min') {
        return `${value}<span class="unit">min</span>`;
    }
    if (unit === '%') {
        return `${value}<span class="unit">%</span>`;
    }
    return value;
}

/**
 * Legacy renderAvailabilityExecView - REMOVED
 * This function has been replaced by the new renderAvailabilityExecView(container) function
 * that uses all 5 CSV files and renders the comprehensive scrollable Exec View.
 */

/**
 * Export availability summary (placeholder for future)
 */
function exportAvailabilitySummary() {
    console.log('📄 Exporting Availability Summary...');
    showMessage('Single Page Summary export coming soon!', 'info');
}

/**
 * Get monthly incident data from cache (no fetch needed)
 */
function getMonthlyIncidentData() {
    // Legacy function - returns empty array as we now use single CSV
    return [];
}

/**
 * Get investment themes from cache (no fetch needed)
 */
function getInvestmentThemes() {
    // Legacy function - returns empty array as we now use single CSV
    return [];
}

/**
 * Get service incident metrics from cache (no fetch needed)
 */
function getServiceIncidentMetrics() {
    // Legacy function - returns empty array as we now use single CSV
    return [];
}

/**
 * Render Incident Trend Chart (SVG Line Chart)
 */
function renderIncidentTrendChart() {
    console.log('📈 Rendering Incident Trend Chart...');
    
    const container = document.getElementById('incident-trend-chart');
    if (!container) return;
    
    const monthlyData = getMonthlyIncidentData();
    if (!monthlyData.length) {
        container.innerHTML = '<div class="placeholder-message"><p>No incident data available</p></div>';
        return;
    }
    
    // Group by month
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthlyStats = {};
    
    monthlyData.forEach(row => {
        const yearMonth = row.year_month || '';
        const monthNum = parseInt(yearMonth.split('-')[1]) - 1;
        const monthName = months[monthNum] || yearMonth;
        
        if (!monthlyStats[monthName]) {
            monthlyStats[monthName] = { sev0: 0, sev1: 0 };
        }
        
        const count = parseInt(row.incident_count) || 0;
        if (row.severity === 'Sev0') {
            monthlyStats[monthName].sev0 += count;
        } else if (row.severity === 'Sev1') {
            monthlyStats[monthName].sev1 += count;
        }
    });
    
    // Find max for scaling
    let maxCount = 0;
    months.forEach(month => {
        if (monthlyStats[month]) {
            maxCount = Math.max(maxCount, monthlyStats[month].sev0, monthlyStats[month].sev1);
        }
    });
    maxCount = Math.max(maxCount, 6); // Minimum scale of 6
    
    // Chart dimensions - use wider viewBox for proper proportions
    const chartWidth = 600;
    const chartHeight = 120;
    const paddingLeft = 5;
    const paddingRight = 5;
    const paddingTop = 10;
    const paddingBottom = 10;
    
    const plotWidth = chartWidth - paddingLeft - paddingRight;
    const plotHeight = chartHeight - paddingTop - paddingBottom;
    
    // Calculate points for each line
    const sev0Points = [];
    const sev1Points = [];
    
    months.forEach((month, index) => {
        const stats = monthlyStats[month] || { sev0: 0, sev1: 0 };
        const x = paddingLeft + (index / (months.length - 1)) * plotWidth;
        const y0 = paddingTop + plotHeight - ((stats.sev0 / maxCount) * plotHeight);
        const y1 = paddingTop + plotHeight - ((stats.sev1 / maxCount) * plotHeight);
        
        sev0Points.push({ x, y: y0, value: stats.sev0, month });
        sev1Points.push({ x, y: y1, value: stats.sev1, month });
    });
    
    // Create simple straight-line path (polyline style)
    function createLinePath(points) {
        if (points.length < 2) return '';
        return 'M ' + points.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' L ');
    }
    
    // Build paths
    const sev0Path = createLinePath(sev0Points);
    const sev1Path = createLinePath(sev1Points);
    
    // X-axis labels
    let xLabels = months.map((month, i) => 
        `<span class="chart-x-label">${month}</span>`
    ).join('');
    
    // Y-axis grid lines
    const ySteps = [0, Math.ceil(maxCount / 3), Math.ceil(maxCount * 2 / 3), maxCount];
    let gridLines = '';
    ySteps.forEach((val, i) => {
        const yPos = paddingTop + plotHeight - ((val / maxCount) * plotHeight);
        gridLines += `<line x1="${paddingLeft}" y1="${yPos}" x2="${chartWidth - paddingRight}" y2="${yPos}" stroke="#e5e7eb" stroke-width="1" />`;
    });
    
    // Y-axis labels
    let yLabels = ySteps.slice().reverse().map(val => 
        `<span class="chart-y-label">${val}</span>`
    ).join('');
    
    const chartHtml = `
        <div class="line-chart-container">
            <div class="chart-y-axis">${yLabels}</div>
            <svg class="line-chart-svg" viewBox="0 0 ${chartWidth} ${chartHeight}" preserveAspectRatio="xMidYMid meet">
                <!-- Grid lines -->
                ${gridLines}
                
                <!-- Lines - Sev1 (orange) behind, Sev0 (red) in front -->
                <path d="${sev1Path}" fill="none" stroke="#f59e0b" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
                <path d="${sev0Path}" fill="none" stroke="#ef4444" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
            <div class="chart-x-axis">${xLabels}</div>
        </div>
    `;
    
    container.innerHTML = chartHtml;
    
    console.log('✅ Incident Trend Line Chart rendered');
}

/**
 * Render Investment Themes
 */
function renderInvestmentThemes() {
    console.log('💡 Rendering Investment Themes...');
    
    const container = document.getElementById('investment-themes-list');
    if (!container) return;
    
    const themes = getInvestmentThemes();
    if (!themes.length) {
        container.innerHTML = '<div class="placeholder-message"><p>No investment themes available</p></div>';
        return;
    }
    
    // Sort by priority/theme_id and take top 3
    const topThemes = themes.slice(0, 3);
    
    let html = '';
    topThemes.forEach((theme, index) => {
        const priorityClass = theme.theme_priority === 'CRITICAL' ? 'priority-critical' :
                              theme.theme_priority === 'WARNING' ? 'priority-warning' : 'priority-info';
        
        html += `
            <div class="investment-theme-card ${priorityClass}">
                <div class="theme-content">
                    <h4 class="theme-title">${index + 1}. ${theme.theme_title}</h4>
                    <p class="theme-description">${theme.description}</p>
                    <p class="theme-action">${theme.recommended_action}</p>
                </div>
                <span class="theme-percentage">${theme.incident_percentage}% of incidents</span>
            </div>
        `;
    });
    
    container.innerHTML = html;
    console.log('✅ Investment Themes rendered');
}

/**
 * Render Availability Baseline (Developer View)
 */
async function renderAvailabilityBaseline() {
    console.log('🛡️ Rendering Availability Baseline...');
    
    // Ensure all data is loaded
    await loadAllAvailabilityData();
    
    const serviceMetrics = getServiceIncidentMetrics();
    if (!serviceMetrics.length) {
        console.warn('⚠️ No service metrics data available');
        return;
    }
    
    // Render MTTD chart
    renderServiceBarChart('mttd-service-chart', serviceMetrics, 'avg_ttd_minutes', 10, 'MTTD');
    
    // Render MTTR chart
    renderServiceBarChart('mttr-service-chart', serviceMetrics, 'avg_ttr_minutes', 60, 'MTTR');
    
    console.log('✅ Availability Baseline rendered');
}

/**
 * Render a service bar chart (MTTD or MTTR)
 */
function renderServiceBarChart(containerId, services, valueField, slaTarget, metricType) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    // Sort services by value (highest first) and take top 10
    const sortedServices = [...services]
        .filter(svc => parseFloat(svc[valueField]) > 0)
        .sort((a, b) => parseFloat(b[valueField]) - parseFloat(a[valueField]))
        .slice(0, 10);
    
    if (sortedServices.length === 0) {
        container.innerHTML = '<div class="placeholder-message" style="padding: 1rem; color: #64748b;">No data available</div>';
        return;
    }
    
    // Find max value for scaling
    let maxValue = 0;
    sortedServices.forEach(svc => {
        const val = parseFloat(svc[valueField]) || 0;
        maxValue = Math.max(maxValue, val);
    });
    maxValue = Math.max(maxValue, slaTarget * 1.5); // Ensure bar scaling looks good
    
    // Build legend
    const legendHtml = `
        <div class="chart-legend-inline">
            <span class="legend-inline-item">
                <span class="legend-inline-dot good"></span>
                Within SLA (&lt;${Math.round(slaTarget * 0.7)} min)
            </span>
            <span class="legend-inline-item">
                <span class="legend-inline-dot warning"></span>
                Near SLA (${Math.round(slaTarget * 0.7)}-${slaTarget} min)
            </span>
            <span class="legend-inline-item">
                <span class="legend-inline-dot bad"></span>
                Above SLA (&gt;${slaTarget} min)
            </span>
        </div>
    `;
    
    let barsHtml = '';
    
    sortedServices.forEach(svc => {
        const value = parseFloat(svc[valueField]) || 0;
        const percentage = Math.max((value / maxValue) * 100, 2); // Minimum 2% width for visibility
        
        // Determine status based on SLA
        let status = 'good';
        let statusClass = 'status-good';
        if (value > slaTarget) {
            status = 'bad';
            statusClass = 'status-bad';
        } else if (value > slaTarget * 0.7) {
            status = 'warning';
            statusClass = 'status-warning';
        }
        
        // Format service name (truncate if too long)
        const serviceName = svc.service_name?.length > 12 
            ? svc.service_name.substring(0, 12) + '...' 
            : svc.service_name || 'Unknown';
        
        barsHtml += `
            <div class="service-bar-row">
                <span class="service-bar-label" title="${svc.service_name}">${serviceName}</span>
                <div class="service-bar-track">
                    <div class="service-bar-fill ${statusClass}" style="width: ${percentage}%;"></div>
                </div>
                <span class="service-bar-value">
                    <span class="value-text">${Math.round(value)} min</span>
                    <span class="status-icon ${status}"></span>
                </span>
            </div>
        `;
    });
    
    // SLA target info
    const slaInfoHtml = `
        <div class="sla-target-info">
            SLA Target: ${slaTarget} min
        </div>
    `;
    
    container.innerHTML = `
        ${legendHtml}
        <div class="service-bars-chart">
            ${barsHtml}
        </div>
        ${slaInfoHtml}
    `;
}

// ============================================
// PROJECTIONS & ROADMAP SECTION
// ============================================

/**
 * Render Projections & Roadmap tab
 */
async function renderProjectionsRoadmap() {
    console.log('📈 Rendering Projections & Roadmap');
    
    const container = document.getElementById('projections-roadmap-content');
    if (!container) return;
    
    // Show loading state
    container.innerHTML = `
        <div class="placeholder-message">
            <div class="placeholder-icon">📈</div>
            <h3>Loading Projections...</h3>
            <p>Analyzing adoption projections and roadmap data</p>
        </div>
    `;
    
    try {
        // Load roadmap data if not already loaded
        if (!projectionsData.loaded) {
            await loadProjectionsData();
        }
        
        // Render the dashboard
        renderProjectionsDashboard(container);
        
    } catch (error) {
        console.error('❌ Error loading projections:', error);
        container.innerHTML = `
            <div class="error-message" style="padding: 2rem; text-align: center;">
                <h3>Error Loading Projections</h3>
                <p>${error.message}</p>
            </div>
        `;
    }
}

/**
 * Load projections data from CSV files
 */
async function loadProjectionsData() {
    console.log('📈 Loading projections data...');
    
    const QUARTERS = ['FY26Q3', 'FY26Q4', 'FY27Q1', 'FY27Q2', 'FY27Q3', 'FY27Q4'];
    const PROJECTED_QUARTERS = ['FY27Q1', 'FY27Q2', 'FY27Q3', 'FY27Q4'];
    
    // Load roadmap CSV
    const roadmapResponse = await fetch('assets/data/services_with_self_managed_prod.csv');
    const roadmapText = await roadmapResponse.text();
    const roadmapData = parseCSVWithQuotes(roadmapText);
    
    projectionsData.roadmap = roadmapData;
    console.log(`✅ Loaded ${roadmapData.length} roadmap entries`);
    
    // Check if main dashboard data is loaded
    if (!fkpDashboard.data.processed || !fkpDashboard.data.processed.services || fkpDashboard.data.processed.services.size === 0) {
        throw new Error('Dashboard data not loaded yet. Please navigate to Overview tab first to load data.');
    }
    
    // Calculate metrics from processed data (use existing dashboard data)
    const currentMetrics = calculateProjectionMetricsFromDashboard();
    const prevMetrics = calculatePrevQuarterMetrics();
    
    projectionsData.currentMetrics = currentMetrics;
    projectionsData.prevMetrics = prevMetrics;
    
    // Calculate projections
    const projections = calculateQuarterlyProjections(currentMetrics, roadmapData, QUARTERS, PROJECTED_QUARTERS);
    projectionsData.projections = projections;
    
    // Find services needing completion (enabled but with gaps)
    const currentServices = buildServiceMapFromDashboard();
    projectionsData.servicesNeedingCompletion = findServicesNeedingCompletion(currentServices, roadmapData);
    projectionsData.servicesNeedingGovcloud = findServicesNeedingGovcloud(currentServices, roadmapData);
    projectionsData.servicesWithoutETAs = findServicesWithoutETAs(currentServices, roadmapData);
    
    projectionsData.loaded = true;
    console.log('✅ Projections data loaded successfully');
}

/**
 * Calculate projection metrics from existing dashboard data
 * Uses instance-level data like the Overview tab does
 */
function calculateProjectionMetricsFromDashboard() {
    const metrics = {
        Commercial: { total: 0, fkp: 0, selfManaged: 0 },
        GIA: { total: 0, fkp: 0, selfManaged: 0 },
        BlackJack: { total: 0, fkp: 0, selfManaged: 0 }
    };
    
    // Iterate through all services and their instances (same as calculateAdoptionByCustomerType)
    const allServices = Array.from(fkpDashboard.data.processed.services.values());
    
    allServices.forEach(service => {
        service.instances.forEach(inst => {
            // Only count Prod instances (matching Overview tab logic)
            if (!inst.isProd) return;
            
            const customerType = inst.customerType; // 'Commercial', 'GIA', or 'BlackJack'
            if (!metrics[customerType]) return;
            
            metrics[customerType].total++;
            if (inst.isFKP) {
                metrics[customerType].fkp++;
            } else {
                metrics[customerType].selfManaged++;
            }
        });
    });
    
    console.log('📊 Current metrics from dashboard:', metrics);
    return metrics;
}

/**
 * Calculate previous quarter metrics
 * Uses raw instance data from previous quarter files
 */
function calculatePrevQuarterMetrics() {
    const metrics = {
        Commercial: { total: 0, fkp: 0, selfManaged: 0 },
        GIA: { total: 0, fkp: 0, selfManaged: 0 },
        BlackJack: { total: 0, fkp: 0, selfManaged: 0 }
    };
    
    // Use previous quarter data if available
    const prevQInstances = fkpDashboard.data.instancesPrevQ || [];
    const prevQBlackjack = fkpDashboard.data.blackjackInstancesPrevQ || [];
    
    // Get service mappings for filtering unmapped services
    const mappingSet = new Set();
    fkpDashboard.data.mappings.forEach(mapping => {
        if (mapping.mr_servicename) {
            mappingSet.add(mapping.mr_servicename);
        }
    });
    
    // Process previous quarter FKP instances
    prevQInstances.forEach(instance => {
        const fi = instance.fi || '';
        const cluster = instance.k8s_cluster || '';
        const serviceName = instance.label_p_servicename || '';
        
        if (!serviceName || serviceName === 'unknown') return;
        if (INTEGRATION_SERVICES.includes(serviceName)) return;
        
        // Match main dashboard logic - only mapped services
        if (!mappingSet.has(serviceName) && !INTEGRATION_SERVICES.includes(serviceName)) return;
        
        // Check if prod (match main dashboard: stage|prod|esvc)
        const isProd = /stage|prod|esvc/i.test(fi);
        if (!isProd) return;
        
        // Determine customer type
        let customerType = 'Commercial';
        if (/gia/i.test(fi)) {
            customerType = 'GIA';
        }
        
        // Check if FKP (cluster contains "sam")
        const isFKP = /sam/i.test(cluster);
        
        metrics[customerType].total++;
        if (isFKP) {
            metrics[customerType].fkp++;
        } else {
            metrics[customerType].selfManaged++;
        }
    });
    
    // Process BlackJack previous quarter
    prevQBlackjack.forEach(instance => {
        const fi = instance.fi || instance.Env || '';
        const cluster = instance.k8s_cluster || instance['EKS Cluster Name'] || '';
        const serviceName = instance.label_p_servicename || instance.ServiceName || '';
        
        if (!serviceName || serviceName === 'unknown') return;
        if (INTEGRATION_SERVICES.includes(serviceName)) return;
        
        // Match main dashboard logic - only mapped services
        if (!mappingSet.has(serviceName) && !INTEGRATION_SERVICES.includes(serviceName)) return;
        
        // Check if prod
        const isProd = /stage|prod|esvc/i.test(fi);
        if (!isProd) return;
        
        // Check if FKP
        const isFKP = /sam/i.test(cluster);
        
        metrics.BlackJack.total++;
        if (isFKP) {
            metrics.BlackJack.fkp++;
        } else {
            metrics.BlackJack.selfManaged++;
        }
    });
    
    console.log('📊 Previous quarter metrics:', metrics);
    return metrics;
}

/**
 * Build service map from existing dashboard data
 * Uses instance-level data for accurate counts
 */
function buildServiceMapFromDashboard() {
    const services = new Map();
    
    fkpDashboard.data.processed.services.forEach((service, name) => {
        const serviceData = {
            name: name,
            Commercial: { total: 0, fkp: 0, selfManaged: 0 },
            GIA: { total: 0, fkp: 0, selfManaged: 0 },
            BlackJack: { total: 0, fkp: 0, selfManaged: 0 }
        };
        
        // Count instances by customer type (Prod only)
        service.instances.forEach(inst => {
            if (!inst.isProd) return;
            
            const customerType = inst.customerType;
            if (!serviceData[customerType]) return;
            
            serviceData[customerType].total++;
            if (inst.isFKP) {
                serviceData[customerType].fkp++;
            } else {
                serviceData[customerType].selfManaged++;
            }
        });
        
        services.set(name, serviceData);
    });
    
    return services;
}

/**
 * Parse CSV with proper quote handling
 */
function parseCSVWithQuotes(text) {
    const normalizedText = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const rows = [];
    let currentRow = [];
    let currentField = '';
    let inQuotes = false;
    
    for (let i = 0; i < normalizedText.length; i++) {
        const char = normalizedText[i];
        
        if (char === '"') {
            if (inQuotes && normalizedText[i + 1] === '"') {
                currentField += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (char === ',' && !inQuotes) {
            currentRow.push(currentField.trim());
            currentField = '';
        } else if (char === '\n' && !inQuotes) {
            currentRow.push(currentField.trim());
            if (currentRow.some(f => f !== '')) {
                rows.push(currentRow);
            }
            currentRow = [];
            currentField = '';
        } else {
            currentField += char;
        }
    }
    
    if (currentField || currentRow.length > 0) {
        currentRow.push(currentField.trim());
        if (currentRow.some(f => f !== '')) {
            rows.push(currentRow);
        }
    }
    
    if (rows.length < 2) return [];
    
    const headers = rows[0].map(h => h.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim());
    
    const data = [];
    for (let i = 1; i < rows.length; i++) {
        const row = {};
        headers.forEach((h, idx) => {
            row[h] = rows[i][idx] || '';
        });
        data.push(row);
    }
    
    return data;
}

/**
 * Calculate quarterly projections
 */
function calculateQuarterlyProjections(currentMetrics, roadmapData, QUARTERS, PROJECTED_QUARTERS) {
    const projections = {};
    
    ['Commercial', 'GIA', 'BlackJack'].forEach(env => {
        projections[env] = {
            FY26Q4: {
                fkp: currentMetrics[env].fkp,
                total: currentMetrics[env].total,
                adoption: currentMetrics[env].total > 0 ? 
                    (currentMetrics[env].fkp / currentMetrics[env].total * 100) : 0
            }
        };
    });
    
    const additions = {};
    const decommissions = {};
    
    ['Commercial', 'GIA', 'BlackJack'].forEach(env => {
        additions[env] = { FY26Q4: 0, FY27Q1: 0, FY27Q2: 0, FY27Q3: 0, FY27Q4: 0 };
        decommissions[env] = { FY26Q4: 0, FY27Q1: 0, FY27Q2: 0, FY27Q3: 0, FY27Q4: 0 };
    });
    
    const envColumns = {
        Commercial: 'Commercial ETA',
        GIA: 'Gia2h ETA',
        BlackJack: 'BlackJack ETA'
    };
    
    // Build service map for self-managed counts
    const serviceMap = buildServiceMapFromDashboard();
    
    roadmapData.forEach(row => {
        const serviceName = row['Service Name'];
        if (!serviceName) return;
        if (INTEGRATION_SERVICES.includes(serviceName)) return;
        
        ['Commercial', 'GIA', 'BlackJack'].forEach(env => {
            const etaCol = envColumns[env];
            const eta = row[etaCol];
            const decomETA = row['Decommission ETA'];
            
            const service = serviceMap.get(serviceName);
            const selfManagedCount = service ? service[env].selfManaged : 0;
            
            if (selfManagedCount === 0) return;
            
            let parsedETA = parseProjectionETA(eta);
            let parsedDecomETA = parseProjectionETA(decomETA);
            
            if (parsedETA === 'CLEANUP') {
                parsedDecomETA = 'FY27Q2';
                parsedETA = null;
            }
            
            if (parsedETA && PROJECTED_QUARTERS.includes(parsedETA)) {
                additions[env][parsedETA] += selfManagedCount;
            }
            
            if (parsedDecomETA && PROJECTED_QUARTERS.includes(parsedDecomETA)) {
                decommissions[env][parsedDecomETA] += selfManagedCount;
            } else if (parsedETA === 'DECOM' && parsedDecomETA && PROJECTED_QUARTERS.includes(parsedDecomETA)) {
                decommissions[env][parsedDecomETA] += selfManagedCount;
            }
        });
    });
    
    // Calculate cumulative projections
    ['Commercial', 'GIA', 'BlackJack'].forEach(env => {
        let cumulativeFKP = currentMetrics[env].fkp;
        let cumulativeTotal = currentMetrics[env].total;
        
        PROJECTED_QUARTERS.forEach(q => {
            cumulativeFKP += additions[env][q];
            cumulativeTotal -= decommissions[env][q];
            
            if (cumulativeTotal < 0) cumulativeTotal = 0;
            if (cumulativeFKP > cumulativeTotal) cumulativeFKP = cumulativeTotal;
            
            projections[env][q] = {
                fkp: cumulativeFKP,
                total: cumulativeTotal,
                adoption: cumulativeTotal > 0 ? (cumulativeFKP / cumulativeTotal * 100) : 100
            };
        });
    });
    
    return projections;
}

/**
 * Parse ETA value for projections
 */
function parseProjectionETA(eta) {
    if (!eta) return null;
    const etaUpper = eta.toUpperCase().trim();
    
    if (etaUpper === 'N/A' || etaUpper === 'NEED MORE INFO' || etaUpper === 'NOT STARTED') {
        return null;
    }
    
    if (etaUpper === 'TO BE DECOMMISSIONED') {
        return 'DECOM';
    }
    
    if (etaUpper.includes('COMPLETED WITH CLEAN-UP REQUIRED')) {
        return 'CLEANUP';
    }
    
    const match = etaUpper.match(/FY\d{2}Q[1-4]/);
    if (match) {
        return match[0];
    }
    
    return null;
}

/**
 * Find services that are enabled but need to complete adoption
 */
function findServicesNeedingCompletion(currentServices, roadmapData) {
    const results = [];
    
    const roadmapMap = new Map();
    roadmapData.forEach(row => {
        roadmapMap.set(row['Service Name'], row);
    });
    
    currentServices.forEach((service, serviceName) => {
        const totalFKP = service.Commercial.fkp + service.GIA.fkp + service.BlackJack.fkp;
        if (totalFKP === 0) return;
        
        const envsWithGaps = [];
        let totalGapInstances = 0;
        
        ['Commercial', 'GIA', 'BlackJack'].forEach(env => {
            if (service[env].selfManaged > 0) {
                envsWithGaps.push(env);
                totalGapInstances += service[env].selfManaged;
            }
        });
        
        if (envsWithGaps.length === 0) return;
        
        const roadmapRow = roadmapMap.get(serviceName);
        
        results.push({
            serviceName,
            orgLeader: roadmapRow?.['Org Leader'] || 'Unknown',
            cloud: roadmapRow?.['Cloud'] || 'Unknown',
            team: roadmapRow?.['Team Name'] || 'Unknown',
            envsWithGaps,
            totalGapInstances
        });
    });
    
    results.sort((a, b) => b.totalGapInstances - a.totalGapInstances);
    return results;
}

/**
 * Find services enabled in Commercial but need GovCloud adoption
 */
function findServicesNeedingGovcloud(currentServices, roadmapData) {
    const results = [];
    
    const roadmapMap = new Map();
    roadmapData.forEach(row => {
        roadmapMap.set(row['Service Name'], row);
    });
    
    currentServices.forEach((service, serviceName) => {
        if (service.Commercial.fkp === 0) return;
        
        const envsWithGaps = [];
        let totalGapInstances = 0;
        
        ['GIA', 'BlackJack'].forEach(env => {
            if (service[env].selfManaged > 0) {
                envsWithGaps.push(env);
                totalGapInstances += service[env].selfManaged;
            }
        });
        
        if (envsWithGaps.length === 0) return;
        
        const roadmapRow = roadmapMap.get(serviceName);
        
        results.push({
            serviceName,
            orgLeader: roadmapRow?.['Org Leader'] || 'Unknown',
            cloud: roadmapRow?.['Cloud'] || 'Unknown',
            team: roadmapRow?.['Team Name'] || 'Unknown',
            envsWithGaps,
            totalGapInstances
        });
    });
    
    results.sort((a, b) => b.totalGapInstances - a.totalGapInstances);
    return results;
}

/**
 * Find services without valid ETAs
 */
function findServicesWithoutETAs(currentServices, roadmapData) {
    const servicesWithoutETAs = [];
    
    const roadmapMap = new Map();
    roadmapData.forEach(row => {
        roadmapMap.set(row['Service Name'], row);
    });
    
    const envColumns = {
        Commercial: 'Commercial ETA',
        GIA: 'Gia2h ETA',
        BlackJack: 'BlackJack ETA'
    };
    
    currentServices.forEach((service, serviceName) => {
        const roadmapRow = roadmapMap.get(serviceName);
        
        const envsNeedingETA = [];
        let totalInstances = 0;
        
        ['Commercial', 'GIA', 'BlackJack'].forEach(env => {
            const selfManaged = service[env].selfManaged;
            if (selfManaged === 0) return;
            
            let hasValidETA = false;
            
            if (roadmapRow) {
                const etaCol = envColumns[env];
                const eta = roadmapRow[etaCol];
                const parsedETA = parseProjectionETA(eta);
                
                if (parsedETA !== null) {
                    hasValidETA = true;
                }
            }
            
            if (!hasValidETA) {
                envsNeedingETA.push(env);
                totalInstances += selfManaged;
            }
        });
        
        if (envsNeedingETA.length > 0) {
            servicesWithoutETAs.push({
                serviceName,
                orgLeader: roadmapRow?.['Org Leader'] || 'Unknown',
                parentCloud: roadmapRow?.['Parent Cloud'] || 'Unknown',
                cloud: roadmapRow?.['Cloud'] || 'Unknown',
                envsNeedingETA,
                totalInstances,
                inRoadmap: !!roadmapRow
            });
        }
    });
    
    servicesWithoutETAs.sort((a, b) => b.totalInstances - a.totalInstances);
    return servicesWithoutETAs;
}

/**
 * Render projections dashboard
 */
function renderProjectionsDashboard(container) {
    const QUARTERS = ['FY26Q3', 'FY26Q4', 'FY27Q1', 'FY27Q2', 'FY27Q3', 'FY27Q4'];
    const COLORS = {
        Commercial: '#0176d3',
        GIA: '#9050e9',
        BlackJack: '#ea001e'
    };
    
    const { currentMetrics, prevMetrics, projections, servicesNeedingCompletion, servicesNeedingGovcloud, servicesWithoutETAs } = projectionsData;
    
    // Build quarterly data for chart
    const quarterlyData = {
        Commercial: [],
        GIA: [],
        BlackJack: []
    };
    
    ['Commercial', 'GIA', 'BlackJack'].forEach(env => {
        const prevAdoption = prevMetrics && prevMetrics[env].total > 0 ? 
            (prevMetrics[env].fkp / prevMetrics[env].total * 100) : 0;
        quarterlyData[env].push({ quarter: 'FY26Q3', adoption: prevAdoption, isActual: true });
        
        QUARTERS.slice(1).forEach(q => {
            if (projections[env] && projections[env][q]) {
                quarterlyData[env].push({
                    quarter: q,
                    adoption: projections[env][q].adoption,
                    isActual: q === 'FY26Q4'
                });
            }
        });
    });
    
    // Aggregate ETA gaps by cloud
    const cloudAgg = {};
    servicesWithoutETAs.forEach(s => {
        const key = s.cloud;
        if (!cloudAgg[key]) {
            cloudAgg[key] = {
                orgLeader: s.orgLeader,
                parentCloud: s.parentCloud,
                cloud: s.cloud,
                envsSet: new Set(),
                totalInstances: 0
            };
        }
        s.envsNeedingETA.forEach(env => cloudAgg[key].envsSet.add(env));
        cloudAgg[key].totalInstances += s.totalInstances;
    });
    const cloudList = Object.values(cloudAgg).sort((a, b) => b.totalInstances - a.totalInstances);
    
    const totalCompletionInstances = servicesNeedingCompletion.reduce((sum, s) => sum + s.totalGapInstances, 0);
    const totalGovcloudInstances = servicesNeedingGovcloud.reduce((sum, s) => sum + s.totalGapInstances, 0);
    const totalETAInstances = servicesWithoutETAs.reduce((sum, s) => sum + s.totalInstances, 0);
    
    container.innerHTML = `
        <div class="projections-metrics-grid">
            <div class="projections-metric-card commercial">
                <h3>Commercial Adoption (FY26Q4)</h3>
                <div class="metric-value">${currentMetrics && currentMetrics.Commercial.total > 0 ? 
                    (currentMetrics.Commercial.fkp / currentMetrics.Commercial.total * 100).toFixed(1) : 0}%</div>
                <div class="metric-subtitle">${(currentMetrics?.Commercial.fkp || 0).toLocaleString()} / ${(currentMetrics?.Commercial.total || 0).toLocaleString()} instances</div>
            </div>
            <div class="projections-metric-card gia">
                <h3>GIA Adoption (FY26Q4)</h3>
                <div class="metric-value">${currentMetrics && currentMetrics.GIA.total > 0 ? 
                    (currentMetrics.GIA.fkp / currentMetrics.GIA.total * 100).toFixed(1) : 0}%</div>
                <div class="metric-subtitle">${(currentMetrics?.GIA.fkp || 0).toLocaleString()} / ${(currentMetrics?.GIA.total || 0).toLocaleString()} instances</div>
            </div>
            <div class="projections-metric-card blackjack">
                <h3>BlackJack Adoption (FY26Q4)</h3>
                <div class="metric-value">${currentMetrics && currentMetrics.BlackJack.total > 0 ? 
                    (currentMetrics.BlackJack.fkp / currentMetrics.BlackJack.total * 100).toFixed(1) : 0}%</div>
                <div class="metric-subtitle">${(currentMetrics?.BlackJack.fkp || 0).toLocaleString()} / ${(currentMetrics?.BlackJack.total || 0).toLocaleString()} instances</div>
            </div>
        </div>
        
        <div class="projections-chart-container">
            <h2>📈 Adoption Projections by Quarter</h2>
            <div class="projections-chart-legend">
                <div class="legend-item"><div class="legend-color commercial"></div><span>Commercial</span></div>
                <div class="legend-item"><div class="legend-color gia"></div><span>GIA</span></div>
                <div class="legend-item"><div class="legend-color blackjack"></div><span>BlackJack</span></div>
                <div class="legend-item" style="margin-left: auto;">
                    <span class="legend-line solid"></span><span>Actual</span>
                    <span class="legend-line dashed"></span><span>Projected</span>
                </div>
            </div>
            <div class="projections-chart-svg">${renderProjectionsChart(quarterlyData, QUARTERS, COLORS)}</div>
        </div>
        
        <div class="projections-analysis-grid">
            <div class="projections-analysis-section">
                <h2>
                    <span class="insight-icon">💡</span>
                    Services Enabled - Need to Complete Adoption
                    <span class="badge-count">${servicesNeedingCompletion.length} services</span>
                </h2>
                <div class="section-subtitle">
                    Services with ≥1 FKP instance but still have self-managed instances (${totalCompletionInstances.toLocaleString()} instances)
                </div>
                <div class="projections-table-scroll">
                    <table class="projections-data-table">
                        <thead>
                            <tr>
                                <th>Org Leader</th>
                                <th>Cloud</th>
                                <th>Team</th>
                                <th>Gap Environment</th>
                                <th>Instances</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${servicesNeedingCompletion.map(s => `
                                <tr>
                                    <td>${s.orgLeader}</td>
                                    <td>${s.cloud}</td>
                                    <td>${s.team}</td>
                                    <td>${s.envsWithGaps.map(env => `<span class="env-badge ${env.toLowerCase()}">${env}</span>`).join(' ')}</td>
                                    <td>${s.totalGapInstances.toLocaleString()}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
            
            <div class="projections-analysis-section">
                <h2>
                    <span class="insight-icon">💡</span>
                    Services Enabled - GovCloud Adoption Gap
                    <span class="badge-count">${servicesNeedingGovcloud.length} services</span>
                </h2>
                <div class="section-subtitle">
                    Services with FKP in Commercial but self-managed in GovCloud (${totalGovcloudInstances.toLocaleString()} instances)
                </div>
                <div class="projections-table-scroll">
                    <table class="projections-data-table">
                        <thead>
                            <tr>
                                <th>Org Leader</th>
                                <th>Cloud</th>
                                <th>Team</th>
                                <th>Gap Environment</th>
                                <th>Instances</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${servicesNeedingGovcloud.map(s => `
                                <tr>
                                    <td>${s.orgLeader}</td>
                                    <td>${s.cloud}</td>
                                    <td>${s.team}</td>
                                    <td>${s.envsWithGaps.map(env => `<span class="env-badge ${env.toLowerCase()}">${env}</span>`).join(' ')}</td>
                                    <td>${s.totalGapInstances.toLocaleString()}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
        
        <div class="projections-summary-section">
            <h2>⚠️ Clouds Needing ETA Alignment <span class="badge-count">${cloudList.length} clouds • ${totalETAInstances.toLocaleString()} instances</span></h2>
            <div class="section-subtitle">
                Clouds with self-managed EKS instances that need ETAs for migration planning
            </div>
            <div class="projections-table-scroll">
                <table class="projections-data-table">
                    <thead>
                        <tr>
                            <th>Org Leader</th>
                            <th>Parent Cloud</th>
                            <th>Cloud</th>
                            <th>Need ETA Alignment</th>
                            <th>Instances</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${cloudList.map(c => `
                            <tr>
                                <td>${c.orgLeader}</td>
                                <td>${c.parentCloud}</td>
                                <td>${c.cloud}</td>
                                <td>${Array.from(c.envsSet).map(env => `<span class="env-badge ${env.toLowerCase()}">${env}</span>`).join(' ')}</td>
                                <td>${c.totalInstances.toLocaleString()}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

/**
 * Render projections chart SVG
 */
function renderProjectionsChart(quarterlyData, QUARTERS, COLORS) {
    const width = 1000, height = 350;
    const padding = { top: 40, right: 50, bottom: 60, left: 80 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;
    const xStep = chartWidth / (QUARTERS.length - 1);
    const yScale = (v) => chartHeight - (v / 100 * chartHeight);
    
    const gridLines = [0, 25, 50, 75, 100].map(v => `
        <line x1="0" y1="${yScale(v)}" x2="${chartWidth}" y2="${yScale(v)}" stroke="#334155" stroke-width="1" stroke-dasharray="${v === 0 ? '0' : '4,4'}"/>
        <text x="-10" y="${yScale(v) + 4}" text-anchor="end" fill="#94a3b8" font-size="11">${v}%</text>
    `).join('');
    
    const xLabels = QUARTERS.map((q, i) => `
        <text x="${i * xStep}" y="${chartHeight + 25}" text-anchor="middle" fill="#94a3b8" font-size="11">${q}</text>
        ${i < 2 ? `<text x="${i * xStep}" y="${chartHeight + 40}" text-anchor="middle" fill="#64748b" font-size="9">(Actual)</text>` : ''}
    `).join('');
    
    // Stagger label offsets to avoid overlap
    const labelOffsets = { 'Commercial': -18, 'GIA': -8, 'BlackJack': 22 };
    
    const lines = ['Commercial', 'GIA', 'BlackJack'].map(env => {
        const data = quarterlyData[env];
        const color = COLORS[env];
        const labelOffset = labelOffsets[env];
        
        const actualPoints = data.filter(d => d.isActual);
        const projectedPoints = data.filter(d => !d.isActual);
        
        if (actualPoints.length > 0 && projectedPoints.length > 0) {
            projectedPoints.unshift(actualPoints[actualPoints.length - 1]);
        }
        
        const toPath = (points) => points.length === 0 ? '' : points.map((p, i) => {
            const qIdx = QUARTERS.indexOf(p.quarter);
            return `${i === 0 ? 'M' : 'L'} ${qIdx * xStep} ${yScale(p.adoption)}`;
        }).join(' ');
        
        const circles = data.map(p => {
            const qIdx = QUARTERS.indexOf(p.quarter);
            return `<circle cx="${qIdx * xStep}" cy="${yScale(p.adoption)}" r="6" fill="${color}" stroke="white" stroke-width="2"/>`;
        }).join('');
        
        const labels = data.map(p => {
            const qIdx = QUARTERS.indexOf(p.quarter);
            return `<text x="${qIdx * xStep}" y="${yScale(p.adoption) + labelOffset}" text-anchor="middle" fill="${color}" font-size="11" font-weight="600">${p.adoption.toFixed(1)}%</text>`;
        }).join('');
        
        return `
            <path d="${toPath(actualPoints)}" fill="none" stroke="${color}" stroke-width="3" stroke-linecap="round"/>
            <path d="${toPath(projectedPoints)}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-dasharray="8,4"/>
            ${circles}${labels}
        `;
    }).join('');
    
    return `<svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet">
        <g transform="translate(${padding.left}, ${padding.top})">${gridLines}${xLabels}${lines}</g>
    </svg>`;
}
