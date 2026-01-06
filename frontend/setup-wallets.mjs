import Mnee from '@mnee/ts-sdk';

const mnee = new Mnee({
    environment: 'sandbox',
    apiKey: '8ec241d929c7b93f1d05c314e3ff7044'
});

function generateWallet(name) {
    // Access static method via Default Export
    const mnemonic = Mnee.HDWallet.generateMnemonic();

    // Access factory method via instance
    const hdWallet = mnee.HDWallet(mnemonic, {
        derivationPath: "m/44'/236'/0'"
    });

    const info = hdWallet.deriveAddress(0, false);

    return {
        name,
        address: info.address,
        wif: info.privateKey,
        mnemonic
    };
}

const merchant = generateWallet('MERCHANT_PAYOUT');
const customerA = generateWallet('CUSTOMER_A');
const customerB = generateWallet('CUSTOMER_B');
const customerC = generateWallet('CUSTOMER_C');

console.log('=== SANDBOX WALLETS GENERATED ===');
console.log('Save these credentials securely (for testing only).');
console.log('Use one of the Customer WIFs in the /pay page.');
console.log('Use the Merchant Address to configure your Payout Wallet in Console.\n');

[merchant, customerA, customerB, customerC].forEach(w => {
    console.log(`[${w.name}]`);
    console.log(`Address:  ${w.address}`);
    console.log(`WIF:      ${w.wif}`);
    console.log(`Mnemonic: ${w.mnemonic}`);
    console.log('------------------------------------------------');
});
