const fetch = require('node-fetch');
const EC = require('elliptic').ec;
const { Context } = require('crypto-mpc');

const { COSSET_API_URL, COSSET_CRYPTO_URL } = process.env;
const PEER = 2;

const share =
  'ec56c8758dff402e010020ff732df7b2ce2455d357841c22839044607bc5b4aad81f017b2696c215a03aeb0102007a4083bcf8da6a58ce90dd74363767a26be0de140ff7b65a0e3bfeef80cb5ce4df22b7cf89b9ea5d023deef194bd6b9c53cf55dd9a4217bccc42088999441f9184c7ecd327dc5d62caf998efa4bd1ca17293b6b928a7d1aeea9c0b7b3fbdd4230c7f9b0966059f4633d1ff75159608451c9e2a5e12ec7fcca4ed6e46d4045c5a6e67f90ae7fd942ae3be194d1ed937d342847406d1fab94a240c614262dc597a6d3071d29403d2d77a61616916f0016a4c9b9fb268004425b501ad072c2c410136005306aca82a3ffceb8907f91a152bf61a7ceb48b1c601c94f5f011617550cffca40e2ca73ea8e623ca8f431f38e345a3494ebe59da2bcbc0271a3042c09f795a94cc52bf80cd8f9d5777f7cf391fe56fe992cc7aa6dfc69484b3c050fbe4315e87c587bc036531c622205a796d320b5f813afcdde17fae18299b10577d409059760099af4437286e5d566ff71b0371fdc25e15df50820330e7770d8e3ae1cb240b973bb658c2446a702ec03051ce6968f913f1f6ed9ad05e0916ad823fd75b21e7ca57405fe4602ef98ba6dd849950d41321ba186f941e04d82b8ec487d8c34783242b59cd29c7e335ab12e263226248bd8ffa34ee70287bddae81f4e410031dd0c91ee95d857462629029cc00ee4b5b579567b54f680023f463839b06ec555791c45a49013bce4f0f9900894e5f672b849e810d5fdb0a6929a277834ca18000000000002ca00210306ad5f40ddeb51a4939f66971202a33c02a2f2b65bb6c1b6409b16c122aac83601050000010100b7fac64bda04855d000abb83e571436e70edd988ff8f8ac02053d4dd65e7e3be8625355590395fcfd1cb06879c4effd029843172d1028f8611544a781608e8e4d79a4832108fbf545616bd69a8e2891c7eb2f58c5818518ddb7456f1d825779d45cb106450237e0d434c72798cdf07feb165c6c0b0c763339ba499b515fc786169203078af083fbb27fc3609e697857a0655f550d25f807037a0859b62826961683718fe11c17ffcdc372f3504d303e67e413c335f1172566197c912578dd867f7ae9e2b26717e9e534123c5ad158acbd4b00773b30fc25cef67dc4ba48d4ba5d5e9b1b66de678181c7e7994978df730b9ccb5193e3f9446abd0221a9b0252eb00000000000000000000000000000000000000000000000000000000000000000043bca730c19d4e0c22c1285394467017';
const token =
  'eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE2MjU2NTEyODAsImlhdCI6MTYyMzA1OTI4MCwic3ViIjoiMSJ9.Lree1NAW5v0yh4LACeqo937-xi_FSTi5vJgvEorEDibXPHRU7Z35nw2WiqAThFwadLWUvFKDuXOeBcAjjgUeaQ';

const ETH_ACCOUNT = 248; // Ether
const CST_ACCOUNT = 249; // Cosset

const wallet = {
  id: 196,
};

const headers = {
  'Content-Type': 'application/json',
  Authorization: `Bearer ${token}`,
};

async function sign(context, operation) {
  if (operation.status === 'done') {
    console.log(' - Done');
    return operation;
  }

  const input = Buffer.from(operation.message, 'base64');
  console.log("message", operation.message)
  const output = context.step(input);

  console.log(' - Sending MPC data to server');

  const res = await fetch(`${COSSET_API_URL}/wallets/${wallet.id}/update`, {
    method: 'POST',
    body: JSON.stringify({
      message: output.toString('base64'),
    }),
    headers,
  });
  return sign(context, await res.json());
}

(async function () {
  const account = await (
    await fetch(`${COSSET_API_URL}/accounts/${CST_ACCOUNT}`, {
      method: 'GET',
      headers,
    })
  ).json();

  const total = account.balances.reduce(
    (latest, current) =>
      current.block.height > latest.block.height ? current : latest,
    { block: { height: 0 } }
  ).total;

  console.log('\n💰 Your account');
  console.log(' - Currency:', account.currency.symbol);
  console.log(
    ` - Total balance: ${total} (≈ ${total / 10 ** account.currency.decimals} ${
      account.currency.symbol
    })`
  );
  console.log(' - Address:', account.address.hash);
  console.log(' - Public key:', account.address.wallet.publicKey);

  console.log('\n📄 Create new send');
  let res;
  res = await fetch(`${COSSET_API_URL}/accounts/${CST_ACCOUNT}/transactions`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      to: '0xc19fE1183CFB8b464cB2810D7dCc9Ae10eC9fA31',
      amount: '1e10',
      fee: '1e15',
    }),
  });
  const { raw, message } = await res.json();
  console.log(' - Unsigned tx:', raw);
  console.log(' - Data to sign:', message);

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

  console.log('\n✏️  Sign message:', message);
  context = Context.createEcdsaSignContext(
    PEER,
    Buffer.from(share, 'hex'),
    Buffer.from(message, 'hex')
  );

  const operation = await (
    await fetch(`${COSSET_API_URL}/wallets/${wallet.id}/sign`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        data: message,
        details: '',
      }),
    })
  ).json();

  const signedOperation = await sign(context, operation);

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
    `\n*️⃣  Broadcasting: https://ropsten.etherscan.io/tx/0x${decodedTx.hash}`
  );
  const broadcastResponse = await fetch(
    `${COSSET_API_URL}/ethereum/broadcast`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify({
        raw: signedTx.raw,
      }),
    }
  );
  console.log(await broadcastResponse.text());

  console.log('\nDone');
})().catch(console.error);
