import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getAuth, signOut } from "firebase/auth";
import {
  getFirestore,
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
  onSnapshot,
} from "firebase/firestore";
import { Menu, X } from "lucide-react";
import dayjs from "dayjs";
import Sidebar from "../../assets/components/sidebar";
import "dayjs/locale/id"; // agar nama bulan pakai Bahasa Indonesia
dayjs.locale("id");

export default function Home() {
  const auth = getAuth();
  const db = getFirestore();
  const navigate = useNavigate();

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [userData, setUserData] = useState(null);
  const [kegiatanHariIni, setKegiatanHariIni] = useState(null);

  useEffect(() => {
  let unsubscribeKegiatanNow;
  let unsubscribeKegiatanNext;

  const unsubscribeAuth = auth.onAuthStateChanged(async (user) => {
    if (user) {
      const uid = user.uid;
      const userDocRef = doc(db, "users", uid);
      const userSnap = await getDoc(userDocRef);
      if (!userSnap.exists()) return;

      const userProfile = {
        displayName: user.displayName || userSnap.data().nama || "User",
        photoURL: userSnap.data().photoURL || user.photoURL || "/profilepict.png",
        ...userSnap.data(),
      };
      setUserData(userProfile);

      const today = dayjs().startOf("day").toDate();
      const tomorrow = dayjs().add(1, "day").startOf("day").toDate();

      // bulan sekarang dan bulan depan
      const bulanSekarang = dayjs(today).format("MMMM-YYYY").toLowerCase();
      const bulanDepan = dayjs(today).add(1, "month").format("MMMM-YYYY").toLowerCase();

      const entriesNow = collection(db, "jadwal", bulanSekarang, "entries");
      const entriesNext = collection(db, "jadwal", bulanDepan, "entries");

      const qNow = query(
        entriesNow,
        where("tanggal", ">=", today),
        where("tanggal", "<", tomorrow),
        where("nipKegiatan", "array-contains", userSnap.data().nip)
      );

      const qNext = query(
        entriesNext,
        where("tanggal", ">=", today),
        where("tanggal", "<", tomorrow),
        where("nipKegiatan", "array-contains", userSnap.data().nip)
      );

      // Listener bulan sekarang
      unsubscribeKegiatanNow = onSnapshot(qNow, (snapshot) => {
        const list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        setKegiatanHariIni((prev) => [...list]); // overwrite (karena hari ini hanya 1 hari)
      });

      // Listener bulan depan
      unsubscribeKegiatanNext = onSnapshot(qNext, (snapshot) => {
        const list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        setKegiatanHariIni((prev) => [...prev, ...list]);
      });
    } else {
      navigate("/");
      if (unsubscribeKegiatanNow) unsubscribeKegiatanNow();
      if (unsubscribeKegiatanNext) unsubscribeKegiatanNext();
    }
  });

  return () => {
    unsubscribeAuth();
    if (unsubscribeKegiatanNow) unsubscribeKegiatanNow();
    if (unsubscribeKegiatanNext) unsubscribeKegiatanNext();
  };
}, [auth, db, navigate]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate("/");
    } catch (error) {
      console.error("Logout gagal:", error);
    }
  };

  const goToEdit = () => navigate("/edit-profile");

  if (!userData) {
    return <div className="p-8 text-center">🔄 Memuat data...</div>;
  }

  console.log("kegiatanHariIni", kegiatanHariIni);
  const kegiatanFlat = kegiatanHariIni?.flat() || [];
  const kegiatanDalamGedung = kegiatanFlat.filter(item => item.jenisKegiatan?.toLowerCase() === "dalam ruangan");
  const kegiatanLuarGedung = kegiatanFlat.filter(item => item.jenisKegiatan?.toLowerCase() === "luar ruangan");


  return (
    <div className="flex min-h-screen bg-gray-100 text-gray-800">
      {/* Sidebar */}
     <div className="sticky top-0 h-screen">
        <Sidebar/>
      </div>
      {/* Main Content */}
      <div className="flex-1 p-4 sm:p-10">
        {/* Profile Section */}
        <div className="bg-white p-4 sm:p-6 rounded-2xl shadow mb-6 flex flex-col sm:flex-row items-center sm:items-start gap-6">
          <img 
            src={userData.photoURL || "/profilepict.png"} 
            alt="Foto Profil" 
            className="w-24 h-24 rounded-full object-cover" 
          />
          <div className="text-center sm:text-left">
            <h2 className="text-2xl sm:text-3xl font-bold">{userData.displayName}</h2>
            <p className="text-white-600">NIP : {userData.nip || "-"}</p>
            <p className="text-white-600">Jabatan : {userData.jabatan || "-"}</p>
          </div>
        </div>

        {/* Kegiatan Hari Ini */}
        <div className="bg-white p-6 rounded-2xl shadow mb-6">
          <h3 className="text-lg sm:text-xl font-semibold mb-4">Kegiatan Hari Ini:</h3>
          {kegiatanFlat.length > 0 ? (
            <ul className="list-disc list-inside space-y-2">
              <li>
                <strong>Dalam Ruangan:</strong>
                <ul className="list-disc list-inside ml-6">
                  {kegiatanDalamGedung.map((item, idx) => (
                    <li
                      key={`dalam-${idx}`}
                      className="text-blue-600 hover:underline cursor-pointer"
                      onClick={() =>
                        navigate("/bukti-kegiatan", {
                          state: { kegiatanId: `${item.namaKegiatan}_${item.lokasi}_${dayjs(item.tanggal.toDate()).format("YYYY-MM-DD")}` }
                        })
                      }
                    >
                      {item.namaKegiatan} di {item.lokasi}
                    </li>
                  ))}
                  {kegiatanDalamGedung.length === 0 && <li>-</li>}
                </ul>
              </li>
              <li>
                <strong>Luar Ruangan:</strong>
                <ul className="list-disc list-inside ml-6">
                  {kegiatanLuarGedung.map((item, idx) => (
                    <li
                      key={`luar-${idx}`}
                      className="text-blue-600 hover:underline cursor-pointer"
                      onClick={() =>
                        navigate("/bukti-kegiatan", {
                          state: { kegiatanId: `${item.namaKegiatan}_${item.lokasi}_${dayjs(item.tanggal.toDate()).format("YYYY-MM-DD")}` }
                        })
                      }
                    >
                      {item.namaKegiatan} di {item.lokasi}
                    </li>
                  ))}
                  {kegiatanLuarGedung.length === 0 && <li>-</li>}
                </ul>
              </li>
            </ul>
          ) : (
            <p>Tidak ada kegiatan hari ini.</p>
          )}
        </div>




        {/* Aksi */}
        <div className="flex flex-wrap gap-4">
          <button
            onClick={() => navigate("/bukti-kegiatan")}
            className="bg-[#006106] hover:bg-green-700 text-white font-semibold px-6 py-2 rounded"
          >
            Lihat & Upload Bukti Kegiatan
          </button>
        </div>
      </div>
    </div>
  );
}
