import { ReadonlySignal } from "@preact/signals"
import { addressBigintToHex } from "../library/converters.js"
import { SignalLike } from "preact"
import { OptionalSignal } from "../library/preact-utilities.js"
import { isReadonlyArray } from "../library/typescript.js"
import { AutosizingInput } from "./AutosizingInput.js"

const sanitizationRegexp = /[^a-fA-F0-9]/g
const isAddressRegexp = /^0x[a-fA-F0-9]{40}$/

export interface AddressPickerModel {
	readonly address: OptionalSignal<bigint>
	readonly extraOptions?: readonly (bigint | ReadonlySignal<bigint>)[] | ReadonlySignal<readonly (bigint | ReadonlySignal<bigint>)[]>
	readonly required?: boolean | SignalLike<boolean>
}
export function AddressPicker(model: AddressPickerModel) {
	const sanitize = (maybeAddress: string) => {
		if (maybeAddress === '') return ''
		if (maybeAddress.startsWith('eth:0x')) maybeAddress = maybeAddress.slice(6)
		if (maybeAddress.startsWith('0x')) maybeAddress = maybeAddress.slice(2)
		return `0x${maybeAddress.replaceAll(sanitizationRegexp, '')}`
	}
	const tryParse = (input: string) => ({ ok: true, value: isAddressRegexp.test(input) ? BigInt(input) : undefined } as const)
	const serialize = (input: bigint | undefined) => input === undefined ? '' : addressBigintToHex(input)
	const extraOptions = (isReadonlyArray(model.extraOptions) || model.extraOptions === undefined ? model.extraOptions || [] : model.extraOptions.value).map(x => typeof x === 'bigint' ? x : x.value)
	// use Set to remove duplicate entries while retaining order
	const datalist = [...new Set([...extraOptions])].map(addressBigintToHex)
	return <AutosizingInput required={model.required} value={model.address} sanitize={sanitize} tryParse={tryParse} serialize={serialize} dataList={datalist} placeholder={datalist[0] || '0x0000000000000000000000000000000000000000'}/>
}
