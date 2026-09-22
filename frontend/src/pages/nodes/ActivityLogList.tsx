import { Download, FileText, Paperclip, Trash2, Upload } from "lucide-react";
import * as React from "react";

import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/useToast";
import { getErrorMessage } from "@/services/api";
import { activitiesService } from "@/services/activities.service";
import type { ActivityLog } from "@/types";
import { ALLOWED_UPLOAD_EXTENSIONS, MAX_UPLOAD_MB } from "@/utils/constants";
import { formatDateTime, formatFileSize } from "@/utils/format";
import { validateUploadFile } from "@/utils/validation";

interface Props {
  activityId: number;
  logs: ActivityLog[];
  canModify: boolean;
  onChanged: () => void;
}

/** Evidence files attached to one activity: upload, download and delete. */
export function ActivityLogList({ activityId, logs, canModify, onChanged }: Props) {
  const toast = useToast();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = React.useState(false);
  const [progress, setProgress] = React.useState(0);
  const [deleting, setDeleting] = React.useState<ActivityLog | null>(null);

  const pickFile = () => inputRef.current?.click();

  const handleFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = ""; // allow re-picking the same file
    if (!file) return;

    const problem = validateUploadFile(file);
    if (problem) {
      toast.error("File rejected", problem);
      return;
    }

    setUploading(true);
    setProgress(0);
    try {
      await activitiesService.uploadLog(activityId, file, setProgress);
      toast.success("Log uploaded", `${file.name} is attached to this activity.`);
      onChanged();
    } catch (cause) {
      toast.error("Upload failed", getErrorMessage(cause));
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  const download = async (log: ActivityLog) => {
    try {
      await activitiesService.downloadLog(log.id, log.file_name);
    } catch (cause) {
      toast.error("Download failed", getErrorMessage(cause));
    }
  };

  const remove = async () => {
    if (!deleting) return;
    try {
      await activitiesService.deleteLog(deleting.id);
      toast.success("Log deleted", `${deleting.file_name} has been removed.`);
      setDeleting(null);
      onChanged();
    } catch (cause) {
      toast.error("Could not delete the log", getErrorMessage(cause));
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-sm font-medium">
          <Paperclip className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          Activity logs
          <span className="text-muted-foreground">({logs.length})</span>
        </p>

        {canModify ? (
          <>
            <input
              ref={inputRef}
              type="file"
              className="sr-only"
              accept={ALLOWED_UPLOAD_EXTENSIONS.join(",")}
              onChange={handleFile}
              aria-label="Upload an activity log"
            />
            <Button variant="outline" size="sm" onClick={pickFile} loading={uploading}>
              <Upload className="h-4 w-4" />
              {uploading ? `Uploading ${progress}%` : "Upload log"}
            </Button>
          </>
        ) : null}
      </div>

      {uploading ? (
        <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      ) : null}

      {logs.length === 0 ? (
        <p className="rounded-md border border-dashed border-border px-3 py-4 text-sm text-muted-foreground">
          No logs yet. An activity cannot be marked <strong>Completed</strong> until at least one
          log is uploaded. Accepted types: {ALLOWED_UPLOAD_EXTENSIONS.join(", ")} (max{" "}
          {MAX_UPLOAD_MB} MB).
        </p>
      ) : (
        <ul className="divide-y divide-border rounded-md border border-border">
          {logs.map((log) => (
            <li key={log.id} className="flex items-center gap-3 px-3 py-2">
              <FileText className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{log.file_name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {formatFileSize(log.file_size)} · {log.uploader?.name ?? "Unknown"} ·{" "}
                  {formatDateTime(log.uploaded_at)}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => download(log)}
                aria-label={`Download ${log.file_name}`}
              >
                <Download className="h-4 w-4" />
              </Button>
              {canModify ? (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setDeleting(log)}
                  aria-label={`Delete ${log.file_name}`}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(value) => (value ? undefined : setDeleting(null))}
        title={`Delete ${deleting?.file_name}?`}
        description="The file is removed from storage permanently. A completed activity must keep at least one log."
        confirmLabel="Delete log"
        destructive
        onConfirm={remove}
      />
    </div>
  );
}
