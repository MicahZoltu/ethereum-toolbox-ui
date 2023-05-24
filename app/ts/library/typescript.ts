export type HexAddress = `0x${string}`
export type HexData = `0x${string}`

export type ObjectTupleToValueTuple<T extends readonly [...readonly {}[]], K extends keyof T[number]> = { readonly [Key in keyof T]: T[Key][K] } & { length: T['length'] }
export type ObjectUnionToKeyedObjectUnion<T extends {}, K extends keyof T> = T extends {} ? T[K] extends PropertyKey ? { [_ in T[K]]: T } : never : never
export type UnionToIntersection<T> = (T extends unknown ? (k: T) => void : never) extends (k: infer I) => void ? I : never

export type ResolvePromise<T> = T extends PromiseLike<infer R> ? R : never

export type ReadWrite<T> = { -readonly [P in keyof T]: T[P] }

export function assertNever(value: never): never { throw new Error(`Unhandled discriminated union member: ${JSON.stringify(value)}`) }

// See: https://github.com/microsoft/TypeScript/issues/17002
export function isArray(value: unknown): value is unknown[] {
	return Array.isArray(value)
}
export function isReadonlyArray(value: unknown): value is readonly unknown[] {
	return Array.isArray(value)
}