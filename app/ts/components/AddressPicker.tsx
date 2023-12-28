import { ReadonlySignal, Signal } from "@preact/signals"
import { addressBigintToHex } from "@zoltu/ethereum-transactions/converters.js"
import { JSX } from "preact/jsx-runtime"
import { OptionalSignal } from "../library/preact-utilities.js"
import { AutosizingInput } from "./AutosizingInput.js"

const sanitizationRegexp = /[^a-fA-F0-9]/g
const isAddressRegexp = /^0x[a-fA-F0-9]{40}$/

export interface AddressPickerModel {
	readonly address: OptionalSignal<bigint>
	readonly extraOptions?: readonly (bigint | ReadonlySignal<bigint>)[] | ReadonlySignal<readonly (bigint | ReadonlySignal<bigint>)[]>
	readonly required?: boolean | JSX.SignalLike<boolean>
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
	const extraOptions = ((model.extraOptions instanceof Signal ? model.extraOptions.value : model.extraOptions) || []).map(x => x instanceof Signal ? x.value : x)
	// run through `Set` to make unique
	const datalist = [...new Set([
		...extraOptions
	])].sort((a,b) => Number(a-b)).map(addressBigintToHex)
	return <AutosizingInput required={model.required} value={model.address} sanitize={sanitize} tryParse={tryParse} serialize={serialize} dataList={datalist} placeholder={datalist[0] || '0x0000000000000000000000000000000000000000'}/>
}
