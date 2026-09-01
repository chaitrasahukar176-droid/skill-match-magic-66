import { useRef, useState } from "react";
import { motion } from "motion/react";
import { Loader2, UploadCloud } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { createCandidate, processCandidate } from "@/lib/candidates.functions";

const MAX_BYTES = 5 * 1024 * 1024;
const ACCEPTED = [".pdf", ".docx"];

export function ResumeDropzone({ jobId, onDone }: { jobId: string; onDone: () => void | Promise<void> }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [total, setTotal] = useState(0);
  const [done, setDone] = useState(0);
  const [current, setCurrent] = useState<string | null>(null);

  const busy = total > 0;

  const upload = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList).filter((file) => {
      const name = file.name.toLowerCase();
      if (!ACCEPTED.some((ext) => name.endsWith(ext))) {
        toast.error(`${file.name}: only PDF and DOCX resumes are supported.`);
        return false;
      }
      if (file.size > MAX_BYTES) {
        toast.error(`${file.name} is larger than 5MB.`);
        return false;
      }
      return true;
    });
    if (files.length === 0) return;

    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) {
      toast.error("Your session expired — please sign in again.");
      return;
    }

    setTotal(files.length);
    setDone(0);

    // Sequential: keeps AI gateway usage bounded and gives clear per-file errors.
    for (const file of files) {
      setCurrent(file.name);
      try {
        const path = `${userId}/${jobId}/${crypto.randomUUID()}-${file.name.replace(/[^\w.\-]+/g, "_")}`;
        const { error: uploadError } = await supabase.storage
          .from("resumes")
          .upload(path, file, { contentType: file.type || undefined, upsert: false });
        if (uploadError) throw new Error(uploadError.message);

        const { id } = await createCandidate({ data: { jobId, filePath: path, fileName: file.name } });
        const result = await processCandidate({ data: { candidateId: id } });
        if (!result.ok) toast.error(`${file.name}: ${result.error}`);
      } catch (error) {
        toast.error(`${file.name}: ${error instanceof Error ? error.message : "upload failed"}`);
      } finally {
        setDone((value) => value + 1);
        await onDone();
      }
    }

    setCurrent(null);
    setTotal(0);
    setDone(0);
    toast.success(`Screened ${files.length} resume${files.length === 1 ? "" : "s"}`);
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        void upload(event.dataTransfer.files);
      }}
      className={`card-surface flex flex-col items-center gap-3 border-dashed p-8 text-center transition-colors ${
        dragging ? "border-primary bg-primary/5" : ""
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        accept=".pdf,.docx"
        className="hidden"
        onChange={(event) => void upload(event.target.files)}
      />
      {busy ? (
        <div className="w-full max-w-sm space-y-3">
          <div className="flex items-center justify-center gap-2 text-sm font-medium">
            <Loader2 className="size-4 animate-spin text-primary" />
            Screening {done + 1} of {total}
          </div>
          <Progress value={(done / total) * 100} />
          <p className="truncate text-xs text-muted-foreground">{current}</p>
        </div>
      ) : (
        <>
          <UploadCloud className="size-8 text-primary" />
          <div>
            <p className="text-sm font-medium">Drop resumes here</p>
            <p className="text-xs text-muted-foreground">PDF or DOCX, up to 5MB each. Bulk upload supported.</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
            Choose files
          </Button>
        </>
      )}
    </motion.div>
  );
}
