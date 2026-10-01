// Canvas encoders can add ICC profiles. Strip metadata before the private upload.
export function stripJpegMetadata(data: Uint8Array): Uint8Array<ArrayBuffer> {
  if (data.length < 4 || data[0] !== 0xff || data[1] !== 0xd8 || data[data.length - 2] !== 0xff || data[data.length - 1] !== 0xd9) throw new Error('Photo encoding failed. Try another image.');
  const chunks: Uint8Array[] = [data.slice(0, 2)];
  let offset = 2;
  while (offset < data.length) {
    const start = offset;
    if (data[offset] !== 0xff) throw new Error('Photo encoding failed. Try another image.');
    while (data[offset] === 0xff) offset++;
    const marker = data[offset++];
    if (marker === 0xda) {
      const length = (data[offset] << 8) | data[offset + 1];
      if (length < 2 || offset + length > data.length - 2) throw new Error('Photo encoding failed. Try another image.');
      chunks.push(data.slice(start));
      const clean = new Uint8Array(chunks.reduce((size, chunk) => size + chunk.length, 0));
      let cursor = 0;
      for (const chunk of chunks) { clean.set(chunk, cursor); cursor += chunk.length; }
      return clean;
    }
    if (marker === 0xd9 || marker === 0 || offset + 1 >= data.length) throw new Error('Photo encoding failed. Try another image.');
    const length = (data[offset] << 8) | data[offset + 1];
    if (length < 2 || offset + length > data.length) throw new Error('Photo encoding failed. Try another image.');
    offset += length;
    if (![0xe1, 0xe2, 0xed, 0xfe].includes(marker)) chunks.push(data.slice(start, offset));
  }
  throw new Error('Photo encoding failed. Try another image.');
}
