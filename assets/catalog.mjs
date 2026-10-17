const catalog = [
  {
    id: "fuji-apple",
    name: "红富士苹果",
    unit: "500g",
    unitPriceCents: 1299,
    description: "脆甜多汁，果香清亮",
  },
  {
    id: "banana",
    name: "海南香蕉",
    unit: "1kg",
    unitPriceCents: 899,
    description: "软糯香甜，适合早餐",
  },
  {
    id: "navel-orange",
    name: "赣南脐橙",
    unit: "1kg",
    unitPriceCents: 1599,
    description: "酸甜平衡，汁水充足",
  },
  {
    id: "shine-muscat",
    name: "阳光玫瑰葡萄",
    unit: "500g",
    unitPriceCents: 2999,
    description: "果粒紧实，玫瑰香气",
  },
  {
    id: "golden-pineapple",
    name: "海南金钻凤梨",
    unit: "1个",
    unitPriceCents: 1999,
    description: "香气浓郁，少纤维",
  },
  {
    id: "durian",
    name: "泰国金枕榴莲",
    unit: "1kg",
    unitPriceCents: 4999,
    description: "绵密香甜，气味鲜明",
  },
  {
    id: "hami-melon",
    name: "新疆哈密瓜",
    unit: "1个",
    unitPriceCents: 2599,
    description: "清甜脆爽，瓜香饱满",
  },
  {
    id: "peach",
    name: "山东水蜜桃",
    unit: "500g",
    unitPriceCents: 1899,
    description: "果肉柔软，甜度高",
  },
  {
    id: "blueberry",
    name: "智利蓝莓",
    unit: "125g",
    unitPriceCents: 2199,
    description: "颗粒饱满，微酸回甜",
  },
  {
    id: "red-dragon-fruit",
    name: "云南红心火龙果",
    unit: "1个",
    unitPriceCents: 1399,
    description: "果肉细嫩，色泽鲜明",
  },
].map((fruit) => Object.freeze(fruit));

export const FRUITS = Object.freeze(catalog);
export const catalogById = new Map(FRUITS.map((fruit) => [fruit.id, fruit]));
