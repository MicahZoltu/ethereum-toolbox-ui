import { ReadonlySignal } from '@preact/signals'
import { JSX } from 'preact/jsx-runtime'
import { bigintToDecimalString, decimalStringToBigint } from '../library/utilities.js'
import { AutosizingInput, ParsedAutosizingInputModel, UnparsedAutosizingInputModel } from './AutosizingInput.js'
import { Input, ParsedInputModel, UnparsedInputModel } from './Input.js'
import { OptionalSignal } from '../library/preact-utilities.js'

const sanitizationRegexp = /[^\d\.]/g
const regexp = /^\d*\.?(?:\d+)?$/

export interface FixedPointInput {
	value: OptionalSignal<bigint>
	decimals: ReadonlySignal<bigint>
	autoSize?: boolean
	className?: string | JSX.SignalLike<string | undefined>
	style?: string | JSX.CSSProperties | JSX.SignalLike<string | JSX.CSSProperties>
	type?: string | JSX.SignalLike<string>
	placeholder?: string | JSX.SignalLike<string>
	required?: boolean | JSX.SignalLike<boolean>
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
