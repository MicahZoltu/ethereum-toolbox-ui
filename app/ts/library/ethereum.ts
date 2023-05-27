import { TransactionUnsigned } from '@zoltu/ethereum-transactions'
import { addressBigintToHex, bytesToBigint, hexToBytes } from '@zoltu/ethereum-transactions/converters.js'
import { contract } from 'micro-web3'
import { HexAddress, ResolvePromise } from './typescript.js'
import { jsonStringify } from './utilities.js'
import { EthCallParameters, EthCallResult, EthChainIdParameters, EthChainIdResult, EthEstimateGasParameters, EthEstimateGasResult, EthGetBalanceParameters, EthGetBalanceResult, EthGetTransactionCountParameters, EthGetTransactionCountResult, EthGetTransactionReceiptParameters, EthRequestAccountsResult, EthSendRawTransactionParameters, EthSendRawTransactionResult, EthSendTransactionParameters, EthSendTransactionResult, EthTransactionReceiptResult, EthereumBytes32, EthereumData, EthereumQuantity, EthereumRequest, EthereumUnsignedTransaction, JsonRpcRequest, JsonRpcResponse, serialize } from './wire-types.js'

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
	readonly sendTransaction: (transaction: Omit<TransactionUnsigned, 'type' | 'chainId' | 'nonce' | 'gasLimit' | 'maxFeePerGas' | 'maxPriorityFeePerGas' | 'gasPrice'>) => Promise<{ transactionHash: EthereumBytes32, waitForReceipt: () => Promise<EthTransactionReceiptResult>}>
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

	public readonly getBalance = async(...params: EthGetBalanceParameters) => {
		const result = await this.request({ method: 'eth_getBalance', params })
		return EthGetBalanceResult.parse(result)
	}

	public readonly getTransactionCount = async (...params: EthGetTransactionCountParameters) => {
		const result = await this.request({ method: 'eth_getTransactionCount', params })
		return EthGetTransactionCountResult.parse(result)
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
		return {
			transactionHash,
			waitForReceipt: async () => {
				let receipt: ResolvePromise<ReturnType<typeof this.getTransactionReceipt>>
				do {
					receipt = await this.getTransactionReceipt(transactionHash)
				} while (receipt === null)
				return receipt
			}
		}
	}

	public readonly getTransactionReceipt = async (...params: EthGetTransactionReceiptParameters) => {
		const result = await this.request({ method: 'eth_getTransactionReceipt', params })
		return EthTransactionReceiptResult.parse(result)
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

export class EthereumClientContract extends EthereumClient {
	private readonly walletContract = contract([
		{
			"name": "execute",
			"type": "function",
			"stateMutability": "payable",
			"inputs": [
				{"internalType": "address payable","name": "_to","type": "address"},
				{"internalType": "uint256","name": "_value","type": "uint256"},
				{"internalType": "bytes","name": "_data","type": "bytes"}
			],
			"outputs": [
				{"internalType": "bytes","name": "","type": "bytes"}
			],
		},
		{
			"name": "deploy",
			"type": "function",
			"stateMutability": "payable",
			"inputs": [
				{"internalType": "uint256","name": "_value","type": "uint256"},
				{"internalType": "bytes","name": "_data","type": "bytes"},
				{"internalType": "uint256","name": "_salt","type": "uint256"}
			],
			"outputs": [
				{"internalType": "address","name": "","type": "address"}
			],
		},
		{
			"name": "owner",
			"type": "function",
			"stateMutability": "view",
			"inputs": [],
			"outputs": [
				{"internalType": "address","name": "","type": "address"}
			],
		},
	] as const, toMicroWeb3(this))

	public constructor(
		private readonly underlyingClient: IEthereumClient,
		private readonly underlyingAddress: bigint,
		public override readonly address: bigint,
	) {
		super()
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
		if (typeof jsonRpcResponse.error.data === 'string' && jsonRpcResponse.error.data.startsWith('Reverted 0x')) {
			throw new Error(`Contract reverted: ${new TextDecoder().decode(hexToBytes(jsonRpcResponse.error.data.slice('Reverted '.length)))}`)
		} else {
			throw new Error(`JSON-RPC Response Error:\nRequest:\n${jsonStringify(request)}\nResponse:\n${jsonRpcResponse.error.code}: ${jsonRpcResponse.error.message}\n${jsonStringify(jsonRpcResponse.error.data)}`)
		}
	}
	return jsonRpcResponse.result
}
