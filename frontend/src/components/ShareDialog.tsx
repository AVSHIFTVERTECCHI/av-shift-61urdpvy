import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Copy, Download, ImageIcon, MessageCircle } from "lucide-react";
import { availabilityImage, availabilityText } from "@/lib/availability";
import type { DayInfo } from "@/lib/availability";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  month: string;
  days: DayInfo[];
  name: string;
}

export default function ShareDialog({ open, onOpenChange, month, days, name }: Props) {
  const [showBusy, setShowBusy] = useState(false);
  const [showOptions, setShowOptions] = useState(true);
  const opts = { name, showBusy, showOptions };
  const text = useMemo(() => availabilityText(month, days, opts), [month, days, name, showBusy, showOptions]); // eslint-disable-line react-hooks/exhaustive-deps
  const [busyImg, setBusyImg] = useState(false);

  const sendWhatsApp = () => {
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener");
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Testo copiato");
    } catch {
      toast.error("Copia non riuscita");
    }
  };
  const image = async (mode: "share" | "download") => {
    setBusyImg(true);
    try {
      const blob = await availabilityImage(month, days, opts);
      const file = new File([blob], `disponibilita-${month}.png`, { type: "image/png" });
      if (mode === "share" && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], text });
        return;
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = file.name;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(mode === "share" ? "Immagine scaricata: allegala su WhatsApp" : "Immagine scaricata");
    } catch (e) {
      if ((e as Error).name !== "AbortError") toast.error("Impossibile creare l'immagine");
    } finally {
      setBusyImg(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg" data-testid="share-dialog">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl">Condividi disponibilità</DialogTitle>
          <DialogDescription>Invia ai service i giorni in cui sei libero, come testo o come immagine.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap gap-x-5 gap-y-2">
          <Label className="flex items-center gap-2 text-sm">
            <Checkbox checked={showOptions} onCheckedChange={(v) => setShowOptions(v === true)} data-testid="share-show-options" />
            Mostra giorni in opzione
          </Label>
          <Label className="flex items-center gap-2 text-sm">
            <Checkbox checked={showBusy} onCheckedChange={(v) => setShowBusy(v === true)} data-testid="share-show-busy" />
            Mostra giorni occupati
          </Label>
        </div>

        <pre
          className="whitespace-pre-wrap rounded-xl border border-[#1F5F4A] bg-[#0B2A22] p-4 font-sans text-sm leading-relaxed text-[#E7FFF5]"
          data-testid="share-text-preview"
        >
          {text}
        </pre>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Button onClick={sendWhatsApp} className="h-11 bg-[#25D366] font-semibold text-[#062E16] hover:bg-[#1EBE5A]" data-testid="share-whatsapp-text-button">
            <MessageCircle aria-hidden="true" /> Invia testo su WhatsApp
          </Button>
          <Button onClick={() => image("share")} disabled={busyImg} className="h-11 font-semibold" data-testid="share-image-button">
            <ImageIcon aria-hidden="true" /> {busyImg ? "Creazione…" : "Condividi immagine"}
          </Button>
          <Button variant="outline" onClick={copy} className="h-10" data-testid="share-copy-button">
            <Copy aria-hidden="true" /> Copia testo
          </Button>
          <Button variant="outline" onClick={() => image("download")} disabled={busyImg} className="h-10" data-testid="share-download-image-button">
            <Download aria-hidden="true" /> Scarica immagine
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Dal telefono, "Condividi immagine" apre direttamente WhatsApp. Dal computer l'immagine viene scaricata.
        </p>
      </DialogContent>
    </Dialog>
  );
}
