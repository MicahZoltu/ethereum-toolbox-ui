import { Signal, useComputed } from '@preact/signals'
import { TOKENS, tokensBySymbol } from '../library/tokens.js'
import { FixedPointInput } from './FixedPointInput.js'
import { TokenSelector } from './TokenSelector.js'
import { OptionalSignal } from '../library/preact-utilities.js'

export interface TokenAndAmountModel {
	readonly token: Signal<TOKENS>
	readonly amount: OptionalSignal<bigint>
	readonly onAmountChange?: () => void
	readonly onTokenChange?: (newValue: TOKENS, oldValue: TOKENS) => void
}
export function TokenAndAmount(model: TokenAndAmountModel) {
	const decimals = useComputed(() => tokensBySymbol[model.token.value].decimals)

	// token changed
	function onTokenChange(newValue: TOKENS, oldValue: TOKENS) {
		const amount = model.amount.deepPeek()
		if (amount === undefined) return
		model.onTokenChange && model.onTokenChange(newValue, oldValue)
	}

	function onAmountChanged() {
		model.onAmountChange && model.onAmountChange()
	}

	return <span>
		<FixedPointInput autoSize required placeholder='1.23' value={model.amount} decimals={decimals} onChange={onAmountChanged}/>
		&nbsp;
		<TokenSelector selectedToken={model.token} onChange={onTokenChange}/>
	</span>
}
