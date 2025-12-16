// /src/utils/exportToWord.js
import { Document, Packer, Paragraph, TextRun, ImageRun } from "docx";
import { saveAs } from "file-saver";
import axios from "axios";

async function fetchImageBuffer(imageUrl) {
  const response = await axios.get(imageUrl, { responseType: "arraybuffer" });
  return response.data;
}

export async function exportKegiatanToWord({ namaKegiatan, lokasi, tanggal, foto }) {
  const tanggalFormatted = tanggal.toDate().toLocaleDateString("id-ID");

  const paragraphs = [
    new Paragraph({ text: "PEMERINTAH KOTA TASIKMALAYA", bold: true, alignment: "center" }),
    new Paragraph({ text: "UPTD PUSKESMAS SANGKALI", bold: true, alignment: "center" }),
    new Paragraph({ text: "Jalan Tamansari No. 32 Phone 082240014606", alignment: "center" }),
    new Paragraph({ text: "E-mail : pkmsangkali@gmail.com", alignment: "center" }),
    new Paragraph({ text: "TASIKMALAYA", alignment: "center" }),
    new Paragraph({ text: "Kode Pos : 46166", alignment: "center" }),
    new Paragraph({ text: "" }),
    new Paragraph({ text: namaKegiatan.toUpperCase(), heading: "Heading1", alignment: "center", color : "black"}),
    new Paragraph({ text: `DI ${lokasi.toUpperCase()}`, alignment: "center" }),
    new Paragraph({ text: tanggalFormatted, alignment: "center" }),
    new Paragraph({ text: "" }),
  ];

  if (foto?.length > 0) {
    for (const url of foto) {
      try {
        const imgBuffer = await fetchImageBuffer(url);
        paragraphs.push(
          new Paragraph({ text: "", spacing: { after: 200 } }),
          new Paragraph({
            children: [
              new ImageRun({
                data: imgBuffer,
                transformation: { width: 400, height: 300 },
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
