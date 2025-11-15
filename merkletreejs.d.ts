declare module 'merkletreejs' {
  import { Buffer } from 'buffer';

  export class MerkleTree {
    constructor(
      leaves: Buffer[],
      hashFunction: (data: Buffer) => Buffer,
      options?: { sortPairs?: boolean }
    );
    getHexRoot(): `0x${string}`;
    getHexProof(leaf: Buffer): `0x${string}`[];
  }
}
