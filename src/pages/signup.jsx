import { useState } from "react";
import { useNavigate } from "react-router-dom";
import logo from "../assets/logopkm.png";

import {
  createUserWithEmailAndPassword,
  updateProfile,
  deleteUser,
  signOut,
} from "firebase/auth";

import { auth, db } from "../services/firebase";
import {
  doc,
  setDoc,
  getDoc,
  query,
  where,
  collection,
  getDocs,
  serverTimestamp,
} from "firebase/firestore";

export default function SignUp() {
  const navigate = useNavigate();

  const [nip, setNip] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [errorMsg, setErrorMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const friendlyAuthError = (error) => {
    const code = error?.code || "";
    if (code === "auth/email-already-in-use") return "Email sudah terdaftar. Silakan login.";
    if (code === "auth/weak-password") return "Password terlalu lemah. Minimal 6 karakter.";
    if (code === "auth/invalid-email") return "Format email tidak valid.";
    if (code === "auth/network-request-failed") return "Koneksi bermasalah. Coba lagi.";
    return "Terjadi kesalahan. Coba lagi beberapa saat.";
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;

    setErrorMsg("");

    const nipClean = nip.trim();
    const emailClean = email.trim();

    if (!nipClean) return setErrorMsg("NIP wajib diisi.");
    if (!emailClean) return setErrorMsg("Email wajib diisi.");
    if (password.length < 6) return setErrorMsg("Password minimal 6 karakter.");
    if (password !== confirmPassword) return setErrorMsg("Password dan konfirmasi tidak cocok.");

    setLoading(true);

    try {
      // 1) cek NIP ada di users_pending (boleh walau belum login)
      const pendingRef = doc(db, "users_pending", nipClean);
      const pendingSnap = await getDoc(pendingRef);

      if (!pendingSnap.exists()) {
        setErrorMsg("NIP tidak ditemukan atau belum didaftarkan admin.");
        setLoading(false);
        return;
      }

      const pendingData = pendingSnap.data();

      // 2) buat user auth (setelah ini user akan "login")
      const userCredential = await createUserWithEmailAndPassword(auth, emailClean, password);
      const createdUser = userCredential.user;

      // 3) SEKARANG baru aman query ke users (karena request.auth != null)
      const qUsers = query(collection(db, "users"), where("nip", "==", nipClean));
      const usersSnap = await getDocs(qUsers);

      if (!usersSnap.empty) {
        // NIP sudah dipakai → hapus akun auth yg baru dibuat
        try {
          await deleteUser(createdUser);
        } catch (delErr) {
          // kalau gagal delete, minimal signOut dulu
          console.warn("Gagal delete user auth baru:", delErr);
          await signOut(auth);
        }

        setErrorMsg("NIP sudah terdaftar. Silakan login.");
        setLoading(false);
        return;
      }

      // 4) update profile displayName
      await updateProfile(createdUser, {
        displayName: pendingData.nama || "User",
      });

      // 5) simpan profil ke Firestore users/{uid}
      await setDoc(doc(db, "users", createdUser.uid), {
        nip: nipClean,
        nama: pendingData.nama || "",
        jabatan: pendingData.jabatan || "",
        role: pendingData.role || "pegawai",
        email: emailClean,
        createdAt: serverTimestamp(),
      });

      navigate("/", { replace: true });
    } catch (error) {
      console.error("Signup error:", error);
      setErrorMsg(friendlyAuthError(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center bg-cover bg-center bg-black/40"
      style={{ backgroundImage: "url('/BG LOGIN.png')" }}
    >
      <div className="relative bg-white rounded-2xl shadow-lg p-6 w-full max-w-md">
        <div className="absolute -top-16 left-1/2 transform -translate-x-1/2">
          <img src={logo} alt="Logo" className="w-32 h-32 p-2" />
        </div>

        <h2 className="text-2xl font-bold text-center text-gray-800 mt-20">Sign Up</h2>
        <p className="text-sm text-center text-gray-500 mb-4">Silakan daftar menggunakan NIP</p>

        {errorMsg && (
          <div className="text-red-600 text-sm text-center mb-4">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block mb-1 text-sm font-medium text-gray-700">NIP</label>
            <input
              type="text"
              value={nip}
              onChange={(e) => setNip(e.target.value)}
              required
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              placeholder="Masukkan NIP"
              disabled={loading}
            />
          </div>

          <div>
            <label className="block mb-1 text-sm font-medium text-gray-700">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              placeholder="Masukkan Email"
              disabled={loading}
            />
          </div>

          <div>
            <label className="block mb-1 text-sm font-medium text-gray-700">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              placeholder="Minimal 6 karakter"
              disabled={loading}
            />
          </div>

          <div>
            <label className="block mb-1 text-sm font-medium text-gray-700">Konfirmasi Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              placeholder="Ulangi Password"
              disabled={loading}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-2 rounded-full transition disabled:opacity-60"
          >
            {loading ? "Memproses..." : "Daftar"}
          </button>

          <p className="text-sm text-center text-gray-600 mt-4">
            Sudah punya akun?{" "}
            <span
              className="text-green-700 font-semibold hover:underline cursor-pointer"
              onClick={() => navigate("/")}
            >
              Login
            </span>
          </p>
        </form>
      </div>
    </div>
  );
}
