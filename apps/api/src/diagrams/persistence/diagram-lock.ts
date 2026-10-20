/** Cola serial en memoria por diagrama: "último en llegar, último en aplicarse". */
export class DiagramLock {
  private readonly tails = new Map<string, Promise<unknown>>();

  get size(): number {
    return this.tails.size;
  }

  run<T>(key: string, task: () => Promise<T>): Promise<T> {
    const previous = this.tails.get(key) ?? Promise.resolve();
    const result = previous.then(task, task);
    const tail = result.catch(() => undefined);
    this.tails.set(key, tail);
    void tail.then(() => {
      if (this.tails.get(key) === tail) this.tails.delete(key);
    });
    return result;
  }
}
