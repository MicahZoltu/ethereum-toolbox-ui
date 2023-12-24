import { JSX } from "preact/jsx-runtime";
import { Shadow } from "./Shadow.js";

export interface SpinnerModel {
	readonly size?: string
	readonly style?: JSX.CSSProperties
}
export function Spinner(model: SpinnerModel) {
	return <Shadow class='spinner' style={model.style}>
		<link rel='stylesheet' href='css/spinner.css'/>
		<svg {...model.size === undefined ? {} : {style: {height:model.size}}} class='spinner' viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="45"/></svg>
	</Shadow>
}
