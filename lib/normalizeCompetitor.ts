const SUFFIXES = [
  ' co., ltd.',
  ' company',
  ' brands',
  ' corp.',
  ' corp',
  ' inc.',
  ' inc',
  ' ltd.',
  ' ltd',
  ' llc',
  ' co.',
  ' co',
];

export function normalizeCompetitor(name: string): string {
  let result = name.toLowerCase().trim();

  let changed = true;
  while (changed) {
    changed = false;
    for (const suffix of SUFFIXES) {
      if (result.endsWith(suffix)) {
        result = result.slice(0, result.length - suffix.length);
        changed = true;
        break;
      }
    }
  }

  result = result.replace(/\s+/g, ' ').trim();

  return result;
}
