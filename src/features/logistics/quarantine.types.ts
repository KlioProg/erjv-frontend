export type QuarantineCondition = 'DAMAGED' | 'SPOILED'
export type CreateManualQuarantinePayload = ManualQuarantinePayload
export type QuarantineAction = 'CLEAR' | 'REMOVE'
export type ManualQuarantinePayload = {
  stockItemId: number
  condition: QuarantineCondition
  quantity: string
  reason: string
  requestId: string
}
export type QuarantineFilter = {
  limit?: number
  cursor?: string
  stockItemId?: number
  condition?: QuarantineCondition
  openOnly?: boolean
}
export type QuarantineConditionPayload = {
  condition: QuarantineCondition
  reason: string
  expectedRevision: number
  requestId: string
}
export type QuarantineResolutionPayload = {
  action: QuarantineAction
  quantity: string
  reason: string
  expectedRevision: number
  requestId: string
}
export type QuarantineResolution = QuarantineResolutionPayload & {
  id: number
  beforeRevision: number
  afterRevision: number
  lotId: number
  actorUserId: number
  createdAt: string
}
export type QuarantineLot = {
  id: number
  revision: number
  stockItemId: number
  sourceKind: 'MANUAL' | 'INCOMING_DELIVERY' | 'OUTGOING_DELIVERY'
  condition: QuarantineCondition
  reportedCondition: QuarantineCondition
  initialQuantity: string
  remainingQuantity: string
  incomingDeliveryItemId: number | null
  outgoingDeliveryItemId: number | null
  taggedByUserId: number | null
  tagReason: string | null
  requestId: string | null
  createdAt: string
}
export type QuarantineConditionChange = {
  id: number
  lotId: number
  fromCondition: QuarantineCondition
  toCondition: QuarantineCondition
  reason: string
  actorUserId: number
  createdAt: string
  requestId: string
  expectedRevision: number
  beforeRevision: number
  afterRevision: number
}
export type QuarantinePage<T> = { items: T[]; nextCursor: string | null }
