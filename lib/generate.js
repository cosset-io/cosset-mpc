const crypto = require('crypto');
const fs = require('fs');

const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
});

fs.writeFile(
  './client/keys/public.pem',
  publicKey.export({
    format: 'pem',
    type: 'pkcs1',
  }),
  console.log,
);

fs.writeFile(
  './client/keys/private.pem',
  privateKey.export({
    format: 'pem',
    type: 'pkcs1',
  }),
  console.log,
);
