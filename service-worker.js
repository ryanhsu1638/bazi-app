/**
 * service-worker.js — 離線快取
 * ------------------------------------------------------------
 * 策略（v3 起改進）：
 *   - index.html（頁面本體）：network-first
 *     優先向伺服器要最新版本；只有在離線抓不到網路時，才退回使用快取。
 *     這樣您每次更新程式碼、重新上傳到 GitHub 後，使用者下次打開 App
 *     只要有網路，就會自動抓到最新版本，不需要手動清快取或重新安裝。
 *   - CSS / JS / 圖示：cache-first
 *     這些檔案內容有變動時，只要版本號有更新（見下方 CACHE_VERSION），
 *     舊快取會在 activate 階段被清掉，改抓新的一份並存入新快取。
 *
 * 全部使用「相對路徑」，確保部署在 GitHub Pages 的子路徑
 * （例如 https://yourname.github.io/repo-name/）下也能正確運作。
 *
 * 每次更新程式碼後，請記得把 CACHE_VERSION 改成新版本號，
 * 這樣才能讓「靜態資源」（CSS/JS/圖示）的舊快取被清除、換成新版。
 * （HTML 本體因為改成 network-first，不太需要靠這個版本號才能更新，
 *   但養成習慣一起改版本號，可以確保萬無一失。）
 */

const CACHE_VERSION = 'ai-bazi-secretary-v14';

const APP_SHELL_FILES = [
  './',
  './index.html',
  './manifest.json',
  './css/style.css',
  './js/astro.js',
  './js/bazi.js',
  './js/matching.js',
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
  if (event.request.method !== 'GET') return;

  const isNavigationRequest =
    event.request.mode === 'navigate' || event.request.url.endsWith('/index.html');

  if (isNavigationRequest) {
    // ---------- 頁面本體：network-first ----------
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(event.request, responseClone));
          return networkResponse;
        })
        .catch(() => caches.match(event.request).then((cached) => cached || caches.match('./index.html')))
    );
    return;
  }

  // ---------- 其他靜態資源：cache-first ----------
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request)
        .then((networkResponse) => {
          if (event.request.url.startsWith(self.location.origin)) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_VERSION).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          if (event.request.mode === 'navigate') {
            return caches.match('./index.html');
          }
        });
    })
  );
});

