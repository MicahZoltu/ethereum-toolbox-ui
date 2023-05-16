import { TransactionUnsigned } from '@zoltu/ethereum-transactions'
import { HexAddress } from './typescript.js'
import { EthCallParameters, EthereumQuantity, JsonRpcRequest, EthereumRequest, JsonRpcResponse, EthCallResult, EthEstimateGasParameters, EthEstimateGasResult, EthereumData, serialize, EthereumUnsignedTransaction, EthSendTransactionResult, EthSendTransactionParameters, EthereumBytes32, EthSendRawTransactionParameters, EthSendRawTransactionResult, EthTransactionReceiptResult, EthGetTransactionReceiptParameters, EthGetTransactionCountParameters, EthGetTransactionCountResult, EthChainIdParameters, EthChainIdResult, EthRequestAccountsResult } from './wire-types.js'
import { jsonStringify } from './utilities.js'

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
	public abstract readonly request: (request: EthereumRequest) => Promise<unknown>

	public readonly chainId = async (...params: EthChainIdParameters) => {
		const result = await this.request({ method: 'eth_chainId', params })
		return EthChainIdResult.parse(result)
	}

	public readonly call = async (...params: EthCallParameters) => {
		const result =  await this.request({ method: 'eth_call', params })
		return EthCallResult.parse(result)
	}

	public readonly getTransactionCount = async (...params: EthGetTransactionCountParameters) => {
		const result = await this.request({ method: 'eth_getTransactionCount', params })
		return EthGetTransactionCountResult.parse(result)
	}

	public readonly estimateGas = async (...params: EthEstimateGasParameters) => {
		const result = await this.request({ method: 'eth_estimateGas', params })
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
	public readonly sendTransaction = async (...params: EthSendTransactionParameters) => {
		const result = await this.request({ method: 'eth_sendTransaction', params })
		const transactionHash = EthSendTransactionResult.parse(result)
		return { transactionHash, waitForReceipt: () => this.getTransactionReceipt(transactionHash) }
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
		if (!('ethereum' in window) || typeof window.ethereum !== 'object' || window.ethereum === null || !('request' in window.ethereum) || typeof window.ethereum.request !== 'function') {
			return false as const
		}
		return new EthereumClientWindow()
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
		throw new Error(`JSON-RPC Response Error:\nRequest:\n${JSON.stringify(request)}\nResponse:\n${jsonRpcResponse.error.code}: ${jsonRpcResponse.error.message}\n${jsonStringify(jsonRpcResponse.error.data)}`)
	}
	return jsonRpcResponse.result
}
