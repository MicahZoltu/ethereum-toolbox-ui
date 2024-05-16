import { signTransaction as signTransactionWithLedger } from '@zoltu/ethereum-ledger'
import { encodeTransaction, signTransaction as signTransactionWithKey } from '@zoltu/ethereum-transactions'
import { addressBigintToHex, bytesToBigint, hexToBytes } from '@zoltu/ethereum-transactions/converters.js'
import { contract } from 'micro-web3'
import { GNOSIS_SAFE_ABI, RECOVERABLE_WALLET_ABI } from './contract-details.js'
import { HexAddress, ResolvePromise } from './typescript.js'
import { jsonStringify, sleep } from './utilities.js'
import { EthCallParameters, EthCallResult, EthChainIdParameters, EthChainIdResult, EthEstimateGasParameters, EthEstimateGasResult, EthGetBalanceParameters, EthGetBalanceResult, EthGetBlockByNumberParameters, EthGetBlockByNumberResult, EthGetCodeParameters, EthGetCodeResult, EthGetTransactionCountParameters, EthGetTransactionCountResult, EthGetTransactionReceiptParameters, EthRequestAccountsResult, EthSendRawTransactionParameters, EthSendRawTransactionResult, EthSendTransactionParameters, EthSendTransactionResult, EthTransactionReceiptResult, EthereumData, EthereumQuantity, EthereumRequest, EthereumUnsignedTransaction, JsonRpcErrorResponse, JsonRpcRequest, JsonRpcResponse, serialize } from './wire-types.js'

export function fromChecksummedAddress(address: string) {
	// TODO: get micro-eth-signer working
	// if (!Address.verifyChecksum(address)) throw new Error(`Address ${address} failed checksum verification.`)
	return address as HexAddress
}

export type Wallet = {
	readonly readonly: true
	readonly ethereumClient: IEthereumClient
	readonly address: bigint
} | {
	readonly readonly: false
	readonly ethereumClient: IEthereumClient
	readonly address: bigint
}

export type IProvider = {
	request: (request: EthereumRequest) => Promise<unknown>
}
export type IEthereumClient = Pick<EthereumClient, keyof EthereumClient>
export abstract class EthereumClient {
	public address?: bigint
	public abstract readonly request: (request: EthereumRequest) => Promise<unknown>

	public readonly chainId = async (...params: EthChainIdParameters) => {
		const result = await this.request({ method: 'eth_chainId', params })
		return EthChainIdResult.parse(result)
	}

	public readonly call = async (...[transaction, blockTag]: EthCallParameters) => {
		const result =  await this.request({ method: 'eth_call', params: [{...this.address ? {from: this.address} : {}, ...transaction}, blockTag] })
		return EthCallResult.parse(result)
	}

	public readonly getBaseFee = async(blockTag: EthGetBlockByNumberParameters[0]) => {
		const result = await this.request({ method: 'eth_getBlockByNumber', params: [blockTag, false] })
		const block = EthGetBlockByNumberResult.parse(result)
		return block.baseFeePerGas
	}

	public readonly getBalance = async(...params: EthGetBalanceParameters) => {
		const result = await this.request({ method: 'eth_getBalance', params })
		return EthGetBalanceResult.parse(result)
	}

	public readonly getTransactionCount = async (...params: EthGetTransactionCountParameters) => {
		const result = await this.request({ method: 'eth_getTransactionCount', params })
		return EthGetTransactionCountResult.parse(result)
	}

	public readonly getCode = async(...params: EthGetCodeParameters) => {
		const result = await this.request({ method: 'eth_getCode', params })
		return EthGetCodeResult.parse(result)
	}

	public readonly estimateGas = async (...[transaction, blockTag]: EthEstimateGasParameters) => {
		const result = await this.request({ method: 'eth_estimateGas', params: [{...this.address ? {from: this.address} : {}, ...transaction}, blockTag] })
		return EthEstimateGasResult.parse(result)
	}

	public readonly sendRawTransaction = async (...params: EthSendRawTransactionParameters) => {
		const result = await this.request({ method: 'eth_sendRawTransaction', params })
		return EthSendRawTransactionResult.parse(result)
	}

	// Note: not all providers will have this capability
	public readonly requestAccounts = async () => {
		const result = await this.request({ method: 'eth_requestAccounts' })
		return EthRequestAccountsResult.parse(result)
	}

	// Note: not all providers will have this capability
	public readonly sendTransaction = async (...[transaction]: EthSendTransactionParameters) => {
		const result = await this.request({ method: 'eth_sendTransaction', params: [{...this.address ? {from: this.address} : {}, ...transaction}] })
		const transactionHash = EthSendTransactionResult.parse(result)
		return { transactionHash, waitForReceipt: () => this.waitForReceipt(transactionHash) }
	}

	public readonly getTransactionReceipt = async (...params: EthGetTransactionReceiptParameters) => {
		const result = await this.request({ method: 'eth_getTransactionReceipt', params })
		return EthTransactionReceiptResult.parse(result)
	}

	public readonly waitForReceipt = async (transactionHash: bigint) => {
		let receipt: ResolvePromise<ReturnType<typeof this.getTransactionReceipt>>
		while (true) {
			receipt = await this.getTransactionReceipt(transactionHash)
			if (receipt !== null) return receipt
			await sleep(1000)
		}
	}
}

export class EthereumClientWindow extends EthereumClient {
	private constructor() {
		super()
	}

	public override readonly request = async (request: EthereumRequest) => {
		const castedWindow = window as unknown as { ethereum: { request: (request: unknown) => Promise<JsonRpcResponse> } }
		const serialized = serialize(EthereumRequest, request)
		return await castedWindow.ethereum.request(serialized)
	}
	
	public static tryCreate() {
		if (!this.hasWindowEthereum(window)) return undefined
		return new EthereumClientWindow()
	}

	public static hasWindowEthereum(maybeEthereumWindow: Window): maybeEthereumWindow is Window & { ethereum: { request: (x: { method: string, params: unknown[] }) => Promise<unknown> } } {
		if (!('ethereum' in maybeEthereumWindow)) return false
		if (typeof maybeEthereumWindow.ethereum !== 'object') return false
		if (maybeEthereumWindow.ethereum === null) return false
		if (!('request' in maybeEthereumWindow.ethereum)) return false
		if (typeof maybeEthereumWindow.ethereum.request !== 'function') return false
		return true
	}
}

export class EthereumClientJsonRpc extends EthereumClient {
	private nextRequestId: number = 1
	private constructor(
		public readonly endpoint: string,
		private readonly extraHeaders: Record<string, string>,
	) {
		super()
	}

	public static async create(endpoint: string, extraHeaders: Record<string, string> = {}) {
		if (!endpoint.startsWith('http://') && !endpoint.startsWith('https://')) throw new Error(`JSON-RPC URL must start with http:// or https://\n${endpoint}`)
		const result = await jsonRpcRequest(endpoint, { jsonrpc: '2.0', id: 1, method: 'eth_blockNumber' })
		EthereumQuantity.parse(result)
		return new EthereumClientJsonRpc(endpoint, extraHeaders)
	}

	public override readonly request = async (request: EthereumRequest) => {
		return jsonRpcRequest(this.endpoint, { jsonrpc: '2.0', id: ++this.nextRequestId, ...request } as const, this.extraHeaders)
	}

	public override readonly sendTransaction = async () => {
		throw new Error(`Wallet does not support sending transactions.`)
	}
}

export class EthereumClientRecoverable extends EthereumClient {
	private readonly walletContract = contract(RECOVERABLE_WALLET_ABI, toMicroWeb3(this))

	public constructor(
		private readonly underlyingClient: IEthereumClient,
		private readonly underlyingAddress: bigint,
		public override readonly address: bigint,
	) {
		super()
		// TODO: make sure underlynig address matches owner
		// TODO: make sure this is a recoverable wallet during construction
		this.underlyingAddress
	}

	public override readonly request = async (request: EthereumRequest) => await this.underlyingClient.request(request)

	public override readonly call = async (...[transaction, blockTag]: EthCallParameters): ReturnType<EthereumClient['call']> => {
		const result = await this.underlyingClient.call({
			...transaction,
			to: this.address,
			value: 0n,
			data: (transaction.to === null)
				? this.walletContract.deploy.encodeInput({ _value: transaction.value || 0n, _data: transaction.data || new Uint8Array(0), _salt: 0n })
				: this.walletContract.execute.encodeInput({ _to: addressBigintToHex(transaction.to), _value: transaction.value || 0n, _data: transaction.data || new Uint8Array(0) })
		}, blockTag)
		return this.walletContract.execute.decodeOutput(result)
	}

	public override readonly estimateGas = async (...[transaction, blockTag]: EthEstimateGasParameters): ReturnType<EthereumClient['estimateGas']> => {
		return await this.underlyingClient.estimateGas({
			...transaction,
			to: this.address,
			value: 0n,
			data: (transaction.to === null)
				? this.walletContract.deploy.encodeInput({ _value: transaction.value || 0n, _data: transaction.data || new Uint8Array(0), _salt: 0n })
				: this.walletContract.execute.encodeInput({ _to: addressBigintToHex(transaction.to), _value: transaction.value || 0n, _data: transaction.data || new Uint8Array(0) })
		}, blockTag)
	}

	public override readonly sendTransaction = async (...[innerTransaction]: EthSendTransactionParameters): ReturnType<EthereumClient['sendTransaction']> => {
		const outerTransaction = {
			...innerTransaction,
			to: this.address,
			value: 0n,
			data: (innerTransaction.to === null)
				? this.walletContract.deploy.encodeInput({ _value: innerTransaction.value || 0n, _data: innerTransaction.data || new Uint8Array(0), _salt: 0n })
				: this.walletContract.execute.encodeInput({ _to: addressBigintToHex(innerTransaction.to), _value: innerTransaction.value || 0n, _data: innerTransaction.data || new Uint8Array(0) })
		}
		return await this.underlyingClient.sendTransaction({
			...outerTransaction,
			gas: innerTransaction.gas ?? await this.underlyingClient.estimateGas(outerTransaction, 'latest')
		})
	}

	public readonly getOwner = async () => {
		const result = await this.underlyingClient.call({
			to: this.address,
			data: this.walletContract.owner.encodeInput({})
		}, 'latest')
		return bytesToBigint(result)
	}
}

export class EthereumClientSafe extends EthereumClient {
	private readonly walletContract = contract(GNOSIS_SAFE_ABI, toMicroWeb3(this))

	public constructor(
		private readonly underlyingClient: IEthereumClient,
		private readonly underlyingAddress: bigint,
		public override readonly address: bigint,
	) {
		super()
		// TODO: make sure underlynig address matches owner
		// TODO: make sure this is a SAFE wallet during construction
		// TODO: make sure threshold is 1
		this.underlyingAddress
	}

	public override readonly request = async (request: EthereumRequest) => await this.underlyingClient.request(request)

	public override readonly call = async (...[transaction, blockTag]: EthCallParameters): ReturnType<EthereumClient['call']> => {
		if (transaction.to === null) throw new Error(`Contract deployment not supported for Gnosis SAFE wallets.`)
		const result = await this.underlyingClient.call({ ...transaction, from: this.address }, blockTag)
		return result
	}

	public override readonly estimateGas = async (...[transaction, blockTag]: EthEstimateGasParameters): ReturnType<EthereumClient['estimateGas']> => {
		if (transaction.to === null) throw new Error(`Contract deployment not supported for Gnosis SAFE wallets.`)
		const to = addressBigintToHex(transaction.to)
		const value = transaction.value || 0n
		const data = transaction.data || new Uint8Array(0)
		const operation = 0n
		const safeTxGas = 0n
		const baseGas = 0n
		const gasPrice = 0n
		const gasToken = addressBigintToHex(0n)
		const refundReceiver = addressBigintToHex(0n)
		const signatures = hexToBytes(`0x000000000000000000000000${this.underlyingAddress.toString(16).padStart(40,'0')}000000000000000000000000000000000000000000000000000000000000000001`)
		return await this.underlyingClient.estimateGas({
			...transaction,
			to: this.address,
			value: 0n,
			data: this.walletContract.execTransaction.encodeInput({ to, value, data, operation, safeTxGas, baseGas, gasPrice, gasToken, refundReceiver, signatures })
		}, blockTag)
	}

	public override readonly sendTransaction = async (...[innerTransaction]: EthSendTransactionParameters): ReturnType<EthereumClient['sendTransaction']> => {
		if (innerTransaction.to === null) throw new Error(`Contract deployment not supported for Gnosis SAFE wallets.`)
		const to = addressBigintToHex(innerTransaction.to)
		const value = innerTransaction.value || 0n
		const data = innerTransaction.data || new Uint8Array(0)
		// NOTE: `operation` isn't exposed as part of the 'innerTransaction' type, and doing so would be very complicated, so this is a hidden parameter for SAFEs only
		const operation = 'operation' in innerTransaction && innerTransaction.operation === 'DELEGATECALL' ? 1n : 0n
		// app.safe.global fills in safeTxGas even if it doesn't need to, we mirror this behavior to avoid fingerprinting app usage, this is hard though because the revert data is exposed differently by each client
		this.estiamteSafeGas // silence warnings about unused code for now, one day we should make this work in a cross-wallet way
		const safeTxGas = 0n // await this.estiamteSafeGas(innerTransaction.to, value, data, operation)
		const baseGas = 0n
		const gasPrice = 0n
		const gasToken = addressBigintToHex(0n)
		const refundReceiver = addressBigintToHex(0n)
		const signatures = hexToBytes(`0x000000000000000000000000${this.underlyingAddress.toString(16).padStart(40,'0')}000000000000000000000000000000000000000000000000000000000000000001`)
		const outerTransaction = {
			...innerTransaction,
			to: this.address,
			value: 0n,
			data: this.walletContract.execTransaction.encodeInput({ to, value, data, operation, safeTxGas, baseGas, gasPrice, gasToken, refundReceiver, signatures })
		}
		const gas = innerTransaction.gas ?? await this.underlyingClient.estimateGas(outerTransaction, 'latest')
		return await this.underlyingClient.sendTransaction({ ...outerTransaction, gas })
	}

	private readonly estiamteSafeGas = async (to: bigint, value: bigint, data: Uint8Array, operation: bigint) => {
		try {
			await this.call({
				to: this.address,
				value: 0n,
				data: this.walletContract.requiredTxGas.encodeInput({ to: addressBigintToHex(to), value, data, operation }),
			}, 'latest')
			return 0n
		} catch (error: unknown) {
			// NOTE: every client returns error data from eth_call differently, so we have to test against every client and wallet to find the full set of ways revert data may come through.
			if (typeof error !== 'object' || error === null || Array.isArray(error) || !('message' in error) || !('data' in error) || typeof error.data !== 'string') throw error
			const gasLimit = bytesToBigint(new TextEncoder().encode(error.data.slice('execution reverted: '.length)))
			return gasLimit
		}
	}
}

export class EthereumClientMemory extends EthereumClient {
	public constructor(
		private readonly underlyingClient: IEthereumClient,
		private readonly privateKey: bigint,
		public override readonly address: bigint,
	) {
		super()
	}

	public override readonly request = async (request: EthereumRequest) => await this.underlyingClient.request(request)

	public override readonly sendTransaction = async (...[transaction]: EthSendTransactionParameters): ReturnType<EthereumClient['sendTransaction']> => {
		const balance = this.getBalance(this.address, 'latest')
		const nonce = transaction.nonce || this.getTransactionCount(this.address, 'latest')
		const gasLimit = transaction.gas || this.estimateGas(transaction, 'latest')
		const maxFeePerGas = transaction.maxFeePerGas || this.getBaseFee('latest').then(async baseFee => ((baseFee * 2n * await gasLimit + value) > await balance) ? ((await balance - value) / await gasLimit) : baseFee * 2n)
		const chainId = transaction.chainId || this.chainId()
		const value = transaction.value || 0n
		const signedTransaction = await signTransactionWithKey({
			type: '1559',
			chainId: await chainId,
			nonce: await nonce,
			maxFeePerGas: await maxFeePerGas,
			maxPriorityFeePerGas: transaction.maxPriorityFeePerGas || 10n**8n > await maxFeePerGas ? await maxFeePerGas : 10n**8n,
			gasLimit: await gasLimit,
			to: transaction.to || null,
			value,
			data: transaction.data || new Uint8Array(0),
			accessList: [],
		}, this.privateKey)
		const encodedTransaction = encodeTransaction(signedTransaction)
		const transactionHash = await this.sendRawTransaction(encodedTransaction)
		return { transactionHash, waitForReceipt: () => this.waitForReceipt(transactionHash) }
	}
}

export class EthereumClientLedger extends EthereumClient {
	public constructor(
		private readonly underlyingClient: IEthereumClient,
		private readonly derivationPath: string,
		public override readonly address: bigint,
	) {
		super()
	}

	public override readonly request = async (request: EthereumRequest) => await this.underlyingClient.request(request)

	public override readonly sendTransaction = async (...[transaction]: EthSendTransactionParameters): ReturnType<EthereumClient['sendTransaction']> => {
		const balance = this.getBalance(this.address, 'latest')
		const nonce = transaction.nonce || this.getTransactionCount(this.address, 'latest')
		const gasLimit = transaction.gas || this.estimateGas(transaction, 'latest')
		const maxFeePerGas = transaction.maxFeePerGas || this.getBaseFee('latest').then(async baseFee => ((baseFee * 2n * await gasLimit + value) > await balance) ? ((await balance - value) / await gasLimit) : baseFee * 2n)
		const chainId = transaction.chainId || this.chainId()
		const value = transaction.value || 0n
		const unsignedUnencodedTransaction = {
			type: '1559',
			chainId: await chainId,
			nonce: await nonce,
			maxFeePerGas: await maxFeePerGas,
			maxPriorityFeePerGas: transaction.maxPriorityFeePerGas || 10n**8n > await maxFeePerGas ? await maxFeePerGas : 10n**8n,
			gasLimit: await gasLimit,
			to: transaction.to || null,
			value,
			data: transaction.data || new Uint8Array(0),
			accessList: [],
		} as const
		const unsignedEncodedTransaction = encodeTransaction(unsignedUnencodedTransaction)
		const signature = await signTransactionWithLedger(unsignedEncodedTransaction, this.derivationPath)
		const encodedTransaction = encodeTransaction({ ...unsignedUnencodedTransaction, yParity: signature.v, r: signature.r, s: signature.s })
		const transactionHash = await this.sendRawTransaction(encodedTransaction)
		return { transactionHash, waitForReceipt: () => this.waitForReceipt(transactionHash) }
	}
}

export function toMicroWeb3(ethereumClient: IEthereumClient) {
	return {
		ethCall: async (args: {to?: string, data?: string}) => {
			const unsignedTransaction = EthereumUnsignedTransaction.parse({ ...args, to: args.to || null })
			const result = await ethereumClient.call(unsignedTransaction, 'latest')
			return serialize(EthereumData, result)
		},
		estimateGas: async (args: {to?: string}) => {
			const unsignedTransaction = EthereumUnsignedTransaction.parse({ ...args, to: args.to || null })
			const result = await ethereumClient.estimateGas(unsignedTransaction, 'latest')
			return result
		},
	}
}

async function jsonRpcRequest(endpoint: string, request: JsonRpcRequest, extraHeaders: Record<string, string> = {}) {
	const serialized = serialize(JsonRpcRequest, request)
	const body = JSON.stringify(serialized)
	const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', ...extraHeaders }, body })
	if (!response.ok) throw new Error(`${response.status}: ${response.statusText}\n${await response.text()}`)
	const rawJsonRpcResponse = await response.json() as unknown
	const jsonRpcResponse = JsonRpcResponse.parse(rawJsonRpcResponse)
	if ('error' in jsonRpcResponse) {
		function tryGetRevertedData(error: JsonRpcErrorResponse['error']) {
			if (error.message.startsWith('Reverted ')) return error.message.slice('Reverted '.length)
			if (error.message.startsWith('0x')) return error.message
			if (typeof error.data === 'string' && error.data.startsWith('Reverted ')) return error.data.slice('Reverted '.length)
			if (typeof error.data === 'string' && error.data.startsWith('0x')) return error.data
			else return undefined
		}
		const revertedData = tryGetRevertedData(jsonRpcResponse.error)
		if (revertedData === undefined) {
			throw new Error(`JSON-RPC Response Error: ${jsonRpcResponse.error.message}\nRequest:\n${jsonStringify(request)}\nResponse:\n${jsonRpcResponse.error.code}: ${jsonStringify(jsonRpcResponse.error.data)}`)
		} else if (revertedData.startsWith('0x08c379a0')) {
			// slice off the function selector and the string offset
			const errorData = hexToBytes(revertedData).slice(4 + 32)
			const length = Number(bytesToBigint(errorData.slice(0, 32)))
			const utf8String = errorData.slice(32, 32+length)
			const decodedString = new TextDecoder().decode(utf8String)
			throw new Error(`Contract reverted: ${decodedString}`)
		} else if (/^0x[a-fA-F0-9]{8}0/.test(revertedData)) {
			throw new Error(`Contract reverted with unknown encoded error: ${revertedData}`)
		} else if (revertedData.startsWith('0x')) {
			throw new Error(`Contract reverted: ${new TextDecoder().decode(hexToBytes(revertedData))}`)
		} else {
			throw new Error(`Contract reverted: ${revertedData}`)
		}
	}
	return jsonRpcResponse.result
}
