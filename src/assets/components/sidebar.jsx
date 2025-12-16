import { useEffect, useState } from "react";
import { FaHome, FaCalendarAlt, FaUser, FaSignOutAlt, FaBars, FaTimes } from "react-icons/fa";
import { useNavigate, useLocation } from "react-router-dom";
import { getAuth, signOut, onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../../services/firebase";
import { doc, getDoc, onSnapshot} from "firebase/firestore";
import dayjs from "dayjs";



export default function Sidebar({ children }) {
  const [userData, setUserData] = useState(null);
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navigate = useNavigate();
  const auth = getAuth()

  // Handle Logout
  const handleLogout = async () => {
    await signOut(auth);
    navigate("/", { replace: true }); // replace biar back ga balik ke private page
  };


  useEffect(() => {

    setSidebarOpen(true);
    const timer = setTimeout(() => {
      setSidebarOpen(false);
    }, 1000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
  const authInst = getAuth();
  let unsubUserDoc = null;

  const unsubAuth = onAuthStateChanged(authInst, (user) => {
    // jangan navigate di sini (biar gak auto “logout” pas reload)
    if (!user) {
      setUserData(null);
      return;
    }

    const userRef = doc(db, "users", user.uid);

    // realtime listener
    unsubUserDoc = onSnapshot(userRef, (snap) => {
      const data = snap.data() || {};
      setUserData({
        uid: user.uid,
        displayName: user.displayName,
        photoURL: data.photoURL || user.photoURL || "/profilepict.png",
        ...data,
      });
    });
  });

  return () => {
    unsubAuth();
    if (unsubUserDoc) unsubUserDoc();
  };
}, []);


  const menuItems = [
    { label: "Home", path: "/home", icon: <FaHome /> },
    { label: "Jadwal", path: "/bukti-kegiatan", icon: <FaCalendarAlt /> },
    { label: "Profile", path: "/edit-profile", icon: <FaUser /> },
  ];

  return (
    <div className="flex">
      <div
        className={`fixed left-0 top-0 h-screen bg-[#E6F0E9] text-[#006106] p-4 transition-all duration-300 flex flex-col ${
          sidebarOpen ? "w-64" : "w-16"
        }`}
      >
        <div>
          {/* Tombol buka/tutup */}
          <div className="flex justify-end mb-4 mr-1.5">
            <button onClick={() => setSidebarOpen(!sidebarOpen)}>
              {sidebarOpen ? <FaTimes size={20} /> : <FaBars size={20} />}
            </button>
          </div>

         
          {!sidebarOpen && (
            <div className="flex justify-center mb-4">
              <div className="w-10 h-10 rounded-full overflow-hidden border">
                <img
                  src={userData?.photoURL || "/profilepict.png"}
                  alt="User"
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          )}
          {/* Header + Profile */}
          <div className="mb-4">
            {sidebarOpen && (
              <div className="flex items-center gap-3">
                <img
                  src={userData?.photoURL || "/profilepict.png"}
                  alt="Foto Profil"
                  className="w-12 h-12 rounded-full object-cover border"
                />
                <div className="min-w-0">
                  <p className="font-bold leading-tight truncate text-sm sm:text-base md:text-lg">
                    {userData?.nama || userData?.displayName || "User"}
                  </p>

                  <p className="text-gray-600 truncate text-xs sm:text-sm md:text-base">
                    NIP: {userData?.nip || "-"}
                  </p>

                  <p className="text-gray-600 truncate text-xs sm:text-sm md:text-base">
                    Jabatan: {userData?.jabatan || "-"}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Menu Section */}
          <div>
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

        {/* Logout di pojok kiri bawah */}
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
};
