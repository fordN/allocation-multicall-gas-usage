import { ethereum, log } from '@graphprotocol/graph-ts'
import { AllocationClosed, AllocationCreated } from '../generated/Staking/Staking'
import {
  classifyActionType,
  getThisLog,
  isMulticall,
  AllocationEventTopics,
  EventType,
  IndexerMulticallPair,
} from './util'

export function handleAllocationClosed(event: AllocationClosed): void {
  let receipt = event.receipt!
  let logs: ethereum.Log[] = receipt.logs

  let thisLog = getThisLog(logs, event.logIndex)
  let topic0 = thisLog.topics[0]
  let subgraphDeploymentID = thisLog.topics[2]

  const partOfMulticall = isMulticall(logs, event.logIndex, topic0)

  if (partOfMulticall) {
    let pair = new IndexerMulticallPair(
      event.block.number,
      event.transaction.from,
      event.transaction.hash,
      receipt.gasUsed,
    )

    const actionType = classifyActionType(
      EventType.close,
      logs,
      subgraphDeploymentID,
      event.logIndex,
    )

    pair.incrementActionInMulticall(actionType)
    pair.save()
  }
}

export function handleAllocationCreated(event: AllocationCreated): void {
  const receipt = event.receipt!
  const logs: ethereum.Log[] = receipt.logs
  const thisLog = getThisLog(logs, event.logIndex)
  const topic0 = thisLog.topics[0]
  const subgraphDeploymentID = thisLog.topics[2]

  const partOfMulticall = isMulticall(logs, event.logIndex, topic0)

  if (partOfMulticall) {
    let pair = new IndexerMulticallPair(
      event.block.number,
      event.transaction.from,
      event.transaction.hash,
      receipt.gasUsed,
    )

    const actionType = classifyActionType(
      EventType.create,
      logs,
      subgraphDeploymentID,
      event.logIndex,
    )

    pair.incrementActionInMulticall(actionType)
    pair.save()
  }
}
