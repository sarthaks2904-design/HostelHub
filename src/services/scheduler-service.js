const { SCHEDULER_INTERVAL_MS } = require("../config");

class SchedulerService {
  constructor(hostelService, intervalMs = SCHEDULER_INTERVAL_MS) {
    this.hostelService = hostelService;
    this.intervalMs = intervalMs;
    this.timer = null;
  }

  start() {
    if (this.timer) {
      return;
    }

    this.timer = setInterval(async () => {
      try {
        await this.hostelService.processAutomations();
      } catch (error) {
        console.error("Scheduler tick failed:", error);
      }
    }, this.intervalMs);
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}

module.exports = {
  SchedulerService
};
