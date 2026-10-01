// Annuler et rétablir (CdC § 16) : des instantanés du document, le plus récent en dernier. Pur :
// l'appelant décide quand photographier et comment rétablir.
export function createHistory(limit = 200) {
  const past = []
  const future = []
  return {
    record(snapshot) {
      past.push(snapshot)
      if (past.length > limit) past.shift()
      future.length = 0 // une nouvelle action efface ce qu'on pouvait rétablir
    },
    undo(current) {
      if (!past.length) return null
      future.push(current)
      return past.pop()
    },
    redo(current) {
      if (!future.length) return null
      past.push(current)
      return future.pop()
    },
    get canUndo() { return past.length > 0 },
    get canRedo() { return future.length > 0 },
  }
}
