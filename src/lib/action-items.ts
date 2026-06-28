import type { SessionUser } from "@/lib/permissions";

export function filterActionItemsForUser<T extends { ownerId: string | null }>(
  user: SessionUser,
  items: T[],
): T[] {
  if (user.canEditAll) return items;
  return items.filter((item) => item.ownerId === user.id);
}
