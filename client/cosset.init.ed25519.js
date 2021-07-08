const fetch = require('node-fetch');

const { Context } = require('crypto-mpc');

const { COSSET_API_URL } = process.env;
const PEER = 2;
const token =
  'eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE2Mjc4MTk0OTksImlhdCI6MTYyNTIyNzQ5OSwic3ViIjoiMSJ9.S9JABGb_aX_NmA6r8k5pRrA9lUfdlAWJoToV1IjmEA04LqBLbhg1dygcN_3IprHGX-r8hYnHdQkwImaVdHFocg';

const headers = {
  'Content-Type': 'application/json',
  Authorization: `Bearer ${token}`,
};

(async function () {
  console.log('Create new wallet');
  let res;
  res = await fetch(`${COSSET_API_URL}/wallets?algorithm=ed25519`, {
    method: 'POST',
    headers,
  });
  const wallet = await res.json();
  console.log(wallet);

  console.log('Generate key');

  // Create client context
  let context = Context.createGenerateEddsaKey(PEER);

  // Create server operation
  res = await fetch(`${COSSET_API_URL}/wallets/${wallet.id}/generate`, {
    method: 'POST',
    headers,
  });
  let operation = await res.json();
  console.log(operation);

  let publicKey, share, input;

  for (;;) {
    input = Buffer.from(operation.message, 'base64');
    const output = context.step(input);

    if (operation.status === 'done') {
      publicKey = context.getPublicKey();
      share = context.getNewShare();
      console.log('Public key:', publicKey.toString('hex'));
      console.log();

      console.log('Share:', share.toString('hex'));
      console.log();
      break;
    }

    console.log('\nSend MPC data to server:');
    console.log(output.toString('base64'));
    console.log();
    res = await fetch(`${COSSET_API_URL}/wallets/${wallet.id}/update`, {
      method: 'POST',
      body: JSON.stringify({
        message: output.toString('base64'),
      }),
      headers,
    });
    operation = await res.json();
  }
})().catch(console.error);
