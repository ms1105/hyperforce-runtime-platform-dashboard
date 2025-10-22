// 🚀 Service Adoption Dashboard v2 - Core JavaScript

console.log('🚀 Dashboard v2 JavaScript loaded');

class ServiceDashboard {
    constructor() {
        this.data = {
            commercial: null,
            govcloud: null,
            blackjack: null,
            mapping: null,
            crossEnvironment: null
        };
        this.init();
    }

    async init() {
        console.log('🚀 Initializing Service Adoption Dashboard v2');
        try {
            await this.loadData();
            this.setupClickHandlers();
            this.renderDashboard();
            console.log('✅ Dashboard initialized successfully');
        } catch (error) {
            console.error('❌ Dashboard initialization failed:', error);
            this.showError('Failed to load dashboard data');
        }
    }

    async loadData() {
        console.log('📊 Loading data files...');
        const dataFiles = {
            commercial: 'assets/data/service_instance_on_fkp.csv',
            govcloud: 'assets/data/service_instance_on_fkp_gov.csv',
            blackjack: 'assets/data/blackjack_adoption_data.csv',
            commercialBom: 'assets/data/bom_extra_services.csv',
            govcloudBom: 'assets/data/govcloud_bom_extra_services.csv',
            mapping: 'assets/data/service_cloud_mapping_utf8.csv',
            crossEnvironment: 'assets/data/cross_environment_analysis_20250918_103222.csv'
        };

        for (const [key, file] of Object.entries(dataFiles)) {
            try {
                console.log(`🔄 Loading ${key} from ${file}`);
                const response = await fetch(file);
                if (!response.ok) {
                    console.warn(`⚠️ Could not load ${key} data: ${response.status}`);
                    this.data[key] = [];
                    continue;
                }
                const text = await response.text();
                console.log(`📄 ${key} file size: ${text.length} characters`);
                console.log(`📄 ${key} first 200 chars:`, text.substring(0, 200));
                
                this.data[key] = this.parseCSV(text);
                console.log(`✅ Loaded ${key} data: ${this.data[key].length} records`);
                
                if (this.data[key].length > 0) {
                    console.log(`📋 ${key} sample record:`, this.data[key][0]);
                }
            } catch (error) {
                console.warn(`⚠️ Could not load ${key} data:`, error);
                this.data[key] = [];
            }
        }
        
        console.log('🎯 Final data summary:', {
            commercial: this.data.commercial?.length || 0,
            govcloud: this.data.govcloud?.length || 0,
            blackjack: this.data.blackjack?.length || 0,
            mapping: this.data.mapping?.length || 0
        });
    }

    parseCSV(text) {
        const lines = text.trim().split('\n');
        if (lines.length < 2) return [];
        
        const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
        
        return lines.slice(1).map(line => {
            const values = this.parseCSVLine(line);
            const row = {};
            headers.forEach((header, index) => {
                let value = values[index] || '';
                // Try to convert to number if it looks like a number
                if (value && !isNaN(value) && !isNaN(parseFloat(value))) {
                    value = parseFloat(value);
                }
                row[header] = value;
            });
            return row;
        });
    }

    parseCSVLine(line) {
        const result = [];
        let current = '';
        let inQuotes = false;
        
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                result.push(current.trim().replace(/"/g, ''));
                current = '';
            } else {
                current += char;
            }
        }
        result.push(current.trim().replace(/"/g, ''));
        return result;
    }

    renderDashboard() {
        const overviewContainer = document.getElementById('overviewCards');
        const tableBody = document.getElementById('mainTableBody');
        const resultsCount = document.getElementById('resultsCount');
        const orgLeaderContainer = document.getElementById('orgLeaderDashboard');

        if (overviewContainer) {
            this.renderOverviewCards(overviewContainer);
        }
        
        if (orgLeaderContainer) {
            this.renderOrgLeaderDashboard(orgLeaderContainer);
        }
        
        if (tableBody && this.data.crossEnvironment) {
            this.renderCrossEnvironmentTable(tableBody);
        }
        
        if (resultsCount && this.data.crossEnvironment) {
            resultsCount.textContent = `Showing ${this.data.crossEnvironment.length} services`;
        }
    }

    renderOverviewCards(container) {
        const environments = {
            commercial: { name: 'Commercial', icon: '🌐', color: '#3498db' },
            govcloud: { name: 'GovCloud', icon: '🏛️', color: '#27ae60' },
            blackjack: { name: 'BlackJack', icon: '⚡', color: '#f39c12' }
        };

        const cards = Object.entries(environments).map(([key, env]) => {
            const data = this.data[key] || [];
            let totalServices = data.length;
            let totalInstances = 0;
            let fkpInstances = 0;
            
            if (key === 'blackjack') {
                // BlackJack has different field names
                data.forEach(row => {
                    totalInstances += parseInt(row['Total Instances (FKP+EKS)'] || 0);
                    fkpInstances += parseInt(row['Total Instances on FKP'] || 0);
                });
            } else {
                // Commercial and GovCloud
                data.forEach(row => {
                    const prodInstances = parseInt(row.prod_instance_count || 0);
                    const prodFkp = parseInt(row.prod_migration || 0);
                    if (prodInstances > 0) { // Only count services with production instances
                        totalInstances += prodInstances;
                        fkpInstances += prodFkp;
                    }
                });
                // Adjust service count to only include services with prod instances
                totalServices = data.filter(row => parseInt(row.prod_instance_count || 0) > 0).length;
            }
            
            const adoptionRate = totalInstances > 0 ? ((fkpInstances / totalInstances) * 100).toFixed(1) : 0;

            return `
                <div class="overview-card fade-in" data-environment="${key}" style="border-left: 4px solid ${env.color}; cursor: pointer;" onclick="window.location.href='${key}.html'">
                    <div class="card-header">
                        <h3 class="card-title">${env.name}</h3>
                        <span class="card-icon">${env.icon}</span>
                    </div>
                    <div class="card-metrics">
                        <div class="metric">
                            <span class="metric-value">${totalServices.toLocaleString()}</span>
                            <div class="metric-label">Services</div>
                        </div>
                        <div class="metric">
                            <span class="metric-value">${totalInstances.toLocaleString()}</span>
                            <div class="metric-label">Total Instances</div>
                        </div>
                        <div class="metric">
                            <span class="metric-value">${fkpInstances.toLocaleString()}</span>
                            <div class="metric-label">FKP Instances</div>
                        </div>
                        <div class="metric">
                            <span class="metric-value">${adoptionRate}%</span>
                            <div class="metric-label">Adoption Rate</div>
                            <div class="adoption-bar">
                                <div class="adoption-progress" style="width: ${adoptionRate}%"></div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        container.innerHTML = cards;
    }

    renderCrossEnvironmentTable(tbody) {
        if (!this.data.crossEnvironment || this.data.crossEnvironment.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; color: #666;">No cross-environment data available</td></tr>';
            return;
        }

        const rows = this.data.crossEnvironment.slice(0, 50).map(row => `
            <tr>
                <td>
                    <span class="service-link clickable">${row.service_name || 'N/A'}</span>
                </td>
                <td>
                    <span class="parent-cloud-link clickable">${row.parent_cloud || 'N/A'}</span>
                </td>
                <td>${(row.commercial_prod_instances || 0).toLocaleString()}</td>
                <td>${(row.commercial_fkp_instances || 0).toLocaleString()}</td>
                <td>
                    <span class="status-badge ${this.getAdoptionStatus(row.commercial_adoption_rate)}">
                        ${(row.commercial_adoption_rate || 0).toFixed(1)}%
                    </span>
                </td>
                <td>${(row.govcloud_prod_instances || 0).toLocaleString()}</td>
                <td>${(row.govcloud_fkp_instances || 0).toLocaleString()}</td>
                <td>
                    <span class="status-badge ${this.getAdoptionStatus(row.govcloud_adoption_rate)}">
                        ${(row.govcloud_adoption_rate || 0).toFixed(1)}%
                    </span>
                </td>
            </tr>
        `).join('');

        tbody.innerHTML = rows;
    }

    getAdoptionStatus(rate) {
        if (rate >= 70) return 'status-high';
        if (rate >= 30) return 'status-medium';
        return 'status-low';
    }

    renderOrgLeaderDashboard(container) {
        console.log('📊 Rendering Org Leader Dashboard...');
        
        // Process org leader data
        const orgLeaderData = this.processOrgLeaderData();
        const migrationStages = this.processMigrationStages();
        const predictiveData = this.processPredictiveAnalytics(orgLeaderData);
        
        container.innerHTML = `
            <div class="org-leader-dashboard">
                <div class="dashboard-section">
                    <h3>👥 Org Leader Performance</h3>
                    <div class="org-leader-table-container">
                        ${this.renderOrgLeaderTable(orgLeaderData)}
                    </div>
                </div>
                
                <div class="dashboard-section">
                    <h3>🎯 Migration Stages Overview</h3>
                    <div class="migration-stages-container">
                        ${this.renderMigrationStagesChart(migrationStages)}
                    </div>
                </div>
                
                <div class="dashboard-section">
                    <h3>🔮 Adoption Forecast</h3>
                    <div class="predictive-container">
                        ${this.renderPredictiveAnalytics(predictiveData)}
                    </div>
                </div>
            </div>
        `;
    }

    processOrgLeaderData() {
        console.log('🔄 Processing org leader data...');
        const orgLeaderMap = new Map();
        let processedServices = 0;
        let matchedCommercial = 0;
        let matchedGovcloud = 0;
        let matchedBlackjack = 0;
        
        // First, get all unique services from all CSV files
        const allServices = new Set();
        
        // Add services from commercial data
        if (this.data.commercial) {
            this.data.commercial.forEach(service => {
                if (service.servicename && !this.isUnknownService(service.servicename)) {
                    allServices.add(service.servicename);
                }
            });
        }
        
        // Add services from govcloud data
        if (this.data.govcloud) {
            this.data.govcloud.forEach(service => {
                if (service.servicename && !this.isUnknownService(service.servicename)) {
                    allServices.add(service.servicename);
                }
            });
        }
        
        // Add services from blackjack data
        if (this.data.blackjack) {
            this.data.blackjack.forEach(service => {
                if (service.ServiceName && !this.isUnknownService(service.ServiceName)) {
                    allServices.add(service.ServiceName);
                }
            });
        }
        
        console.log(`📊 Found ${allServices.size} total unique services across all environments`);
        
        // Process mapping data to get org structure
        if (this.data.mapping) {
            this.data.mapping.forEach((row, index) => {
                const orgLeader = row.asl_manager_name || row.manager || 'Unknown';
                const parentCloud = row.parent_cloud || 'Unknown';
                const cloud = row.cloud_name || row.cloud || 'Unknown';
                const service = row.mr_servicename || row.servicename || row.service_name;
                
                if (!service || !allServices.has(service)) {
                    return; // Skip if service not found in any CSV or is unknown
                }
                
                processedServices++;
                
                if (!orgLeaderMap.has(orgLeader)) {
                    orgLeaderMap.set(orgLeader, {
                        name: orgLeader,
                        parentClouds: new Set(),
                        clouds: new Set(),
                        services: new Set(),
                        commercial: { totalServices: 0, prodInstances: 0, fkpInstances: 0 },
                        govcloud: { totalServices: 0, prodInstances: 0, fkpInstances: 0 },
                        blackjack: { totalServices: 0, prodInstances: 0, fkpInstances: 0 }
                    });
                }
                
                const orgData = orgLeaderMap.get(orgLeader);
                
                // Add the service to org leader's service set (regardless of production instances)
                orgData.services.add(service);
                
                // Check each environment and count production instances
                let hasProductionInstances = false;
                
                // Check commercial data
                const commService = this.data.commercial?.find(s => s.servicename === service);
                if (commService) {
                    orgData.commercial.totalServices++;
                    const prodInstances = parseInt(commService.prod_instance_count) || 0;
                    orgData.commercial.prodInstances += prodInstances;
                    orgData.commercial.fkpInstances += parseInt(commService.prod_migration) || 0;
                    matchedCommercial++;
                    if (prodInstances > 0) hasProductionInstances = true;
                }
                
                // Check govcloud data
                const govService = this.data.govcloud?.find(s => s.servicename === service);
                if (govService) {
                    orgData.govcloud.totalServices++;
                    const prodInstances = parseInt(govService.prod_instance_count) || 0;
                    orgData.govcloud.prodInstances += prodInstances;
                    orgData.govcloud.fkpInstances += parseInt(govService.prod_migration) || 0;
                    matchedGovcloud++;
                    if (prodInstances > 0) hasProductionInstances = true;
                }
                
                // Check blackjack data
                const bjService = this.data.blackjack?.find(s => s.ServiceName === service);
                if (bjService) {
                    orgData.blackjack.totalServices++;
                    const totalInstances = parseInt(bjService['Total Instances (FKP+EKS)']) || 0;
                    orgData.blackjack.prodInstances += totalInstances;
                    orgData.blackjack.fkpInstances += parseInt(bjService['Total Instances on FKP']) || 0;
                    matchedBlackjack++;
                    if (totalInstances > 0) hasProductionInstances = true;
                }
                
                // Add parent clouds and clouds (regardless of production instances, since service exists in CSV)
                if (parentCloud.toLowerCase() !== 'unknown') {
                    orgData.parentClouds.add(parentCloud);
                }
                if (cloud.toLowerCase() !== 'unknown') {
                    orgData.clouds.add(cloud);
                }
            });
        }
        
        console.log(`🎯 Org Leader Processing Summary:
            📊 Processed ${processedServices} services from mapping
            🌐 Matched ${matchedCommercial} commercial services  
            🏛️ Matched ${matchedGovcloud} govcloud services
            ⚡ Matched ${matchedBlackjack} blackjack services
            👥 Created ${orgLeaderMap.size} org leaders`);
        
        const result = Array.from(orgLeaderMap.values())
            .filter(org => {
                // Include org leaders who have at least one service (that exists in CSV files)
                const hasServices = org.services.size > 0;
                const isNotUnknown = org.name !== 'Unknown';
                return hasServices && isNotUnknown;
            })
            .sort((a, b) => (b.commercial.prodInstances + b.govcloud.prodInstances + b.blackjack.prodInstances) - 
                             (a.commercial.prodInstances + a.govcloud.prodInstances + a.blackjack.prodInstances));
                             
        console.log(`✅ Filtered org leaders: ${orgLeaderMap.size} total -> ${result.length} with services`);
        console.log(`📋 Top 3 Org Leaders:`, result.slice(0, 3).map(org => ({
            name: org.name,
            totalServices: org.services.size,
            commercial: org.commercial.totalServices,
            govcloud: org.govcloud.totalServices,
            blackjack: org.blackjack.totalServices
        })));
        
        return result;
    }

    isUnknownService(serviceName) {
        if (!serviceName) return true;
        const name = serviceName.toLowerCase().trim();
        return name === 'unknown' || 
               name === '' || 
               name.includes('unknown') ||
               name === 'n/a' ||
               name === 'null' ||
               name === 'undefined';
    }

    processMigrationStages() {
        const stages = {
            'Not Started': 0,
            'Dev Engaged': 0,
            'Prod In Progress': 0,
            'Prod Complete': 0,
            'Mesh Ready': 0
        };
        
        // Classify services based on their adoption data
        if (this.data.commercial) {
            this.data.commercial.forEach(service => {
                const prodInstances = parseInt(service.prod_instance_count) || 0;
                const prodFkp = parseInt(service.prod_migration) || 0;
                const nonprodFkp = parseInt(service.nonprod_migration) || 0;
                
                if (prodInstances === 0 && nonprodFkp === 0) {
                    stages['Not Started']++;
                } else if (nonprodFkp > 0 && prodFkp === 0) {
                    stages['Dev Engaged']++;
                } else if (prodFkp > 0 && prodFkp < prodInstances) {
                    stages['Prod In Progress']++;
                } else if (prodFkp === prodInstances && prodInstances > 0) {
                    stages['Prod Complete']++;
                }
            });
        }
        
        return stages;
    }

    processPredictiveAnalytics(orgLeaderData) {
        // Simple trend analysis based on current adoption rates
        const currentQuarter = new Date().getMonth() < 3 ? 'Q1' : 
                              new Date().getMonth() < 6 ? 'Q2' : 
                              new Date().getMonth() < 9 ? 'Q3' : 'Q4';
        
        const totalInstances = orgLeaderData.reduce((sum, org) => 
            sum + org.commercial.prodInstances + org.govcloud.prodInstances + org.blackjack.prodInstances, 0);
        const totalFkp = orgLeaderData.reduce((sum, org) => 
            sum + org.commercial.fkpInstances + org.govcloud.fkpInstances + org.blackjack.fkpInstances, 0);
        
        const currentAdoption = totalInstances > 0 ? (totalFkp / totalInstances) * 100 : 0;
        
        // Simple projection (assuming 5% quarterly growth)
        const nextQuarter = Math.min(100, currentAdoption + 5);
        const nextYear = Math.min(100, currentAdoption + 20);
        
        return {
            currentQuarter,
            currentAdoption: currentAdoption.toFixed(1),
            nextQuarter: nextQuarter.toFixed(1),
            nextYear: nextYear.toFixed(1),
            totalServices: orgLeaderData.reduce((sum, org) => sum + org.services.size, 0),
            totalInstances,
            totalFkp
        };
    }

    renderOrgLeaderTable(orgLeaderData) {
        const rows = orgLeaderData.map(org => {
            const totalInstances = org.commercial.prodInstances + org.govcloud.prodInstances + org.blackjack.prodInstances;
            const totalFkp = org.commercial.fkpInstances + org.govcloud.fkpInstances + org.blackjack.fkpInstances;
            const adoptionRate = totalInstances > 0 ? ((totalFkp / totalInstances) * 100).toFixed(1) : 0;
            
            return `
                <tr class="org-leader-row" data-org-leader="${org.name}">
                    <td class="clickable org-leader-name">${org.name}</td>
                    <td>${org.parentClouds.size}</td>
                    <td>${org.services.size}</td>
                    <td class="clickable" data-env="commercial">${org.commercial.totalServices}</td>
                    <td class="clickable" data-env="govcloud">${org.govcloud.totalServices}</td>
                    <td class="clickable" data-env="blackjack">${org.blackjack.totalServices}</td>
                    <td>${totalInstances.toLocaleString()}</td>
                    <td>${totalFkp.toLocaleString()}</td>
                    <td><span class="status-badge ${this.getAdoptionStatus(adoptionRate)}">${adoptionRate}%</span></td>
                </tr>
            `;
        }).join('');
        
        return `
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Org Leader</th>
                        <th>Parent Clouds</th>
                        <th>Total Services</th>
                        <th>Commercial</th>
                        <th>GovCloud</th>
                        <th>BlackJack</th>
                        <th>Total Instances</th>
                        <th>FKP Instances</th>
                        <th>Adoption Rate</th>
                    </tr>
                </thead>
                <tbody>
                    ${rows}
                </tbody>
            </table>
        `;
    }

    renderMigrationStagesChart(stages) {
        const total = Object.values(stages).reduce((sum, count) => sum + count, 0);
        const stageColors = {
            'Not Started': '#95a5a6',
            'Dev Engaged': '#f39c12',
            'Prod In Progress': '#3498db',
            'Prod Complete': '#27ae60',
            'Mesh Ready': '#8e44ad'
        };
        
        const bars = Object.entries(stages).map(([stage, count]) => {
            const percentage = total > 0 ? (count / total) * 100 : 0;
            return `
                <div class="stage-bar">
                    <div class="stage-label">${stage}</div>
                    <div class="stage-progress" style="background: ${stageColors[stage]}">
                        <div class="stage-fill" style="width: ${percentage}%"></div>
                        <span class="stage-count">${count} (${percentage.toFixed(1)}%)</span>
                    </div>
                </div>
            `;
        }).join('');
        
        return `<div class="migration-stages">${bars}</div>`;
    }

    renderPredictiveAnalytics(predictiveData) {
        return `
            <div class="predictive-grid">
                <div class="prediction-card">
                    <h4>📊 Current ${predictiveData.currentQuarter}</h4>
                    <div class="prediction-value">${predictiveData.currentAdoption}%</div>
                    <div class="prediction-label">Adoption Rate</div>
                </div>
                <div class="prediction-card">
                    <h4>📈 Next Quarter</h4>
                    <div class="prediction-value">${predictiveData.nextQuarter}%</div>
                    <div class="prediction-label">Projected</div>
                </div>
                <div class="prediction-card">
                    <h4>🎯 Next Year</h4>
                    <div class="prediction-value">${predictiveData.nextYear}%</div>
                    <div class="prediction-label">Target</div>
                </div>
                <div class="prediction-card">
                    <h4>🚀 Total Progress</h4>
                    <div class="prediction-value">${predictiveData.totalFkp.toLocaleString()}</div>
                    <div class="prediction-label">of ${predictiveData.totalInstances.toLocaleString()} instances</div>
                </div>
            </div>
        `;
    }

    showError(message) {
        const container = document.getElementById('overviewCards') || document.body;
        container.innerHTML = `
            <div style="text-align: center; padding: 2rem; color: #e74c3c; background: white; border-radius: 8px;">
                <h3>⚠️ Error</h3>
                <p>${message}</p>
                <p style="margin-top: 1rem;"><a href="http://localhost:8000" target="_blank">Use the working dashboard on port 8000</a></p>
            </div>
        `;
    }

    setupClickHandlers() {
        // Add event delegation for dynamic content
        document.addEventListener('click', (e) => {
            // Org Leader name clicks - drill down to org leader details
            if (e.target.classList.contains('org-leader-name')) {
                const orgLeader = e.target.closest('.org-leader-row').dataset.orgLeader;
                this.drillDownToOrgLeader(orgLeader);
            }
            
            // Environment cell clicks - drill down to specific environment
            if (e.target.dataset.env) {
                const orgLeader = e.target.closest('.org-leader-row').dataset.orgLeader;
                const environment = e.target.dataset.env;
                this.drillDownToEnvironment(environment, orgLeader);
            }
            
            // Service name clicks - show service details
            if (e.target.classList.contains('service-link')) {
                const serviceName = e.target.textContent;
                this.showServiceDetails(serviceName);
            }
            
            // Parent cloud clicks - filter by parent cloud
            if (e.target.classList.contains('parent-cloud-link')) {
                const parentCloud = e.target.textContent;
                this.filterByParentCloud(parentCloud);
            }
        });
    }

    drillDownToOrgLeader(orgLeader) {
        console.log(`🎯 Drilling down to org leader: ${orgLeader}`);
        // Store the filter and redirect to a detailed view
        localStorage.setItem('dashboardFilter', JSON.stringify({
            type: 'orgLeader',
            value: orgLeader,
            timestamp: Date.now()
        }));
        
        // For now, show an alert with the action
        alert(`🎯 Drilling down to ${orgLeader}\n\nThis will navigate to a detailed org leader view with:\n• All services under ${orgLeader}\n• Cross-environment breakdown\n• Migration progress tracking\n• Service-level insights`);
    }

    drillDownToEnvironment(environment, orgLeader = null) {
        console.log(`🌐 Drilling down to ${environment} environment for ${orgLeader || 'all orgs'}`);
        
        // Store the filter state
        const filter = {
            type: 'environment',
            environment: environment,
            orgLeader: orgLeader,
            timestamp: Date.now()
        };
        localStorage.setItem('dashboardFilter', JSON.stringify(filter));
        
        // Navigate to the specific environment page
        const params = new URLSearchParams();
        if (orgLeader) params.set('orgLeader', orgLeader);
        
        window.location.href = `${environment}.html${params.toString() ? '?' + params.toString() : ''}`;
    }

    showServiceDetails(serviceName) {
        console.log(`🔍 Showing details for service: ${serviceName}`);
        
        // Find service across all environments
        const serviceDetails = this.getServiceAcrossEnvironments(serviceName);
        
        // Show detailed modal or navigate to service page
        alert(`🔍 Service Details: ${serviceName}\n\n${JSON.stringify(serviceDetails, null, 2)}`);
    }

    getServiceAcrossEnvironments(serviceName) {
        const details = {
            name: serviceName,
            commercial: null,
            govcloud: null,
            blackjack: null,
            mapping: null
        };
        
        // Find in commercial
        details.commercial = this.data.commercial?.find(s => s.servicename === serviceName);
        
        // Find in govcloud  
        details.govcloud = this.data.govcloud?.find(s => s.servicename === serviceName);
        
        // Find in blackjack
        details.blackjack = this.data.blackjack?.find(s => s.ServiceName === serviceName);
        
        // Find mapping
        details.mapping = this.data.mapping?.find(s => s.servicename === serviceName);
        
        return details;
    }

    filterByParentCloud(parentCloud) {
        console.log(`🔍 Filtering by parent cloud: ${parentCloud}`);
        const filterSelect = document.getElementById('parentCloudFilter');
        if (filterSelect) {
            filterSelect.value = parentCloud;
            // Trigger change event to update table
            filterSelect.dispatchEvent(new Event('change'));
        }
    }
}

// 🚀 Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.dashboard = new ServiceDashboard();
});

console.log('📊 Dashboard v2 JavaScript ready');
