import { JSX } from 'preact/jsx-runtime'
import { Signal, useComputed, useSignal } from '@preact/signals'
import { Shadow } from './Shadow.js'
import { Input, ParsedInputModel, UnparsedInputModel } from './Input.js'

export interface BaseAutosizingInputModel extends Pick<JSX.HTMLAttributes<HTMLSpanElement>, 'class' | 'style'>, Pick<UnparsedInputModel, 'key' | 'type' | 'pattern' | 'placeholder' | 'required' | 'onChange' | 'autocomplete'> {
	readonly dataList?: string[]
	readonly rawValue?: Signal<string>
}
export interface UnparsedAutosizingInputModel extends BaseAutosizingInputModel, Pick<UnparsedInputModel, 'value' | 'sanitize' | 'tryParse' | 'serialize'> {}
export interface ParsedAutosizingInputModel<T> extends BaseAutosizingInputModel, Pick<ParsedInputModel<T>, 'value' | 'sanitize' | 'tryParse' | 'serialize'> {}

export function AutosizingInput<T>(model: UnparsedAutosizingInputModel | ParsedAutosizingInputModel<T>) {
	// TODO: figure out why this signal is getting reset to default value when the Shadow component is rerendered
	const internalValue = model.rawValue || useSignal(model.serialize ? model.serialize(model.value.deepPeek()) : model.value.peek())
	const spaceFiller = useComputed(() => model.type === 'password' ? ''.padEnd(internalValue.value.length, '●') : internalValue.value)
	const inputModel = {
		rawValue: internalValue,
		type: model.type,
		pattern: model.pattern,
		required: model.required,
		placeholder: model.placeholder,
		autocomplete: model.autocomplete,
		onChange: model.onChange,
		list: 'datalist',
		size: 1,
		...model.serialize ? {
			value: model.value,
			sanitize: model.sanitize,
			tryParse: model.tryParse,
			serialize: model.serialize,
		} : {
			value: model.value,
			sanitize: model.sanitize,
		}
	} satisfies UnparsedInputModel | ParsedInputModel<T>
	return <Shadow>
		<link rel='stylesheet' href='css/autosizing-input.css'/>
		<span class={model.class} style={model.style} data-value={model.placeholder}>
			<label data-value={spaceFiller}>
				<Input {...inputModel}/>
				<datalist id='datalist'>
					{ (model.dataList || []).map(x => <option value={x}/>) }
				</datalist>
			</label>
		</span>
	</Shadow>
}
