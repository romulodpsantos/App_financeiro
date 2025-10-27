// sw.js - Service Worker para PWA Offline
const CACHE_NAME = 'controle-financeiro-v4.1';
const urlsToCache = [
  '/',
  '/index.html',
  '/style.css', 
  '/app.js',
  '/manifest.json',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css',
  'https://cdn.jsdelivr.net/npm/chart.js'
];

self.addEventListener('install', event => {
  console.log('🔄 Service Worker instalando...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('✅ Cache aberto - adicionando recursos');
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        console.log('✅ Todos os recursos em cache');
        return self.skipWaiting();
      })
      .catch(error => {
        console.error('❌ Erro ao fazer cache:', error);
      })
  );
});

self.addEventListener('activate', event => {
  console.log('🔄 Service Worker ativando...');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('🗑️ Removendo cache antigo:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('✅ Service Worker ativado');
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', event => {
  // Ignora requisições para APIs externas que não podemos cachear
  if (event.request.url.includes('google') || 
      event.request.url.includes('facebook') ||
      event.request.method !== 'GET') {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Retorna do cache se encontrado
        if (response) {
          return response;
        }

        // Faz requisição e adiciona ao cache
        return fetch(event.request).then(response => {
          // Verifica se é uma resposta válida
          if(!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }

          // Clona a resposta
          const responseToCache = response.clone();

          caches.open(CACHE_NAME)
            .then(cache => {
              cache.put(event.request, responseToCache);
            });

          return response;
        }).catch(() => {
          // Fallback para página offline se a requisição falhar
          if (event.request.destination === 'document') {
            return caches.match('/index.html');
          }
        });
      })
  );
});

// Sincronização em background quando voltar online
self.addEventListener('sync', event => {
  if (event.tag === 'background-sync') {
    console.log('🔄 Sincronizando dados...');
    event.waitUntil(doBackgroundSync());
  }
});

async function doBackgroundSync() {
  // Aqui você pode adicionar lógica de sincronização
  // quando o app voltar a ficar online
  console.log('✅ Sincronização concluída');
}