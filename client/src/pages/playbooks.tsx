import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, BookOpen, Pencil, Trash2, CheckCircle2, XCircle } from "lucide-react";
import { computeKPIs } from "@/lib/stats";
import { formatCurrency, formatR, parseTags, stringifyTags } from "@/lib/format";
import type { Playbook, Trade } from "@shared/schema";

interface PlaybookForm {
  id?: number;
  name: string;
  description: string;
  rulesText: string;
  checklistText: string;
}

const emptyForm: PlaybookForm = {
  name: "",
  description: "",
  rulesText: "",
  checklistText: "",
};

export default function PlaybooksPage() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<PlaybookForm>(emptyForm);

  const { data: playbooks = [], isLoading } = useQuery<Playbook[]>({
    queryKey: ["/api/playbooks"],
  });

  const { data: trades = [] } = useQuery<Trade[]>({
    queryKey: ["/api/trades"],
  });

  const saveMutation = useMutation({
    mutationFn: async (payload: PlaybookForm) => {
      const body = {
        name: payload.name,
        description: payload.description || null,
        rules: stringifyTags(payload.rulesText.split("\n").map((s) => s.trim()).filter(Boolean)),
        checklist: stringifyTags(payload.checklistText.split("\n").map((s) => s.trim()).filter(Boolean)),
      };
      if (payload.id) {
        return apiRequest("PATCH", `/api/playbooks/${payload.id}`, body);
      }
      return apiRequest("POST", "/api/playbooks", body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/playbooks"] });
      setOpen(false);
      setForm(emptyForm);
      toast({ title: form.id ? "Playbook updated" : "Playbook created" });
    },
    onError: (err: any) => {
      toast({ title: "Failed to save", description: err?.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/playbooks/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/playbooks"] });
      toast({ title: "Playbook deleted" });
    },
  });

  function openNew() {
    setForm(emptyForm);
    setOpen(true);
  }

  function openEdit(pb: Playbook) {
    setForm({
      id: pb.id,
      name: pb.name,
      description: pb.description || "",
      rulesText: parseTags(pb.rules).join("\n"),
      checklistText: parseTags(pb.checklist).join("\n"),
    });
    setOpen(true);
  }

  function statsFor(playbookName: string) {
    const pbTrades = trades.filter((t) => {
      const setups = parseTags(t.setupTags);
      return setups.includes(playbookName) || t.notes?.toLowerCase().includes(playbookName.toLowerCase());
    });
    const kpis = computeKPIs(pbTrades);
    return { count: pbTrades.length, ...kpis };
  }

  if (isLoading) {
    return <div className="p-6 text-muted-foreground">Loading playbooks...</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            Playbooks
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Define your A+ setups, rules and execution checklist. Track which playbooks make money.
          </p>
        </div>
        <Button onClick={openNew} data-testid="button-new-playbook">
          <Plus className="h-4 w-4 mr-2" />
          New Playbook
        </Button>
      </div>

      {playbooks.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <BookOpen className="h-12 w-12 mx-auto text-muted-foreground/40 mb-4" />
            <p className="text-muted-foreground">No playbooks yet. Create your first setup to start tracking discipline.</p>
            <Button onClick={openNew} className="mt-4">
              <Plus className="h-4 w-4 mr-2" />
              Create Playbook
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {playbooks.map((pb) => {
            const rules = parseTags(pb.rules);
            const checklist = parseTags(pb.checklist);
            const stats = statsFor(pb.name);
            return (
              <Card key={pb.id} data-testid={`card-playbook-${pb.id}`}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <CardTitle className="text-base">{pb.name}</CardTitle>
                      {pb.description && (
                        <CardDescription className="mt-1">{pb.description}</CardDescription>
                      )}
                    </div>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" onClick={() => openEdit(pb)} data-testid={`button-edit-${pb.id}`}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          if (confirm(`Delete playbook "${pb.name}"?`)) {
                            deleteMutation.mutate(pb.id);
                          }
                        }}
                        data-testid={`button-delete-${pb.id}`}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Per-playbook stats */}
                  <div className="grid grid-cols-4 gap-2 p-3 rounded-md bg-muted/40">
                    <div>
                      <div className="text-[10px] uppercase text-muted-foreground">Trades</div>
                      <div className="text-sm font-semibold font-mono-num">{stats.count}</div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase text-muted-foreground">Win %</div>
                      <div className="text-sm font-semibold font-mono-num">{stats.winRate.toFixed(0)}%</div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase text-muted-foreground">Net</div>
                      <div className={`text-sm font-semibold font-mono-num ${stats.netPnl >= 0 ? "pnl-positive" : "pnl-negative"}`}>
                        {formatCurrency(stats.netPnl)}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase text-muted-foreground">Expectancy</div>
                      <div className="text-sm font-semibold font-mono-num">{formatR(stats.expectancy)}</div>
                    </div>
                  </div>

                  {rules.length > 0 && (
                    <div>
                      <div className="text-xs font-medium text-muted-foreground uppercase mb-2 flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        Entry Rules
                      </div>
                      <ul className="space-y-1">
                        {rules.map((r, i) => (
                          <li key={i} className="text-sm flex gap-2">
                            <span className="text-primary mt-0.5">›</span>
                            <span>{r}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {checklist.length > 0 && (
                    <div>
                      <div className="text-xs font-medium text-muted-foreground uppercase mb-2 flex items-center gap-1">
                        <XCircle className="h-3 w-3" />
                        Pre-Entry Checklist
                      </div>
                      <ul className="space-y-1">
                        {checklist.map((c, i) => (
                          <li key={i} className="text-sm flex gap-2">
                            <input type="checkbox" disabled className="mt-1" />
                            <span>{c}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{form.id ? "Edit Playbook" : "New Playbook"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Name</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. VWAP Reclaim Long"
                data-testid="input-playbook-name"
              />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="When this setup applies, what's the thesis..."
                rows={2}
              />
            </div>
            <div>
              <Label>Entry Rules (one per line)</Label>
              <Textarea
                value={form.rulesText}
                onChange={(e) => setForm({ ...form, rulesText: e.target.value })}
                placeholder="Within 9:30-10:15 ET window&#10;Price reclaims VWAP after a sweep&#10;Volume confirms the reclaim&#10;Stop below the swept low"
                rows={6}
              />
            </div>
            <div>
              <Label>Pre-Entry Checklist (one per line)</Label>
              <Textarea
                value={form.checklistText}
                onChange={(e) => setForm({ ...form, checklistText: e.target.value })}
                placeholder="HTF bias is bullish&#10;Risk is &lt;= account RPT%&#10;Stop is at clear invalidation&#10;4/4 confirmation present"
                rows={5}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => saveMutation.mutate(form)}
              disabled={!form.name.trim() || saveMutation.isPending}
              data-testid="button-save-playbook"
            >
              {form.id ? "Save Changes" : "Create Playbook"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
