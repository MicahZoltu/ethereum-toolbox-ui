import { encodeTransaction, signTransaction as signTransactionWithKey } from '@zoltu/ethereum-transactions'
import { addressBigintToHex, addressHexToBigint, bytesToBigint, hexToBytes } from '@zoltu/ethereum-transactions/converters.js'
import { signTransaction as signTransactionWithLedger } from '@zoltu/ethereum-ledger'
import { contract } from 'micro-web3'
import { HexAddress, ResolvePromise } from './typescript.js'
import { jsonStringify } from './utilities.js'
import { EthCallParameters, EthCallResult, EthChainIdParameters, EthChainIdResult, EthEstimateGasParameters, EthEstimateGasResult, EthGetBalanceParameters, EthGetBalanceResult, EthGetTransactionCountParameters, EthGetTransactionCountResult, EthGetTransactionReceiptParameters, EthRequestAccountsResult, EthSendRawTransactionParameters, EthSendRawTransactionResult, EthSendTransactionParameters, EthSendTransactionResult, EthTransactionReceiptResult, EthereumData, EthereumQuantity, EthereumRequest, EthereumUnsignedTransaction, JsonRpcRequest, JsonRpcResponse, serialize } from './wire-types.js'

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

export class EthereumClientRecoverable extends EthereumClient {
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
	private readonly walletContract = contract([
		{
			"anonymous": false,
			"inputs": [
				{
					"indexed": false,
					"internalType": "address",
					"name": "owner",
					"type": "address"
				}
			],
			"name": "AddedOwner",
			"type": "event"
		},
		{
			"anonymous": false,
			"inputs": [
				{
					"indexed": true,
					"internalType": "bytes32",
					"name": "approvedHash",
					"type": "bytes32"
				},
				{
					"indexed": true,
					"internalType": "address",
					"name": "owner",
					"type": "address"
				}
			],
			"name": "ApproveHash",
			"type": "event"
		},
		{
			"anonymous": false,
			"inputs": [
				{
					"indexed": false,
					"internalType": "address",
					"name": "handler",
					"type": "address"
				}
			],
			"name": "ChangedFallbackHandler",
			"type": "event"
		},
		{
			"anonymous": false,
			"inputs": [
				{
					"indexed": false,
					"internalType": "address",
					"name": "guard",
					"type": "address"
				}
			],
			"name": "ChangedGuard",
			"type": "event"
		},
		{
			"anonymous": false,
			"inputs": [
				{
					"indexed": false,
					"internalType": "uint256",
					"name": "threshold",
					"type": "uint256"
				}
			],
			"name": "ChangedThreshold",
			"type": "event"
		},
		{
			"anonymous": false,
			"inputs": [
				{
					"indexed": false,
					"internalType": "address",
					"name": "module",
					"type": "address"
				}
			],
			"name": "DisabledModule",
			"type": "event"
		},
		{
			"anonymous": false,
			"inputs": [
				{
					"indexed": false,
					"internalType": "address",
					"name": "module",
					"type": "address"
				}
			],
			"name": "EnabledModule",
			"type": "event"
		},
		{
			"anonymous": false,
			"inputs": [
				{
					"indexed": false,
					"internalType": "bytes32",
					"name": "txHash",
					"type": "bytes32"
				},
				{
					"indexed": false,
					"internalType": "uint256",
					"name": "payment",
					"type": "uint256"
				}
			],
			"name": "ExecutionFailure",
			"type": "event"
		},
		{
			"anonymous": false,
			"inputs": [
				{
					"indexed": true,
					"internalType": "address",
					"name": "module",
					"type": "address"
				}
			],
			"name": "ExecutionFromModuleFailure",
			"type": "event"
		},
		{
			"anonymous": false,
			"inputs": [
				{
					"indexed": true,
					"internalType": "address",
					"name": "module",
					"type": "address"
				}
			],
			"name": "ExecutionFromModuleSuccess",
			"type": "event"
		},
		{
			"anonymous": false,
			"inputs": [
				{
					"indexed": false,
					"internalType": "bytes32",
					"name": "txHash",
					"type": "bytes32"
				},
				{
					"indexed": false,
					"internalType": "uint256",
					"name": "payment",
					"type": "uint256"
				}
			],
			"name": "ExecutionSuccess",
			"type": "event"
		},
		{
			"anonymous": false,
			"inputs": [
				{
					"indexed": false,
					"internalType": "address",
					"name": "owner",
					"type": "address"
				}
			],
			"name": "RemovedOwner",
			"type": "event"
		},
		{
			"anonymous": false,
			"inputs": [
				{
					"indexed": false,
					"internalType": "address",
					"name": "module",
					"type": "address"
				},
				{
					"indexed": false,
					"internalType": "address",
					"name": "to",
					"type": "address"
				},
				{
					"indexed": false,
					"internalType": "uint256",
					"name": "value",
					"type": "uint256"
				},
				{
					"indexed": false,
					"internalType": "bytes",
					"name": "data",
					"type": "bytes"
				},
				{
					"indexed": false,
					"internalType": "enum Enum.Operation",
					"name": "operation",
					"type": "uint8"
				}
			],
			"name": "SafeModuleTransaction",
			"type": "event"
		},
		{
			"anonymous": false,
			"inputs": [
				{
					"indexed": false,
					"internalType": "address",
					"name": "to",
					"type": "address"
				},
				{
					"indexed": false,
					"internalType": "uint256",
					"name": "value",
					"type": "uint256"
				},
				{
					"indexed": false,
					"internalType": "bytes",
					"name": "data",
					"type": "bytes"
				},
				{
					"indexed": false,
					"internalType": "enum Enum.Operation",
					"name": "operation",
					"type": "uint8"
				},
				{
					"indexed": false,
					"internalType": "uint256",
					"name": "safeTxGas",
					"type": "uint256"
				},
				{
					"indexed": false,
					"internalType": "uint256",
					"name": "baseGas",
					"type": "uint256"
				},
				{
					"indexed": false,
					"internalType": "uint256",
					"name": "gasPrice",
					"type": "uint256"
				},
				{
					"indexed": false,
					"internalType": "address",
					"name": "gasToken",
					"type": "address"
				},
				{
					"indexed": false,
					"internalType": "address payable",
					"name": "refundReceiver",
					"type": "address"
				},
				{
					"indexed": false,
					"internalType": "bytes",
					"name": "signatures",
					"type": "bytes"
				},
				{
					"indexed": false,
					"internalType": "bytes",
					"name": "additionalInfo",
					"type": "bytes"
				}
			],
			"name": "SafeMultiSigTransaction",
			"type": "event"
		},
		{
			"anonymous": false,
			"inputs": [
				{
					"indexed": true,
					"internalType": "address",
					"name": "sender",
					"type": "address"
				},
				{
					"indexed": false,
					"internalType": "uint256",
					"name": "value",
					"type": "uint256"
				}
			],
			"name": "SafeReceived",
			"type": "event"
		},
		{
			"anonymous": false,
			"inputs": [
				{
					"indexed": true,
					"internalType": "address",
					"name": "initiator",
					"type": "address"
				},
				{
					"indexed": false,
					"internalType": "address[]",
					"name": "owners",
					"type": "address[]"
				},
				{
					"indexed": false,
					"internalType": "uint256",
					"name": "threshold",
					"type": "uint256"
				},
				{
					"indexed": false,
					"internalType": "address",
					"name": "initializer",
					"type": "address"
				},
				{
					"indexed": false,
					"internalType": "address",
					"name": "fallbackHandler",
					"type": "address"
				}
			],
			"name": "SafeSetup",
			"type": "event"
		},
		{
			"anonymous": false,
			"inputs": [
				{
					"indexed": true,
					"internalType": "bytes32",
					"name": "msgHash",
					"type": "bytes32"
				}
			],
			"name": "SignMsg",
			"type": "event"
		},
		{
			"stateMutability": "nonpayable",
			"type": "fallback"
		},
		{
			"inputs": [],
			"name": "VERSION",
			"outputs": [
				{
					"internalType": "string",
					"name": "",
					"type": "string"
				}
			],
			"stateMutability": "view",
			"type": "function"
		},
		{
			"inputs": [
				{
					"internalType": "address",
					"name": "owner",
					"type": "address"
				},
				{
					"internalType": "uint256",
					"name": "_threshold",
					"type": "uint256"
				}
			],
			"name": "addOwnerWithThreshold",
			"outputs": [],
			"stateMutability": "nonpayable",
			"type": "function"
		},
		{
			"inputs": [
				{
					"internalType": "bytes32",
					"name": "hashToApprove",
					"type": "bytes32"
				}
			],
			"name": "approveHash",
			"outputs": [],
			"stateMutability": "nonpayable",
			"type": "function"
		},
		{
			"inputs": [
				{
					"internalType": "address",
					"name": "",
					"type": "address"
				},
				{
					"internalType": "bytes32",
					"name": "",
					"type": "bytes32"
				}
			],
			"name": "approvedHashes",
			"outputs": [
				{
					"internalType": "uint256",
					"name": "",
					"type": "uint256"
				}
			],
			"stateMutability": "view",
			"type": "function"
		},
		{
			"inputs": [
				{
					"internalType": "uint256",
					"name": "_threshold",
					"type": "uint256"
				}
			],
			"name": "changeThreshold",
			"outputs": [],
			"stateMutability": "nonpayable",
			"type": "function"
		},
		{
			"inputs": [
				{
					"internalType": "bytes32",
					"name": "dataHash",
					"type": "bytes32"
				},
				{
					"internalType": "bytes",
					"name": "data",
					"type": "bytes"
				},
				{
					"internalType": "bytes",
					"name": "signatures",
					"type": "bytes"
				},
				{
					"internalType": "uint256",
					"name": "requiredSignatures",
					"type": "uint256"
				}
			],
			"name": "checkNSignatures",
			"outputs": [],
			"stateMutability": "view",
			"type": "function"
		},
		{
			"inputs": [
				{
					"internalType": "bytes32",
					"name": "dataHash",
					"type": "bytes32"
				},
				{
					"internalType": "bytes",
					"name": "data",
					"type": "bytes"
				},
				{
					"internalType": "bytes",
					"name": "signatures",
					"type": "bytes"
				}
			],
			"name": "checkSignatures",
			"outputs": [],
			"stateMutability": "view",
			"type": "function"
		},
		{
			"inputs": [
				{
					"internalType": "address",
					"name": "prevModule",
					"type": "address"
				},
				{
					"internalType": "address",
					"name": "module",
					"type": "address"
				}
			],
			"name": "disableModule",
			"outputs": [],
			"stateMutability": "nonpayable",
			"type": "function"
		},
		{
			"inputs": [],
			"name": "domainSeparator",
			"outputs": [
				{
					"internalType": "bytes32",
					"name": "",
					"type": "bytes32"
				}
			],
			"stateMutability": "view",
			"type": "function"
		},
		{
			"inputs": [
				{
					"internalType": "address",
					"name": "module",
					"type": "address"
				}
			],
			"name": "enableModule",
			"outputs": [],
			"stateMutability": "nonpayable",
			"type": "function"
		},
		{
			"inputs": [
				{
					"internalType": "address",
					"name": "to",
					"type": "address"
				},
				{
					"internalType": "uint256",
					"name": "value",
					"type": "uint256"
				},
				{
					"internalType": "bytes",
					"name": "data",
					"type": "bytes"
				},
				{
					"internalType": "enum Enum.Operation",
					"name": "operation",
					"type": "uint8"
				},
				{
					"internalType": "uint256",
					"name": "safeTxGas",
					"type": "uint256"
				},
				{
					"internalType": "uint256",
					"name": "baseGas",
					"type": "uint256"
				},
				{
					"internalType": "uint256",
					"name": "gasPrice",
					"type": "uint256"
				},
				{
					"internalType": "address",
					"name": "gasToken",
					"type": "address"
				},
				{
					"internalType": "address",
					"name": "refundReceiver",
					"type": "address"
				},
				{
					"internalType": "uint256",
					"name": "_nonce",
					"type": "uint256"
				}
			],
			"name": "encodeTransactionData",
			"outputs": [
				{
					"internalType": "bytes",
					"name": "",
					"type": "bytes"
				}
			],
			"stateMutability": "view",
			"type": "function"
		},
		{
			"inputs": [
				{
					"internalType": "address",
					"name": "to",
					"type": "address"
				},
				{
					"internalType": "uint256",
					"name": "value",
					"type": "uint256"
				},
				{
					"internalType": "bytes",
					"name": "data",
					"type": "bytes"
				},
				{
					"internalType": "enum Enum.Operation",
					"name": "operation",
					"type": "uint8"
				},
				{
					"internalType": "uint256",
					"name": "safeTxGas",
					"type": "uint256"
				},
				{
					"internalType": "uint256",
					"name": "baseGas",
					"type": "uint256"
				},
				{
					"internalType": "uint256",
					"name": "gasPrice",
					"type": "uint256"
				},
				{
					"internalType": "address",
					"name": "gasToken",
					"type": "address"
				},
				{
					"internalType": "address payable",
					"name": "refundReceiver",
					"type": "address"
				},
				{
					"internalType": "bytes",
					"name": "signatures",
					"type": "bytes"
				}
			],
			"name": "execTransaction",
			"outputs": [
				{
					"internalType": "bool",
					"name": "",
					"type": "bool"
				}
			],
			"stateMutability": "payable",
			"type": "function"
		},
		{
			"inputs": [
				{
					"internalType": "address",
					"name": "to",
					"type": "address"
				},
				{
					"internalType": "uint256",
					"name": "value",
					"type": "uint256"
				},
				{
					"internalType": "bytes",
					"name": "data",
					"type": "bytes"
				},
				{
					"internalType": "enum Enum.Operation",
					"name": "operation",
					"type": "uint8"
				}
			],
			"name": "execTransactionFromModule",
			"outputs": [
				{
					"internalType": "bool",
					"name": "success",
					"type": "bool"
				}
			],
			"stateMutability": "nonpayable",
			"type": "function"
		},
		{
			"inputs": [
				{
					"internalType": "address",
					"name": "to",
					"type": "address"
				},
				{
					"internalType": "uint256",
					"name": "value",
					"type": "uint256"
				},
				{
					"internalType": "bytes",
					"name": "data",
					"type": "bytes"
				},
				{
					"internalType": "enum Enum.Operation",
					"name": "operation",
					"type": "uint8"
				}
			],
			"name": "execTransactionFromModuleReturnData",
			"outputs": [
				{
					"internalType": "bool",
					"name": "success",
					"type": "bool"
				},
				{
					"internalType": "bytes",
					"name": "returnData",
					"type": "bytes"
				}
			],
			"stateMutability": "nonpayable",
			"type": "function"
		},
		{
			"inputs": [],
			"name": "getChainId",
			"outputs": [
				{
					"internalType": "uint256",
					"name": "",
					"type": "uint256"
				}
			],
			"stateMutability": "view",
			"type": "function"
		},
		{
			"inputs": [
				{
					"internalType": "address",
					"name": "start",
					"type": "address"
				},
				{
					"internalType": "uint256",
					"name": "pageSize",
					"type": "uint256"
				}
			],
			"name": "getModulesPaginated",
			"outputs": [
				{
					"internalType": "address[]",
					"name": "array",
					"type": "address[]"
				},
				{
					"internalType": "address",
					"name": "next",
					"type": "address"
				}
			],
			"stateMutability": "view",
			"type": "function"
		},
		{
			"inputs": [],
			"name": "getOwners",
			"outputs": [
				{
					"internalType": "address[]",
					"name": "",
					"type": "address[]"
				}
			],
			"stateMutability": "view",
			"type": "function"
		},
		{
			"inputs": [
				{
					"internalType": "uint256",
					"name": "offset",
					"type": "uint256"
				},
				{
					"internalType": "uint256",
					"name": "length",
					"type": "uint256"
				}
			],
			"name": "getStorageAt",
			"outputs": [
				{
					"internalType": "bytes",
					"name": "",
					"type": "bytes"
				}
			],
			"stateMutability": "view",
			"type": "function"
		},
		{
			"inputs": [],
			"name": "getThreshold",
			"outputs": [
				{
					"internalType": "uint256",
					"name": "",
					"type": "uint256"
				}
			],
			"stateMutability": "view",
			"type": "function"
		},
		{
			"inputs": [
				{
					"internalType": "address",
					"name": "to",
					"type": "address"
				},
				{
					"internalType": "uint256",
					"name": "value",
					"type": "uint256"
				},
				{
					"internalType": "bytes",
					"name": "data",
					"type": "bytes"
				},
				{
					"internalType": "enum Enum.Operation",
					"name": "operation",
					"type": "uint8"
				},
				{
					"internalType": "uint256",
					"name": "safeTxGas",
					"type": "uint256"
				},
				{
					"internalType": "uint256",
					"name": "baseGas",
					"type": "uint256"
				},
				{
					"internalType": "uint256",
					"name": "gasPrice",
					"type": "uint256"
				},
				{
					"internalType": "address",
					"name": "gasToken",
					"type": "address"
				},
				{
					"internalType": "address",
					"name": "refundReceiver",
					"type": "address"
				},
				{
					"internalType": "uint256",
					"name": "_nonce",
					"type": "uint256"
				}
			],
			"name": "getTransactionHash",
			"outputs": [
				{
					"internalType": "bytes32",
					"name": "",
					"type": "bytes32"
				}
			],
			"stateMutability": "view",
			"type": "function"
		},
		{
			"inputs": [
				{
					"internalType": "address",
					"name": "module",
					"type": "address"
				}
			],
			"name": "isModuleEnabled",
			"outputs": [
				{
					"internalType": "bool",
					"name": "",
					"type": "bool"
				}
			],
			"stateMutability": "view",
			"type": "function"
		},
		{
			"inputs": [
				{
					"internalType": "address",
					"name": "owner",
					"type": "address"
				}
			],
			"name": "isOwner",
			"outputs": [
				{
					"internalType": "bool",
					"name": "",
					"type": "bool"
				}
			],
			"stateMutability": "view",
			"type": "function"
		},
		{
			"inputs": [],
			"name": "nonce",
			"outputs": [
				{
					"internalType": "uint256",
					"name": "",
					"type": "uint256"
				}
			],
			"stateMutability": "view",
			"type": "function"
		},
		{
			"inputs": [
				{
					"internalType": "address",
					"name": "prevOwner",
					"type": "address"
				},
				{
					"internalType": "address",
					"name": "owner",
					"type": "address"
				},
				{
					"internalType": "uint256",
					"name": "_threshold",
					"type": "uint256"
				}
			],
			"name": "removeOwner",
			"outputs": [],
			"stateMutability": "nonpayable",
			"type": "function"
		},
		{
			"inputs": [
				{
					"internalType": "address",
					"name": "to",
					"type": "address"
				},
				{
					"internalType": "uint256",
					"name": "value",
					"type": "uint256"
				},
				{
					"internalType": "bytes",
					"name": "data",
					"type": "bytes"
				},
				{
					"internalType": "enum Enum.Operation",
					"name": "operation",
					"type": "uint8"
				}
			],
			"name": "requiredTxGas",
			"outputs": [
				{
					"internalType": "uint256",
					"name": "",
					"type": "uint256"
				}
			],
			"stateMutability": "nonpayable",
			"type": "function"
		},
		{
			"inputs": [
				{
					"internalType": "address",
					"name": "handler",
					"type": "address"
				}
			],
			"name": "setFallbackHandler",
			"outputs": [],
			"stateMutability": "nonpayable",
			"type": "function"
		},
		{
			"inputs": [
				{
					"internalType": "address",
					"name": "guard",
					"type": "address"
				}
			],
			"name": "setGuard",
			"outputs": [],
			"stateMutability": "nonpayable",
			"type": "function"
		},
		{
			"inputs": [
				{
					"internalType": "address[]",
					"name": "_owners",
					"type": "address[]"
				},
				{
					"internalType": "uint256",
					"name": "_threshold",
					"type": "uint256"
				},
				{
					"internalType": "address",
					"name": "to",
					"type": "address"
				},
				{
					"internalType": "bytes",
					"name": "data",
					"type": "bytes"
				},
				{
					"internalType": "address",
					"name": "fallbackHandler",
					"type": "address"
				},
				{
					"internalType": "address",
					"name": "paymentToken",
					"type": "address"
				},
				{
					"internalType": "uint256",
					"name": "payment",
					"type": "uint256"
				},
				{
					"internalType": "address payable",
					"name": "paymentReceiver",
					"type": "address"
				}
			],
			"name": "setup",
			"outputs": [],
			"stateMutability": "nonpayable",
			"type": "function"
		},
		{
			"inputs": [
				{
					"internalType": "bytes32",
					"name": "",
					"type": "bytes32"
				}
			],
			"name": "signedMessages",
			"outputs": [
				{
					"internalType": "uint256",
					"name": "",
					"type": "uint256"
				}
			],
			"stateMutability": "view",
			"type": "function"
		},
		{
			"inputs": [
				{
					"internalType": "address",
					"name": "targetContract",
					"type": "address"
				},
				{
					"internalType": "bytes",
					"name": "calldataPayload",
					"type": "bytes"
				}
			],
			"name": "simulateAndRevert",
			"outputs": [],
			"stateMutability": "nonpayable",
			"type": "function"
		},
		{
			"inputs": [
				{
					"internalType": "address",
					"name": "prevOwner",
					"type": "address"
				},
				{
					"internalType": "address",
					"name": "oldOwner",
					"type": "address"
				},
				{
					"internalType": "address",
					"name": "newOwner",
					"type": "address"
				}
			],
			"name": "swapOwner",
			"outputs": [],
			"stateMutability": "nonpayable",
			"type": "function"
		},
		{
			"stateMutability": "payable",
			"type": "receive"
		}
	] as const, toMicroWeb3(this))

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
		const operation = 0n
		const safeTxGas = 0n
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
		return await this.underlyingClient.sendTransaction({
			...outerTransaction,
			gas: innerTransaction.gas ?? await this.underlyingClient.estimateGas(outerTransaction, 'latest')
		})
	}

	public readonly isOwner = async (address: bigint) => {
		const result = await this.underlyingClient.call({
			to: this.address,
			data: this.walletContract.isOwner.encodeInput(addressBigintToHex(address))
		}, 'latest')
		return this.walletContract.isOwner.decodeOutput(result)
	}

	public readonly getOwners = async () => {
		const result = await this.underlyingClient.call({
			to: this.address,
			data: this.walletContract.getOwners.encodeInput({}),
		}, 'latest')
		return this.walletContract.getOwners.decodeOutput(result).map(addressHexToBigint)
	}

	public readonly getThreshold = async () => {
		const result = await this.underlyingClient.call({
			to: this.address,
			data: this.walletContract.getThreshold.encodeInput({}),
		}, 'latest')
		return this.walletContract.getThreshold.decodeOutput(result)
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
		const nonce = await this.getTransactionCount(this.address, 'latest')
		const gasLimit = await this.estimateGas(transaction, 'latest')
		const chainId = await this.chainId()
		const signedTransaction = await signTransactionWithKey({
			type: '1559',
			chainId,
			nonce,
			maxFeePerGas: 100n * 10n**9n,
			maxPriorityFeePerGas: 10n**8n,
			gasLimit,
			to: transaction.to || null,
			value: transaction.value || 0n,
			data: transaction.data || new Uint8Array(0),
			accessList: [],
		}, this.privateKey)
		const encodedTransaction = encodeTransaction(signedTransaction)
		const transactionHash = await this.sendRawTransaction(encodedTransaction)
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
		const nonce = await this.getTransactionCount(this.address, 'latest')
		const gasLimit = await this.estimateGas(transaction, 'latest')
		const chainId = await this.chainId()
		const unsignedUnencodedTransaction = {
			type: '1559',
			chainId,
			nonce,
			maxFeePerGas: 100n * 10n**9n,
			maxPriorityFeePerGas: 10n**8n,
			gasLimit,
			to: transaction.to || null,
			value: transaction.value || 0n,
			data: transaction.data || new Uint8Array(0),
			accessList: [],
		} as const
		const unsignedEncodedTransaction = await encodeTransaction(unsignedUnencodedTransaction)
		const signature = await signTransactionWithLedger(unsignedEncodedTransaction, this.derivationPath)
		const encodedTransaction = encodeTransaction({ ...unsignedUnencodedTransaction, yParity: signature.v, r: signature.r, s: signature.s })
		const transactionHash = await this.sendRawTransaction(encodedTransaction)
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
