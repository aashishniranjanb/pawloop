# PawLoop Deployment Guide

## Prerequisites

* GitHub Repository
* Supabase Project
* Vercel Account

## Step 1: Push Code to GitHub

```bash
git add .
git commit -m "production"
git push origin main
```

## Step 2: Create Vercel Project

1. Login to Vercel
2. Click Add New Project
3. Import GitHub Repository
4. Select `pawloop`

## Step 3: Configure Environment Variables

Add the following variables in Vercel:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

If using Push Notifications, also add:

- `NEXT_PUBLIC_VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`

## Step 4: Deploy

Click **Deploy**

Vercel automatically builds and publishes the project.

## Step 5: Configure Supabase

Go to: **Authentication** → **URL Configuration**

Add:
- `https://your-domain.vercel.app`
- `https://your-domain.vercel.app/auth/callback`

## Step 6: Verify

Run through this checklist before public launch:

- [ ] Login Works
- [ ] Create Station Works
- [ ] Create Report Works
- [ ] Realtime Sync
- [ ] Notifications
- [ ] Analytics

### Before First Public Deployment Checklist:
- [ ] Google Login Works
- [ ] Email OTP Works
- [ ] Profile Works
- [ ] Create Station Works
- [ ] Create Report Works
- [ ] Realtime Works
- [ ] Narrative RPC Works
- [ ] Risk Zone RPC Works
- [ ] Push Notifications Work
- [ ] Mobile UI Works
- [ ] Map Markers Clickable

Only after all boxes are checked should you deploy publicly.
