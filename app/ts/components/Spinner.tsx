import { Shadow } from "./Shadow.js";

export interface SpinnerModel {
	size?: string
}
export function Spinner(model: SpinnerModel) {
	return <Shadow>
		<link rel='stylesheet' href='css/spinner.css'/>
		<svg style={{ height: model.size || '1em' }} class='spinner' viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="45"/></svg>
	</Shadow>
}
