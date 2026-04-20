// Tiny concurrency limiter — no external dependency.
// Usage:
//   const limit = pLimit(4);
//   await Promise.all(items.map(item => limit(() => doWork(item))));

export type Limiter = <T>(fn: () => Promise<T>) => Promise<T>;

export function pLimit(maxConcurrent: number): Limiter {
  if (maxConcurrent < 1) throw new Error("maxConcurrent must be >= 1");
  let active = 0;
  const queue: Array<() => void> = [];

  const next = () => {
    active--;
    const run = queue.shift();
    if (run) run();
  };

  return <T,>(fn: () => Promise<T>): Promise<T> => {
    return new Promise<T>((resolve, reject) => {
      const run = () => {
        active++;
        fn().then(resolve, reject).finally(next);
      };
      if (active < maxConcurrent) run();
      else queue.push(run);
    });
  };
}
