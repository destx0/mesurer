const DATABASE_NAME = "mesurer-reviews"
const STORE_NAME = "viewers"

// Demo-only storage for large viewer HTML. Replace with server-backed storage for shareable URLs.
const openDatabase = (ownerWindow: Window) => new Promise<IDBDatabase>((resolve, reject) => {
  const request = ownerWindow.indexedDB.open(DATABASE_NAME, 1)
  request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME)
  request.onsuccess = () => resolve(request.result)
  request.onerror = () => reject(request.error ?? new Error("Could not open review storage"))
})

export const saveReviewViewer = async (ownerWindow: Window, id: string, html: string) => {
  const database = await openDatabase(ownerWindow)
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readwrite")
      const store = transaction.objectStore(STORE_NAME)
      store.put(html, id)
      const cursorRequest = store.openCursor()
      cursorRequest.onsuccess = () => {
        const cursor = cursorRequest.result
        if (!cursor) return
        if (cursor.key !== id) cursor.delete()
        cursor.continue()
      }
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error ?? new Error("Could not save review"))
    })
  } finally {
    database.close()
  }
}

export const loadReviewViewer = async (ownerWindow: Window, id: string) => {
  let database: IDBDatabase | undefined
  try {
    const openedDatabase = await openDatabase(ownerWindow)
    database = openedDatabase
    const html = await new Promise<string | undefined>((resolve, reject) => {
      const request = openedDatabase.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).get(id)
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    if (html) return html
  } catch {
    // Fall back to older localStorage-backed review links.
  } finally {
    database?.close()
  }
  return ownerWindow.localStorage.getItem(`mesurer:review:${id}`) ?? undefined
}
