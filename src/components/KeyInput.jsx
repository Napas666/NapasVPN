import { useRef } from 'react';

export default function KeyInput({ value, onChange }) {
  const ref = useRef();

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      onChange(text.trim());
    } catch {
      ref.current?.focus();
    }
  };

  return (
    <div>
      <div className="key-input-label">ACCESS KEY</div>
      <div style={{ height: 7 }} />
      <div className="key-input-wrap">
        <textarea
          ref={ref}
          className="key-input"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder="Paste vless:// / ss:// / ssconf:// key…"
          spellCheck={false}
        />
        <button className="key-paste-btn" onClick={handlePaste} title="Paste from clipboard">
          ⌅
        </button>
        {value && (
          <button className="key-clear-btn" onClick={() => onChange('')} title="Clear">
            ✕
          </button>
        )}
      </div>
    </div>
  );
}
