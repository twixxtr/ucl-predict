# UCL Predict — Single-Screen Matchday Prediction

A minimal, mobile-first UEFA Champions League (PSG vs Barcelona) score prediction website with real-time student registration, shared Supabase PostgreSQL storage, and an automated leaderboard.

## Features

- **Minimal Match Screen**: PSG vs Barcelona crests, kickoff time, goal steppers, prediction confirmation.
- **Student Identity Registration**: College name, department (`CSE`, `ECE`, `EEE`, `ME`, `CE`, `Other`), year (`1st` to `4th Year`), and class/division.
- **Supabase Anonymous Auth**: Each student gets a unique authenticated session without needing passwords or email verification.
- **Shared Cloud Database**: Predictions and student profiles are stored centrally in Supabase PostgreSQL.
- **Row-Level Security (RLS)**: Enforces that students can only insert and update their own predictions and profiles.
- **Leaderboard**: Real-time ranking with points calculation (5 pts for exact score, 2 pts for correct outcome).

---

## Getting Started Locally

1. Install dependencies:
   ```bash
   npm install
   ```

2. Configure environment variables:
   Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
   Add your Supabase project details:
   ```env
   VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
   VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
   ```

3. Run the development server:
   ```bash
   npm run dev
   ```

4. Open the local address printed by Vite (typically `http://localhost:5173/`).

---

## Supabase Database Setup

1. In your **Supabase Dashboard → SQL Editor**, run `supabase/schema.sql` (or `supabase/migration_student_profiles.sql`).
2. In **Supabase Dashboard → Authentication → Providers → Anonymous Sign-ins**, ensure **Allow anonymous sign-ins** is enabled.

---

## Deployment (Vercel / Netlify)

1. Push this repository to GitHub.
2. Import the repository in [Vercel](https://vercel.com/) or [Netlify](https://www.netlify.com/).
3. Add the two environment variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Deploy!
