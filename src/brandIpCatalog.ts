/**
 * Featured characters / IPs shown on the brand collection hub (before the product grid).
 * Keys are collection `handle` slugs (lowercase).
 */
export const BRAND_IP_CHARACTERS: Record<string, readonly string[]> = {
  'pop-mart': ['Labubu', 'Molly', 'Skullpanda', 'Dimoo'],
  'pop-mart-pre-orders': ['Labubu', 'Hirono', 'Crybaby', 'Hacipupu'],
  'wonderport-x-comic-con': ['Labubu', 'Skullpanda', 'Molly', 'Dimoo'],
  '52toys': ['Panda Roll', 'Beastbox', 'Nook', 'Ninnic'],
  'finding-unicorn': ['Farmer Bob', 'RiCO', 'ShinWoo', 'Agan'],
  'lucky-emma': ['Emma', 'Lulu', 'Coco', 'Bunny Emma'],
  /** In-stock HiToy lines use Nommi / MayMei / Pajama Baby / Lucky Deer (not legacy HiChance labels). */
  'hitoy-hichance': ['Nommi', 'MayMei', 'Pajama Baby', 'Lucky Deer Nai'],
  'toycity': ['Laura', 'Wakuku', 'Pepe', 'Sleep'],
  'hidden-wooo': ['Wooo Ghost', 'Baby Wooo', 'Night Wooo', 'Dream Wooo'],
  'dreams-inc': ['Sweet Bean', 'Dream Elf', 'Baby Cloud', 'Moon Bunny'],
  'cureplaneta': ['Planet Rabbit', 'Cure Bear', 'Astro Girl', 'Star Cat'],
  'funism': ['Shin Chan', 'Pokemon', 'One Piece', 'Sanrio'],
  'miniso': ['Sanrio', 'Stitch', 'We Bare Bears', 'Chiikawa'],
  'rolife': ['Nanci', 'Molly Journey', 'Super Creator', 'DIY House Series'],
  'dreame-mart-presents-ohku': ['Ohku Fox', 'Ohku Spirit', 'Moon Ohku', 'Shrine Ohku'],
  'jotoy': ['Jo Bear', 'Cat Knight', 'Mecha Puppy', 'Space Girl'],
  '1983-toys': ['Retro Boy', 'Space Baby', 'Robo Kid', 'Vinyl Dino'],
  'cqtoys': ['CQ Bear', 'Dessert Girl', 'Panda Baby', 'Monster Kid'],
  'beast-kingdom': ['Disney', 'Marvel', 'Star Wars', 'Toy Story'],
  'ddp-dream-design-play-hot-toys-cosbi-collection': [
    'Spider-Man',
    'Iron Man',
    'Batman',
    'Deadpool',
  ],
  'monday-bruce': ['Bruce Panda', 'Monday Cat', 'Lazy Bear', 'Sleepy Boy'],
  'm-a-toys': ['MA Bunny', 'Dino Bean', 'Robot Cat', 'Space Tot'],
  'tnt-space': ['Astro Boy', 'Space Bunny', 'Mecha Dino', 'Galaxy Cat'],
  'top-toy-miniso': ['Sanrio', 'Disney', 'Pokemon', 'Lotso'],
  'heyone': ['Nook', 'Sleep', 'Little Fairy', 'Ghost Bear'],
  'here-toys': ['Here Bear', 'Tiny Ghost', 'Milk Bunny', 'Dream Cat'],
}

/**
 * Superset of IP names to rank by in-stock count; top four become hub tiles.
 * When omitted, the static `BRAND_IP_CHARACTERS` list is used as the pool.
 */
export const BRAND_IP_CANDIDATE_POOL: Record<string, readonly string[]> = {
  'pop-mart': [
    'Labubu',
    'Molly',
    'Skullpanda',
    'Dimoo',
    'Hirono',
    'Crybaby',
    'Hacipupu',
    'Pucky',
    'Zsiga',
    'Kubo',
    'Nyota',
    'Disney',
    'Stitch',
    'Naruto',
    'Sweet Bean',
  ],
  'pop-mart-pre-orders': [
    'Labubu',
    'Hirono',
    'Crybaby',
    'Hacipupu',
    'Molly',
    'Skullpanda',
    'Dimoo',
    'Pucky',
    'Zsiga',
    'Kubo',
    'Disney',
  ],
  'wonderport-x-comic-con': [
    'Labubu',
    'Skullpanda',
    'Molly',
    'Dimoo',
    'Hirono',
    'Crybaby',
    'Hacipupu',
    'Pucky',
  ],
}

/**
 * Extra title/tag search terms per brand + display label (lowercase).
 * Use when catalog product titles omit the full IP name (e.g. "HiChance" vs "HiChance Bear").
 */
export const BRAND_IP_MATCH_ALIASES: Record<string, Record<string, readonly string[]>> = {
  'pop-mart': {
    Labubu: ['the monsters', 'monsters'],
    Molly: ['molly'],
    Skullpanda: ['skullpanda'],
    Dimoo: ['dimoo'],
    Hirono: ['hirono'],
    Crybaby: ['crybaby'],
    Hacipupu: ['hacipupu'],
    Pucky: ['pucky'],
    Zsiga: ['zsiga'],
    Kubo: ['kubo'],
    Disney: ['disney'],
    Stitch: ['stitch'],
    Naruto: ['naruto'],
    'Sweet Bean': ['sweet bean'],
  },
  'pop-mart-pre-orders': {
    Labubu: ['the monsters', 'monsters'],
    Molly: ['molly'],
    Skullpanda: ['skullpanda'],
    Dimoo: ['dimoo'],
    Hirono: ['hirono'],
    Crybaby: ['crybaby'],
    Hacipupu: ['hacipupu'],
    Pucky: ['pucky'],
    Disney: ['disney'],
  },
  'wonderport-x-comic-con': {
    Labubu: ['the monsters', 'monsters'],
    Skullpanda: ['skullpanda'],
    Molly: ['molly'],
    Dimoo: ['dimoo'],
  },
  'hitoy-hichance': {
    Nommi: ['nommi'],
    MayMei: ['maymei', 'may mei'],
    'Pajama Baby': ['pajama baby', 'pajama'],
    'Lucky Deer Nai': ['lucky deer', 'lucky deer nai', 'deer nai'],
  },
}

/** Slugs that skip the IP hub and show the full product list immediately. */
const IP_HUB_SKIP_SLUGS = new Set(['all-products'])

/** `selectedIp` value — show every in-stock product in the collection (featured + rest). */
export const BRAND_IP_VIEW_ALL = '__all__'

export function brandIpSelectionLabel(selectedIp: string): string {
  if (selectedIp === BRAND_IP_VIEW_ALL) return 'All products & more'
  return selectedIp
}

export function isBrandIpHubSelection(selectedIp: string | null): boolean {
  return selectedIp !== null
}

export function normalizeBrandSlug(slug: string): string {
  return String(slug || '')
    .trim()
    .toLowerCase()
}

/** Returns four IP names for the slug, or `null` if the IP hub should not be shown. */
export function getBrandIpCharacters(slug: string): string[] | null {
  const key = normalizeBrandSlug(slug)
  if (!key || IP_HUB_SKIP_SLUGS.has(key)) return null
  const ips = BRAND_IP_CHARACTERS[key]
  if (!ips?.length) return null
  return [...ips]
}

export function shouldShowBrandIpHub(slug: string, catalogSearchQuery: string): boolean {
  if (String(catalogSearchQuery || '').trim()) return false
  return getBrandIpCharacters(slug) !== null
}

/** Search terms used to match products and pick a tile cover image. */
export function getIpMatchTerms(slug: string, ipName: string): string[] {
  const key = normalizeBrandSlug(slug)
  const label = String(ipName || '').trim()
  const aliases = BRAND_IP_MATCH_ALIASES[key]?.[label] ?? []
  const terms = new Set<string>()
  if (label) {
    terms.add(label.toLowerCase())
    const compact = label.toLowerCase().replace(/\s+/g, '')
    if (compact) terms.add(compact)
  }
  for (const alias of aliases) {
    const a = String(alias || '').trim().toLowerCase()
    if (!a) continue
    terms.add(a)
    const compact = a.replace(/\s+/g, '')
    if (compact) terms.add(compact)
  }
  const words = label.toLowerCase().split(/\s+/).filter((w) => w.length > 3)
  for (const w of words) terms.add(w)
  return [...terms]
}
