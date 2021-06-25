const fetch = require('node-fetch');
const EC = require('elliptic').ec;
const { Context } = require('crypto-mpc');

const { COSSET_API_URL, COSSET_CRYPTO_URL } = process.env;
const PEER = 2;

const share =
  'ec56c8758dff402e01002094ce24486793aa3256a5d82e3e102c926fcc2912a78936c1e460d6f0bf3c96e3010200471aecd28c45ad2143d659860e471b4b6e52ba58f365445236830b954c2c020a42cdf26fbd3be057fc2b9f099d8dc32e1b0d6afc64ac06ecefaa838e65e48ffc7324e10c5331a34a666f0aad260ec94330a331a3526931bc0767b2c524d9c8bc88b02c30e01783d00d1f08b83777980dc795765a454ef66e2b3042e70e59e78bc54729a6f7c36cacb66568d6be7f1b34a94ddec824e176a65bf520db00376f96b336615a7922e2fe41e0f68aa3e31feecbe24a579601740ce633d31c31df3a4d9b4630505a246dc901f83a9e8b14755e881616f61b4355d4fd7d5e589e090c59dfd4e2810c7a473da0d93d8ad8ce430834a7b99178845ad8a390cf17ab8456cbb3f57c664f3ed682da6b745ec090dd66f99ca810ddb25fa656771907a07e812c57720391e4b134ae272e1599561a2ce45b7a6b7c487188ea65f3150d6b33aba3244739c75fa6d94a9addaadedff38e267cddc315063c66fa4e6e2ae78867a9965ba4d7211f18e087c63e5811cdfbaafde9e7ab9b035eeb35da2ac1b3011fd0c1bb6d903b88d53607fc6dda757793d46c75a768b3a3b8437c150fd0a9f657e83f6fef5982c2a661c1436d6ab385a47fb7441da6229a07b8da0638dd9f0cfd46de4eacdb729dbded2c8a479261cdc5702208bf38d77e20ce550656ae61876eea58e904b58048004a54849506a345677f2ece77feb0d4b7c3d7d6fa32877a9fee75000000000002ca002102231549ed10267ede8f17187b1cba66f1a4236992ecbcc08610ad1de1bc4981bb01050000010100e272e5c3f155d03e8b98cb35bd0a012e4ccc8563888e1760e8cf6e9c7480773514b4b599609e0b0172ca990010a5dce940fa61534798ae129171c0de033445b50da2f6c478caa1e0b515f5877132e5605209ea2d6e2ab92bba2a4b8129fa040cd2db5f7ac4160ddcde7d763944fc3ba97c5655ac89b11cb92d917361a2fc1549576e5a03d6f6cdf200a2f1213c21cc54bd07e048278b50d8af1e3bcc7b6382b4ec5c6affe294f1d631c669440e9d46b2fa429ccd22e8fbd70fea08b274fc56d7d5e54a0fbd20de871955bf56a4c807d75940740c2aca00cd6477e41fa32f4c9d1fcd0a3602b5308b90e29dbd7fb23aeb7ac93047c5fa7641ef7b4faba55fdc7d00000000000000000000000000000000000000000000000000000000000000000043bca730c19d4e0cea2e0db05f673aaa';
const token =
  'eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE2MjU2NTEyODAsImlhdCI6MTYyMzA1OTI4MCwic3ViIjoiMSJ9.Lree1NAW5v0yh4LACeqo937-xi_FSTi5vJgvEorEDibXPHRU7Z35nw2WiqAThFwadLWUvFKDuXOeBcAjjgUeaQ';

const ETH_ACCOUNT = 338; // Ether
const CST_ACCOUNT = 339; // Cosset

const accountID = ETH_ACCOUNT;

const headers = {
  'Content-Type': 'application/json',
  Authorization: `Bearer ${token}`,
};

async function sign(context, operation, account) {
  if (operation.status === 'done') {
    console.log(' - Done');
    return operation;
  }

  const input = Buffer.from(operation.message, 'base64');
  console.log('message', operation.message);
  console.log('input', input.toString('base64'));
  const output = context.step(input);

  console.log(' - Sending MPC data to server');

  const res = await fetch(
    `${COSSET_API_URL}/wallets/${account.address.wallet.id}/update`,
    {
      method: 'POST',
      body: JSON.stringify({
        message: output.toString('base64'),
      }),
      headers,
    },
  );
  return sign(context, await res.json(), account);
}

(async function () {
  const account = await (
    await fetch(`${COSSET_API_URL}/accounts/${accountID}`, {
      method: 'GET',
      headers,
    })
  ).json();

  const total = account.balances.reduce(
    (latest, current) =>
      current.block.height > latest.block.height ? current : latest,
    { block: { height: 0 } },
  ).total;

  console.log('\n💰 Your account');
  console.log(' - Currency:', account.currency.symbol);
  console.log(
    ` - Total balance: ${total} (≈ ${total / 10 ** account.currency.decimals} ${
      account.currency.symbol
    })`,
  );
  console.log(' - Address:', account.address.hash);
  console.log(' - Public key:', account.address.wallet.publicKey);
  console.log(' - Wallet ID:', account.address.wallet.id);

  console.log('\n📄 Create new send');
  const { raw, message } = await (
    await fetch(`${COSSET_API_URL}/accounts/${accountID}/transactions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        to: '0xEF1E3c6C476C77f5b6e79A960BbB13931631bc1D',
        amount: '1e10',
        fee: '1e16',
      }),
    })
  ).json();
  console.log(' - Unsigned tx:', raw);
  console.log(' - Data to sign:', message);

  console.log('\n⏳ Check and cancel current operation...');
  try {
    await fetch(
      `${COSSET_API_URL}/wallets/${account.address.wallet.id}/cancel`,
      {
        method: 'POST',
        headers,
      },
    );
    console.log(' - Cancel pending operation');
  } catch (err) {
    console.log(' - No pending operation');
  }

  console.log('\n✏️  Sign message:', message);
  context = Context.createEcdsaSignContext(
    PEER,
    Buffer.from(share, 'hex'),
    Buffer.from(message, 'hex'),
  );

  const operation = await (
    await fetch(`${COSSET_API_URL}/wallets/${account.address.wallet.id}/sign`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        data: message,
        details: '',
      }),
    })
  ).json();

  const signedOperation = await sign(context, operation, account);

  console.log('\n🧾 Operation ID:', operation.id);
  console.log('\n📜 Signature:', signedOperation.signature);

  /*
   * ⚠️ From this step you need to compute transaction on client side
   * without network to construct and verify signed transaction
   * But I'll take advantage of crypto server */
  const signedTx = await (
    await fetch(`${COSSET_CRYPTO_URL}/ethereum/signature`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        raw,
        signature: signedOperation.signature,
        publicKey: account.address.wallet.publicKey,
      }),
    })
  ).json();
  console.log('\n📝 Signed transaction:', signedTx.raw);

  const decodedTx = await (
    await fetch(`${COSSET_CRYPTO_URL}/ethereum/decode`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        raw: signedTx.raw,
      }),
    })
  ).json();
  console.log(decodedTx);

  console.log(
    `\n*️⃣  Broadcasting: https://ropsten.etherscan.io/tx/${decodedTx.hash}`,
  );
  const broadcastResponse = await fetch(
    `${COSSET_API_URL}/accounts/${account.id}/broadcast`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify({
        raw: signedTx.raw,
      }),
    },
  );
  console.log(await broadcastResponse.text());

  console.log('\nDone');
})().catch(console.error);
