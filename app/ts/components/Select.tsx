import { Signal, useSignal } from '@preact/signals'
import { JSX } from 'preact/jsx-runtime'

export interface SelectModel<T extends string> {
	readonly options: readonly T[]
	readonly selected: Signal<T>
	readonly onChange?: (newValue: T, oldValue: T) => void
}

export function Select<T extends string>(model: SelectModel<T>) {
	const previouslySelected = useSignal(model.selected.value)
	function onInput(event: JSX.TargetedEvent<HTMLSelectElement, Event>) {
		const value = event.currentTarget.value
		if (!model.options.includes(value as T)) return
		model.selected.value = value as T
	}
	function onChange() {
		const oldValue = previouslySelected.peek()
		const newValue = model.selected.peek()
		previouslySelected.value = newValue
		model.onChange && model.onChange(newValue, oldValue)

	}
	return <select value={model.selected} onInput={onInput} onChange={onChange}>
		{
			model.options.map(x => <option key={x} value={x}>{x}</option>)
		}
	</select>
}
