import { HexAddress } from './typescript.js'
import { EthCallParameters, EthereumQuantity, JsonRpcRequest, EthereumRequest, JsonRpcResponse, EthCallResult, EthEstimateGasParameters, EthEstimateGasResult, EthereumData, serialize, EthereumUnsignedTransaction } from './wire-types.js'

export function fromChecksummedAddress(address: string) {
	// if (!Address.verifyChecksum(address)) throw new Error(`Address ${address} failed checksum verification.`)
	return address as HexAddress
}

export type Wallet = {
	readonly privateKey: bigint
	readonly address: HexAddress
}

export type IProvider = Pick<Provider, keyof Provider>
export class Provider {
	private nextRequestId: number = 1
	private constructor(
		private readonly endpoint: string,
		private readonly extraHeaders: Record<string, string>,
	) {}

	public static async create(endpoint: string, extraHeaders: Record<string, string> = {}) {
		if (!endpoint.startsWith('http://') && !endpoint.startsWith('https://')) throw new Error(`JSON-RPC URL must start with http:// or https://\n${endpoint}`)
		const result = await jsonRpcRequest(endpoint, { jsonrpc: '2.0', id: 1, method: 'eth_blockNumber' })
		EthereumQuantity.parse(result)
		return new Provider(endpoint, extraHeaders)
	}

	public request = async (request: EthereumRequest) => {
		return jsonRpcRequest(this.endpoint, { jsonrpc: '2.0', id: ++this.nextRequestId, ...request } as const, this.extraHeaders)
	}

	public readonly call = async (...params: EthCallParameters) => {
		const result =  await this.request({ method: 'eth_call', params })
		return EthCallResult.parse(result)
	}

	public readonly estimateGas = async (...params: EthEstimateGasParameters) => {
		const result = await this.request({ method: 'eth_estimateGas', params })
		return EthEstimateGasResult.parse(result)
	}
}
export function toMicroWeb3(provider: Provider) {
	return {
		ethCall: async (args: {to?: string}) => {
			const unsignedTransaction = EthereumUnsignedTransaction.parse({ ...args, to: args.to || null })
			const result = await provider.call(unsignedTransaction, 'latest')
			return serialize(EthereumData, result)
		},
		estimateGas: async (args: {to?: string}) => {
			const unsignedTransaction = EthereumUnsignedTransaction.parse({ ...args, to: args.to || null })
			const result = await provider.estimateGas(unsignedTransaction, 'latest')
			return result
		},
	}
}

async function jsonRpcRequest(endpoint: string, request: JsonRpcRequest, extraHeaders: Record<string, string> = {}) {
	const body = JSON.stringify(request)
	const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', ...extraHeaders }, body })
	if (!response.ok) throw new Error(`${response.status}: ${response.statusText}\n${await response.text()}`)
	const rawJsonRpcResponse = await response.json() as unknown
	const jsonRpcResponse = JsonRpcResponse.parse(rawJsonRpcResponse)
	if ('error' in jsonRpcResponse) {
		throw new Error(`JSON-RPC Response Error:\nRequest:\n${JSON.stringify(request)}\nResponse:\n${jsonRpcResponse.error.code}: ${jsonRpcResponse.error.message}\n${JSON.stringify(jsonRpcResponse.error.data)}`)
	}
	return jsonRpcResponse.result
}
