import dayjs from "dayjs";
import { exportSemuaBukti} from "./exportSemuaBukti"; 
import { exportKegiatanToWord } from "./exportKegiatanToWord";
// <- ganti "./exportFunctions" sesuai lokasi 2 function kamu

// Export semua kegiatan
export const handleExportSemua = (data) => {
  console.log("▶️ handleExportSemua terpanggil, jumlah data:", data?.length);
  if (!data || data.length === 0) {
    alert("Tidak ada data untuk diexport");
    return;
  }
  exportSemuaBukti(data);
};

// Export per bulan
// Export per bulan
export const handleExportPerBulan = (data, bulanFilter) => {
  if (!data || data.length === 0) {
    alert("Tidak ada data untuk difilter");
    return;
  }
  if (!bulanFilter) {
    alert("Pilih bulan dulu sebelum export per bulan");
    return;
  }

  // Ubah bulanFilter dari "2025-08" jadi "August-2025"
  const bulanFilterFormatted = dayjs(bulanFilter, "YYYY-MM").format("MMMM-YYYY");

  const filtered = data.filter(
    (row) =>
      dayjs(row.tanggal.toDate()).format("MMMM-YYYY") === bulanFilterFormatted
  );

  if (filtered.length === 0) {
    alert(`Tidak ada kegiatan di bulan ${bulanFilterFormatted}`);
    return;
  }

  exportSemuaBukti(filtered);
};


// Export per kegiatan (1 row)
export const handleExportPerKegiatan = (row) => {
  if (!row) {
    alert("Data kegiatan tidak ditemukan");
    return;
  }
  exportKegiatanToWord(row);
};
