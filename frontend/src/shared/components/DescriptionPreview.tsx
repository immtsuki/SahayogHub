import { useEffect, useRef, useState } from 'react';

interface DescriptionPreviewProps {
  text: string;
  className?: string;
}

export default function DescriptionPreview({ text, className = '' }: DescriptionPreviewProps) {
  const textRef = useRef<HTMLParagraphElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [isClipped, setIsClipped] = useState(false);

  useEffect(() => {
    const element = textRef.current;
    if (!element) return undefined;

    const measure = () => {
      const styles = window.getComputedStyle(element);
      const fontSize = Number.parseFloat(styles.fontSize);
      const lineHeight = Number.parseFloat(styles.lineHeight);
      const singleLineHeight = Number.isFinite(lineHeight) ? lineHeight : fontSize * 1.5;
      const hasOverflow = element.scrollHeight > singleLineHeight * 2 + 1;

      setIsClipped(hasOverflow);
      if (!hasOverflow) setExpanded(false);
    };

    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(element);

    return () => observer.disconnect();
  }, [text]);

  if (!text.trim()) return null;

  return (
    <div className="space-y-1">
      <p
        ref={textRef}
        className={`text-xs text-gray-500 leading-relaxed ${expanded ? '' : 'line-clamp-2'} ${className}`}
      >
        {text}
      </p>
      {isClipped && (
        <button
          type="button"
          onClick={() => setExpanded((current) => !current)}
          className="text-xs font-semibold text-blue-600 hover:text-blue-700 transition-colors"
        >
          {expanded ? 'Show less' : 'Read more'}
        </button>
      )}
    </div>
  );
}
