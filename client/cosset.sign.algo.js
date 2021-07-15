const fetch = require('node-fetch');
const EC = require('elliptic').ec;
const { Context } = require('crypto-mpc');

const { COSSET_API_URL, COSSET_CRYPTO_URL } = process.env;
const PEER = 2;

const share =
  'd68c71663a9a4dcc01002009bbf2d70c24a3bdd898fec2c5fb2fdb7487adf0c51290d8a6bf60f42dc13ca04662ae8eb1f5d66a18814e791aecf91a3667fb40fa4b18845214c3cd9ab507c043bca730c19d4e0c939931b439360f11';
const token =
  'eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE2Mjc4MTk0OTksImlhdCI6MTYyNTIyNzQ5OSwic3ViIjoiMSJ9.S9JABGb_aX_NmA6r8k5pRrA9lUfdlAWJoToV1IjmEA04LqBLbhg1dygcN_3IprHGX-r8hYnHdQkwImaVdHFocg';

const accountID = 8577; // ALGO

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
  const {
    raw,
    messages: [message],
  } = await (
    await fetch(`${COSSET_API_URL}/accounts/${accountID}/transactions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        to: 'DISPE57MNLYKOMOK3H5IMBAYOYW3YL2CSI6MDOG3RDXSMET35DG4W6SOTI',
        amount: '1',
        fee: '1',
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
  context = Context.createEddsaSignContext(
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
    await fetch(`${COSSET_CRYPTO_URL}/algorand/signature`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        raw,
        signatures: [signedOperation.signature],
        publicKey: account.address.wallet.publicKey,
      }),
    })
  ).json();
  console.log('\n📝 Signed transaction:', signedTx.raw);

  // const decodedTx = await (
  //   await fetch(`${COSSET_CRYPTO_URL}/algorand/decode`, {
  //     method: 'POST',
  //     headers,
  //     body: JSON.stringify({
  //       raw: signedTx.raw,
  //     }),
  //   })
  // ).json();
  // console.log(decodedTx);

  console.log(
    `\n*️⃣  Broadcasting: https://testnet.algoexplorer.io/tx/${decodedTx.hash}`,
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
