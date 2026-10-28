import { ShopView } from "@/components/ShopView";

export const metadata = { title: "Shop · Luckline" };

export default function ShopPage() {
  return (
    <div className="flex flex-col gap-6">
      <ShopView />
    </div>
  );
}
