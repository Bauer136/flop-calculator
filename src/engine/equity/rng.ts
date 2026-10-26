/** Seeded PRNG: xoshiro128** seeded through splitmix32. Deterministic for a given seed. */
export interface Rng {
  /** Uniform uint32. */
  nextU32(): number
  /** Uniform float in [0, 1). */
  float(): number
  /** Uniform integer in [0, n). */
  int(n: number): number
}

export function createRng(seed: number): Rng {
  let x = seed >>> 0
  const splitmix = () => {
    x = (x + 0x9e3779b9) >>> 0
    let z = x
    z = Math.imul(z ^ (z >>> 16), 0x85ebca6b) >>> 0
    z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35) >>> 0
    return (z ^ (z >>> 16)) >>> 0
  }
  let s0 = splitmix()
  let s1 = splitmix()
  let s2 = splitmix()
  let s3 = splitmix()
  if ((s0 | s1 | s2 | s3) === 0) s0 = 1

  const nextU32 = (): number => {
    const result = Math.imul(rotl(Math.imul(s1, 5), 7), 9) >>> 0
    const t = s1 << 9
    s2 ^= s0
    s3 ^= s1
    s1 ^= s2
    s0 ^= s3
    s2 ^= t
    s3 = rotl(s3, 11)
    return result
  }
  return {
    nextU32,
    float: () => nextU32() / 4294967296,
    int: (n) => Math.floor((nextU32() / 4294967296) * n),
  }
}

function rotl(v: number, k: number): number {
  return (v << k) | (v >>> (32 - k))
}
