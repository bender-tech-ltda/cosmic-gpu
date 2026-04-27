// Minimal ambient declaration for `hyperdht`. The package has no published
// types; we only consume the static `HyperDHT.keyPair(seed)` helper which
// derives an ed25519 `{ publicKey, secretKey }` pair from a 32-byte seed
// (libsodium `crypto_sign_seed_keypair`).

declare module 'hyperdht' {
  /** ed25519 keypair compatible with Noise / Hyperswarm. */
  export interface HyperDhtKeyPair {
    /** 32-byte ed25519 public key. */
    publicKey: Buffer;
    /** 64-byte libsodium-format ed25519 secret key (seed + public key). */
    secretKey: Buffer;
  }

  export default class HyperDHT {
    /**
     * Deterministically derive a keypair from a 32-byte seed. With no seed,
     * a random keypair is generated.
     */
    static keyPair(seed?: Buffer | Uint8Array): HyperDhtKeyPair;
  }
}
