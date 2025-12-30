import { ReadonlySignal, useSignalEffect } from "@preact/signals"
import { addressBigintToHex, bytesToBigint, hexToBytes } from "../library/converters.js"
import { ERC20, createContract } from 'micro-eth-signer/advanced/abi.js'
import { useState } from "preact/hooks"
import { JSX } from "preact/jsx-runtime"
import { Wallet, toMicroEthSigner } from "../library/ethereum.js"
import { useAsyncState, useOptionalSignal } from "../library/preact-utilities.js"
import { ETH_ADDRESS, TokenDetails, addToken, assetsArray, removeToken } from "../library/tokens.js"
import { bigintToDecimalString } from "../library/utilities.js"
import { AddressPicker } from "./AddressPicker.js"
import { Refresh } from "./Refresh.js"
import { Spinner } from "./Spinner.js"

export type BalancesModel = {
	readonly wallet: ReadonlySignal<Wallet>
	readonly noticeError: (error: unknown) => void
	readonly style?: JSX.CSSProperties
	readonly class?: JSX.HTMLAttributes['class']
}
export function Balances(model: BalancesModel) {
	const [TokenBalances_] = useState(() => () => <>{assetsArray.value.map(token => <TokenBalance_ {...token}/>)}</>)
	const [TokenBalance_] = useState(() => ({ symbol, address, decimals }: typeof assetsArray.value[number]) => {
		const { value, waitFor } = useAsyncState<bigint>()
		const refresh = () => waitFor(async () => {
			if (address === ETH_ADDRESS) {
				return model.wallet.value.ethereumClient.getBalance(model.wallet.value.address, 'latest')
			} else {
				return createContract(ERC20, toMicroEthSigner(model.wallet.value.ethereumClient), addressBigintToHex(address)).balanceOf.call(addressBigintToHex(model.wallet.value.address))
			}
		})
		useSignalEffect(refresh)
		useSignalEffect(() => { value.value.state === 'rejected' && model.noticeError(value.value.error) })
		const [Refresh_] = useState(() => () => <Refresh onClick={refresh}/>)
		const [RemoveTokenButton_] = useState(() => () => (typeof address === 'bigint' && symbol !== 'WETH') ? <button onClick={() => removeToken({symbol, address, decimals})} style={{ padding: '0px', border: '0px', background: 'none', alignSelf: 'flex-start', fontSize: 'x-small' }}>x</button> : <></>)
		switch (value.value.state) {
			case 'inactive': return <div>{symbol}: <Refresh_/></div>
			case 'pending': return <div>{symbol}: <Spinner/></div>
			case 'rejected': return <div>{symbol}: Erorr fetching balance: <span class='error-text'>{value.value.error.message}</span><Refresh_/></div>
			case 'resolved': return <div>{symbol}<RemoveTokenButton_/>: {bigintToDecimalString(value.value.value, decimals)}<Refresh_/></div>
		}
	})
	const [AddTokenButton_] = useState(() => () => {
		const maybeAddress = useOptionalSignal<bigint>(undefined)
		const { value, waitFor, reset } = useAsyncState<TokenDetails>()
		useSignalEffect(() => {
			const address = maybeAddress.deepValue
			if (address === undefined) return
			maybeAddress.clear()
			waitFor(async () => {
				const abiEncodedSymbol = await model.wallet.value.ethereumClient.call({ to: address, data: hexToBytes('0x95d89b41') }, 'latest')
				const length = bytesToBigint(abiEncodedSymbol.slice(32, 64))
				const symbol = new TextDecoder().decode(abiEncodedSymbol.slice(64, 64 + Number(length)))
				const decimals = bytesToBigint(await model.wallet.value.ethereumClient.call({ to: address, data: hexToBytes('0x313ce567') }, 'latest'))
				const details = { symbol, decimals, address }
				addToken(details)
				return details
			})
		})
		useSignalEffect(() => { value.value.state === 'rejected' && model.noticeError(value.value.error) })
		const [AddAnotherButton_] = useState(() => () => <button onClick={reset}>Add Another</button>)
		switch (value.value.state) {
			case 'inactive': return <span>Add Token: <AddressPicker address={maybeAddress}/></span>
			case 'pending': return <Spinner/>
			case 'rejected': return <span>Error: <span class='error-text'>{value.value.error.message}</span><AddAnotherButton_/></span>
			case 'resolved': return <span style={{ color: 'darkgreen'}}>Added {value.value.value.symbol} with address {addressBigintToHex(value.value.value.address)} and {value.value.value.decimals} decimals.<AddAnotherButton_/></span>
		}
	})

	return <div class={model.class} style={model.style}>
		<div><b><u>Balances</u></b></div>
		<TokenBalances_/>
		<AddTokenButton_/>
	</div>
}
