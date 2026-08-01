export type Category = {
  id: number;
  name: string;
  slug: string;
  parent_id: number | null;
};

export const CATEGORIES: Category[] = [
  { id: 1, name: "Electronics", slug: "electronics", parent_id: null },
  { id: 2, name: "Clothing & Apparel", slug: "clothing", parent_id: null },
  { id: 3, name: "Home & Garden", slug: "home-garden", parent_id: null },
  { id: 4, name: "Sports & Outdoors", slug: "sports-outdoors", parent_id: null },
  { id: 5, name: "Toys & Games", slug: "toys-games", parent_id: null },
  { id: 6, name: "Books & Media", slug: "books-media", parent_id: null },
  { id: 7, name: "Vehicles & Parts", slug: "vehicles-parts", parent_id: null },
  { id: 8, name: "Collectibles & Art", slug: "collectibles-art", parent_id: null },
  { id: 9, name: "Health & Beauty", slug: "health-beauty", parent_id: null },
  { id: 10, name: "Other", slug: "other", parent_id: null },
  { id: 11, name: "Phones & Tablets", slug: "phones-tablets", parent_id: 1 },
  { id: 12, name: "Computers & Laptops", slug: "computers-laptops", parent_id: 1 },
  { id: 13, name: "Audio & Headphones", slug: "audio-headphones", parent_id: 1 },
  { id: 14, name: "Cameras", slug: "cameras", parent_id: 1 },
  { id: 15, name: "Men's Clothing", slug: "mens-clothing", parent_id: 2 },
  { id: 16, name: "Women's Clothing", slug: "womens-clothing", parent_id: 2 },
  { id: 17, name: "Shoes", slug: "shoes", parent_id: 2 },
  { id: 18, name: "Furniture", slug: "furniture", parent_id: 3 },
  { id: 19, name: "Kitchen & Dining", slug: "kitchen-dining", parent_id: 3 },
  { id: 20, name: "Garden & Outdoor", slug: "garden-outdoor", parent_id: 3 },
];