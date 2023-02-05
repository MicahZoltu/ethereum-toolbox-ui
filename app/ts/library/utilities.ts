export async function sleep(milliseconds: number) {
	await new Promise(resolve => setTimeout(resolve, milliseconds))
}

export function isJSON(text: string){
	if (typeof text !== 'string') return false
	try {
		JSON.parse(text)
		return true
	}
	catch (error) {
		return false
	}
}

export function bigintToDecimalString(value: bigint, power: bigint): string {
	const integerPart = value / 10n**power
	const fractionalPart = value % 10n**power
	if (fractionalPart === 0n) {
		return integerPart.toString(10)
	} else {
		return `${integerPart.toString(10)}.${fractionalPart.toString(10).padStart(Number(power), '0').replace(/0+$/, '')}`
	}
}

export function decimalStringToBigint(value: string, power: bigint): bigint {
	if (!/^\d*\.?\d*$/.test(value)) throw new Error(`Value is not a decimal sring.`)
	let [integerPart, fractionalPart] = value.split('.')
	// null assertion is safe because the first element of a string.split will always be present when you split by anything other than empty string
	integerPart = integerPart!.padStart(1, '0')
	fractionalPart = (fractionalPart || '').slice(0, Number(power)).padEnd(Number(power), '0')
	return BigInt(`${integerPart}${fractionalPart}`)
}
