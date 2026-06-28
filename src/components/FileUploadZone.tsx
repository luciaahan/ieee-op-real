"use client";

import { useRef, useState } from "react";

const DEFAULT_ACCEPT =
  "application/pdf,image/jpeg,image/png,image/gif,image/webp,.pdf,.jpg,.jpeg,.png,.gif,.webp";

export function FileUploadZone({
  file,
  onFileChange,
  accept = DEFAULT_ACCEPT,
  hint = "PDF or image · max 10 MB",
}: {
  file: File | null;
  onFileChange: (file: File | null) => void;
  accept?: string;
  hint?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  function handleFiles(fileList: FileList | null) {
    onFileChange(fileList?.[0] ?? null);
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="sr-only"
        onChange={(e) => handleFiles(e.target.files)}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          handleFiles(e.dataTransfer.files);
        }}
        className={`flex w-full flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-10 text-center transition-colors ${
          dragOver
            ? "border-[#00629B] bg-[#00629B]/5"
            : file
              ? "border-green-300 bg-green-50"
              : "border-slate-300 bg-slate-50 hover:border-[#00629B] hover:bg-[#00629B]/5"
        }`}
      >
        {file ? (
          <>
            <span className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-green-100 text-green-700">
              <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.857-9.809a.75.75 0 0 0-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 1 0-1.06 1.061l2.5 2.5a.75.75 0 0 0 1.137-.089l4-5.5Z"
                  clipRule="evenodd"
                />
              </svg>
            </span>
            <p className="text-sm font-medium text-slate-900">{file.name}</p>
            <p className="mt-1 text-xs text-slate-500">
              {(file.size / 1024 / 1024).toFixed(2)} MB · Click to replace
            </p>
          </>
        ) : (
          <>
            <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-white text-[#00629B] shadow-sm ring-1 ring-slate-200">
              <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5"
                />
              </svg>
            </span>
            <p className="text-sm font-medium text-slate-900">
              Click to upload or drag and drop
            </p>
            <p className="mt-1 text-xs text-slate-500">{hint}</p>
          </>
        )}
      </button>
    </div>
  );
}
