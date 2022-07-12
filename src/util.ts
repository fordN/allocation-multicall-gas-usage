import { Address, BigInt, Bytes, ethereum } from "@graphprotocol/graph-ts"
import { Indexer, Multicall } from "../generated/schema"

export const gasPerLegacyAllocate = BigInt.fromI32(279899)
export const gasPerLegacyUnallocate = BigInt.fromI32(266229)
export const gasPerLegacyReallocate = BigInt.fromI32(422410)

export const bigInt0 = BigInt.fromI32(0)
export const bigInt1 = BigInt.fromI32(0)

export class IndexerMulticallPair {
  indexer: Indexer
  multicall: Multicall

  constructor(indexer: Address, transaction: Bytes, gasUsed: BigInt) {
    // Load existing multicall summary entity
    let multicallSummary = Multicall.load(transaction.toHex())
    let indexerSummary = Indexer.load(indexer.toHex())

    // If none exists yet for this transaction create one and initialize summary data
    if (!indexerSummary) {
      indexerSummary = new Indexer(indexer.toHex())

      indexerSummary.allocatesBundled = bigInt0
      indexerSummary.unallocatesBundled = bigInt0
      indexerSummary.reallocatesBundled = bigInt0

      indexerSummary.totalActionsBundled = bigInt0
      indexerSummary.totalGasUsed = bigInt0
      indexerSummary.totalLegacyGasUsed = bigInt0
      indexerSummary.totalGasSaved = bigInt0

      indexerSummary.multicallTransactions = bigInt0
    }

    if (!multicallSummary) {
      multicallSummary = new Multicall(transaction.toHex())
      multicallSummary.indexer = indexer.toHex()
      multicallSummary.gasUsed = gasUsed
      // Initiate legacy gas estimate with the base gas cost
      multicallSummary.legacyGasUsed = BigInt.fromString('21000')
      multicallSummary.gasSaved = bigInt0
      multicallSummary.gasSavedPercentage = bigInt0

      multicallSummary.allocateCount = bigInt0
      multicallSummary.unallocateCount = bigInt0
      multicallSummary.reallocateCount = bigInt0
      multicallSummary.actionsCount = bigInt0

      indexerSummary.multicallTransactions = indexerSummary.multicallTransactions + bigInt1
      indexerSummary.totalGasUsed = indexerSummary.totalGasUsed + gasUsed
      indexerSummary.totalLegacyGasUsed = indexerSummary.totalLegacyGasUsed + BigInt.fromString('21000')
    }
    this.indexer = indexerSummary
    this.multicall = multicallSummary
  }
}


export function isMulticall(logs: ethereum.Logs[], logIndex: BigInt, topic0: Bytes): boolean {
  for (let i = 0; i< logs.length; i++) {
    if (logs[i].logIndex != logIndex && logs[i].topics[0] === topic0) {
      return true
    }
  }
  return false
}
