import { JSX } from 'preact/jsx-runtime'
import { AutosizingInput, ParsedAutosizingInputModel, UnparsedAutosizingInputModel } from './AutosizingInput.js'
import { Input, ParsedInputModel, UnparsedInputModel } from './Input.js'
import { OptionalSignal } from '../library/preact-utilities.js'

const sanitizationRegexp = /[^\d]/g
const regexp = /^\d*$/

export interface IntegerInput {
	readonly value: OptionalSignal<bigint>
	readonly autoSize?: boolean
	readonly className?: string | JSX.SignalLike<string | undefined>
	readonly style?: string | JSX.CSSProperties | JSX.SignalLike<string | JSX.CSSProperties>
	readonly type?: string | JSX.SignalLike<string>
	readonly placeholder?: string | JSX.SignalLike<string>
	readonly required?: boolean | JSX.SignalLike<boolean>
	readonly dataList?: string[]
	readonly onChange?: () => void
}
export function IntegerInput(model: IntegerInput) {
	const properties = {
		value: model.value,
		pattern: regexp.source,
		sanitize: (input: string) => input.replaceAll(sanitizationRegexp, ''),
		tryParse: (input: string) => input === '' ? { ok: true, value: undefined } : regexp.test(input) ? { ok: true, value: BigInt(input) } : { ok: false } as const,
		serialize: (input: bigint | undefined) => input === undefined ? '' : input.toString(10),
		onChange: model.onChange,
		...model.className ? {className: model.className} : {},
		...model.style ? {style: model.style} : {},
		...model.type ? {type: model.type} : {},
		...model.placeholder ? {placeholder: model.placeholder} : {},
		...model.required ? {required: model.required} : {},
		...model.dataList ? {dataList: model.dataList} : {},
	} satisfies (UnparsedInputModel & UnparsedAutosizingInputModel) | (ParsedAutosizingInputModel<bigint> & ParsedInputModel<bigint>)
	return model.autoSize ? <AutosizingInput {...properties}  /> : <Input {...properties}/>
}
