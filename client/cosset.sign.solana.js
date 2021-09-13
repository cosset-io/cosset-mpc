const fetch = require('node-fetch');
const { Context } = require('crypto-mpc');

const { COSSET_API_URL, COSSET_CRYPTO_URL } = process.env;
const PEER = 2;

const share =
  'd68c71663a9a4dcc010020087437cea645995d9ee192e783bb56961f675632b4575d80d18bdededed391359b7a68534c986e0f8dad4c88f79cf979c55ad1e318bb3c507e218f13274d5dba43bca730c19d4e0c6c551afb48e3b87c';
const token =
  'eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE2MzQwMTYwMzEsImlhdCI6MTYzMTQyNDAzMSwic3ViIjoiMTA5In0.W26QZv7te8nmWy35GeulaIND3EcT6OTZgawjVgC-Ux6TZyZTNHI4F6qfqQ6jZcPwq4EPpih1YaW4zjP5wfocuw';

const accountID = 45194; // SOL

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
        to: 'F4mnphUWHUxkVetJJTQiUaAod8GHuDNc36mop5Va49yr',
        amount: '10000',
        fee: '5000',
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
    await fetch(`${COSSET_CRYPTO_URL}/solana/signature`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        raw,
        signatures: [signedOperation.signature],
        wallet: account.address.wallet,
      }),
    })
  ).json();
  console.log('\n📝 Signed transaction:', signedTx.raw);

  const decodedTx = await (
    await fetch(`${COSSET_CRYPTO_URL}/solana/decode`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        raw: signedTx.raw,
      }),
    })
  ).json();
  console.log(decodedTx);

  console.log(
    `\n*️⃣  Broadcasting: https://explorer.solana.com/tx/${decodedTx.hash}?cluster=testnet`,
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
