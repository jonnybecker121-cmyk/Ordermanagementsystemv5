// Client für die State-V "Embedded VAPI".
// Anders als die REST-API läuft diese über window.postMessage an das
// übergeordnete State-V-Fenster (die App ist dort als iFrame eingebettet).
// Jede Anfrage bekommt eine eindeutige requestId; die Antwort wird über ein
// globales `message`-Event derselben requestId zugeordnet und als Promise
// aufgelöst.

export interface VapiResponse<T = any> {
  function: string;
  ok: boolean;
  requestId: string;
  payload: T;
}

interface SendMailPayload {
  // Bei Erfolg: { message: "send" }; bei Fehler: { error: "..." }
  message?: string;
  error?: string;
}

const DEFAULT_TIMEOUT = 15_000;

let counter = 0;
const nextRequestId = (fn: string) => `${fn}-${Date.now()}-${++counter}`;

/**
 * Ruft eine Embedded-VAPI-Funktion auf und wartet auf die zugehörige Antwort.
 * Wirft bei Timeout oder wenn kein übergeordnetes Fenster vorhanden ist.
 */
export function callEmbeddedVapi<T = any>(
  functionName: string,
  apiKey: string,
  payload: Record<string, unknown> = {},
  timeout = DEFAULT_TIMEOUT,
): Promise<VapiResponse<T>> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || window.parent === window) {
      reject(
        new Error(
          "Embedded VAPI nicht verfügbar: Die App läuft nicht in einem State-V-Fenster (kein übergeordneter Frame).",
        ),
      );
      return;
    }

    const requestId = nextRequestId(functionName);

    const cleanup = () => {
      window.removeEventListener("message", onMessage);
      clearTimeout(timer);
    };

    const timer = setTimeout(() => {
      cleanup();
      reject(new Error(`Zeitüberschreitung bei VAPI-Aufruf '${functionName}' (${timeout} ms).`));
    }, timeout);

    function onMessage(event: MessageEvent) {
      const res = event.data as VapiResponse<T> | undefined;
      if (!res || res.requestId !== requestId) return;
      cleanup();
      resolve(res);
    }

    window.addEventListener("message", onMessage);

    try {
      window.parent.postMessage(
        { function: functionName, apiKey, requestId, payload },
        "*",
      );
    } catch (err) {
      cleanup();
      reject(
        new Error(
          `postMessage an das State-V-Fenster fehlgeschlagen: ${err instanceof Error ? err.message : String(err)}`,
        ),
      );
    }
  });
}

/**
 * Sendet eine VNET-Mail (Premium-Endpunkt `sendMailMessage`).
 * Löst bei Erfolg auf; wirft mit der State-V-Fehlermeldung (z. B. "No Receiver
 * Mail" / "No Message"), da diese im Payload und nicht über `ok:false` kommen.
 */
export async function sendVnetMail(
  receiverMail: string,
  msg: string,
  apiKey: string,
): Promise<void> {
  const res = await callEmbeddedVapi<SendMailPayload>("sendMailMessage", apiKey, {
    receiverMail,
    msg,
  });

  // State-V liefert Fehler aktuell mit ok:true, aber payload.error gesetzt.
  const payloadError = res.payload?.error;
  if (payloadError) {
    throw new Error(`VNET-Mail fehlgeschlagen: ${payloadError}`);
  }
  if (!res.ok) {
    throw new Error("VNET-Mail fehlgeschlagen: State-V antwortete mit ok:false.");
  }
}
