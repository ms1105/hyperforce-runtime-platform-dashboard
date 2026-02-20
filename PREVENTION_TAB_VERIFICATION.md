# Runtime Availability → Prevention Exec View Verification

## Expected Structure (Based on Code Analysis)

Based on the `renderAvailabilityPreventionExecView` function in `assets/js/fkp-dashboard.js` (lines 377-643), the Prevention exec view should have the following structure:

### 1. First Section: Preventive Test Coverage for HRP Products

**Location:** Lines 506-552 in the code

**Expected Elements:**
- **Section Header:** "🧪 Hyperforce Runtime Platform Test Inventory"
- **Card Title:** "Preventive Test Coverage for HRP Products"
- **Subheader Text:** "Click on individual tests for more information" (line 514)
- **Legend:** Shows Enabled, Planned, Not Planned indicators

**Table Structure:**
- Column 1: HRP Product
- Column 2: Customer Tests (clickable)
- Column 3: **Integration Tests (Pre-Deployment)** (clickable) - line 528
- Column 4: **Integration Tests (Post-Deployment)** (clickable) - line 529
- Column 5: Scale & Perf Tests (clickable)
- Column 6: Chaos Tests (clickable)

**Cell Format for Integration Tests:**
- Shows submetric: `"X/Y services enabled"` (line 457, 542-543)
- Example: "5/10 services enabled"

### 2. Second Section: Integration Test Summary for HRP Products

**Location:** Lines 554-605 in the code

**Expected Elements:**
- **Section Header:** "🔗 Integration Test Summary for HRP Products" (line 558)
- **Controls:**
  - Month filter dropdown
  - "Summarize by" toggle (Product/Run Type)
- **Content:**
  - Integration FIT Summary table
  - Tests Ran & Success Rate chart

### 3. Third Section: HRP Test Inventory - Trend

**Location:** Lines 607-636 in the code

**Expected Elements:**
- **Section Header:** "📈 HRP Test Inventory - Trend" (line 611)
- **Charts:**
  - FIT Success Rate Trend (6 Months) - canvas id: `fitTrendChartPrevention` (line 621)
  - Chaos Test Execution (Last 6 Months) - canvas id: `chaosChartPrevention` (line 632)

## Verification Checklist

### ✓ Check 1: First Table Appears First
- [ ] "Preventive Test Coverage for HRP Products" table is the first major content
- [ ] Subheader text reads: "Click on individual tests for more information"

### ✓ Check 2: Integration Tests Column Labels
- [ ] Column 3 is labeled "Integration Tests (Pre-Deployment)"
- [ ] Column 4 is labeled "Integration Tests (Post-Deployment)"
- [ ] Pre-Deployment column comes before Post-Deployment column

### ✓ Check 3: Integration Tests Cell Format
- [ ] Pre-Deployment cells show format: "X/Y services enabled"
- [ ] Post-Deployment cells show format: "X/Y services enabled"
- [ ] Format is consistent across all product rows

### ✓ Check 4: Integration Test Summary Section
- [ ] Header reads: "Integration Test Summary for HRP Products"
- [ ] Section appears after the first table
- [ ] Contains FIT summary table and chart

### ✓ Check 5: HRP Test Inventory - Trend Section
- [ ] Header reads: "HRP Test Inventory - Trend"
- [ ] Section appears below Integration Test Summary
- [ ] Contains two charts: FIT Success Rate Trend and Chaos Test Execution

## Code References

### Integration Tests Column Headers (Lines 528-529)
```javascript
<th onclick="openAvailabilityInventoryTab('integration')" class="inventory-clickable-header">Integration Tests (Pre-Deployment)</th>
<th onclick="openAvailabilityInventoryTab('integration')" class="inventory-clickable-header">Integration Tests (Post-Deployment)</th>
```

### Integration Tests Cell Rendering (Lines 542-543)
```javascript
${renderSummaryCellWithCounts(integrationPre, formatServiceCoverageLabel(integrationPre))}
${renderSummaryCellWithCounts(integrationPost, formatServiceCoverageLabel(integrationPost))}
```

### Service Coverage Label Format (Line 457)
```javascript
const formatServiceCoverageLabel = (data) => `${data.enabled || 0}/${data.total || 0} services enabled`;
```

### Section Headers
```javascript
// Line 513
<h3>Preventive Test Coverage for HRP Products</h3>

// Line 514
<div class="inventory-summary-note">Click on individual tests for more information</div>

// Line 558
<span>Integration Test Summary for HRP Products</span>

// Line 611
<span>HRP Test Inventory - Trend</span>
```

## How to Verify

1. Open http://localhost:8006 in browser
2. Click on "Runtime Availability" in sidebar
3. Click on "Prevention" sub-item
4. Ensure you're in "Exec View" (toggle at top right)
5. Verify each checklist item above

## Expected Mismatches (If Any)

Based on the code analysis, the implementation should be **100% correct**. The code clearly shows:

1. ✅ "Preventive Test Coverage for HRP Products" table appears first
2. ✅ Subheader text is exactly "Click on individual tests for more information"
3. ✅ Integration Tests columns are labeled "Pre-Deployment" and "Post-Deployment"
4. ✅ Columns show "X/Y services enabled" format
5. ✅ "Integration Test Summary for HRP Products" header appears above FIT summary
6. ✅ "HRP Test Inventory - Trend" section appears below with charts

**If there are any mismatches, they would be due to:**
- Data not loading properly (check browser console for errors)
- CSS styling issues hiding elements
- JavaScript errors preventing rendering
- Filters affecting the data display
