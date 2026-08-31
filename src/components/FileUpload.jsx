import { useRef, useState } from 'react';

export default function FileUpload({ label, required, accept = 'image/*,application/pdf', onChange, value }) {
  const inputRef  = useRef();
  const [drag, setDrag] = useState(false);

  const handleFile = (file) => {
    if (!file) return;
    onChange(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDrag(false);
    handleFile(e.dataTransfer.files[0]);
  };

  return (
    <div className="field">
      {label && (
        <label>
          {label} {required && <span className="req">*</span>}
        </label>
      )}

      {value ? (
        <div className="file-preview">
          <span>{value.type?.includes('pdf') ? '📄' : '🖼️'}</span>
          <span className="file-name">{value.name}</span>
          <button className="remove-file" onClick={() => onChange(null)}>✕</button>
        </div>
      ) : (
        <div
          className={`file-upload-area${drag ? ' dragover' : ''}`}
          onDragOver={e => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
        >
          <input
            ref={inputRef}
            type="file"
            accept={accept}
            onChange={e => handleFile(e.target.files[0])}
            onClick={e => e.stopPropagation()}
          />
          <div className="file-upload-icon">📎</div>
          <div className="file-upload-text">
            <strong>Click to upload</strong> or drag & drop
          </div>
          <div className="file-upload-hint">JPG, PNG, PDF — max 10MB</div>
        </div>
      )}
    </div>
  );
}
