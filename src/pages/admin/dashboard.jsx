import { useEffect, useState } from "react";
import { getAuth } from "firebase/auth";
import { doc, getDoc, collection, getDocs } from "firebase/firestore";
import { db, storage } from "../../services/firebase";
import { ref, uploadBytes } from "firebase/storage";
import * as XLSX from "xlsx";
import { useNavigate, Link } from "react-router-dom";
import ExcelUpload from "./excelUpload";
import {onAuthStateChanged } from "firebase/auth";
import UploadUserExcel from "./uploadUserExcel"; // pastikan path sesuai
import SidebarAdmin from "../../assets/components/sidebarAdmin";
import {query, where } from "firebase/firestore";


export default function Dashboard() {
  const navigate = useNavigate(); 
  const [role, setRole] = useState("");
  const [fileName, setFileName] = useState("");
  const [fileData, setFileData] = useState([]);
  const [loadingParse, setLoadingParse] = useState(false);
  const [loadingUpload, setLoadingUpload] = useState(false);
  const [persentase, setPersentase] = useState(null);
  const [countDalam, setCountDalam] = useState(0);
  const [countLuar, setCountLuar] = useState(0);
  const [userData, setUserData] = useState(null);

  // Helper: ubah bulan angka → string (lowercase biar konsisten sama Firestore)
  const getBulanSekarang = () => {
    const date = new Date();
    const bulanNama = date.toLocaleString("id-ID", { month: "long" }); // misal: "Agustus"
    const tahun = date.getFullYear();
    return `${bulanNama.toLowerCase()}-${tahun}`; // "agustus-2025"
  };

  useEffect(() => {
  const auth = getAuth();

  const unsubscribe = onAuthStateChanged(auth, async (user) => {
    if (user) {
      try {
        const docRef = doc(db, "users", user.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const userData = docSnap.data();
          setRole(userData.role || "pegawai");
          
          const userProfile = {
          displayName: user.displayName,
          photoURL: user.photoURL || "/profilepict.png",
          ...docSnap.data(),
          };
          setUserData(userProfile);
          // ⛔️ Proteksi: jika bukan admin, tendang ke /home
          if (userData.role !== "admin") {
            navigate("/home");
          }
        }
      } catch (err) {
        console.error("❌ Gagal mengambil data role:", err);
      }
    } else {
      navigate("/");
    }
  });

  // Cleanup
  return () => unsubscribe();
}, [navigate]);

  useEffect(() => {
  const fetchData = async () => {
    try {
      const bulan = getBulanSekarang(); 
      const colRef = collection(db, "jadwal", bulan, "entries");

      // tentukan awal & akhir hari ini
      const today = new Date();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0);
      const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);

      // bikin query: hanya ambil kegiatan yang tanggalnya hari ini
      const q = query(
        colRef,
        where("tanggal", ">=", startOfDay),
        where("tanggal", "<=", endOfDay)
      );

      const snapshot = await getDocs(q);

      let totalLuar = 0;
      let punyaFoto = 0;
      let totalDalam = 0;

      snapshot.forEach((doc) => {
        const data = doc.data();

        if (data.jenisKegiatan?.toLowerCase() === "luar ruangan") {
          totalLuar++;
          if (data.foto && Array.isArray(data.foto)) {
            if (data.foto.length > 0 && data.foto.length <= 3) {
              punyaFoto++;
            }
          }
        } else if (data.jenisKegiatan?.toLowerCase() === "dalam ruangan") {
          totalDalam++;
        }
      });

      setCountLuar(totalLuar);
      setCountDalam(totalDalam);

      const persen = totalLuar > 0 ? (punyaFoto / totalLuar) * 100 : 0;
      setPersentase(persen.toFixed(2));
    } catch (error) {
      console.error("Error fetching data:", error);
    }
  };

  fetchData();
}, []);

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setFileName(file.name);

    // Upload ke Firebase Storage
    const storageRef = ref(storage, `uploads/${file.name}`);
    await uploadBytes(storageRef, file);

    // Baca isi XLSX-nya
    const reader = new FileReader();
    reader.onload = (evt) => {
      const data = evt.target.result;
      const workbook = XLSX.read(data, { type: "binary" });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const json = XLSX.utils.sheet_to_json(sheet, { defval: "" });
      setFileData(json.slice(0, 5)); // hanya preview 5 data
    };
    reader.readAsBinaryString(file);
  };

  if (!userData) {
    return <div className="p-8 text-center">🔄 Memuat data...</div>;
  }

  return (
    <div className="flex min-h-screen bg-white-100 font-sans">
      {/* Sidebar */}
      <div className="sticky top-0 h-screen">
        <SidebarAdmin/>
      </div>
      {/* Main Content */}
      <div className="flex-1 p-4 sm:p-10 overflow-x-hidden">
        {/* Greeting */}
        {/* <div className="bg-white h-40 p-4 sm:p-6 rounded-2xl shadow mb-6 flex flex-col sm:flex-row items-center sm:items-start gap-6"> */}
          {/* <img src={userData.photoURL} alt="Foto Profil" className="w-24 h-24 rounded-full object-cover" /> */}
          {/* <div className="text-center sm:text-left">
            <h2 className="text-2xl sm:text-3xl font-bold">{userData.displayName}</h2>
            <p className="text-white-600">NIP : {userData.nip || "-"}</p>
            <p className="text-white-600">Jabatan : {userData.jabatan || "-"}</p>
          </div> */}
          <div className="bg-[#4F7151] h-36 p-4 sm:h-48 sm:p-6 pl-8 sm:pl-12 rounded-2xl mb-6 flex items-center mt-6 sm:mt-4 shadow-md">
            <div className="text-left sm:text-left text-white">
              <h2 className="text-xl sm:text-3xl font-bold">
                Halo admin, {userData.displayName}! 👋
              </h2>
              <p className="text-xs sm:text-sm">NIP : {userData.nip || "-"}</p>
              <p className="text-xs sm:text-sm">Jabatan : {userData.jabatan || "-"}</p>
              <p className="text-xs sm:text-sm">
                Siap untuk melakukan kegiatan hari ini?
              </p>
            </div>
          </div>
           {/* Overview Cards */}
           <h2 className="text-xl sm:text-2xl font-bold mb-6 pl-1">Laporan Hari ini</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            
            <div className="p-4 bg-green-50 rounded-2xl shadow text-center">
              <h3 className="text-lg font-bold text-green-700">Kegiatan Dalam Ruangan</h3>
              <p className="text-2xl font-extrabold">{countDalam}</p>
            </div>
            <div className="p-4 bg-blue-50 rounded-2xl shadow text-center">
              <h3 className="text-lg font-bold text-blue-700">Kegiatan Luar Ruangan</h3>
              <p className="text-2xl font-extrabold">{countLuar}</p>
            </div>
            <div className="p-4 bg-white rounded shadow text-center">
              <h3 className="text-lg font-bold">Persentase Foto</h3>
              {persentase !== null ? (
                <p className="text-2xl font-extrabold">{persentase}%</p>
              ) : (
                <p>Loading...</p>
              )}
            </div>
          </div>
        {/* Upload Section */}
        <div className="mt-10">
            <ExcelUpload />
        </div>

        <div className="mt-10">
          <UploadUserExcel />
        </div>
      </div>
    </div>
  );
}
