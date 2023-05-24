import { Signal, useSignal, useSignalEffect } from '@preact/signals'
import { AssetDetails, assetSymbols, assetsBySymbol } from '../library/tokens.js'
import { Select } from './Select.js'

export type TokenSelectorModel = {
	readonly selectedToken: Signal<AssetDetails>
	readonly onChange?: (newValue: AssetDetails, oldValue?: AssetDetails) => void
}

export function TokenSelector(model: TokenSelectorModel) {
	const selectedSymbol = useSignal(model.selectedToken.value.symbol)
	useSignalEffect(() => {
		const newDetails = assetsBySymbol.value[selectedSymbol.value]
		if (newDetails === undefined) return
		model.selectedToken.value = newDetails
	})
	useSignalEffect(() => { selectedSymbol.value = model.selectedToken.value.symbol })
	const onChange = (newValue: string, oldValue: string) => {
		const newDetails = assetsBySymbol.value[newValue]
		const oldDetails = assetsBySymbol.value[oldValue]
		if (newDetails === undefined) {
			selectedSymbol.value = model.selectedToken.value.symbol
			return
		}
		model.onChange && model.onChange(newDetails, oldDetails)
	}
	return <Select options={assetSymbols} selected={selectedSymbol} onChange={onChange}/>
}
