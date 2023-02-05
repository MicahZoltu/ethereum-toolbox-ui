import { render, createElement, ComponentChildren, Fragment } from 'preact'
import { useEffect } from 'preact/hooks'

export function Shadow({ children }: { children: ComponentChildren }) {
	let shadowRoot: ShadowRoot | undefined = undefined
	useEffect(() => () => shadowRoot && render(null, shadowRoot), [])
	return createElement('span', {
		ref: host => {
			if (host == null) return
			shadowRoot = host.shadowRoot || host.attachShadow({mode: 'open'})
			const vnode = Array.isArray(children) ? Fragment({ children }) : children
			render(vnode, shadowRoot)
		}
	})
}
