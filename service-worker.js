/**
 * service-worker.js — 離線快取
 * ------------------------------------------------------------
 * 策略：App Shell（HTML/CSS/JS/圖示）採 cache-first，
 * 確保安裝後即使離線也能開啟並使用（排盤運算全在本機完成，不需連網）。
 *
 * 注意：全部使用「相對路徑」，確保部署在 GitHub Pages 的子路徑
 * （例如 https://yourname.github.io/repo-name/）下也能正確運作。
 *
 * 每次更新程式碼後，請記得把 CACHE_VERSION 改成新版本號，
 * 否則使用者裝置上快取的舊版本不會自動更新。
 */

const CACHE_VERSION = 'ai-bazi-secretary-v1';

const APP_SHELL_FILES = [
  './',
  './index.html',
  './manifest.json',
  './css/style.css',
  './js/astro.js',
  './js/bazi.js',
  './js/ai-rules.js',
  './js/db.js',
  './js/app.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(APP_SHELL_FILES))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_VERSION)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // 只處理 GET 請求，且僅快取同源請求（避免快取 Google Fonts 以外的第三方資源出錯）
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request)
        .then((networkResponse) => {
          // 同源資源才寫入快取，跨網域字型檔案交給瀏覽器自行快取
          if (event.request.url.startsWith(self.location.origin)) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_VERSION).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          // 離線且無快取時，若是導覽請求則回退到 index.html
          if (event.request.mode === 'navigate') {
            return caches.match('./index.html');
          }
        });
    })
  );
});
