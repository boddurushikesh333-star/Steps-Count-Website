/**
 * PedometerEngine - Real-time step counter utilizing Device Motion Sensors (Mobile)
 * with peak detection filtering and built-in Desktop Walking Simulator.
 */
class PedometerEngine {
  constructor(options = {}) {
    this.options = Object.assign({
      minStepIntervalMs: 280, // Human max cadence ~ 3.5 steps/sec
      thresholdUpper: 11.2,    // Acceleration threshold including gravity (m/s^2)
      thresholdLower: 9.3,
      onStep: null,
      onTick: null,
      onStatusChange: null,
      onSensorState: null
    }, options);

    this.state = 'idle'; // 'idle' | 'tracking' | 'paused'
    this.isSensorSupported = false;
    this.isSensorActive = false;
    this.isSimulatorRunning = false;

    // Session stats
    this.sessionSteps = 0;
    this.sessionStartTime = null;
    this.sessionElapsedSeconds = 0;
    this.timerInterval = null;
    this.simulatorInterval = null;

    // Step cadence calculation
    this.recentStepTimestamps = [];
    this.currentCadence = 0; // Steps per minute

    // Motion filtering variables
    this.lastStepTime = 0;
    this.isPeakCandidate = false;
    this.gravityFilter = { x: 0, y: 0, z: 9.8 };
    this.alpha = 0.8; // Low-pass filter constant for gravity

    this.bindHandlers();
    this.checkSensorCapability();
  }

  bindHandlers() {
    this.handleMotion = this.handleMotion.bind(this);
  }

  checkSensorCapability() {
    if (typeof window !== 'undefined' && 'DeviceMotionEvent' in window) {
      this.isSensorSupported = true;
      if (typeof DeviceMotionEvent.requestPermission === 'function') {
        this.needsPermissionPrompt = true;
      } else {
        this.needsPermissionPrompt = false;
      }
    } else {
      this.isSensorSupported = false;
      this.needsPermissionPrompt = false;
    }

    if (this.options.onSensorState) {
      this.options.onSensorState({
        supported: this.isSensorSupported,
        needsPermission: this.needsPermissionPrompt
      });
    }
  }

  async requestPermissionIfNeeded() {
    if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
      try {
        const response = await DeviceMotionEvent.requestPermission();
        return response === 'granted';
      } catch (err) {
        console.warn('Sensor permission rejected or error:', err);
        return false;
      }
    }
    return true; // Not required on non-iOS
  }

  async startTracking() {
    if (this.state === 'tracking') return;

    if (this.state === 'idle') {
      this.sessionSteps = 0;
      this.sessionElapsedSeconds = 0;
      this.recentStepTimestamps = [];
      this.currentCadence = 0;
    }

    const permissionOk = await this.requestPermissionIfNeeded();

    if (this.isSensorSupported && permissionOk) {
      window.addEventListener('devicemotion', this.handleMotion, { passive: true });
      this.isSensorActive = true;
    }

    this.state = 'tracking';
    this.startTimer();

    if (this.options.onStatusChange) {
      this.options.onStatusChange(this.state);
    }
  }

  pauseTracking() {
    if (this.state !== 'tracking') return;

    if (this.isSensorActive) {
      window.removeEventListener('devicemotion', this.handleMotion);
      this.isSensorActive = false;
    }

    if (this.isSimulatorRunning) {
      this.stopSimulator();
    }

    clearInterval(this.timerInterval);
    this.state = 'paused';

    if (this.options.onStatusChange) {
      this.options.onStatusChange(this.state);
    }
  }

  stopTracking() {
    this.pauseTracking();
    const finalReport = {
      steps: this.sessionSteps,
      durationSeconds: this.sessionElapsedSeconds,
      cadence: this.currentCadence
    };

    this.state = 'idle';
    this.sessionSteps = 0;
    this.sessionElapsedSeconds = 0;
    this.currentCadence = 0;
    this.recentStepTimestamps = [];

    if (this.options.onStatusChange) {
      this.options.onStatusChange(this.state);
    }

    return finalReport;
  }

  startTimer() {
    clearInterval(this.timerInterval);
    this.timerInterval = setInterval(() => {
      this.sessionElapsedSeconds++;
      this.cleanOldStepTimestamps();
      if (this.options.onTick) {
        this.options.onTick(this.sessionElapsedSeconds, this.currentCadence);
      }
    }, 1000);
  }

  // Motion sensor step detection algorithm
  handleMotion(event) {
    if (this.state !== 'tracking') return;

    const accel = event.accelerationIncludingGravity || event.acceleration;
    if (!accel || accel.x === null || accel.y === null || accel.z === null) return;

    // 1. Estimate gravity component with low-pass filter
    this.gravityFilter.x = this.alpha * this.gravityFilter.x + (1 - this.alpha) * accel.x;
    this.gravityFilter.y = this.alpha * this.gravityFilter.y + (1 - this.alpha) * accel.y;
    this.gravityFilter.z = this.alpha * this.gravityFilter.z + (1 - this.alpha) * accel.z;

    // 2. Isolate dynamic linear acceleration
    const linearX = accel.x - this.gravityFilter.x;
    const linearY = accel.y - this.gravityFilter.y;
    const linearZ = accel.z - this.gravityFilter.z;

    // Total magnitude of raw acceleration
    const magnitude = Math.sqrt(accel.x * accel.x + accel.y * accel.y + accel.z * accel.z);

    const now = Date.now();
    const timeSinceLastStep = now - this.lastStepTime;

    // Peak-valley threshold detection
    if (magnitude > this.options.thresholdUpper) {
      this.isPeakCandidate = true;
    } else if (this.isPeakCandidate && magnitude < this.options.thresholdLower) {
      if (timeSinceLastStep > this.options.minStepIntervalMs) {
        this.registerStep(now);
      }
      this.isPeakCandidate = false;
    }
  }

  // Register single confirmed step
  registerStep(now = Date.now()) {
    this.lastStepTime = now;
    this.sessionSteps++;

    // Add to rolling window for cadence calculation (last 10 seconds)
    this.recentStepTimestamps.push(now);
    this.cleanOldStepTimestamps(now);

    if (this.options.onStep) {
      this.options.onStep(this.sessionSteps, this.currentCadence);
    }
  }

  cleanOldStepTimestamps(now = Date.now()) {
    const windowMs = 8000; // 8-second window
    this.recentStepTimestamps = this.recentStepTimestamps.filter(t => (now - t) < windowMs);
    
    if (this.recentStepTimestamps.length >= 2) {
      const spanSeconds = (this.recentStepTimestamps[this.recentStepTimestamps.length - 1] - this.recentStepTimestamps[0]) / 1000;
      if (spanSeconds > 0) {
        const rate = (this.recentStepTimestamps.length - 1) / spanSeconds;
        this.currentCadence = Math.round(rate * 60);
      }
    } else {
      this.currentCadence = 0;
    }
  }

  // Toggle walk simulator for desktop testing
  toggleSimulator() {
    if (this.isSimulatorRunning) {
      this.stopSimulator();
      return false;
    } else {
      this.startSimulator();
      return true;
    }
  }

  startSimulator() {
    if (this.state !== 'tracking') {
      this.startTracking();
    }
    this.isSimulatorRunning = true;

    const scheduleNextSimStep = () => {
      if (!this.isSimulatorRunning) return;
      // Normal walking cadence ~ 100-115 steps/min -> 520ms - 580ms interval
      const delay = 520 + Math.floor(Math.random() * 80) - 40;
      this.simulatorInterval = setTimeout(() => {
        if (this.isSimulatorRunning) {
          this.registerStep();
          scheduleNextSimStep();
        }
      }, delay);
    };

    scheduleNextSimStep();
  }

  stopSimulator() {
    this.isSimulatorRunning = false;
    clearTimeout(this.simulatorInterval);
  }

  formatDuration(totalSeconds) {
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    if (hrs > 0) {
      return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
}

window.PedometerEngine = PedometerEngine;
