"use client";

import { useCallback, useRef, useState } from "react";

const ACCEPTED_EXTENSIONS = [".txt", ".md"];

function isAccepted(file: File): boolean {
  const lower = file.name.toLowerCase();
  return ACCEPTED_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

export type UploadedFile = {
  name: string;
  bytes: number;
};

export interface FileUploadProps {
  onUpload: (files: File[]) => Promise<void> | void;
  uploading?: boolean;
  uploadedFiles?: UploadedFile[];
}

export function FileUpload({
  onUpload,
  uploading = false,
  uploadedFiles = [],
}: FileUploadProps) {
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const handleFiles = useCallback(
    async (fileList: FileList | File[]) => {
      const files = Array.from(fileList).filter(isAccepted);
      if (files.length === 0) return;
      await onUpload(files);
    },
    [onUpload],
  );

  return (
    <div className="w-full">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (e.dataTransfer.files) {
            void handleFiles(e.dataTransfer.files);
          }
        }}
        onClick={() => inputRef.current?.click()}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-8 transition-colors ${
          dragOver
            ? "border-blue-500 bg-blue-50"
            : "border-slate-300 bg-white hover:border-slate-400"
        }`}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPTED_EXTENSIONS.join(",")}
          className="hidden"
          onChange={(e) => {
            if (e.target.files) {
              void handleFiles(e.target.files);
              e.target.value = "";
            }
          }}
        />
        <svg
          className="mb-2 h-8 w-8 text-slate-400"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 7.5 7.5 12M12 7.5v12"
          />
        </svg>
        <p className="text-sm font-medium text-slate-700">
          {uploading
            ? "Uploading…"
            : "Drop .txt or .md files here, or click to browse"}
        </p>
        <p className="mt-1 text-xs text-slate-500">
          Documents are written to /documents/ in your sandbox container.
        </p>
      </div>

      {uploadedFiles.length > 0 && (
        <ul className="mt-3 space-y-1">
          {uploadedFiles.map((f) => (
            <li
              key={f.name}
              className="flex items-center justify-between rounded-md bg-white px-3 py-2 text-sm shadow-sm ring-1 ring-slate-200"
            >
              <span className="truncate font-mono text-slate-700">
                {f.name}
              </span>
              <span className="ml-2 shrink-0 text-xs text-slate-500">
                {f.bytes.toLocaleString()} bytes
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
