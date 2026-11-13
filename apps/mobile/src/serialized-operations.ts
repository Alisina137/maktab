/**
 * Order SecureStore mutations so a delayed old write cannot outlive a newer
 * logout/delete or overwrite a sibling preference write.
 * Failed native writes reject to their caller but do not poison later writes.
 */
export function createSerializedWriteQueue() {
  let tail: Promise<void> = Promise.resolve();

  return {
    enqueue<T>(write: () => Promise<T>): Promise<T> {
      const operation = tail.then(write);
      tail = operation.then(() => {}, () => {});
      return operation;
    },
    read<T>(operation: () => Promise<T>): Promise<T> {
      const result = tail.then(operation);
      tail = result.then(() => {}, () => {});
      return result;
    },
    drained(): Promise<void> {
      return tail;
    }
  };
}
