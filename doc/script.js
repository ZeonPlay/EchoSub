const styles = [
  {
    name: "Bold",
    tag: "\\b1",
    description: "Membuat teks menjadi tebal. Default: 0 (tidak tebal)."
  },
  {
    name: "Italic",
    tag: "\\i1",
    description: "Membuat teks menjadi miring. Default: 0 (normal)."
  },
  {
    name: "Underline",
    tag: "\\u1",
    description: "Memberi garis bawah pada teks. Default: 0 (tanpa garis bawah)."
  },
  {
    name: "Warna Teks",
    tag: "\\c&HBBGGRR&",
    description: "Mengubah warna teks. Format hex: &HBBGGRR&. Contoh: &H00FF00& untuk hijau."
  },
  {
    name: "Font",
    tag: "\\fnNamaFont",
    description: "Mengganti jenis font. Contoh: \\fnArial."
  },
  {
    name: "Ukuran Font",
    tag: "\\fs16",
    description: "Mengatur ukuran font. Angka menunjukkan besar font."
  },
  {
    name: "Posisi Tetap",
    tag: "\\pos(x,y)",
    description: "Menentukan posisi statis subtitle di layar. Koordinat dalam piksel."
  },
  {
    name: "Gerakan",
    tag: "\\move(x1,y1,x2,y2)",
    description: "Menentukan gerakan subtitle dari posisi awal ke posisi akhir."
  },
  {
    name: "Efek Karaoke",
    tag: "\\k<durasi>",
    description: "Menentukan durasi per suku kata (dalam centisecond) untuk efek karaoke."
  },
  {
    name: "Fade",
    tag: "\\fad(in,out)",
    description: "Menentukan durasi fade in dan fade out dalam milidetik."
  }
];

const section = document.getElementById("style-list");

styles.forEach(style => {
  const div = document.createElement("div");
  div.className = "style-entry";

  const title = document.createElement("h2");
  title.textContent = `${style.name} (${style.tag})`;

  const desc = document.createElement("p");
  desc.textContent = style.description;

  div.appendChild(title);
  div.appendChild(desc);

  section.appendChild(div);
});
