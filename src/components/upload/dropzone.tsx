import { useCallback, useState } from "react";
import { motion } from "framer-motion";
import { UploadCloud, FileSpreadsheet, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { parseCsvFile } from "@/lib/csv/parser";
import { useDatasetStore } from "@/store/dataset-store";
import { cn } from "@/lib/utils";
import { useNavigate } from "@tanstack/react-router";

const MAX_BYTES = 100 * 1024 * 1024;

interface DropzoneProps {
  className?: string;
  redirectTo?: string;
}

export function Dropzone({ className, redirectTo = "/preview" }: DropzoneProps) {
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const setActive = useDatasetStore((s) => s.setActive);
  const navigate = useNavigate();

  const handleFile = useCallback(
    async (file: File) => {
      if (!/\.csv$/i.test(file.name)) {
        toast.error("Only .csv files are supported.");
        return;
      }
      if (file.size > MAX_BYTES) {
        toast.error("File exceeds 100 MB limit.");
        return;
      }
      setLoading(true);
      try {
        const { dataset, errors } = await parseCsvFile(file);
        setActive(dataset);
        if (errors.length) toast.warning(`${errors.length} parser warning(s)`);
        toast.success(`Loaded ${dataset.rows.length.toLocaleString()} rows`);
        navigate({ to: redirectTo });
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to parse CSV.");
      } finally {
        setLoading(false);
      }
    },
    [setActive, navigate, redirectTo],
  );

  return (
    <label
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        const file = e.dataTransfer.files?.[0];
        if (file) void handleFile(file);
      }}
      className={cn(
        "group relative flex flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed p-10 text-center transition-all cursor-pointer glass",
        dragging
          ? "border-primary bg-primary/5 shadow-glow"
          : "border-border hover:border-primary/60 hover:shadow-soft",
        className,
      )}
    >
      <input
        type="file"
        accept=".csv,text/csv"
        className="sr-only"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleFile(f);
          e.target.value = "";
        }}
        disabled={loading}
      />
      <motion.div
        animate={{ y: dragging ? -6 : 0 }}
        transition={{ type: "spring", stiffness: 260, damping: 20 }}
        className="flex h-16 w-16 items-center justify-center rounded-2xl gradient-primary text-primary-foreground shadow-glow"
      >
        {loading ? (
          <Loader2 className="h-7 w-7 animate-spin" />
        ) : (
          <UploadCloud className="h-7 w-7" />
        )}
      </motion.div>
      <div>
        <p className="text-lg font-semibold">
          {loading ? "Parsing your CSV…" : "Drop a CSV file to analyze"}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          or click to browse — up to 100 MB, parsed entirely in your browser
        </p>
      </div>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <FileSpreadsheet className="h-4 w-4" />
        <span>.csv · UTF-8 · headers on first row</span>
      </div>
    </label>
  );
}
