// Serialize inventory mutations across the single SQLite API process so that
// availability checks and reservations cannot interleave across async boundaries.
let tail = Promise.resolve();
function serializeMutation(operation) {
  return (...args) => {
    const result = tail.then(() => operation(...args));
    tail = result.catch(() => {});
    return result;
  };
}
module.exports = { serializeMutation };
