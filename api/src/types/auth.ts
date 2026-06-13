import type { UserRole } from "@prisma/client";

export type AuthPayload = {
  userId: string;
  role: UserRole;
};
