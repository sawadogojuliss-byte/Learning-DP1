/* Faux Firestore : lecture optimiste, validation atomique et reprise après conflit. */
module.exports = function transactionsFactices(db) {
  let fileCommit = Promise.resolve();
  db.transactionRetries = 0;
  db.runTransaction = async fn => {
    for (let essai = 0; essai < 10; essai++) {
      const lectures = [], ecritures = [];
      const resultat = await fn({
        get: async ref => {
          const snap = await ref.get();
          lectures.push([ref, JSON.stringify(snap.exists ? snap.data() : null)]);
          return snap;
        },
        set: (ref, data, options) => ecritures.push([ref, data, options])
      });
      const commit = fileCommit.then(async () => {
        for (const [ref, ancien] of lectures) {
          const courant = await ref.get();
          if (JSON.stringify(courant.exists ? courant.data() : null) !== ancien) return false;
        }
        for (const [ref, data, options] of ecritures) await ref.set(data, options);
        return true;
      });
      fileCommit = commit.catch(() => {});
      if (await commit) return resultat;
      db.transactionRetries++;
    }
    throw new Error('Trop de conflits dans le faux Firestore');
  };
};
