// Reads only the top-level MP4 box headers (a few tiny reads, never the whole file).
// "Fast start" = the moov box (the index) comes BEFORE mdat (the video data), so playback can begin while downloading.
const fs = require('fs');
const cache = new Map();
function mp4Layout(file) {
  let fd; try {
    fd = fs.openSync(file, 'r'); const st = fs.fstatSync(fd), key = `${file}:${st.size}:${st.mtimeMs}`;
    if (cache.has(key)) return cache.get(key);
    const b = Buffer.alloc(16); let pos = 0, moov = -1, mdat = -1;
    for (let i = 0; i < 5000 && pos + 8 <= st.size && (moov < 0 || mdat < 0); i++) {
      if (fs.readSync(fd, b, 0, 16, pos) < 8) break;
      let size = b.readUInt32BE(0); const type = b.toString('latin1', 4, 8); let hdr = 8;
      if (size === 1) { size = Number(b.readBigUInt64BE(8)); hdr = 16; } else if (size === 0) size = st.size - pos;
      if (!/^[\x20-\x7e]{4}$/.test(type) || size < hdr) break;
      if (type === 'moov' && moov < 0) moov = pos; if (type === 'mdat' && mdat < 0) mdat = pos;
      pos += size;
    }
    const r = { faststart: moov >= 0 && mdat >= 0 ? moov < mdat : moov >= 0 ? true : null, moov, mdat };
    if (cache.size > 500) cache.clear(); cache.set(key, r); return r;
  } catch { return { faststart: null, moov: -1, mdat: -1 }; } finally { if (fd !== undefined) try { fs.closeSync(fd); } catch {} }
}
const FASTSTART_TIP = 'This MP4 stores its index (moov) after the video data (mdat), so browsers must download most of the file before it can start playing or seeking. It still plays, but slowly on big files. Fix without re-encoding (no quality loss): ffmpeg -i input.mp4 -c copy -movflags +faststart output.mp4 — then use “Replace file”.';
module.exports = { mp4Layout, FASTSTART_TIP };
