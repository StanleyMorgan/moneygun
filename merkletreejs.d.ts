// Создаем файл декларации для merkletreejs, так как у него нет собственных типов,
// а пакет @types/merkletreejs недоступен. Это решает ошибку TypeScript
// "Cannot find module 'merkletreejs' or its corresponding type declarations."

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
