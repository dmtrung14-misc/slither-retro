# 🚀 Deployment Guide

This guide shows you how to deploy Slither Retro to production.

## ⚠️ Important: Why Not Static Hosting?

Platforms like Netlify, Vercel, and GitHub Pages are great for static sites, but **don't support WebSocket servers**. Since this game requires:
- Real-time WebSocket connections
- A long-running Node.js server
- Server-side game state management

You need a platform that supports full-stack applications with WebSocket support.

## 🎯 Recommended: Deploy to Render (Free)

### Step 1: Push to GitHub

Make sure your code is pushed to a GitHub repository:

```bash
git add .
git commit -m "Ready for deployment"
git push origin main
```

### Step 2: Deploy to Render

1. Go to [render.com](https://render.com) and sign in with GitHub
2. Click **"New +"** → **"Web Service"**
3. Connect your GitHub repository
4. Configure the service:
   - **Name**: Choose any name (e.g., `slither-retro`)
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Plan**: **Free**

5. Click **"Create Web Service"**

Render will automatically deploy your app! You'll get a free URL like:
`https://your-app-name.onrender.com`

### Step 3: Test Your Deployment

1. Wait for the build to complete (check the **Logs** tab)
2. Visit your Render URL and create a room
3. Share the invite link with friends to test multiplayer!

### Step 4: (Optional) Add a Custom Domain

If you own a domain, you can connect it:

#### In Render Dashboard:
1. Go to your service → **Settings** → **Custom Domains**
2. Click **"Add Custom Domain"**
3. Enter your domain (e.g., `game.yourdomain.com`)
4. Render will show you DNS records to add

#### In Your DNS Provider:
1. Go to your domain's DNS settings
2. Add a **CNAME record**:
   - **Name/Host**: Your subdomain (e.g., `game`)
   - **Value/Points to**: Your Render URL (e.g., `your-app-name.onrender.com`)
   - **TTL**: 3600 (or default)

3. Wait 5-60 minutes for DNS propagation
4. Your game will be available at your custom domain with automatic SSL! 🎉

### WebSocket Configuration

The code is already configured to work automatically! It detects the protocol and host:

```javascript
const wsProtocol = location.protocol === "https:" ? "wss" : "ws";
socket = new WebSocket(`${wsProtocol}://${location.host}`);
```

This means:
- ✅ Works on `localhost` (ws://)
- ✅ Works on Render (wss://)
- ✅ Works with custom domains (wss://)

---

## 🔄 Alternative Platforms

If you want to try other platforms that support WebSockets:

### Option 2: Railway

1. Go to [railway.app](https://railway.app)
2. Sign up with GitHub
3. Click **"New Project"** → **"Deploy from GitHub repo"**
4. Select your repository
5. Railway auto-detects Node.js and deploys
6. Add custom domain in settings if you have one

**Pricing:** $5 free credit per month

### Option 3: Fly.io

1. Install Fly CLI: `npm install -g flyctl`
2. Login: `fly auth login`
3. Launch app: `fly launch`
4. Deploy: `fly deploy`
5. Add custom domain: `fly certs add yourdomain.com`

**Pricing:** Generous free tier

### Option 4: DigitalOcean App Platform

1. Go to DigitalOcean → App Platform
2. Create app from GitHub repo
3. Configure:
   - **Type**: Web Service
   - **Build Command**: `npm install`
   - **Run Command**: `npm start`

**Pricing:** Starting at $5/month (no free tier)

---

## 🔧 Environment Variables

If you need environment variables later:

**In Render:**
1. Go to service → **Environment** tab
2. Add variables (e.g., `NODE_ENV=production`)

**In Railway:**
1. Click your service → **Variables** tab
2. Add key-value pairs

---

## 📊 Monitoring & Logs

### Render:
- View logs in the **Logs** tab
- Monitor deployment status in dashboard
- Free tier includes 750 hours/month

### Railway:
- Real-time logs in dashboard
- $5 free credit per month
- Usage-based pricing after

---

## 🚨 Free Tier Limitations

**Render Free Tier:**
- ✅ Unlimited bandwidth
- ✅ WebSocket support
- ⚠️ Apps spin down after 15 min of inactivity (slow first load)
- ⚠️ 750 hours/month limit

**Railway Free Tier:**
- ✅ $5 credit per month
- ✅ Fast deployments
- ⚠️ Usage-based (may need to upgrade for high traffic)

**Solution for Render spin-down:** Use a service like [UptimeRobot](https://uptimerobot.com) to ping your app every 5 minutes to keep it alive.

---

## 🔐 SSL/HTTPS

All platforms automatically provide free SSL certificates! Your game will be served over HTTPS. ✅

---

## 🐛 Troubleshooting

### DNS not working?
- Wait 30-60 minutes for DNS propagation
- Use [DNS Checker](https://dnschecker.org) to verify
- Clear your browser cache

### WebSocket connection failed?
- Check browser console for errors
- Verify the WebSocket URL uses `wss://` (secure)
- Check Render/Railway logs for backend errors

### Game not loading?
- Check deployment logs for build errors
- Verify all dependencies are in `package.json` (not devDependencies)
- Ensure `npm install` and `npm start` work locally

---

## 🎉 You're Done!

Your game is now live and ready to play!

Share the link with friends and start competing! 🐍✨

---

## 📝 Quick Checklist

- [ ] Code pushed to GitHub
- [ ] Deployed to Render (or alternative platform)
- [ ] Build completed successfully
- [ ] Tested game at provided URL
- [ ] WebSocket connections working
- [ ] SSL certificate active (padlock icon in browser)
- [ ] (Optional) Custom domain configured

---

Need help? Check the logs in your deployment platform or open an issue on GitHub!



