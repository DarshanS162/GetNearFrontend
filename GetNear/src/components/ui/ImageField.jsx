import { useEffect, useState } from 'react';
import './ImageField.css';

/**
 * Simple image picker with preview. Passes File (or null) via onChange.
 */
export default function ImageField({
  id,
  label = 'Image',
  hint = 'JPG, PNG, WEBP or GIF · max 5 MB',
  value,
  onChange,
}) {
  const [preview, setPreview] = useState('');

  useEffect(() => {
    if (!value) {
      setPreview('');
      return undefined;
    }
    const url = URL.createObjectURL(value);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [value]);

  return (
    <div className="form-group image-field">
      <label className="form-label" htmlFor={id}>{label}</label>
      {preview && (
        <div className="image-field-preview">
          <img src={preview} alt="" />
          <button
            type="button"
            className="btn-ghost btn-sm image-field-clear"
            onClick={() => onChange(null)}
          >
            Remove
          </button>
        </div>
      )}
      <input
        id={id}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="form-input image-field-input"
        onChange={(e) => onChange(e.target.files?.[0] || null)}
      />
      {hint && <p className="form-hint">{hint}</p>}
    </div>
  );
}
