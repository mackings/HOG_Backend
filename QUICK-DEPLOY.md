# 🚀 One-Command Deployment

## First Time Setup (Do Once)

Run this script to set everything up:

```bash
./quick-deploy.sh
```

This will:
1. Log you in to Vercel (opens browser)
2. Link your project
3. Guide you to add environment variables
4. Deploy to production

**OR** Follow these manual steps:

### Step 1: Login
```bash
vercel login
```

### Step 2: Link Project
```bash
vercel
```

### Step 3: Add Environment Variables

Go to: https://vercel.com/dashboard → Your Project → Settings → Environment Variables

Copy and paste from `.env.production.template`

### Step 4: Deploy
```bash
vercel --prod
```

---

## After First Setup

From now on, just run ONE command to deploy:

```bash
vercel --prod
```

or

```bash
npm run deploy
```

That's it! 🎉

---

## Quick Commands

```bash
# Deploy to production
vercel --prod
npm run deploy

# Deploy preview (test deployment)
vercel
npm run deploy:preview

# Check who's logged in
vercel whoami

# View deployments
vercel ls

# View logs
vercel logs
```

---

## Automatic Deployments

Once set up, Vercel will automatically deploy:
- ✅ Every push to `main` branch = Production
- ✅ Every push to other branches = Preview
- ✅ Pull requests = Preview

---

## Important: MongoDB Atlas

Before your first deployment works, whitelist Vercel IPs:

1. Go to https://cloud.mongodb.com
2. Network Access → Add IP Address
3. Select "Allow Access from Anywhere" (0.0.0.0/0)
4. Confirm

---

## Environment Variables Needed

```
NODE_ENV=production
MONGODB_URL=your_mongodb_url
JWT_SECRET=your_jwt_secret
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
PAYSTACK_MAIN_KEY=your_paystack_key
IMAGEKIT_PUBLIC_KEY=your_imagekit_public_key
IMAGEKIT_PRIVATE_KEY=your_imagekit_private_key
IMAGEKIT_URL_ENDPOINT=your_imagekit_url
EXCHANGE_RATE_API_KEY=your_exchange_rate_key
OPEN_EXCHANGE_RATE_API_KEY=your_open_exchange_rate_key
FRONTEND_URL=your_frontend_url
```

See `.env.production.template` for your actual values.

---

## Troubleshooting

**"Command not found: vercel"**
```bash
npm install -g vercel
```

**"Not logged in"**
```bash
vercel login
```

**"Project not linked"**
```bash
vercel link
```

**"Database connection failed"**
- Whitelist 0.0.0.0/0 in MongoDB Atlas Network Access

---

## That's All!

After the first setup, deploying is just:
```bash
vercel --prod
```

Done! 🚀
