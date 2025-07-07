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
      
      // Parse ASS tags
      const assTags = parseASSTags(text);
      text = text.replace(/\{.*?\}/g, '').trim();

      const startSec = toSeconds(start);
      const endSec = toSeconds(end);
      const dur = (endSec - startSec).toFixed(3);

      // Get style or use default
      const style = styles[styleName] || {
        fontname: 'Arial',
        fontsize: 16,
        primaryColour: '#FFFFFF',
        bold: 0,
        italic: 0,
        underline: 0,
        alignment: 2
      };

      // Apply inline tags to override style
      if (assTags.bold !== undefined) style.bold = assTags.bold;
      if (assTags.italic !== undefined) style.italic = assTags.italic;
      if (assTags.underline !== undefined) style.underline = assTags.underline;
      if (assTags.color) style.primaryColour = assTags.color;
      if (assTags.fontname) style.fontname = assTags.fontname;
      if (assTags.fontsize) style.fontsize = assTags.fontsize;

      dialogues.push({ 
        start: startSec.toFixed(3), 
        dur, 
        text,
        style,
        effect,
        position: assTags.position,
        movement: assTags.movement,
        karaoke: assTags.karaoke,
        fade: assTags.fade,

        // Tambahkan posisi window berdasarkan pos atau move
        if (position) {
          const posKey = `${position.x},${position.y}`;
          if (!windowPositions[posKey]) {
            windowPositions[posKey] = wpId++;
          }
        },
        if (movement) {
          const moveKey = `${movement.x1},${movement.y1},${movement.x2},${movement.y2}`;
          if (!windowPositions[moveKey]) {
            windowPositions[moveKey] = wpId++;
          }
        }

      });
     }
  });

  // Generate YTT with styles
  let ytt = `<?xml version="1.0" encoding="utf-8"?>\n<timedtext format="3">\n<head>\n`;
  
  // Add pen definitions for styles
  Object.entries(styles).forEach(([name, style], i) => {
    ytt += `  <pen id="${i}" fc="${style.primaryColour}" sz="${style.fontsize * 100}" `;
    ytt += `b="${style.bold}" i="${style.italic}" u="${style.underline}" `;
    ytt += `fo="255" bo="0" et="3" ec="#000000" />\n`;
  });
  
  // Add default pens for overrides
  ytt += `  <pen id="100" fc="#FFFFFF" sz="1600" b="1" i="0" u="0" fo="255" bo="0" et="3" ec="#000000" />\n`;
  ytt += `  <pen id="101" fc="#FF0000" sz="1600" b="0" i="1" u="0" fo="255" bo="0" et="3" ec="#000000" />\n`;
  ytt += `  <pen id="102" fc="#00FF00" sz="1600" b="0" i="0" u="1" fo="255" bo="0" et="3" ec="#000000" />\n`;
  
  ytt += `  <ws id="0" ju="0" pd="0" sd="0" />\n`;
  ytt += `  <ws id="1" ju="1" pd="0" sd="0" />\n`;
  ytt += `  <ws id="2" ju="2" pd="0" sd="0" />\n`;
  ytt += `</head>\n<body>\n`;

  Object.entries(windowPositions).forEach(([key, id]) => {
  const coords = key.split(',').map(Number);
  if (coords.length === 2) {
    // Static position
    ytt += `  <wp id="${id}" ap="7" ah="${Math.round(coords[0]/19.2)}" av="${Math.round(coords[1]/10.8)}" />\n`;
  } else if (coords.length === 4) {
    // Movement start position (belum support animasi gerak penuh)
    ytt += `  <wp id="${id}" ap="7" ah="${Math.round(coords[0]/19.2)}" av="${Math.round(coords[1]/10.8)}" />\n`;
  }
});
  
  dialogues.forEach((d, i) => {
    const escText = d.text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    
    // Determine pen based on style
    let penId = 0; // default
    if (d.style.bold && !d.style.italic && !d.style.underline) penId = 100;
    else if (!d.style.bold && d.style.italic && !d.style.underline) penId = 101;
    else if (!d.style.bold && !d.style.italic && d.style.underline) penId = 102;
    
    // Determine alignment (1=left, 2=center, 3=right)
    const wsId = d.style.alignment >= 1 && d.style.alignment <= 3 ? d.style.alignment - 1 : 1;
    
    ytt += `  <p t="${Math.round(parseFloat(d.start) * 1000)}" d="${Math.round(parseFloat(d.dur) * 1000)}" `;
    
    let wpKey = '0';
    if (d.position) wpKey = `${d.position.x},${d.position.y}`;
    else if (d.movement) wpKey = `${d.movement.x1},${d.movement.y1},${d.movement.x2},${d.movement.y2}`;
    const wp = windowPositions[wpKey] ?? 0;

    ytt += `  <p t="${Math.round(parseFloat(d.start) * 1000)}" d="${Math.round(parseFloat(d.dur) * 1000)}" `;
    ytt += `p="${penId}" wp="${wp}" ws="${wsId}">${escText}</p>\n`;

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