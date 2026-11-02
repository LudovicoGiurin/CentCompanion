import { eq } from "drizzle-orm";
import type { getDb } from "../../db/index";
import { events } from "../../db/schema";

const CHARSET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function generateJoinCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  let code = "";
  for (let i = 0; i < 6; i++) code += CHARSET[bytes[i]! % CHARSET.length];
  return code;
}

export async function uniqueJoinCode(db: ReturnType<typeof getDb>): Promise<string> {
  for (let attempt = 0; attempt < 12; attempt++) {
    const code = generateJoinCode();
    const [existing] = await db.select({ id: events.id }).from(events).where(eq(events.joinCode, code)).limit(1);
    if (!existing) return code;
  }
  throw new Error("Could not generate unique join code");
}
