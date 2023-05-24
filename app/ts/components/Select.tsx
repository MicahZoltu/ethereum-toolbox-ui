import { ReadonlySignal, Signal, useSignal } from '@preact/signals'
import { JSX } from 'preact/jsx-runtime'
import { isArray } from '../library/typescript.js'

export interface SelectModel<T extends string> {
	readonly options: ReadonlySignal<T[]> | T[]
	readonly selected: Signal<T>
	readonly onChange?: (newValue: T, oldValue: T) => void
}

export function Select<T extends string>(model: SelectModel<T>) {
	const previouslySelected = useSignal(model.selected.value)
	function onInput(event: JSX.TargetedEvent<HTMLSelectElement, Event>) {
		const options = isArray(model.options) ? model.options : model.options.value
		const value = event.currentTarget.value
		if (!options.includes(value as T)) return
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
			(isArray(model.options) ? model.options : model.options.value).map(x => <option key={x} value={x}>{x}</option>)
		}
	</select>
}
