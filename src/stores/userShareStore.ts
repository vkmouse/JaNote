import { ref } from "vue";
import { defineStore } from "pinia";
import { userShareRepository } from "../db/repositories/userShareRepository";
import { syncQueueRepository } from "../db/repositories/syncQueueRepository";
import type { UserShare } from "../types";

export const useUserShareStore = defineStore("userShare", () => {
  // ── State ──────────────────────────────────────────────────
  /** 當前使用者已發出且待接受的邀請 */
  const sentPendingInvites = ref<UserShare[]>([]);
  /** 當前使用者收到且待處理的邀請 */
  const receivedPendingInvites = ref<UserShare[]>([]);
  /** 已啟用的共享清單 */
  const activeShares = ref<UserShare[]>([]);

  // ── Actions ────────────────────────────────────────────────
  /** 載入並分類所有共享記錄 */
  async function loadShares(currentUserId: string): Promise<void> {
    const allShares = await userShareRepository.getAll();
    const validShares = allShares.filter((share) => share.is_deleted === 0);

    sentPendingInvites.value = validShares.filter(
      (share) =>
        share.status === "PENDING" && share.sender_id === currentUserId,
    );
    receivedPendingInvites.value = validShares.filter(
      (share) =>
        share.status === "PENDING" && share.receiver_id === currentUserId,
    );
    activeShares.value = validShares.filter(
      (share) => share.status === "ACTIVE",
    );
  }

  /** 發送共享邀請（樂觀寫入 + 加入同步佇列） */
  async function sendInvite(
    senderId: string,
    senderEmail: string,
    receiverEmail: string,
  ): Promise<void> {
    const shareId = crypto.randomUUID();
    const now = Date.now();

    await syncQueueRepository.add({
      mutation_id: crypto.randomUUID(),
      entity_type: "SHR",
      entity_id: shareId,
      action: "POST",
      payload: JSON.stringify({
        id: shareId,
        sender_id: senderId,
        sender_email: senderEmail,
        receiver_id: "",
        receiver_email: receiverEmail,
        status: "PENDING",
      }),
      base_version: 0,
      snapshot_before: null,
      created_at: now,
    });

    await userShareRepository.upsert({
      id: shareId,
      sender_id: senderId,
      sender_email: senderEmail,
      receiver_id: "",
      receiver_email: receiverEmail,
      status: "PENDING",
      version: 1,
      is_deleted: 0,
    });
  }

  /** 接受邀請（樂觀更新 + 加入同步佇列） */
  async function acceptInvitation(share: UserShare): Promise<void> {
    const snapshot = JSON.stringify(share);

    await syncQueueRepository.add({
      mutation_id: crypto.randomUUID(),
      entity_type: "SHR",
      entity_id: share.id,
      action: "PUT",
      payload: JSON.stringify({
        id: share.id,
        sender_id: share.sender_id,
        sender_email: share.sender_email,
        receiver_id: share.receiver_id,
        receiver_email: share.receiver_email,
        status: "ACTIVE",
      }),
      base_version: share.version,
      snapshot_before: snapshot,
      created_at: Date.now(),
    });

    await userShareRepository.update(share.id, (current) => {
      if (!current) return null;
      return { ...current, status: "ACTIVE", version: current.version + 1 };
    });
  }

  /** 拒絕或取消共享（樂觀刪除 + 加入同步佇列） */
  async function rejectOrCancelShare(share: UserShare): Promise<void> {
    const snapshot = JSON.stringify(share);

    await syncQueueRepository.add({
      mutation_id: crypto.randomUUID(),
      entity_type: "SHR",
      entity_id: share.id,
      action: "DELETE",
      payload: null,
      base_version: share.version,
      snapshot_before: snapshot,
      created_at: Date.now(),
    });

    await userShareRepository.update(share.id, (current) => {
      if (!current) return null;
      return { ...current, is_deleted: 1, version: current.version + 1 };
    });
  }

  /** 清空所有共享（用於本機重置） */
  async function deleteAllShares(): Promise<void> {
    await userShareRepository.deleteAll();
    sentPendingInvites.value = [];
    receivedPendingInvites.value = [];
    activeShares.value = [];
  }

  return {
    // state
    sentPendingInvites,
    receivedPendingInvites,
    activeShares,
    // actions
    loadShares,
    sendInvite,
    acceptInvitation,
    rejectOrCancelShare,
    deleteAllShares,
  };
});
