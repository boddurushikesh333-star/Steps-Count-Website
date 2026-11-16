/**
 * StepPulse - Application Controller
 * Connects Storage, Pedometer Engine, Charts, and UI Components
 */

document.addEventListener('DOMContentLoaded', () => {
  // 1. Initialize Core Managers
  const storage = new StorageManager();
  const charts = new ChartsManager('weeklyChartCanvas', storage);
  let firebaseService = null;

  // Motivational quotes
  const quotes = [
    "A single step is all it takes to build momentum. Keep walking!",
    "Every step you take brings you closer to a healthier you.",
    "Small steps every day add up to big achievements.",
    "Walking is a man's best medicine. – Hippocrates",
    "Consistency over speed. Keep your streak alive!",
    "Your future self will thank you for today's effort."
  ];

  // Web Audio Synthesizer for lightweight native sounds without external files
  const soundSynth = {
    ctx: null,
    init() {
      if (!this.ctx && (window.AudioContext || window.webkitAudioContext)) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AudioCtx();
      }
    },
    playStepBlip() {
      if (!storage.getProfile().soundEnabled) return;
      try {
        this.init();
        if (this.ctx.state === 'suspended') this.ctx.resume();
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(587.33, this.ctx.currentTime); // D5
        gain.gain.setValueAtTime(0.04, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.05);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.05);
      } catch (e) {
        // Audio error silent fail
      }
    },
    playGoalChime() {
      if (!storage.getProfile().soundEnabled) return;
      try {
        this.init();
        if (this.ctx.state === 'suspended') this.ctx.resume();
        const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
        notes.forEach((freq, idx) => {
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, this.ctx.currentTime + idx * 0.12);
          gain.gain.setValueAtTime(0.12, this.ctx.currentTime + idx * 0.12);
          gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + idx * 0.12 + 0.35);
          osc.connect(gain);
          gain.connect(this.ctx.destination);
          osc.start(this.ctx.currentTime + idx * 0.12);
          osc.stop(this.ctx.currentTime + idx * 0.12 + 0.35);
        });
      } catch (e) {
        // Audio error silent fail
      }
    }
  };

  // 2. DOM Elements Cache
  const els = {
    // Header & Global
    currentDateDisplay: document.getElementById('currentDateDisplay'),
    soundToggleBtn: document.getElementById('soundToggleBtn'),
    soundIcon: document.getElementById('soundIcon'),
    manualAddTriggerBtn: document.getElementById('manualAddTriggerBtn'),
    cloudStatusBtn: document.getElementById('cloudStatusBtn'),
    cloudStatusIcon: document.getElementById('cloudStatusIcon'),
    cloudStatusText: document.getElementById('cloudStatusText'),
    
    // Tabs & Navigation
    navTabs: document.querySelectorAll('.nav-tab'),
    tabPanes: document.querySelectorAll('.tab-pane'),

    // Hero Ring & Goal
    progressRingCircle: document.getElementById('progressRingCircle'),
    heroStepCount: document.getElementById('heroStepCount'),
    heroGoalTarget: document.getElementById('heroGoalTarget'),
    heroGoalPercentBadge: document.getElementById('heroGoalPercentBadge'),
    goalRemainingText: document.getElementById('goalRemainingText'),
    goalProgressBar: document.getElementById('goalProgressBar'),
    motivationalQuote: document.getElementById('motivationalQuote'),
    quickAddBtns: document.querySelectorAll('.quick-add-btn'),
    customAddQuickBtn: document.getElementById('customAddQuickBtn'),

    // 4 Metric cards
    metricCalories: document.getElementById('metricCalories'),
    metricDistance: document.getElementById('metricDistance'),
    metricDistanceUnit: document.getElementById('metricDistanceUnit'),
    metricActiveTime: document.getElementById('metricActiveTime'),
    metricStreak: document.getElementById('metricStreak'),

    // Live Pedometer Session
    livePedometerIndicator: document.getElementById('livePedometerIndicator'),
    pedometerStatusPill: document.getElementById('pedometerStatusPill'),
    toggleSimulatorBtn: document.getElementById('toggleSimulatorBtn'),
    simulatorBtnText: document.getElementById('simulatorBtnText'),
    sessionTimerDisplay: document.getElementById('sessionTimerDisplay'),
    sessionStepsDisplay: document.getElementById('sessionStepsDisplay'),
    sessionCadenceDisplay: document.getElementById('sessionCadenceDisplay'),
    sessionDistanceDisplay: document.getElementById('sessionDistanceDisplay'),
    sessionCaloriesDisplay: document.getElementById('sessionCaloriesDisplay'),
    startSessionBtn: document.getElementById('startSessionBtn'),
    pauseSessionBtn: document.getElementById('pauseSessionBtn'),
    stopSessionBtn: document.getElementById('stopSessionBtn'),

    // Trends Tab Stats
    statWeeklyAvg: document.getElementById('statWeeklyAvg'),
    statWeeklyTotal: document.getElementById('statWeeklyTotal'),
    statBestDaySteps: document.getElementById('statBestDaySteps'),
    statBestDayDate: document.getElementById('statBestDayDate'),
    statGoalsMetRatio: document.getElementById('statGoalsMetRatio'),

    // History Tab
    historyTableBody: document.getElementById('historyTableBody'),
    addPastEntryBtn: document.getElementById('addPastEntryBtn'),

    // Settings Tab Form
    settingsForm: document.getElementById('settingsForm'),
    inputDailyGoalRange: document.getElementById('inputDailyGoalRange'),
    settingsGoalValue: document.getElementById('settingsGoalValue'),
    unitRadios: document.querySelectorAll('input[name="unitSystem"]'),
    labelWeight: document.getElementById('labelWeight'),
    labelHeight: document.getElementById('labelHeight'),
    inputWeight: document.getElementById('inputWeight'),
    inputHeight: document.getElementById('inputHeight'),
    checkSound: document.getElementById('checkSound'),
    checkHaptic: document.getElementById('checkHaptic'),
    exportDataBtn: document.getElementById('exportDataBtn'),
    importFileInput: document.getElementById('importFileInput'),
    resetDataBtn: document.getElementById('resetDataBtn'),

    // Modals
    manualAddModal: document.getElementById('manualAddModal'),
    manualAddForm: document.getElementById('manualAddForm'),
    closeManualModalBtn: document.getElementById('closeManualModalBtn'),
    cancelManualModalBtn: document.getElementById('cancelManualModalBtn'),
    inputManualDate: document.getElementById('inputManualDate'),
    inputManualSteps: document.getElementById('inputManualSteps'),

    celebrationModal: document.getElementById('celebrationModal'),
    celebrationSubtext: document.getElementById('celebrationSubtext'),
    celebrationStreakDisplay: document.getElementById('celebrationStreakDisplay'),
    celebrationCalDisplay: document.getElementById('celebrationCalDisplay'),
    closeCelebrationBtn: document.getElementById('closeCelebrationBtn'),

    // Firebase Cloud Sync Modal
    firebaseModal: document.getElementById('firebaseModal'),
    closeFirebaseModalBtn: document.getElementById('closeFirebaseModalBtn'),
    firebaseStatusDot: document.getElementById('firebaseStatusDot'),
    firebaseStatusTitle: document.getElementById('firebaseStatusTitle'),
    firebaseStatusDetails: document.getElementById('firebaseStatusDetails'),
    syncNowBtn: document.getElementById('syncNowBtn'),
    firebaseUserSection: document.getElementById('firebaseUserSection'),
    firebaseUserEmail: document.getElementById('firebaseUserEmail'),
    firebaseUserId: document.getElementById('firebaseUserId'),
    firebaseGoogleSignInBtn: document.getElementById('firebaseGoogleSignInBtn'),
    firebaseSignOutBtn: document.getElementById('firebaseSignOutBtn'),
    firebaseConfigForm: document.getElementById('firebaseConfigForm'),
    inputFirebaseJson: document.getElementById('inputFirebaseJson'),
    clearFirebaseConfigBtn: document.getElementById('clearFirebaseConfigBtn'),

    // Auth Modal & Header User elements
    headerLoginBtn: document.getElementById('headerLoginBtn'),
    headerUserPill: document.getElementById('headerUserPill'),
    headerUserAvatar: document.getElementById('headerUserAvatar'),
    headerUserName: document.getElementById('headerUserName'),
    headerLogoutBtn: document.getElementById('headerLogoutBtn'),

    authModal: document.getElementById('authModal'),
    closeAuthModalBtn: document.getElementById('closeAuthModalBtn'),
    authErrorAlert: document.getElementById('authErrorAlert'),
    authErrorText: document.getElementById('authErrorText'),
    tabAuthLogin: document.getElementById('tabAuthLogin'),
    tabAuthSignup: document.getElementById('tabAuthSignup'),
    loginForm: document.getElementById('loginForm'),
    loginEmail: document.getElementById('loginEmail'),
    loginPassword: document.getElementById('loginPassword'),
    loginSubmitBtn: document.getElementById('loginSubmitBtn'),
    signupForm: document.getElementById('signupForm'),
    signupName: document.getElementById('signupName'),
    signupEmail: document.getElementById('signupEmail'),
    signupPassword: document.getElementById('signupPassword'),
    signupSubmitBtn: document.getElementById('signupSubmitBtn'),
    authGoogleBtn: document.getElementById('authGoogleBtn'),
    authGuestBtn: document.getElementById('authGuestBtn')
  };

  // 3. Initialize Pedometer Engine
  const pedometer = new PedometerEngine({
    onStep: (sessionSteps, cadence) => {
      // Audio & Haptic
      soundSynth.playStepBlip();
      if (storage.getProfile().hapticEnabled && navigator.vibrate) {
        navigator.vibrate(25);
      }

      // Add to today's cumulative count
      const result = storage.addSteps(1, 1);
      if (firebaseService) firebaseService.queueSyncToday();
      
      // Update UI displays
      updateSessionDisplay(sessionSteps, cadence);
      refreshDashboard();

      if (result.justAchievedGoal) {
        triggerGoalCelebration();
      }
    },
    onTick: (elapsedSeconds, cadence) => {
      els.sessionTimerDisplay.textContent = pedometer.formatDuration(elapsedSeconds);
      els.sessionCadenceDisplay.textContent = cadence;
    },
    onStatusChange: (status) => {
      updateSessionControlStates(status);
    }
  });

  // 4. Update UI Functions
  function updateSessionDisplay(sessionSteps, cadence) {
    els.sessionStepsDisplay.textContent = sessionSteps.toLocaleString();
    els.sessionCadenceDisplay.textContent = cadence;

    const profile = storage.getProfile();
    const stride = profile.strideMeters || 0.72;
    let distKm = (sessionSteps * stride) / 1000;
    let distStr = `${distKm.toFixed(2)} km`;
    if (profile.unit === 'imperial') {
      const distMi = distKm * 0.621371;
      distStr = `${distMi.toFixed(2)} mi`;
    }
    const cal = Math.round(sessionSteps * 0.042 * (profile.weightKg / 70));
    els.sessionDistanceDisplay.textContent = distStr;
    els.sessionCaloriesDisplay.textContent = `${cal} kcal`;
  }

  function updateSessionControlStates(status) {
    if (status === 'tracking') {
      els.livePedometerIndicator.className = 'w-3.5 h-3.5 rounded-full bg-emerald-400 pulse-indicator';
      els.pedometerStatusPill.textContent = 'Active Walking';
      els.pedometerStatusPill.className = 'text-[10px] font-semibold px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-400 border border-emerald-500/30';
      els.startSessionBtn.disabled = true;
      els.startSessionBtn.className = 'flex-1 py-3 px-4 rounded-xl bg-white/10 text-gray-500 font-bold text-sm flex items-center justify-center gap-2 cursor-not-allowed';
      els.pauseSessionBtn.disabled = false;
      els.pauseSessionBtn.className = 'py-3 px-5 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500/30 font-bold text-sm flex items-center justify-center gap-2 transition btn-press cursor-pointer';
      els.stopSessionBtn.disabled = false;
      els.stopSessionBtn.className = 'py-3 px-5 rounded-xl bg-rose-500/20 text-rose-300 border border-rose-500/30 hover:bg-rose-500/30 font-bold text-sm flex items-center justify-center gap-2 transition btn-press cursor-pointer';
    } else if (status === 'paused') {
      els.livePedometerIndicator.className = 'w-3.5 h-3.5 rounded-full bg-amber-400';
      els.pedometerStatusPill.textContent = 'Paused';
      els.pedometerStatusPill.className = 'text-[10px] font-semibold px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-400 border border-amber-500/30';
      els.startSessionBtn.disabled = false;
      els.startSessionBtn.innerHTML = `<i data-lucide="play" class="w-4 h-4 fill-current"></i><span>Resume Walk</span>`;
      els.startSessionBtn.className = 'flex-1 py-3 px-4 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-brand-500/25 transition btn-press cursor-pointer';
      els.pauseSessionBtn.disabled = true;
      els.pauseSessionBtn.className = 'py-3 px-5 rounded-xl bg-white/10 text-gray-500 font-bold text-sm flex items-center justify-center gap-2 cursor-not-allowed';
      lucide.createIcons();
    } else {
      // Idle
      els.livePedometerIndicator.className = 'w-3.5 h-3.5 rounded-full bg-gray-500';
      els.pedometerStatusPill.textContent = 'Idle';
      els.pedometerStatusPill.className = 'text-[10px] font-semibold px-2 py-0.5 rounded-md bg-white/10 text-gray-400';
      els.startSessionBtn.disabled = false;
      els.startSessionBtn.innerHTML = `<i data-lucide="play" class="w-4 h-4 fill-current"></i><span>Start Walk</span>`;
      els.startSessionBtn.className = 'flex-1 py-3 px-4 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-brand-500/25 transition btn-press cursor-pointer';
      els.pauseSessionBtn.disabled = true;
      els.pauseSessionBtn.className = 'py-3 px-5 rounded-xl bg-white/10 text-gray-500 font-bold text-sm flex items-center justify-center gap-2 cursor-not-allowed';
      els.stopSessionBtn.disabled = true;
      els.stopSessionBtn.className = 'py-3 px-5 rounded-xl bg-white/10 text-gray-500 font-bold text-sm flex items-center justify-center gap-2 cursor-not-allowed';
      lucide.createIcons();
    }
  }

  // Refresh Dashboard Elements
  function refreshDashboard() {
    const today = storage.getTodayRecord();
    const profile = storage.getProfile();
    const goal = profile.dailyGoal;
    const steps = today.steps || 0;
    const percent = Math.min(100, Math.round((steps / goal) * 100));

    // Update Circular Ring SVG
    const circumference = 2 * Math.PI * 82; // ~515.22
    const offset = circumference - (Math.min(steps, goal) / goal) * circumference;
    els.progressRingCircle.style.strokeDashoffset = offset;

    // Numbers & Percentages
    els.heroStepCount.textContent = steps.toLocaleString();
    els.heroGoalTarget.textContent = `of ${goal.toLocaleString()} steps`;
    els.heroGoalPercentBadge.textContent = `${percent}%`;

    if (steps >= goal) {
      els.heroGoalPercentBadge.className = 'mt-2.5 px-3 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500 text-white shadow-md shadow-emerald-500/30';
      els.goalRemainingText.textContent = `🎉 Goal Achieved! (+${(steps - goal).toLocaleString()} extra)`;
      els.goalRemainingText.className = 'text-xs font-semibold text-emerald-400';
    } else {
      els.heroGoalPercentBadge.className = 'mt-2.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-brand-500/20 text-brand-300 border border-brand-500/30';
      const remaining = goal - steps;
      els.goalRemainingText.textContent = `${remaining.toLocaleString()} steps remaining`;
      els.goalRemainingText.className = 'text-xs font-semibold text-brand-400';
    }

    els.goalProgressBar.style.width = `${percent}%`;

    // 4 Stat Cards
    els.metricCalories.textContent = (today.calories || 0).toLocaleString();
    
    // Distance unit check
    let distVal = today.distanceKm || 0;
    if (profile.unit === 'imperial') {
      distVal = distVal * 0.621371;
      els.metricDistanceUnit.textContent = 'mi';
    } else {
      els.metricDistanceUnit.textContent = 'km';
    }
    els.metricDistance.textContent = distVal.toFixed(2);

    const activeMins = Math.round((today.activeSeconds || 0) / 60);
    els.metricActiveTime.textContent = activeMins;

    const streak = storage.calculateStreak();
    els.metricStreak.textContent = streak;

    // Keep date updated
    const now = new Date();
    els.currentDateDisplay.textContent = now.toLocaleDateString(undefined, {
      weekday: 'long',
      month: 'short',
      day: 'numeric'
    });
  }

  // Refresh Trends Analytics Tab
  function refreshTrends() {
    charts.update();
    const data7 = storage.getLast7Days();
    const total7Steps = data7.reduce((sum, d) => sum + (d.steps || 0), 0);
    const avg7Steps = Math.round(total7Steps / data7.length);
    const goalsMet7 = data7.filter(d => d.steps >= (d.goal || storage.getProfile().dailyGoal)).length;

    let bestDay = { steps: 0, date: '--' };
    data7.forEach(d => {
      if (d.steps > bestDay.steps) {
        bestDay = { steps: d.steps, date: d.dayName + ' (' + d.date.slice(5) + ')' };
      }
    });

    els.statWeeklyAvg.textContent = avg7Steps.toLocaleString();
    els.statWeeklyTotal.textContent = total7Steps.toLocaleString();
    els.statGoalsMetRatio.textContent = `${goalsMet7} / 7`;
    els.statBestDaySteps.textContent = bestDay.steps.toLocaleString();
    els.statBestDayDate.textContent = bestDay.date;
  }

  // Refresh History Table
  function refreshHistory() {
    const list = storage.getHistoryList(30);
    els.historyTableBody.innerHTML = '';
    const profile = storage.getProfile();

    if (list.length === 0) {
      els.historyTableBody.innerHTML = `
        <tr>
          <td colspan="6" class="text-center py-8 text-gray-500 text-sm">
            No activity records found. Start walking or log a day!
          </td>
        </tr>
      `;
      return;
    }

    list.forEach(rec => {
      const tr = document.createElement('tr');
      tr.className = 'hover:bg-white/5 transition';

      const isGoalMet = rec.steps >= (rec.goal || profile.dailyGoal);
      let dist = rec.distanceKm || 0;
      let unitLabel = 'km';
      if (profile.unit === 'imperial') {
        dist = (dist * 0.621371).toFixed(2);
        unitLabel = 'mi';
      } else {
        dist = dist.toFixed(2);
      }

      tr.innerHTML = `
        <td class="py-3 px-3 font-medium text-gray-200">${rec.date}</td>
        <td class="py-3 px-3 font-bold text-white">${rec.steps.toLocaleString()}</td>
        <td class="py-3 px-3 text-gray-400">${dist} ${unitLabel}</td>
        <td class="py-3 px-3 text-amber-400 font-medium">${(rec.calories || 0)} kcal</td>
        <td class="py-3 px-3 text-center">
          ${isGoalMet 
            ? `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">Achieved</span>`
            : `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-white/5 text-gray-400">In Progress</span>`
          }
        </td>
        <td class="py-3 px-3 text-right space-x-1">
          <button class="edit-record-btn p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition" data-date="${rec.date}" data-steps="${rec.steps}" title="Edit entry">
            <i data-lucide="edit-3" class="w-4 h-4"></i>
          </button>
          <button class="delete-record-btn p-1.5 rounded-lg hover:bg-rose-500/20 text-gray-400 hover:text-rose-400 transition" data-date="${rec.date}" title="Delete entry">
            <i data-lucide="trash-2" class="w-4 h-4"></i>
          </button>
        </td>
      `;
      els.historyTableBody.appendChild(tr);
    });

    // Reinitialize icons in newly created table rows
    lucide.createIcons();

    // Attach row events
    els.historyTableBody.querySelectorAll('.edit-record-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const date = btn.dataset.date;
        const steps = btn.dataset.steps;
        els.inputManualDate.value = date;
        els.inputManualSteps.value = steps;
        document.querySelector('input[name="manualMode"][value="set"]').checked = true;
        openModal(els.manualAddModal);
      });
    });

    els.historyTableBody.querySelectorAll('.delete-record-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const date = btn.dataset.date;
        if (confirm(`Are you sure you want to delete data for ${date}?`)) {
          storage.deleteRecord(date);
          refreshDashboard();
          refreshTrends();
          refreshHistory();
        }
      });
    });
  }

  // Populate settings form
  function populateSettings() {
    const profile = storage.getProfile();
    els.inputDailyGoalRange.value = profile.dailyGoal;
    els.settingsGoalValue.textContent = `${profile.dailyGoal.toLocaleString()} steps`;
    
    els.unitRadios.forEach(radio => {
      radio.checked = radio.value === profile.unit;
    });

    els.inputWeight.value = profile.weightKg;
    els.inputHeight.value = profile.heightCm;
    els.checkSound.checked = profile.soundEnabled;
    els.checkHaptic.checked = profile.hapticEnabled;

    updateUnitLabels(profile.unit);
  }

  function updateUnitLabels(unit) {
    if (unit === 'imperial') {
      els.labelWeight.textContent = 'Body Weight (lbs)';
      els.labelHeight.textContent = 'Height (inches)';
    } else {
      els.labelWeight.textContent = 'Body Weight (kg)';
      els.labelHeight.textContent = 'Height (cm)';
    }
  }

  // Goal celebration modal trigger
  function triggerGoalCelebration() {
    soundSynth.playGoalChime();
    if (typeof confetti === 'function') {
      confetti({
        particleCount: 90,
        spread: 70,
        origin: { y: 0.6 }
      });
    }

    const today = storage.getTodayRecord();
    const streak = storage.calculateStreak();
    els.celebrationStreakDisplay.textContent = `${streak} ${streak === 1 ? 'Day' : 'Days'} 🔥`;
    els.celebrationCalDisplay.textContent = `${today.calories || 0} kcal`;
    els.celebrationSubtext.textContent = `Great work! You reached your target of ${storage.getProfile().dailyGoal.toLocaleString()} steps today!`;
    openModal(els.celebrationModal);
  }

  // Modal helpers
  function openModal(modalEl) {
    modalEl.classList.remove('hidden');
  }

  function closeModal(modalEl) {
    modalEl.classList.add('hidden');
  }

  // 5. Event Listeners Setup

  // Tab switching
  els.navTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const targetId = tab.dataset.tab;

      // Update tab active classes
      els.navTabs.forEach(t => {
        t.className = 'nav-tab py-3 px-3 sm:px-4 text-sm font-semibold flex items-center gap-2 border-b-2 border-transparent text-gray-400 hover:text-gray-200 transition-colors whitespace-nowrap';
      });
      tab.className = 'nav-tab py-3 px-3 sm:px-4 text-sm font-semibold flex items-center gap-2 border-b-2 border-brand-500 text-brand-400 transition-colors whitespace-nowrap';

      // Hide all panes and display target
      els.tabPanes.forEach(pane => {
        if (pane.id === targetId) {
          pane.classList.remove('hidden');
        } else {
          pane.classList.add('hidden');
        }
      });

      if (targetId === 'tab-dashboard') {
        refreshDashboard();
      } else if (targetId === 'tab-trends') {
        refreshTrends();
      } else if (targetId === 'tab-history') {
        refreshHistory();
      } else if (targetId === 'tab-settings') {
        populateSettings();
      }
    });
  });

  // Sound toggle button in header
  els.soundToggleBtn.addEventListener('click', () => {
    const profile = storage.getProfile();
    const newSound = !profile.soundEnabled;
    storage.updateProfile({ soundEnabled: newSound });
    updateSoundIcon(newSound);
    if (newSound) {
      soundSynth.playStepBlip();
    }
  });

  function updateSoundIcon(enabled) {
    if (enabled) {
      els.soundIcon.setAttribute('data-lucide', 'volume-2');
      els.soundToggleBtn.className = 'p-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-brand-400 transition';
    } else {
      els.soundIcon.setAttribute('data-lucide', 'volume-x');
      els.soundToggleBtn.className = 'p-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-gray-500 transition';
    }
    lucide.createIcons();
  }

  // Quick increment buttons (+100, +500, +1000)
  els.quickAddBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const amount = parseInt(btn.dataset.quickAdd, 10);
      soundSynth.playStepBlip();
      if (storage.getProfile().hapticEnabled && navigator.vibrate) {
        navigator.vibrate(30);
      }
      const res = storage.addSteps(amount, Math.round(amount * 0.6));
      if (firebaseService) firebaseService.queueSyncToday();
      refreshDashboard();
      if (res.justAchievedGoal) {
        triggerGoalCelebration();
      }
    });
  });

  // Custom add modal triggers
  els.manualAddTriggerBtn.addEventListener('click', () => {
    els.inputManualDate.value = storage.getTodayKey();
    els.inputManualSteps.value = '';
    document.querySelector('input[name="manualMode"][value="add"]').checked = true;
    openModal(els.manualAddModal);
  });

  els.customAddQuickBtn.addEventListener('click', () => {
    els.inputManualDate.value = storage.getTodayKey();
    els.inputManualSteps.value = '';
    document.querySelector('input[name="manualMode"][value="add"]').checked = true;
    openModal(els.manualAddModal);
  });

  els.addPastEntryBtn.addEventListener('click', () => {
    els.inputManualDate.value = storage.getTodayKey();
    els.inputManualSteps.value = '';
    document.querySelector('input[name="manualMode"][value="set"]').checked = true;
    openModal(els.manualAddModal);
  });

  els.closeManualModalBtn.addEventListener('click', () => closeModal(els.manualAddModal));
  els.cancelManualModalBtn.addEventListener('click', () => closeModal(els.manualAddModal));
  els.closeCelebrationBtn.addEventListener('click', () => closeModal(els.celebrationModal));

  // Form submission: manual log
  els.manualAddForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const date = els.inputManualDate.value;
    const steps = parseInt(els.inputManualSteps.value, 10);
    const mode = document.querySelector('input[name="manualMode"]:checked').value;

    if (!date || isNaN(steps) || steps < 0) return;

    if (mode === 'add') {
      if (date === storage.getTodayKey()) {
        const res = storage.addSteps(steps, Math.round(steps * 0.6));
        if (res.justAchievedGoal) triggerGoalCelebration();
      } else {
        const existing = storage.data.days[date] ? storage.data.days[date].steps : 0;
        storage.setStepsForDate(date, existing + steps);
      }
    } else {
      // Set absolute value
      storage.setStepsForDate(date, steps);
    }

    if (firebaseService) firebaseService.queueSyncToday();

    closeModal(els.manualAddModal);
    refreshDashboard();
    refreshTrends();
    refreshHistory();
  });

  // Pedometer controls
  els.startSessionBtn.addEventListener('click', () => {
    pedometer.startTracking();
  });

  els.pauseSessionBtn.addEventListener('click', () => {
    pedometer.pauseTracking();
  });

  els.stopSessionBtn.addEventListener('click', () => {
    if (confirm('Finish this walk session? Your session steps are already recorded into today\'s total.')) {
      pedometer.stopTracking();
      els.sessionTimerDisplay.textContent = '00:00';
      els.sessionStepsDisplay.textContent = '0';
      els.sessionCadenceDisplay.textContent = '0';
      els.sessionDistanceDisplay.textContent = '0.00 km';
      els.sessionCaloriesDisplay.textContent = '0 kcal';
    }
  });

  // Simulator toggle
  els.toggleSimulatorBtn.addEventListener('click', () => {
    const isSimActive = pedometer.toggleSimulator();
    if (isSimActive) {
      els.simulatorBtnText.textContent = 'Stop Simulator';
      els.toggleSimulatorBtn.className = 'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/30 transition';
    } else {
      els.simulatorBtnText.textContent = 'Test Walk Simulator';
      els.toggleSimulatorBtn.className = 'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 hover:text-white transition';
    }
  });

  // Settings range change preview
  els.inputDailyGoalRange.addEventListener('input', (e) => {
    const val = parseInt(e.target.value, 10);
    els.settingsGoalValue.textContent = `${val.toLocaleString()} steps`;
  });

  // Settings form submit
  els.settingsForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const dailyGoal = parseInt(els.inputDailyGoalRange.value, 10);
    const unit = document.querySelector('input[name="unitSystem"]:checked').value;
    const weight = parseFloat(els.inputWeight.value) || 70;
    const height = parseFloat(els.inputHeight.value) || 172;
    const sound = els.checkSound.checked;
    const haptic = els.checkHaptic.checked;

    storage.updateProfile({
      dailyGoal,
      unit,
      weightKg: weight,
      heightCm: height,
      soundEnabled: sound,
      hapticEnabled: haptic
    });

    updateSoundIcon(sound);
    updateUnitLabels(unit);
    refreshDashboard();
    refreshTrends();
    refreshHistory();

    alert('Settings successfully updated!');
  });

  // Export JSON
  els.exportDataBtn.addEventListener('click', () => {
    const jsonStr = storage.exportJSON();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `steppulse_backup_${storage.getTodayKey()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });

  // Import JSON
  els.importFileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const res = storage.importJSON(event.target.result);
      if (res.success) {
        alert('Data imported successfully!');
        populateSettings();
        refreshDashboard();
        refreshTrends();
        refreshHistory();
      } else {
        alert('Failed to import file: ' + res.error);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  });

  // Reset Data
  els.resetDataBtn.addEventListener('click', () => {
    if (confirm('Are you sure you want to reset all data and history? This cannot be undone.')) {
      storage.clearAll();
      storage.seedDemoDataIfEmpty();
      populateSettings();
      refreshDashboard();
      refreshTrends();
      refreshHistory();
      alert('Reset complete.');
    }
  });

  // ==========================================
  // Cloud & Firestore Integration
  // ==========================================
  function updateCloudUI(state) {
    if (!state) return;

    if (state.syncStatus === 'connected') {
      els.cloudStatusText.textContent = 'Firestore Synced';
      els.cloudStatusBtn.className = 'flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-xs font-semibold text-emerald-300 transition btn-press';
      els.firebaseStatusDot.className = 'w-3 h-3 rounded-full bg-emerald-400 pulse-indicator';
      els.firebaseStatusTitle.textContent = 'Connected to Firestore';
      els.firebaseStatusDetails.textContent = 'Real-time database sync active';
      els.syncNowBtn.disabled = false;

      if (state.currentUser) {
        els.firebaseUserSection.classList.remove('hidden');
        els.firebaseUserEmail.textContent = state.currentUser.displayName || (state.currentUser.email || 'Anonymous Walker');
        els.firebaseUserId.textContent = `UID: ${state.currentUser.uid.slice(0, 12)}...`;
      } else {
        els.firebaseUserSection.classList.add('hidden');
      }
    } else if (state.syncStatus === 'syncing') {
      els.cloudStatusText.textContent = 'Syncing...';
      els.firebaseStatusDot.className = 'w-3 h-3 rounded-full bg-cyan-400 animate-pulse';
      els.firebaseStatusTitle.textContent = 'Syncing with Firestore...';
      els.firebaseStatusDetails.textContent = 'Uploading / downloading step logs';
      els.syncNowBtn.disabled = true;
    } else if (state.syncStatus === 'connecting') {
      els.cloudStatusText.textContent = 'Connecting...';
      els.firebaseStatusDot.className = 'w-3 h-3 rounded-full bg-amber-400 animate-pulse';
      els.firebaseStatusTitle.textContent = 'Connecting to Cloud...';
      els.firebaseStatusDetails.textContent = 'Verifying Firestore connection';
      els.syncNowBtn.disabled = true;
    } else if (state.syncStatus === 'error') {
      els.cloudStatusText.textContent = 'Sync Error';
      els.cloudStatusBtn.className = 'flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-xs font-semibold text-rose-300 transition btn-press';
      els.firebaseStatusDot.className = 'w-3 h-3 rounded-full bg-rose-400';
      els.firebaseStatusTitle.textContent = 'Connection Error';
      els.firebaseStatusDetails.textContent = state.syncError || 'Check your config';
      els.syncNowBtn.disabled = false;
    } else {
      // unconfigured
      els.cloudStatusText.textContent = 'Connect Cloud';
      els.cloudStatusBtn.className = 'flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-gray-300 transition btn-press';
      els.firebaseStatusDot.className = 'w-3 h-3 rounded-full bg-gray-500';
      els.firebaseStatusTitle.textContent = 'Not Connected';
      els.firebaseStatusDetails.textContent = 'Using offline LocalStorage';
      els.syncNowBtn.disabled = true;
      els.firebaseUserSection.classList.add('hidden');
    }

    lucide.createIcons();
  }

  // Cloud modal controls
  els.cloudStatusBtn.addEventListener('click', () => {
    if (firebaseService) {
      const curConfig = firebaseService.getConfig();
      if (curConfig) {
        els.inputFirebaseJson.value = JSON.stringify(curConfig, null, 2);
      }
    }
    openModal(els.firebaseModal);
  });

  els.closeFirebaseModalBtn.addEventListener('click', () => closeModal(els.firebaseModal));

  els.firebaseConfigForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const raw = els.inputFirebaseJson.value.trim();
    if (!raw) return;

    try {
      // Attempt clean parse, handling raw JSON or JS object format
      let parsed;
      try {
        parsed = JSON.parse(raw);
      } catch (jsonErr) {
        // Fallback: evaluate if pasted as JS object
        parsed = new Function('return ' + raw)();
      }

      if (parsed && (parsed.apiKey || parsed.projectId)) {
        if (firebaseService) {
          firebaseService.saveConfig(parsed);
          alert('Firebase configuration saved! Connecting to Firestore...');
        }
      } else {
        alert('Please make sure your config contains at least apiKey and projectId.');
      }
    } catch (err) {
      alert('Invalid configuration format. Please paste valid JSON: ' + err.message);
    }
  });

  els.clearFirebaseConfigBtn.addEventListener('click', () => {
    if (confirm('Disconnect Firebase and return to local-only storage?')) {
      if (firebaseService) firebaseService.clearConfig();
      els.inputFirebaseJson.value = '';
    }
  });

  els.syncNowBtn.addEventListener('click', async () => {
    if (firebaseService) {
      await firebaseService.syncFromCloud();
      await firebaseService.syncAllLocalToCloud();
      refreshDashboard();
      refreshTrends();
      refreshHistory();
      alert('Cloud synchronization complete!');
    }
  });

  els.firebaseGoogleSignInBtn.addEventListener('click', async () => {
    if (firebaseService) {
      try {
        await firebaseService.signInWithGoogle();
        alert('Signed in with Google successfully!');
      } catch (e) {
        alert('Google Sign-In note: ' + e.message);
      }
    }
  });

  els.firebaseSignOutBtn.addEventListener('click', async () => {
    if (firebaseService) {
      await firebaseService.signOut();
      alert('Signed out.');
    }
  });

  // ==========================================
  // User Authentication Controls (Login / Sign Up)
  // ==========================================
  let toastTimeout = null;
  function showToast(message, type = 'success') {
    const toast = document.getElementById('toastNotification');
    const toastBox = document.getElementById('toastBox');
    const toastMessage = document.getElementById('toastMessage');
    const toastIcon = document.getElementById('toastIcon');
    const toastIconContainer = document.getElementById('toastIconContainer');

    if (!toast) return;

    toastMessage.textContent = message;

    if (type === 'success') {
      toastBox.className = 'flex items-center gap-3 px-4 py-3 rounded-2xl border shadow-2xl backdrop-blur-md bg-emerald-950/95 border-emerald-500/50 text-emerald-200';
      toastIconContainer.className = 'w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0';
      toastIcon.setAttribute('data-lucide', 'check-circle');
      toastIcon.className = 'w-4 h-4 text-emerald-400';
    } else {
      toastBox.className = 'flex items-center gap-3 px-4 py-3 rounded-2xl border shadow-2xl backdrop-blur-md bg-rose-950/95 border-rose-500/50 text-rose-200';
      toastIconContainer.className = 'w-8 h-8 rounded-full bg-rose-500/20 flex items-center justify-center shrink-0';
      toastIcon.setAttribute('data-lucide', 'alert-circle');
      toastIcon.className = 'w-4 h-4 text-rose-400';
    }
    lucide.createIcons();

    // Show animation
    toast.classList.remove('-translate-y-24', 'opacity-0', 'pointer-events-none');
    toast.classList.add('translate-y-0', 'opacity-100');

    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
      toast.classList.remove('translate-y-0', 'opacity-100');
      toast.classList.add('-translate-y-24', 'opacity-0', 'pointer-events-none');
    }, 3800);
  }

  function updateUserHeader(user) {
    if (user && !user.isAnonymous) {
      els.headerLoginBtn.classList.add('hidden');
      els.headerUserPill.classList.remove('hidden');
      const name = user.displayName || (user.email ? user.email.split('@')[0] : 'Walker');
      els.headerUserName.textContent = name;
      els.headerUserAvatar.textContent = (name[0] || 'U').toUpperCase();
    } else {
      els.headerLoginBtn.classList.remove('hidden');
      els.headerUserPill.classList.add('hidden');
    }
  }

  function showAuthError(msg) {
    els.authErrorText.textContent = msg;
    els.authErrorAlert.classList.remove('hidden');
  }

  function clearAuthError() {
    els.authErrorAlert.classList.add('hidden');
    els.authErrorText.textContent = '';
  }

  // Auth modal tab switching
  els.tabAuthLogin.addEventListener('click', () => {
    clearAuthError();
    els.tabAuthLogin.className = 'py-2 rounded-lg bg-brand-500 text-white font-bold transition';
    els.tabAuthSignup.className = 'py-2 rounded-lg text-gray-400 hover:text-white transition';
    els.loginForm.classList.remove('hidden');
    els.signupForm.classList.add('hidden');
  });

  els.tabAuthSignup.addEventListener('click', () => {
    clearAuthError();
    els.tabAuthSignup.className = 'py-2 rounded-lg bg-brand-500 text-white font-bold transition';
    els.tabAuthLogin.className = 'py-2 rounded-lg text-gray-400 hover:text-white transition';
    els.signupForm.classList.remove('hidden');
    els.loginForm.classList.add('hidden');
  });

  els.headerLoginBtn.addEventListener('click', () => {
    clearAuthError();
    openModal(els.authModal);
  });

  els.closeAuthModalBtn.addEventListener('click', () => closeModal(els.authModal));
  els.authGuestBtn.addEventListener('click', () => closeModal(els.authModal));

  // Log In submit
  els.loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearAuthError();

    if (!firebaseService || !firebaseService.isInitialized) {
      showAuthError('Please connect Firebase first using the "Connect Cloud" button.');
      return;
    }

    const email = els.loginEmail.value.trim();
    const password = els.loginPassword.value;

    try {
      els.loginSubmitBtn.disabled = true;
      els.loginSubmitBtn.textContent = 'Signing in...';
      const user = await firebaseService.signInWithEmail(email, password);
      closeModal(els.authModal);
      els.loginForm.reset();
      const displayName = (user && user.displayName) || email.split('@')[0];
      showToast(`🎉 Logged in successfully! Welcome back, ${displayName}!`);
    } catch (err) {
      showAuthError(err.message);
    } finally {
      els.loginSubmitBtn.disabled = false;
      els.loginSubmitBtn.textContent = 'Sign In';
    }
  });

  // Sign Up submit
  els.signupForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearAuthError();

    if (!firebaseService || !firebaseService.isInitialized) {
      showAuthError('Please connect Firebase first using the "Connect Cloud" button.');
      return;
    }

    const name = els.signupName.value.trim();
    const email = els.signupEmail.value.trim();
    const password = els.signupPassword.value;

    try {
      els.signupSubmitBtn.disabled = true;
      els.signupSubmitBtn.textContent = 'Creating account...';
      await firebaseService.signUpWithEmail(email, password, name);
      closeModal(els.authModal);
      els.signupForm.reset();
      showToast(`🎉 Account created and logged in successfully! Welcome, ${name || 'Walker'}!`);
    } catch (err) {
      showAuthError(err.message);
    } finally {
      els.signupSubmitBtn.disabled = false;
      els.signupSubmitBtn.textContent = 'Create Account';
    }
  });

  // Google Login button in Auth modal
  els.authGoogleBtn.addEventListener('click', async () => {
    clearAuthError();
    if (!firebaseService || !firebaseService.isInitialized) {
      showAuthError('Please connect Firebase first using the "Connect Cloud" button.');
      return;
    }
    try {
      const res = await firebaseService.signInWithGoogle();
      closeModal(els.authModal);
      const name = (res && res.user && res.user.displayName) || 'Walker';
      showToast(`🎉 Logged in with Google successfully! Welcome, ${name}!`);
    } catch (err) {
      showAuthError(err.message);
    }
  });

  // Header logout button
  els.headerLogoutBtn.addEventListener('click', async () => {
    if (confirm('Log out of your account? Your data will remain safely stored in Firestore.')) {
      if (firebaseService) {
        await firebaseService.signOut();
        showToast('👋 Logged out successfully.');
      }
    }
  });

  // Listen to user switch events
  window.addEventListener('steppulse:user_changed', (e) => {
    updateUserHeader(e.detail.user);
    populateSettings();
    refreshDashboard();
    refreshTrends();
    refreshHistory();
  });

  // Window cloud sync events
  window.addEventListener('steppulse:cloud_update', () => {
    refreshDashboard();
    refreshTrends();
    refreshHistory();
  });

  window.addEventListener('steppulse:cloud_synced', () => {
    refreshDashboard();
    refreshTrends();
    refreshHistory();
  });

  // Set random motivational quote
  const randomQuote = quotes[Math.floor(Math.random() * quotes.length)];
  els.motivationalQuote.textContent = `"${randomQuote}"`;

  // Initialize Firebase Service
  if (typeof FirebaseService !== 'undefined') {
    firebaseService = new FirebaseService(storage, (state) => updateCloudUI(state));
  }

  // Initial renders
  populateSettings();
  updateSoundIcon(storage.getProfile().soundEnabled);
  refreshDashboard();
  charts.init();
  lucide.createIcons();
});
