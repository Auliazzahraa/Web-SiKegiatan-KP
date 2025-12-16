import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { useEffect } from "react";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { db } from "./services/firebase";
import { doc, setDoc } from "firebase/firestore";
import { getMessaging, getToken, onMessage } from "firebase/messaging";


//import Landingpage from "./pages/landingpage";
import Login from "./pages/login";
import SignUp from "./pages/signup";
import Home from "./pages/pegawai/home";
import ForgotPassword from "./pages/forgotPassword";
import EditProfile from "./pages/editprofile";
import Dashboard from "./pages/admin/dashboard";
import BuktiKegiatan from "./pages/pegawai/buktiKegiatan";
import LihatBuktiKeg from "./pages/admin/lihatBuktiKeg";
import UsersProfile from "./pages/admin/usersProfile";
import AuthCallback from "./pages/pegawai/AuthCallback";
import ProtectedRoute from "./assets/components/ProtectedRoute";
import AdminRoute from "./assets/components/AdminRoute";
import { app } from "./services/firebase";



function App() {
  useEffect(() => {
    const auth = getAuth();
    const messaging = getMessaging();

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // ✅ minta izin dulu
        const permission = await Notification.requestPermission();

        if (permission === "granted") {
          try {
            // ambil FCM token
            const token = await getToken(messaging, {
              vapidKey:
                "BGYmngkWXAzQ6tJGFoIzzxIw-MOjO1_j6zQmeV6d2q31aV2dYRME2YziSZH1THztBefQArhmmI77ZnFKbfc7rsY",
            });

            if (token) {
              await setDoc(
                doc(db, "users", user.uid),
                { fcmToken: token },
                { merge: true }
              );
              console.log("✅ FCM Token disimpan:", token);
            } else {
              console.log("⚠️ Tidak ada token FCM tersedia");
            }
          } catch (error) {
            console.error("❌ Gagal ambil FCM token:", error);
          }
        } else {
          console.log("❌ User menolak izin notifikasi");
        }
      }
    });

    // ✅ Listener foreground notification
    const unsubscribeMsg = onMessage(messaging, (payload) => {
      console.log("📩 Notif foreground diterima:", payload);
      alert(`${payload.notification.title}\n${payload.notification.body}`);
    });

    return () => {
      unsubscribe();
      unsubscribeMsg();
    };
  }, []);


  return (
    <Router>
      <Routes>
        <Route path="/" element={<Login/>} />
        <Route path="/login" element={<Navigate to="/" replace />} />
        <Route path="/signup" element={<SignUp />} />
        <Route
          path="/home"
          element={
            <ProtectedRoute>
              <Home />
            </ProtectedRoute>
          }
        />

        <Route
          path="/bukti-kegiatan"
          element={
            <ProtectedRoute>
              <BuktiKegiatan />
            </ProtectedRoute>
          }
        />

        <Route
          path="/edit-profile"
          element={
            <ProtectedRoute>
              <EditProfile />
            </ProtectedRoute>
          }
        />
        <Route path="/forgot-password" element={<ForgotPassword/>} />
            <Route element={<AdminRoute />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/admin-lihat-bukti" element={<LihatBuktiKeg />} />
            <Route path="/admin-users" element={<UsersProfile />} />
      </Route>
        <Route path="/auth/callback" element={<AuthCallback />} />
      </Routes>
    </Router>
  );
}

export default App;
