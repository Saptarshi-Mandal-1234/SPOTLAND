import { expect, test } from 'vitest';
import { stripJpegMetadata } from './photo-jpeg';
import { jpegIsMetadataFree } from '../worker/src/review-photos';
test('removes canvas ICC and private metadata while preserving JPEG scan bytes', () => {
  const clean = [0xff,0xd8,0xff,0xe0,0,4,1,2,0xff,0xda,0,2,3,4,0xff,0xd9];
  const encoded = new Uint8Array([0xff,0xd8,0xff,0xe2,0,4,7,8,0xff,0xe1,0,4,9,10,0xff,0xed,0,3,11,0xff,0xfe,0,3,12,...clean.slice(2)]);
  expect(jpegIsMetadataFree(encoded)).toBe(false);
  const stripped = stripJpegMetadata(encoded);
  expect([...stripped]).toEqual(clean);
  expect(jpegIsMetadataFree(stripped)).toBe(true);
});
test('rejects truncated segments and non-JPEG input instead of uploading them', () => {
  expect(() => stripJpegMetadata(new Uint8Array([1,2,3,4]))).toThrow();
  expect(() => stripJpegMetadata(new Uint8Array([0xff,0xd8,0xff,0xe2,0,100,0xff,0xd9]))).toThrow();
});
