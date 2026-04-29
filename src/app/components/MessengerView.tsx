import { ExternalLink, MessageSquare } from "lucide-react";

export default function MessengerView() {
  return (
    <div className="flex flex-col h-[calc(100vh-7rem)] gap-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-bold m-0">V-NET</h1>
          <span className="text-xs text-muted-foreground">vnet.statev.de</span>
        </div>
        <a
          href="https://vnet.statev.de/messenger"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          In neuem Tab öffnen
        </a>
      </div>
      <div className="flex-1 rounded-xl border border-border overflow-hidden bg-card">
        <iframe
          src="https://vnet.statev.de/messenger"
          title="V-NET"
          className="w-full h-full border-0"
          allow="clipboard-read; clipboard-write"
        />
      </div>
    </div>
  );
}
