/**
 * FKP Adoption Dashboard JavaScript
 * Handles data loading, processing, filtering, and visualization
 */

console.log('🚀 FKP Dashboard Script Loaded');

// Integration services that should be excluded from adoption metrics
const INTEGRATION_SERVICES = [
    'stampy-webhook', 'madkub-watchdog', 'collection', 'madkub-injection-webhook',
    'collectioninjector', 'metadata-concealer', 'identity-controller-refresher', 
    'identity-controller', 'clustermanagement', 'collectioninjectortest', 
    'visibility-agent', 'vault', 'mars', 'authzwebhook', 'kubesyntheticscaler'
];

// Immediate test to verify script is running
console.log('🔧 Testing immediate JavaScript execution...');
console.log('📊 Current timestamp:', new Date().toISOString());

// Global state management
let fkpDashboard = {
    data: {
        instances: [],           // Raw data from fkp_adoption.csv
        blackjackInstances: [],  // Raw data from blackjack_adoption_normalized.csv
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
        crossCustomerView: 'all' // 'all', 'discrepancies', 'not-started', 'in-progress', or 'complete' for Cross-Customer Analysis
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
        const instancesResponse = await fetch('/fkp_adoption.csv');
        if (!instancesResponse.ok) {
            throw new Error(`Failed to load fkp_adoption.csv: ${instancesResponse.status}`);
        }
        const instancesText = await instancesResponse.text();
        fkpDashboard.data.instances = parseCSV(instancesText);
        console.log(`✅ Loaded ${fkpDashboard.data.instances.length} instance records`);
        
        // Load service cloud mapping data
        console.log('🗺️ Loading service_cloud_mapping_utf8.csv...');
        const mappingsResponse = await fetch('/assets/data/service_cloud_mapping_utf8.csv');
        if (!mappingsResponse.ok) {
            throw new Error(`Failed to load service_cloud_mapping_utf8.csv: ${mappingsResponse.status}`);
        }
        const mappingsText = await mappingsResponse.text();
        fkpDashboard.data.mappings = parseCSV(mappingsText);
        console.log(`✅ Loaded ${fkpDashboard.data.mappings.length} service mappings`);
        
        // Load mesh services data
        console.log('🕸️ Loading mesh_data.csv...');
        const meshResponse = await fetch('/assets/data/mesh_data.csv');
        if (!meshResponse.ok) {
            throw new Error(`Failed to load mesh_data.csv: ${meshResponse.status}`);
        }
        const meshText = await meshResponse.text();
        fkpDashboard.data.meshServices = parseCSV(meshText, false); // No header row
        console.log(`✅ Loaded ${fkpDashboard.data.meshServices.length} mesh services`);
        
        // Load BlackJack adoption instances data
        console.log('⚫ Loading blackjack_adoption_normalized.csv...');
        const blackjackInstancesResponse = await fetch('/assets/data/blackjack_adoption_normalized.csv');
        if (!blackjackInstancesResponse.ok) {
            throw new Error(`Failed to load blackjack_adoption_normalized.csv: ${blackjackInstancesResponse.status}`);
        }
        const blackjackInstancesText = await blackjackInstancesResponse.text();
        fkpDashboard.data.blackjackInstances = parseCSV(blackjackInstancesText);
        console.log(`✅ Loaded ${fkpDashboard.data.blackjackInstances.length} BlackJack instance records`);
        
        // Load BlackJack mesh services data
        console.log('🕸️⚫ Loading blackjack_mesh_services.csv...');
        const blackjackMeshResponse = await fetch('/assets/data/blackjack_mesh_services.csv');
        if (!blackjackMeshResponse.ok) {
            throw new Error(`Failed to load blackjack_mesh_services.csv: ${blackjackMeshResponse.status}`);
        }
        const blackjackMeshText = await blackjackMeshResponse.text();
        fkpDashboard.data.blackjackMeshServices = parseCSV(blackjackMeshText);
        console.log(`✅ Loaded ${fkpDashboard.data.blackjackMeshServices.length} BlackJack mesh services`);
        
        // Load Timeline and Requirements data for Stage 3 and growth projections
        console.log('📈 Loading timeline_requirements.csv...');
        const timelineResponse = await fetch('/assets/data/timeline_requirements.csv');
        if (!timelineResponse.ok) {
            throw new Error(`Failed to load timeline_requirements.csv: ${timelineResponse.status}`);
        }
        const timelineText = await timelineResponse.text();
        fkpDashboard.data.timelineRequirements = parseCSV(timelineText);
        console.log(`✅ Loaded ${fkpDashboard.data.timelineRequirements.length} timeline and requirement records`);
        
        // Debug: Log sample timeline data and services with requirements
        console.log('🔍 DEBUG: Sample timeline records:', fkpDashboard.data.timelineRequirements.slice(0, 3));
        const servicesWithRequirements = fkpDashboard.data.timelineRequirements.filter(record => {
            const requirements = record['Requirements'];
            return requirements && requirements.trim() !== '' && requirements.toLowerCase() !== 'none';
        });
        console.log(`🔍 DEBUG: Found ${servicesWithRequirements.length} services with requirements:`, 
                    servicesWithRequirements.map(r => ({ 
                        name: r['Service Name'], 
                        requirements: r['Requirements'] 
                    })));
        
        // Debug: Check if these services exist in our main data
        const servicesInMainData = servicesWithRequirements.filter(r => {
            return fkpDashboard.data.instances.some(inst => inst.label_p_servicename === r['Service Name']) ||
                   fkpDashboard.data.blackjackInstances.some(inst => inst.label_p_servicename === r['Service Name']);
        });
        console.log(`🔍 DEBUG: Services with requirements that exist in main FKP/BlackJack data: ${servicesInMainData.length}`, 
                    servicesInMainData.map(r => r['Service Name']));
        
        // Debug: Check specific services mentioned by user
        const specificServices = ['cdp-byoc-krc', 'cdp-dpc-eks', 'eanalytics', 'notebook'];
        specificServices.forEach(serviceName => {
            const hasRequirements = servicesWithRequirements.some(r => r['Service Name'] === serviceName);
            const existsInData = fkpDashboard.data.instances.some(inst => inst.label_p_servicename === serviceName) ||
                               fkpDashboard.data.blackjackInstances.some(inst => inst.label_p_servicename === serviceName);
            console.log(`🔍 DEBUG Specific Service: ${serviceName} - HasRequirements: ${hasRequirements}, ExistsInData: ${existsInData}`);
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
        if (!mapping) {
            // Check if this is an integration service being skipped due to missing mapping
            if (INTEGRATION_SERVICES.includes(serviceName)) {
                console.log(`❌ DEBUG: Integration service ${serviceName} exists in data but has NO MAPPING - being skipped!`);
            }
            // Skip unmapped services silently (logged in summary)
            skippedCount++;
            return;
        }
        
        // Classify instance
        const classification = classifyInstance(instance);
        
        // Check if this is an integration service
        const isIntegrationService = INTEGRATION_SERVICES.includes(serviceName);
        
        if (isIntegrationService) {
            console.log(`🔧 DEBUG FKP: Found integration service in data: ${serviceName}`);
        }
        
        // Initialize service if not exists (in appropriate map)
        const servicesMap = isIntegrationService ? processed.integrationServices : processed.services;
        if (!servicesMap.has(serviceName)) {
            servicesMap.set(serviceName, {
                name: serviceName,
                orgLeader: mapping.orgLeader,
                parentCloud: mapping.parentCloud,
                cloud: mapping.cloud,
                team: mapping.team,
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
            updateAggregatedStats(processed, service, mapping, classification);
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
        if (!mapping) {
            // Check if this is an integration service being skipped due to missing mapping
            if (INTEGRATION_SERVICES.includes(serviceName)) {
                console.log(`❌ DEBUG BlackJack: Integration service ${serviceName} exists in data but has NO MAPPING - being skipped!`);
            }
            // Skip unmapped services silently (logged in summary)
            blackjackSkippedCount++;
            return;
        }
        
        // Classify BlackJack instance with override for customer type
        const classification = classifyInstance(instance);
        classification.customerType = 'BlackJack'; // Override for BlackJack instances
        
        // Check if this is an integration service
        const isIntegrationService = INTEGRATION_SERVICES.includes(serviceName);
        
        if (isIntegrationService) {
            console.log(`🔧 DEBUG BlackJack: Found integration service in data: ${serviceName}`);
        }
        
        // Initialize service if not exists (in appropriate map)
        const servicesMap = isIntegrationService ? processed.integrationServices : processed.services;
        if (!servicesMap.has(serviceName)) {
            servicesMap.set(serviceName, {
                name: serviceName,
                orgLeader: mapping.orgLeader,
                parentCloud: mapping.parentCloud,
                cloud: mapping.cloud,
                team: mapping.team,
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
            updateAggregatedStats(processed, service, mapping, classification);
        }
        
        blackjackProcessedCount++;
    });
    
    // Calculate adoption percentages
    calculateAdoptionPercentages(processed);
    
    fkpDashboard.data.processed = processed;
    console.log('✅ Data processing completed');
    console.log(`📊 Processed ${processed.services.size} regular services with mappings`);
    console.log(`🔗 Processed ${processed.integrationServices.size} integration services`);
    console.log(`📊 Regular FKP: ${processedCount} instances, skipped ${skippedCount} (unmapped services)`);
    console.log(`⚫ BlackJack: ${blackjackProcessedCount} instances, skipped ${blackjackSkippedCount} (unmapped services)`);
    console.log(`📈 Total instances processed: ${processedCount + blackjackProcessedCount}`);
    console.log(`📊 Org Leaders: ${processed.orgLeaders.size}`);
    console.log(`📊 Parent Clouds: ${processed.parentClouds.size}`);
    console.log(`📊 Clouds: ${processed.clouds.size}`);
    console.log(`📊 Teams: ${processed.teams.size}`);
    
    // Debug integration services detection
    console.log('🔍 DEBUG Integration Services:');
    console.log('🔍 Integration services found:', Array.from(processed.integrationServices.keys()));
    console.log('🔍 Expected integration services:', INTEGRATION_SERVICES);
    const foundIntegrationServices = INTEGRATION_SERVICES.filter(serviceName => 
        fkpDashboard.data.instances.some(inst => inst.label_p_servicename === serviceName) ||
        fkpDashboard.data.blackjackInstances.some(inst => inst.label_p_servicename === serviceName)
    );
    console.log('🔍 Integration services that exist in data:', foundIntegrationServices);
    
    console.log(`ℹ️ Unmapped services are listed in assets/data/unmapped_services.txt`);
    
    // Debug first few entries
    console.log('🔍 First 5 Org Leaders:', Array.from(processed.orgLeaders.keys()).slice(0, 5));
    console.log('🔍 First 5 Parent Clouds:', Array.from(processed.parentClouds.keys()).slice(0, 5));
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
function updateAggregatedStats(processed, service, mapping, classification) {
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
    updateEntity(processed.orgLeaders, mapping.orgLeader, service);
    
    // Update parent clouds
    updateEntity(processed.parentClouds, mapping.parentCloud, service);
    
    // Update clouds
    updateEntity(processed.clouds, mapping.cloud, service);
    
    // Update teams
    updateEntity(processed.teams, mapping.team, service);
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
 * Handle filter changes and update interdependencies with real-time updates
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
    
    // Trigger real-time update with debounce
    debouncedRefresh();
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
 * Update filter dropdown options based on available data
 */
function updateFilterDropdownOptions(availableOptions) {
    fkpDashboard.state.updatingFilters = true;
    
    // Update each filter dropdown with available options
    Object.keys(availableOptions).forEach(filterKey => {
        const availableList = Array.from(availableOptions[filterKey]).sort();
        const dropdownId = camelToKebab(filterKey);
        const dropdown = document.getElementById(`${dropdownId}-dropdown`);
        
        if (!dropdown) return;
        
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
    const filterGroups = document.querySelectorAll('.filter-group');
    
    console.log('🔍 Updating filter visibility for tab:', currentTab);
    
    filterGroups.forEach(group => {
        const filterType = group.getAttribute('data-filter');
        let show = true;
        
        switch (currentTab) {
            case 'executive-overview':
                show = ['substrate', 'customer-type', 'instance-env'].includes(filterType);
                break;
            case 'migration-pipeline':
                show = ['substrate', 'customer-type', 'instance-env'].includes(filterType);
                break;
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
        console.log(`📋 Filter ${filterType}: ${show ? 'visible' : 'hidden'}`);
    });
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
            controlsHTML = `
                <div class="view-toggle-group">
                    <label>View by:</label>
                    <div class="toggle-buttons">
                        <button class="toggle-btn ${fkpDashboard.state.viewMode.primary === 'service' ? 'active' : ''}" 
                                onclick="setViewMode('primary', 'service')">Service</button>
                        <button class="toggle-btn ${fkpDashboard.state.viewMode.primary === 'instance' ? 'active' : ''}" 
                                onclick="setViewMode('primary', 'instance')">Instance</button>
                    </div>
                </div>
                <div class="view-toggle-group">
                    <label>Group by:</label>
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
    
    // Update sidebar navigation (no longer using tab buttons)
    // The sidebar active state is handled by the event listener
    
    // Update tab content
    document.querySelectorAll('.tab-pane').forEach(pane => pane.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
    
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
    
    // Refresh content
    refreshCurrentTab();
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
            title: 'Hyperforce Runtime Platform 360',
            subtitle: 'Comprehensive platform performance, availability, and cost optimization'
        },
        'migration-pipeline': {
            title: 'Migration Pipeline', 
            subtitle: 'Track services through 6 stages of FKP migration journey'
        },
        'migration-dependencies': {
            title: 'Migration Dependencies',
            subtitle: 'FKP feature requirements and dependent services analysis'
        },
        'service-information': {
            title: 'Service Information',
            subtitle: 'Detailed service analysis with drill-down capabilities'
        },
        'cross-customer-analysis': {
            title: 'COGS Analysis - Comm vs Gov',
            subtitle: 'Services spanning Commercial and GovCloud environments with migration stage comparison'
        },
        'integrations': {
            title: 'Integration Services',
            subtitle: 'Integration services excluded from adoption metrics'
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
    }
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
 * Render Overview tab
 */
function renderExecutiveOverview() {
    console.log('📊 Rendering Overview');
    const container = document.getElementById('executive-metrics');
    
    // Get filtered data based on view mode and current filters
    const { primary, secondary } = fkpDashboard.state.viewMode;
    const filteredData = getFilteredExecutiveData(primary, secondary);
    
    // Render compact cards
    let html = '<div class="metrics-grid compact">';
    
    filteredData.forEach(entity => {
        const adoptionRate = entity.adoptionRate || 0;
        const percentageClass = adoptionRate >= 80 ? 'high' : adoptionRate >= 50 ? 'medium' : 'low';
        
        // Show correct metrics based on view type
        let primaryMetric, secondaryMetric;
        if (primary === 'service') {
            primaryMetric = `Total Services: ${entity.totalServices || 0}`;
            secondaryMetric = `Services on FKP: ${entity.servicesOnFKP || 0}`;
        } else {
            primaryMetric = `Total Instances: ${entity.totalInstances || 0}`;
            secondaryMetric = `Instances on FKP: ${entity.fkpInstances || 0}`;
        }
        
        html += `
            <div class="metric-card compact">
                <div class="metric-header">
                    <div class="metric-title">${entity.name}</div>
                    <div class="metric-percentage ${percentageClass}">
                        ${adoptionRate.toFixed(1)}%
                    </div>
                </div>
                <div class="metric-details">
                    <div class="metric-primary">${primaryMetric}</div>
                    <div class="metric-secondary">${secondaryMetric}</div>
                </div>
            </div>
        `;
    });
    
    html += '</div>';
    container.innerHTML = html;
    
    // Generate and render dynamic calls to action
    const callsToAction = generateCallsToAction();
    renderCallsToAction(callsToAction);
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
        console.log(`🟡 DEBUG Stage 3: Service ${service.name} has parity requirements - assigning Stage 3`);
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
        console.log('🔍 DEBUG Stage 3: No timeline requirements data loaded');
        return false;
    }
    
    const timelineRecord = fkpDashboard.data.timelineRequirements.find(record =>
        record['Service Name'] === serviceName
    );
    
    if (!timelineRecord) {
        // Log specific services mentioned by user for debugging
        const debugServices = ['cdp-byoc-krc', 'cdp-dpc-eks', 'eanalytics', 'notebook'];
        if (debugServices.includes(serviceName)) {
            console.log(`🔍 DEBUG Stage 3 SPECIFIC: No timeline record found for service: ${serviceName}`);
            console.log('🔍 Available services in timeline (first 10):', fkpDashboard.data.timelineRequirements.slice(0, 10).map(r => r['Service Name']));
        } else if (Math.random() < 0.01) {
            console.log(`🔍 DEBUG Stage 3: No timeline record found for service: ${serviceName}`);
        }
        return false;
    }
    
    const requirements = timelineRecord['Requirements'];
    const hasRequirements = requirements && requirements.trim() !== '' && requirements.toLowerCase() !== 'none';
    
    if (hasRequirements) {
        console.log(`🟡 DEBUG Stage 3: Found service with requirements: ${serviceName} - Requirements: ${requirements}`);
    } else {
        // Debug services that should have requirements but don't
        const debugServices = ['cdp-byoc-krc', 'cdp-dpc-eks', 'eanalytics', 'notebook'];
        if (debugServices.includes(serviceName)) {
            console.log(`🔍 DEBUG Stage 3 SPECIFIC: Service ${serviceName} found in timeline but requirements = "${requirements}"`);
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

/**
 * Get growth projections for next quarter (FY26Q4) using actual service data
 */
function calculateGrowthProjections() {
    if (!fkpDashboard.data.timelineRequirements || fkpDashboard.data.timelineRequirements.length === 0 || !fkpDashboard.data.processed) {
        return { services: 0, instances: 0, serviceAdoption: 0, instanceAdoption: 0 };
    }
    
    const nextQuarter = 'FY26Q4';
    let servicesCompletingMigration = 0;
    let instancesCompletingMigration = 0;
    
    fkpDashboard.data.timelineRequirements.forEach(record => {
        const serviceName = record['Service Name'];
        const commercialETA = record['Commercial ETA'];
        const giaETA = record['GIA ETA'];
        const blackjackETA = record['BlackJack ETA'];
        
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
        if ((commercialETA === nextQuarter || commercialETA === 'To Be Decommissioned')) {
            const commercialInstances = service.instances.filter(inst => 
                inst.customerType === 'Commercial' && !inst.onFKP);
            if (commercialInstances.length > 0) {
                instancesCompletingMigration += commercialInstances.length;
                serviceWillComplete = true;
            }
        }
        
        if ((giaETA === nextQuarter || giaETA === 'To Be Decommissioned')) {
            const giaInstances = service.instances.filter(inst => 
                inst.customerType === 'GIA' && !inst.onFKP);
            if (giaInstances.length > 0) {
                instancesCompletingMigration += giaInstances.length;
                serviceWillComplete = true;
            }
        }
        
        if ((blackjackETA === nextQuarter || blackjackETA === 'To Be Decommissioned')) {
            const blackjackInstances = service.instances.filter(inst => 
                inst.customerType === 'BlackJack' && !inst.onFKP);
            if (blackjackInstances.length > 0) {
                instancesCompletingMigration += blackjackInstances.length;
                serviceWillComplete = true;
            }
        }
        
        if (serviceWillComplete) {
            servicesCompletingMigration++;
        }
    });
    
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
    
    // Calculate Instance-level metrics (Line 2)
    let totalInstances = 0;
    let totalFkpInstances = 0;
    
    filteredServices.forEach(service => {
        totalInstances += service.totalInstances || 0;
        totalFkpInstances += service.fkpInstances || 0;
    });
    
    const serviceInstanceAdoptionPercent = totalInstances > 0 ? (totalFkpInstances / totalInstances) * 100 : 0;
    
    // Calculate growth projections for next quarter (FY26Q4)
    const growthProjections = calculateGrowthProjections();
    const projectedServiceAdoption = totalServices > 0 ? 
        ((servicesStage4Plus + growthProjections.services) / totalServices) * 100 : 0;
    const projectedInstanceAdoption = totalInstances > 0 ? 
        ((totalFkpInstances + growthProjections.instances) / totalInstances) * 100 : 0;
    
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
                        <span class="detail-value">1.1% <span style="font-size: 0.65rem; color: #6b7280;">(from previous Q)</span></span>
                    </div>
                </div>
            </div>

            <!-- Service Adoption Card -->
            <div class="adoption-card service-adoption-card">
                <div class="adoption-header">
                    <div class="adoption-percentage">
                        ${serviceTypeAdoptionPercent.toFixed(2)}%
                    </div>
                    <div class="adoption-title">Service Adoption</div>
                    <div class="adoption-subtitle">Combined Commercial & GovCloud</div>
                </div>
                <div class="adoption-details">
                    <div class="detail-row">
                        <span class="detail-label">Total Services</span>
                        <span class="detail-value">${totalServices}</span>
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
        document.querySelectorAll('.dropdown-content').forEach(dd => {
            dd.style.display = 'none';
        });
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
        console.log('🔧 DEBUG: Integration tab found, visibility:', window.getComputedStyle(integrationsTab).display);
        console.log('🔧 DEBUG: Integration tab classes:', integrationsTab.className);
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
    console.log('🔧 DEBUG Integration Metrics: Found', integrationServices.length, 'integration services');
    console.log('🔧 DEBUG Integration Services:', integrationServices.map(s => s.name));
    
    const totalIntegrationServices = integrationServices.length;
    const totalInstances = integrationServices.reduce((sum, service) => sum + service.stats.total, 0);
    const fkpInstances = integrationServices.reduce((sum, service) => sum + service.stats.fkp, 0);
    const instanceAdoptionPercent = totalInstances > 0 ? (fkpInstances / totalInstances) * 100 : 0;
    
    console.log('🔧 DEBUG Metrics:', {
        totalServices: totalIntegrationServices,
        totalInstances: totalInstances,
        fkpInstances: fkpInstances,
        adoptionPercent: instanceAdoptionPercent
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
                <div class="metric-card instance-adoption">
                    <div class="metric-value">${instanceAdoptionPercent.toFixed(1)}%</div>
                    <div class="metric-label">Instance Adoption</div>
                    <div class="metric-subtitle">${fkpInstances.toLocaleString()}/${totalInstances.toLocaleString()} instances</div>
                </div>
            </div>
        </div>
    `;
    
    metricsContainer.innerHTML = html;
    console.log('🔧 DEBUG: Metrics container after innerHTML:', metricsContainer);
    console.log('🔧 DEBUG: Metrics container children.length:', metricsContainer.children.length);
    console.log('🔧 DEBUG: Metrics container visibility:', window.getComputedStyle(metricsContainer).display);
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
    console.log('🔧 DEBUG Integration Table: Found', integrationServices.length, 'filtered integration services');
    
    if (integrationServices.length === 0) {
        console.log('🔧 DEBUG: No integration services found, showing empty state');
        console.log('🔧 DEBUG: Total integration services in data:', fkpDashboard.data.processed?.integrationServices?.size || 0);
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
                        <th>Instance Adoption %</th>
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
                        const instanceAdoption = service.stats.total > 0 ? 
                            (service.stats.fkp / service.stats.total) * 100 : 0;
                        
                        return `
                            <tr onclick="showServiceDetails('${service.name}')">
                                <td class="service-name-col">
                                    <strong>${service.name}</strong>
                                </td>
                                <td>
                                    <span class="adoption-percent">${instanceAdoption.toFixed(1)}%</span>
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
    console.log('🔧 DEBUG: tableContainer after innerHTML:', tableContainer);
    console.log('🔧 DEBUG: tableContainer.children.length:', tableContainer.children.length);
    console.log('🔧 DEBUG: tableContainer visibility:', window.getComputedStyle(tableContainer).display);
}

/**
 * Get filtered integration services based on current filters
 */
function getFilteredIntegrationServices() {
    if (!fkpDashboard.data.processed || !fkpDashboard.data.processed.integrationServices) {
        console.log('🔧 DEBUG Filter: No integration services data available');
        return [];
    }
    
    const filters = fkpDashboard.filters;
    const allIntegrationServices = Array.from(fkpDashboard.data.processed.integrationServices.values());
    
    console.log('🔧 DEBUG Filter: Starting with', allIntegrationServices.length, 'integration services');
    console.log('🔧 DEBUG Filter: Current filters:', filters);
    
    const filteredServices = allIntegrationServices.filter(service => {
        console.log(`🔧 DEBUG Filter: Checking service ${service.name}:`, {
            orgLeader: service.orgLeader,
            parentCloud: service.parentCloud,
            cloud: service.cloud,
            team: service.team,
            stats: service.stats
        });
        
        // For integration services, only apply basic filters (substrate, customerType, instanceEnv)
        // Skip organizational filters (orgLeader, parentCloud, cloud, team, service) since these are in a dedicated tab
        
        if (filters.substrate.length > 0 && !filters.substrate.includes('AWS')) {
            console.log(`🔧 DEBUG Filter: ${service.name} filtered out by substrate`);
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
                console.log(`🔧 DEBUG Filter: ${service.name} filtered out by customerType (${filters.customerType}) - stats:`, {
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
                console.log(`🔧 DEBUG Filter: ${service.name} filtered out by instanceEnv (${filters.instanceEnv}) - stats:`, {
                    prod: service.stats.prod,
                    preProd: service.stats.preProd
                });
                return false;
            }
        }
        
        console.log(`🔧 DEBUG Filter: ✅ ${service.name} passed all filters (integration services use permissive filtering)`);
        return true;
    });
    
    console.log(`🔧 DEBUG Filter: Final result: ${filteredServices.length} services passed filtering`);
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

/**
 * Get filtered services for Migration Pipeline (respects substrate, customer type, instance env)
 */
function getFilteredServicesForMigrationPipeline() {
    const processed = fkpDashboard.data.processed;
    const filters = fkpDashboard.filters;
    
    const filteredServices = [];
    
    processed.services.forEach(service => {
        // Check if service has instances matching customer type and environment filters
        const relevantInstances = service.instances.filter(instance => {
            const matchesCustomerType = filters.customerType.includes(instance.customerType);
            const matchesEnv = filters.instanceEnv.includes(instance.isProd ? 'Prod' : 'Pre-Prod');
            return matchesCustomerType && matchesEnv;
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

console.log('✅ FKP Dashboard JavaScript loaded and ready');
console.log('🔗 Global functions registered for HTML access');
