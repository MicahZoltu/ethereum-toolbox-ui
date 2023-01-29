import { JSX } from 'preact/jsx-runtime'
import { useComputed, useSignal, useSignalEffect } from '@preact/signals'
import { Shadow } from '../library/Shadow.js'

export interface AutosizingInputModel extends Pick<JSX.HTMLAttributes<HTMLSpanElement>, 'className' | 'style'>, Pick<JSX.HTMLAttributes<HTMLInputElement>, 'type' | 'pattern' | 'placeholder' | 'required' | 'value' | 'onInput' | 'onChange' | 'autocomplete'> {
	readonly value: JSX.SignalLike<string>
	readonly dataList?: string[]
}
export function AutosizingInput(model: AutosizingInputModel) {
	const value = useSignal('')
	const spaceFiller = useComputed(() => model.type === 'password' ? ''.padEnd(value.value.length, '●') : value.value)
	const onInput = (event: JSX.TargetedEvent<HTMLInputElement, Event>) => {
		value.value = event.currentTarget.value
		// https://github.com/preactjs/preact/pull/3867
		model.onInput && (model as { onInput: (event: JSX.TargetedEvent<HTMLInputElement, Event>) => void }).onInput(event)
	}
	useSignalEffect(function() { value.value = model.value.value })

	return <Shadow>
		<link rel='stylesheet' href='css/autosizing-input.css'/>
		<span className={model.className} style={model.style} data-value={model.placeholder}>
			<label data-value={spaceFiller}>
				<input type={model.type} pattern={model.pattern} required={model.required} placeholder={model.placeholder} value={model.value} autocomplete={model.autocomplete} list='datalist' onChange={model.onChange} onInput={onInput} size={1}/>
				<datalist id='datalist'>
					{ (model.dataList || []).map(x => <option value={x}/>) }
				</datalist>
			</label>
		</span>
	</Shadow>
}
