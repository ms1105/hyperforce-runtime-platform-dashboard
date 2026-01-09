# Hyperforce Runtime Platform 360 - Cursor Agent Guide

> **Purpose**: This document helps Cursor AI agents quickly understand the project structure, terminology, and working conventions for efficient collaboration.

---

## 🎯 Project Overview

**Hyperforce Runtime Platform 360 (HRP360)** is a comprehensive dashboard that provides visibility into platform performance, availability, and cost optimization across Salesforce's Hyperforce infrastructure.

### Dashboard Sections (Tabs)

| Section | Owner | Description |
|---------|-------|-------------|
| **Onboarding** | Aravinth | FKP/Mesh adoption tracking, migration pipeline, service information |
| **Runtime Scale & Availability** | TBD | HPA adoption, incidents, Multi-AZ, Karpenter |
| **Cost to Serve** | TBD | Platform cost analysis, HCP FKP Addon costs |
| **Self Serve** | TBD | Self-service tools (coming soon) |

---

## 📁 Project Structure

```
hyperforce-runtime-platform-360/
├── index.html                    # Main dashboard HTML (hybrid: vanilla JS + React)
├── assets/
│   ├── css/
│   │   └── fkp-dashboard.css     # Styles for Onboarding tabs
│   ├── data/
│   │   ├── fkp_adoption.csv      # SYMLINK → ../../fkp_adoption.csv (current quarter)
│   │   ├── fkp_adoption_prev_q.csv # Previous quarter data
│   │   ├── blackjack_adoption_normalized.csv # BlackJack (DoD) instances - current
│   │   ├── blackjack_adoption_prev_q_normalized.csv # BlackJack - previous quarter
│   │   ├── service_cloud_mapping_utf8.csv # Service → Org mapping
│   │   ├── mesh_data.csv         # Mesh/mTLS adoption data
│   │   ├── timeline_requirements.csv # Migration ETA and feature dependencies
│   │   ├── unmapped_services.txt # Services without proper mapping
│   │   ├── dashboard-data.json   # Mock/static data for Runtime tabs
│   │   ├── cts-data.json         # Cost to Serve data
│   │   ├── hpa-data.json         # HPA adoption data
│   │   └── incidents-data.json   # Incident data
│   └── js/
│       ├── fkp-dashboard.js      # Onboarding logic (vanilla JS, ~4500 lines)
│       └── react-tabs.js         # Bundled React components
├── src/                          # React source (TypeScript)
│   ├── main.tsx                  # React entry point
│   ├── ReactTabs.tsx             # Tab router for React sections
│   ├── index.css                 # Tailwind styles
│   └── components/
│       ├── RuntimeScaleHPA.tsx   # HPA adoption view
│       ├── IncidentView.tsx      # Incidents & availability
│       ├── HCPCostAnalysis.tsx   # Cost analysis
│       ├── HCPCTSProgram.tsx     # CTS program view
│       └── ...                   # Other React components
├── fkp_adoption.csv              # Root-level data (current quarter)
├── fkp_adoption_prev_q.csv       # Root-level data (previous quarter)
├── package.json                  # Node dependencies
├── vite.config.ts                # Vite build configuration
└── tailwind.config.js            # Tailwind CSS config
```

---

## 🔑 Key Terminology & Concepts

### Infrastructure Terms

| Term | Definition |
|------|------------|
| **FKP** | Falcon Kubernetes Platform - Salesforce's managed Kubernetes platform |
| **Mesh** | Service mesh (mTLS) - secure service-to-service communication |
| **EKS** | Amazon Elastic Kubernetes Service (non-FKP) |
| **HCP** | Hyperforce Control Plane |
| **HRP** | Hyperforce Runtime Platform |

### Customer Types

| Type | Description |
|------|-------------|
| **Commercial** | Standard Salesforce commercial cloud |
| **GIA** (GovCloud) | Government cloud (FedRAMP) - cluster contains "gia2h" |
| **BlackJack** | DoD (Department of Defense) cloud - highest security tier |

### FKP Detection Logic

An instance is considered **FKP** if its cluster name contains `"sam"` (case-insensitive):
```javascript
const isFKP = clusterName.toLowerCase().includes('sam');
```

### Production Detection

An instance is **Production** if its cluster name does NOT contain common non-prod patterns:
```javascript
const isProduction = !clusterName.match(/dev|stg|test|perf|preprod|sandbox|pilot/i);
```

### Migration Stages (6 Stages)

| Stage | Name | Criteria |
|-------|------|----------|
| 1 | Not Started | No FKP instances at all |
| 2 | Pre-Prod Progress | Has FKP pre-prod only, no prod FKP |
| 3 | Parity Required | Has parity requirements blocking migration |
| 4 | Prod Progress | Some prod instances on FKP, but not all |
| 5 | Prod Complete | All prod instances on FKP |
| 6 | Mesh Complete | All prod on FKP AND has mesh/mTLS enabled |

### Integration Services

These services are **excluded from adoption metrics** (they're platform infrastructure, not customer workloads):
```javascript
const INTEGRATION_SERVICES = [
    'stampy-webhook', 'madkub-watchdog', 'collection', 'madkub-injection-webhook',
    'collectioninjector', 'metadata-concealer', 'identity-controller-refresher', 
    'identity-controller', 'clustermanagement', 'collectioninjectortest', 
    'visibility-agent', 'vault', 'mars', 'authzwebhook', 'kubesyntheticscaler',
    'identitycontrollertest'
];
```

### Excluded Services

Services always excluded from all calculations:
```javascript
const EXCLUDED_SERVICES = ['unknown'];
```

---

## 🏗️ Architecture

### Hybrid Approach

The dashboard uses a **hybrid architecture**:

1. **Onboarding Section** → Vanilla JavaScript (`fkp-dashboard.js`)
   - Handles all FKP adoption, migration pipeline, service information tabs
   - Manages global state via `fkpDashboard` object
   - Loads CSV data files directly

2. **Other Sections** → React + TypeScript (`src/`)
   - Runtime, Cost, Self-Serve tabs are React components
   - Bundled with Vite → `assets/js/react-tabs.js`
   - Uses Tailwind CSS for styling

### Tab Communication

React tabs communicate with the vanilla JS sidebar via:
```javascript
window.updateReactTab = (tabId) => { ... };
```

### Global State (`fkpDashboard`)

```javascript
fkpDashboard = {
    data: {
        instances: [],           // Current quarter raw data
        instancesPrevQ: [],      // Previous quarter raw data
        blackjackInstances: [],  // BlackJack current
        blackjackInstancesPrevQ: [], // BlackJack previous
        mappings: [],            // Service → Org mapping
        meshServices: [],        // Mesh adoption data
        timelineRequirements: [], // ETA/dependencies
        processed: {
            services: new Map(),      // Processed service data
            integrationServices: new Map()
        }
    },
    filters: {
        substrate: ['AWS'],
        orgLeader: [],
        customerType: ['Commercial', 'GIA', 'BlackJack'],
        instanceEnv: ['Prod'],
        'migration-stage': [...] // All 6 stages
    },
    state: {
        currentTab: 'executive-overview',
        activeDropdown: null,
        dropdownSelectionMode: false
    }
};
```

---

## ⚙️ Key Functions (fkp-dashboard.js)

| Function | Purpose |
|----------|---------|
| `initializeFKPDashboard()` | Main entry point, loads all data |
| `processData()` | Transforms raw CSV into service-level stats |
| `classifyInstance(cluster)` | Determines FKP, Prod, customer type from cluster name |
| `calculateServiceMigrationStageNumber(service)` | Assigns 1-6 migration stage |
| `getFilteredServicesForServiceInfo()` | Applies all active filters for Service Info tab |
| `getFilteredServicesForMigrationPipeline()` | Filters for Migration Pipeline (always includes all envs) |
| `calculateGrowthProjections()` | Calculates next quarter growth based on timeline_requirements.csv |
| `handleFilterChange()` | Manages filter updates with debouncing for multi-select UX |
| `renderServiceInformationMetrics()` | Renders metrics cards for Service Information tab |

---

## 📊 Data Flow

```
CSV Files (assets/data/)
         ↓
    loadDataFiles()
         ↓
    processData() → fkpDashboard.data.processed.services
         ↓
    getFilteredServices*() → Apply active filters
         ↓
    render*() → Update DOM with filtered data
```

---

## 🔧 Working Conventions

### Before Making Changes

1. **ALWAYS ask clarifying questions** before executing any changes
2. Read relevant files to understand existing patterns
3. Check for existing functions that might already do what's needed
4. Understand the data flow for the area you're modifying

### When Modifying Code

1. **Match existing code style** - use same indentation, naming conventions
2. **Add console.log for debugging** - prefix with emojis for visibility:
   - `📊` for data/metrics
   - `🔄` for updates/refresh
   - `⚠️` for warnings
   - `❌` for errors
   - `✅` for success
3. **Test incrementally** - verify changes work before moving to next step
4. **Preserve filter state** - multi-select filters need debounced updates

### Common Pitfalls

| Issue | Solution |
|-------|----------|
| Filter dropdown closes during multi-select | Use `dropdownSelectionMode` flag and debounce updates |
| Inconsistent metrics between tabs | Use same filtering logic, call shared helper functions |
| Services showing as unmapped incorrectly | Check raw mapping data, not processed data with defaults |
| Growth projections not matching filters | Ensure `calculateGrowthProjections()` uses filtered service list |

---

## 🚀 Running Locally

```bash
# Simple HTTP server (for testing Onboarding tabs)
python3 -m http.server 8005

# Full development with React (if modifying React tabs)
npm install
npm run dev
```

Access at: `http://localhost:8005` (or Vite's port for dev mode)

---

## 📝 Data File Formats

### fkp_adoption.csv
```csv
cluster_name,service_name,namespace,instance_count
sam-prod-useast1-cluster,my-service,default,5
```

### service_cloud_mapping_utf8.csv
```csv
Service Name,Org Leader,Parent Cloud,Cloud,Team
my-service,John Doe,Platform Cloud,Infrastructure,Platform Team
```

### timeline_requirements.csv
```csv
Service Name,Commercial ETA,Gia2h ETA,BlackJack ETA,Feature Dependencies
my-service,FY26Q2,FY26Q3,TBD,ARM support
```

---

## 📞 Contact

- **Onboarding Section**: Aravinth
- **Original Dashboard**: Forked from Service-Adoption-Dashboard-v2

---

*Last Updated: December 2024*

