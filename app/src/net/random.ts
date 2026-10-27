// tweetnacl needs a secure random source. React Native has none by default.
import nacl from 'tweetnacl';
import { getRandomBytes } from 'expo-crypto';

nacl.setPRNG((x, n) => {
  const b = getRandomBytes(n);
  for (let i = 0; i < n; i++) x[i] = b[i];
  b.fill(0);
});
