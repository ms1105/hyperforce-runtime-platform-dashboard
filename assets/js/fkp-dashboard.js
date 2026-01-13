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
    'visibility-agent', 'vault', 'mars', 'authzwebhook', 'kubesyntheticscaler'
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
        currentTab: 'executive-overview',
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
    
    // Show/hide tabs based on view mode
    document.querySelectorAll('.nav-subitem').forEach(tab => {
        const tabView = tab.dataset.view;
        if (mode === 'exec') {
            // In Exec view, hide developer-only tabs, show exec and both
            if (tabView === 'developer') {
                tab.style.display = 'none';
            } else {
                tab.style.display = '';
            }
        } else {
            // In Developer view, hide exec-only tabs, show developer and both
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
        // Try to find corresponding tab first
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
    
    // If viewing runtime-availability or runtime-karpenter, refresh to show correct content
    if (fkpDashboard.state.currentTab === 'runtime-availability') {
        renderRuntimeAvailability();
    } else if (fkpDashboard.state.currentTab === 'runtime-karpenter') {
        renderKarpenter();
    }
    
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
        
        // Set body class for initial tab (executive-overview)
        document.body.classList.add('executive-overview-active');
        
        // Initialize view mode (Exec/Developer toggle)
        console.log('⏳ Step 7: Initializing view mode...');
        initializeViewMode();
        
        refreshCurrentTab();
        
        showLoading(false);
        console.log('✅ FKP Dashboard initialized successfully');
        
    } catch (error) {
        console.error('❌ Error initializing dashboard:', error);
        showError(`Failed to initialize dashboard: ${error.message}. Please check browser console for details.`);
        showLoading(false);
    }
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
        if (isOnboardingExecTab) {
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
    const viewToggles = document.getElementById('view-toggles');
    fkpDashboard.state.currentTab = tabId;
    
    let controlsHTML = '';
    
    switch (tabId) {
        case 'executive-overview':
            // No view controls for Overview tab - toggle is inside the roadmap section
            controlsHTML = '';
            break;
            
        case 'migration-pipeline':
            controlsHTML = `
                <div class="view-toggle-group">
                    <label>View by:</label>
                    <div class="toggle-buttons">
                        <button class="toggle-btn ${fkpDashboard.state.viewMode.secondary === 'org-leader' ? 'active' : ''}" 
                                onclick="setViewMode('secondary', 'org-leader')">Org Leader</button>
                        <button class="toggle-btn ${fkpDashboard.state.viewMode.secondary === 'parent-cloud' ? 'active' : ''}" 
                                onclick="setViewMode('secondary', 'parent-cloud')">Parent Cloud</button>
                        <button class="toggle-btn ${fkpDashboard.state.viewMode.secondary === 'cloud' ? 'active' : ''}" 
                                onclick="setViewMode('secondary', 'cloud')">Cloud</button>
                    </div>
                </div>
            `;
            break;
            
        case 'service-information':
            controlsHTML = `
                <div class="view-toggle-group">
                    <label>Sort by:</label>
                    <select class="sort-dropdown" onchange="setSortBy(this.value)">
                        <option value="totalInstances" ${fkpDashboard.state.sortBy === 'totalInstances' ? 'selected' : ''}>Total Instances</option>
                        <option value="instanceAdoption" ${fkpDashboard.state.sortBy === 'instanceAdoption' ? 'selected' : ''}>Instance Adoption %</option>
                        <option value="fkpInstances" ${fkpDashboard.state.sortBy === 'fkpInstances' ? 'selected' : ''}>FKP Instances</option>
                        <option value="migrationStage" ${fkpDashboard.state.sortBy === 'migrationStage' ? 'selected' : ''}>Migration Stage</option>
                        <option value="serviceName" ${fkpDashboard.state.sortBy === 'serviceName' ? 'selected' : ''}>Service Name</option>
                        <option value="orgLeader" ${fkpDashboard.state.sortBy === 'orgLeader' ? 'selected' : ''}>Org Leader</option>
                    </select>
                </div>
                <div class="view-toggle-group">
                    <button class="toggle-btn ${fkpDashboard.state.sortOrder === 'desc' ? 'active' : ''}" onclick="toggleSortOrder()">
                        ${fkpDashboard.state.sortOrder === 'desc' ? '↓' : '↑'} ${fkpDashboard.state.sortOrder.toUpperCase()}
                    </button>
                </div>
            `;
            break;
    }
    
    viewToggles.innerHTML = controlsHTML;
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
    
    // Check if this is a React tab
    const navItem = document.querySelector(`[data-tab="${tabId}"]`);
    const isReactTab = navItem && navItem.hasAttribute('data-react-tab');
    
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
    
    // Update filter visibility
    updateFilterVisibility();
    
    // Refresh content (only for non-React tabs)
    if (!isReactTab) {
        refreshCurrentTab();
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
        'executive-overview': {
            title: 'Onboarding',
            subtitle: 'Overview'
        },
        'migration-pipeline': {
            title: 'Onboarding', 
            subtitle: 'Migration Pipeline'
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
            title: 'Runtime Scale & Availability',
            subtitle: 'Autoscaling'
        },
        'runtime-hpa': {
            title: 'Runtime Scale & Availability',
            subtitle: 'Autoscaling'
        },
        'runtime-availability': {
            title: 'Runtime Scale & Availability',
            subtitle: 'Availability'
        },
        'runtime-karpenter': {
            title: 'Runtime Scale & Availability',
            subtitle: 'Karpenter'
        },
        'cost-overview': {
            title: 'Cost to Serve',
            subtitle: 'Overview'
        },
        'cost-hcp': {
            title: 'Cost to Serve',
            subtitle: 'Overview'
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
 * Refresh content for the current tab
 */
function refreshCurrentTab() {
    const currentTab = fkpDashboard.state.currentTab;
    
    switch (currentTab) {
        case 'executive-overview':
            renderExecutiveOverview();
            break;
        case 'migration-pipeline':
            renderMigrationPipeline();
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
        case 'runtime-availability':
            renderRuntimeAvailability();
            break;
        case 'runtime-karpenter':
            renderKarpenter();
            break;
        case 'availability-exec':
            renderAvailabilityExecView();
            break;
        case 'availability-baseline':
            renderAvailabilityBaseline();
            break;
    }
}

/**
 * Render Runtime Availability tab - shows Exec or Baseline based on view mode
 */
async function renderRuntimeAvailability() {
    console.log('🛡️ Rendering Runtime Availability tab...');
    
    const container = document.getElementById('runtime-availability-content');
    if (!container) return;
    
    const viewMode = fkpDashboard.state.currentViewMode || 'exec';
    
    // Show loading state first
    container.innerHTML = `
        <div class="placeholder-message" style="text-align: center; padding: 40px;">
            <div class="placeholder-icon">🛡️</div>
            <h3>Loading Availability Data...</h3>
        </div>
    `;
    
    // Load all data in parallel first
    await loadAllAvailabilityData();
    
    if (viewMode === 'exec') {
        // Render Exec View directly into the container
        await renderAvailabilityExecViewInContainer(container);
    } else {
        // Render Baseline directly into the container
        await renderAvailabilityBaselineInContainer(container);
    }
    
    console.log('✅ Runtime Availability rendered for view mode:', viewMode);
}

/**
 * Render Availability Exec View directly into a container
 */
async function renderAvailabilityExecViewInContainer(container) {
    const metrics = availabilityData.executiveSummary;
    
    if (!metrics || metrics.length === 0) {
        container.innerHTML = `
            <div class="placeholder-message" style="text-align: center; padding: 40px;">
                <div class="placeholder-icon">⚠️</div>
                <h3>No Data Available</h3>
                <p>Could not load availability metrics</p>
            </div>
        `;
        return;
    }
    
    // Build the complete exec view HTML
    let metricsHtml = '';
    metrics.forEach(metric => {
        const icon = getAvailabilityMetricIcon(metric.metric_name);
        const cardClass = getAvailabilityCardClass(metric);
        const trendClass = getAvailabilityTrendClass(metric);
        const formattedValue = formatAvailabilityMetricValue(metric);
        
        let trendHtml = '';
        if (metric.trend_value) {
            const arrow = metric.trend_direction === 'up' ? '↑' : metric.trend_direction === 'down' ? '↓' : '';
            trendHtml = `<div class="metric-card-trend ${trendClass}">${arrow} ${metric.trend_value}</div>`;
        } else if (metric.target) {
            trendHtml = `<div class="metric-card-target">Target: <strong>${metric.target}</strong></div>`;
        }
        
        metricsHtml += `
            <div class="availability-metric-card ${cardClass}">
                <div class="metric-card-header">
                    <span class="metric-card-icon">${icon}</span>
                    <span class="metric-card-label">${metric.metric_name}</span>
                </div>
                <div class="metric-card-value">${formattedValue}</div>
                ${trendHtml}
            </div>
        `;
    });
    
    // Get current timestamp
    const now = new Date();
    const formattedDate = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const formattedTime = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZoneName: 'short' });
    
    container.innerHTML = `
        <div class="tab-header">
            <div class="availability-header">
                <div class="availability-title-section">
                    <div class="availability-icon">🛡️</div>
                    <div>
                        <h2>Executive View — HRP Availability at a Glance</h2>
                        <p>Sev0/Sev1 Focus • E360 Post-Processed Data</p>
                    </div>
                </div>
                <div class="availability-header-badges">
                    <span class="badge badge-success">
                        <span class="badge-dot"></span>
                        Powered by E360 Post-Processed Data
                    </span>
                    <span class="last-updated">Last Updated: ${formattedDate} @ ${formattedTime}</span>
                </div>
            </div>
        </div>
        
        <div class="availability-content">
            <div class="availability-metrics-grid">${metricsHtml}</div>
            
            <div class="availability-section-row">
                <div class="incident-trend-container">
                    <div class="chart-header">
                        <h3>Sev0/Sev1 Incident Trend</h3>
                        <div class="chart-legend">
                            <span class="legend-item"><span class="legend-dot" style="background:#ef4444;"></span> Sev0</span>
                            <span class="legend-item"><span class="legend-dot" style="background:#f59e0b;"></span> Sev1</span>
                        </div>
                    </div>
                    <div id="runtime-incident-trend-chart"></div>
                </div>
                
                <div class="investment-themes-container">
                    <div class="themes-header">
                        <h3>Top 3 Investment Themes</h3>
                    </div>
                    <div id="runtime-investment-themes-list"></div>
                </div>
            </div>
        </div>
    `;
    
    // Render charts into the new containers
    renderIncidentTrendChartInContainer(document.getElementById('runtime-incident-trend-chart'));
    renderInvestmentThemesInContainer(document.getElementById('runtime-investment-themes-list'));
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
    const indicator = document.getElementById('loading-indicator');
    if (indicator) {
        indicator.style.display = show ? 'flex' : 'none';
    }
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
document.addEventListener('DOMContentLoaded', function() {
    console.log('📋 DOM Content Loaded - Setting up event listeners...');
    
    // Event listeners for sidebar navigation
    document.querySelectorAll('.nav-subitem').forEach(item => {
        item.addEventListener('click', function() {
            const tabName = this.getAttribute('data-tab');
            console.log('🔄 Tab clicked:', tabName);
            switchTab(tabName);
            
            // Update sidebar active states
            document.querySelectorAll('.nav-subitem').forEach(i => i.classList.remove('active'));
            this.classList.add('active');
        });
    });
    
    // Handle main nav item click (expand/collapse)
    document.querySelectorAll('.nav-item.main-item').forEach(item => {
        item.addEventListener('click', function() {
            const section = this.getAttribute('data-section');
            const subitems = document.getElementById(section + '-subitems');
            
            // Toggle subitems visibility
            if (subitems) {
                subitems.classList.toggle('active');
                this.classList.toggle('active');
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
window.toggleDropdown = toggleDropdown;
window.toggleSelectAll = toggleSelectAll;
window.resetAllFilters = resetAllFilters;
window.showServiceDetails = showServiceDetails;
window.closeServiceModal = closeServiceModal;
window.setViewMode = setViewMode;
window.switchTab = switchTab;
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
        const key = `${serviceName}-${env}-${cluster}`;
        
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
    
    console.log(`📊 Total: ${totalServices}, Tier0: ${tier0Count}, Tier1: ${tier1Count}`);
    console.log(`📊 HPA Enabled: ${hpaEnabledCount}, Rate: ${hpaAdoptionRate}%`);
    console.log(`📊 Tier 0: ${tier0HpaCount} with HPA (${tier0HpaPct}%)`);
    console.log(`📊 Tier 1: ${tier1HpaCount} with HPA (${tier1HpaPct}%)`);
    
    // ============ UPDATE SERVICE TIER BREAKDOWN CARD ============
    const totalServicesEl = document.getElementById('total-services-count');
    if (totalServicesEl) {
        totalServicesEl.textContent = totalServices;
    }
    
    // Update tier bar segments
    const tier0Segment = document.getElementById('tier-0-segment');
    const tier1Segment = document.getElementById('tier-1-segment');
    if (tier0Segment) tier0Segment.style.width = `${tier0Pct}%`;
    if (tier1Segment) tier1Segment.style.width = `${tier1Pct}%`;
    
    // Update tier details
    const tierDetails = document.getElementById('tier-details');
    if (tierDetails) {
        tierDetails.innerHTML = `
            <div class="tier-row clickable" onclick="filterAutoscalingByTier(0)">
                <span class="tier-label">Tier 0 (Critical)</span>
                <span class="tier-value">${tier0Count} <span class="tier-pct">(${tier0Pct}%)</span> <span class="link-icon">↗</span></span>
            </div>
            <div class="tier-row clickable" onclick="filterAutoscalingByTier(1)">
                <span class="tier-label">Tier 1 (Standard)</span>
                <span class="tier-value">${tier1Count} <span class="tier-pct">(${tier1Pct}%)</span> <span class="link-icon">↗</span></span>
            </div>
            <div class="tier-row">
                <span class="tier-label">Total Services</span>
                <span class="tier-value">${totalServices}</span>
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
        
        // Action button - HPA Enabled if HPA > 0%
        const actionBtn = service.hpa > 0 
            ? '<button class="action-btn enabled">HPA Enabled</button>'
            : '<button class="action-btn enroll">Enroll to HPA</button>';
        
        return `
            <tr>
                <td>${service.serviceName}</td>
                <td>Platform Services</td>
                <td><span class="${tierBadgeClass}">${tierLabel}</span></td>
                <td><span class="${hpaBadgeClass}">${Math.round(service.hpa)}%</span></td>
                <td>${actionBtn}</td>
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
    month: 'all'
};

/**
 * Load all Karpenter data files
 */
async function loadKarpenterData() {
    if (karpenterData.loaded) {
        console.log('📦 Karpenter data already loaded');
        return;
    }
    
    console.log('📦 Loading Karpenter data...');
    
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
 * Apply Karpenter filters
 */
function applyKarpenterFilters() {
    karpenterFilterState.fi = document.getElementById('karpenter-fi-filter')?.value || 'all';
    karpenterFilterState.fd = document.getElementById('karpenter-fd-filter')?.value || 'all';
    karpenterFilterState.environment = document.getElementById('karpenter-env-filter')?.value || 'all';
    karpenterFilterState.cluster = document.getElementById('karpenter-cluster-filter')?.value || 'all';
    karpenterFilterState.month = document.getElementById('karpenter-month-filter')?.value || 'all';
    
    console.log('📦 Karpenter filters applied:', karpenterFilterState);
    
    renderKarpenter();
}

/**
 * Reset Karpenter filters
 */
function resetKarpenterFilters() {
    karpenterFilterState = { fi: 'all', fd: 'all', environment: 'all', cluster: 'all', month: 'all' };
    
    document.getElementById('karpenter-fi-filter').value = 'all';
    document.getElementById('karpenter-fd-filter').value = 'all';
    document.getElementById('karpenter-env-filter').value = 'all';
    document.getElementById('karpenter-cluster-filter').value = 'all';
    document.getElementById('karpenter-month-filter').value = 'all';
    
    renderKarpenter();
}

/**
 * Filter Karpenter data based on current filter state
 */
function filterKarpenterData(data, includeMonth = true) {
    return data.filter(row => {
        // Only check filters if the column exists in the data
        if (karpenterFilterState.fi !== 'all' && 'falcon_instance' in row && row.falcon_instance !== karpenterFilterState.fi) return false;
        if (karpenterFilterState.fd !== 'all' && 'functional_domain' in row && row.functional_domain !== karpenterFilterState.fd) return false;
        if (karpenterFilterState.environment !== 'all' && 'environment' in row && row.environment !== karpenterFilterState.environment) return false;
        if (karpenterFilterState.cluster !== 'all' && 'cluster' in row && row.cluster !== karpenterFilterState.cluster) return false;
        if (includeMonth && karpenterFilterState.month !== 'all' && row.month !== karpenterFilterState.month) return false;
        return true;
    });
}

/**
 * Render Karpenter tab based on current view mode
 */
async function renderKarpenter() {
    console.log('📦 Rendering Karpenter...');
    
    await loadKarpenterData();
    
    if (!karpenterData.loaded) {
        console.log('⚠️ Karpenter data not loaded');
        return;
    }
    
    const container = document.getElementById('karpenter-content');
    if (!container) return;
    
    const viewMode = fkpDashboard.state.currentViewMode || 'exec';
    
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
    
    // Use main_summary which has ALL filter columns for proper cross-filtering
    const filteredData = filterKarpenterData(karpenterData.mainSummary, true);
    
    // Check which months are in the filtered data
    const monthsInData = [...new Set(filteredData.map(r => r.month))].sort();
    console.log('📦 Filtered main summary:', filteredData.length, 'rows');
    console.log('📦 Months in filtered data:', monthsInData);
    
    // Get all available months from full dataset to find previous month
    const allMonths = [...new Set(karpenterData.mainSummary.map(r => r.month))].sort();
    
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
    // Aggregates data by the groupBy field, calculates avg for each group, then averages those
    const calcGroupedAvg = (data, groupBy) => {
        if (!data || data.length === 0) return { avg: '--', trend: 0 };
        
        // Group by month and the dimension
        const byMonth = {};
        data.forEach(r => {
            const month = r.month;
            const key = r[groupBy] || 'unknown';
            if (!byMonth[month]) byMonth[month] = {};
            if (!byMonth[month][key]) byMonth[month][key] = { sum: 0, count: 0 };
            byMonth[month][key].sum += parseFloat(r.avg_cpu || 0);
            byMonth[month][key].count += 1;
        });
        
        // Calculate average for each month (average of group averages)
        const months = Object.keys(byMonth).sort();
        const monthlyAvgs = {};
        months.forEach(m => {
            const groups = Object.values(byMonth[m]);
            const groupAvgs = groups.map(g => g.sum / g.count);
            monthlyAvgs[m] = groupAvgs.reduce((a, b) => a + b, 0) / groupAvgs.length;
        });
        
        // Determine which month to use for average and trend calculation
        const selectedMonth = karpenterFilterState.month !== 'all' ? karpenterFilterState.month : null;
        const targetMonth = selectedMonth || months[months.length - 1]; // Use selected month or latest
        
        // Overall average: if month selected, use that month; otherwise average all months
        let avg;
        if (selectedMonth && monthlyAvgs[selectedMonth] !== undefined) {
            avg = monthlyAvgs[selectedMonth].toFixed(1);
        } else {
            const allAvgs = Object.values(monthlyAvgs);
            avg = allAvgs.length > 0 
                ? (allAvgs.reduce((a, b) => a + b, 0) / allAvgs.length).toFixed(1)
                : '--';
        }
        
        // Trend: compare target month with previous month
        let trend = 0;
        if (monthlyAvgs[targetMonth] !== undefined) {
            const prevMonth = getPreviousMonth(targetMonth);
            if (prevMonth) {
                // Get previous month data with same filters (except month)
                const prevMonthData = getDataForMonth(prevMonth);
                const prevAvg = calcAvgForData(prevMonthData, groupBy);
                if (prevAvg !== null) {
                    trend = monthlyAvgs[targetMonth] - prevAvg;
                }
            }
        }
        
        return { avg, trend };
    };
    
    // Calculate metrics for each dimension
    const fiMetrics = calcGroupedAvg(filteredData, 'falcon_instance');
    const fdMetrics = calcGroupedAvg(filteredData, 'functional_domain');
    const clusterMetrics = calcGroupedAvg(filteredData, 'cluster');
    const envMetrics = calcGroupedAvg(filteredData, 'environment');
    
    const avgFI = fiMetrics.avg;
    const avgFD = fdMetrics.avg;
    const avgCluster = clusterMetrics.avg;
    const avgEnv = envMetrics.avg;
    
    const trendFI = fiMetrics.trend;
    const trendFD = fdMetrics.trend;
    const trendCluster = clusterMetrics.trend;
    const trendEnv = envMetrics.trend;
    
    // Build trend chart data from filtered main summary (already have filteredData above)
    const monthlyAgg = {};
    filteredData.forEach(r => {
        const key = r.month;
        if (!monthlyAgg[key]) {
            monthlyAgg[key] = { month: r.month, month_name: r.month_name, sum: 0, count: 0 };
        }
        monthlyAgg[key].sum += parseFloat(r.avg_cpu || 0);
        monthlyAgg[key].count += 1;
    });
    const trendData = Object.values(monthlyAgg)
        .sort((a, b) => a.month.localeCompare(b.month))
        .map(m => ({
            month: m.month_name,
            value: m.count > 0 ? (m.sum / m.count) : 0
        }));
    
    // Build environment bar chart data - aggregate by environment from filtered data
    const envAgg = {};
    const latestMonth = trendData.length > 0 
        ? Object.values(monthlyAgg).sort((a, b) => b.month.localeCompare(a.month))[0]?.month 
        : null;
    const envFiltered = karpenterFilterState.month !== 'all' 
        ? filteredData.filter(r => r.month === karpenterFilterState.month)
        : filteredData.filter(r => r.month === latestMonth);
    
    envFiltered.forEach(r => {
        const key = r.environment;
        if (!envAgg[key]) {
            envAgg[key] = { name: key.charAt(0).toUpperCase() + key.slice(1), sum: 0, count: 0 };
        }
        envAgg[key].sum += parseFloat(r.avg_cpu || 0);
        envAgg[key].count += 1;
    });
    const envBarData = Object.values(envAgg).map(e => ({
        name: e.name,
        value: e.count > 0 ? (e.sum / e.count) : 0
    }));
    
    container.innerHTML = `
        <div class="karpenter-exec-content">
            <!-- Metric Cards -->
            <div class="karpenter-metrics-grid">
                <div class="karpenter-metric-card">
                    <div class="karpenter-metric-header">
                        <span class="karpenter-metric-label">Avg. Bin-Packing Efficiency - FI</span>
                        <span class="karpenter-metric-icon">📊</span>
                    </div>
                    <div class="karpenter-metric-value">${avgFI}%</div>
                    <div class="karpenter-metric-trend ${trendFI >= 0 ? 'trend-up' : 'trend-down'}">
                        ${trendFI >= 0 ? '+' : ''}${trendFI.toFixed(1)}% from last period
                    </div>
                </div>
                
                <div class="karpenter-metric-card">
                    <div class="karpenter-metric-header">
                        <span class="karpenter-metric-label">Avg. Bin-Packing Efficiency - FD</span>
                        <span class="karpenter-metric-icon">⚙️</span>
                    </div>
                    <div class="karpenter-metric-value">${avgFD}%</div>
                    <div class="karpenter-metric-trend ${trendFD >= 0 ? 'trend-up' : 'trend-down'}">
                        ${trendFD >= 0 ? '+' : ''}${trendFD.toFixed(1)}% from last period
                    </div>
                </div>
                
                <div class="karpenter-metric-card">
                    <div class="karpenter-metric-header">
                        <span class="karpenter-metric-label">Avg. Bin-Packing Efficiency - Cluster</span>
                        <span class="karpenter-metric-icon">🖥️</span>
                    </div>
                    <div class="karpenter-metric-value">${avgCluster}%</div>
                    <div class="karpenter-metric-trend ${trendCluster >= 0 ? 'trend-up' : 'trend-down'}">
                        ${trendCluster >= 0 ? '+' : ''}${trendCluster.toFixed(1)}% from last period
                    </div>
                </div>
                
                <div class="karpenter-metric-card">
                    <div class="karpenter-metric-header">
                        <span class="karpenter-metric-label">Avg. Bin-Packing Efficiency - Environment</span>
                        <span class="karpenter-metric-icon">🌐</span>
                    </div>
                    <div class="karpenter-metric-value">${avgEnv}%</div>
                    <div class="karpenter-metric-trend ${trendEnv >= 0 ? 'trend-up' : 'trend-down'}">
                        ${trendEnv >= 0 ? '+' : ''}${trendEnv.toFixed(1)}% from last period
                    </div>
                </div>
            </div>
            
            <!-- Charts Row -->
            <div class="karpenter-charts-row">
                <!-- Trend Chart -->
                <div class="karpenter-chart-card">
                    <div class="karpenter-chart-header">
                        <h3>Bin-Packing Efficiency Trends (CPU Allocation Rate)</h3>
                        <div class="karpenter-chart-legend">
                            <span class="legend-item"><span class="legend-dot trend"></span> Bin-Packing Efficiency (%) - CPU Allocation Rate</span>
                        </div>
                    </div>
                    <div class="karpenter-trend-chart" id="karpenter-trend-chart">
                        ${renderKarpenterTrendChart(trendData)}
                    </div>
                </div>
                
                <!-- Environment Bar Chart -->
                <div class="karpenter-chart-card">
                    <div class="karpenter-chart-header">
                        <h3>Efficiency by Environment</h3>
                        <div class="karpenter-chart-legend">
                            <span class="legend-item"><span class="legend-dot env"></span> CPU Allocation Rate (%)</span>
                        </div>
                    </div>
                    <div class="karpenter-bar-chart" id="karpenter-bar-chart">
                        ${renderKarpenterBarChart(envBarData)}
                    </div>
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
    
    // Get filtered cluster data
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
                improvementLabel = '↑ Improved Packing';
                improvementClass = 'improved';
            } else if (improvement < 0) {
                improvementLabel = '↓ Regressed Packing';
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
            efficiencyClass: efficiencyClass
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
            return `
                <div class="karpenter-heatmap-tile ${cluster.efficiencyClass}">
                    <div class="heatmap-cluster-name">${cluster.cluster}</div>
                    <div class="heatmap-efficiency-pct">${cluster.avgCpu.toFixed(1)}%</div>
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
    const allClustersHeatmap = renderHeatmap(clusterLatest, 'Bin-Packing Efficiency Heatmap - All Clusters');
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
                            <th>Avg CPU (%)</th>
                            <th>Bin Packing Improvement</th>
                            <th>Bin Packing Efficiency Indicator</th>
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
 * Render Karpenter trend line chart
 */
function renderKarpenterTrendChart(data) {
    if (!data || data.length === 0) {
        return '<div class="no-data">No trend data available</div>';
    }
    
    // Fixed 0-100% range
    const chartMin = 0;
    const chartMax = 100;
    const chartRange = 100;
    
    const width = 100;
    const height = 60;
    const pointSpacing = width / (data.length - 1 || 1);
    
    // Generate SVG path for line
    const points = data.map((d, i) => {
        const x = i * pointSpacing;
        const y = height - ((d.value - chartMin) / chartRange * height);
        return `${x},${y}`;
    });
    
    const linePath = `M ${points.join(' L ')}`;
    const areaPath = `M 0,${height} L ${points.join(' L ')} L ${width},${height} Z`;
    
    // Generate Y-axis labels (0% to 100% in 20% steps)
    const yLabels = ['100%', '80%', '60%', '40%', '20%', '0%'];
    
    // Generate horizontal grid lines (at 20%, 40%, 60%, 80%)
    const gridLines = [];
    for (let i = 1; i < 5; i++) {
        const y = (height / 5) * i;
        gridLines.push(`<line x1="0" y1="${y}" x2="${width}" y2="${y}" stroke="#e2e8f0" stroke-width="0.2" />`);
    }
    
    return `
        <div class="chart-container">
            <div class="chart-y-axis">
                ${yLabels.map(label => `<span class="y-label">${label}</span>`).join('')}
            </div>
            <div class="chart-main">
                <svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" class="trend-svg">
                    <defs>
                        <linearGradient id="karpenterGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                            <stop offset="0%" style="stop-color:#22c55e;stop-opacity:0.3" />
                            <stop offset="100%" style="stop-color:#22c55e;stop-opacity:0.05" />
                        </linearGradient>
                    </defs>
                    <!-- Grid lines -->
                    ${gridLines.join('')}
                    <!-- Area fill -->
                    <path d="${areaPath}" fill="url(#karpenterGradient)" />
                    <!-- Line -->
                    <path d="${linePath}" fill="none" stroke="#22c55e" stroke-width="0.5" />
                    <!-- Data points -->
                    ${data.map((d, i) => {
                        const x = i * pointSpacing;
                        const y = height - ((d.value - chartMin) / chartRange * height);
                        return `<circle cx="${x}" cy="${y}" r="1.2" fill="#22c55e" />`;
                    }).join('')}
                    <!-- Value labels above points -->
                    ${data.map((d, i) => {
                        const x = i * pointSpacing;
                        const y = height - ((d.value - chartMin) / chartRange * height);
                        return `<text x="${x}" y="${Math.max(y - 3, 3)}" text-anchor="middle" font-size="2.5" fill="#374151" font-weight="600">${d.value.toFixed(1)}%</text>`;
                    }).join('')}
                </svg>
                <div class="chart-x-axis">
                    ${data.map(d => `<span class="x-label">${d.month}</span>`).join('')}
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
    
    const maxValue = 100; // Percentage max
    const colors = ['#22c55e', '#f59e0b', '#8b5cf6', '#06b6d4', '#ef4444'];
    
    return `
        <div class="bar-chart-container">
            <div class="bar-chart-y-axis">
                <span>100%</span>
                <span>80%</span>
                <span>60%</span>
                <span>40%</span>
                <span>20%</span>
                <span>0%</span>
            </div>
            <div class="bar-chart-main">
                ${data.map((d, i) => `
                    <div class="bar-item">
                        <div class="bar-wrapper">
                            <div class="bar" style="height: ${d.value}%; background-color: ${colors[i % colors.length]};">
                                <span class="bar-value-label">${d.value.toFixed(1)}%</span>
                            </div>
                        </div>
                        <span class="bar-label">${d.name}</span>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

/* ======================
   AVAILABILITY SECTION
   ====================== */

// Store availability data globally - cache all data types
let availabilityData = {
    executiveSummary: [],
    monthlyIncidents: [],
    investmentThemes: [],
    serviceMetrics: [],
    loaded: false,
    allLoaded: false
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

/**
 * Load ALL Availability Data in Parallel (optimized)
 */
async function loadAllAvailabilityData() {
    if (availabilityData.allLoaded) {
        console.log('🛡️ Availability data already loaded, using cache');
        return;
    }
    
    console.log('🛡️ Loading all availability data in parallel...');
    const startTime = performance.now();
    
    try {
        // Fetch all CSV files in parallel
        const [execRes, monthlyRes, themesRes, metricsRes] = await Promise.all([
            fetch('assets/data/availability/executive_summary.csv').catch(() => null),
            fetch('assets/data/availability/monthly_incident_agg.csv').catch(() => null),
            fetch('assets/data/availability/investment_themes.csv').catch(() => null),
            fetch('assets/data/availability/service_incident_metrics.csv').catch(() => null)
        ]);
        
        // Parse all responses in parallel
        const [execText, monthlyText, themesText, metricsText] = await Promise.all([
            execRes?.ok ? execRes.text() : '',
            monthlyRes?.ok ? monthlyRes.text() : '',
            themesRes?.ok ? themesRes.text() : '',
            metricsRes?.ok ? metricsRes.text() : ''
        ]);
        
        // Parse CSV data
        availabilityData.executiveSummary = execText ? parseCSVData(execText) : [];
        availabilityData.monthlyIncidents = monthlyText ? parseCSVData(monthlyText) : [];
        availabilityData.investmentThemes = themesText ? parseCSVData(themesText) : [];
        availabilityData.serviceMetrics = metricsText ? parseCSVData(metricsText) : [];
        
        availabilityData.loaded = true;
        availabilityData.allLoaded = true;
        
        const elapsed = (performance.now() - startTime).toFixed(0);
        console.log(`✅ All availability data loaded in ${elapsed}ms`);
        console.log(`   - Executive Summary: ${availabilityData.executiveSummary.length} metrics`);
        console.log(`   - Monthly Incidents: ${availabilityData.monthlyIncidents.length} rows`);
        console.log(`   - Investment Themes: ${availabilityData.investmentThemes.length} themes`);
        console.log(`   - Service Metrics: ${availabilityData.serviceMetrics.length} services`);
        
    } catch (error) {
        console.error('❌ Error loading availability data:', error);
        // Set fallback data
        availabilityData.executiveSummary = [
            { metric_name: 'Sev0/Sev1 Trend (12mo)', metric_value: '47', metric_unit: 'incidents', trend_direction: 'up', trend_value: '12% vs prior period', target: '', status: 'WARNING' },
            { metric_name: 'Avg MTTD (Platform)', metric_value: '7.2', metric_unit: 'min', trend_direction: 'down', trend_value: '18% improved', target: '', status: 'OK' },
            { metric_name: 'Avg MTTR (Platform)', metric_value: '38', metric_unit: 'min', trend_direction: 'down', trend_value: '8% improved', target: '', status: 'OK' },
            { metric_name: 'Monitoring Detection %', metric_value: '78', metric_unit: '%', trend_direction: 'neutral', trend_value: '', target: '>90%', status: 'WARNING' },
            { metric_name: 'Prevention Coverage', metric_value: '4/6', metric_unit: 'services', trend_direction: 'neutral', trend_value: '', target: '6/6', status: 'OK' },
        ];
        availabilityData.loaded = true;
        availabilityData.allLoaded = true;
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
 * Render Availability Exec View
 */
async function renderAvailabilityExecView() {
    console.log('🛡️ Rendering Availability Exec View...');
    
    const container = document.getElementById('availability-metrics-grid');
    if (!container) {
        console.error('❌ Availability metrics container not found');
        return;
    }
    
    // Show loading state
    container.innerHTML = `
        <div class="placeholder-message" style="grid-column: 1 / -1;">
            <div class="placeholder-icon">🛡️</div>
            <h3>Loading Availability Metrics...</h3>
            <p>Fetching executive summary data from E360</p>
        </div>
    `;
    
    // Load ALL data in parallel if not already loaded
    await loadAllAvailabilityData();
    
    const metrics = availabilityData.executiveSummary;
    
    if (!metrics || metrics.length === 0) {
        container.innerHTML = `
            <div class="placeholder-message" style="grid-column: 1 / -1;">
                <div class="placeholder-icon">⚠️</div>
                <h3>No Data Available</h3>
                <p>Could not load availability metrics</p>
            </div>
        `;
        return;
    }
    
    // Build metrics cards HTML
    let html = '';
    
    metrics.forEach(metric => {
        const icon = getAvailabilityMetricIcon(metric.metric_name);
        const cardClass = getAvailabilityCardClass(metric);
        const trendClass = getAvailabilityTrendClass(metric);
        const formattedValue = formatAvailabilityMetricValue(metric);
        
        // Build trend/target display
        let trendHtml = '';
        if (metric.trend_value) {
            const arrow = metric.trend_direction === 'up' ? '↑' : metric.trend_direction === 'down' ? '↓' : '';
            trendHtml = `
                <div class="metric-card-trend ${trendClass}">
                    ${arrow} ${metric.trend_value}
                </div>
            `;
        } else if (metric.target) {
            trendHtml = `
                <div class="metric-card-target">
                    Target: <strong>${metric.target}</strong>
                </div>
            `;
        } else if (metric.metric_unit === 'services') {
            trendHtml = `
                <div class="metric-card-target">
                    Alerts + Tracing
                </div>
            `;
        }
        
        html += `
            <div class="availability-metric-card ${cardClass}">
                <div class="metric-card-header">
                    <span class="metric-card-icon">${icon}</span>
                    <span class="metric-card-label">${metric.metric_name}</span>
                </div>
                <div class="metric-card-value">${formattedValue}</div>
                ${trendHtml}
            </div>
        `;
    });
    
    container.innerHTML = html;
    
    // Update last updated timestamp
    const lastUpdatedEl = document.getElementById('availability-last-updated');
    if (lastUpdatedEl) {
        const now = new Date();
        const formattedDate = now.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
        const formattedTime = now.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            timeZoneName: 'short'
        });
        lastUpdatedEl.textContent = `Last Updated: ${formattedDate} @ ${formattedTime}`;
    }
    
    console.log('✅ Availability Exec View rendered with', metrics.length, 'metrics');
    
    // Also render the incident trend chart and investment themes
    renderIncidentTrendChart();
    renderInvestmentThemes();
}

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
    return availabilityData.monthlyIncidents || [];
}

/**
 * Get investment themes from cache (no fetch needed)
 */
function getInvestmentThemes() {
    return availabilityData.investmentThemes || [];
}

/**
 * Get service incident metrics from cache (no fetch needed)
 */
function getServiceIncidentMetrics() {
    return availabilityData.serviceMetrics || [];
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
