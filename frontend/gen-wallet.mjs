import Mnee, { HDWallet } from '@mnee/ts-sdk';

const mnee = new Mnee({
    environment: 'sandbox',
    apiKey: '8ec241d929c7b93f1d05c314e3ff7044' // Using key from dev-portal.md
});

const mnemonic = HDWallet.generateMnemonic();

// Create HD wallet
const hdWallet = mnee.HDWallet(mnemonic, {
    derivationPath: "m/44'/236'/0'"
});

// Derive first address
const addressInfo = hdWallet.deriveAddress(0, false);

console.log('--- NEW SANDBOX WALLET ---');
console.log('Mnemonic:', mnemonic);
console.log('Address:', addressInfo.address);
console.log('WIF (Private Key):', addressInfo.privateKey);
console.log('--------------------------');
