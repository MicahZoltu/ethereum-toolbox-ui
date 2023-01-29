import { Signal, useSignal } from "@preact/signals";
import { JSX } from "preact/jsx-runtime";
import { Wallet } from "../library/ethereum.js";
import { AutosizingInput } from "./AutosizingInput.js";

export interface WalletChooserModel {
	readonly wallet: Signal<Wallet | undefined>
	readonly style?: JSX.CSSProperties
}
export function WalletChooser(model: WalletChooserModel) {
	const mnemonic = useSignal('')
	const derivationPath = useSignal('')
	return <div style={model.style}>
		<label>Mnemonic&thinsp;
			<AutosizingInput type='password' autocomplete='off' placeholder='zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo wrong' value={mnemonic} style={{ maxWidth: '100%', paddingInline: '5px' }}/>
		</label>
		<br/>
		<label>
			Derivation Path&thinsp;
			<AutosizingInput type='text' pattern="^m(?:\/\d+'?)+$" placeholder="m/44'/60'/0'/0/0" value={derivationPath} style={{ paddingInline: '5px' }} dataList={[`m/44'/60'/0'/0/0`]}/>
		</label>
	</div>
}
