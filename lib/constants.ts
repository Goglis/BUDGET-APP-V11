import {
  Bus,
  Car,
  Heart,
  Home,
  MoreHorizontal,
  ShoppingBag,
  Utensils,
  type LucideIcon,
} from "lucide-react";

export interface ExpenseCategoryDef {
  id: string;
  label: string;
  icon: LucideIcon;
}

export const OZEL_KATEGORILER: ExpenseCategoryDef[] = [
  { id: "Ev", label: "Ev", icon: Home },
  { id: "Uber", label: "Uber", icon: Car },
  { id: "Yemek", label: "Yemek", icon: Utensils },
  { id: "Ulasim", label: "Ulaşım", icon: Bus },
  { id: "Alisveris", label: "Alışveriş", icon: ShoppingBag },
  { id: "Saglik", label: "Sağlık", icon: Heart },
  { id: "Diger", label: "Diğer", icon: MoreHorizontal },
];
