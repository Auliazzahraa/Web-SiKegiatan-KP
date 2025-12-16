import { Document, Packer, Paragraph, TextRun, ImageRun } from "docx";
import { saveAs } from "file-saver";
import axios from "axios";

async function fetchImageBuffer(imageUrl) {
  const response = await axios.get(imageUrl, { responseType: "arraybuffer" });
  return response.data;
}

async function getImageDimensions(arrayBuffer) {
  return new Promise((resolve) => {
    const blob = new Blob([arrayBuffer]);
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.width, height: img.height });
      URL.revokeObjectURL(url);
    };
    img.src = url;
  });
}

async function fetchLocalImageBuffer(path) {
  const response = await fetch(path);
  return await response.arrayBuffer();
}

export async function exportSemuaBukti(kegiatanList) {
  console.log("▶️ exportSemuaBukti dipanggil, kegiatanList:", kegiatanList);
  if (!Array.isArray(kegiatanList) || kegiatanList.length === 0) {
    alert("Tidak ada kegiatan untuk diekspor.");
    return;
  }

  // 🔹 Filter hanya kegiatan luar ruangan
  const filteredList = kegiatanList.filter(
    (k) => k.jenisKegiatan?.toLowerCase() === "luar ruangan"
  );
  console.log("▶️ Filter kegiatan luar ruangan:", filteredList.length);
  if (filteredList.length === 0) {
    alert("Tidak ada kegiatan luar ruangan untuk diekspor.");
    return;
  }

  const paragraphs = [];

  // --- Halaman 1: Kop surat ---
  try {
    console.log("▶️ Mencoba fetch kop surat...");
    const kopBuffer = await fetchLocalImageBuffer("/KOPSURAT.png");
    console.log("✅ Kop surat berhasil diambil, buffer size:", kopBuffer.byteLength);
    paragraphs.push(
      new Paragraph({
        children: [
          new ImageRun({
            data: kopBuffer,
            transformation: { width: 600, height: 150 },
          }),
        ],
        alignment: "center",
      }),
      new Paragraph({ text: "" }),
      new Paragraph({ text: "" }),
      new Paragraph({ text: "" })
    );
  } catch (err) {
    console.error("❌ Gagal ambil kop surat:", err);
  }

  // --- Halaman berikutnya: Per kegiatan ---
  for (let i = 0; i < filteredList.length; i++) {
  const kegiatan = filteredList[i];
  console.log(`▶️ Generate halaman kegiatan ke-${i + 1}:`, kegiatan.namaKegiatan);

  if (i > 0) {
    paragraphs.push(new Paragraph({ pageBreakBefore: true }));
  }

  const tanggalFormatted = kegiatan.tanggal?.toDate
    ? kegiatan.tanggal.toDate().toLocaleDateString("id-ID")
    : kegiatan.tanggal || "-";

  paragraphs.push(
    new Paragraph({
      alignment: "center",
      children: [
        new TextRun({
          text: kegiatan.namaKegiatan?.toUpperCase() || "-",
          bold: true,
          font: "Arial",
          size: 32,
        }),
      ],
    }),
    new Paragraph({
      alignment: "center",
      children: [
        new TextRun({
          text: `Di ${kegiatan.lokasi?.toUpperCase() || "-"}`,
          font: "Arial",
          size: 28,
        }),
      ],
    }),
    new Paragraph({
      alignment: "center",
      children: [
        new TextRun({
          text: tanggalFormatted,
          font: "Arial",
          size: 24,
        }),
      ],
    }),
    new Paragraph({ text: "" })
  );

    if (Array.isArray(kegiatan.foto) && kegiatan.foto.length > 0) {
  for (const fotoObj of kegiatan.foto) {
    try {
      // sekarang ambil url dari object
      const imgBuffer = await fetchImageBuffer(fotoObj.url);
      console.log("▶️ Ambil gambar:", fotoObj);

      const { width, height } = await getImageDimensions(imgBuffer);

      const maxWidth = 500;
      let finalWidth = width;
      let finalHeight = height;

      if (width > maxWidth) {
        const scale = maxWidth / width;
        finalWidth = maxWidth;
        finalHeight = Math.round(height * scale);
      }

      paragraphs.push(
        new Paragraph({ text: "", spacing: { after: 200 } }),
        new Paragraph({
          children: [
            new ImageRun({
              data: imgBuffer,
              transformation: { width: finalWidth, height: finalHeight },
            }),
          ],
          alignment: "center",
        })
      );
    } catch (err) {
      console.log("ℹ️ Kegiatan tidak ada foto:", kegiatan.namaKegiatan);
      console.error("❌ Gagal ambil gambar:", err);
    }
  }
}
 else {
      paragraphs.push(
        new Paragraph({
          alignment: "center",
          children: [
            new TextRun({
              text: "[GAMBAR DOKUMENTASI]",
              font: "Arial",
              size: 24,
            }),
          ],
        })
      );
    }
  }

  const doc = new Document({ sections: [{ properties: {}, children: paragraphs }] });
  console.log("📄 Jumlah paragraph:", paragraphs.length);
  const blob = await Packer.toBlob(doc);
  console.log("📦 Blob ready, size:", blob.size);
  saveAs(blob, `Semua_Dokumentasi_Kegiatan.docx`);
  console.log("✅ Selesai generate dokumen, siap download");
}
