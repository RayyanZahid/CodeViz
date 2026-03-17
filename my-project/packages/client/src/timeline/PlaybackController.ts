// ---------------------------------------------------------------------------
// PlaybackController — Pure interval-based auto-play engine for timeline.
//
// No React dependencies. Manages a setInterval timer that advances
// snapshots at BASE_INTERVAL_MS / speed intervals.
//
// Usage:
//   const ctrl = new PlaybackController();
//   ctrl.start(speed, async () => { ...; return shouldContinue; });
//   ctrl.stop();
//   ctrl.restart(newSpeed, onTick); // speed changed mid-playback
//
// onTick returns true to continue playback, false to stop (e.g. at live edge).
// ---------------------------------------------------------------------------

const BASE_INTERVAL_MS = 1000; // 1 snapshot per second at 1x speed

export class PlaybackController {
  private timer: ReturnType<typeof setInterval> | null = null;

  /**
   * Start auto-play at the given speed.
   * Stops any previously running timer first.
   * @param speed  Playback speed multiplier (0.5 | 1 | 2 | 4)
   * @param onTick Called on each interval tick. Returns true to continue, false to stop.
   */
  start(speed: number, onTick: () => Promise<boolean>): void {
    this.stop();
    const interval = BASE_INTERVAL_MS / speed;
    this.timer = setInterval(() => {
      void onTick().then((shouldContinue) => {
        if (!shouldContinue) {
          this.stop();
        }
      });
    }, interval);
  }

  /**
   * Stop the auto-play timer (no-op if already stopped).
   */
  stop(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /**
   * Restart with a new speed (call when speed changes during playback).
   * Equivalent to stop() + start() — resets the interval duration.
   */
  restart(speed: number, onTick: () => Promise<boolean>): void {
    this.start(speed, onTick);
  }
}
