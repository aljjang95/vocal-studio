'use client';

import { useState, useRef, useCallback, type DragEvent } from 'react';
import styles from './FileDropZone.module.css';

interface FileDropZoneProps {
  onFileSelected: (file: File) => void;
  disabled?: boolean;
}

const ACCEPTED_TYPES = ['.wav', '.mp3', '.flac', '.ogg', '.m4a'];
const ACCEPT_STRING = ACCEPTED_TYPES.join(',');
const MAX_SIZE_MB = 50;
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function FileDropZone({ onFileSelected, disabled = false }: FileDropZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateAndSelect = useCallback(
    (file: File) => {
      setError(null);

      // 확장자 검증
      const ext = '.' + file.name.split('.').pop()?.toLowerCase();
      if (!ACCEPTED_TYPES.includes(ext)) {
        setError(`지원하지 않는 형식입니다. (${ACCEPTED_TYPES.join(', ')})`);
        return;
      }

      // 크기 검증
      if (file.size > MAX_SIZE_BYTES) {
        setError(`파일 크기가 ${MAX_SIZE_MB}MB를 초과합니다.`);
        return;
      }

      setSelectedFile(file);
      onFileSelected(file);
    },
    [onFileSelected],
  );

  const handleDragOver = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      if (!disabled) setIsDragOver(true);
    },
    [disabled],
  );

  const handleDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      if (disabled) return;
      const file = e.dataTransfer.files[0];
      if (file) validateAndSelect(file);
    },
    [disabled, validateAndSelect],
  );

  const handleClick = useCallback(() => {
    if (!disabled) fileInputRef.current?.click();
  }, [disabled]);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) validateAndSelect(file);
      e.target.value = '';
    },
    [validateAndSelect],
  );

  const zoneClasses = [
    styles.dropzone,
    isDragOver ? styles.dropzoneActive : '',
    disabled ? styles.dropzoneDisabled : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <>
      <div
        className={zoneClasses}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClick}
      >
        {isDragOver ? (
          <p className={styles.dragText}>여기에 놓으세요</p>
        ) : selectedFile ? (
          <div className={styles.fileInfo}>
            <span className={styles.icon}>&#127925;</span>
            <p className={styles.fileName}>{selectedFile.name}</p>
            <p className={styles.fileSize}>{formatFileSize(selectedFile.size)}</p>
          </div>
        ) : (
          <>
            <span className={styles.icon}>&#128190;</span>
            <p className={styles.label}>파일을 드래그하거나 클릭하여 업로드</p>
            <p className={styles.hint}>
              WAV, MP3, FLAC, OGG, M4A / 최대 {MAX_SIZE_MB}MB
            </p>
          </>
        )}
      </div>

      {error && <p className={styles.error}>{error}</p>}

      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPT_STRING}
        onChange={handleInputChange}
        className={styles.fileInput}
      />
    </>
  );
}
