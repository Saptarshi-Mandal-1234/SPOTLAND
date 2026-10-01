// Art direction inspired by regional craft, architecture and landscapes;
// these are design palettes, not official state colours.
const themes = {
  earth: { accent: '#efb981', light: '#fff0e2', dark: '#30251f', highlight: '#f5c694' },
  red: { accent: '#f2a594', light: '#fff0eb', dark: '#322322', highlight: '#ffb8a5' },
  green: { accent: '#b9d49f', light: '#eff6e7', dark: '#232f24', highlight: '#c7dfa7' },
  teal: { accent: '#a2d8cf', light: '#eaf6f1', dark: '#20302e', highlight: '#aee5dc' },
  gold: { accent: '#edcc77', light: '#fff5d9', dark: '#302b20', highlight: '#f3d685' },
  pink: { accent: '#eab4bd', light: '#fff0f1', dark: '#32242b', highlight: '#f4c1cb' },
  indigo: { accent: '#bfc8e8', light: '#f0f2fc', dark: '#252a38', highlight: '#d0d9f7' },
} as const;
const inspirations: Record<string, [keyof typeof themes, string]> = {
  'Andhra Pradesh': ['earth', 'Kalamkari-inspired earth tones'],
  'Arunachal Pradesh': ['red', 'Woven-textile red and warm cream'],
  'Assam': ['red', 'Gamosa-inspired red and ivory'],
  'Bihar': ['earth', 'Madhubani-inspired ochre'],
  'Chhattisgarh': ['gold', 'Dhokra-inspired brass tones'],
  'Goa': ['teal', 'Coastal teal and warm white'],
  'Gujarat': ['red', 'Bandhani-inspired red'],
  'Haryana': ['green', 'Phulkari-inspired colour and field green'],
  'Himachal Pradesh': ['green', 'Hill-textile green'],
  'Jharkhand': ['earth', 'Sohrai-inspired earth tones'],
  'Karnataka': ['gold', 'Mysuru-inspired gold'],
  'Kerala': ['teal', 'Kasavu gold and backwater teal'],
  'Madhya Pradesh': ['earth', 'Bagh-print-inspired warm tones'],
  'Maharashtra': ['earth', 'Warli-inspired earth and ivory'],
  'Manipur': ['red', 'Woven-textile red'],
  'Meghalaya': ['green', 'Hill green and woven-textile cream'],
  'Mizoram': ['red', 'Puan-inspired red'],
  'Nagaland': ['red', 'Woven-textile red and charcoal'],
  'Odisha': ['earth', 'Pattachitra-inspired terracotta'],
  'Punjab': ['gold', 'Phulkari-inspired mustard'],
  'Rajasthan': ['pink', 'Jaipur-inspired sandstone pink'],
  'Sikkim': ['red', 'Monastery-inspired red'],
  'Tamil Nadu': ['gold', 'Temple-inspired brass gold'],
  'Telangana': ['red', 'Pochampally-inspired red'],
  'Tripura': ['red', 'Risa-inspired woven red'],
  'Uttar Pradesh': ['earth', 'Terracotta and warm sandstone'],
  'Uttarakhand': ['green', 'Hill green and warm stone'],
  'West Bengal': ['red', 'Red-and-ivory textile inspiration'],
  'Andaman and Nicobar Islands': ['teal', 'Island turquoise'],
  'Chandigarh': ['indigo', 'Modernist concrete and cool accents'],
  'Dadra and Nagar Haveli and Daman and Diu': ['teal', 'Coastal teal and warm stone'],
  'Delhi': ['earth', 'Red sandstone and warm cream'],
  'Jammu and Kashmir': ['gold', 'Saffron-inspired gold'],
  'Ladakh': ['earth', 'Monastery ochre and mountain earth'],
  'Lakshadweep': ['teal', 'Lagoon turquoise'],
  'Puducherry': ['gold', 'Heritage mustard and warm white'],
};
export function paletteFor(name: string) {
  const [theme, inspiration] = inspirations[name] || ['earth', 'Warm postcard tones'];
  return { ...themes[theme], inspiration };
}
export function matchState<T extends { name: string; aliases: string[] }>(states: T[], name: string): T | undefined {
  const normalize = (value: string) => value.trim().toLocaleLowerCase('en-IN');
  return states.find(state => [state.name, ...state.aliases].some(value => normalize(value) === normalize(name)));
}
