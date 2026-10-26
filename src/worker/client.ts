import * as Comlink from 'comlink'
import type { EngineApi } from './api.ts'

function spawn(): { worker: Worker; api: Comlink.Remote<EngineApi> } {
  const worker = new Worker(new URL('./engine.worker.ts', import.meta.url), { type: 'module' })
  return { worker, api: Comlink.wrap<EngineApi>(worker) }
}

/** Thrown (and safe to ignore) when a newer job replaced the one being awaited. */
export class SupersededError extends Error {
  constructor() {
    super('Superseded by a newer job')
    this.name = 'SupersededError'
  }
}

/** Fast jobs (stats, streets, next card) share one long-lived worker. */
let fast: ReturnType<typeof spawn> | null = null
export function fastEngine(): Comlink.Remote<EngineApi> {
  fast ??= spawn()
  return fast.api
}

/**
 * Heavy jobs run on one worker per channel. Starting a job on a busy channel terminates
 * the running worker (the only way to stop a synchronous loop) and starts a fresh one.
 */
export class HeavyChannel {
  private current: ReturnType<typeof spawn> | null = null
  private busy = false
  private jobId = 0
  private rejectRunning: ((e: Error) => void) | null = null

  async run<T>(job: (api: Comlink.Remote<EngineApi>) => Promise<T>): Promise<T> {
    const id = ++this.jobId
    if (this.busy && this.current) {
      this.current.worker.terminate()
      this.current = null
      this.rejectRunning?.(new SupersededError())
    }
    this.current ??= spawn()
    this.busy = true
    const { api } = this.current
    try {
      return await new Promise<T>((resolve, reject) => {
        this.rejectRunning = reject
        job(api).then(resolve, reject)
      })
    } finally {
      if (id === this.jobId) {
        this.busy = false
        this.rejectRunning = null
      }
    }
  }

  /** Stops any running job. */
  cancel(): void {
    if (this.busy && this.current) {
      this.current.worker.terminate()
      this.current = null
      this.busy = false
      this.rejectRunning?.(new SupersededError())
      this.rejectRunning = null
    }
    this.jobId++
  }
}

export const channels = {
  equity: new HeavyChannel(),
  hotness: new HeavyChannel(),
  preflop: new HeavyChannel(),
}

export const proxy = Comlink.proxy
