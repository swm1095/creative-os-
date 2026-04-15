# CreativeOS — Setup & Deployment Guide

## What you're deploying
A production-ready AI creative dashboard for Hype10 built on this exact stack:

| Layer | Tool | Role |
|-------|------|------|
| **Brand analysis** | Claude API (vision) | Brand extraction from logo/guidelines upload — NanaBanana Pro coming later |
| **Brief writing & QC** | Claude API | Persona briefs, 3-pass QC checks, brand guide analysis |
| **Primary image gen** | Kling AI | Text-to-image + image-to-image for lifestyle/product scenes |
| **Text-in-image** | Ideogram | Ad creatives with overlaid copy — best text rendering available |
| **Batch & inpainting** | Stability AI | High-volume runs + product shot background inpainting |
| **Background removal** | Remove.bg | Auto BG removal on every product image before templating |
| **Final rendering** | Creatomate | Template-based 1×1 / 4×5 / 9×16 export pipeline at scale |
| **Auth + DB + Storage** | Supabase | User auth (Google OAuth), brand/creative database, asset storage |
| **Hosting** | Vercel | Auto-scaling, 50+ concurrent users, zero infra management |

---

## Step 1 — Get API keys (20 min)

### Required
| Service | Where to get it | Cost |
|---------|----------------|------|
| **Claude API** | https://console.anthropic.com/keys | ~$0.01–0.03/QC check |
| **Supabase** | https://app.supabase.com (free tier) | Free up to 50K req/month |
| **Kling AI** | https://klingai.com/settings/api | ~$0.03–0.08/image |

### Image generation (add all three for best results)
| Service | Where to get it | Best for |
|---------|----------------|----------|
| **Kling AI** | https://klingai.com/settings/api | Lifestyle scenes, image-to-image |
| **Ideogram** | https://ideogram.ai/manage-api | Ads with text/copy overlaid |
| **Stability AI** | https://platform.stability.ai/account/keys | Batch runs, inpainting |

### Pipeline tools
| Service | Where to get it | Role |
|---------|----------------|------|
| **Remove.bg** | https://www.remove.bg/dashboard#api-key | Auto BG removal |
| **Creatomate** | https://creatomate.com/docs/api | Final multi-format rendering |

> **NanaBanana Pro** — planned for a future release. Brand extraction and template matching are currently handled by Claude vision. Add it once you have their API credentials.

### Creatomate template setup
1. Log in to https://creatomate.com/dashboard
2. Create 3 templates (or duplicate their ad template): 1080×1080, 1080×1350, 1080×1920
3. In each template, name your image element `Background-Image`, headline `Headline`, CTA `CTA`, logo `Logo`
4. Copy each template's ID and add to your env vars as `CREATOMATE_TEMPLATE_1x1`, `_4x5`, `_9x16`

---

## Step 2 — Set up Supabase (10 min)

1. Go to https://app.supabase.com → **New project**
2. Name it `creative-os`, choose a region close to your team
3. Once created, go to **SQL Editor** → **New query**
4. Paste the entire contents of `supabase/schema.sql` and click **Run**
5. Go to **Authentication** → **Providers** → enable **Google**
   - Add Google OAuth credentials from https://console.cloud.google.com
   - Set redirect URL to: `https://your-app.vercel.app/api/auth/callback`
6. Go to **Project Settings** → **API** and copy:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY`

---

## Step 3 — Deploy to Vercel (5 min)

### Option A: Deploy from GitHub (recommended)
```bash
# 1. Push to GitHub
git init
git add .
git commit -m "Initial CreativeOS deployment"
git remote add origin https://github.com/YOUR_ORG/creative-os.git
git push -u origin main

# 2. Go to https://vercel.com → Import project → select your repo
# 3. Add environment variables (see Step 4)
# 4. Click Deploy
```

### Option B: Deploy directly with Vercel CLI
```bash
npm install -g vercel
vercel --prod
```

---

## Step 4 — Environment variables

In Vercel: **Project Settings** → **Environment Variables**, add:

```
# Core
NEXT_PUBLIC_SUPABASE_URL          = https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY     = eyJ...
SUPABASE_SERVICE_ROLE_KEY         = eyJ...
ANTHROPIC_API_KEY                 = sk-ant-...

# Image generation
KLING_API_KEY                     = (from klingai.com/settings/api)
KLING_API_SECRET                  = (from klingai.com/settings/api)
IDEOGRAM_API_KEY                  = (from ideogram.ai/manage-api)
STABILITY_AI_KEY                  = sk-... (from platform.stability.ai)

# Pipeline
REMOVEBG_API_KEY                  = (from remove.bg/dashboard)
CREATOMATE_API_KEY                = (from creatomate.com)
CREATOMATE_TEMPLATE_1x1           = (your 1080×1080 template ID)
CREATOMATE_TEMPLATE_4x5           = (your 1080×1350 template ID)
CREATOMATE_TEMPLATE_9x16          = (your 1080×1920 template ID)

# App
NEXT_PUBLIC_APP_URL               = https://your-app.vercel.app
ALLOWED_EMAIL_DOMAIN              = hype10agency.com
```

---

## Step 5 — Local development

```bash
# Clone and install
cd creative-os
npm install

# Copy env template
cp .env.example .env.local
# Edit .env.local with your keys

# Run dev server
npm run dev
# Open http://localhost:3000
```

---

## Architecture for 50 concurrent users

| Layer | Solution | Capacity |
|-------|----------|----------|
| Frontend | Vercel Edge Network | Unlimited |
| API routes | Vercel Serverless Functions | Auto-scales |
| Database | Supabase PostgreSQL | 500 connections (pooled) |
| Storage | Supabase Storage | 1GB free, then $0.02/GB |
| Image gen | Ideogram / fal.ai | Rate limits by API plan |

**For 50 users, Vercel's free tier is sufficient.** Upgrade to Pro ($20/mo) if you need custom domains and more build minutes.

---

## Google Sheets integration

For strategists to import personas from a performance report:

1. Open your Google Sheet
2. **File** → **Share** → **Publish to web**
3. Select the sheet tab, choose **Comma-separated values (.csv)**
4. Click **Publish** and copy the URL
5. Paste into the "Import from Sheets" field in the Generate panel

**Expected columns:** `persona`, `angle`, `hook` (column names are flexible)

---

## Adding new integrations

1. Add the integration card to `components/IntegrationsView.tsx`
2. Add the API call to the relevant route in `app/api/`
3. Add the API key to `.env.local` and Vercel environment variables
4. The architecture is designed to be modular — each integration is an independent API route

---

## Stack update policy

Claude will flag when major API versions change that require action:
- **Anthropic API**: Watch for claude-opus-4-6 → claude-opus-5 or new model releases
- **Ideogram**: Check https://ideogram.ai/changelog for V3 model updates
- **fal.ai Flux**: Monitor https://fal.ai/changelog for new model versions
- **Supabase**: Check https://supabase.com/changelog for breaking changes

**Recommended:** Subscribe to changelog newsletters for all connected APIs.

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Login redirects in a loop | Check `NEXT_PUBLIC_SUPABASE_URL` and `ANON_KEY` in Vercel env vars |
| Image generation fails | Verify `IDEOGRAM_API_KEY` or `FAL_KEY` is set and valid |
| QC checks fail | Verify `ANTHROPIC_API_KEY` is set and has credits |
| Sheets import fails | Ensure the sheet is published as CSV (File → Share → Publish to web) |
| Brand upload fails | Check Supabase Storage bucket `brand-assets` exists (run schema.sql) |
