import { useRef } from 'react';
import { Avatar } from './Avatar';
import { useErrorReporter } from '../lib/errors';

/**
 * An avatar you can tap to replace with a photo.
 *
 * The crop happens here, in the browser: a centre-cropped 256px square lands at
 * roughly 25KB, small enough to store inline. A child has no account of their
 * own to upload from, so an adult sets theirs from the family screen.
 */
export async function fileToSquareDataUrl(file: File, px = 256): Promise<string> {
  const bmp = await createImageBitmap(file);
  const side = Math.min(bmp.width, bmp.height);
  const canvas = document.createElement('canvas');
  canvas.width = px;
  canvas.height = px;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas unavailable');
  ctx.drawImage(bmp, (bmp.width - side) / 2, (bmp.height - side) / 2, side, side, 0, 0, px, px);
  return canvas.toDataURL('image/jpeg', 0.85);
}

export function AvatarPhotoButton({
  emoji,
  color,
  image,
  size = 64,
  busy,
  label,
  onPick,
  onClear,
}: {
  emoji: string;
  color: string;
  image?: string | null;
  size?: number;
  busy?: boolean;
  label: string;
  onPick: (dataUrl: string) => void;
  onClear?: () => void;
}) {
  const { report } = useErrorReporter();
  const input = useRef<HTMLInputElement>(null);
  return (
    <div className="flex items-center gap-d3">
      <button type="button" aria-label={label} className="relative" onClick={() => input.current?.click()} disabled={busy}>
        <Avatar emoji={emoji} color={color} image={image} size={size} />
        <span
          className="absolute -bottom-0.5 -right-0.5 grid place-items-center rounded-full"
          style={{
            width: size / 2.7,
            height: size / 2.7,
            fontSize: size / 4.8,
            background: 'var(--color-accent)',
            boxShadow: '0 0 0 2px var(--color-bg)',
          }}
        >
          📷
        </span>
      </button>
      <input
        ref={input}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (!file) return;
          try {
            onPick(await fileToSquareDataUrl(file));
          } catch {
            report("Couldn't read that image.", 'Try a different photo.');
          }
        }}
      />
      {image && onClear && (
        <button type="button" className="font-semibold text-muted" style={{ fontSize: 'var(--fs-sm)' }} onClick={onClear}>
          Remove photo
        </button>
      )}
    </div>
  );
}
