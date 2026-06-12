# VocabMentor v2 — Setup Guide
## Stack: Gemini AI (free) + Supabase (free)

---

## STEP 1 — Paste your keys

### src/gemini.js
Find this line and paste your Gemini key:
```js
const GEMINI_KEY = "YOUR_GEMINI_API_KEY_HERE";
```
Replace with your actual key: `AIza...`

### src/supabase.js
Find this line and paste your Supabase publishable key:
```js
const SUPABASE_KEY = "YOUR_SUPABASE_PUBLISHABLE_KEY_HERE";
```
The Project URL is already filled in: `https://avoudytkqdajuogtdhln.supabase.co`

---

## STEP 2 — Run Supabase SQL

1. Go to your Supabase project → SQL Editor → New query
2. Open the file `supabase-setup.sql` from this folder
3. Copy the entire contents and paste into the SQL editor
4. Click Run
5. You should see "Success. No rows returned."

---

## STEP 3 — Enable Supabase Auth

1. In Supabase: Authentication → Sign-in method (already done ✅)
2. Make sure Email/Password is Enabled (already done ✅)

---

## STEP 4 — Run locally

```bash
npm install
npm start
```

Opens at http://localhost:3000 — test everything works.

---

## STEP 5 — Deploy to Vercel

```bash
npm install -g vercel
npm run build
vercel --prod
```

Or push to GitHub and connect at vercel.com for auto-deploy.

---

## What's new in v2

- ✅ Gemini AI (free, no credit card)
- ✅ Supabase database (free, cloud, works across devices)
- ✅ Essay writing — full loop: write → analyze → research → rewrite → compare
- ✅ Essay resources with Google search links
- ✅ 2-day reminder notifications for essay rewrites
- ✅ Essay history with before/after grade comparison
- ✅ Professional writing mode for adults
- ✅ 7 skill types: Vocabulary, Grammar, Spelling, Comprehension, Writing, Essay, Speaking

---

## Admin access

On landing page → click "Admin" at the bottom → password: admin123
# force rebuild Thu Jun 11 18:02:03 PDT 2026
