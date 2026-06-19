export const MATCH_ITEMS = [
  {
    image: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400&auto=format&fit=crop",
    matchPercent: 92,
    title: "Black Nike Backpack",
    distance: "2.1 mi",
    date: "Jan 12",
  },
  {
    image: "https://images.unsplash.com/photo-1523779917675-b6ed3a42a561?w=400&auto=format&fit=crop",
    matchPercent: 87,
    title: "Brown Leather Wallet",
    distance: "3.4 mi",
    date: "Jan 10",
  },
  {
    image: "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=400&auto=format&fit=crop",
    matchPercent: 74,
    title: "Samsung Galaxy Phone",
    distance: "5.8 mi",
    date: "Jan 08",
  },
  {
    image: "https://images.unsplash.com/photo-1574258495973-f010dfbb5371?w=400&auto=format&fit=crop",
    matchPercent: 68,
    title: "Round Frame Glasses",
    distance: "7.2 mi",
    date: "Jan 06",
  },
];

export type StatusFilter = "Lost" | "Found" | "All" | "Nearby" | "Recent";
export const STATUS_FILTERS: StatusFilter[] = ["Lost", "Found", "All", "Nearby", "Recent"];
export const SORT_OPTIONS = ["Closest Match", "Most Recent", "Nearest"];
