// Verlauf gesendeter VNET-Mails – protokolliert im Supabase-KV über die
// Edge-Function. Der Mailversand selbst läuft clientseitig (Embedded VAPI);
// dieser Service speichert/liest nur die History.
import { projectId, publicAnonKey } from "/utils/supabase/info";

export interface MailLogEntry {
  id: string;
  receiverMail: string;
  msg: string;
  senderFactoryId: string;
  senderName: string;
  status: "sent" | "failed";
  error?: string;
  createdAt: string;
}

export interface NewMailLogEntry {
  receiverMail: string;
  msg: string;
  senderFactoryId: string;
  senderName: string;
  status: "sent" | "failed";
  error?: string;
}

const BASE = `https://${projectId}.supabase.co/functions/v1/make-server-d632b7fe/vnet/mail-log`;

/** Protokolliert eine gesendete/fehlgeschlagene Mail. Wirft nie – Logging darf
 *  den UX-Fluss nicht unterbrechen. */
export async function logSentMail(entry: NewMailLogEntry): Promise<void> {
  try {
    const res = await fetch(BASE, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${publicAnonKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(entry),
    });
    if (!res.ok) {
      const text = await res.text();
      console.error(`❌ [mailLog] Protokollieren fehlgeschlagen (${res.status}): ${text}`);
    }
  } catch (err) {
    console.error("❌ [mailLog] Protokollieren fehlgeschlagen:", err);
  }
}

/** Lädt den Mail-Verlauf (neueste zuerst). Bei Fehler leeres Array. */
export async function getMailLog(limit = 100): Promise<MailLogEntry[]> {
  try {
    const res = await fetch(`${BASE}?limit=${encodeURIComponent(String(limit))}`, {
      headers: { Authorization: `Bearer ${publicAnonKey}` },
    });
    if (!res.ok) {
      const text = await res.text();
      console.error(`❌ [mailLog] Verlauf laden fehlgeschlagen (${res.status}): ${text}`);
      return [];
    }
    const body = await res.json();
    return Array.isArray(body?.entries) ? (body.entries as MailLogEntry[]) : [];
  } catch (err) {
    console.error("❌ [mailLog] Verlauf laden fehlgeschlagen:", err);
    return [];
  }
}
