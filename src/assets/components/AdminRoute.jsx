import { Navigate, Outlet } from "react-router-dom";
import { onAuthStateChanged, getAuth } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../services/firebase";
import { useEffect, useState } from "react";

export default function AdminRoute() {
  const [state, setState] = useState({ loading: true, ok: false });

  useEffect(() => {
    const auth = getAuth();
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) return setState({ loading: false, ok: false });

      const snap = await getDoc(doc(db, "users", user.uid));
      const role = snap.exists() ? snap.data()?.role : null; // sesuaikan field kamu
      setState({ loading: false, ok: role === "admin" });
    });

    return () => unsub();
  }, []);

  if (state.loading) return <div>Loading...</div>;
  return state.ok ? <Outlet /> : <Navigate to="/" replace />;
}
