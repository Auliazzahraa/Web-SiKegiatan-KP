import { useState, useRef } from "react";
import * as XLSX from "xlsx";
import { doc, setDoc } from "firebase/firestore";
import { db } from "../../services/firebase";
import toast, { Toaster } from "react-hot-toast";


export default function UploadUserExcel() {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef(null);

  const [successMessage, setSuccessMessage] = useState("");

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
    //setSuccessMessage("");
  };

  const handleUpload = async () => {
    if (!file) {
      toast.error("⚠️ Pilih file Excel terlebih dahulu.");
      return;
    }

    setLoading(true);
    toast.loading("📂 Sedang parsing file...");

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = e.target.result;
        const workbook = XLSX.read(data, { type: "binary" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(sheet);

        toast.dismiss(); // tutup toast parsing
        toast.loading("☁️ Mengupload data ke Firestore...");

        const uploadPromises = json.map(async (user, index) => {
        // Normalisasi key agar tidak tergantung huruf besar/kecil
        const nip = user["NIP"] || user["nip"];
        const nama = user["Nama"] || user["nama"];
        const jabatan = user["Jabatan"] || user["jabatan"];
        const role = user["Role"] || user["role"];

        if (!nip || !nama || !jabatan || !role) {
            console.warn(`❌ Baris ${index + 2} dilewati karena data tidak lengkap.`);
            return;
        }

        const docRef = doc(db, "users_pending", nip.toString());
        await setDoc(docRef, {
            nama,
            jabatan,
            role,
            nip: nip.toString(),
        });
        });

        await Promise.all(uploadPromises);
        toast.dismiss();
        toast.success("✅ Data berhasil diunggah ke users_pending!");

        // reset file
        setFile(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      } catch (err) {
        console.error("🔥 Gagal upload:", err);
        alert("Terjadi kesalahan saat upload: " + err.message);
      } finally {
        setLoading(false);
      }
    };

    reader.readAsBinaryString(file);
  };

  return (
    <div className="space-y-4 border p-4 sm:p-6 pl-8 sm:pl-12 bg-white rounded-2xl shadow-md">
      <Toaster position="top-right" reverseOrder={false} />
      <h2 className="text-lg font-semibold text-text-black">Upload Data User</h2>

      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx, .xls"
        onChange={handleFileChange}
        className="border px-3 py-2 rounded"
      />

      <button
        onClick={handleUpload}
        disabled={!file || loading}
        className="bg-[#017C08] hover:bg-[#4F7151] text-white px-5 py-2 rounded disabled:opacity-50 ml-5"
      >
        {loading ? "Mengupload..." : "Upload User"}
      </button>

      {successMessage && <p className="text-green-600">{successMessage}</p>}
    </div>
  );
}
