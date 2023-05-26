import { Signal } from "@preact/signals"
import { isArray } from "./typescript.js"
import { jsonParse, jsonStringify } from "./utilities.js"

const storageKey = 'tokens'

export type TokenDetails = { symbol: string, address: bigint, decimals: bigint }
export type AssetDetails = typeof ETH_DETAILS | TokenDetails

export const ETH_ADDRESS: unique symbol = Symbol()
export const ETH_DETAILS = { symbol: 'ETH', address: ETH_ADDRESS, decimals: 18n } as const
export const WETH_DETAILS = { symbol: 'WETH', address: 0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2n, decimals: 18n } as const

// be careful messing with the types of these as we are doing some typecasting in `regenerate` below
export const tokensArray = new Signal<readonly [typeof WETH_DETAILS, ...TokenDetails[]]>()
export const assetsArray = new Signal<readonly [typeof ETH_DETAILS, ...typeof tokensArray.value]>()
export const tokenSymbols = new Signal<['WETH', ...string[]]>()
export const assetSymbols = new Signal<['ETH', ...typeof tokenSymbols.value]>()
export const tokensBySymbol = new Signal<{ 'WETH': typeof WETH_DETAILS, [x: string]: TokenDetails }>()
export const assetsBySymbol = new Signal<{ 'ETH': typeof ETH_DETAILS, 'WETH': typeof WETH_DETAILS, [x: string]: AssetDetails }>()

function regenerate() {
	// if you change the order of the entries in tokensArray or assetsArray make sure to update typecast on assetSymbols and tokenSymbols!
	tokensArray.value = [ WETH_DETAILS, ...getTokensFromLocalStorage() ] as const
	assetsArray.value = [ ETH_DETAILS, ...tokensArray.peek() ] as const
	// note the typecasting, take extra care when touching any of these
	tokenSymbols.value = tokensArray.peek().map(x => x.symbol) as typeof tokenSymbols.value
	assetSymbols.value = assetsArray.peek().map(x => x.symbol) as typeof assetSymbols.value
	tokensBySymbol.value = tokensArray.peek().reduce((accumulator, item) => { accumulator[item.symbol] = item; return accumulator }, {} as typeof tokensBySymbol.value)
	assetsBySymbol.value = assetsArray.peek().reduce((accumulator, item) => { accumulator[item.symbol] = item; return accumulator }, {} as typeof assetsBySymbol.value)
}
// must call regenerate here or else signals defined above have incorrect type (they can be undefined until we call regenerate)
regenerate()

function getTokensFromLocalStorage() {
	const defaultTokenList = [
		// { symbol: 'RAI', address: 0x03ab458634910AaD20eF5f1C8ee96F1D6ac54919n, decimals: 18n }, // needs multi-hop swaps before it can be used
		{ symbol: 'USDC', address: 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48n, decimals: 6n },
	] satisfies TokenDetails[]
	const savedTokenListEncoded = window.localStorage.getItem(storageKey)
	if (savedTokenListEncoded === null) return defaultTokenList
	const savedTokenList = jsonParse(savedTokenListEncoded)
	if (
		isArray(savedTokenList)
		&& savedTokenList.every((item): item is TokenDetails => {
			if (typeof item !== 'object') return false
			if (item === null) return false
			if (!('symbol' in item)) return false
			if (!('address' in item)) return false
			if (!('decimals' in item)) return false
			if (typeof item.symbol !== 'string') return false
			if (typeof item.address !== 'bigint') return false
			if (typeof item.decimals !== 'bigint') return false
			return true
		})
	) {
		return savedTokenList
	} else {
		window.localStorage.removeItem(storageKey)
		return defaultTokenList
	}
}

export function addToken(tokenDetails: TokenDetails) {
	const storedToken = tokensBySymbol.value[tokenDetails.symbol]
	if (storedToken !== undefined) {
		if (tokenDetails.address === storedToken.address && tokenDetails.decimals === storedToken.decimals) return
		else throw new Error(`Token with symbol ${tokenDetails.symbol} already exists.`)
	}
	const savedTokens = getTokensFromLocalStorage()
	savedTokens.push(tokenDetails)
	window.localStorage.setItem(storageKey, jsonStringify(savedTokens))
	// note: this will trigger Signal subscriptions, so we do it as a tail call
	regenerate()
}

export function removeToken(tokenDetails: TokenDetails) {
	const savedTokens = getTokensFromLocalStorage()
	const updatedTokens = savedTokens.filter(token => {
		if (token.address !== tokenDetails.address) return true
		if (token.decimals !== tokenDetails.decimals) return true
		if (token.symbol !== tokenDetails.symbol) return true
		return false
	})
	window.localStorage.setItem(storageKey, jsonStringify(updatedTokens))
	// note: this will trigger Signal subscriptions, so we do it as a tail call
	regenerate()
}