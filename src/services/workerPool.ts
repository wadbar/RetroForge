import { logger } from "./loggerService";

/**
 * WorkerPool - Manages a pool of background workers for parallel processing.
 */
export class WorkerPool {
  private workers: Worker[] = [];
  private nextWorker = 0;
  private pendingRequests = new Map<string, { resolve: Function, reject: Function }>();

  constructor(size: number = navigator.hardwareConcurrency || 4) {
    for (let i = 0; i < size; i++) {
                // Using Vite's worker import syntax
      const worker = new Worker(new URL('../core/workers/analysis.worker.ts', import.meta.url), { type: 'module' });
      worker.onmessage = this.handleMessage.bind(this);
      this.workers.push(worker);
    }
    logger.info(`WorkerPool initialized with ${size} instances.`);
  }

  private handleMessage(event: MessageEvent) {
    const { id, type, result, error } = event.data;
    const request = this.pendingRequests.get(id);

    if (request) {
      if (type === 'SUCCESS') {
        request.resolve(result);
      } else {
        request.reject(new Error(error));
      }
      this.pendingRequests.delete(id);
    }
  }

  /**
   * Dispatches a task to the pool with a timeout guard.
   */
  public async execute<T>(type: string, payload: any, timeoutMs: number = 30000): Promise<T> {
    return new Promise((resolve, reject) => {
      const id = crypto.randomUUID();
      
      const timeout = setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error(`[WorkerPool] Task ${type} timed out after ${timeoutMs}ms`));
        }
      }, timeoutMs);

      this.pendingRequests.set(id, { 
        resolve: (data: T) => {
          clearTimeout(timeout);
          resolve(data);
        }, 
        reject: (err: Error) => {
          clearTimeout(timeout);
          reject(err);
        } 
      });
      
      const worker = this.workers[this.nextWorker];
      worker.postMessage({ id, type, payload });
      
      this.nextWorker = (this.nextWorker + 1) % this.workers.length;
    });
  }
}

export const workerPool = new WorkerPool();
