# Hyperforce Runtime Platform 360 - Cursor Agent Guide

> **Purpose**: This document helps Cursor AI agents quickly understand the project structure, terminology, and working conventions for efficient collaboration.

---

## 🎯 Project Overview

**Hyperforce Runtime Platform 360 (HRP360)** is a comprehensive dashboard that provides visibility into platform performance, availability, and cost optimization across Salesforce's Hyperforce infrastructure.

### Dashboard Sections (Tabs)

| Section | Owner | Description |
|---------|-------|-------------|
| **Executive Summary** | Aravinth | Consolidated KPIs across Availability, Scale, CTS, Onboarding |
| **Runtime Availability** | TBD | Availability exec scorecard + dev views |
| **Runtime Scale** | TBD | HPA adoption, Karpenter |
| **Cost to Serve** | TBD | Platform cost analysis, HCP savings |
| **Onboarding** | Aravinth | FKP/Mesh adoption tracking, migration pipeline, projections & roadmap, service information |

### Onboarding Tabs
| Tab ID | Name | View Mode | Description |
|--------|------|-----------|-------------|
| `executive-overview` | Overview | Exec | High-level adoption metrics, roadmap timeline |
| `migration-pipeline` | Migration Pipeline | Exec | 6-stage migration cross-tab |
| `projections-roadmap` | Projections & Roadmap | Exec | Adoption projections FY26Q3→FY27Q4 |
| `service-information` | Overview | Developer | Detailed service table with filters |
| `migration-dependencies` | Migration Dependencies | Developer | Feature requirements analysis |
| `cross-customer-analysis` | COGS Analysis | Developer | Cross-customer cost analysis |
| `integrations` | Integrations | Developer | Integration services list |

### Executive Summary
- Section-only page (no tab pane) and default landing view
- No Exec/Developer toggle visible on this page
- Sections: Runtime Availability (Detection/Prevention), Runtime Service Standards, Cost to Serve and Budget, Onboarding
- Detection KPIs are split into two rows (Sev0 row + Sev1 row) with shaded backgrounds
- All KPIs have sub-metrics (x/y, SLA targets, or deltas) and larger numeric values
- Click behavior: cards route to their source tabs and scroll to top of the target content
- If clicked from Developer view, page reloads to Exec Summary

### Runtime Availability Tabs
| Tab ID | Name | View Mode | Description |
|--------|------|-----------|-------------|
| `runtime-availability` | Exec Overview | Exec | Availability exec scorecard (incidents2.csv) |
| `runtime-availability-inventory` | HRP Test Inventory | Developer | Test inventory by product/test (first Developer tab) |
| `runtime-availability-readiness` | HRP Test Readiness (Preventive) | Developer | Readiness table + KPIs |

### Runtime Scale Tabs
| Tab ID | Name | View Mode | Description |
|--------|------|-----------|-------------|
| `runtime-overview` | Autoscaling | Exec | HPA adoption metrics |
| `runtime-hpa` | Autoscaling | Developer | HPA table + filters |
| `runtime-karpenter` | Karpenter | Both | Bin-packing efficiency |

---

## 📁 Project Structure

```
hyperforce-runtime-platform-360/
├── index.html                    # Main dashboard HTML (vanilla JS)
├── assets/
│   ├── css/
│   │   └── fkp-dashboard.css     # Styles for all tabs
│   ├── data/
│   │   ├── fkp_adoption.csv      # SYMLINK → ../../fkp_adoption.csv (current quarter)
│   │   ├── fkp_adoption_prev_q.csv # Previous quarter data
│   │   ├── blackjack_adoption_normalized.csv # BlackJack current
│   │   ├── blackjack_adoption_prev_q_normalized.csv # BlackJack previous
│   │   ├── service_cloud_mapping_utf8.csv # Service → Org mapping
│   │   ├── mesh_data.csv         # Mesh/mTLS adoption data
│   │   ├── timeline_requirements.csv # Migration ETA and feature dependencies
│   │   ├── hcp-cts-forecast-actuals.json # CTS forecast vs actuals
│   │   └── availability/         # Availability & test inventory CSVs
│   └── js/
│       ├── fkp-dashboard.js      # Main dashboard logic (vanilla JS)
│       └── cost-to-serve.js      # CTS logic
├── src/                          # Legacy React source (not used for new work)
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

An instance is **Production** if its cluster name contains `stage`, `prod`, or `esvc` (case-insensitive):
```javascript
const isProduction = /stage|prod|esvc/i.test(clusterName);
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
    'identitycontrollertest', 'network-access-controller'
];
```

### Excluded Services

Services always excluded from all calculations:
```javascript
const EXCLUDED_SERVICES = ['unknown'];
```

### Onboarding Data Pipeline (Key Rules)
- **Prod detection**: `stage|prod|esvc` in `fi` (case-insensitive)
- **FKP detection**: `sam` in `k8s_cluster` (case-insensitive)
- **Integration services**: excluded from adoption + self-managed lists (see `INTEGRATION_SERVICES`)
- **Non-FKP prod**: include only `isProd && !isFKP`
- **Environment mapping**: `fi` contains `gia` → GIA2H, else Commercial; BlackJack from normalized BJ file

### BlackJack Normalization
- Input: `assets/data/blackjack_adoption.csv`
- Output: `assets/data/blackjack_adoption_normalized.csv`
- Schema: `fi, fd, k8s_cluster, label_p_servicename, customerType, migrationStage`
- Deduplicate by unique instance (fi/fd/cluster/service)
- `customerType = BlackJack`

### services_with_self_managed_prod.csv Rules
- Source data: `fkp_adoption.csv` + `blackjack_adoption_normalized.csv`
- Include services with **>=1 non-FKP prod** instance (after integration exclusion)
- Org fields use `service_cloud_mapping_utf8.csv` (Org Leader/Parent Cloud/Cloud/Team Name)
- ETAs/Dependencies/Comments prefer **FY27 SoT** when present
- Missing SoT: set ETAs to `TBD`, Comments = `Newly Added`, Feature Dependencies empty
- If count > 0 and ETA is exactly `N/A`, set ETA → `TBD` and report for follow-up
- `network-access-controller`: EKS integration → excluded from adoption + self-managed

---

## 🏗️ Architecture

### Vanilla JS Architecture

All dashboard tabs are now **vanilla JavaScript**:
- Primary logic lives in `assets/js/fkp-dashboard.js`
- CTS logic lives in `assets/js/cost-to-serve.js`
- Tabs are switched via `switchTab()` and sidebar state (`updateSidebarSection()`)

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
        currentTab: 'exec-summary',
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
| `renderProjectionsRoadmap()` | Renders Projections & Roadmap tab (Exec View) |
| `loadProjectionsData()` | Loads roadmap CSV and calculates projections |
| `renderExecutiveSummary()` | Renders Executive Summary (section-only page) |

---

## 📈 Projections & Roadmap Tab

### Overview
The **Projections & Roadmap** tab (Exec View only) shows FKP adoption projections by environment from FY26Q3 to FY27Q4.

### Tab Details
| Property | Value |
|----------|-------|
| Tab ID | `projections-roadmap` |
| View Mode | Exec View only |
| Data-view attribute | `exec` |
| Section | Onboarding |

### Data Sources
| File | Purpose |
|------|---------|
| `assets/data/services_with_self_managed_prod.csv` | Service ETAs, decommission dates |
| `fkp_adoption.csv` | Current quarter Commercial/GIA instances |
| `fkp_adoption_prev_q.csv` | Previous quarter data (FY26Q3 baseline) |
| `assets/data/blackjack_adoption_normalized.csv` | BlackJack current instances |
| `assets/data/blackjack_adoption_prev_q_normalized.csv` | BlackJack previous quarter |

### Roadmap CSV Columns
| Column | Description |
|--------|-------------|
| `Service Name` | Service identifier |
| `Org Leader` | Responsible org leader |
| `Parent Cloud` | Parent cloud grouping |
| `Cloud` | Cloud name |
| `Team Name` | Team responsible |
| `Commercial ETA` | FKP migration ETA for Commercial |
| `Gia2h ETA` | FKP migration ETA for GIA |
| `BlackJack ETA` | FKP migration ETA for BlackJack |
| `Decommission ETA` | When service will be decommissioned |

### ETA Parsing Logic
```javascript
function parseProjectionETA(eta) {
    // Returns null for: 'N/A', 'Need More Info', 'Not Started', empty
    // Returns 'DECOM' for: 'To Be Decommissioned'
    // Returns 'CLEANUP' for: 'Completed with Clean-Up Required'
    // Returns 'FYxxQx' for valid quarters
}
```

### Projection Calculation
```
For each projected quarter (FY27Q1 → FY27Q4):
  FKP_Q = Current_FKP + Σ(self-managed instances for ETAs ≤ Q)
  Total_Q = Current_Total - Σ(instances for Decom ETAs ≤ Q)
  Adoption_Q = FKP_Q / Total_Q * 100
```

### Key Functions
| Function | Purpose |
|----------|---------|
| `renderProjectionsRoadmap()` | Main render function, shows loading state |
| `loadProjectionsData()` | Loads roadmap CSV, calculates projections |
| `calculateProjectionMetricsFromDashboard()` | Gets current metrics from instance data |
| `calculatePrevQuarterMetrics()` | Calculates FY26Q3 baseline from raw data |
| `calculateQuarterlyProjections()` | Cumulative projection calculation |
| `buildServiceMapFromDashboard()` | Maps services to environment breakdowns |
| `findServicesNeedingCompletion()` | Services with FKP but still have self-managed |
| `findServicesNeedingGovcloud()` | Commercial FKP but GovCloud gaps |
| `findServicesWithoutETAs()` | Services missing valid ETAs |
| `renderProjectionsChart()` | SVG line chart with solid/dashed lines |

### Tab Components
1. **Metrics Cards** - Current adoption % for Commercial, GIA, BlackJack
2. **Line Chart** - Projections by quarter (solid = actual, dashed = projected)
3. **Analysis Tables** (side-by-side):
   - Services Enabled - Need to Complete Adoption
   - Services Enabled - GovCloud Adoption Gap
4. **Clouds Needing ETA Alignment** - Aggregated by cloud

### CSS Classes
- `.projections-metrics-grid` - 3-column grid for metric cards
- `.projections-metric-card` - Individual metric card with colored top border
- `.projections-chart-container` - Chart wrapper
- `.projections-analysis-grid` - 2-column grid for analysis tables
- `.projections-analysis-section` - Individual analysis section
- `.projections-table-scroll` - Scrollable table container

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
# Simple HTTP server (GitHub Pages compatible)
python3 -m http.server 8005
```

Access at: `http://localhost:8005`

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

### Availability Data Files
| File | Purpose |
|------|---------|
| `assets/data/availability/incidents_e360_total.csv` | Availability KPIs (sev0/1, MTTD/MTTR) |
| `assets/data/availability/hrp_service_readiness_score_data.csv` | Test readiness matrix |
| `assets/data/availability/customer_test_scenario_view.csv` | Test inventory (customer scenarios) |
| `assets/data/availability/integration_test_view.csv` | Test inventory (integration) |
| `assets/data/availability/scale_perf_test_view.csv` | Test inventory (scale & perf) |
| `assets/data/availability/chaos_tests_view.csv` | Test inventory (chaos) |
| `assets/data/availability/HRP Availability Scorecard - Data Collection - FIT Data.csv` | FIT mapping + pre/post success rates |
| `assets/data/availability/Ingress incidents - False Positive Analysis - slack.csv` | Ingress alert quality KPIs |
| `assets/data/availability/ingress_alert_distribution.csv` | Ingress alert donut chart |
| `assets/data/availability/ingress_alert_accuracy_trend.csv` | Ingress accuracy trend chart |
| `assets/data/availability/ingress_incident_analysis.csv` | Ingress incident analysis table (Slack-derived) |

### HRP Test Inventory Logic (Developer View)
- Product legend: **Enabled**, **Planned**, **Not Defined**
- Critical Path (formerly Customer Scenario): **Enabled** only when `Status = Enabled`; **Planned** when `Status = Not Enabled` or `Partial`
- Chaos: use `Enabled` column if present; fallback to `Frequency` (multiline CSV parsing needed)
- Scale & Perf product mapping uses FIT `Service → Product` map
  - Normalize FIT labels: `FKP → Falcon Kubernetes Service`, `Mesh → Managed Mesh`, `STRIDE → WIS`
- Integration status in summary is based on FIT `Run Type`:
  - **PostDeploymentValidation** and **PreDeploymentValidation** drive post/pre icons
  - Summary table has separate Integration (Post) and (Pre) columns
  - Integration detail has Post/Pre pill rows under “HRP Product Summary - "Integration Test" Coverage”
- Scale & Perf summary column is combined (no separate Scale/Perf columns)
- Product summary header is dynamic: `HRP Product Summary - "<Selected Test>" Coverage`

---

## 🧭 Detection (Runtime Availability)

- Source: `assets/data/availability/incidents_e360_total.csv` (fully replaces `incidents2.csv`)
- KPI windows: Sev0/Sev1 = **last 12 months anchored to today**; MTTD/MTTR = **last 30 days (Sev0/Sev1 only)**
- Trend chart: **last 12 months** anchored to today
- HRP Product filter uses `assets/data/availability/hrp_product_prb_owner_map.json`
- HRP Product Incident KPIs table has 12m/30d toggle; “Days since last incident” ignores toggle
- Exec Summary KPIs route to Detection tab + open matching modal

## 🧭 Detection - Incident Alert Quality (Exec View)

- Section lives under Detection Exec → Service Impact Analysis, labeled **Detection - Incident Alert Quality**
- Data source: `assets/data/availability/ingress_incident_analysis.csv`
- KPI block: Total Alerts, Confirmed Ingress Issues, False Positives
- Pie chart: **Probable Causes for False Positives** only (Ingress Issue = No)
- Table columns: Incident, Probable Cause, Root Cause Summary, Link to Slack Thread, HRP Cause or not
- HRP Product filter: defaults to **Ingress Gateway**; other products show **No Data**
- Slack logic: include **incident-related** threads where Ingress team was pulled in / IG mentioned

---

## 🧪 Prevention Updates (Exec + Dev)

- Exec summary table label updated to **Critical Path Tests**
- Prevention Developer View card label updated to **Critical Path Tests**
- Integration trend chart renders only when Product or RunType is selected; uses FIT success rate (fallback to 100 - failure rate)
- `renderInventoryProductSummary` must define `visibleProducts` locally to avoid ReferenceError
- Integration Tests use FIT `Run Type`:
  - `PreDeploymentValidation` → Pre
  - `PostDeploymentValidation` → Post
- Integration Summary: default **Summarize by Product** only; clicking product shows Run Types for that product
- `WIS`/`STRIDE` → **Workload Identity** normalization

---

## 📞 Contact

- **Onboarding Section**: Aravinth
- **Original Dashboard**: Forked from Service-Adoption-Dashboard-v2

---

*Last Updated: January 2026*

