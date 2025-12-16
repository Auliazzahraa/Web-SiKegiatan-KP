// main.jsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { GoogleOAuthProvider } from "@react-oauth/google";
import "./index.css";

import App from "./App.jsx";

import { app } from "./services/firebase";
import { getMessaging, getToken, onMessage } from "firebase/messaging";

const messaging = getMessaging(app);

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID}>
      <App />
    </GoogleOAuthProvider>
  </StrictMode>
);

// ✅ Register Service Worker + FCM
if ("serviceWorker" in navigator) {
  navigator.serviceWorker
    .register("/firebase-messaging-sw.js")
    .then(async (registration) => {
      console.log("✅ SW terdaftar:", registration);

      // 1) minta izin notif
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        console.log("❌ User menolak izin notifikasi");
        return;
      }

      // 2) ambil token FCM (WAJIB pakai serviceWorkerRegistration)
      try {
        const token = await getToken(messaging, {
          vapidKey: import.meta.env.VITE_VAPID_KEY,
          serviceWorkerRegistration: registration,
        });

        if (token) {
          console.log("🔑 FCM token:", token);
        } else {
          console.log("⚠️ Tidak bisa mendapatkan token FCM");
        }
      } catch (err) {
        console.error("❌ Gagal ambil token FCM:", err);
      }

      // 3) Foreground listener (notif saat app sedang dibuka)
      onMessage(messaging, (payload) => {
        console.log("📩 Foreground notif diterima:", payload);

        const title = payload.notification?.title || "Notifikasi";
        const options = {
          body: payload.notification?.body || "Ada pesan baru.",
          icon: payload.notification?.image || "/logopkm.png",
          data: { url: payload.data?.url || "/home" },
        };

        // tampilkan notif browser
        new Notification(title, options);
      });
    })
    .catch((err) => console.error("❌ Registrasi SW gagal:", err));
}
