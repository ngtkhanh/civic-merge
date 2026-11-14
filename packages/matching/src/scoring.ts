export function compareFeatures(left: readonly string[], right: readonly string[]) {
  const a = new Set(left);
  const b = new Set(right);
  const common = [...a].filter(tag => b.has(tag)).sort();
  const unionSize = new Set([...a, ...b]).size;
  return {
    common,
    hasFeatures: a.size > 0 && b.size > 0,
    similarity: unionSize === 0 ? 0 : common.length / unionSize,
  };
}

export function rankScore(distance: number, radius: number, similarity: number): number {
  return 0.7 / (1 + distance / radius) + 0.3 * similarity;
}
