/* eslint-disable no-undef */
importScripts("https://www.gstatic.com/firebasejs/9.6.11/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/9.6.11/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyDQJqHqomC-qXRcAzhpJnQBcxv-6KsBd_M",
  authDomain: "web-pkm-6c1e1.firebaseapp.com",
  projectId: "web-pkm-6c1e1",
  storageBucket: "web-pkm-6c1e1.firebasestorage.app",
  messagingSenderId: "39119738920",
  appId: "1:39119738920:web:2a056385a0c9c2a4e93d1d",
});

const messaging = firebase.messaging();

// 🔹 Terima notif background
messaging.onBackgroundMessage((payload) => {
  console.log("📩 Background notif diterima:", payload);

  const notificationTitle = payload.notification?.title || "Notifikasi";
  const notificationOptions = {
    body: payload.notification?.body || "Ada pesan baru.",
    icon: payload.notification?.image || "/logopkm.png",
    data: { url: payload.data?.url || "/home" },
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// 🔹 Klik notif → buka / fokus tab
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(event.notification.data?.url || "/home");
    })
  );
});

// 🔹 Auto update SW
self.addEventListener("install", (event) => {
  self.skipWaiting();
});
self.addEventListener("activate", (event) => {
  event.waitUntil(clients.claim());
});
