import { useState } from "react";
import { useNavigate } from "react-router-dom";
import logo from "../assets/logopkm.png";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../services/firebase"; 
import { getDoc, doc } from "firebase/firestore";
import { db } from "../services/firebase";


export default function Login() {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);

  const [password, setPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState("");


  // cek inputan di email -> gaboleh gaada @gmail.com
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");

  const handleEmailChange = (e) => {
    const value = e.target.value;
    setEmail(value);
    // Validasi: harus mengandung @gmail dan format valid
    if (!value.includes("@gmail")) {
      setEmailError("Masukkan alamat email yang valid (contoh, user@example.com).");
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      setEmailError("Format email tidak valid");
    } else {
      setEmailError(""); // ✅ valid
    }
  };



  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg("");

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const uid = userCredential.user.uid;

      // Ambil data user dari Firestore
      const userDocRef = doc(db, "users", uid);
      const userDoc = await getDoc(userDocRef);

      if (userDoc.exists()) {
        const data = userDoc.data();
        const role = data.role;

        // Redirect berdasarkan role
        if (role === "admin") {
          navigate("/dashboard");
        } else {
          navigate("/home");
        }
      } else {
        setErrorMsg("Data pengguna tidak ditemukan di Firestore.");
      }

    } catch (error) {
      console.error("Login error:", error.message);
      setErrorMsg("Email atau password salah.");
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center bg-cover bg-center bg-black/40"
      style={{ backgroundImage: "url('/BG LOGIN.png')" }}
    >
      <div className="relative bg-white rounded-2xl shadow-lg p-4 pt-8 w-full max-w-[320px] sm:max-w-sm md:max-w-md">
        <div className="absolute -top-16 left-1/2 transform -translate-x-1/2">
          <img src={logo} alt="Logo" className="w-32 h-32 p-2" />
        </div>

        <br />
        <h2 className="text-2xl font-bold text-center text-gray-800">Sign In</h2>
        <p className="text-sm text-center text-gray-500 mb-4">Selamat datang kembali!</p>

        {errorMsg && (
          <div className="text-red-600 text-sm text-center mb-4">{errorMsg}</div>
        )}

        <form onSubmit={handleSubmit}>
          {/* email */}
          <div className="mb-4">
            <label className="block mb-1 text-sm font-medium text-gray-700">Email</label>
            <input
              type="email"
              placeholder="Masukkan Emailmu"
              value={email}
              onChange={handleEmailChange}
              className={`w-full border ${
                emailError ? "border-red-500" : "border-gray-300"
              } rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 ${
                emailError ? "focus:ring-red-500" : "focus:ring-green-500"
              }`}
              required
            />
            {emailError && (
              <p className="text-sm text-red-600 mt-1">{emailError}</p>
            )}
          </div>

          <div className="mb-3 relative">
            <label className="block mb-1 text-sm font-medium text-gray-700">Password</label>
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Masukkan Kata Sandi"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-9 text-gray-500 text-sm"
            >
              {showPassword ? "🙈" : "👁️"}
            </button>
          </div>

          <div
            className="text-right text-sm text-green-600 hover:underline mb-5 cursor-pointer"
            onClick={() => navigate("/forgot-password")}
          >
            forgot password?
          </div>


          <button
            type="submit"
            className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-2 rounded-full transition"
          >
            Sign in
          </button>
          <p className="mt-6 text-sm text-center text-gray-600">
            Belum memiliki akun?{" "}
            <span
              className="text-green-700 font-semibold hover:underline cursor-pointer"
              onClick={() => navigate("/signup")}
            >
              Sign Up
            </span>
          </p>
        </form>
      </div>
    </div>
  );
}
