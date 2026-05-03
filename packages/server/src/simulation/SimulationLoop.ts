import { EventBus } from './EventBus.js';

export class SimulationLoop {
  private tick = 0;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private running = false;

  constructor(
    private tickRateMs: number,
    private agentDecisionInterval: number,
    private reflectionInterval: number,
    private stateSyncInterval: number,
    private eventBus: EventBus,
    private onTick: (tick: number) => void,
  ) {}

  start(): void {
    if (this.running) return;
    this.running = true;
    this.intervalId = setInterval(() => this.tickOnce(), this.tickRateMs);
    console.log(`[SimulationLoop] Started (tick rate: ${this.tickRateMs}ms)`);
  }

  stop(): void {
    if (this.intervalId) clearInterval(this.intervalId);
    this.running = false;
    console.log(`[SimulationLoop] Stopped at tick ${this.tick}`);
  }

  getTick(): number {
    return this.tick;
  }

  isRunning(): boolean {
    return this.running;
  }

  setTickRate(ms: number): void {
    this.tickRateMs = ms;
    if (this.running) {
      this.stop();
      this.start();
    }
  }

  shouldDecide(): boolean {
    return this.tick % this.agentDecisionInterval === 0;
  }

  shouldReflect(): boolean {
    return this.tick % this.reflectionInterval === 0;
  }

  shouldSync(): boolean {
    return this.tick % this.stateSyncInterval === 0;
  }

  shouldSave(): boolean {
    return this.tick % 60 === 0;
  }

  private tickOnce(): void {
    this.tick++;
    this.onTick(this.tick);
  }
}
