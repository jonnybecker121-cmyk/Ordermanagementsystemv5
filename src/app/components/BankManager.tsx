import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  ArrowLeftRight,
  Plus,
  Trash2,
  Pencil,
  RefreshCw,
  Cloud,
  CloudOff,
} from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import {
  useBankStore,
  type BankAccount,
  type TransactionType,
} from '../store/bankStore';
import {
  statevApi,
  type BankAccount as StatevBankAccount,
  type Transaction as StatevTransaction,
} from '../services/statevApi';

interface BankManagerProps {
  syncTrigger?: number;
}

const fmtEUR = (n: number) =>
  new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
  }).format(n);

const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

export default function BankManager(_: BankManagerProps) {
  const {
    accounts,
    transactions,
    addAccount,
    updateAccount,
    deleteAccount,
    addTransaction,
    deleteTransaction,
    pullFromServer,
    syncStatus,
    syncError,
    lastSyncedAt,
  } = useBankStore();

  const didInitRef = useRef(false);
  useEffect(() => {
    if (didInitRef.current) return;
    didInitRef.current = true;
    pullFromServer();
  }, [pullFromServer]);

  // ─── StateV Live Bank ────────────────────────────────────────────────
  const [statevAccounts, setStatevAccounts] = useState<StatevBankAccount[]>([]);
  const [statevSelectedId, setStatevSelectedId] = useState<string | null>(null);
  const [statevTx, setStatevTx] = useState<StatevTransaction[]>([]);
  const [statevTotal, setStatevTotal] = useState(0);
  const [statevLoading, setStatevLoading] = useState(false);
  const [statevTxLoading, setStatevTxLoading] = useState(false);
  const [statevError, setStatevError] = useState<string | null>(null);
  const TX_LIMIT = 20;
  const [statevOffset, setStatevOffset] = useState(0);

  const loadStatevAccounts = async () => {
    setStatevLoading(true);
    setStatevError(null);
    try {
      const data = await statevApi.getFactoryBankAccounts();
      setStatevAccounts(data);
      if (data.length > 0 && !statevSelectedId) {
        setStatevSelectedId(data[0].id);
      }
    } catch (err: any) {
      const msg = String(err?.message || err);
      if (msg.includes('401') || msg.toLowerCase().includes('patreon')) {
        setStatevError('StateV Bank-Feature nicht verfügbar (Patreon erforderlich).');
      } else {
        setStatevError(`StateV-Fehler: ${msg}`);
      }
      setStatevAccounts([]);
    } finally {
      setStatevLoading(false);
    }
  };

  const loadStatevTransactions = async (bankId: string, off: number) => {
    setStatevTxLoading(true);
    try {
      const data = await statevApi.getTransactions(bankId, TX_LIMIT, off);
      setStatevTx(data.transactions ?? []);
      setStatevTotal(data.totalTransactions ?? 0);
      setStatevOffset(off);
    } catch (err: any) {
      setStatevTx([]);
      setStatevTotal(0);
    } finally {
      setStatevTxLoading(false);
    }
  };

  const didStatevInit = useRef(false);
  useEffect(() => {
    if (didStatevInit.current) return;
    didStatevInit.current = true;
    loadStatevAccounts();
  }, []);

  useEffect(() => {
    if (statevSelectedId) loadStatevTransactions(statevSelectedId, 0);
  }, [statevSelectedId]);

  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(
    accounts[0]?.id ?? null
  );
  const [accountDialogOpen, setAccountDialogOpen] = useState(false);
  const [accountDraft, setAccountDraft] = useState<BankAccount | null>(null);
  const [txDialogOpen, setTxDialogOpen] = useState(false);
  const [txDraft, setTxDraft] = useState({
    accountId: '',
    counterAccountId: '',
    type: 'incoming' as TransactionType,
    amount: '',
    reference: '',
    purpose: '',
  });

  const activeAccountId =
    selectedAccountId && accounts.some((a) => a.id === selectedAccountId)
      ? selectedAccountId
      : accounts[0]?.id ?? null;

  const totalBalance = useMemo(
    () => accounts.reduce((sum, a) => sum + a.balance, 0),
    [accounts]
  );

  const accountTransactions = useMemo(
    () =>
      transactions.filter(
        (t) =>
          t.accountId === activeAccountId ||
          t.counterAccountId === activeAccountId
      ),
    [transactions, activeAccountId]
  );

  const openNewAccount = () => {
    setAccountDraft({ id: '', name: '', vban: '', balance: 0, note: '' });
    setAccountDialogOpen(true);
  };

  const openEditAccount = (acc: BankAccount) => {
    setAccountDraft({ ...acc });
    setAccountDialogOpen(true);
  };

  const saveAccount = () => {
    if (!accountDraft) return;
    const { id, name, vban, balance, note } = accountDraft;
    if (!name.trim()) return;
    if (id) {
      updateAccount(id, { name, vban, balance, note });
    } else {
      const created = addAccount({ name, vban, balance, note });
      setSelectedAccountId(created.id);
    }
    setAccountDialogOpen(false);
    setAccountDraft(null);
  };

  const openNewTransaction = () => {
    if (!activeAccountId) return;
    setTxDraft({
      accountId: activeAccountId,
      counterAccountId: '',
      type: 'incoming',
      amount: '',
      reference: '',
      purpose: '',
    });
    setTxDialogOpen(true);
  };

  const saveTransaction = () => {
    const amt = parseFloat(txDraft.amount.replace(',', '.'));
    if (!txDraft.accountId || isNaN(amt) || amt <= 0) return;
    if (txDraft.type === 'transfer' && !txDraft.counterAccountId) return;

    addTransaction({
      accountId: txDraft.accountId,
      counterAccountId:
        txDraft.type === 'transfer' ? txDraft.counterAccountId : undefined,
      type: txDraft.type,
      amount: amt,
      reference: txDraft.reference.trim() || undefined,
      purpose: txDraft.purpose.trim() || undefined,
    });
    setTxDialogOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Bank</h1>
          <p className="text-muted-foreground">
            Lokale Bankkonten und Transaktionen
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div
            className={`flex items-center gap-1.5 px-2 py-1 rounded-md border text-[10px] uppercase tracking-widest ${
              syncStatus === 'error'
                ? 'border-destructive/40 text-destructive'
                : 'bg-muted/50 text-muted-foreground'
            }`}
            title={syncError ?? (lastSyncedAt ? new Date(lastSyncedAt).toLocaleString('de-DE') : 'nicht synchronisiert')}
          >
            {syncStatus === 'error' ? (
              <CloudOff className="h-3 w-3" />
            ) : syncStatus === 'idle' ? (
              <Cloud className="h-3 w-3" />
            ) : (
              <RefreshCw className="h-3 w-3 animate-spin" />
            )}
            {syncStatus === 'pulling'
              ? 'Lade'
              : syncStatus === 'pushing'
              ? 'Speichere'
              : syncStatus === 'error'
              ? 'Offline'
              : lastSyncedAt
              ? 'Synchronisiert'
              : 'Lokal'}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => pullFromServer()}
            disabled={syncStatus === 'pulling' || syncStatus === 'pushing'}
          >
            <RefreshCw
              className={`h-4 w-4 mr-2 ${
                syncStatus === 'pulling' ? 'animate-spin' : ''
              }`}
            />
            Aktualisieren
          </Button>
          <div className="px-3 py-2 rounded-md border bg-muted/50">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
              Gesamt-Saldo
            </div>
            <div className="font-mono font-bold text-primary">
              {fmtEUR(totalBalance)}
            </div>
          </div>
          <Button onClick={openNewAccount} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Neues Konto
          </Button>
        </div>
      </div>

      <div className="rounded-lg border bg-card">
        <div className="flex items-center justify-between p-4 border-b">
          <div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
              StateV Live
            </div>
            <div className="font-medium">
              Fabrik-Bankkonten · {statevAccounts.length}
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={loadStatevAccounts}
            disabled={statevLoading}
          >
            <RefreshCw
              className={`h-4 w-4 mr-2 ${statevLoading ? 'animate-spin' : ''}`}
            />
            Neu laden
          </Button>
        </div>

        {statevError ? (
          <div className="m-4 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-600">
            {statevError}
          </div>
        ) : statevAccounts.length === 0 && !statevLoading ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            Keine StateV-Bankkonten geladen.
          </div>
        ) : (
          <>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3 p-4">
              {statevAccounts.map((acc) => {
                const isActive = acc.id === statevSelectedId;
                return (
                  <div
                    key={acc.id}
                    onClick={() => setStatevSelectedId(acc.id)}
                    className={`cursor-pointer rounded-lg border p-3 transition-all ${
                      isActive
                        ? 'border-primary ring-1 ring-primary bg-primary/5'
                        : 'hover:border-primary/50 bg-muted/30'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="text-[10px] uppercase tracking-widest text-muted-foreground truncate">
                        {acc.note || 'Konto'}
                      </div>
                      <Wallet className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="font-mono text-xl font-bold">
                      {fmtEUR(acc.balance)}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground font-mono">
                      VBAN: {acc.vban}
                    </div>
                  </div>
                );
              })}
            </div>

            {statevSelectedId && (
              <div className="border-t">
                <div className="px-4 py-3 flex items-center justify-between">
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                    Transaktionen · {statevTotal}
                  </div>
                  {statevTotal > TX_LIMIT && (
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          loadStatevTransactions(
                            statevSelectedId!,
                            Math.max(0, statevOffset - TX_LIMIT)
                          )
                        }
                        disabled={statevOffset === 0 || statevTxLoading}
                      >
                        Zurück
                      </Button>
                      <span className="text-xs text-muted-foreground font-mono">
                        {statevOffset + 1}–
                        {Math.min(statevOffset + TX_LIMIT, statevTotal)} /{' '}
                        {statevTotal}
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          loadStatevTransactions(
                            statevSelectedId!,
                            statevOffset + TX_LIMIT
                          )
                        }
                        disabled={
                          statevOffset + TX_LIMIT >= statevTotal || statevTxLoading
                        }
                      >
                        Weiter
                      </Button>
                    </div>
                  )}
                </div>
                {statevTxLoading ? (
                  <div className="p-8 text-center">
                    <RefreshCw className="h-5 w-5 animate-spin inline text-muted-foreground" />
                  </div>
                ) : statevTx.length === 0 ? (
                  <div className="p-8 text-center text-sm text-muted-foreground">
                    Keine Transaktionen.
                  </div>
                ) : (
                  <div className="divide-y">
                    {statevTx.map((tx, i) => {
                      const isIncoming = tx.type === 'incoming';
                      return (
                        <div
                          key={`${tx.reference}-${i}`}
                          className="flex items-center justify-between px-4 py-2.5 bg-muted/50 hover:bg-muted transition-colors"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div
                              className={`p-1.5 rounded-full ${
                                isIncoming
                                  ? 'bg-green-500/10 text-green-500'
                                  : 'bg-red-500/10 text-red-500'
                              }`}
                            >
                              {isIncoming ? (
                                <TrendingUp className="h-3.5 w-3.5" />
                              ) : (
                                <TrendingDown className="h-3.5 w-3.5" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <div className="text-sm truncate">
                                {tx.purpose || tx.reference}
                              </div>
                              <div className="text-xs text-muted-foreground font-mono">
                                {fmtDateTime(
                                  typeof tx.timestamp === 'string'
                                    ? tx.timestamp
                                    : (tx.timestamp as Date).toISOString()
                                )}{' '}
                                ·{' '}
                                {isIncoming
                                  ? `Von ${tx.senderVban}`
                                  : `An ${tx.receiverVban}`}
                              </div>
                            </div>
                          </div>
                          <div
                            className={`font-mono font-bold ${
                              isIncoming ? 'text-green-500' : 'text-red-500'
                            }`}
                          >
                            {isIncoming ? '+' : '-'}
                            {fmtEUR(tx.amount)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {accounts.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center">
          <Wallet className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">
            Noch keine Bankkonten. Lege dein erstes Konto an.
          </p>
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {accounts.map((account) => {
              const isActive = account.id === activeAccountId;
              return (
                <div
                  key={account.id}
                  onClick={() => setSelectedAccountId(account.id)}
                  className={`group relative cursor-pointer rounded-lg border p-4 transition-all ${
                    isActive
                      ? 'border-primary ring-1 ring-primary bg-primary/5'
                      : 'hover:border-primary/50 bg-muted/30'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                      {account.name || 'Konto'}
                    </div>
                    <Wallet className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="font-mono text-2xl font-bold">
                    {fmtEUR(account.balance)}
                  </div>
                  <div className="mt-2 text-xs text-muted-foreground font-mono">
                    VBAN: {account.vban || '—'}
                  </div>
                  {account.note && (
                    <div className="mt-1 text-xs text-muted-foreground line-clamp-1">
                      {account.note}
                    </div>
                  )}
                  <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={(e) => {
                        e.stopPropagation();
                        openEditAccount(account);
                      }}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`Konto "${account.name}" wirklich löschen?`)) {
                          deleteAccount(account.id);
                                              }
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="rounded-lg border bg-card">
            <div className="flex items-center justify-between p-4 border-b">
              <div>
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                  Transaktionen
                </div>
                <div className="font-medium">
                  {accounts.find((a) => a.id === activeAccountId)?.name ??
                    'Konto wählen'}{' '}
                  · {accountTransactions.length}
                </div>
              </div>
              <Button
                size="sm"
                onClick={openNewTransaction}
                disabled={!activeAccountId}
              >
                <Plus className="h-4 w-4 mr-2" />
                Neue Buchung
              </Button>
            </div>

            {accountTransactions.length === 0 ? (
              <div className="p-10 text-center text-sm text-muted-foreground">
                Keine Buchungen auf diesem Konto.
              </div>
            ) : (
              <div className="divide-y">
                {accountTransactions.map((tx) => {
                  const isCounter =
                    tx.type === 'transfer' &&
                    tx.counterAccountId === activeAccountId;
                  const effectiveType: TransactionType = isCounter
                    ? 'incoming'
                    : tx.type === 'transfer'
                    ? 'outgoing'
                    : tx.type;
                  const isPositive = effectiveType === 'incoming';
                  return (
                    <div
                      key={tx.id}
                      className="flex items-center justify-between px-4 py-3 bg-muted/50 hover:bg-muted transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`p-2 rounded-full ${
                            isPositive
                              ? 'bg-green-500/10 text-green-500'
                              : 'bg-red-500/10 text-red-500'
                          }`}
                        >
                          {tx.type === 'transfer' ? (
                            <ArrowLeftRight className="h-4 w-4" />
                          ) : isPositive ? (
                            <TrendingUp className="h-4 w-4" />
                          ) : (
                            <TrendingDown className="h-4 w-4" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-medium truncate">
                            {tx.purpose ||
                              tx.reference ||
                              (tx.type === 'transfer'
                                ? 'Umbuchung'
                                : isPositive
                                ? 'Eingang'
                                : 'Ausgang')}
                          </div>
                          <div className="text-xs text-muted-foreground font-mono">
                            {fmtDateTime(tx.timestamp)}
                            {tx.reference && ` · ${tx.reference}`}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div
                          className={`font-mono font-bold text-right ${
                            isPositive ? 'text-green-500' : 'text-red-500'
                          }`}
                        >
                          {isPositive ? '+' : '-'}
                          {fmtEUR(tx.amount)}
                        </div>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          onClick={() => {
                            deleteTransaction(tx.id);
                                                  }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}

      <Dialog open={accountDialogOpen} onOpenChange={setAccountDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {accountDraft?.id ? 'Konto bearbeiten' : 'Neues Konto'}
            </DialogTitle>
            <DialogDescription>
              Lokale Bankkonten werden im Browser gespeichert.
            </DialogDescription>
          </DialogHeader>
          {accountDraft && (
            <div className="space-y-3">
              <div className="space-y-1">
                <Label className="text-[10px] uppercase tracking-widest">
                  Bezeichnung
                </Label>
                <Input
                  className="h-9"
                  value={accountDraft.name}
                  onChange={(e) =>
                    setAccountDraft({ ...accountDraft, name: e.target.value })
                  }
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] uppercase tracking-widest">
                  VBAN
                </Label>
                <Input
                  className="h-9 font-mono"
                  value={accountDraft.vban}
                  onChange={(e) =>
                    setAccountDraft({ ...accountDraft, vban: e.target.value })
                  }
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] uppercase tracking-widest">
                  Startsaldo
                </Label>
                <Input
                  className="h-9 font-mono"
                  type="number"
                  step="0.01"
                  value={accountDraft.balance}
                  onChange={(e) =>
                    setAccountDraft({
                      ...accountDraft,
                      balance: parseFloat(e.target.value) || 0,
                    })
                  }
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] uppercase tracking-widest">
                  Notiz
                </Label>
                <Input
                  className="h-9"
                  value={accountDraft.note ?? ''}
                  onChange={(e) =>
                    setAccountDraft({ ...accountDraft, note: e.target.value })
                  }
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setAccountDialogOpen(false)}>
              Abbrechen
            </Button>
            <Button onClick={saveAccount}>Speichern</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={txDialogOpen} onOpenChange={setTxDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Neue Buchung</DialogTitle>
            <DialogDescription>
              Eingang, Ausgang oder Umbuchung zwischen eigenen Konten.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-[10px] uppercase tracking-widest">
                Konto
              </Label>
              <Select
                value={txDraft.accountId}
                onValueChange={(v) =>
                  setTxDraft({ ...txDraft, accountId: v })
                }
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] uppercase tracking-widest">
                Typ
              </Label>
              <Select
                value={txDraft.type}
                onValueChange={(v) =>
                  setTxDraft({ ...txDraft, type: v as TransactionType })
                }
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="incoming">Eingang</SelectItem>
                  <SelectItem value="outgoing">Ausgang</SelectItem>
                  <SelectItem value="transfer">Umbuchung</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {txDraft.type === 'transfer' && (
              <div className="space-y-1">
                <Label className="text-[10px] uppercase tracking-widest">
                  Zielkonto
                </Label>
                <Select
                  value={txDraft.counterAccountId}
                  onValueChange={(v) =>
                    setTxDraft({ ...txDraft, counterAccountId: v })
                  }
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Zielkonto wählen" />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts
                      .filter((a) => a.id !== txDraft.accountId)
                      .map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1">
              <Label className="text-[10px] uppercase tracking-widest">
                Betrag (€)
              </Label>
              <Input
                className="h-9 font-mono"
                type="number"
                step="0.01"
                value={txDraft.amount}
                onChange={(e) =>
                  setTxDraft({ ...txDraft, amount: e.target.value })
                }
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] uppercase tracking-widest">
                Referenz
              </Label>
              <Input
                className="h-9 font-mono"
                value={txDraft.reference}
                onChange={(e) =>
                  setTxDraft({ ...txDraft, reference: e.target.value })
                }
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] uppercase tracking-widest">
                Verwendungszweck
              </Label>
              <Input
                className="h-9"
                value={txDraft.purpose}
                onChange={(e) =>
                  setTxDraft({ ...txDraft, purpose: e.target.value })
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTxDialogOpen(false)}>
              Abbrechen
            </Button>
            <Button onClick={saveTransaction}>Buchen</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
