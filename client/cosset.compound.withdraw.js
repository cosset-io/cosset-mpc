const fetch = require('node-fetch');
const EC = require('elliptic').ec;
const { Context } = require('crypto-mpc');

const { COSSET_API_URL, COSSET_CRYPTO_URL } = process.env;
const PEER = 2;

const share =
  'ec56c8758dff402e0100201c6a287c9f136b936400ec99b1f54c6a741a99e18d9662e3ac8f5a8dcce43112010200530df9ed00fb50be1df83a40e6a5a82c802882a7ef77fca6273629ecd0ad2c84aabd6ee83cb67d75e29e3d871d8e2997ebee2b385a7b187419aae110242f71466fe245fccae36f475adee21cb81dfce7ee476d15258944ad2ff358833ebc86258ed39fecac320e5f9dbdacda113842b7408860a37e32d2a24ec8476907fb8b68b7fc19b04cf8dcf252e3096cb8c339fe6a9c6a82a53df16b6f44fcf852c0243edcf49dbf1813487c07778b7a01b0999f9db16f6db6093714b21d2ac3520ad8956d090a51c9136a6de1377e31f80cda2df1c03afe1b3ac6d0d6757df8296d5a96bbfef0a77468a8f765157169940bcef7df31f12be6b3907bd3611ce93b3f025a40a545db833612678d2846580524d29c825966b826c6c44a78283b3be472cc170795421f9e01f5c82c18e3cfac3f9f1ec32c7f804c517889d8157061fb8ae7d27fa49f81fe669b3029a853192dcbede21463fd91a823d0d3476c2e840203006aefe9700144d112121febd91fd40f258e310757ff99706c94f3640aca4ab23cf481e874428a65b77b249cb3d35b5bf5863e31a12cd8e838a9557cd6d9f2eebdde5e07dc3e1afc435554f94eaa58fa9adb848c3403647bb8e5589851b5101219066b5f5a9579ed8bd3f29e6c80c1bcc5945297047e6474f10bee0aab476284ed3ce673e256830e77917d3528c77a17fda176a67a90515d9421df1785185ff4976d000000000002ca002102fb9e8f3404baabdf21a0680af2decf59ee65301290ec6d61e87763350031623f01050000010100b2d3edd86c011d4cabc41ef7492f17c716f3eb7e2ac1d2b1aaa81eef709b77eee386ab08b764e170ea63a59b4e3b682c83125e964cd74e092d18945b95ee3e8b895f87290378747a51f8806bb37813bf48c6e8c0a63fbbe166c99b3a36b2d8ff62714f988b2ddc3ae4ad0ddb5c22bd1828586dd07f35ee5b21eede3fc519056195965e69d8497a2ee1b338689155c04a42412c0de373d7a72c805046f03bcb46a7bb685284629f298d0e205895a7d462c7f3a94a5efc29ace93e10c372791a51fc99909210c65c801e8fe7637478bd4a87b2870bd795e087eae9a29d9aa6e2ad9e311362f4225229f3886c6517cb63a0e8254f83abf8b6617a8bbb0fcc2ff9c300000000000000000000000000000000000000000000000000000000000000000043bca730c19d4e0cfa238ed3fe8ee141';

const token =
  'eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE2MzAzNTYxMDIsImlhdCI6MTYyNzc2NDEwMiwic3ViIjoiODUifQ.2SCTC87l95MHhF7jYHrozMC1tiSmaeC2fyr1haLi8PO9vQPlc1lmyCb3CMX0khDksiFaglj055hg5UxVFv3t8g';

const USDT_ACCOUNT = 42983; // USDT Tether

const accountID = USDT_ACCOUNT;
const investmentID = 107;

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

  const investment = await (
    await fetch(
      `${COSSET_API_URL}/accounts/${accountID}/investments/${investmentID}`,
      {
        method: 'GET',
        headers,
      },
    )
  ).json();

  console.log('\n Investment');
  console.log(' - Based currency:', investment.asset.symbol);
  console.log(' - Allowance:', investment.allowance);

  console.log('\n📄 Create new withdrawal');

  const { raw, messages } = await (
    await fetch(
      `${COSSET_API_URL}/accounts/${accountID}/investments/${investmentID}/transactions/withdrawal`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          amount: '1',
          fee: '1e16',
        }),
      },
    )
  ).json();

  const [message] = messages;
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
    await fetch(`${COSSET_CRYPTO_URL}/ropsten/signature`, {
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
    await fetch(`${COSSET_CRYPTO_URL}/ropsten/decode`, {
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
