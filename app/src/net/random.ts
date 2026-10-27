// tweetnacl behöver en säker slumpkälla. I React Native saknas den som standard.
import nacl from 'tweetnacl';
import { getRandomBytes } from 'expo-crypto';

nacl.setPRNG((x, n) => {
  const b = getRandomBytes(n);
  for (let i = 0; i < n; i++) x[i] = b[i];
  b.fill(0);
});
