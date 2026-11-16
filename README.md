# StepPulse - Multi-User Step & Fitness Web App 👟☁️

A responsive step counter and activity tracking web app featuring **Multi-User Authentication**, **Google Cloud Firestore real-time sync**, **isolated user records**, and **Vercel deployment readiness**.

---

## 🔒 Multi-User & Data Isolation Architecture

To ensure users never mix up their activity records or metrics:
1. **User Authentication**:
   - **Email & Password**: Registration and login directly within the app.
   - **Google Sign-In**: 1-click Google authentication with Firebase Auth.
   - **Guest / Offline Mode**: Uses isolated local storage without affecting other registered users.
2. **Strict Firestore Data Separation**:
   - Every user's data is partitioned under their unique User ID (`uid`):
     ```
     steppulse_users/
     └── {userId}/
         ├── profile: { name, dailyGoal, weightKg, heightCm, unit, soundEnabled, ... }
         └── days/
             ├── 2026-11-16: { date, steps, calories, distanceKm, activeSeconds, goal, goalMet }
             └── 2026-11-17: { ... }
         ```
   - When **User A** logs out, the app wipes the active screen session.
   - When **User B** logs in, only **User B's** historical days, streaks, and targets load from Firestore.

---

## 🌐 Connecting with GitHub

Your local git repository is already initialized and committed! To push it to your GitHub account:

1. Go to [github.com/new](https://github.com/new) and create a new repository (e.g. `step-count-website`).
2. Run these commands in your project directory (PowerShell or Terminal):
   ```bash
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPOSITORY.git
   git push -u origin main
   ```

---

## 🚀 Deploying to Vercel (Production)

### Method 1: Automatic Continuous Deployment via GitHub (Recommended)
1. Go to [vercel.com](https://vercel.com) and log in with your GitHub account.
2. Click **"Add New..."** > **"Project"**.
3. Select your newly pushed GitHub repository (`step-count-website`).
4. Keep the Framework Preset as **"Other"** (Root Directory `./`).
5. Click **"Deploy"**.
6. Vercel will instantly generate a live production URL (e.g. `https://step-count-website.vercel.app`) with automatic HTTPS and free global CDN! Every future `git push` will deploy automatically.

### Method 2: Direct CLI Deployment via Vercel CLI
Run:
```bash
npx.cmd vercel
```
Follow the quick interactive prompt to log in and deploy directly to production.

---

## 🔥 Setting Up Firebase & Firestore (Free in 2 Minutes)

1. Go to [console.firebase.google.com](https://console.firebase.google.com) and create a free project.
2. In the left menu:
   - **Build > Authentication**: Enable **Email/Password** and **Google**.
   - **Build > Firestore Database**: Click **Create Database** (Start in **Test Mode**).
3. In **Project Settings** (gear icon) > **General** > **Your apps**: Click **Web (`</>`)** and copy the `firebaseConfig` object.
4. Open the StepPulse website and click **"Connect Cloud"** in the top bar. Paste your config and click **"Save & Connect Firestore"**!
