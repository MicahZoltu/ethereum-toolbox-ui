import { Signal } from "@preact/signals"
import { AutosizingInput } from "./AutosizingInput.js"
import { addressBigintToHex } from "@zoltu/ethereum-transactions/converters.js"

const sanitizationRegexp = /[^a-fA-F0-9]/g
const isAddressRegexp = /^0x[a-fA-F0-9]{40}$/

export interface AddressPickerModel {
	readonly address: Signal<bigint | undefined>
	readonly extraOptions?: bigint[]
}
export function AddressPicker(model: AddressPickerModel) {
	const sanitize = (maybeAddress: string) => maybeAddress === '' ? '' : `0x${maybeAddress.slice(2).replaceAll(sanitizationRegexp, '')}`
	const tryParse = (input: string) => isAddressRegexp.test(input) ? { ok: true, value: BigInt(input) } : { ok: false } as const
	const serialize = (input: bigint | undefined) => input === undefined ? '' : addressBigintToHex(input)
	const datalist = [
		'0x0000000000000000000000000000000000000000',
		'0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
		...(model.extraOptions || []).map(addressBigintToHex)
	]
	return <AutosizingInput value={model.address} sanitize={sanitize} tryParse={tryParse} serialize={serialize} dataList={datalist} placeholder={datalist[0]}/>
}
