import { StockNews } from "@/components/stock-news";
import { PageHeader } from "@/components/ui";

export default function LiveNewsPage() {
  return (
    <div>
      <PageHeader title="Live News" subtitle="Real-time Indian stock market news from top financial sources." />
      <StockNews />
    </div>
  );
}
