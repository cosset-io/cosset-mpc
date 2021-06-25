const { readFile } = require('fs');
const crypto = require('crypto');

async function loadPublicKey(path) {
  const data = await new Promise((resolve, reject) => {
    readFile(path, function (err, data) {
      if (err) {
        reject(err);
      }
      resolve(data);
    });
  });
  return crypto.createPublicKey(data);
}

async function loadPrivateKey(path) {
  const data = await new Promise((resolve, reject) => {
    readFile(path, function (err, data) {
      if (err) {
        reject(err);
      }
      resolve(data);
    });
  });
  return crypto.createPrivateKey(data);
}

function encrypt(publicKey, data) {
  return crypto.publicEncrypt(
    {
      key: publicKey,
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: 'sha256',
    },
    data,
  );
}

function decrypt(privateKey, data) {
  return crypto.privateDecrypt(
    {
      key: privateKey,
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: 'sha256',
    },
    data,
  );
}

module.exports = { loadPrivateKey, loadPublicKey, encrypt, decrypt };
