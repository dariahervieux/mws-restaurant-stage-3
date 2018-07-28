const _fetchDataFromNetwork = Symbol('fetchDataFromNetwork');

/**
 * Storage service base class for objects with external numeric key ('id')
 */
class StorageService {  

  /**
   * Class constructor, opens and stored IDB referense
   */
  constructor(objectsUrl, objectStoreName, initializedIdbPromise) {
    this.objectsApiUrlValue = objectsUrl;
    this.objectStoreName = objectStoreName;
    this.dbPromise = initializedIdbPromise;
  }


  /**
   * Data API URL
   */
  get objectsApiUrl() {
    const port = 1337; // data server port
    return `http://localhost:${port}/${this.objectsApiUrlValue}`;
  }



  /**
   * Database initialization,
   * fill it in with network data if datbase is available and datastore is empty
   */
  initData() {
    if (!this.dbPromise) return;

    const self = this;

    return this.dbPromise.then(async function (db) {
      if (!db) return;

      const tx1 = db.transaction(self.objectStoreName, 'readwrite');
      const store1 = tx1.objectStore(self.objectStoreName);
      const count = await store1.count();

      let transactionPromiseResult = tx1.complete;
      if (count == 0) {
        const items = await self[_fetchDataFromNetwork]();
        if (items) {
          const tx2 = db.transaction(self.objectStoreName, 'readwrite');
          const store2 = tx2.objectStore(self.objectStoreName);
          items.forEach((dataItem) => { 
            dataItem.in_sync = true;
            store2.put(dataItem); 
          });
          transactionPromiseResult = tx2.complete;
        }
      }

      return transactionPromiseResult;

    });
  }

  /**
   * Returns a promise which resolves with the list of all items.
   */
  getAllItems() {
    if (!this.dbPromise) return [];

    const self = this;

    return this.dbPromise.then(function (db) {
      if (!db) return [];

      const tx = db.transaction(self.objectStoreName);
      const store = tx.objectStore(self.objectStoreName);

      return store.getAll();
    });
  }

  /**
   * Returns a promise wich recolves with the item with the specified ID or undefined if it doesn't exist.
   */
  getItemById(id) {
    if (!this.dbPromise) return;

    const self = this;
    
    return this.dbPromise.then(function (db) {
      if (!db) return undefined;

      const store = db.transaction(self.objectStoreName).objectStore(self.objectStoreName);

      return store.get(parseInt(id));
    });
  }

  /**
   * Get the specified index reference
   */
  getIndexedData(indexName, indexedFieldValue) {
    if (!indexName || !this.dbPromise) return;
    const self = this;
    return this.dbPromise.then(function (db) {
      if (!db)  return;
      const store = db.transaction(self.objectStoreName).objectStore(self.objectStoreName);
      const cusineIdx = store.index(indexName);
      return cusineIdx.getAll(indexedFieldValue);     
    });
  }

  getUniqueValuesFromIndex(indexName, indexedFieldName) {
    if (!this.dbPromise) return;
    const self = this;
    return this.dbPromise.then(async function (db) {
      if (!db)
        return;
      const uniqueValues = [];
      const store = db.transaction(self.objectStoreName).objectStore(self.objectStoreName);
      const cusineIdx = store.index(indexName);
      let nextValue = null;
      return cusineIdx.openCursor().then(function cursorIterate(cursor) {
        if (!cursor)
          return uniqueValues;
        const value = cursor.value[indexedFieldName];
        if (nextValue != value) {
          uniqueValues.push(cursor.value[indexedFieldName]);
          nextValue = cursor.value[indexedFieldName];
        }
        return cursor.continue().then(cursorIterate);
      });
    });
  }

  /**
   * Stores provided item in the DB 
   */
  async storeItem(item) {
    if (!this.dbPromise) return;
    const db = await this.dbPromise;

    if(!db) return;
    const tx = db.transaction(this.objectStoreName, 'readwrite');
    const store = tx.objectStore(this.objectStoreName);
    store.put(item);
    return tx.complete;
  }
 
 

  //---------------------------private-------------------------------

  /**
   * Get data list from the network
   */
  [_fetchDataFromNetwork]() {
    return fetch(this.objectsApiUrl)
      .then(response => response.json());
  }

}

export default StorageService;
