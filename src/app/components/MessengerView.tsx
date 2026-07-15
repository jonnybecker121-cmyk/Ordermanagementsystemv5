import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Badge } from './ui/badge';
import { MessageSquare, Send, Mail, Loader2, KeyRound, Building2, History, CheckCircle, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { sendVnetMail } from '../services/vnetVapi';
import { statevApi } from '../services/statevApi';
import { getMailLog, logSentMail, MailLogEntry } from '../services/mailLog';

// V-NET wird direkt als iFrame von State-V eingebettet (keine externe Seite).
const VNET_URL = 'https://vnet.statev.de/dashboard';

// Es wird ausschließlich im Namen dieser Firma gesendet. Der eigentliche
// Absender wird serverseitig über den API-Key bestimmt – hier zeigen wir nur
// den Firmen-Kontext (Name) an.
const SENDER_FACTORY_ID = '65ce2e98e3a3ab88426f2794';

const API_KEY_STORAGE = 'vnet_api_key';

export default function MessengerView() {
  // ── VNET-Mail Composer ────────────────────────────────────────────────────
  const [mailOpen, setMailOpen] = useState(false);
  const [receiverMail, setReceiverMail] = useState('');
  const [mailMsg, setMailMsg] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [sending, setSending] = useState(false);
  const [senderName, setSenderName] = useState('');
  const [mailLog, setMailLog] = useState<MailLogEntry[]>([]);
  const [logLoading, setLogLoading] = useState(false);

  const loadMailLog = async () => {
    setLogLoading(true);
    try {
      setMailLog(await getMailLog(100));
    } finally {
      setLogLoading(false);
    }
  };

  // Verlauf laden, sobald der Dialog geöffnet wird.
  useEffect(() => {
    if (mailOpen) loadMailLog();
  }, [mailOpen]);

  // API-Key einmalig aus dem lokalen Speicher laden.
  useEffect(() => {
    try {
      const stored = localStorage.getItem(API_KEY_STORAGE);
      if (stored) setApiKey(stored);
    } catch {
      /* localStorage nicht verfügbar – ignorieren */
    }
  }, []);

  // Absender-Firma (Name) laden, damit klar ist, in wessen Namen gesendet wird.
  useEffect(() => {
    let cancelled = false;
    statevApi
      .getFactories()
      .then((factories) => {
        if (cancelled) return;
        const firm = factories.find((f) => f.id === SENDER_FACTORY_ID);
        if (firm?.name) setSenderName(firm.name);
      })
      .catch((err) => console.error('❌ [MessengerView] Firmen-Info Fehler:', err));
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSendMail = async () => {
    if (!receiverMail.trim()) {
      toast.error('Empfänger fehlt', { description: 'Bitte eine VNET-Mailadresse angeben.' });
      return;
    }
    if (!mailMsg.trim()) {
      toast.error('Nachricht fehlt', { description: 'Bitte einen Nachrichtentext eingeben.' });
      return;
    }
    if (!apiKey.trim()) {
      toast.error('API-Key fehlt', { description: 'Bitte den State-V API-Key hinterlegen.' });
      return;
    }

    const receiver = receiverMail.trim();
    const message = mailMsg.trim();

    setSending(true);
    try {
      // Key für spätere Nutzung lokal merken.
      try { localStorage.setItem(API_KEY_STORAGE, apiKey.trim()); } catch { /* ignore */ }

      await sendVnetMail(receiver, message, apiKey.trim());
      // Erfolg im Supabase-KV protokollieren (best effort).
      await logSentMail({
        receiverMail: receiver,
        msg: message,
        senderFactoryId: SENDER_FACTORY_ID,
        senderName,
        status: 'sent',
      });
      toast.success('VNET-Mail gesendet', { description: `An ${receiver}` });
      setMailMsg('');
      await loadMailLog();
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error('❌ [MessengerView] VNET-Mail Fehler:', err);
      // Fehlversuch ebenfalls protokollieren.
      await logSentMail({
        receiverMail: receiver,
        msg: message,
        senderFactoryId: SENDER_FACTORY_ID,
        senderName,
        status: 'failed',
        error: errMsg,
      });
      toast.error('Senden fehlgeschlagen', { description: errMsg });
      await loadMailLog();
    } finally {
      setSending(false);
    }
  };


  return (
    <Card className="bg-card border border-primary/20 shadow-lg shadow-primary/5 overflow-hidden">
      <CardHeader className="border-b border-primary/20">
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <div className="p-1.5 bg-primary/90 rounded-md shadow-md shadow-primary/10">
                <MessageSquare className="h-4 w-4 text-primary-foreground" />
              </div>
              <span className="text-black dark:text-white">V-NET</span>
            </CardTitle>
            <CardDescription className="mt-1">Eingebettete V-NET-Ansicht von State-V</CardDescription>
          </div>

          <Button className="gap-2" onClick={() => setMailOpen(true)}>
            <Mail className="h-4 w-4" />
            VNET-Mail senden
          </Button>

          <Dialog open={mailOpen} onOpenChange={setMailOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Mail className="h-5 w-5 text-primary" />
                  VNET-Mail senden
                </DialogTitle>
                <DialogDescription>
                  Sendet eine Nachricht über die State-V Embedded VAPI an eine
                  VNET-Mailadresse. (Premium-Endpunkt)
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5">
                    <Building2 className="h-3.5 w-3.5" />
                    Absender (Firma)
                  </Label>
                  <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm">
                    <span className="font-medium text-foreground">
                      {senderName || 'Firma wird geladen…'}
                    </span>
                    <span className="ml-auto font-mono text-[11px] text-muted-foreground">
                      {SENDER_FACTORY_ID}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Es wird ausschließlich im Namen dieser Firma gesendet. Der
                    Absender ergibt sich aus dem hinterlegten API-Key.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="vnet-receiver">Empfänger</Label>
                  <Input
                    id="vnet-receiver"
                    placeholder="name@statev.de"
                    value={receiverMail}
                    onChange={(e) => setReceiverMail(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="vnet-msg">Nachricht</Label>
                  <Textarea
                    id="vnet-msg"
                    placeholder="Nachrichtentext..."
                    rows={4}
                    value={mailMsg}
                    onChange={(e) => setMailMsg(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="vnet-key" className="flex items-center gap-1.5">
                    <KeyRound className="h-3.5 w-3.5" />
                    State-V API-Key
                  </Label>
                  <Input
                    id="vnet-key"
                    type="password"
                    placeholder="API-Key (wird lokal gespeichert)"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Die Embedded VAPI verlangt den Key clientseitig. Er wird nur
                    lokal in diesem Browser gespeichert.
                  </p>
                </div>

                {/* Verlauf (aus Supabase-KV) */}
                <div className="space-y-2 border-t border-border pt-4">
                  <div className="flex items-center justify-between">
                    <Label className="flex items-center gap-1.5">
                      <History className="h-3.5 w-3.5" />
                      Verlauf
                    </Label>
                    {logLoading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
                  </div>
                  {mailLog.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-2">
                      {logLoading ? 'Verlauf wird geladen…' : 'Noch keine gesendeten Mails.'}
                    </p>
                  ) : (
                    <div className="max-h-44 overflow-y-auto space-y-1.5 pr-1">
                      {mailLog.map((entry) => (
                        <div
                          key={entry.id}
                          className="flex items-start gap-2 rounded-lg border border-border bg-card/50 px-3 py-2 text-xs"
                        >
                          {entry.status === 'sent' ? (
                            <CheckCircle className="h-3.5 w-3.5 text-green-500 shrink-0 mt-0.5" />
                          ) : (
                            <XCircle className="h-3.5 w-3.5 text-destructive shrink-0 mt-0.5" />
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium truncate">{entry.receiverMail}</span>
                              <Badge
                                variant="outline"
                                className={
                                  entry.status === 'sent'
                                    ? 'border-green-500/40 text-green-500'
                                    : 'border-destructive/40 text-destructive'
                                }
                              >
                                {entry.status === 'sent' ? 'gesendet' : 'fehlgeschlagen'}
                              </Badge>
                            </div>
                            <p className="text-muted-foreground truncate">{entry.msg}</p>
                            <p className="text-[10px] text-muted-foreground/70">
                              {new Date(entry.createdAt).toLocaleString('de-DE')}
                              {entry.error ? ` • ${entry.error}` : ''}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setMailOpen(false)} disabled={sending}>
                  Abbrechen
                </Button>
                <Button onClick={handleSendMail} disabled={sending} className="gap-2">
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  Senden
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {/* Eingebettete V-NET-Ansicht von State-V (keine externe Seite). */}
        <iframe
          src={VNET_URL}
          title="V-NET"
          className="w-full h-[calc(100vh-13rem)] min-h-[520px] border-0 bg-background"
          allow="clipboard-read; clipboard-write; camera; microphone; fullscreen"
        />
      </CardContent>
    </Card>
  );
}
