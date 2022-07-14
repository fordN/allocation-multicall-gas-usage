import {
  Address,
  BigDecimal,
  BigInt,
  Bytes,
  ethereum,
  log,
} from '@graphprotocol/graph-ts'
import { Indexer, Multicall } from '../generated/schema'

export const gasPerLegacyAllocate = BigInt.fromI32(279899)
export const gasPerLegacyUnallocate = BigInt.fromI32(266229)
export const gasPerLegacyReallocate = BigInt.fromI32(422410)

export const bigInt0 = BigInt.zero()
export const bigInt1 = BigInt.fromI32(1)

export class IndexerMulticallPair {
  indexer: Indexer
  multicall: Multicall

  constructor(blockNumber: BigInt, indexer: Address, transaction: Bytes, gasUsed: BigInt) {
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
      indexerSummary.gasReduction = BigDecimal.zero()

      indexerSummary.multicallTransactions = bigInt0
    }

    if (!multicallSummary) {
      multicallSummary = new Multicall(transaction.toHex())

      multicallSummary.blockNumber = blockNumber
      multicallSummary.indexer = indexer.toHex()
      multicallSummary.gasUsed = gasUsed
      // Initiate legacy gas estimate with the base gas cost
      multicallSummary.legacyGasUsed = BigInt.fromString('21000')
      multicallSummary.gasSaved = bigInt0
      multicallSummary.gasReduction = BigDecimal.zero()

      multicallSummary.allocateCount = bigInt0
      multicallSummary.unallocateCount = bigInt0
      multicallSummary.reallocateCount = bigInt0
      multicallSummary.actionsCount = bigInt0

      indexerSummary.multicallTransactions =
        indexerSummary.multicallTransactions + bigInt1
      indexerSummary.totalGasUsed = indexerSummary.totalGasUsed + gasUsed
      indexerSummary.totalLegacyGasUsed =
        indexerSummary.totalLegacyGasUsed + BigInt.fromString('21000')
      indexerSummary.gasReduction = BigDecimal.zero()

    }
    this.indexer = indexerSummary
    this.multicall = multicallSummary
  }
  save(): void {
    this.indexer.save()
    this.multicall.save()
  }

  incrementActionInMulticall(actionType: ActionType): void {
    //Action type specific updates
    if (actionType == ActionType.unknown) {
      return
    }
    if (actionType == ActionType.allocate) {
      this.multicall.allocateCount = this.multicall.allocateCount + bigInt1
      this.indexer.allocatesBundled = this.indexer.allocatesBundled + bigInt1
      this.multicall.legacyGasUsed = this.multicall.legacyGasUsed + gasPerLegacyAllocate
      this.indexer.totalLegacyGasUsed =
        this.indexer.totalLegacyGasUsed + gasPerLegacyAllocate
    } else if (actionType == ActionType.unallocate) {
      this.multicall.unallocateCount = this.multicall.unallocateCount + bigInt1
      this.indexer.unallocatesBundled = this.indexer.unallocatesBundled + bigInt1
      this.multicall.legacyGasUsed = this.multicall.legacyGasUsed + gasPerLegacyUnallocate
      this.indexer.totalLegacyGasUsed =
        this.indexer.totalLegacyGasUsed + gasPerLegacyUnallocate
    } else if (actionType == ActionType.reallocate) {
      this.multicall.reallocateCount = this.multicall.reallocateCount + bigInt1
      this.indexer.reallocatesBundled = this.indexer.reallocatesBundled + bigInt1
      this.multicall.legacyGasUsed = this.multicall.legacyGasUsed + gasPerLegacyReallocate
      this.indexer.totalLegacyGasUsed =
        this.indexer.totalLegacyGasUsed + gasPerLegacyReallocate
    }

    // General action increment updates
    this.multicall.actionsCount = this.multicall.actionsCount + bigInt1
    this.multicall.gasSaved = this.multicall.legacyGasUsed - this.multicall.gasUsed
    this.multicall.gasReduction = this.multicall.gasSaved.divDecimal(
      this.multicall.legacyGasUsed.toBigDecimal(),
    )
    this.indexer.totalActionsBundled = this.indexer.totalActionsBundled + bigInt1
    this.indexer.totalGasSaved =
      this.indexer.totalLegacyGasUsed - this.indexer.totalGasUsed
    this.indexer.gasReduction = this.indexer.totalGasSaved.divDecimal(
      this.indexer.totalLegacyGasUsed.toBigDecimal(),
    )
    this.indexer.avgGasSavedPerMulticall = this.indexer.totalGasSaved.divDecimal(this.indexer.multicallTransactions.toBigDecimal())
    this.indexer.avgNumActionsPerMulticall = this.indexer.totalActionsBundled.divDecimal(this.indexer.multicallTransactions.toBigDecimal())
  }
}

export function isMulticall(
  logs: ethereum.Log[],
  logIndex: BigInt,
  topic0: Bytes,
): boolean {
  for (let i = 0; i < logs.length; i++) {
    if (logs[i].logIndex != logIndex && logs[i].topics[0] == topic0) {
      return true
    }
  }
  return false
}

export enum ActionType {
  allocate = 0,
  unallocate = 1,
  reallocate = 2,
  unknown = 3,
}

export enum EventType {
  create = 0,
  close = 1,
}

export function classifyActionType(
  eventType: EventType,
  logs: ethereum.Log[],
  subgraphDeploymentID: Bytes,
  logIndex: BigInt,
): ActionType {
  let otherEventsAffectingSameDeployment = 0

  for (let i = 0; i < logs.length; i++) {
    // Is this one part of a closeAndAllocate call?
    // Check for:
    //    - Same subgraphDeploymentID target (topic2)
    //    - Different logIndex
    if (logs[i].topics.length > 2) {
      const thisTopic2 = logs[i].topics[2]
      const thisLogIndex = logs[i].logIndex

      if (thisTopic2 == subgraphDeploymentID && thisLogIndex != logIndex) {
        otherEventsAffectingSameDeployment = otherEventsAffectingSameDeployment + 1
      }
    }
  }

  if (eventType == EventType.close) {
    if (otherEventsAffectingSameDeployment == 0) {
      return ActionType.unallocate
    } else if (otherEventsAffectingSameDeployment == 1) {
      return ActionType.reallocate
    } else {
      log.info(
        'Found transaction with more than 2 events affecting same subgraphDeploymentID, expected max is 2',
        [],
      )
    }
  } else if (eventType == EventType.create) {
    if (otherEventsAffectingSameDeployment == 0) {
      return ActionType.allocate
    }
  }
  return ActionType.unknown
}

export function getThisLog(logs: ethereum.Log[], logIndex: BigInt): ethereum.Log {
  let arrayIndex = -1
  for (let i = 0; i < logs.length; i++) {
    if (logs[i].logIndex == logIndex) {
      arrayIndex = i
    }
  }
  if(arrayIndex == -1) {
    log.warning(`Event.logIndex ('{}') not found in event.logs...something is 🐟`, [logIndex.toString()])
  }
  return logs[arrayIndex]
}
