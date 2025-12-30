import { ReadonlySignal } from '@preact/signals'
import { CSSProperties, HTMLInputTypeAttribute, SignalLike } from 'preact'
import { OptionalSignal } from '../library/preact-utilities.js'
import { bigintToDecimalString, decimalStringToBigint } from '../library/utilities.js'
import { AutosizingInput, ParsedAutosizingInputModel, UnparsedAutosizingInputModel } from './AutosizingInput.js'
import { Input, ParsedInputModel, UnparsedInputModel } from './Input.js'

const sanitizationRegexp = /[^\d\.]/g
const regexp = /^\d*\.?(?:\d+)?$/

export interface FixedPointInput {
	value: OptionalSignal<bigint>
	decimals: ReadonlySignal<bigint>
	autoSize?: boolean
	className?: string | SignalLike<string | undefined>
	style?: string | CSSProperties | SignalLike<string | CSSProperties>
	type?: HTMLInputTypeAttribute // preact doesn't support signals for input element type
	placeholder?: string | SignalLike<string>
	required?: boolean | SignalLike<boolean>
	onChange?: () => void
}
export function FixedPointInput(model: FixedPointInput) {
	const properties = {
		value: model.value,
		pattern: regexp.source,
		sanitize: (input: string) => input.replaceAll(sanitizationRegexp, ''),
		tryParse: (input: string) => input === '' ? { ok: true, value: undefined } : regexp.test(input) ? { ok: true, value: decimalStringToBigint(input, model.decimals.value) } : { ok: false } as const,
		serialize: (input: bigint | undefined) => input === undefined ? '' : bigintToDecimalString(input, model.decimals.value),
		onChange: model.onChange,
		...model.className ? {className: model.className} : {},
		...model.style ? {style: model.style} : {},
		...model.type ? {type: model.type} : {},
		...model.placeholder ? {placeholder: model.placeholder} : {},
		...model.required ? {required: model.required} : {},
	} satisfies (UnparsedInputModel & UnparsedAutosizingInputModel) | (ParsedAutosizingInputModel<bigint> & ParsedInputModel<bigint>)
	return model.autoSize ? <AutosizingInput {...properties}  /> : <Input {...properties}/>
}
