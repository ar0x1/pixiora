/** Strip directories and any character a filesystem might reject. */
export const safeFileName = (name: string, fallback = 'image'): string => {
  const base = name.split(/[/\\]/).pop() ?? fallback;
  const cleaned = base.replace(/[<>:"|?*\u0000-\u001f]/g, '-').trim();
  return cleaned.length > 0 ? cleaned.slice(0, 180) : fallback;
};

export const fileStem = (name: string): string => name.replace(/\.[^./\\]+$/, '');
