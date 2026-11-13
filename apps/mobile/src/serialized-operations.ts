/**
 * Order SecureStore mutations so a delayed old write cannot outlive a newer
 * logout/delete or overwrite a sibling preference write.
 * Failed native writes reject to their caller but do not poison later writes.
 */
export function createSerializedWriteQueue() {
  let tail: Promise<void> = Promise.resolve();

  return {
    enqueue(write: () => Promise<void>): Promise<void> {
      const operation = tail.then(write);
      tail = operation.catch(() => {});
      return operation;
    },
    drained(): Promise<void> {
      return tail;
    }
  };
}
