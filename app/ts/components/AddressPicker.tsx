import { AutosizingInput } from "./AutosizingInput.js"
import { addressBigintToHex } from "@zoltu/ethereum-transactions/converters.js"
import { OptionalSignal } from "../library/preact-utilities.js"
import { JSX } from "preact/jsx-runtime"

const sanitizationRegexp = /[^a-fA-F0-9]/g
const isAddressRegexp = /^0x[a-fA-F0-9]{40}$/

export interface AddressPickerModel {
	readonly address: OptionalSignal<bigint>
	readonly extraOptions?: bigint[]
	readonly required?: boolean | JSX.SignalLike<boolean>
}
export function AddressPicker(model: AddressPickerModel) {
	const sanitize = (maybeAddress: string) => maybeAddress === '' ? '' : `0x${maybeAddress.slice(2).replaceAll(sanitizationRegexp, '')}`
	const tryParse = (input: string) => ({ ok: true, value: isAddressRegexp.test(input) ? BigInt(input) : undefined } as const)
	const serialize = (input: bigint | undefined) => input === undefined ? '' : addressBigintToHex(input)
	const datalist = [
		'0x0000000000000000000000000000000000000000',
		'0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
		...(model.extraOptions || []).map(addressBigintToHex)
	]
	return <AutosizingInput required={model.required} value={model.address} sanitize={sanitize} tryParse={tryParse} serialize={serialize} dataList={datalist} placeholder={datalist[0]}/>
}
