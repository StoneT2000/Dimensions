export type DeepPartial<T> = T extends object ? { [K in keyof T]?: DeepPartial<T[K]> } : T;

type D1 = {
  me: string,
  me2: number,
  d3: DeepPartial<D3>
}
type D3 = {
  self: number,
  cas: string
}

let a: DeepPartial<D1> = {
  d3: {
    cas: 's'
  }
}