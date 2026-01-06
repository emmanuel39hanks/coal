import Mnee from '@mnee/ts-sdk';
import * as All from '@mnee/ts-sdk';

console.log('Default Export keys:', Object.keys(Mnee));
console.log('All Exports keys:', Object.keys(All));

try {
    const mnee = new Mnee({ environment: 'sandbox', apiKey: 'test' });
    console.log('Instance keys:', Object.keys(mnee));
    console.log('Instance prototype keys:', Object.getOwnPropertyNames(Object.getPrototypeOf(mnee)));
} catch (e) {
    console.error(e);
}
