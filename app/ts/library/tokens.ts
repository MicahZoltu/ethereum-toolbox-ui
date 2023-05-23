import { ObjectTupleToValueTuple, ObjectUnionToKeyedObjectUnion, UnionToIntersection } from "./typescript.js"

export const ETH_ADDRESS: unique symbol = Symbol()
export const assetsArray = [
	{ symbol: 'ETH', address: ETH_ADDRESS, decimals: 18n },
	{ symbol: 'WETH', address: 0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2n, decimals: 18n },
	// { symbol: 'RAI', address: 0x03ab458634910AaD20eF5f1C8ee96F1D6ac54919n, decimals: 18n }, // needs multi-hop swaps before it can be used
	{ symbol: 'USDC', address: 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48n, decimals: 6n },
] as const
export const tokensArray = assetsArray.filter((x): x is typeof assetsArray[number] & { address: bigint } => x.symbol !== 'ETH')

function assignAndReturn<T extends {}, K extends keyof T>(accumulator: T, item: T[K], key: K) {
	if (key in accumulator) throw new Error(`Duplicate symbol found.`)
	accumulator[key] = item
	return accumulator
}
export const tokensBySymbol = assetsArray.reduce((accumulator, item) => assignAndReturn(accumulator, item, item.symbol), {} as UnionToIntersection<ObjectUnionToKeyedObjectUnion<typeof assetsArray[number], 'symbol'>>)
export const tokenSymbols = assetsArray.map(x => x.symbol) as unknown as ObjectTupleToValueTuple<typeof assetsArray, 'symbol'>
export const tokenAddresses = assetsArray.map(x => x.address) as unknown as ObjectTupleToValueTuple<typeof assetsArray, 'address'>

export type TOKENS = keyof typeof tokensBySymbol
