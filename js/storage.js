/**
 * StorageManager - Handles local persistence, historical logs, streaks, and user profile
 */
class StorageManager {
  static BASE_KEY = 'step_pulse_data_v2_';

  static DEFAULT_PROFILE = {
    name: 'Walker',
    dailyGoal: 10000,
    weightKg: 70,
    heightCm: 172,
    unit: 'metric', // 'metric' (km, kg) or 'imperial' (miles, lbs)
    soundEnabled: true,
    hapticEnabled: true,
    strideMeters: 0.72 // Default stride ~ 72cm (approx 0.414 * height)
  };

  constructor(userId = 'guest') {
    this.currentUserId = userId;
    this.data = this.loadData();
    if (this.currentUserId === 'guest') {
      this.seedDemoDataIfEmpty();
    }
  }

  getStorageKey() {
    return `${StorageManager.BASE_KEY}${this.currentUserId || 'guest'}`;
  }

  // Switch user to guarantee strict data isolation
  switchUser(userId, userName = null) {
    // Save current data first
    this.save();

    this.currentUserId = userId || 'guest';
    this.data = this.loadData();

    if (userName && this.data.profile.name === 'Walker') {
      this.data.profile.name = userName;
      this.save();
    }

    if (this.currentUserId === 'guest' && Object.keys(this.data.days).length === 0) {
      this.seedDemoDataIfEmpty();
    }

    return this.getTodayRecord();
  }

  loadData() {
    try {
      const raw = localStorage.getItem(this.getStorageKey());
      if (raw) {
        const parsed = JSON.parse(raw);
        return {
          profile: { ...StorageManager.DEFAULT_PROFILE, ...(parsed.profile || {}) },
          days: parsed.days || {}
        };
      }
    } catch (e) {
      console.warn('Error loading storage, using default state', e);
    }

    return {
      profile: { ...StorageManager.DEFAULT_PROFILE },
      days: {}
    };
  }

  save() {
    try {
      localStorage.setItem(this.getStorageKey(), JSON.stringify(this.data));
    } catch (e) {
      console.error('Failed to save to localStorage', e);
    }
  }

  setWholeDataset(profile, days = {}) {
    this.data = {
      profile: { ...StorageManager.DEFAULT_PROFILE, ...(profile || {}) },
      days: days || {}
    };
    this.save();
  }

  // Generate local date string: YYYY-MM-DD
  getLocalDateString(d = new Date()) {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  getTodayKey() {
    return this.getLocalDateString();
  }

  getProfile() {
    return { ...this.data.profile };
  }

  updateProfile(updates) {
    this.data.profile = { ...this.data.profile, ...updates };
    // Recalculate stride if height updated and not manually overridden
    if (updates.heightCm && !updates.strideMeters) {
      this.data.profile.strideMeters = Number((updates.heightCm * 0.414 / 100).toFixed(3));
    }
    this.save();
    return this.getProfile();
  }

  // Calculate calories and distance from step count
  calculateMetrics(steps, activeSeconds = 0) {
    const profile = this.getProfile();
    const stride = profile.strideMeters || 0.72;
    const distanceKm = Number(((steps * stride) / 1000).toFixed(2));
    
    // Average calorie burn formula: ~0.04 - 0.05 kcal per step based on body weight
    // Standard formula: MET 3.5 for brisk walking -> kcal = MET * weightKg * (hours)
    // Or steps-based approximation adjusted by weight:
    const weight = profile.weightKg || 70;
    const calories = Math.round(steps * 0.042 * (weight / 70));

    return {
      steps,
      distanceKm,
      calories,
      activeSeconds
    };
  }

  getTodayRecord() {
    const today = this.getTodayKey();
    if (!this.data.days[today]) {
      this.data.days[today] = {
        date: today,
        steps: 0,
        distanceKm: 0,
        calories: 0,
        activeSeconds: 0,
        goal: this.data.profile.dailyGoal,
        goalMet: false,
        updatedAt: new Date().toISOString()
      };
      this.save();
    }
    return this.data.days[today];
  }

  addSteps(stepsToAdd, additionalSeconds = 0) {
    const today = this.getTodayKey();
    const current = this.getTodayRecord();
    const newSteps = Math.max(0, (current.steps || 0) + stepsToAdd);
    const newSeconds = Math.max(0, (current.activeSeconds || 0) + additionalSeconds);
    const metrics = this.calculateMetrics(newSteps, newSeconds);

    const goal = this.data.profile.dailyGoal;
    const wasGoalMet = current.goalMet;
    const isNowGoalMet = newSteps >= goal;

    this.data.days[today] = {
      ...current,
      ...metrics,
      goal: goal,
      goalMet: isNowGoalMet,
      updatedAt: new Date().toISOString()
    };

    this.save();

    return {
      record: this.data.days[today],
      justAchievedGoal: !wasGoalMet && isNowGoalMet
    };
  }

  setStepsForDate(dateStr, steps, activeSeconds = 0) {
    const metrics = this.calculateMetrics(steps, activeSeconds);
    const goal = this.data.profile.dailyGoal;
    this.data.days[dateStr] = {
      date: dateStr,
      ...metrics,
      goal: goal,
      goalMet: steps >= goal,
      updatedAt: new Date().toISOString()
    };
    this.save();
    return this.data.days[dateStr];
  }

  deleteRecord(dateStr) {
    if (this.data.days[dateStr]) {
      delete this.data.days[dateStr];
      this.save();
      return true;
    }
    return false;
  }

  getHistoryList(limit = 30) {
    const records = Object.values(this.data.days);
    records.sort((a, b) => new Date(b.date) - new Date(a.date));
    return records.slice(0, limit);
  }

  // Returns array of 7 days: [Monday, ..., Sunday] or last 7 days ending today
  getLast7Days() {
    const result = [];
    const today = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(today.getDate() - i);
      const dateStr = this.getLocalDateString(d);
      const record = this.data.days[dateStr] || {
        date: dateStr,
        steps: 0,
        distanceKm: 0,
        calories: 0,
        activeSeconds: 0,
        goal: this.data.profile.dailyGoal,
        goalMet: false
      };
      
      const dayName = d.toLocaleDateString(undefined, { weekday: 'short' });
      result.push({
        dayName,
        date: dateStr,
        ...record
      });
    }
    return result;
  }

  // Calculate consecutive days meeting step goal
  calculateStreak() {
    let streak = 0;
    const today = new Date();
    
    // Check from today or yesterday backwards
    const todayKey = this.getLocalDateString(today);
    const todayRecord = this.data.days[todayKey];
    
    let checkDate = new Date();
    // If today's goal isn't met yet, streak might be active from yesterday
    if (!todayRecord || !todayRecord.goalMet) {
      checkDate.setDate(today.getDate() - 1);
    }

    while (true) {
      const key = this.getLocalDateString(checkDate);
      const rec = this.data.days[key];
      if (rec && rec.goalMet && rec.steps >= (rec.goal || this.data.profile.dailyGoal)) {
        streak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        break;
      }
    }

    return streak;
  }

  // Calculate all-time aggregate stats
  getOverallStats() {
    const records = Object.values(this.data.days);
    let totalSteps = 0;
    let totalDistanceKm = 0;
    let totalCalories = 0;
    let bestDaySteps = 0;
    let bestDayDate = null;
    let goalsMetCount = 0;

    records.forEach(r => {
      const s = r.steps || 0;
      totalSteps += s;
      totalDistanceKm += r.distanceKm || 0;
      totalCalories += r.calories || 0;
      if (r.goalMet) goalsMetCount++;
      if (s > bestDaySteps) {
        bestDaySteps = s;
        bestDayDate = r.date;
      }
    });

    return {
      totalSteps,
      totalDistanceKm: Number(totalDistanceKm.toFixed(1)),
      totalCalories,
      bestDaySteps,
      bestDayDate,
      goalsMetCount,
      daysTracked: records.length
    };
  }

  seedDemoDataIfEmpty() {
    if (Object.keys(this.data.days).length === 0) {
      // Seed past 6 days with realistic sample walking counts
      const sampleSteps = [8420, 10850, 7310, 11400, 9600, 12350];
      const today = new Date();

      sampleSteps.forEach((steps, idx) => {
        const daysAgo = 6 - idx;
        const d = new Date();
        d.setDate(today.getDate() - daysAgo);
        const dateStr = this.getLocalDateString(d);
        const metrics = this.calculateMetrics(steps, Math.round((steps / 100) * 60));
        const goal = this.data.profile.dailyGoal;

        this.data.days[dateStr] = {
          date: dateStr,
          ...metrics,
          goal: goal,
          goalMet: steps >= goal,
          updatedAt: d.toISOString()
        };
      });

      // Today starts with a reasonable count or fresh
      const todayStr = this.getTodayKey();
      const todaySteps = 4120;
      const todayMetrics = this.calculateMetrics(todaySteps, 2400);
      this.data.days[todayStr] = {
        date: todayStr,
        ...todayMetrics,
        goal: this.data.profile.dailyGoal,
        goalMet: todaySteps >= this.data.profile.dailyGoal,
        updatedAt: new Date().toISOString()
      };

      this.save();
    }
  }

  exportJSON() {
    return JSON.stringify(this.data, null, 2);
  }

  importJSON(jsonString) {
    try {
      const parsed = JSON.parse(jsonString);
      if (parsed && typeof parsed === 'object') {
        this.data = {
          profile: { ...StorageManager.DEFAULT_PROFILE, ...(parsed.profile || {}) },
          days: parsed.days || {}
        };
        this.save();
        return { success: true };
      }
      return { success: false, error: 'Invalid JSON structure' };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  clearAll() {
    this.data = {
      profile: { ...StorageManager.DEFAULT_PROFILE },
      days: {}
    };
    this.save();
  }
}

// Export as global for easy browser script usage
window.StorageManager = StorageManager;
