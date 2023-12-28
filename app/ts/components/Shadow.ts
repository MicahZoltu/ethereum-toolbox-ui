import { ComponentChildren, Fragment, JSX, createElement, render } from 'preact'
import { useEffect } from 'preact/hooks'

export function Shadow(model: {
	readonly children: ComponentChildren
	readonly style?: JSX.CSSProperties
	readonly class?: JSX.HTMLAttributes['class']
}) {
	let shadowRoot: ShadowRoot | undefined = undefined
	useEffect(() => () => shadowRoot && render(null, shadowRoot), [])
	return createElement('span', {
		ref: host => {
			if (host == null) return
			shadowRoot = host.shadowRoot || host.attachShadow({mode: 'open'})
			const vnode = Array.isArray(model.children) ? Fragment({ children: model.children }) : model.children
			render(vnode, shadowRoot)
		},
		style: model.style,
		class: model.class,
	})
}
