/**
 * Serializes calls so consecutive ones start at least `intervalMs` apart.
 * Per process only: on serverless each instance throttles itself, and the DB cache keeps
 * the overall request volume low.
 */
export function createThrottle(intervalMs: number) {
  let next = 0;
  let chain: Promise<unknown> = Promise.resolve();

  return function throttle<T>(fn: () => Promise<T>): Promise<T> {
    const run = chain.then(async () => {
      const wait = next - Date.now();
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      next = Date.now() + intervalMs;
      return fn();
    });
    chain = run.catch(() => undefined);
    return run;
  };
}
