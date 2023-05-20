import { Signal, useComputed } from '@preact/signals'
import { TOKENS, tokensByName } from '../library/tokens.js'
import { FixedPointInput } from './FixedPointInput.js'
import { TokenSelector } from './TokenSelector.js'
import { useOptionalSignal } from '../library/preact-utilities.js'

export interface TokenAndAmountModel {
	readonly token: Signal<TOKENS>
	readonly amount: Signal<bigint>
	readonly onAmountChange?: () => void
	readonly onTokenChange?: (newValue: TOKENS, oldValue: TOKENS) => void
}
export function TokenAndAmount(model: TokenAndAmountModel) {
	const decimals = useComputed(() => tokensByName[model.token.value].decimals)
	const amount = useOptionalSignal(model.amount, model.amount.value === 0n)

	// token changed
	function onTokenChange(newValue: TOKENS, oldValue: TOKENS) {
		const oldDecimals = tokensByName[oldValue].decimals
		const newDecimals = tokensByName[newValue].decimals
		if (oldDecimals > newDecimals) {
			model.amount.value = model.amount.peek() / 10n**(oldDecimals - newDecimals)
		} else if (oldDecimals < newDecimals) {
			model.amount.value = model.amount.peek() * 10n**(newDecimals - oldDecimals)
		}
		model.onTokenChange && model.onTokenChange(newValue, oldValue)
	}

	function onAmountChanged() {
		model.onAmountChange && model.onAmountChange()
	}

	return <span>
		<FixedPointInput autoSize required placeholder='1.23' value={amount} decimals={decimals} onChange={onAmountChanged}/>
		&nbsp;
		<TokenSelector selectedToken={model.token} onChange={onTokenChange}/>
	</span>
}
