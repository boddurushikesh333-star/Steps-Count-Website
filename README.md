# StepPulse - Modern Step & Fitness Web App 👟🔥

A responsive step counter and activity tracking web application with real-time motion detection, goal tracking, weekly analytics, and full local persistence.

---

## 🌟 Key Features

1. **Dashboard & Daily Target Ring**:
   - Animated SVG circular progress ring showing percentage towards your daily goal.
   - Dynamic real-time metrics: **Total Steps**, **Calories Burned (kcal)**, **Distance (km / miles)**, **Active Time**, and **Current Streak (days)**.
   - Quick logging buttons (`+100`, `+500`, `+1,000`, `Custom`).
   - Milestone celebration with confetti explosion and audio chime when hitting your goal!

2. **Real-Time Pedometer Engine**:
   - **Mobile Motion Sensor**: Counts steps using device accelerometer (`DeviceMotionEvent`) with peak-detection filtering.
   - **Desktop Simulator**: "Test Walk Simulator" button for testing on laptops and desktops without sensors.
   - Live session timer, step counter, cadence (steps per minute), distance, and session calories.

3. **Weekly Analytics & Trends**:
   - Interactive 7-day bar chart powered by Chart.js.
   - Benchmark goal indicators, 7-day daily average, weekly total, and best day record.

4. **Activity History Log**:
   - Table of past days with step counts, distance, calories, and goal achievement badges.
   - Edit, delete, or manually log past days.

5. **Custom Profile & Settings**:
   - Adjustable daily step goal (3,000 to 30,000 steps).
   - Metric (km / kg) vs. Imperial (miles / lbs) units.
   - Weight & height adjustments to personalize stride length and calorie expenditure.
   - Web Audio synthesizer blips and haptic vibration (`navigator.vibrate`) toggles.
   - JSON data backup (Export / Import) and reset options.

---

## 🚀 How to Run

### Option 1: Directly Open in Browser (Zero Setup)
Simply double-click [`index.html`](./index.html) in your file explorer to open it in Google Chrome, Microsoft Edge, Brave, or Safari.

### Option 2: Run via Local HTTP Server
If testing on your local network (e.g. from your mobile phone):
```bash
npx serve .
# or
npx http-server .
```
Then visit the local IP address on your mobile phone browser to test live sensor walking!
