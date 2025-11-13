/* eslint-disable no-undef */
importScripts(
  "https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js"
);
importScripts(
  "https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js"
);

let firebaseMessagingInstance = null;

function initializeFirebaseApp(config) {
  if (!config || !config.apiKey) {
    console.warn(
      "[FCM SW] Configuración de Firebase inválida o incompleta.",
      config
    );
    return;
  }

  if (!firebase.apps.length) {
    firebase.initializeApp(config);
  }

  if (!firebaseMessagingInstance) {
    firebaseMessagingInstance = firebase.messaging();
    firebaseMessagingInstance.onBackgroundMessage((payload) => {
      const title =
        payload.notification?.title ||
        `Alerta en ${payload.data?.deviceId || "el dispositivo"}`;
      const notificationOptions = {
        body:
          payload.notification?.body ||
          payload.data?.message ||
          "Nueva alerta del sistema de monitoreo.",
        data: payload.data,
      };

      self.registration.showNotification(title, notificationOptions);
    });
  }
}

self.addEventListener("message", (event) => {
  if (event.data?.type === "INIT_FIREBASE" && event.data.config) {
    initializeFirebaseApp(event.data.config);
  }
});

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});
