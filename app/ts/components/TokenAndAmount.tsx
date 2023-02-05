import { batch, Signal, useComputed, useSignal, useSignalEffect } from '@preact/signals'
import { TOKENS, tokensByName } from '../library/tokens.js'
import { FixedPointInput } from './FixedPointInput.js'
import { TokenSelector } from './TokenSelector.js'

export interface TokenAndAmountModel {
	readonly token: Signal<TOKENS>
	readonly amount: Signal<bigint>
	readonly onAmountChange?: () => void
	readonly onTokenChange?: () => void
}
export function TokenAndAmount(model: TokenAndAmountModel) {
	const previousToken = useSignal(model.token.peek())
	const decimals = useComputed(() => tokensByName[model.token.value].decimals)

	// token changed
	useSignalEffect(() => {
		batch(() => {
			if (model.token.value === previousToken.peek()) return
			const oldTokenDecimals = tokensByName[previousToken.peek()].decimals
			const newTokenDecimals = tokensByName[model.token.value].decimals
			previousToken.value = model.token.value
			if (newTokenDecimals > oldTokenDecimals) model.amount.value = model.amount.peek() * 10n**(newTokenDecimals - oldTokenDecimals)
			if (newTokenDecimals < oldTokenDecimals) model.amount.value = model.amount.peek() / 10n**(oldTokenDecimals - newTokenDecimals)
		})
	})

	function onAmountChanged() {
		model.onAmountChange && model.onAmountChange()
	}

	return <span>
		<FixedPointInput autoSize required placeholder='1.23' value={model.amount} decimals={decimals} onChange={onAmountChanged}/>
		&nbsp;
		<TokenSelector selectedToken={model.token}/>
	</span>
}
