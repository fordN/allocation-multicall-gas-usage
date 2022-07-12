import { ethereum, log } from "@graphprotocol/graph-ts"
import { AllocationClosed, AllocationCreated,} from "../generated/Staking/Staking"
import {
  bigInt1,
  gasPerLegacyAllocate,
  gasPerLegacyReallocate,
  gasPerLegacyUnallocate,
  isMulticall,
  IndexerMulticallPair
} from "./util"

export function handleAllocationClosed(event: AllocationClosed): void {
  log.info('handling allocation closed event!', [])

  let partOfMulticall = false
  let receipt = event.receipt!
  let logs: ethereum.Log[] = receipt.logs
  let thisLogIndex = 0
  for (let i = 0; i < logs.length; i++) {
    if (logs[i].logIndex === event.logIndex) {
      thisLogIndex = i
    }
  }
  let thisLog = logs[thisLogIndex]
  let topic0 = thisLog.topics[0]
  let subgraphDeploymentID = thisLog.topics[2]
  let countOfEventsAffectingSameDeployment = 0


  // Is this a multicall?
  // Look for duplicate eventType
  partOfMulticall = isMulticall(logs, event.logIndex, topic0)
  // for (let i = 0; i< logs.length; i++) {
  //   if (logs[i].logIndex != event.logIndex && logs[i].topics[0] === topic0) {
  //     partOfMulticall = true
  //   }
  // }

  // If it is a multicall make sure there is an entity and start building summary data
  if (partOfMulticall) {
    log.info('found me a multicall at tx: {}!', [event.transaction.hash.toHex()])
    let pair = new IndexerMulticallPair( event.transaction.from, event.transaction.hash, receipt.gasUsed)
    // let multicall = pair.multicall
    // let indexer = pair.indexer

    for (let i = 0; i< logs.length; i++) {
      // Is this the create part of a closeAndAllocate call?
      // - Same subgraphDeploymentID target (topic2)
      // - Different logIndex
      if (logs[i].topics.length > 2) {
        if (logs[i].topics[2] === subgraphDeploymentID && logs[i].logIndex != event.logIndex) {
          countOfEventsAffectingSameDeployment++
        }
      }
    }

    log.info(
      '(closed) number of dupes found for topic2 = {} : {}',
      [subgraphDeploymentID.toHex(), countOfEventsAffectingSameDeployment.toString()]
    )
    // Is this event emitted from an `unallocate` action?
    if (countOfEventsAffectingSameDeployment.toString() == '0') {
      log.debug('FOUND AN UNALLOCATE', [])
      pair.multicall.unallocateCount = pair.multicall.unallocateCount + bigInt1
      pair.multicall.actionsCount = pair.multicall.actionsCount + bigInt1
      pair.multicall.legacyGasUsed = pair.multicall.legacyGasUsed + gasPerLegacyUnallocate

      pair.indexer.unallocatesBundled = pair.indexer.unallocatesBundled + bigInt1
      pair.indexer.totalActionsBundled = pair.indexer.totalActionsBundled + bigInt1
      pair.indexer.totalLegacyGasUsed = pair.indexer.totalLegacyGasUsed + gasPerLegacyUnallocate
    }
    // Is this event emitted from an `reallocate` action?
    if (countOfEventsAffectingSameDeployment.toString() == '1') {
      log.debug('FOUND A REALLOCATE', [])
      pair.multicall.reallocateCount = pair.multicall.reallocateCount + bigInt1
      pair.multicall.actionsCount = pair.multicall.actionsCount + bigInt1
      pair.multicall.legacyGasUsed = pair.multicall.legacyGasUsed + gasPerLegacyReallocate

      pair.indexer.reallocatesBundled = pair.indexer.reallocatesBundled + bigInt1
      pair.indexer.totalActionsBundled = pair.indexer.totalActionsBundled + bigInt1
      pair.indexer.totalLegacyGasUsed = pair.indexer.totalLegacyGasUsed + gasPerLegacyReallocate
    }

    if (countOfEventsAffectingSameDeployment.toString() == '0' || countOfEventsAffectingSameDeployment.toString() == '1') {
      pair.multicall.gasSaved = pair.multicall.legacyGasUsed - pair.multicall.gasUsed
      pair.multicall.gasSavedPercentage = pair.multicall.gasSaved.div(pair.multicall.legacyGasUsed)

      pair.indexer.totalGasSaved = pair.indexer.totalLegacyGasUsed - pair.indexer.totalGasUsed
    }

    pair.multicall.save()
    pair.indexer.save()
  }
}

export function handleAllocationCreated(event: AllocationCreated): void {
  log.info('handling allocation created event!', [])
  let partOfMulticall = false

  let logIndex = event.logIndex
  let receipt = event.receipt!
  let logs: ethereum.Log[] = receipt.logs
  let thisLogIndex = 0
  for (let i = 0; i < logs.length; i++) {
    if (logs[i].logIndex === event.logIndex) {
      thisLogIndex = i
    }
  }
  let thisLog = logs[thisLogIndex]
  let topic0 = thisLog.topics[0]
  let subgraphDeploymentID = thisLog.topics[2]
  let countOfEventsAffectingSameDeployment = 0


  // Is this a multicall?
  // Look for duplicate eventType
  // for (let i = 0; i< logs.length; i++) {
  //   if (logs[i].logIndex != event.logIndex && logs[i].topics[0] === topic0) {
  //     partOfMulticall = true
  //   }
  // }
  partOfMulticall = isMulticall(logs, event.logIndex, topic0)

  // If it is a multicall make sure there is an entity and start building summary data
  if (partOfMulticall) {
    log.info('(Created) found me a multicall at tx: {}!', [event.transaction.hash.toHex()])

    let pair = new IndexerMulticallPair( event.transaction.from, event.transaction.hash, receipt.gasUsed)
    // let multicall = pair.multicall
    // let indexer = pair.indexer

    for (let i = 0; i< logs.length; i++) {
      // Is this the create part of a closeAndAllocate call?
      // - Same subgraphDeploymentID target (topic2)
      // - Different logIndex
      if (logs[i].topics.length > 2) {
        if (logs[i].topics[2] === subgraphDeploymentID && logs[i].logIndex != event.logIndex) {
          countOfEventsAffectingSameDeployment++
        }
      }
    }

    log.info('(created) number of dupes found for topic2 = {} : {}', [subgraphDeploymentID.toHex(), countOfEventsAffectingSameDeployment.toString()])

    // Is this event emitted from an `allocate` action?
    if (countOfEventsAffectingSameDeployment.toString() == '0') {
      log.debug('FOUND AN ALLOCATE', [])
      pair.multicall.allocateCount = pair.multicall.allocateCount + bigInt1
      pair.multicall.actionsCount = pair.multicall.actionsCount + bigInt1
      pair.multicall.legacyGasUsed = pair.multicall.legacyGasUsed + gasPerLegacyAllocate


      pair.multicall.gasSaved = pair.multicall.legacyGasUsed - pair.multicall.gasUsed
      pair.multicall.gasSavedPercentage = multicall.gasSaved.div(multicall.legacyGasUsed)


      pair.indexer.allocatesBundled = pair.indexer.allocatesBundled + bigInt1
      pair.indexer.totalActionsBundled = pair.indexer.totalActionsBundled + bigInt1
      pair.indexer.totalLegacyGasUsed = pair.indexer.totalLegacyGasUsed + gasPerLegacyAllocate
      pair.indexer.totalGasSaved = pair.indexer.totalLegacyGasUsed - pair.indexer.totalGasUsed
    }
    pair.multicall.save()
    pair.indexer.save()
  }
}
