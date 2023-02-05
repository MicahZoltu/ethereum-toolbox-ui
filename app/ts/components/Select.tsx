import { Signal } from '@preact/signals'
import { JSX } from 'preact/jsx-runtime'

export interface SelectModel<T extends string> {
	readonly options: readonly T[]
	readonly selected: Signal<T>
}

export function Select<T extends string>(model: SelectModel<T>) {
	function onInput(event: JSX.TargetedEvent<HTMLSelectElement, Event>) {
		const value = event.currentTarget.value
		if (!model.options.includes(value as T)) return
		model.selected.value = value as T
	}
	return <select value={model.selected} onInput={onInput}>
		{
			model.options.map(x => <option key={x} value={x}>{x}</option>)
		}
	</select>
}
