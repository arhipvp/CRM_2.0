import { DealFunnelBoard } from "@/components/deals/DealFunnelBoard";
import { DealFunnelHeader } from "@/components/deals/DealFunnelHeader";
import { DealFunnelTable } from "@/components/deals/DealFunnelTable";

export const revalidate = 0;

export default function DealsPage() {
  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-6 py-8">
      <DealFunnelHeader />
      <DealFunnelBoard />
      <DealFunnelTable />
    </main>
  );
}
