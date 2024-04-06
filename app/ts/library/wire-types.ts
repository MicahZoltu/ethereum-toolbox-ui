import * as t from 'funtypes'
import { UnionToIntersection } from './typescript.js'
import { isJSON } from './utilities.js'

const BigintDecimalParser: t.ParsedValue<t.String, bigint>['config'] = {
	parse: value => {
		if (!/^[0-9]+$/.test(value)) return { success: false, message: `${ value } is not a string encoded number.` }
		else return { success: true, value: BigInt(value) }
	},
	serialize: value => {
		if (typeof value !== 'bigint') return { success: false, message: `${ typeof value } is not a bigint.`}
		return { success: true, value: `${ value.toString() }` }
	},
}

const BigintHexParser: t.ParsedValue<t.String, bigint>['config'] = {
	parse: value => {
		if (!/^0x([a-fA-F0-9]{1,64})$/.test(value)) return { success: false, message: `${value} is not a hex string encoded number.` }
		else return { success: true, value: BigInt(value) }
	},
	serialize: value => {
		if (typeof value !== 'bigint') return { success: false, message: `${typeof value} is not a bigint.`}
		return { success: true, value: `0x${value.toString(16)}` }
	},
}

const SmallintParser: t.ParsedValue<t.String, bigint>['config'] = {
	parse: value => {
		if (!/^0x([a-fA-F0-9]{1,64})$/.test(value)) return { success: false, message: `${value} is not a hex string encoded number.` }
		if (BigInt(value) >= 2n**64n) return { success: false, message: `${value} must be smaller than 2^64.` }
		else return { success: true, value: BigInt(value) }
	},
	serialize: value => {
		if (value >= 2n**64n) return { success: false, message: `${value} must be smaller than 2^64.` }
		if (typeof value !== 'bigint') return { success: false, message: `${typeof value} is not a bigint.`}
		return { success: true, value: `0x${value.toString(16)}` }
	},
}

const AddressParser: t.ParsedValue<t.String, bigint>['config'] = {
	parse: value => {
		if (!/^0x([a-fA-F0-9]{40})$/.test(value)) return { success: false, message: `${value} is not a hex string encoded address.` }
		else return { success: true, value: BigInt(value) }
	},
	serialize: value => {
		if (typeof value !== 'bigint') return { success: false, message: `${typeof value} is not a bigint.`}
		return { success: true, value: `0x${value.toString(16).padStart(40, '0')}` }
	},
}

const Bytes32Parser: t.ParsedValue<t.String, bigint>['config'] = {
	parse: value => {
		if (!/^0x([a-fA-F0-9]{64})$/.test(value)) return { success: false, message: `${value} is not a hex string encoded 32 byte value.` }
		else return { success: true, value: BigInt(value) }
	},
	serialize: value => {
		if (typeof value !== 'bigint') return { success: false, message: `${typeof value} is not a bigint.`}
		return { success: true, value: `0x${value.toString(16).padStart(64, '0')}` }
	},
}

const Bytes256Parser: t.ParsedValue<t.String, bigint>['config'] = {
	parse: value => {
		if (!/^0x([a-fA-F0-9]{512})$/.test(value)) return { success: false, message: `${value} is not a hex string encoded 256 byte value.` }
		else return { success: true, value: BigInt(value) }
	},
	serialize: value => {
		if (typeof value !== 'bigint') return { success: false, message: `${typeof value} is not a bigint.`}
		return { success: true, value: `0x${value.toString(16).padStart(512, '0')}` }
	},
}

const BytesParser: t.ParsedValue<t.String, Uint8Array>['config'] = {
	parse: value => {
		const match = /^(?:0x)?([a-fA-F0-9]*)$/.exec(value)
		if (match === null) return { success: false, message: `Expected a hex string encoded byte array with an optional '0x' prefix but received ${value}` }
		const normalized = match[1]!
		if (normalized.length % 2) return { success: false, message: `Hex string encoded byte array must be an even number of charcaters long.`}
		const bytes = new Uint8Array(normalized.length / 2)
		for (let i = 0; i < normalized.length; i += 2) {
			bytes[i/2] = Number.parseInt(`${normalized[i]}${normalized[i + 1]}`, 16)
		}
		return { success: true, value: new Uint8Array(bytes) }
	},
	serialize: value => {
		if (!(value instanceof Uint8Array)) return { success: false, message: `${typeof value} is not a Uint8Array.`}
		let result = ''
		for (let i = 0; i < value.length; ++i) {
			result += ('0' + value[i]!.toString(16)).slice(-2)
		}
		return { success: true, value: `0x${result}` }
	}
}

const TimestampParser: t.ParsedValue<t.String, Date>['config'] = {
	parse: value => {
		if (!/^0x([a-fA-F0-9]{0,8})$/.test(value)) return { success: false, message: `${value} is not a hex string encoded timestamp.` }
		else return { success: true, value: new Date(Number.parseInt(value, 16) * 1000) }
	},
	serialize: value => {
		if (!(value instanceof Date)) return { success: false, message: `${typeof value} is not a Date.`}
		return { success: true, value: `0x${Math.floor(value.valueOf() / 1000).toString(16)}` }
	},
}

const OptionalBytesParser: t.ParsedValue<t.Union<[t.String, t.Literal<undefined>]>, Uint8Array>['config'] = {
	parse: value => BytesParser.parse(value || '0x'),
	serialize: value => BytesParser.serialize!(value || new Uint8Array()),
}

const EIP712MessageParser: t.ParsedValue<t.String, EIP712Message>['config'] = {
	parse: value => {
		if (!isJSON(value) || !EIP712Message.test(JSON.parse(value))) return { success: false, message: `${ value } is not EIP712 message` }
		else return { success: true, value: EIP712Message.parse(JSON.parse(value)) }
	},
	serialize: value => {
		if (!EIP712Message.test(value)) return { success: false, message: `${ value } is not a EIP712 mmessage.`}
		return { success: true, value: EIP712Message.serialize(value) as string }
	},
}

export const LiteralConverterParserFactory: <TInput, TOutput> (input: TInput, output: TOutput) => t.ParsedValue<t.Runtype<TInput>, TOutput>['config'] = (input, output) => {
	return {
		parse: value => (value === input) ? { success: true, value: output } : { success: false, message: `${value} was expected to be literal.` },
		serialize: value => (value === output) ? { success: true, value: input } : { success: false, message: `${value} was expected to be literal.`  }
	}
}

//
// Generic
//

export type BigintDecimal = t.Static<typeof BigintDecimal>
export const BigintDecimal = t.String.withParser(BigintDecimalParser)

export type BigintHex = t.Static<typeof BigintHex>
export const BigintHex = t.String.withParser(BigintHexParser)

export type TimestampSeconds = t.Static<typeof TimestampSeconds>
export const TimestampSeconds = t.String.withParser(TimestampParser)


//
// Ethereum
//

export type EthereumQuantity = BigintHex
export const EthereumQuantity = BigintHex

export type EthereumQuantitySmall = t.Static<typeof EthereumQuantitySmall>
export const EthereumQuantitySmall = t.String.withParser(SmallintParser)

export type EthereumData = t.Static<typeof EthereumData>
export const EthereumData = t.String.withParser(BytesParser)

export type EthereumAddress = t.Static<typeof EthereumAddress>
export const EthereumAddress = t.String.withParser(AddressParser)

export type EthereumBytes32 = t.Static<typeof EthereumBytes32>
export const EthereumBytes32 = t.String.withParser(Bytes32Parser)

export type EthereumBytes256 = t.Static<typeof EthereumBytes256>
export const EthereumBytes256 = t.String.withParser(Bytes256Parser)

export type EthereumBlockTag = t.Static<typeof EthereumBlockTag>
export const EthereumBlockTag = t.Union(EthereumQuantitySmall, EthereumBytes32, t.Literal('latest'), t.Literal('pending'))

export type EthereumInput = t.Static<typeof EthereumInput>
export const EthereumInput = t.Union(t.String, t.Undefined).withParser(OptionalBytesParser)

export type EthereumAccessList = t.Static<typeof EthereumAccessList>
export const EthereumAccessList = t.ReadonlyArray(
	t.ReadonlyObject({
		address: EthereumAddress,
		storageKeys: t.ReadonlyArray(EthereumBytes32)
	})
)

export type EthereumSignedTransactionLegacy = t.Static<typeof EthereumSignedTransactionLegacy>
export const EthereumSignedTransactionLegacy = 	t.Intersect(
	t.ReadonlyObject({
		type: t.Union(
			t.Literal('0x0').withParser(LiteralConverterParserFactory('0x0', 'legacy' as const)),
			t.Literal(undefined).withParser(LiteralConverterParserFactory(undefined, 'legacy' as const))
		),
		from: EthereumAddress,
		nonce: EthereumQuantity,
		gasPrice: EthereumQuantity,
		gas: EthereumQuantity,
		to: t.Union(EthereumAddress, t.Null),
		value: EthereumQuantity,
		data: EthereumInput,
		r: EthereumQuantity,
		s: EthereumQuantity,
		v: EthereumQuantity,
		hash: EthereumBytes32,
	}),
	t.ReadonlyPartial({
		chainId: EthereumQuantity,
	})
)

export type EthereumSignedTransaction2930 = t.Static<typeof EthereumSignedTransaction2930>
export const EthereumSignedTransaction2930 = t.Intersect(
	t.ReadonlyObject({
		type: t.Literal('0x1').withParser(LiteralConverterParserFactory('0x1', '2930' as const)),
		from: EthereumAddress,
		nonce: EthereumQuantity,
		gasPrice: EthereumQuantity,
		gas: EthereumQuantity,
		to: t.Union(EthereumAddress, t.Null),
		value: EthereumQuantity,
		data: EthereumInput,
		chainId: EthereumQuantity,
		r: EthereumQuantity,
		s: EthereumQuantity,
		yParity: t.Union(
			t.Literal('0x0').withParser(LiteralConverterParserFactory('0x0', 'even' as const)),
			t.Literal('0x1').withParser(LiteralConverterParserFactory('0x1', 'odd' as const))
		),
		hash: EthereumBytes32,
	}),
	t.ReadonlyPartial({
		accessList: EthereumAccessList,
	}),
)

export type EthereumSignedTransaction1559 = t.Static<typeof EthereumSignedTransaction1559>
export const EthereumSignedTransaction1559 = t.Intersect(
	t.ReadonlyObject({
		type: t.Literal('0x2').withParser(LiteralConverterParserFactory('0x2', '1559' as const)),
		from: EthereumAddress,
		nonce: EthereumQuantity,
		maxFeePerGas: EthereumQuantity,
		maxPriorityFeePerGas: EthereumQuantity,
		gas: EthereumQuantity,
		to: t.Union(EthereumAddress, t.Null),
		value: EthereumQuantity,
		data: EthereumInput,
		chainId: EthereumQuantity,
		r: EthereumQuantity,
		s: EthereumQuantity,
		yParity: t.Union(
			t.Literal('0x0').withParser(LiteralConverterParserFactory('0x0', 'even' as const)),
			t.Literal('0x1').withParser(LiteralConverterParserFactory('0x1', 'odd' as const))
		),
		hash: EthereumBytes32,
	}),
	t.ReadonlyPartial({
		accessList: EthereumAccessList,
	}),
)

export type EthereumSignedTransaction = t.Static<typeof EthereumSignedTransaction>
export const EthereumSignedTransaction = t.Union(EthereumSignedTransactionLegacy, EthereumSignedTransaction2930, EthereumSignedTransaction1559)

export type EthereumSignedTransactionWithBlockData = t.Static<typeof EthereumSignedTransactionWithBlockData>
export const EthereumSignedTransactionWithBlockData = t.Intersect(
	t.Union(
		EthereumSignedTransactionLegacy,
		EthereumSignedTransaction2930,
		t.Intersect(EthereumSignedTransaction1559, t.ReadonlyObject({gasPrice: EthereumQuantity})),
	),
	t.ReadonlyObject({
		blockHash: t.Union(EthereumBytes32, t.Null),
		blockNumber: t.Union(EthereumQuantity, t.Null),
		transactionIndex: t.Union(EthereumQuantity, t.Null)
	})
)

export type EthereumUnsignedTransaction1559 = t.Static<typeof EthereumUnsignedTransaction1559>
export const EthereumUnsignedTransaction1559 = t.Intersect(
	t.ReadonlyObject({
		to: t.Union(EthereumAddress, t.Null),
	}),
	t.ReadonlyPartial({
		type: t.Literal('0x2').withParser(LiteralConverterParserFactory('0x2', '1559' as const)),
		from: EthereumAddress,
		nonce: EthereumQuantity,
		maxFeePerGas: EthereumQuantity,
		maxPriorityFeePerGas: EthereumQuantity,
		gas: EthereumQuantity,
		value: EthereumQuantity,
		data: EthereumInput,
		chainId: EthereumQuantity,
		accessList: EthereumAccessList,
	}),
)

export type EthereumUnsignedTransaction = t.Static<typeof EthereumUnsignedTransaction>
export const EthereumUnsignedTransaction = t.Union(EthereumUnsignedTransaction1559)

export type EthereumBlockHeader = t.Static<typeof EthereumBlockHeader>
export const EthereumBlockHeader = t.ReadonlyObject({
	difficulty: EthereumQuantity,
	extraData: EthereumData,
	gasLimit: EthereumQuantity,
	gasUsed: EthereumQuantity,
	hash: EthereumBytes32,
	logsBloom: EthereumBytes256,
	miner: EthereumAddress,
	mixHash: EthereumBytes32,
	nonce: EthereumQuantity,
	number: EthereumQuantity,
	parentHash: EthereumBytes32,
	receiptsRoot: EthereumBytes32,
	sha3Uncles: EthereumBytes32,
	stateRoot: EthereumBytes32,
	timestamp: TimestampSeconds,
	size: EthereumQuantity,
	totalDifficulty: EthereumQuantity,
	baseFeePerGas: EthereumQuantity,
	transactionsRoot: EthereumBytes32
})

export type EthereumBlockHeaderWithTransactionHashes = t.Static<typeof EthereumBlockHeaderWithTransactionHashes>
export const EthereumBlockHeaderWithTransactionHashes = t.Intersect(
	EthereumBlockHeader,
	t.ReadonlyObject({ transactions: t.ReadonlyArray(EthereumBytes32) })
)

export type EthereumBlockHeaderWithTransactions = t.Static<typeof EthereumBlockHeaderWithTransactions>
export const EthereumBlockHeaderWithTransactions = t.Intersect(
	EthereumBlockHeader,
	t.ReadonlyObject({ transactions: t.ReadonlyArray(EthereumSignedTransaction) })
)

export type EthereumLog = t.Static<typeof EthereumLog>
export const EthereumLog = t.ReadonlyObject({
	removed: t.Boolean,
	logIndex: t.Union(EthereumQuantity, t.Null),
	transactionIndex: t.Union(EthereumQuantity, t.Null),
	transactionHash: t.Union(EthereumBytes32, t.Null),
	blockHash: t.Union(EthereumBytes32, t.Null),
	blockNumber: t.Union(EthereumQuantity, t.Null),
	address: EthereumAddress,
	data: EthereumInput,
	topics: t.ReadonlyArray(EthereumBytes32),
})

//
// Helpers
//

export function serialize<T, U extends t.Codec<T>>(funtype: U, value: T) {
	return funtype.serialize(value) as ToWireType<U>
}

export type ToWireType<T> =
	T extends t.Intersect<infer U> ? UnionToIntersection<{ [I in keyof U]: ToWireType<U[I]> }[number]>
	: T extends t.Union<infer U> ? { [I in keyof U]: ToWireType<U[I]> }[number]
	: T extends t.Record<infer U, infer V> ? Record<t.Static<U>, ToWireType<V>>
	: T extends t.Partial<infer U, infer V> ? V extends true ? { readonly [K in keyof U]?: ToWireType<U[K]> } : { [K in keyof U]?: ToWireType<U[K]> }
	: T extends t.Object<infer U, infer V> ? V extends true ? { readonly [K in keyof U]: ToWireType<U[K]> } : { [K in keyof U]: ToWireType<U[K]> }
	: T extends t.Readonly<t.Tuple<infer U>> ? { readonly [P in keyof U]: ToWireType<U[P]>}
	: T extends t.Tuple<infer U> ? { [P in keyof U]: ToWireType<U[P]>}
	: T extends t.ReadonlyArray<infer U> ? readonly ToWireType<U>[]
	: T extends t.Array<infer U> ? ToWireType<U>[]
	: T extends t.ParsedValue<infer U, infer _> ? ToWireType<U>
	: T extends t.Codec<infer U> ? U
	: never

//
// JSON-RPC Request/Response
//

export type NewHeadsSubscriptionData = t.Static<typeof NewHeadsSubscriptionData>
export const NewHeadsSubscriptionData = t.ReadonlyObject({
	subscription: t.String,
	result: EthereumBlockHeaderWithTransactionHashes,
})

export type JsonRpcNewHeadsNotification = t.Static<typeof JsonRpcNewHeadsNotification>
export const JsonRpcNewHeadsNotification = t.ReadonlyObject({
	jsonrpc: t.Literal('2.0'),
	method: t.String,
	params: NewHeadsSubscriptionData
})

export type JsonSubscriptionNotification = t.Static<typeof JsonSubscriptionNotification>
export const JsonSubscriptionNotification = t.ReadonlyObject({
	jsonrpc: t.Literal('2.0'),
	method: t.Literal('eth_subscription'),
	params: t.ReadonlyObject({
		result: t.Union(EthereumBlockHeader, EthereumBytes32),
		subscription: t.String
	})
})

export type JsonRpcSuccessResponse = t.Static<typeof JsonRpcSuccessResponse>
export const JsonRpcSuccessResponse = t.ReadonlyObject({
	jsonrpc: t.Literal('2.0'),
	id: t.Union(t.String, t.Number),
	result: t.Unknown,
})

export type JsonRpcErrorResponse = t.Static<typeof JsonRpcErrorResponse>
export const JsonRpcErrorResponse = t.ReadonlyObject({
	jsonrpc: t.Literal('2.0'),
	id: t.Union(t.String, t.Number),
	error: t.ReadonlyObject({
		code: t.Number,
		message: t.String,
		data: t.Unknown,
	}),
})

export type JsonRpcNotification = t.Static<typeof JsonRpcNotification>
export const JsonRpcNotification = t.Union(JsonRpcNewHeadsNotification, JsonSubscriptionNotification)

export type JsonRpcRequestBase = t.Static<typeof JsonRpcRequestBase>
export const JsonRpcRequestBase = t.Intersect(
	t.ReadonlyObject({
		jsonrpc: t.Literal('2.0'),
		id: t.Union(t.String, t.Number)
	})
)

export type JsonRpcResponse = t.Static<typeof JsonRpcResponse>
export const JsonRpcResponse = t.Union(JsonRpcErrorResponse, JsonRpcSuccessResponse)

export type JsonRpcMessage = t.Static<typeof JsonRpcMessage>
export const JsonRpcMessage = t.Union(JsonRpcResponse, JsonRpcNotification, JsonRpcRequestBase)

export type EthAccountsParameters = t.Static<typeof EthAccountsParameters>
export const EthAccountsParameters = t.ReadonlyTuple()
export type EthAccountsRequest = t.Static<typeof EthAccountsRequest>
export const EthAccountsRequest = t.ReadonlyObject({ method: t.Literal('eth_accounts') })
export type EthAccountsJsonRpcRequest = t.Static<typeof EthAccountsJsonRpcRequest>
export const EthAccountsJsonRpcRequest = t.Intersect(JsonRpcRequestBase, EthAccountsRequest)
export type EthAccountsResult = t.Static<typeof EthAccountsResult>
export const EthAccountsResult = t.ReadonlyArray(EthereumAddress)

export type EthBlockNumberParameters = t.Static<typeof EthBlockNumberParameters>
export const EthBlockNumberParameters = t.ReadonlyTuple()
export type EthBlockNumberRequest = t.Static<typeof EthBlockNumberRequest>
export const EthBlockNumberRequest = t.ReadonlyObject({ method: t.Literal('eth_blockNumber') })
export type EthBlockNumberJsonRpcRequest = t.Static<typeof EthBlockNumberJsonRpcRequest>
export const EthBlockNumberJsonRpcRequest = t.Intersect(JsonRpcRequestBase, EthBlockNumberRequest)
export type EthBlockNumberResult = t.Static<typeof EthBlockNumberResult>
export const EthBlockNumberResult = EthereumQuantity

export type EthCallParameters = t.Static<typeof EthCallParameters>
export const EthCallParameters = t.ReadonlyTuple(EthereumUnsignedTransaction, EthereumBlockTag)
export type EthCallRequest = t.Static<typeof EthCallRequest>
export const EthCallRequest = t.ReadonlyObject({ method: t.Literal('eth_call'), params: EthCallParameters })
export type EthCallJsonRpcRequest = t.Static<typeof EthCallJsonRpcRequest>
export const EthCallJsonRpcRequest = t.Intersect(JsonRpcRequestBase, EthCallRequest)
export type EthCallResult = t.Static<typeof EthCallResult>
export const EthCallResult = EthereumData

export type EthChainIdParameters = t.Static<typeof EthChainIdParameters>
export const EthChainIdParameters = t.ReadonlyTuple()
export type EthChainIdRequest = t.Static<typeof EthChainIdRequest>
export const EthChainIdRequest = t.ReadonlyObject({ method: t.Literal('eth_chainId'), params: EthChainIdParameters })
export type EthChainIdJsonRpcRequest = t.Static<typeof EthChainIdJsonRpcRequest>
export const EthChainIdJsonRpcRequest = t.Intersect(JsonRpcRequestBase, EthChainIdRequest)
export type EthChainIdResult = t.Static<typeof EthChainIdResult>
export const EthChainIdResult = EthereumQuantity

export type EthEstimateGasParameters = t.Static<typeof EthEstimateGasParameters>
export const EthEstimateGasParameters = t.ReadonlyTuple(EthereumUnsignedTransaction, EthereumBlockTag)
export type EthEstimateGasRequest = t.Static<typeof EthEstimateGasRequest>
export const EthEstimateGasRequest = t.ReadonlyObject({ method: t.Literal('eth_estimateGas'), params: EthEstimateGasParameters})
export type EthEstimateGasJsonRpcRequest = t.Static<typeof EthEstimateGasJsonRpcRequest>
export const EthEstimateGasJsonRpcRequest = t.Intersect(JsonRpcRequestBase, EthEstimateGasRequest)
export type EthEstimateGasResult = t.Static<typeof EthEstimateGasResult>
export const EthEstimateGasResult = EthereumQuantity

export type EthGetBalanceParameters = t.Static<typeof EthGetBalanceParameters>
export const EthGetBalanceParameters = t.ReadonlyTuple(EthereumAddress, EthereumBlockTag)
export type EthGetBalanceRequest = t.Static<typeof EthGetBalanceRequest>
export const EthGetBalanceRequest = t.ReadonlyObject({ method: t.Literal('eth_getBalance'), params: EthGetBalanceParameters})
export type EthGetBalanceJsonRpcRequest = t.Static<typeof EthGetBalanceJsonRpcRequest>
export const EthGetBalanceJsonRpcRequest = t.Intersect(JsonRpcRequestBase, EthGetBalanceRequest)
export type EthGetBalanceResult = t.Static<typeof EthGetBalanceResult>
export const EthGetBalanceResult = EthereumQuantity

export type EthGetBlockByNumberParameters = t.Static<typeof EthGetBlockByNumberParameters>
export const EthGetBlockByNumberParameters = t.ReadonlyTuple(EthereumBlockTag, t.Boolean)
export type EthGetBlockByNumberRequest = t.Static<typeof EthGetBlockByNumberRequest>
export const EthGetBlockByNumberRequest = t.ReadonlyObject({ method: t.Literal('eth_getBlockByNumber'), params: EthGetBlockByNumberParameters})
export type EthGetBlockByNumberJsonRpcRequest = t.Static<typeof EthGetBlockByNumberJsonRpcRequest>
export const EthGetBlockByNumberJsonRpcRequest = t.Intersect(JsonRpcRequestBase, EthGetBlockByNumberRequest)
export type EthGetBlockByNumberResult = t.Static<typeof EthGetBlockByNumberResult>
export const EthGetBlockByNumberResult = t.Union(EthereumBlockHeaderWithTransactionHashes, EthereumBlockHeaderWithTransactions)

export type EthGetLogsParameters = t.Static<typeof EthGetLogsParameters>
export const EthGetLogsParameters = t.Intersect(
	t.Union(
		t.ReadonlyObject({ blockHash: EthereumBytes32 }),
		t.ReadonlyObject({ fromBlock: EthereumQuantity, toBlock: t.Union(EthereumQuantity, t.Literal('latest')) }),
	),
	t.ReadonlyPartial({
		address: EthereumAddress,
		topics: t.ReadonlyArray(t.Union(EthereumBytes32, t.ReadonlyArray(EthereumBytes32))),
	})
)
export type EthGetLogsRequest = t.Static<typeof EthGetLogsRequest>
export const EthGetLogsRequest = t.ReadonlyObject({ method: t.Literal(''), params: EthGetLogsParameters })
export type EthGetLogsJsonRpcRequest = t.Static<typeof EthGetLogsJsonRpcRequest>
export const EthGetLogsJsonRpcRequest = t.Intersect(JsonRpcRequestBase, EthGetLogsRequest)
export type EthGetLogsResult = t.Static<typeof EthGetLogsResult>
export const EthGetLogsResult = t.ReadonlyArray(EthereumLog)

export type EthGetStorageAtParameters = t.Static<typeof EthGetStorageAtParameters>
export const EthGetStorageAtParameters = t.ReadonlyTuple(EthereumAddress, EthereumQuantity)
export type EthGetStorageAtRequest = t.Static<typeof EthGetStorageAtRequest>
export const EthGetStorageAtRequest = t.ReadonlyObject({ method: t.Literal(''), params: EthGetStorageAtParameters })
export type EthGetStorageAtJsonRpcRequest = t.Static<typeof EthGetStorageAtJsonRpcRequest>
export const EthGetStorageAtJsonRpcRequest = t.Intersect(JsonRpcRequestBase, EthGetStorageAtRequest)
export type EthGetStorageAtResult = t.Static<typeof EthGetStorageAtResult>
export const EthGetStorageAtResult = t.Union(
	EthereumBytes32,
	t.String.withParser({ parse: x => x === '0x' ? { success: true, value: null } : { success: false, message: `eth_getStorageAt didn't return 32 bytes of data nor 0x.` } }),
)

export type EthGetTransactionByHashParameters = t.Static<typeof EthGetTransactionByHashParameters>
export const EthGetTransactionByHashParameters = t.ReadonlyTuple(EthereumBytes32)
export type EthGetTransactionByHashRequest = t.Static<typeof EthGetTransactionByHashRequest>
export const EthGetTransactionByHashRequest = t.ReadonlyObject({ method: t.Literal('eth_getTransactionByHash'), params: EthGetTransactionByHashParameters })
export type EthGetTransactionByHashJsonRpcRequest = t.Static<typeof EthGetTransactionByHashJsonRpcRequest>
export const EthGetTransactionByHashJsonRpcRequest = t.Intersect(JsonRpcRequestBase, EthGetTransactionByHashRequest)
export type EthGetTransactionByHashResult = t.Static<typeof EthGetTransactionByHashResult>
export const EthGetTransactionByHashResult = EthereumSignedTransaction

export type EthGetTransactionCountParameters = t.Static<typeof EthGetTransactionCountParameters>
export const EthGetTransactionCountParameters = t.ReadonlyTuple(EthereumAddress, EthereumBlockTag)
export type EthGetTransactionCountRequest = t.Static<typeof EthGetTransactionCountRequest>
export const EthGetTransactionCountRequest = t.ReadonlyObject({ method: t.Literal('eth_getTransactionCount'), params: EthGetTransactionCountParameters })
export type EthGetTransactionCountJsonRpcRequest = t.Static<typeof EthGetTransactionCountJsonRpcRequest>
export const EthGetTransactionCountJsonRpcRequest = t.Intersect(JsonRpcRequestBase, EthGetTransactionCountRequest)
export type EthGetTransactionCountResult = t.Static<typeof EthGetTransactionCountResult>
export const EthGetTransactionCountResult = EthereumQuantity

export type EthGetCodeParameters = t.Static<typeof EthGetCodeParameters>
export const EthGetCodeParameters = t.ReadonlyTuple(EthereumAddress, EthereumBlockTag)
export type EthGetCodeRequest = t.Static<typeof EthGetCodeRequest>
export const EthGetCodeRequest = t.ReadonlyObject({ method: t.Literal('eth_getCode'), params: EthGetCodeParameters })
export type EthGetCodeJsonRpcRequest = t.Static<typeof EthGetCodeJsonRpcRequest>
export const EthGetCodeJsonRpcRequest = t.Intersect(JsonRpcRequestBase, EthGetCodeRequest)
export type EthGetCodeResult = t.Static<typeof EthGetCodeResult>
export const EthGetCodeResult = EthereumData

export type EthGetTransactionReceiptParameters = t.Static<typeof EthGetTransactionReceiptParameters>
export const EthGetTransactionReceiptParameters = t.ReadonlyTuple(EthereumBytes32)
export type EthGetTransactionReceiptRequest = t.Static<typeof EthGetTransactionReceiptRequest>
export const EthGetTransactionReceiptRequest = t.ReadonlyObject({ method: t.Literal('eth_getTransactionReceipt'), params: EthGetTransactionReceiptParameters })
export type EthGetTransactionReceiptJsonRpcRequest = t.Static<typeof EthGetTransactionReceiptJsonRpcRequest>
export const EthGetTransactionReceiptJsonRpcRequest = t.Intersect(JsonRpcRequestBase, EthGetTransactionReceiptRequest)
export type EthTransactionReceiptResult = t.Static<typeof EthTransactionReceiptResult>
export const EthTransactionReceiptResult = t.Union(
	t.Null,
	t.ReadonlyObject({
		type: t.Union(
			t.Union(t.Literal('0x0').withParser(LiteralConverterParserFactory('0x0', 'legacy' as const)), t.Literal(undefined).withParser(LiteralConverterParserFactory(undefined, 'legacy' as const))),
			t.Literal('0x0').withParser(LiteralConverterParserFactory('0x0', 'legacy' as const)),
			t.Literal('0x1').withParser(LiteralConverterParserFactory('0x1', '2930' as const)),
			t.Literal('0x2').withParser(LiteralConverterParserFactory('0x2', '1559' as const)),
		),
		blockHash: EthereumBytes32,
		blockNumber: EthereumQuantity,
		transactionHash: EthereumBytes32,
		transactionIndex: EthereumQuantity,
		contractAddress: t.Union(t.Null, EthereumAddress),
		cumulativeGasUsed: EthereumQuantity,
		gasUsed: EthereumQuantity,
		effectiveGasPrice: EthereumQuantity,
		from: EthereumAddress,
		to: t.Union(t.Null, EthereumAddress),
		logs: t.ReadonlyArray(EthereumLog),
		logsBloom: EthereumBytes256,
		status: t.Union(
			t.Literal('0x0').withParser(LiteralConverterParserFactory('0x0', 'failure' as const)),
			t.Literal('0x1').withParser(LiteralConverterParserFactory('0x1', 'success' as const)),
		),
	})
)

export type EthRequestAccountsParameters = t.Static<typeof EthRequestAccountsParameters>
export const EthRequestAccountsParameters = t.ReadonlyTuple()
export type EthRequestAccountsRequest = t.Static<typeof EthRequestAccountsRequest>
export const EthRequestAccountsRequest = t.ReadonlyObject({ method: t.Literal('eth_requestAccounts') })
export type EthRequestAccountsJsonRpcRequest = t.Static<typeof EthRequestAccountsJsonRpcRequest>
export const EthRequestAccountsJsonRpcRequest = t.Intersect(JsonRpcRequestBase, EthRequestAccountsRequest)
export type EthRequestAccountsResult = t.Static<typeof EthRequestAccountsResult>
export const EthRequestAccountsResult = t.ReadonlyArray(EthereumAddress)

export type EthSendRawTransactionParameters = t.Static<typeof EthSendRawTransactionParameters>
export const EthSendRawTransactionParameters = t.ReadonlyTuple(EthereumData)
export type EthSendRawTransactionRequest = t.Static<typeof EthSendRawTransactionRequest>
export const EthSendRawTransactionRequest = t.ReadonlyObject({ method: t.Literal('eth_sendRawTransaction'), params: EthSendRawTransactionParameters })
export type EthSendRawTransactionJsonRpcRequest = t.Static<typeof EthSendRawTransactionJsonRpcRequest>
export const EthSendRawTransactionJsonRpcRequest = t.Intersect(JsonRpcRequestBase, EthSendRawTransactionRequest)
export type EthSendRawTransactionResult = t.Static<typeof EthSendRawTransactionResult>
export const EthSendRawTransactionResult = EthereumBytes32

export type EthSendTransactionParameters = t.Static<typeof EthSendTransactionParameters>
export const EthSendTransactionParameters = t.ReadonlyTuple(EthereumUnsignedTransaction)
export type EthSendTransactionRequest = t.Static<typeof EthSendTransactionRequest>
export const EthSendTransactionRequest = t.ReadonlyObject({ method: t.Literal('eth_sendTransaction'), params: EthSendTransactionParameters })
export type EthSendTransactionJsonRpcRequest = t.Static<typeof EthSendTransactionJsonRpcRequest>
export const EthSendTransactionJsonRpcRequest = t.Intersect(JsonRpcRequestBase, EthSendTransactionRequest)
export type EthSendTransactionResult = t.Static<typeof EthSendTransactionResult>
export const EthSendTransactionResult = EthereumBytes32

export type EthereumRequest = t.Static<typeof EthereumRequest>
export const EthereumRequest = t.Union(
	EthAccountsRequest,
	EthBlockNumberRequest,
	EthCallRequest,
	EthChainIdRequest,
	EthEstimateGasRequest,
	EthGetBalanceRequest,
	EthGetBlockByNumberRequest,
	EthGetLogsRequest,
	EthGetStorageAtRequest,
	EthGetTransactionByHashRequest,
	EthGetTransactionCountRequest,
	EthGetCodeRequest,
	EthGetTransactionReceiptRequest,
	EthRequestAccountsRequest,
	EthSendRawTransactionRequest,
	EthSendTransactionRequest,
)
export type JsonRpcRequest = t.Static<typeof JsonRpcRequest>
export const JsonRpcRequest = t.Union(
	EthAccountsJsonRpcRequest,
	EthBlockNumberJsonRpcRequest,
	EthCallJsonRpcRequest,
	EthChainIdJsonRpcRequest,
	EthEstimateGasJsonRpcRequest,
	EthGetBalanceJsonRpcRequest,
	EthGetBlockByNumberJsonRpcRequest,
	EthGetLogsJsonRpcRequest,
	EthGetStorageAtJsonRpcRequest,
	EthGetTransactionByHashJsonRpcRequest,
	EthGetTransactionCountJsonRpcRequest,
	EthGetCodeJsonRpcRequest,
	EthGetTransactionReceiptJsonRpcRequest,
	EthRequestAccountsJsonRpcRequest,
	EthSendRawTransactionJsonRpcRequest,
	EthSendTransactionJsonRpcRequest,
)

//
// Subscriptions
//

export type EthSubscribeParams = t.Static<typeof EthSubscribeParams>
export const EthSubscribeParams = t.ReadonlyTuple(t.Union(t.Literal('newHeads'), t.Literal('logs'), t.Literal('newPendingTransactions'), t.Literal('syncing')))

export type EthUnsubscribeParams = t.Static<typeof EthUnsubscribeParams>
export const EthUnsubscribeParams = t.ReadonlyTuple(t.String)

export type EthSubscribeResult = t.Static<typeof EthSubscribeResult>
export const EthSubscribeResult = EthereumQuantity

//
// Signing
//

export type EthPersonalSignParameters = t.Static<typeof EthPersonalSignParameters>
export const EthPersonalSignParameters = t.Union(
	t.ReadonlyTuple(t.String, EthereumAddress, t.Union(t.String, t.Undefined)), // message, account, password
	t.ReadonlyTuple(t.String, EthereumAddress) // message, account
)

export type EIP712Message = t.Static<typeof EIP712Message>
export const EIP712Message = t.ReadonlyObject({
	types: t.Record(t.String, t.ReadonlyArray(
		t.ReadonlyObject({
			name: t.String,
			type: t.String,
		})
	)),
	primaryType: t.String,
	domain: t.Record(t.String, t.String),
	message: t.Record(t.String, t.Union(t.Record(t.String, t.String), t.String)),
})

export type SignTypedDataParams = t.Static<typeof SignTypedDataParams>
export const SignTypedDataParams = t.ReadonlyObject({
	method: t.Union(
		t.Literal('eth_signTypedData'),
		t.Literal('eth_signTypedData_v1'),
		t.Literal('eth_signTypedData_v2'),
		t.Literal('eth_signTypedData_v3'),
		t.Literal('eth_signTypedData_v4'),
	),
	params: t.ReadonlyTuple(EthereumAddress, t.String.withParser(EIP712MessageParser)), // address that will sign the message, typed data
})

export type GetCode = t.Static<typeof GetCode>
export const GetCode = t.ReadonlyObject({
	method: t.Literal('eth_getCode'),
	params: t.ReadonlyTuple(EthereumAddress, EthereumBlockTag)
})

export type Eip2612Message = t.Static<typeof Eip2612Message>
export const Eip2612Message = t.ReadonlyObject({
	types: t.ReadonlyObject({
		EIP712Domain: t.ReadonlyTuple(
			t.ReadonlyObject({
				name: t.Literal('name'),
				type: t.Literal('string'),
			}),
			t.ReadonlyObject({
				name: t.Literal('version'),
				type: t.Literal('string'),
			}),
			t.ReadonlyObject({
				name: t.Literal('chainId'),
				type: t.Literal('uint256'),
			}),
			t.ReadonlyObject({
				name: t.Literal('verifyingContract'),
				type: t.Literal('address'),
			}),
		),
		Permit: t.ReadonlyTuple(
			t.ReadonlyObject({
				name: t.Literal('owner'),
				type: t.Literal('address'),
			}),
			t.ReadonlyObject({
				name: t.Literal('spender'),
				type: t.Literal('address'),
			}),
			t.ReadonlyObject({
				name: t.Literal('value'),
				type: t.Literal('uint256'),
			}),
			t.ReadonlyObject({
				name: t.Literal('nonce'),
				type: t.Literal('uint256'),
			}),
			t.ReadonlyObject({
				name: t.Literal('deadline'),
				type: t.Literal('uint256'),
			}),
		),
	}),
	primaryType: t.Literal('Permit'),
	domain: t.ReadonlyObject({
		name: t.String,
		version: BigintDecimal,
		chainId: t.Number,
		verifyingContract: EthereumAddress,
	}),
	message: t.ReadonlyObject({
		owner: EthereumAddress,
		spender: EthereumAddress,
		value: BigintDecimal,
		nonce: t.Number,
		deadline: t.Number,
	}),
})
