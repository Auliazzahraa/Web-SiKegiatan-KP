import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getAuth, applyActionCode } from "firebase/auth";
import { doc, updateDoc, getDoc } from "firebase/firestore";
import { db } from "../../services/firebase";
import { toast } from "react-toastify";

export default function AuthCallback() {
  const auth = getAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const oobCode = params.get("oobCode");
    const mode = params.get("mode");

    if (mode === "verifyAndChangeEmail" && oobCode) {
      applyActionCode(auth, oobCode)
        .then(async () => {
          const user = auth.currentUser;
          if (!user) return;

          // Ambil pendingEmail dari Firestore
          const snap = await getDoc(doc(db, "users", user.uid));
          if (snap.exists() && snap.data().pendingEmail) {
            const newEmail = snap.data().pendingEmail;

            await updateDoc(doc(db, "users", user.uid), {
              email: newEmail,
              pendingEmail: "",
            });

            toast.success("Email berhasil diperbarui!");
          }

          navigate("/edit-profile"); // balik ke halaman profil
        })
        .catch((err) => {
          console.error("Error applyActionCode:", err);
          toast.error("Link tidak valid atau sudah digunakan.");
          navigate("/edit-profile");
        });
    }
  }, [auth, navigate]);

  return <p>Memproses verifikasi email...</p>;
}
