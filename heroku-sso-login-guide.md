# 🔐 Heroku SSO Login Guide

## Enterprise SSO Login Options

Since you're likely using Salesforce/enterprise SSO, here are the different ways to log into Heroku:

### **Option 1: SSO via Browser (Recommended)**

```bash
# Standard browser-based login (works with SSO)
heroku login

# Specify browser if needed
heroku login --browser=chrome
heroku login --browser=firefox
heroku login --browser=safari
```

This will:
- Open your default browser
- Redirect to your organization's SSO login
- Handle SAML/OAuth authentication
- Return you to Heroku authenticated

### **Option 2: Enterprise SSO Dashboard**

If your organization uses Heroku Enterprise:

1. **Go to your organization's SSO portal**
2. **Find "Heroku" in your app launcher**
3. **Click to authenticate via SSO**
4. **Get your API token** from Heroku Dashboard → Account Settings → API Key
5. **Set token manually:**
   ```bash
   export HEROKU_API_KEY=your-api-token-here
   heroku auth:whoami  # Verify it works
   ```

### **Option 3: API Token Authentication**

If you have access to your Heroku dashboard:

1. **Login to Heroku Dashboard** via SSO: https://dashboard.heroku.com
2. **Go to Account Settings** → API Key
3. **Copy your API token**
4. **Set it as environment variable:**
   ```bash
   export HEROKU_API_KEY=your-token-here
   ```
5. **Verify authentication:**
   ```bash
   heroku auth:whoami
   ```

### **Option 4: Organization-Specific Login**

If you're part of a Heroku Enterprise organization:

```bash
# Login to specific organization
heroku login -i  # Interactive login
# Then enter your SSO email when prompted
```

## Updated Deployment Script

Here's an updated deployment script that handles SSO:
