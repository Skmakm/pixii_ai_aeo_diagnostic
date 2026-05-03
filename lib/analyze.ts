const LIST_LINE = /^(\s*)(\d+)[.)]\s+(.*)/;

function extractName(body: string): string {
  let name = body;

  name = name.replace(/^(\*\*|__)+/, '').replace(/(\*\*|__)+/, '');

  const emDashIdx = name.indexOf(' — ');
  const spDashIdx = name.indexOf(' -');
  const colonIdx = name.indexOf(':');
  const parenIdx = name.indexOf('(');

  const candidates: number[] = [];
  if (emDashIdx !== -1) candidates.push(emDashIdx);
  if (spDashIdx !== -1) candidates.push(spDashIdx);
  if (colonIdx !== -1) candidates.push(colonIdx);
  if (parenIdx !== -1) candidates.push(parenIdx);

  let cutAt = 60;
  if (candidates.length > 0) {
    cutAt = Math.min(cutAt, ...candidates);
  }

  name = name.slice(0, cutAt);

  name = name.replace(/^[\s:–\-—]+/, '').replace(/[\s:–\-—]+$/, '');

  return name;
}

export function analyze(
  brand: string,
  response: string
): { mentioned: boolean; rank: number | null; competitors: { name: string; rank: number }[] } {
  if (!response) {
    return { mentioned: false, rank: null, competitors: [] };
  }

  const brandLower = brand.toLowerCase();
  const mentioned = response.toLowerCase().includes(brandLower);

  const lines = response.split('\n');
  let rank: number | null = null;
  const competitors: { name: string; rank: number }[] = [];

  for (const line of lines) {
    const match = LIST_LINE.exec(line);
    if (!match) continue;

    const indent = match[1].length;
    if (indent > 3) continue;

    const num = parseInt(match[2], 10);
    const body = match[3];

    if (body.toLowerCase().includes(brandLower)) {
      if (rank === null) {
        rank = num;
      }
    } else if (competitors.length < 5) {
      const name = extractName(body);
      if (name) {
        competitors.push({ name, rank: num });
      }
    }
  }

  return { mentioned, rank, competitors };
}
