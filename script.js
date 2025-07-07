const input = document.getElementById('fileInput');
const preview = document.getElementById('preview');
const downloadBtn = document.getElementById('downloadBtn');
const info = document.getElementById('info');
const windowPositions = {};
let wpId = 0;
let generated = {};

input.addEventListener('change', () => {
  const files = Array.from(input.files);
  info.textContent = files.length + ' file dipilih';
  generated = {};
  downloadBtn.disabled = false;

  if (files.length === 1) {
    preview.style.display = 'block';
  } else {
    preview.style.display = 'none';
  }

  files.forEach(file => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const ytt = convertASS(reader.result);
        generated[file.name.replace(/\.ass$/i, '.ytt')] = ytt;
        if (files.length === 1) {
          preview.textContent = ytt;
        }
      } catch (error) {
        console.error('Error converting file:', error);
        info.textContent = `Error mengkonversi ${file.name}: ${error.message}`;
        preview.textContent = `Error:\n${error.stack}`;
        preview.style.display = 'block';
      }
    };
    reader.onerror = () => {
      info.textContent = `Gagal membaca file ${file.name}`;
    };
    reader.readAsText(file);
  });
});

downloadBtn.addEventListener('click', () => {
  if (Object.keys(generated).length === 0) return;
  if (Object.keys(generated).length === 1) {
    const name = Object.keys(generated)[0];
    downloadFile(name, generated[name]);
  } else {
    alert('Multiple file konversi mendukung satu per satu saat ini.');
  }
});

function downloadFile(filename, text) {
  const blob = new Blob([text], { type: 'application/xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function convertASS(assText) {
  const lines = assText.split(/\r?\n/);
  const dialogues = [];
  const styles = {};
  const pens = {};
  const windowPositions = {};
  const windowStyles = {};
  let wpId = 0;
  let wsId = 0;
  let penId = 0;

  // Helper for ytchroma colors
  const chromaColors = [
    '#FF0000', // Red
    '#00FF00', // Green
    '#0000FF', // Blue
    '#FFFF00', // Yellow
    '#00FFFF', // Cyan
    '#FF00FF', // Magenta
    '#FFFFFF', // White
  ];

  // Helper for ytshake offsets
  function getShakeOffset(i) {
    // Simple shake pattern, can be randomized for more effect
    const dx = [0, 2, -2, 1, -1, 0, 2, -2][i % 8];
    const dy = [0, 1, -1, 2, -2, 0, 1, -1][i % 8];
    return { dx, dy };
  }

  // Parse styles section
  let inStylesSection = false;
  lines.forEach(line => {
    if (line.startsWith('[V4+ Styles]')) {
      inStylesSection = true;
    } else if (line.startsWith('[') && inStylesSection) {
      inStylesSection = false;
    } else if (inStylesSection && line.startsWith('Style:')) {
      const parts = line.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/);
      const styleName = parts[0].replace('Style:', '').trim();
      styles[styleName] = {
        fontname: parts[1]?.trim() || 'Arial',
        fontsize: parseInt(parts[2]?.trim()) || 16,
        primaryColour: parseASSColor(parts[3]?.trim()),
        bold: parseInt(parts[7]?.trim()) || 0,
        italic: parseInt(parts[8]?.trim()) || 0,
        underline: parseInt(parts[9]?.trim()) || 0,
        alignment: parseInt(parts[18]?.trim()) || 2
      };
    }
  });

  // Parse dialogue lines
  lines.forEach(line => {
    if (line.startsWith('Dialogue:')) {
      const parts = line.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/);
      const start = parts[1]?.trim() || '0:00:00.00';
      const end = parts[2]?.trim() || '0:00:00.00';
      const styleName = parts[3]?.trim() || 'Default';
      const effect = parts[8]?.trim() || '';
      let text = parts.slice(9).join(',').trim();
      const startSec = toSeconds(start);
      const endSec = toSeconds(end);
      const dur = (endSec - startSec).toFixed(3);
      // Pecah per segmen {tag}text
      const segs = [];
      let lastIdx = 0;
      const tagRegex = /\{([^}]*)\}/g;
      let m;
      while ((m = tagRegex.exec(text)) !== null) {
        if (m.index > lastIdx) {
          // Text sebelum tag
          segs.push({ tags: '', text: text.substring(lastIdx, m.index) });
        }
        // Tag dan text setelahnya
        const nextTagEnd = tagRegex.lastIndex;
        // Cari text setelah tag sampai tag berikutnya atau akhir
        const nextTagStart = tagRegex.exec(text)?.index ?? text.length;
        tagRegex.lastIndex = nextTagEnd; // reset
        const segText = text.substring(nextTagEnd, nextTagStart).split('{')[0];
        segs.push({ tags: m[1], text: segText });
        lastIdx = nextTagEnd + segText.length;
      }
      if (lastIdx < text.length) {
        segs.push({ tags: '', text: text.substring(lastIdx) });
      }
      // Untuk setiap segmen, deteksi tag experimental
      let segStart = startSec;
      let segDur = (endSec - startSec) / segs.length;
      segs.forEach((seg, idx) => {
        if (!seg.text.trim()) return;
        const assTags = parseASSTags('{' + seg.tags + '}');
        const style = Object.assign({}, styles[styleName] || {
          fontname: 'Arial',
          fontsize: 16,
          primaryColour: '#FFFFFF',
          bold: 0,
          italic: 0,
          underline: 0,
          alignment: 2
        });
        // Inline tag override
        if (assTags.bold !== undefined) style.bold = assTags.bold;
        if (assTags.italic !== undefined) style.italic = assTags.italic;
        if (assTags.underline !== undefined) style.underline = assTags.underline;
        if (assTags.color) style.primaryColour = assTags.color;
        if (assTags.fontname) style.fontname = assTags.fontname;
        if (assTags.fontsize) style.fontsize = assTags.fontsize;
        // Pen id for this style
        const penKey = `${style.fontname}|${style.fontsize}|${style.primaryColour}|${style.bold}|${style.italic}|${style.underline}`;
        if (!(penKey in pens)) pens[penKey] = penId++;
        const penIdx = pens[penKey];
        // Window style id (alignment)
        const wsKey = `${style.alignment}`;
        if (!(wsKey in windowStyles)) windowStyles[wsKey] = wsId++;
        const wsIdx = windowStyles[wsKey];
        // Window position id
        let wpIdx = 0;
        if (assTags.position) {
          const posKey = `${assTags.position.x},${assTags.position.y}`;
          if (!(posKey in windowPositions)) windowPositions[posKey] = wpId++;
          wpIdx = windowPositions[posKey];
        } else if (assTags.movement) {
          const moveKey = `${assTags.movement.x1},${assTags.movement.y1},${assTags.movement.x2},${assTags.movement.y2}`;
          if (!(moveKey in windowPositions)) windowPositions[moveKey] = wpId++;
          wpIdx = windowPositions[moveKey];
        }
        // Tag experimental
        if (seg.tags.includes('ytchroma')) {
          // Bagi durasi segmen menjadi N bagian, tiap bagian warna berbeda
          const N = chromaColors.length;
          const chromaDur = (segDur * 1000) / N;
          for (let i = 0; i < N; i++) {
            const chromaPenKey = `${style.fontname}|${style.fontsize}|${chromaColors[i]}|${style.bold}|${style.italic}|${style.underline}`;
            if (!(chromaPenKey in pens)) pens[chromaPenKey] = penId++;
            const chromaPenIdx = pens[chromaPenKey];
            dialogues.push({
              start: (segStart + (i * chromaDur) / 1000).toFixed(3),
              dur: (chromaDur / 1000).toFixed(3),
              text: seg.text,
              style,
              penIdx: chromaPenIdx,
              wsIdx,
              wpIdx,
              karaoke: false
            });
          }
        } else if (seg.tags.includes('ytshake')) {
          // Bagi durasi segmen menjadi N bagian, tiap bagian posisi berbeda
          const N = 8;
          const shakeDur = (segDur * 1000) / N;
          for (let i = 0; i < N; i++) {
            const { dx, dy } = getShakeOffset(i);
            let shakePos = { x: 960 + dx * 5, y: 540 + dy * 5 };
            if (assTags.position) {
              shakePos = { x: assTags.position.x + dx * 5, y: assTags.position.y + dy * 5 };
            }
            const shakePosKey = `${shakePos.x},${shakePos.y}`;
            if (!(shakePosKey in windowPositions)) windowPositions[shakePosKey] = wpId++;
            const shakeWpIdx = windowPositions[shakePosKey];
            dialogues.push({
              start: (segStart + (i * shakeDur) / 1000).toFixed(3),
              dur: (shakeDur / 1000).toFixed(3),
              text: seg.text,
              style,
              penIdx,
              wsIdx,
              wpIdx: shakeWpIdx,
              karaoke: false
            });
          }
        } else if (seg.tags.includes('ytvert')) {
          // Teks vertikal: per huruf, posisi Y naik
          const baseX = assTags.position ? assTags.position.x : 960;
          const baseY = assTags.position ? assTags.position.y : 540;
          const stepY = 40; // Jarak antar huruf
          const N = seg.text.length;
          const vertDur = segDur / N;
          for (let i = 0; i < N; i++) {
            const vertPosKey = `${baseX},${baseY + i * stepY}`;
            if (!(vertPosKey in windowPositions)) windowPositions[vertPosKey] = wpId++;
            const vertWpIdx = windowPositions[vertPosKey];
            dialogues.push({
              start: (segStart + i * vertDur).toFixed(3),
              dur: vertDur.toFixed(3),
              text: seg.text[i],
              style,
              penIdx,
              wsIdx,
              wpIdx: vertWpIdx,
              karaoke: false
            });
          }
        } else if (seg.tags.includes('ytpack')) {
          // Teks padat: per huruf, posisi X naik
          const baseX = assTags.position ? assTags.position.x : 960;
          const baseY = assTags.position ? assTags.position.y : 540;
          const stepX = 30; // Jarak antar huruf
          const N = seg.text.length;
          const packDur = segDur / N;
          for (let i = 0; i < N; i++) {
            const packPosKey = `${baseX + i * stepX},${baseY}`;
            if (!(packPosKey in windowPositions)) windowPositions[packPosKey] = wpId++;
            const packWpIdx = windowPositions[packPosKey];
            dialogues.push({
              start: (segStart + i * packDur).toFixed(3),
              dur: packDur.toFixed(3),
              text: seg.text[i],
              style,
              penIdx,
              wsIdx,
              wpIdx: packWpIdx,
              karaoke: false
            });
          }
        } else if (seg.tags.includes('ytktGlitch')) {
          // Efek glitch: per huruf, warna/posisi acak, timing sangat pendek
          const baseX = assTags.position ? assTags.position.x : 960;
          const baseY = assTags.position ? assTags.position.y : 540;
          const N = seg.text.length;
          const glitchSteps = 6;
          const glitchDur = segDur / (N * glitchSteps);
          for (let i = 0; i < N; i++) {
            for (let j = 0; j < glitchSteps; j++) {
              // Warna acak dari chromaColors
              const color = chromaColors[Math.floor(Math.random() * chromaColors.length)];
              const glitchPenKey = `${style.fontname}|${style.fontsize}|${color}|${style.bold}|${style.italic}|${style.underline}`;
              if (!(glitchPenKey in pens)) pens[glitchPenKey] = penId++;
              const glitchPenIdx = pens[glitchPenKey];
              // Posisi acak
              const dx = Math.floor(Math.random() * 20) - 10;
              const dy = Math.floor(Math.random() * 20) - 10;
              const glitchPosKey = `${baseX + i * 30 + dx},${baseY + dy}`;
              if (!(glitchPosKey in windowPositions)) windowPositions[glitchPosKey] = wpId++;
              const glitchWpIdx = windowPositions[glitchPosKey];
              dialogues.push({
                start: (segStart + (i * glitchSteps + j) * glitchDur).toFixed(3),
                dur: glitchDur.toFixed(3),
                text: seg.text[i],
                style,
                penIdx: glitchPenIdx,
                wsIdx,
                wpIdx: glitchWpIdx,
                karaoke: false
              });
            }
          }
        } else if (seg.tags.includes('ytsub')) {
          // Subscript: posisi Y digeser ke bawah
          const baseX = assTags.position ? assTags.position.x : 960;
          const baseY = (assTags.position ? assTags.position.y : 540) + 40;
          const subPosKey = `${baseX},${baseY}`;
          if (!(subPosKey in windowPositions)) windowPositions[subPosKey] = wpId++;
          const subWpIdx = windowPositions[subPosKey];
          dialogues.push({
            start: (segStart).toFixed(3),
            dur: segDur.toFixed(3),
            text: seg.text,
            style,
            penIdx,
            wsIdx,
            wpIdx: subWpIdx,
            karaoke: false
          });
        } else if (seg.tags.includes('ytsup')) {
          // Superscript: posisi Y digeser ke atas
          const baseX = assTags.position ? assTags.position.x : 960;
          const baseY = (assTags.position ? assTags.position.y : 540) - 40;
          const supPosKey = `${baseX},${baseY}`;
          if (!(supPosKey in windowPositions)) windowPositions[supPosKey] = wpId++;
          const supWpIdx = windowPositions[supPosKey];
          dialogues.push({
            start: (segStart).toFixed(3),
            dur: segDur.toFixed(3),
            text: seg.text,
            style,
            penIdx,
            wsIdx,
            wpIdx: supWpIdx,
            karaoke: false
          });
        } else {
          // Default: satu segmen saja
          dialogues.push({
            start: (segStart).toFixed(3),
            dur: segDur.toFixed(3),
            text: seg.text,
            style,
            penIdx,
            wsIdx,
            wpIdx,
            karaoke: false
          });
        }
        segStart += segDur;
      });
    }
  });

  // Generate YTT with styles
  let ytt = `<?xml version="1.0" encoding="utf-8"?>\n<timedtext format="3">\n<head>\n`;
  // Generate <wp>
  Object.entries(windowPositions).forEach(([key, id]) => {
    const coords = key.split(',').map(Number);
    if (coords.length === 2) {
      ytt += `  <wp id="${id}" ap="7" ah="${Math.round(coords[0]/19.2)}" av="${Math.round(coords[1]/10.8)}" />\n`;
    } else if (coords.length === 4) {
      ytt += `  <wp id="${id}" ap="7" ah="${Math.round(coords[0]/19.2)}" av="${Math.round(coords[1]/10.8)}" />\n`;
    }
  });
  // Generate <ws>
  Object.entries(windowStyles).forEach(([key, id]) => {
    let ju = 2;
    if (key === '1') ju = 0;
    else if (key === '2') ju = 1;
    else if (key === '3') ju = 2;
    ytt += `  <ws id="${id}" ju="${ju}" pd="0" sd="0" />\n`;
  });
  // Generate <pen>
  Object.entries(pens).forEach(([key, id]) => {
    const [fontname, fontsize, color, bold, italic, underline] = key.split('|');
    ytt += `  <pen id="${id}" fc="${color}" sz="${parseInt(fontsize)*100}" b="${bold}" i="${italic}" u="${underline}" fo="255" bo="0" et="3" ec="#000000" />\n`;
  });
  ytt += `</head>\n<body>\n`;
  // Output <p> for each dialogue
  dialogues.forEach((d, i) => {
    const escText = d.text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    ytt += `  <p t="${Math.round(parseFloat(d.start) * 1000)}" d="${Math.round(parseFloat(d.dur) * 1000)}" p="${d.penIdx}" wp="${d.wpIdx}" ws="${d.wsIdx}">${escText}</p>\n`;
  });
  ytt += `</body>\n</timedtext>`;
  return ytt;
}

function parseASSTags(text) {
  const tags = {};
  const tagMatches = text.match(/\{.*?\}/g);
  if (!tagMatches) return tags;

  tagMatches.forEach(tag => {
    // Bold
    const boldMatch = tag.match(/\\b(\d+)/);
    if (boldMatch) tags.bold = parseInt(boldMatch[1]);
    
    // Italic
    const italicMatch = tag.match(/\\i(\d+)/);
    if (italicMatch) tags.italic = parseInt(italicMatch[1]);
    
    // Underline
    const underlineMatch = tag.match(/\\u(\d+)/);
    if (underlineMatch) tags.underline = parseInt(underlineMatch[1]);
    
    // Color
    const colorMatch = tag.match(/\\c&H([0-9A-Fa-f]{6})&/);
    if (colorMatch) tags.color = `#${colorMatch[1].substring(4,6)}${colorMatch[1].substring(2,4)}${colorMatch[1].substring(0,2)}`;
    
    // Font name
    const fontMatch = tag.match(/\\fn([^\\}]+)/);
    if (fontMatch) tags.fontname = fontMatch[1];
    
    // Font size
    const sizeMatch = tag.match(/\\fs(\d+)/);
    if (sizeMatch) tags.fontsize = parseInt(sizeMatch[1]);
    
    // Position
    const posMatch = tag.match(/\\pos\(([\d.]+),([\d.]+)\)/);
    if (posMatch) tags.position = { x: parseFloat(posMatch[1]), y: parseFloat(posMatch[2]) };
    
    // Movement
    const moveMatch = tag.match(/\\move\(([\d.]+),([\d.]+),([\d.]+),([\d.]+)\)/);
    if (moveMatch) tags.movement = {
      x1: parseFloat(moveMatch[1]),
      y1: parseFloat(moveMatch[2]),
      x2: parseFloat(moveMatch[3]),
      y2: parseFloat(moveMatch[4])
    };
    
    // Karaoke
    const karaokeMatch = tag.match(/\\k(\d+)/);
    if (karaokeMatch) tags.karaoke = (tags.karaoke || []).concat(parseInt(karaokeMatch[1]));
    
    // Fade
    const fadeMatch = tag.match(/\\fad\((\d+),(\d+)\)/);
    if (fadeMatch) tags.fade = {
      in: parseInt(fadeMatch[1]),
      out: parseInt(fadeMatch[2])
    };
  });
  
  return tags;
}

function parseASSColor(colorStr) {
  if (!colorStr || !colorStr.startsWith('&H')) return '#FFFFFF';
  const hex = colorStr.substring(2).padStart(6, '0');
  return `#${hex.substring(4,6)}${hex.substring(2,4)}${hex.substring(0,2)}`;
}

// toSeconds function remains the same
function toSeconds(timeStr) {
  const m = timeStr.match(/(\d+):(\d+):(\d+)\.(\d+)/);
  if (!m) return 0;
  const [, h, mnt, s, cs] = m.map(Number);
  return h * 3600 + mnt * 60 + s + cs/100;
}

function toSeconds(timeStr) {
  if (!timeStr) return 0;
  
  // Handle berbagai format waktu:
  // 1. H:MM:SS.CS
  // 2. H:MM:SS:CS (beberapa editor menggunakan colon)
  // 3. H:MM:SS
  const m = timeStr.match(/(\d+):(\d+):(\d+)[:.](\d+)/) || 
            timeStr.match(/(\d+):(\d+):(\d+)/);
  
  if (!m) {
    console.warn(`Format waktu tidak dikenali: ${timeStr}`);
    return 0;
  }
  
  const h = parseInt(m[1]);
  const mnt = parseInt(m[2]);
  const s = parseInt(m[3]);
  const cs = m[4] ? parseInt(m[4]) : 0;
  
  return h * 3600 + mnt * 60 + s + cs/100;
}