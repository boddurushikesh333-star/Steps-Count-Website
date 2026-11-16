/**
 * ChartsManager - Modern Chart.js integration for weekly trends and progress analytics
 */
class ChartsManager {
  constructor(canvasId, storageManager) {
    this.canvasId = canvasId;
    this.storage = storageManager;
    this.chart = null;
  }

  init() {
    const canvas = document.getElementById(this.canvasId);
    if (!canvas || typeof Chart === 'undefined') {
      console.warn('Canvas element or Chart.js library not found');
      return;
    }

    const ctx = canvas.getContext('2d');
    const gradient = ctx.createLinearGradient(0, 0, 0, 300);
    gradient.addColorStop(0, '#10B981');
    gradient.addColorStop(1, '#06B6D4');

    const gradientGoal = ctx.createLinearGradient(0, 0, 0, 300);
    gradientGoal.addColorStop(0, '#34D399');
    gradientGoal.addColorStop(1, '#10B981');

    const data = this.storage.getLast7Days();
    const profile = this.storage.getProfile();
    const goal = profile.dailyGoal;

    this.chart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: data.map(d => d.dayName),
        datasets: [
          {
            label: 'Steps',
            data: data.map(d => d.steps),
            backgroundColor: data.map(d => d.steps >= goal ? gradientGoal : 'rgba(16, 185, 129, 0.45)'),
            hoverBackgroundColor: '#34D399',
            borderRadius: 8,
            borderSkipped: false,
            barThickness: 24,
            maxBarThickness: 32
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            backgroundColor: 'rgba(15, 23, 42, 0.95)',
            titleColor: '#F3F4F6',
            bodyColor: '#9CA3AF',
            borderColor: 'rgba(255, 255, 255, 0.1)',
            borderWidth: 1,
            padding: 12,
            cornerRadius: 8,
            callbacks: {
              label: (context) => {
                const dayIndex = context.dataIndex;
                const dayData = data[dayIndex];
                const steps = context.parsed.y;
                const distance = dayData ? (dayData.distanceKm || 0) : 0;
                const calories = dayData ? (dayData.calories || 0) : 0;
                return [
                  `Steps: ${steps.toLocaleString()}`,
                  `Distance: ${distance} km`,
                  `Calories: ${calories} kcal`
                ];
              }
            }
          }
        },
        scales: {
          x: {
            grid: {
              display: false,
              drawBorder: false
            },
            ticks: {
              color: '#94A3B8',
              font: {
                family: 'Plus Jakarta Sans',
                weight: '500'
              }
            }
          },
          y: {
            grid: {
              color: 'rgba(255, 255, 255, 0.05)',
              drawBorder: false
            },
            ticks: {
              color: '#64748B',
              callback: (val) => {
                if (val >= 1000) return (val / 1000) + 'k';
                return val;
              }
            },
            suggestedMax: Math.max(goal * 1.15, ...data.map(d => d.steps * 1.1))
          }
        }
      }
    });
  }

  update() {
    if (!this.chart) {
      this.init();
      return;
    }

    const data = this.storage.getLast7Days();
    const profile = this.storage.getProfile();
    const goal = profile.dailyGoal;

    const ctx = this.chart.ctx;
    const gradientGoal = ctx.createLinearGradient(0, 0, 0, 300);
    gradientGoal.addColorStop(0, '#34D399');
    gradientGoal.addColorStop(1, '#10B981');

    this.chart.data.labels = data.map(d => d.dayName);
    this.chart.data.datasets[0].data = data.map(d => d.steps);
    this.chart.data.datasets[0].backgroundColor = data.map(d => 
      d.steps >= goal ? gradientGoal : 'rgba(16, 185, 129, 0.45)'
    );

    this.chart.options.scales.y.suggestedMax = Math.max(goal * 1.15, ...data.map(d => d.steps * 1.1));
    this.chart.update('none'); // Update without full redraw glitch
  }
}

window.ChartsManager = ChartsManager;
