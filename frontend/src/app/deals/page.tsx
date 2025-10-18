import { DealsHeader } from "@/components/deals/DealsHeader";
import { DealsTable } from "@/components/deals/DealsTable";

export const revalidate = 0;

export default function DealsPage() {
  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-6 py-8">
      <DealsHeader />
      <DealsTable />
    </main>
  );
}
