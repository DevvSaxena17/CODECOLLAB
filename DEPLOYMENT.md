# CodeCollab Deployment Guide

## Problem: Why Netlify Can't Run Your Server

**Netlify is a static site hosting service** - it can only serve static files (HTML, CSS, JavaScript) from your `dist` folder. It **cannot** run:
- Node.js servers (like your `server.js`)
- WebSocket servers (Socket.IO)
- Long-running processes

Your `server.js` file needs to run on a service that supports Node.js servers.

## Solution: Separate Frontend and Backend

You need to deploy:
1. **Frontend** → Netlify (static files)
2. **Backend** → Render/Railway/Heroku (Node.js server)

---

## Step 1: Deploy Backend to Render (Recommended - Free)

### Option A: Using Render Dashboard

1. **Sign up** at [render.com](https://render.com) (free account)

2. **Create a new Web Service**:
   - Click "New +" → "Web Service"
   - Connect your GitHub repository
   - Configure:
     - **Name**: `codecollab-backend`
     - **Environment**: `Node`
     - **Build Command**: `npm install`
     - **Start Command**: `node server.js`
     - **Plan**: `Free`

3. **Set Environment Variables**:
   - Click "Environment" tab
   - Add:
     ```
     NODE_ENV=production
     PORT=10000
     ALLOWED_ORIGINS=https://your-netlify-site.netlify.app,http://localhost:5173
     ```
     (Replace `your-netlify-site` with your actual Netlify URL)

4. **Deploy**:
   - Click "Create Web Service"
   - Wait for deployment (takes 2-5 minutes)
   - Copy the URL (e.g., `https://codecollab-backend.onrender.com`)

### Option B: Using render.yaml (Faster)

1. **Sign up** at [render.com](https://render.com)

2. **Create a new Blueprint**:
   - Click "New +" → "Blueprint"
   - Connect your GitHub repository
   - Render will automatically detect `render.yaml`
   - Update `ALLOWED_ORIGINS` in `render.yaml` with your Netlify URL
   - Click "Apply"

3. **Copy the backend URL** after deployment

---

## Step 2: Deploy Frontend to Netlify

### If you haven't deployed yet:

1. **Sign up** at [netlify.com](https://netlify.com)

2. **Deploy from Git**:
   - Click "Add new site" → "Import an existing project"
   - Connect your GitHub repository
   - Netlify will auto-detect settings from `netlify.toml`

3. **Set Environment Variables**:
   - Go to: **Site Settings** → **Environment Variables**
   - Click "Add variable"
   - Add:
     ```
     VITE_SOCKET_URL = https://your-backend-url.onrender.com
     ```
     (Replace with your actual Render backend URL)

4. **Redeploy**:
   - Go to "Deploys" tab
   - Click "Trigger deploy" → "Clear cache and deploy site"

### If already deployed:

1. **Update Environment Variables**:
   - Go to: **Site Settings** → **Environment Variables**
   - Add/Update:
     ```
     VITE_SOCKET_URL = https://your-backend-url.onrender.com
     ```

2. **Redeploy**:
   - Go to "Deploys" tab
   - Click "Trigger deploy" → "Clear cache and deploy site"

---

## Step 3: Update Backend CORS Settings

After deploying the frontend, update your backend's `ALLOWED_ORIGINS`:

1. Go to your Render dashboard
2. Click on your backend service
3. Go to "Environment" tab
4. Update `ALLOWED_ORIGINS`:
   ```
   https://your-netlify-site.netlify.app,http://localhost:5173,http://localhost:3000
   ```
5. Save and redeploy

---

## Alternative Backend Hosting Options

### Railway (Alternative to Render)

1. Sign up at [railway.app](https://railway.app)
2. Create new project → "Deploy from GitHub repo"
3. Select your repository
4. Railway will auto-detect Node.js
5. Set environment variables:
   - `PORT` (Railway sets this automatically)
   - `ALLOWED_ORIGINS` (your Netlify URL)
6. Deploy

### Heroku (Paid after free tier ended)

1. Sign up at [heroku.com](https://heroku.com)
2. Create new app
3. Connect GitHub repository
4. Deploy branch
5. Set config vars (same as environment variables)

---

## Testing Your Deployment

1. **Test Frontend**: Visit your Netlify URL
2. **Test Backend**: Visit `https://your-backend-url.onrender.com` - should see nothing (server is running)
3. **Test Connection**: 
   - Open browser console on your Netlify site
   - Try to create/login and create a project
   - Check for WebSocket connection errors
   - If you see connection errors, verify `VITE_SOCKET_URL` is set correctly

---

## Troubleshooting

### "Cannot connect to server" error
- ✅ Check that backend is deployed and running (visit backend URL)
- ✅ Verify `VITE_SOCKET_URL` in Netlify matches your backend URL
- ✅ Check `ALLOWED_ORIGINS` in backend includes your Netlify URL
- ✅ Redeploy both frontend and backend after changing environment variables

### Backend keeps sleeping (Render free tier)
- Render free tier services "spin down" after 15 minutes of inactivity
- First request after spin-down takes ~30 seconds (cold start)
- Consider upgrading to paid plan for always-on service

### CORS errors
- Make sure `ALLOWED_ORIGINS` in backend includes your exact Netlify URL
- Include protocol (`https://`) and no trailing slash
- Redeploy backend after changing CORS settings

### Code execution not working
- Backend must be running (not sleeping)
- Check backend logs in Render dashboard for errors
- Verify Python/Node.js/g++ are available (Render has these by default)

---

## Quick Checklist

- [ ] Backend deployed to Render/Railway/Heroku
- [ ] Backend URL copied
- [ ] `VITE_SOCKET_URL` set in Netlify environment variables
- [ ] `ALLOWED_ORIGINS` set in backend with Netlify URL
- [ ] Frontend redeployed on Netlify
- [ ] Tested connection in browser console

---

## Need Help?

- Check Render logs: Render Dashboard → Your Service → Logs
- Check Netlify logs: Netlify Dashboard → Deploys → Click on deploy → Functions/Deploy logs
- Check browser console for connection errors

