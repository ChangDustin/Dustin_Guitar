// 測試開始前：產生調音器用的假麥克風音檔（110Hz 正弦波＝A2），不需要把二進位檔放進 repo
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export default function globalSetup() {
  const dir = fileURLToPath(new URL('./fixtures/', import.meta.url));
  const file = dir + 'a2-110hz.wav';
  if (existsSync(file)) return;
  mkdirSync(dir, { recursive: true });
  const rate = 48000, seconds = 6, n = rate * seconds;
  const buf = Buffer.alloc(44 + n * 2);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write('WAVE', 8);
  buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(rate, 24); buf.writeUInt32LE(rate * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34);
  buf.write('data', 36); buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) buf.writeInt16LE(Math.round(Math.sin((2 * Math.PI * 110 * i) / rate) * 0.6 * 32767), 44 + i * 2);
  writeFileSync(file, buf);
}
