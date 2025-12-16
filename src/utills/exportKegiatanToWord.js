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

  // Tambahkan di atas
async function fetchLocalImageBuffer(path) {
  const response = await fetch(path);
  const arrayBuffer = await response.arrayBuffer();
  return arrayBuffer;
}

export async function exportKegiatanToWord({ namaKegiatan, lokasi, tanggal, foto }) {
  const tanggalFormatted = tanggal.toDate().toLocaleDateString("id-ID");

  const paragraphs = [];

  // Tambahkan gambar kop surat
  try {
    const kopBuffer = await fetchLocalImageBuffer("/KOPSURAT.png"); // letakkan di public/kop.png
    paragraphs.push(
      new Paragraph({
        children: [
          new ImageRun({
            data: kopBuffer,
            transformation: { width: 600, height: 150 }, // atur ukuran kop
          }),
        ],
        alignment: "center",
      }),
      new Paragraph({ text: "" }) // spasi setelah kop
    );
  } catch (err) {
    console.error("❌ Gagal ambil kop surat:", err);
  }

  // Judul kegiatan
  paragraphs.push(
    new Paragraph(
      { 
        alignment: "center",
        children: [
          new TextRun({
            text: namaKegiatan.toUpperCase(),
            bold: true,
            font: "Arial",
            size: 36, // 14pt (ukuran di docx itu x2)
            color: "000000", // hitam
          }),
        ],
       }
    ),
    new Paragraph(
      { 
        alignment: "center",
        children: [
          new TextRun({
            text: `Di ${lokasi.toUpperCase()}`,
            font: "Arial",
            size: 24, // 14pt (ukuran di docx itu x2)
            color: "000000", // hitam
          }),
        ],
       }
    ),
    new Paragraph({ text: tanggalFormatted, alignment: "center" }),
    new Paragraph({ text: "" })
  );


  // Foto kegiatan
  // Foto kegiatan
if (foto?.length > 0) {
  for (const fotoObj of foto) {
    try {
      const imgBuffer = await fetchImageBuffer(fotoObj.url); // ✅ ambil dari object
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
      console.error("❌ Gagal ambil gambar:", err);
    }
  }
} else {
  paragraphs.push(new Paragraph({ text: "[GAMBAR DOKUMENTASI]", alignment: "center" }));
}
  const doc = new Document({ sections: [{ properties: {}, children: paragraphs }] });
  const blob = await Packer.toBlob(doc);
  saveAs(blob, `${namaKegiatan}_${tanggalFormatted}.docx`);
}
