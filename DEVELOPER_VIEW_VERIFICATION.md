# Runtime Availability → Prevention Developer View - Verification

## Navigation
1. Open http://localhost:8006
2. Click "Runtime Availability" → "Prevention"
3. Click "🔧 Developer View" button (top right)

---

## Expected Structure (Based on Code Analysis)

### Function: `renderAvailabilityInventoryView()` (lines 3846-3943)

The Developer view for Prevention tab shows a **Test Inventory** interface with the following structure:

---

### ✅ Section 1: Header

**Expected:**
- **Title:** "Hyperforce Runtime Platform (HRP) - Test Inventory"
- **Subtitle:** "Product-level coverage and test inventory details"
- **Code Reference:** Lines 3895-3897

---

### ✅ Section 2: Test Type Cards (4 cards in a row)

**Expected Cards (in order):**

1. **🧑‍💼 Customer Scenario Tests**
   - Shows count of customer scenario tests
   - Clickable to filter detail view

2. **🔗 Integration Tests**
   - Shows count of integration tests (FIT data)
   - Clickable to filter detail view

3. **📈 Scale & Perf Tests**
   - Shows count of scale & performance tests
   - Clickable to filter detail view

4. **🔥 Chaos Tests**
   - Shows count of chaos tests
   - Clickable to filter detail view

**Code Reference:** Lines 3885-3906

**Card Structure:**
```javascript
{
  key: 'customerScenario', 
  label: 'Customer Scenario Tests', 
  icon: '🧑‍💼', 
  value: testCounts.customerScenario
}
```

---

### ✅ Section 3: Product Summary Section

**Expected:**
- **Header:** "HRP Product Summary - "[Test Type]" Coverage"
  - Test type changes based on selected card
  - Default: "Customer Scenario Test"
- **KPI Cards:** Shows coverage metrics for each HRP product
- **Code Reference:** Lines 3908-3913

---

### ✅ Section 4: Filter Row

**Expected Filters:**

1. **Product Filter Dropdown**
   - Label: "Select Product"
   - Options: "All Products" + individual products
   - Code Reference: Lines 3915-3938

2. **Month Filter (for Integration Tests only)**
   - Only visible when Integration Tests card is selected
   - Code Reference: Line 3920

---

### ✅ Section 5: Inventory Detail Table

**Expected:**
- Shows detailed test data based on selected test type
- Columns vary by test type:
  - **Customer Scenario:** Test name, status, product, etc.
  - **Integration:** Service, product, run type, tests, success rate
  - **Scale & Perf:** Test name, product, status, frequency
  - **Chaos:** Test name, product, enabled status, frequency

**Code Reference:** Line 3923

---

## Verification Checklist

### Structure Checks

- [ ] **Check 1:** Header shows "Hyperforce Runtime Platform (HRP) - Test Inventory"
- [ ] **Check 2:** Subtitle shows "Product-level coverage and test inventory details"
- [ ] **Check 3:** Four test type cards are visible in a row
- [ ] **Check 4:** Cards show icons: 🧑‍💼, 🔗, 📈, 🔥
- [ ] **Check 5:** Cards show labels:
  - "Customer Scenario Tests"
  - "Integration Tests"
  - "Scale & Perf Tests"
  - "Chaos Tests"
- [ ] **Check 6:** Each card shows a count number
- [ ] **Check 7:** Product Summary section appears below cards
- [ ] **Check 8:** Product Summary header updates based on selected test type
- [ ] **Check 9:** Product filter dropdown is present with "Select Product" label
- [ ] **Check 10:** Inventory detail table appears at the bottom

### Interaction Checks

- [ ] **Check 11:** Clicking a test type card updates the Product Summary header
- [ ] **Check 12:** Clicking a test type card updates the detail table
- [ ] **Check 13:** Changing product filter updates the detail table
- [ ] **Check 14:** Month filter appears when Integration Tests card is selected
- [ ] **Check 15:** Default view shows Customer Scenario Tests (first card active)

---

## Key Differences from Exec View

| Aspect | Exec View | Developer View |
|--------|-----------|----------------|
| **Focus** | High-level coverage table | Detailed test inventory |
| **Layout** | Preventive Test Coverage table first | Test type cards first |
| **Content** | Summary metrics and charts | Detailed test data tables |
| **Interaction** | Clickable headers to drill down | Filterable cards and dropdowns |
| **Target Audience** | Executives | Developers/Engineers |

---

## Code Implementation Details

### Main Function
```javascript
function renderAvailabilityInventoryView(options = {}) {
    const {
        containerId = 'runtime-availability-prevention-content',
        hideAllSummary = false,
        defaultTab
    } = options;
    // ... renders the Developer view structure
}
```

### Called From
```javascript
// Line 2956 in renderAvailabilityPreventionTab()
if (fkpDashboard.state.currentViewMode === 'developer') {
    renderAvailabilityInventoryView({
        containerId: 'runtime-availability-prevention-content',
        hideAllSummary: true,
        defaultTab: 'customerScenario'
    });
    return;
}
```

### Test Type Cards Data
```javascript
const testTypeCards = [
    { key: 'customerScenario', label: 'Customer Scenario Tests', icon: '🧑‍💼', value: testCounts.customerScenario },
    { key: 'integration', label: 'Integration Tests', icon: '🔗', value: testCounts.integration },
    { key: 'scalePerf', label: 'Scale & Perf Tests', icon: '📈', value: testCounts.scalePerf },
    { key: 'chaos', label: 'Chaos Tests', icon: '🔥', value: testCounts.chaos }
];
```

---

## Expected Result

### ✅ All Checks Should Pass

The code implementation is complete and correct. Developer view should show:

1. ✅ Proper header with title and subtitle
2. ✅ Four test type cards with correct icons and labels
3. ✅ Product summary section that updates based on selection
4. ✅ Product filter dropdown
5. ✅ Detail table with test data
6. ✅ Interactive filtering and card selection

---

## Potential Issues

If any mismatches are found, check:

1. **Data Loading:**
   - Verify `availabilityData.loaded` is true
   - Check browser console for CSV loading errors
   - Ensure test inventory data files exist

2. **View Mode:**
   - Confirm "Developer View" button is clicked
   - Check `fkpDashboard.state.currentViewMode === 'developer'`

3. **Container:**
   - Verify `runtime-availability-prevention-content` element exists
   - Check if content is being rendered inside the container

4. **JavaScript Errors:**
   - Open browser console (F12)
   - Look for errors in `renderAvailabilityInventoryView()`
   - Check if `getInventoryProducts()` returns data

---

## Manual Verification Steps

1. Open http://localhost:8006
2. Navigate to Runtime Availability → Prevention
3. Click "🔧 Developer View" button
4. Verify all 15 checks in the checklist above
5. Test interactions (click cards, change filters)
6. Report any mismatches with:
   - Which check failed
   - What you see vs what's expected
   - Any console errors
