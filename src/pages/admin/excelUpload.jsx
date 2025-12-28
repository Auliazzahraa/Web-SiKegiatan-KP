import { useState, useRef } from "react";
import * as XLSX from "xlsx";
import { setDoc, doc, Timestamp } from "firebase/firestore";
import { db } from "../../services/firebase";
import toast, { Toaster } from "react-hot-toast";

export default function ExcelUpload() {
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState([]);
  const [bulan, setBulan] = useState("");
  const [tahun, setTahun] = useState("");
  const [file, setFile] = useState(null);
  const [groupedData, setGroupedData] = useState({});
  const fileInputRef = useRef(null);

  const validateAndParse = async (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const data = evt.target.result;
          const workbook = XLSX.read(data, { type: "binary" });
          const sheet = workbook.Sheets[workbook.SheetNames[0]];
          const rawData = XLSX.utils.sheet_to_json(sheet);

          const tempErrors = [];
          const grouped = {};

          rawData.forEach((row, idx) => {
            const rowIndex = idx + 2; // header ada di row 1
            const nama = row["Nama Kegiatan"]?.trim();
            const lokasi = row["Lokasi"]?.trim();
            const jenis = row["Jenis Kegiatan"]?.trim();
            const nip = row["NIP"]?.toString().trim();
            const tanggalRaw = row["Tanggal"];

            const rowErrors = [];

            // cek kolom kosong
            if (!nama) rowErrors.push("Kolom 'Nama Kegiatan' kosong");
            if (!lokasi) rowErrors.push("Kolom 'Lokasi' kosong");
            if (!jenis) rowErrors.push("Kolom 'Jenis Kegiatan' kosong");
            if (!nip) rowErrors.push("Kolom 'NIP' kosong");
            if (!tanggalRaw) rowErrors.push("Kolom 'Tanggal' kosong");

            // cek NIP harus angka
            if (nip && !/^\d+$/.test(nip)) {
              rowErrors.push("Kolom 'NIP' tidak valid (harus angka)");
            }

            //  konversi & validasi tanggal
            let tanggalFinal = null;
            if (tanggalRaw) {
              if (typeof tanggalRaw === "number") {
                const baseDate = new Date(Date.UTC(1899, 11, 30));
                tanggalFinal = new Date(
                  baseDate.getTime() + tanggalRaw * 86400000
                );
              } else if (typeof tanggalRaw === "string") {
                const [day, month, year] = tanggalRaw.split("/");
                tanggalFinal = new Date(`${year}-${month}-${day}`);
              } else if (tanggalRaw instanceof Date) {
                tanggalFinal = tanggalRaw;
              }

              if (!tanggalFinal || isNaN(tanggalFinal.getTime())) {
                rowErrors.push("Kolom 'Tanggal' format salah");
              }
            }

            if (rowErrors.length > 0) {
              tempErrors.push({
                row: rowIndex,
                reason: rowErrors,
                data: row,
              });
              return; // skip grouping
            }

            // kalau valid → masukin ke group
            const key = `${nama}_${lokasi}_${jenis}_${tanggalFinal
              .toISOString()
              .split("T")[0]}`;

            if (!grouped[key]) {
              grouped[key] = {
                namaKegiatan: nama,
                lokasi,
                jenisKegiatan: jenis,
                tanggal: Timestamp.fromDate(tanggalFinal),
                nipKegiatan: [],
                foto: [],
              };
            }

            if (!grouped[key].nipKegiatan.includes(nip)) {
              grouped[key].nipKegiatan.push(nip);
            }
          });

          resolve({ errors: tempErrors, groupedData: grouped });
        } catch (err) {
          reject(err);
        }
      };
      reader.readAsBinaryString(file);
    });
  };

  const handleFileChange = async (e) => {
    const selectedFile = e.target.files[0];

    // reset dulu biar selalu fresh
    setFile(null);
    setErrors([]);
    setGroupedData({});

    if (selectedFile) {
      setFile(selectedFile);
      try {
        const { errors, groupedData } = await validateAndParse(selectedFile);
        setErrors(errors);
        setGroupedData(groupedData);

        if (errors.length > 0) {
          toast.error("❌ Ada data yang bermasalah, cek tabel error.");
        } else {
          toast.success("✅ File valid, siap untuk upload.");
        }
      } catch (err) {
        console.error("Parsing error:", err);
        toast.error("Gagal membaca file: " + err.message);
      } finally {
        // reset value supaya kalau pilih file sama pun tetap bisa trigger
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    }
  };

  const handleUpload = async () => {
    if (!file || !bulan || !tahun) {
      toast.error("⚠️ Mohon pilih bulan, tahun, dan file Excel terlebih dahulu.");
      return;
    }

    if (errors.length > 0) {
      toast.error("❌ Tidak bisa upload, masih ada data bermasalah.");
      return;
    }

    setLoading(true);

    try {
      const savePromises = Object.values(groupedData).map((item) => {
        const id = `${item.namaKegiatan}_${item.lokasi}_${item.tanggal
          .toDate()
          .toISOString()
          .split("T")[0]}`;
        const docRef = doc(db, "jadwal", `${bulan}-${tahun}`, "entries", id);
        return setDoc(docRef, item);
      });

      await Promise.all(savePromises);
      toast.success("✅ Upload berhasil!");

      // reset semua
      setFile(null);
      setGroupedData({});
      if (fileInputRef.current) fileInputRef.current.value = "";
      setBulan("");
      setTahun("");
    } catch (err) {
      console.error("🔥 Upload error:", err);
      toast.error("Terjadi kesalahan saat upload: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4 border p-4 sm:p-6 bg-white rounded-2xl shadow-md">
      <Toaster position="top-right" reverseOrder={false} />
      <h2 className="text-lg font-semibold text-black">Upload Jadwal</h2>

      {/* Dropdown Bulan & Tahun */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Pilih Bulan</label>
          <select
            value={bulan}
            onChange={(e) => setBulan(e.target.value)}
            className="border rounded px-3 py-2"
          >
            <option value="">-- Pilih Bulan --</option>
            {[
              "januari",
              "februari",
              "maret",
              "april",
              "mei",
              "juni",
              "juli",
              "agustus",
              "september",
              "oktober",
              "november",
              "desember",
            ].map((b) => (
              <option key={b} value={b}>
                {b.charAt(0).toUpperCase() + b.slice(1)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Pilih Tahun</label>
          <select
            value={tahun}
            onChange={(e) => setTahun(e.target.value)}
            className="border rounded px-3 py-2"
          >
            <option value="">-- Pilih Tahun --</option>
            {Array.from({ length: 81 }, (_, i) => 2020 + i).map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx, .xls"
        onChange={handleFileChange}
        className="border px-3 py-2 rounded"
      />

      {/* Tombol Upload */}
      <button
        onClick={handleUpload}
        disabled={!file || loading || errors.length > 0}
        className="bg-[#017C08] hover:bg-[#4F7151] text-white px-5 py-2 rounded disabled:opacity-50"
      >
        {loading ? "⏳ Memproses..." : "Upload Sekarang"}
      </button>

      {/* Preview error */}
      {errors.length > 0 && (
        <div className="mt-6">
          <h3 className="font-semibold text-red-600">⚠️ Data Bermasalah</h3>
          <table className="mt-2 w-full border text-sm">
            <thead className="bg-gray-100">
              <tr>
                <th className="border px-2 py-1">Row</th>
                <th className="border px-2 py-1">Alasan</th>
                <th className="border px-2 py-1">Detail</th>
              </tr>
            </thead>
            <tbody>
              {errors.map((err, i) => (
                <tr key={i} className="border">
                  <td className="border px-2 py-1">{err.row}</td>
                  <td className="border px-2 py-1 text-red-600">
                    {err.reason.map((r, idx) => (
                      <div key={idx}>- {r}</div>
                    ))}
                  </td>
                  <td className="border px-2 py-1">
                    {JSON.stringify(err.data)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
