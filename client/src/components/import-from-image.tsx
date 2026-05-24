// ===== Import From Image — modal =====
// Tesseract OCR + broker-specific parsers, then a preview table where the user
// can edit every field before bulk-saving via POST /api/trades.

import { useState, useCallback, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Image as ImageIcon, Upload, X, Trash2, Loader2 } from "lucide-react";
import { runOcr } from "@/lib/ocr/ocr";
import { normalize } from "@/lib/ocr/utils";
import { parseText } from "@/lib/ocr/parsers";
import type { ExtractedTrade, BrokerKey } from "@/lib/ocr/types";

type Stage = "idle" | "ocr" | "preview" | "saving";

interface EditableTrade extends ExtractedTrade {
  _id: number;       // local id for React keys
  _selected: boolean;
}

let nextId = 1;

export function ImportFromImageButton() {
  const [open, setOpen] = useState(false);
  const [stage, setStage] = useState<Stage>("idle");
  const [progress, setProgress] = useState(0);
  const [files, setFiles] = useState<File[]>([]);
  const [extracted, setExtracted] = useState<EditableTrade[]>([]);
  const [brokerLabel, setBrokerLabel] = useState<string>("");
  const [rawText, setRawText] = useState<string>("");
  const [showRaw, setShowRaw] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const reset = () => {
    setStage("idle");
    setProgress(0);
    setFiles([]);
    setExtracted([]);
    setBrokerLabel("");
    setRawText("");
    setShowRaw(false);
  };

  const handleFiles = useCallback(async (newFiles: File[]) => {
    const images = newFiles.filter(f => f.type.startsWith("image/"));
    if (images.length === 0) {
      toast({ title: "No images", description: "Please drop image files." });
      return;
    }
    setFiles(images);
    setStage("ocr");
    setProgress(5);

    const allTrades: EditableTrade[] = [];
    const allRaw: string[] = [];
    let lastBrokerLabel = "";

    for (let i = 0; i < images.length; i++) {
      const fileProgressBase = (i / images.length) * 100;
      try {
        const text = await runOcr(images[i], (pct) => {
          setProgress(Math.round(fileProgressBase + pct / images.length));
        });
        const norm = normalize(text);
        const result = parseText(norm);
        lastBrokerLabel = result.brokerLabel;
        allRaw.push(`=== ${images[i].name} (${result.brokerLabel}) ===\n${norm}`);
        for (const t of result.trades) {
          allTrades.push({ ...t, _id: nextId++, _selected: true });
        }
      } catch (err) {
        console.error("OCR failed for", images[i].name, err);
        toast({ title: "OCR error", description: `Failed to read ${images[i].name}` });
      }
    }

    setExtracted(allTrades);
    setRawText(allRaw.join("\n\n"));
    setBrokerLabel(lastBrokerLabel);
    setStage("preview");
    setProgress(100);

    if (allTrades.length === 0) {
      toast({
        title: "No trades found",
        description: "Try a clearer screenshot, or use the raw text view below to add manually.",
      });
    }
  }, [toast]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const dropped = Array.from(e.dataTransfer.files);
    handleFiles(dropped);
  }, [handleFiles]);

  const onPaste = useCallback((e: React.ClipboardEvent) => {
    const items = Array.from(e.clipboardData.items);
    const imgs = items
      .filter(i => i.type.startsWith("image/"))
      .map(i => i.getAsFile())
      .filter((f): f is File => f != null);
    if (imgs.length) handleFiles(imgs);
  }, [handleFiles]);

  const updateField = (id: number, field: keyof ExtractedTrade, value: any) => {
    setExtracted(prev => prev.map(t =>
      t._id === id ? { ...t, [field]: value } : t
    ));
  };

  const removeRow = (id: number) => {
    setExtracted(prev => prev.filter(t => t._id !== id));
  };

  const importMutation = useMutation({
    mutationFn: async (trades: EditableTrade[]) => {
      const today = new Date().toISOString().slice(0, 10);
      let imported = 0;
      let failed = 0;

      for (const t of trades) {
        try {
          // Sensible defaults — user can refine after
          const date = t.date || today;
          const timeEntry = t.timeEntry || "09:30";
          const timeExit = t.timeExit ?? null;
          const symbol = t.symbol || "NAS100";
          const direction = t.direction || "long";
          const entryPrice = t.entryPrice ?? 0;
          const exitPrice = t.exitPrice ?? null;
          const quantity = t.quantity ?? 1;
          const netPnl = t.netPnl ?? 0;

          // We don't know the stop — set it 0.5% away from entry as placeholder
          // (user gets a non-zero R-multiple; they can refine in trade detail page)
          const stopOffset = Math.max(Math.abs(entryPrice) * 0.005, 1);
          const stopPrice = direction === "long" ? entryPrice - stopOffset : entryPrice + stopOffset;

          await apiRequest("POST", "/api/trades", {
            date,
            timeEntry,
            timeExit,
            symbol,
            direction,
            status: exitPrice != null || netPnl !== 0 ? "closed" : "open",
            entryPrice,
            exitPrice,
            stopPrice,
            quantity,
            pointValue: 1,                 // CFD/cash default; user can adjust per-trade
            feesTotal: 0,
            setupTags: "[]",
            mistakeTags: "[]",
            emotionTags: "[]",
            notes: t.notes ?? `Imported from ${t.source}`,
          });
          imported++;
        } catch (err) {
          failed++;
          console.error("Import failed for", t, err);
        }
      }
      return { imported, failed };
    },
    onSuccess: ({ imported, failed }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/trades"] });
      toast({
        title: `Imported ${imported} trade${imported === 1 ? "" : "s"}`,
        description: failed > 0 ? `${failed} failed — check console.` : "Edit individual trades to set stops, tags, and screenshots.",
      });
      setOpen(false);
      reset();
    },
    onError: (err) => {
      toast({ title: "Import error", description: String(err) });
    },
  });

  const selected = extracted.filter(t => t._selected);

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <DialogTrigger asChild>
        <Button variant="outline" data-testid="btn-import-image">
          <ImageIcon className="w-4 h-4 mr-1" /> Import from image
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto" onPaste={onPaste}>
        <DialogHeader>
          <DialogTitle>Import trades from broker screenshot</DialogTitle>
        </DialogHeader>

        {stage === "idle" && (
          <div
            onDrop={onDrop}
            onDragOver={(e) => e.preventDefault()}
            onClick={() => inputRef.current?.click()}
            className="border-2 border-dashed border-muted-foreground/30 rounded-lg p-10 text-center cursor-pointer hover:border-muted-foreground/60 transition"
            data-testid="dropzone"
          >
            <Upload className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
            <p className="font-medium">Drop screenshots here</p>
            <p className="text-sm text-muted-foreground mt-1">
              or click to upload · or paste with <kbd className="text-xs px-1.5 py-0.5 bg-muted rounded">Ctrl+V</kbd>
            </p>
            <p className="text-xs text-muted-foreground mt-3">
              Supports XTB (desktop + mobile), MetaTrader 5, TopstepX, Tradovate. Multiple images at once.
            </p>
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={(e) => e.target.files && handleFiles(Array.from(e.target.files))}
            />
          </div>
        )}

        {stage === "ocr" && (
          <div className="py-10 text-center space-y-4">
            <Loader2 className="w-10 h-10 mx-auto animate-spin text-primary" />
            <div>
              <p className="font-medium">Reading {files.length} screenshot{files.length === 1 ? "" : "s"}...</p>
              <p className="text-sm text-muted-foreground">This runs locally in your browser — no upload, no AI.</p>
            </div>
            <Progress value={progress} className="max-w-md mx-auto" />
            <p className="text-xs text-muted-foreground">{progress}%</p>
          </div>
        )}

        {stage === "preview" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="text-sm">
                <span className="text-muted-foreground">Detected broker: </span>
                <Badge variant="secondary">{brokerLabel || "Generic"}</Badge>
                <span className="ml-3 text-muted-foreground">Found </span>
                <span className="font-medium">{extracted.length}</span>
                <span className="text-muted-foreground"> trade{extracted.length === 1 ? "" : "s"} · </span>
                <span className="font-medium">{selected.length}</span>
                <span className="text-muted-foreground"> selected</span>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setShowRaw(s => !s)}>
                {showRaw ? "Hide" : "Show"} raw OCR text
              </Button>
            </div>

            {showRaw && (
              <pre className="text-xs bg-muted p-3 rounded max-h-40 overflow-auto whitespace-pre-wrap">
                {rawText}
              </pre>
            )}

            {extracted.length === 0 && (
              <div className="border rounded-md p-6 text-center text-sm text-muted-foreground">
                No trades detected. Try a clearer screenshot — the OCR works best with text that&apos;s sharp and well-lit.
              </div>
            )}

            {extracted.length > 0 && (
              <div className="border rounded-md overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8"></TableHead>
                      <TableHead className="w-28">Date</TableHead>
                      <TableHead className="w-20">Time</TableHead>
                      <TableHead className="w-28">Symbol</TableHead>
                      <TableHead className="w-24">Side</TableHead>
                      <TableHead className="w-28 text-right">Entry</TableHead>
                      <TableHead className="w-28 text-right">Exit</TableHead>
                      <TableHead className="w-20 text-right">Qty</TableHead>
                      <TableHead className="w-28 text-right">P&L ($)</TableHead>
                      <TableHead className="w-16 text-center">Conf.</TableHead>
                      <TableHead className="w-8"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {extracted.map(t => {
                      const confColor =
                        t.confidence >= 0.7 ? "bg-emerald-500/15 text-emerald-600" :
                        t.confidence >= 0.4 ? "bg-amber-500/15 text-amber-600" :
                                              "bg-rose-500/15 text-rose-600";
                      const lowConf = (val: any) =>
                        val == null || val === "" ? "border-amber-500/60 bg-amber-500/5" : "";
                      return (
                        <TableRow key={t._id} className={!t._selected ? "opacity-40" : ""}>
                          <TableCell>
                            <input
                              type="checkbox"
                              checked={t._selected}
                              onChange={e => updateField(t._id, "_selected" as any, e.target.checked)}
                              data-testid={`select-${t._id}`}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="date"
                              value={t.date ?? ""}
                              onChange={e => updateField(t._id, "date", e.target.value)}
                              className={`h-8 text-xs font-mono-num ${lowConf(t.date)}`}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="time"
                              value={t.timeEntry ?? ""}
                              onChange={e => updateField(t._id, "timeEntry", e.target.value)}
                              className={`h-8 text-xs font-mono-num ${lowConf(t.timeEntry)}`}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              value={t.symbol ?? ""}
                              onChange={e => updateField(t._id, "symbol", e.target.value.toUpperCase())}
                              className={`h-8 text-xs ${lowConf(t.symbol)}`}
                            />
                          </TableCell>
                          <TableCell>
                            <Select
                              value={t.direction ?? "long"}
                              onValueChange={v => updateField(t._id, "direction", v)}
                            >
                              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="long">Long</SelectItem>
                                <SelectItem value="short">Short</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              step="any"
                              value={t.entryPrice ?? ""}
                              onChange={e => updateField(t._id, "entryPrice", e.target.value === "" ? undefined : parseFloat(e.target.value))}
                              className={`h-8 text-xs text-right font-mono-num ${lowConf(t.entryPrice)}`}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              step="any"
                              value={t.exitPrice ?? ""}
                              onChange={e => updateField(t._id, "exitPrice", e.target.value === "" ? undefined : parseFloat(e.target.value))}
                              className={`h-8 text-xs text-right font-mono-num ${lowConf(t.exitPrice)}`}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              step="any"
                              value={t.quantity ?? ""}
                              onChange={e => updateField(t._id, "quantity", e.target.value === "" ? undefined : parseFloat(e.target.value))}
                              className={`h-8 text-xs text-right font-mono-num ${lowConf(t.quantity)}`}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              step="any"
                              value={t.netPnl ?? ""}
                              onChange={e => updateField(t._id, "netPnl", e.target.value === "" ? undefined : parseFloat(e.target.value))}
                              className={`h-8 text-xs text-right font-mono-num ${lowConf(t.netPnl)}`}
                            />
                          </TableCell>
                          <TableCell className="text-center">
                            <span className={`text-[10px] px-1.5 py-0.5 rounded ${confColor}`}>
                              {Math.round(t.confidence * 100)}%
                            </span>
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => removeRow(t._id)}
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}

            <div className="text-xs text-muted-foreground border-t pt-3">
              Yellow fields are missing/uncertain — fill them in or leave for sensible defaults. After import, open
              each trade to set stop price (needed for accurate R-multiples), tags, and screenshots.
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          {stage === "preview" && (
            <>
              <Button variant="outline" onClick={reset}>
                <X className="w-4 h-4 mr-1" /> Start over
              </Button>
              <Button
                onClick={() => { setStage("saving"); importMutation.mutate(selected); }}
                disabled={selected.length === 0 || importMutation.isPending}
                data-testid="btn-confirm-import"
              >
                {importMutation.isPending && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
                Import {selected.length} trade{selected.length === 1 ? "" : "s"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
