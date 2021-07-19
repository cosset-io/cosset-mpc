const fetch = require('node-fetch');
const { Context } = require('crypto-mpc');
const { COSSET_API_URL, COSSET_CRYPTO_URL } = process.env;
const PEER = 2;
const share =
  'ec56c8758dff402e010020c635d56952b5875fbea97b1655505ae92b7bdb2fbc96d82df6e35c65010cab2d010200025d0eace2b3fcf5a21a64dec9e515e01c61f2d5719512cc2ca2ed46da8464600ac8de372445fa6b0a4af549630083362ff9b6edfa3dd9a6f2ebd38f3bef413ccab9cfb3e49c5e8ef2ca11acb4a8ba0dff7e9bc7391bdd7ec3c38ebd2cbf03e78b1c0b1bec35891f9a479a998ae593e9154bfea973d6e2352c03f18b040188ea6bced18fbfda162d2d5d0da70ba8248bd6b7b6c04739653d24cfe288f51e7270606824953fb915f28300a66c446aefbbc203742db6585490b5f4a364312d661dd3fb63ab66014a4dcb40511bc8d2cad9cc8e1ddf66fa2b6c1ea79092ce8d9e29ae277d13c35fafe7354b8dedd3fdc4444f75920877e2042547714162b1fc9ea26f06d84df3ba68f679b5aa089a8d8e0b3a543a24ff0bb2a9561bd26d1ea9a6387000caf17dd3f469d0bdba435c8b2a44ae827cf191bf6f45c1c8f2ff1dcc7c6fc715a30936ea81e2e45d0794e6a270e463d78eec8b0c23d5ca2338a21980239e4148c3a2a1a917bd3af289b1316aff8f307e06c9a9ced7ebb1246c45b183f23932716bb6f8a13e859d3d764ea4169269fa232e65036db415e37f660bc027859e3c59b9139559260ca94332a3ec2858dc67ea16fca2e634b78edc116eb2c47005517facd630ee20adf4eef75e583f232f01198628212b44a08c6c4a0cd526daff290b054e16a1f6e8376c0e6839a3d9a78161d3480e650f85e8e557e8f2ec284c000000000002ca0021037ea11000ac736aec65084b9c7f4c5167c25e68d2d1e2f60d6632c625ec582e3601050000010100d88d604b1a149a4f58fdd7cc4aa8fc5dde8061a9a368a25c7d982edd8a296ba3ecf5a6368d606d649d8f11e167813387d05497d2c7891a6c7413f855f17ba1557d9f3891715343c924ceb46cb01c9933ee40d611d35adb720c9c9dde5c55c2e81fd9db85e862d834e3752883173ed5a65f1d09a51ff80df941974c78ff0b8f0ea21dc21fc83861ae6b18b554133033478687cc377f3ae07717c71e5af2cb247568f6ae13ed292baa153216559681f98ffe87f841b51c04eb85aff4f3914ba85ce3528752129acd6b8b6868f4fccb961ce1e67c832a8f13fae23c0673d60a6dbc3ba0538308957f6116632ec98f7d0bd21a598e89e409bb088a6af04a19aed0e300000000000000000000000000000000000000000000000000000000000000000043bca730c19d4e0cca9b61620d6e75e6';
const token =
  'eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE2Mjg5NTQxMDQsImlhdCI6MTYyNjM2MjEwNCwic3ViIjoiNzIifQ.S72gg8ZJ46aTO5WxU2nimlxU9MClV4AUWYll93LOi33RHVjDZPn-6EoY90ZBqvTdBMVNPgMd7uDjq_utcAsdoQ';
const PUBLIC_KEY =
  '3056301006072a8648ce3d020106052b8104000a034200047ea11000ac736aec65084b9c7f4c5167c25e68d2d1e2f60d6632c625ec582e36b134f07be5abb767c544f73191ee9c4ef9048417250fcca92f1bc4f8b42d77e1';

const BTC_ACCOUNT = 40176;
const wallet = {
  id: 304,
};
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
    await fetch(`${COSSET_API_URL}/accounts/${BTC_ACCOUNT}`, {
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
  console.log('\n📄 Create new send');

  const res = await fetch(
    `${COSSET_API_URL}/accounts/${account.id}/transactions`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify({
        to: 'mxviXaxXRDLX7huHKkDvUUSvh6vzmF51Sr',
        amount: '1000',
        fee: '400',
      }),
    },
  );

  const { raw, messages } = await res.json().catch((err) => {
    console.log(err);
  });

  console.log(' - Unsigned tx:', raw);
  console.log(' - Data to sign:', messages);
  console.log('\n✏️  Sign message:', messages);

  let signatures = [];

  console.log('\n⏳ Check and cancel current operation...');
  try {
    await fetch(`${COSSET_API_URL}/wallets/${wallet.id}/cancel`, {
      method: 'POST',
      headers,
    });
    console.log(' - Cancel pending operation');
  } catch (err) {
    console.log(' - No pending operation');
  }

  function sleep(ms) {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }

  for (let i = 0; i < messages.length; i++) {
    context = Context.createEcdsaSignContext(
      PEER,
      Buffer.from(share, 'hex'),
      Buffer.from(messages[i], 'hex'),
    );
    const res = await fetch(`${COSSET_API_URL}/wallets/${wallet.id}/sign`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        data: messages[i],
        details: '',
      }),
    });
    const operation = await res.json();
    const signedOperation = await sign(context, operation, account);

    console.log('\n🧾 Operation ID:', operation.id);
    console.log('\n📜 Signature:', signedOperation.signature);
    signatures.push(signedOperation.signature);
  }

  /*
   * ⚠️ From this step you need to compute transaction on client side
   * without network to construct and verify signed transaction
   * But I'll take advantage of crypto server */
  const signedTx = await (
    await fetch(`${COSSET_CRYPTO_URL}/bitcoin/signature`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        raw,
        signatures: signatures,
        wallet: account.address.wallet,
      }),
    })
  ).json();
  console.log('\n📝 Signed transaction:', { signedTx });
  const decodedTx = await (
    await fetch(`${COSSET_CRYPTO_URL}/bitcoin/decode`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        raw: signedTx.raw,
      }),
    })
  ).json();
  console.log(decodedTx);
  console.log(
    `\n*️⃣  Broadcasting: https://blockstream.info/testnet/tx/${decodedTx.hash}`,
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
