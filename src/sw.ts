/// <reference lib="WebWorker" />
/**
 * Custom service worker: precaches app shell and injects COOP/COEP headers on
 * navigation responses so SQLite WASM (which needs cross-origin isolation /
 * SharedArrayBuffer) keeps working while offline.
 */

import { clientsClaim } from 'workbox-core';
import { precacheAndRoute, createHandlerBoundToURL } from 'workbox-precaching';
import { registerRoute, NavigationRoute } from 'workbox-routing';

declare let self: ServiceWorkerGlobalScope & { __WB_MANIFEST: { url: string; revision: string | null }[] };

void self.skipWaiting();
clientsClaim();

precacheAndRoute(self.__WB_MANIFEST);

// Inject isolation headers required for SharedArrayBuffer (used by SQLite WASM).
const navigationHandler = createHandlerBoundToURL('/index.html');
registerRoute(
  new NavigationRoute(async (params) => {
    const response = await navigationHandler(params);
    const headers = new Headers(response.headers);
    headers.set('Cross-Origin-Opener-Policy', 'same-origin');
    headers.set('Cross-Origin-Embedder-Policy', 'require-corp');
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  }),
);
