# GitLab Pages Setup for Bin-Packing Dashboard

## ✅ Changes Made

1. **Updated `.gitlab-ci.yml`**:
   - Set `VITE_BASE_PATH` to `/hyperforce-runtime-platform-360/` to match your GitLab Pages URL
   - Added `VITE_BINPACKING_API_URL` environment variable
   - Ensured `bin-packing-dashboard.html` is copied to the public folder during build

2. **Updated `bin-packing-dashboard.html`**:
   - Added configurable API base URL via `window.BINPACKING_API_URL`
   - API calls now use the configured base URL instead of hardcoded paths

3. **Updated `BinPackingView.tsx`**:
   - Sets the API URL before loading the iframe
   - Uses Vite environment variables for configuration

## 🔧 Configuration

### Option 1: Use GitLab CI/CD Variables (Recommended)

1. Go to your GitLab project: `https://git.soma.salesforce.com/msatapathy/hyperforce-runtime-platform-360`
2. Navigate to: **Settings** → **CI/CD** → **Variables**
3. Add the following variables:
   - **Key**: `VITE_BINPACKING_API_URL`
   - **Value**: `http://YOUR_BINPACKING_SERVER_URL:3001` (or your actual bin-packing server URL)
   - **Type**: Variable
   - **Protected**: Unchecked (unless you want it protected)
   - **Masked**: Unchecked
   - **Expand variable reference**: Checked

### Option 2: Update .gitlab-ci.yml Directly

Edit `.gitlab-ci.yml` and update the `VITE_BINPACKING_API_URL` variable:

```yaml
variables:
  VITE_BINPACKING_API_URL: "http://your-bin-packing-server-url:3001"
```

## 🚀 Deployment Steps

1. **Commit and push your changes:**
   ```bash
   cd "/Users/msatapathy/Documents/AI Projects/Hyperforce Runtime Platform"
   git add .
   git commit -m "Add bin-packing dashboard to Karpenter tab"
   git push origin main
   ```

2. **Wait for GitLab CI/CD pipeline to complete:**
   - Go to: **CI/CD** → **Pipelines**
   - Wait for the `pages` job to complete successfully

3. **Verify deployment:**
   - Navigate to: `https://git.soma.salesforce.com/pages/msatapathy/hyperforce-runtime-platform-360/`
   - Go to: **Service Owner View** → **Runtime Scale & Availability** → **Karpenter** tab
   - The bin-packing dashboard should be visible

## ⚠️ Important Notes

1. **Bin-Packing Server Must Be Accessible**: 
   - The bin-packing server must be accessible from GitLab Pages
   - If running locally, use a tunnel service (ngrok, localtunnel) or deploy the server
   - Update `VITE_BINPACKING_API_URL` to point to the accessible URL

2. **CORS Configuration**:
   - Ensure the bin-packing server allows CORS requests from your GitLab Pages domain
   - Update `bin-packing-server.js` CORS settings if needed

3. **Base Path**:
   - The base path is set to `/hyperforce-runtime-platform-360/` to match your GitLab Pages URL
   - If your URL changes, update `VITE_BASE_PATH` in `.gitlab-ci.yml`

## 🔍 Troubleshooting

### 502 Bad Gateway when opening the Pages URL
- **Pipeline**: Ensure the pipeline runs on `main` or `master` and the `pages` job **succeeds**. If the job fails, GitLab may serve a broken or empty site and return 502.
- **Artifact**: After pushing, go to **CI/CD → Pipelines** and confirm the latest pipeline is green. Re-run the `pages` job if it failed.
- **Infrastructure**: If the pipeline is green and the artifact looks correct, 502 can be from GitLab/Pages on your instance (e.g. service down, VPN/network). Contact your GitLab admins or try again later.

### Dashboard doesn't load
- Check browser console for errors
- Verify `bin-packing-dashboard.html` is in the `public/` folder
- Check that the file is copied during build (check GitLab CI logs)

### API calls fail
- Verify `VITE_BINPACKING_API_URL` is set correctly
- Check that the bin-packing server is accessible from GitLab Pages
- Check CORS settings on the bin-packing server
- Check browser network tab for failed requests

### 404 errors
- Verify `VITE_BASE_PATH` matches your GitLab Pages URL path
- Check that files are being served from the correct base path


