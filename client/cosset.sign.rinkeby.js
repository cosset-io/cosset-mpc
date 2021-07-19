const fetch = require('node-fetch');
const EC = require('elliptic').ec;
const { Context } = require('crypto-mpc');

const { COSSET_API_URL, COSSET_CRYPTO_URL } = process.env;
const PEER = 2;

const share =
  'ec56c8758dff402e010020cce1e25fe53dc455598963267af19467b90f134052fbe550e07074736ee393c50102000b4137e96ed3e625b7f8f0126269d5544a6934ecb4d752b66c671502f7f9f037b07a4064379d2890768cf0cd32085164889f1ae9847e1fe9265e84f14e18337599e1b7afb7024c02d13688726d6b2948c3ad6638b03954e26b3e0fb794fad7ec08f8deaa50483dbcd23086bd5df62ea6428ce848684c7b474f26a183115d8ec0245b08a55e73075aa618c19e22601291100f39c0dcfcb433031c30e7aa2eda26c162989069232ffd760953fbed295ffe45f4879c2cee1c543de2e76880662077ec14d850a055b957141274bc07285754550c7efbf3d974a5974de1c67c978b6140362691f5f1fa067ed540533f2c69f62a5c3333c6ba84bd96ebaaaebff975e1fcc856f542cf945eb1191df5c754f77aae2ac15c2c6e082553b26be17307b24d2b32a106936c03f55fa9098ee8cea642ffd37634b617cbd0350eb5df82b4541992a16ee2965f7b91cd574343552de7a9d25ff0b9993ca2956204cdb952afa375337618c24e73308b85790ef27b90bc9f98d6441e2b3e7da1208342a67a481087309088942d586d5b992b5f86635a3b4c2b3ced6eb522dd6034f353544aa5d6552bc713d4a5466ac6445fb62b4e0bedd95e92412786fab065a988c25eade5b998cbbbe18e6f217602a181250a0cc77ad97cf21657d4bdec7dcaaa6f00da3fc0b741dcd3b890f45d412c2e90bd6f6ab4de3c911c79fcba0c51ab74add09251d25c000000000002ca00210274984b9728d5f5e85f55df4e6e8d71b7e1c3ae31ef5e84260cd6580a03d78c410105000001010095dd14336cfcd5e53fa7f13462bd93cc8a8ffa4f265a5cd067110998cc7ca695c4302ec41e757f30e285c08e18c755efc1d9590519b1f6ce4fb772601ea0d6ee5fe9fede1dcb9ea4fd7b8469b17effe078207ae95b3e50721e40e7102f0d1d502c06900fd785828fac0240d285bb2d9dbf4029b1b0baf1e8c7dbe1f0b2f95cee6839904dc8a29e679d8d66b8c9f93ebfdf20b58f9d4b7bbbeeafff5be96bca513504e80c9e8b409cfaf7d51fecffe87681c931e06880e00f5329356b75826bf4813a36e3540afa2a1af4a12a21c1c5d5bfd13576853154a02d3e5293dca6ca80b84e8615f8c54caa94050d44f25e0b077518833b2c9a9c11dd61dd07aba7dfaf00000000000000000000000000000000000000000000000000000000000000000043bca730c19d4e0c7b299c6d0f92049c';
const token =
  'eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE2Mjc4MTk0OTksImlhdCI6MTYyNTIyNzQ5OSwic3ViIjoiMSJ9.S9JABGb_aX_NmA6r8k5pRrA9lUfdlAWJoToV1IjmEA04LqBLbhg1dygcN_3IprHGX-r8hYnHdQkwImaVdHFocg';

const ETH_ACCOUNT = 1; // Ether
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
        wallet: account.address.wallet,
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
    `\n*️⃣  Broadcasting: https://rinkeby.etherscan.io/tx/${decodedTx.hash}`,
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
