import { useEffect, useState } from "react";
import { FaHome, FaCalendarAlt, FaSignOutAlt, FaBars, FaTimes, FaUsers } from "react-icons/fa";
import { useNavigate, useLocation } from "react-router-dom";
import { getAuth, signOut, onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../../services/firebase";
import { doc, getDoc} from "firebase/firestore";
import dayjs from "dayjs";


export default function SidebarAdmin({ children }) {
  const [userData, setUserData] = useState(null);
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navigate = useNavigate();
  const auth = getAuth()

  // Handle Logout
  const handleLogout = async () => {
  await signOut(auth);
    navigate("/", { replace: true }); // ✅ biar history diganti
  };


  useEffect(() => {

    setSidebarOpen(true);
    const timer = setTimeout(() => {
      setSidebarOpen(false);
    }, 1000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const uid = user.uid;

        // Ambil profil dari Firestore
        const userDocRef = doc(db, "users", uid);
        const userSnap = await getDoc(userDocRef);
        if (!userSnap.exists()) return;

        const userProfile = {
          displayName: user.displayName,
          photoURL: user.photoURL || "/profilepict.png",
          ...userSnap.data(),
        };
        setUserData(userProfile);
      } else {
        navigate("/", { replace: true }); //  jangan nambah history
      }

    });

    return () => unsubscribe();
  }, []);

const menuItems = [
  { label: "Home", path: "/dashboard", icon: <FaHome /> },
  { label: "Jadwal", path: "/admin-lihat-bukti", icon: <FaCalendarAlt /> },
  { label: "Users", path: "/admin-users", icon: <FaUsers /> }, // ⬅️ menu baru
];


  return (
    <div className="flex">
      {/* Sidebar */}
      <div
        className={`fixed left-0 top-0 h-screen bg-[#E8F1E8] text-[#006106] p-4 transition-all duration-300 flex flex-col rounded-tr-2xl rounded-br-2xl ${
          sidebarOpen ? "w-64" : "w-16"
        }`}
      >
        <div>
            <div className="flex justify-end mb-4 mr-1.5 pt-2">
                <button onClick={() => setSidebarOpen(!sidebarOpen)}>
                    {sidebarOpen ? <FaTimes size={20} /> : <FaBars size={20} />}
                </button>
            </div>

                {/* Menu Section */}
                <div className="pt-6">
                {menuItems.map((item) => (
                    <button
                    key={item.path}
                    onClick={() => navigate(item.path)}
                    className={`flex items-center gap-3 w-full px-2 py-3 rounded-lg mb-2 hover:bg-[#006106]/10 transition ${
                        location.pathname === item.path
                        ? "bg-[#006106]/10 font-semibold"
                        : ""
                    }`}
                    >
                    {item.icon}
                    {sidebarOpen && item.label}
                    </button>
                ))}
                </div>
        </div>
        

        {/* Logout */}
        <div className="mt-auto">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-2 py-3 rounded-lg hover:bg-red-100 text-red-600 transition"
          >
            <FaSignOutAlt />
            {sidebarOpen && "Logout"}
          </button>
        </div>
      </div>

      {/* Main content area */}
      <div
        className={`flex-1 transition-all duration-300 ${
          sidebarOpen ? "ml-64" : "ml-16"
        }`}
      >
        {children}
      </div>
    </div>
  );
}