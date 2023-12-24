import { Signal, useComputed } from '@preact/signals'
import { AssetDetails } from '../library/tokens.js'
import { FixedPointInput } from './FixedPointInput.js'
import { TokenSelector } from './TokenSelector.js'
import { OptionalSignal } from '../library/preact-utilities.js'

export interface TokenAndAmountModel {
	readonly assetDetails: Signal<AssetDetails>
	readonly amount: OptionalSignal<bigint>
	readonly onAmountChange?: () => void
	readonly onTokenChange?: (newValue: AssetDetails, oldValue?: AssetDetails) => void
}
export function TokenAndAmount(model: TokenAndAmountModel) {
	const decimals = useComputed(() => model.assetDetails.value.decimals)

	// token changed
	function onTokenChange(newValue: AssetDetails, oldValue?: AssetDetails) {
		model.onTokenChange && model.onTokenChange(newValue, oldValue)
	}

	function onAmountChanged() {
		model.onAmountChange && model.onAmountChange()
	}

	return <span>
		<FixedPointInput autoSize required placeholder='1.23' value={model.amount} decimals={decimals} onChange={onAmountChanged}/>
		<TokenSelector selectedToken={model.assetDetails} onChange={onTokenChange}/>
	</span>
}
