import { userShareRepository } from '../repositories/userShareRepository'
import { syncQueueRepository } from '../repositories/syncQueueRepository'
import type { UserShare } from '../types'

/**
 * 發送共享邀請
 */
async function sendInvite(
  ownerId: string,
  ownerEmail: string,
  viewerEmail: string
): Promise<void> {
  const shareId = crypto.randomUUID()
  const mutationId = crypto.randomUUID()
  const now = Date.now()

  // 寫入 sync_queue
  await syncQueueRepository.add({
    mutation_id: mutationId,
    entity_type: 'SHR',
    entity_id: shareId,
    action: 'POST',
    payload: JSON.stringify({
      id: shareId,
      owner_id: ownerId,
      owner_email: ownerEmail,
      viewer_id: '',
      viewer_email: viewerEmail,
      status: 'PENDING',
    }),
    base_version: 0,
    snapshot_before: null, // POST 沒有之前的狀態
    created_at: now,
  })

  // 寫入 user_shares
  await userShareRepository.upsert({
    id: shareId,
    owner_id: ownerId,
    owner_email: ownerEmail,
    viewer_id: '',
    viewer_email: viewerEmail,
    status: 'PENDING',
    version: 1,
    is_deleted: 0,
  })
}

/**
 * 接受邀請
 */
async function acceptInvitation(share: UserShare): Promise<void> {
  const mutationId = crypto.randomUUID()
  const now = Date.now()

  // 保存快照用於 rollback
  const snapshot = JSON.stringify(share)

  // 寫入 sync_queue - 發送 PUT 請求
  await syncQueueRepository.add({
    mutation_id: mutationId,
    entity_type: 'SHR',
    entity_id: share.id,
    action: 'PUT',
    payload: JSON.stringify({
      id: share.id,
      owner_id: share.owner_id,
      owner_email: share.owner_email,
      viewer_id: share.viewer_id,
      viewer_email: share.viewer_email,
      status: 'ACTIVE',
    }),
    base_version: share.version,
    snapshot_before: snapshot,
    created_at: now,
  })

  // 更新本地 user_shares（樂觀更新）
  await userShareRepository.update(share.id, (current) => {
    if (!current) return null
    return {
      ...current,
      status: 'ACTIVE',
      version: current.version + 1,
    }
  })
}

/**
 * 拒絕或取消共享
 */
async function rejectOrCancelShare(share: UserShare): Promise<void> {
  const mutationId = crypto.randomUUID()
  const now = Date.now()

  // 保存快照用於 rollback
  const snapshot = JSON.stringify(share)

  // 寫入 sync_queue - 發送 DELETE 請求
  await syncQueueRepository.add({
    mutation_id: mutationId,
    entity_type: 'SHR',
    entity_id: share.id,
    action: 'DELETE',
    payload: null,
    base_version: share.version,
    snapshot_before: snapshot,
    created_at: now,
  })

  // 更新本地 user_shares（樂觀刪除）
  await userShareRepository.update(share.id, (current) => {
    if (!current) return null
    return {
      ...current,
      is_deleted: 1,
      version: current.version + 1,
    }
  })
}

/**
 * 刪除所有共享（用於清空本地資料）
 */
async function deleteAllShares(): Promise<void> {
  await userShareRepository.deleteAll()
}

export const userShareService = {
  sendInvite,
  acceptInvitation,
  rejectOrCancelShare,
  deleteAllShares,
}
