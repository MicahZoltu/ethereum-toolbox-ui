import { ReadonlySignal, useSignalEffect } from "@preact/signals"
import { addressBigintToHex } from "@zoltu/ethereum-transactions/converters.js"
import { contract } from "micro-web3"
import { ERC20 } from "micro-web3/contracts/index.js"
import { useState } from "preact/hooks"
import { JSX } from "preact/jsx-runtime"
import { Wallet, toMicroWeb3 } from "../library/ethereum.js"
import { useAsyncState } from "../library/preact-utilities.js"
import { ETH_ADDRESS, assetsArray } from "../library/tokens.js"
import { bigintToDecimalString } from "../library/utilities.js"
import { Refresh } from "./Refresh.js"
import { Spinner } from "./Spinner.js"

export type BalancesModel = {
	readonly wallet: ReadonlySignal<Wallet>
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
				return contract(ERC20, toMicroWeb3(model.wallet.value.ethereumClient), addressBigintToHex(address)).balanceOf.call(addressBigintToHex(model.wallet.value.address))
			}
		})
		useSignalEffect(refresh)
		const [Refresh_] = useState(() => () => <Refresh onClick={refresh}/>)
		switch (value.value.state) {
			case 'inactive': return <div>{symbol}: <Refresh_/></div>
			case 'pending': return <div>{symbol}: <Spinner/></div>
			case 'rejected': return <div>{symbol}: Erorr fetching balance: {value.value.error.message}<Refresh_/></div>
			case 'resolved': return <div>{symbol}: {bigintToDecimalString(value.value.value, decimals)}<Refresh_/></div>
		}
	})

	return <div class={model.class} style={model.style}>
		<div><b><u>Balances</u></b></div>
		<TokenBalances_/>
	</div>
}
