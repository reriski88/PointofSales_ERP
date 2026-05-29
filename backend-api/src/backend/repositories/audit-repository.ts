import { db } from "@/db";
import { auditLog } from "@/db/schema";

export const auditRepository = {
  create(values: typeof auditLog.$inferInsert) {
    return db.insert(auditLog).values(values);
  },
};
