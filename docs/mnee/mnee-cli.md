# MNEE API

Welcome to the MNEE API Reference! This section provides detailed information about the available methods, parameters, and responses for interacting **directly** with the MNEE API. The API is designed to be intuitive and easy to use, allowing you to manage and take full control of your integration.

{% hint style="success" %}
Notice that you can click **"Test It"** on the right side of the api docs. Once the testing interface opens, you can switch between the sandbox endpoint and the production endpoint by clicking the URL up top.\
\
You will need to enter your [API KEY](https://docs.mnee.io/getting-started/authentication) for the `auth_token`
{% endhint %}

## Get config

> Get MNEE configuration and fee structure

```json
{"openapi":"3.0.3","info":{"title":"Mnee API","version":"1.0"},"servers":[{"url":"https://sandbox-proxy-api.mnee.net","description":"Sandbox Environment"},{"url":"https://proxy-api.mnee.net","description":"Production Environment"}],"security":[{"AuthToken":[]}],"components":{"securitySchemes":{"AuthToken":{"type":"apiKey","in":"query","name":"auth_token"}},"schemas":{"mnee.ConfigResponse":{"type":"object","properties":{"approver":{"type":"string"},"decimals":{"type":"integer"},"feeAddress":{"type":"string"},"burnAddress":{"type":"string"},"mintAddress":{"type":"string"},"fees":{"type":"array","items":{"$ref":"#/components/schemas/mnee.ConfigFee"}},"tokenId":{"type":"string"}}},"mnee.ConfigFee":{"type":"object","properties":{"fee":{"type":"integer"},"max":{"type":"integer"},"min":{"type":"integer"}}},"mnee.HttpError":{"type":"object","properties":{"code":{"type":"integer"},"message":{"type":"string"}}}}},"paths":{"/v1/config":{"get":{"summary":"Get config","description":"Get MNEE configuration and fee structure","responses":{"200":{"description":"OK","content":{"application/json":{"schema":{"$ref":"#/components/schemas/mnee.ConfigResponse"}}}},"400":{"description":"Bad Request","content":{"application/json":{"schema":{"$ref":"#/components/schemas/mnee.HttpError"}}}}}}}}}
```

## Get all MNEE transactions

> Gather a list of all MNEE transactions

```json
{"openapi":"3.0.3","info":{"title":"Mnee API","version":"1.0"},"servers":[{"url":"https://sandbox-proxy-api.mnee.net","description":"Sandbox Environment"},{"url":"https://proxy-api.mnee.net","description":"Production Environment"}],"security":[{"AuthToken":[]}],"components":{"securitySchemes":{"AuthToken":{"type":"apiKey","in":"query","name":"auth_token"}},"schemas":{"mnee.TxResult":{"type":"object","properties":{"blkHash":{"type":"string"},"blkTime":{"type":"integer"},"height":{"type":"integer"},"idx":{"type":"integer"},"outs":{"type":"array","items":{"type":"integer"}},"rawtx":{"type":"string"},"receivers":{"type":"array","items":{"type":"string"}},"score":{"type":"number"},"senders":{"type":"array","items":{"type":"string"}},"txid":{"type":"string"}}},"mnee.HttpError":{"type":"object","properties":{"code":{"type":"integer"},"message":{"type":"string"}}}}},"paths":{"/v1/sync":{"get":{"summary":"Get all MNEE transactions","description":"Gather a list of all MNEE transactions","parameters":[{"name":"from","in":"query","description":"Min score","schema":{"type":"integer"}},{"name":"limit","in":"query","description":"Maximum number of transactions to return","schema":{"type":"integer","default":1000}}],"responses":{"200":{"description":"Signed transactions","content":{"application/json":{"schema":{"type":"array","items":{"$ref":"#/components/schemas/mnee.TxResult"}}}}},"400":{"description":"Bad Request","content":{"application/json":{"schema":{"$ref":"#/components/schemas/mnee.HttpError"}}}}}}}}}
```

## Get transactions for specific addresses

> Gather a list of all MNEE transactions for a batch of addresses

```json
{"openapi":"3.0.3","info":{"title":"Mnee API","version":"1.0"},"servers":[{"url":"https://sandbox-proxy-api.mnee.net","description":"Sandbox Environment"},{"url":"https://proxy-api.mnee.net","description":"Production Environment"}],"security":[{"AuthToken":[]}],"components":{"securitySchemes":{"AuthToken":{"type":"apiKey","in":"query","name":"auth_token"}},"schemas":{"mnee.TxResult":{"type":"object","properties":{"blkHash":{"type":"string"},"blkTime":{"type":"integer"},"height":{"type":"integer"},"idx":{"type":"integer"},"outs":{"type":"array","items":{"type":"integer"}},"rawtx":{"type":"string"},"receivers":{"type":"array","items":{"type":"string"}},"score":{"type":"number"},"senders":{"type":"array","items":{"type":"string"}},"txid":{"type":"string"}}},"mnee.HttpError":{"type":"object","properties":{"code":{"type":"integer"},"message":{"type":"string"}}}}},"paths":{"/v1/sync":{"post":{"summary":"Get transactions for specific addresses","description":"Gather a list of all MNEE transactions for a batch of addresses","parameters":[{"name":"from","in":"query","schema":{"type":"integer"}},{"name":"limit","in":"query","description":"Maximum number of transactions to return per address (defaults to 0, which returns all transactions)","schema":{"type":"integer","default":0}},{"name":"order","in":"query","description":"Sync Order","schema":{"type":"string"}}],"requestBody":{"required":true,"content":{"application/json":{"schema":{"type":"array","items":{"type":"string"}}}}},"responses":{"200":{"description":"Signed transactions","content":{"application/json":{"schema":{"type":"array","items":{"$ref":"#/components/schemas/mnee.TxResult"}}}}},"400":{"description":"Bad Request","content":{"application/json":{"schema":{"$ref":"#/components/schemas/mnee.HttpError"}}}}}}}}}
```

## POST /v1/transfer

> Submit a partially-signed transfer transaction

```json
{"openapi":"3.0.3","info":{"title":"Mnee API","version":"1.0"},"servers":[{"url":"https://sandbox-proxy-api.mnee.net","description":"Sandbox Environment"},{"url":"https://proxy-api.mnee.net","description":"Production Environment"}],"security":[{"AuthToken":[]}],"components":{"securitySchemes":{"AuthToken":{"type":"apiKey","in":"query","name":"auth_token"}},"schemas":{"mnee.TransactionData":{"type":"object","properties":{"rawtx":{"type":"string"}}},"mnee.HttpError":{"type":"object","properties":{"code":{"type":"integer"},"message":{"type":"string"}}}}},"paths":{"/v1/transfer":{"post":{"summary":"Submit a partially-signed transfer transaction","requestBody":{"required":true,"content":{"application/json":{"schema":{"$ref":"#/components/schemas/mnee.TransactionData"}}}},"responses":{"200":{"description":"Signed transaction","content":{"application/json":{"schema":{"$ref":"#/components/schemas/mnee.TransactionData"}}}},"400":{"description":"Bad Request","content":{"application/json":{"schema":{"$ref":"#/components/schemas/mnee.HttpError"}}}}}}}}}
```

## Transfer Mnee tokens

> Validates and transfers mnee transactions. Returns a ticket ID for tracking the transaction.

```json
{"openapi":"3.0.3","info":{"title":"Mnee API","version":"1.0"},"servers":[{"url":"https://sandbox-proxy-api.mnee.net","description":"Sandbox Environment"},{"url":"https://proxy-api.mnee.net","description":"Production Environment"}],"security":[{"AuthToken":[]}],"components":{"securitySchemes":{"AuthToken":{"type":"apiKey","in":"query","name":"auth_token"}},"schemas":{"mnee.TransactionData":{"type":"object","properties":{"rawtx":{"type":"string"}}},"mnee.HttpError":{"type":"object","properties":{"code":{"type":"integer"},"message":{"type":"string"}}}}},"paths":{"/v2/transfer":{"post":{"summary":"Transfer Mnee tokens","description":"Validates and transfers mnee transactions. Returns a ticket ID for tracking the transaction.","tags":["Transactions"],"requestBody":{"required":true,"content":{"application/json":{"schema":{"$ref":"#/components/schemas/mnee.TransactionData"}}}},"responses":{"200":{"description":"Transfer submitted successfully. Returns ticket ID for tracking.","content":{"text/plain":{"schema":{"type":"string","description":"Ticket ID for tracking the transfer transaction"}}}},"400":{"description":"Bad Request","content":{"application/json":{"schema":{"$ref":"#/components/schemas/mnee.HttpError"}}}},"500":{"description":"Internal Server Error","content":{"application/json":{"schema":{"$ref":"#/components/schemas/mnee.HttpError"}}}}}}}}}
```

## Get Ticket

> Returns Ticket By Ticket ID

```json
{"openapi":"3.0.3","info":{"title":"Mnee API","version":"1.0"},"servers":[{"url":"https://sandbox-proxy-api.mnee.net","description":"Sandbox Environment"},{"url":"https://proxy-api.mnee.net","description":"Production Environment"}],"security":[{"AuthToken":[]}],"components":{"securitySchemes":{"AuthToken":{"type":"apiKey","in":"query","name":"auth_token"}},"schemas":{"mnee.Ticket":{"type":"object","properties":{"action_requested":{"type":"string"},"callback_url":{"type":"string"},"createdAt":{"type":"string"},"errors":{"type":"string"},"id":{"type":"string"},"status":{"type":"string"},"tx_hex":{"type":"string"},"tx_id":{"type":"string"},"updatedAt":{"type":"string"}}},"mnee.HttpError":{"type":"object","properties":{"code":{"type":"integer"},"message":{"type":"string"}}}}},"paths":{"/v2/ticket":{"get":{"summary":"Get Ticket","description":"Returns Ticket By Ticket ID","tags":["Ticket"],"parameters":[{"name":"ticketID","in":"query","required":true,"schema":{"type":"string"},"description":"Ticket ID"}],"responses":{"200":{"description":"Ticket response","content":{"application/json":{"schema":{"$ref":"#/components/schemas/mnee.Ticket"}}}},"400":{"description":"Bad Request","content":{"application/json":{"schema":{"$ref":"#/components/schemas/mnee.HttpError"}}}},"500":{"description":"Internal server error","content":{"application/json":{"schema":{"$ref":"#/components/schemas/mnee.HttpError"}}}}}}}}}
```

## POST /v1/utxos

> Retrieve UTXOs for a batch of addresses

```json
{"openapi":"3.0.3","info":{"title":"Mnee API","version":"1.0"},"servers":[{"url":"https://sandbox-proxy-api.mnee.net","description":"Sandbox Environment"},{"url":"https://proxy-api.mnee.net","description":"Production Environment"}],"security":[{"AuthToken":[]}],"components":{"securitySchemes":{"AuthToken":{"type":"apiKey","in":"query","name":"auth_token"}},"schemas":{"mnee.Txo":{"type":"object","properties":{"data":{"$ref":"#/components/schemas/mnee.Data"},"height":{"type":"integer"},"idx":{"type":"integer"},"outpoint":{"type":"string"},"owners":{"type":"array","items":{"type":"string"}},"satoshis":{"type":"integer"},"score":{"type":"number"},"script":{"type":"string"},"txid":{"type":"string"},"vout":{"type":"integer"}}},"mnee.Data":{"type":"object","properties":{"bsv21":{"$ref":"#/components/schemas/mnee.Bsv21"},"cosign":{"$ref":"#/components/schemas/mnee.Cosign"}}},"mnee.Bsv21":{"type":"object","properties":{"amt":{"type":"integer"},"dec":{"type":"integer"},"icon":{"type":"string"},"id":{"type":"string"},"op":{"type":"string"},"sym":{"type":"string"}}},"mnee.Cosign":{"type":"object","properties":{"address":{"type":"string"},"cosigner":{"type":"string"}}},"mnee.HttpError":{"type":"object","properties":{"code":{"type":"integer"},"message":{"type":"string"}}}}},"paths":{"/v1/utxos":{"post":{"summary":"Retrieve UTXOs for a batch of addresses","requestBody":{"required":true,"content":{"application/json":{"schema":{"type":"array","items":{"type":"string"}}}}},"responses":{"200":{"description":"UTXOs","content":{"application/json":{"schema":{"type":"array","items":{"$ref":"#/components/schemas/mnee.Txo"}}}}},"400":{"description":"Bad Request","content":{"application/json":{"schema":{"$ref":"#/components/schemas/mnee.HttpError"}}}}}}}}}
```

## Get Utxos by addresses

> Returns the array of unspent utxos

```json
{"openapi":"3.0.3","info":{"title":"Mnee API","version":"1.0"},"servers":[{"url":"https://sandbox-proxy-api.mnee.net","description":"Sandbox Environment"},{"url":"https://proxy-api.mnee.net","description":"Production Environment"}],"security":[{"AuthToken":[]}],"components":{"securitySchemes":{"AuthToken":{"type":"apiKey","in":"query","name":"auth_token"}},"schemas":{"mnee.Txo":{"type":"object","properties":{"data":{"$ref":"#/components/schemas/mnee.Data"},"height":{"type":"integer"},"idx":{"type":"integer"},"outpoint":{"type":"string"},"owners":{"type":"array","items":{"type":"string"}},"satoshis":{"type":"integer"},"score":{"type":"number"},"script":{"type":"string"},"txid":{"type":"string"},"vout":{"type":"integer"}}},"mnee.Data":{"type":"object","properties":{"bsv21":{"$ref":"#/components/schemas/mnee.Bsv21"},"cosign":{"$ref":"#/components/schemas/mnee.Cosign"}}},"mnee.Bsv21":{"type":"object","properties":{"amt":{"type":"integer"},"dec":{"type":"integer"},"icon":{"type":"string"},"id":{"type":"string"},"op":{"type":"string"},"sym":{"type":"string"}}},"mnee.Cosign":{"type":"object","properties":{"address":{"type":"string"},"cosigner":{"type":"string"}}},"mnee.HttpError":{"type":"object","properties":{"code":{"type":"integer"},"message":{"type":"string"}}}}},"paths":{"/v2/utxos":{"post":{"summary":"Get Utxos by addresses","description":"Returns the array of unspent utxos","tags":["Transactions"],"parameters":[{"name":"page","in":"query","schema":{"type":"string","default":"1"},"description":"Default: 1"},{"name":"size","in":"query","schema":{"type":"string","default":"10"},"description":"Default: 10"},{"name":"order","in":"query","schema":{"type":"string"},"description":"Sync Order"}],"requestBody":{"required":true,"content":{"application/json":{"schema":{"type":"array","items":{"type":"string"},"description":"Addresses to lookup for utxos"}}}},"responses":{"200":{"description":"OK","content":{"application/json":{"schema":{"type":"array","items":{"$ref":"#/components/schemas/mnee.Txo"}}}}},"400":{"description":"Bad Request","content":{"application/json":{"schema":{"$ref":"#/components/schemas/mnee.HttpError"}}}},"500":{"description":"Internal Server Error","content":{"application/json":{"schema":{"$ref":"#/components/schemas/mnee.HttpError"}}}}}}}}}
```

## Fetch balances for given addresses

> Accepts a list of addresses and returns their balances.

```json
{"openapi":"3.0.3","info":{"title":"Mnee API","version":"1.0"},"servers":[{"url":"https://sandbox-proxy-api.mnee.net","description":"Sandbox Environment"},{"url":"https://proxy-api.mnee.net","description":"Production Environment"}],"security":[{"AuthToken":[]}],"components":{"securitySchemes":{"AuthToken":{"type":"apiKey","in":"query","name":"auth_token"}},"schemas":{"mnee.BalanceData":{"type":"object","properties":{"address":{"type":"string"},"amt":{"type":"number"},"precised":{"type":"number"}}}}},"paths":{"/v2/balance":{"post":{"summary":"Fetch balances for given addresses","description":"Accepts a list of addresses and returns their balances.","tags":["balances"],"requestBody":{"required":true,"content":{"application/json":{"schema":{"type":"array","items":{"type":"string"},"description":"List of addresses"}}}},"responses":{"200":{"description":"Balances result","content":{"application/json":{"schema":{"type":"array","items":{"$ref":"#/components/schemas/mnee.BalanceData"}}}}},"400":{"description":"Invalid JSON payload","content":{"text/plain":{"schema":{"type":"string"}}}},"405":{"description":"Method Not Allowed","content":{"text/plain":{"schema":{"type":"string"}}}}}}}}}
```

## GET /v1/tx/{txid}

> Retrieve transaction

```json
{"openapi":"3.0.3","info":{"title":"Mnee API","version":"1.0"},"servers":[{"url":"https://sandbox-proxy-api.mnee.net","description":"Sandbox Environment"},{"url":"https://proxy-api.mnee.net","description":"Production Environment"}],"security":[{"AuthToken":[]}],"components":{"securitySchemes":{"AuthToken":{"type":"apiKey","in":"query","name":"auth_token"}},"schemas":{"mnee.TransactionData":{"type":"object","properties":{"rawtx":{"type":"string"}}},"mnee.HttpError":{"type":"object","properties":{"code":{"type":"integer"},"message":{"type":"string"}}}}},"paths":{"/v1/tx/{txid}":{"get":{"summary":"Retrieve transaction","parameters":[{"name":"txid","in":"path","required":true,"schema":{"type":"string"}}],"responses":{"200":{"description":"Transaction data","content":{"application/json":{"schema":{"$ref":"#/components/schemas/mnee.TransactionData"}}}},"400":{"description":"Bad Request","content":{"application/json":{"schema":{"$ref":"#/components/schemas/mnee.HttpError"}}}}}}}}}
```

## The mnee.BalanceData object

```json
{"openapi":"3.0.3","info":{"title":"Mnee API","version":"1.0"},"components":{"schemas":{"mnee.BalanceData":{"type":"object","properties":{"address":{"type":"string"},"amt":{"type":"number"},"precised":{"type":"number"}}}}}}
```

## The mnee.Bsv21 object

```json
{"openapi":"3.0.3","info":{"title":"Mnee API","version":"1.0"},"components":{"schemas":{"mnee.Bsv21":{"type":"object","properties":{"amt":{"type":"integer"},"dec":{"type":"integer"},"icon":{"type":"string"},"id":{"type":"string"},"op":{"type":"string"},"sym":{"type":"string"}}}}}}
```

## The mnee.ConfigFee object

```json
{"openapi":"3.0.3","info":{"title":"Mnee API","version":"1.0"},"components":{"schemas":{"mnee.ConfigFee":{"type":"object","properties":{"fee":{"type":"integer"},"max":{"type":"integer"},"min":{"type":"integer"}}}}}}
```

## The mnee.ConfigResponse object

```json
{"openapi":"3.0.3","info":{"title":"Mnee API","version":"1.0"},"components":{"schemas":{"mnee.ConfigResponse":{"type":"object","properties":{"approver":{"type":"string"},"decimals":{"type":"integer"},"feeAddress":{"type":"string"},"burnAddress":{"type":"string"},"mintAddress":{"type":"string"},"fees":{"type":"array","items":{"$ref":"#/components/schemas/mnee.ConfigFee"}},"tokenId":{"type":"string"}}},"mnee.ConfigFee":{"type":"object","properties":{"fee":{"type":"integer"},"max":{"type":"integer"},"min":{"type":"integer"}}}}}}
```

## The mnee.Cosign object

```json
{"openapi":"3.0.3","info":{"title":"Mnee API","version":"1.0"},"components":{"schemas":{"mnee.Cosign":{"type":"object","properties":{"address":{"type":"string"},"cosigner":{"type":"string"}}}}}}
```

## The mnee.Data object

```json
{"openapi":"3.0.3","info":{"title":"Mnee API","version":"1.0"},"components":{"schemas":{"mnee.Data":{"type":"object","properties":{"bsv21":{"$ref":"#/components/schemas/mnee.Bsv21"},"cosign":{"$ref":"#/components/schemas/mnee.Cosign"}}},"mnee.Bsv21":{"type":"object","properties":{"amt":{"type":"integer"},"dec":{"type":"integer"},"icon":{"type":"string"},"id":{"type":"string"},"op":{"type":"string"},"sym":{"type":"string"}}},"mnee.Cosign":{"type":"object","properties":{"address":{"type":"string"},"cosigner":{"type":"string"}}}}}}
```

## The mnee.HttpError object

```json
{"openapi":"3.0.3","info":{"title":"Mnee API","version":"1.0"},"components":{"schemas":{"mnee.HttpError":{"type":"object","properties":{"code":{"type":"integer"},"message":{"type":"string"}}}}}}
```

## The mnee.Ticket object

```json
{"openapi":"3.0.3","info":{"title":"Mnee API","version":"1.0"},"components":{"schemas":{"mnee.Ticket":{"type":"object","properties":{"action_requested":{"type":"string"},"callback_url":{"type":"string"},"createdAt":{"type":"string"},"errors":{"type":"string"},"id":{"type":"string"},"status":{"type":"string"},"tx_hex":{"type":"string"},"tx_id":{"type":"string"},"updatedAt":{"type":"string"}}}}}}
```

## The mnee.TransactionData object

```json
{"openapi":"3.0.3","info":{"title":"Mnee API","version":"1.0"},"components":{"schemas":{"mnee.TransactionData":{"type":"object","properties":{"rawtx":{"type":"string"}}}}}}
```

## The mnee.TxResult object

```json
{"openapi":"3.0.3","info":{"title":"Mnee API","version":"1.0"},"components":{"schemas":{"mnee.TxResult":{"type":"object","properties":{"blkHash":{"type":"string"},"blkTime":{"type":"integer"},"height":{"type":"integer"},"idx":{"type":"integer"},"outs":{"type":"array","items":{"type":"integer"}},"rawtx":{"type":"string"},"receivers":{"type":"array","items":{"type":"string"}},"score":{"type":"number"},"senders":{"type":"array","items":{"type":"string"}},"txid":{"type":"string"}}}}}}
```

## The mnee.Txo object

```json
{"openapi":"3.0.3","info":{"title":"Mnee API","version":"1.0"},"components":{"schemas":{"mnee.Txo":{"type":"object","properties":{"data":{"$ref":"#/components/schemas/mnee.Data"},"height":{"type":"integer"},"idx":{"type":"integer"},"outpoint":{"type":"string"},"owners":{"type":"array","items":{"type":"string"}},"satoshis":{"type":"integer"},"score":{"type":"number"},"script":{"type":"string"},"txid":{"type":"string"},"vout":{"type":"integer"}}},"mnee.Data":{"type":"object","properties":{"bsv21":{"$ref":"#/components/schemas/mnee.Bsv21"},"cosign":{"$ref":"#/components/schemas/mnee.Cosign"}}},"mnee.Bsv21":{"type":"object","properties":{"amt":{"type":"integer"},"dec":{"type":"integer"},"icon":{"type":"string"},"id":{"type":"string"},"op":{"type":"string"},"sym":{"type":"string"}}},"mnee.Cosign":{"type":"object","properties":{"address":{"type":"string"},"cosigner":{"type":"string"}}}}}}
```
