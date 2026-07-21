/**
 * db.js — IndexedDB 儲存模組
 * ------------------------------------------------------------
 * 純本機儲存，不需登入、不需連網。
 * 資料庫：AIBaziSecretaryDB
 *   - charts：歷史命盤（含輸入資料、排盤結果、解鎖狀態）
 *   - settings：使用者設定（如子時流派偏好）
 */

const BaziDB = (() => {
  const DB_NAME = 'AIBaziSecretaryDB';
  const DB_VERSION = 1;
  const STORE_CHARTS = 'charts';
  const STORE_SETTINGS = 'settings';

  let dbInstance = null;

  function openDB() {
    return new Promise((resolve, reject) => {
      if (dbInstance) {
        resolve(dbInstance);
        return;
      }
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(STORE_CHARTS)) {
          const store = db.createObjectStore(STORE_CHARTS, { keyPath: 'id', autoIncrement: true });
          store.createIndex('createdAt', 'createdAt', { unique: false });
        }
        if (!db.objectStoreNames.contains(STORE_SETTINGS)) {
          db.createObjectStore(STORE_SETTINGS, { keyPath: 'key' });
        }
      };

      request.onsuccess = (event) => {
        dbInstance = event.target.result;
        resolve(dbInstance);
      };

      request.onerror = (event) => {
        reject(event.target.error);
      };
    });
  }

  // ---------- 命盤 CRUD ----------

  async function saveChart(chartRecord) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_CHARTS, 'readwrite');
      const store = tx.objectStore(STORE_CHARTS);
      const record = { ...chartRecord, createdAt: chartRecord.createdAt || Date.now() };
      const request = store.add(record);
      request.onsuccess = () => resolve(request.result); // 回傳新增的 id
      request.onerror = () => reject(request.error);
    });
  }

  async function updateChart(id, patch) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_CHARTS, 'readwrite');
      const store = tx.objectStore(STORE_CHARTS);
      const getReq = store.get(id);
      getReq.onsuccess = () => {
        const existing = getReq.result;
        if (!existing) {
          reject(new Error('找不到指定的命盤記錄'));
          return;
        }
        const updated = { ...existing, ...patch };
        const putReq = store.put(updated);
        putReq.onsuccess = () => resolve(updated);
        putReq.onerror = () => reject(putReq.error);
      };
      getReq.onerror = () => reject(getReq.error);
    });
  }

  async function getChart(id) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_CHARTS, 'readonly');
      const store = tx.objectStore(STORE_CHARTS);
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async function listCharts() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_CHARTS, 'readonly');
      const store = tx.objectStore(STORE_CHARTS);
      const request = store.getAll();
      request.onsuccess = () => {
        const results = request.result || [];
        results.sort((a, b) => b.createdAt - a.createdAt);
        resolve(results);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async function deleteChart(id) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_CHARTS, 'readwrite');
      const store = tx.objectStore(STORE_CHARTS);
      const request = store.delete(id);
      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(request.error);
    });
  }

  // ---------- 設定 ----------

  async function getSetting(key, defaultValue = null) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_SETTINGS, 'readonly');
      const store = tx.objectStore(STORE_SETTINGS);
      const request = store.get(key);
      request.onsuccess = () => {
        resolve(request.result ? request.result.value : defaultValue);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async function setSetting(key, value) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_SETTINGS, 'readwrite');
      const store = tx.objectStore(STORE_SETTINGS);
      const request = store.put({ key, value });
      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(request.error);
    });
  }

  return {
    openDB,
    saveChart,
    updateChart,
    getChart,
    listCharts,
    deleteChart,
    getSetting,
    setSetting
  };
})();
