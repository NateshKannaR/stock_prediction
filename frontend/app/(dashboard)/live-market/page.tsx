import { LiveMarketBoard } from "@/components/live-market-board";
import { PageHeader } from "@/components/ui";

type LiveMarketInstrument = {
  label: string;
  instrumentKey: string;
};

const DEFAULT_INSTRUMENTS: LiveMarketInstrument[] = [
  { label: "RELIANCE", instrumentKey: "NSE_EQ|INE002A01018" },
  { label: "TCS", instrumentKey: "NSE_EQ|INE467B01029" },
  { label: "HDFCBANK", instrumentKey: "NSE_EQ|INE040A01034" },
  { label: "INFY", instrumentKey: "NSE_EQ|INE009A01021" },
  { label: "ICICIBANK", instrumentKey: "NSE_EQ|INE090A01021" },
  { label: "SBIN", instrumentKey: "NSE_EQ|INE062A01020" },
  { label: "BHARTIARTL", instrumentKey: "NSE_EQ|INE397D01024" },
  { label: "ITC", instrumentKey: "NSE_EQ|INE154A01025" },
  { label: "LT", instrumentKey: "NSE_EQ|INE018A01030" },
  { label: "HINDUNILVR", instrumentKey: "NSE_EQ|INE030A01027" },
];

function parseInstrumentConfig(raw: string | undefined): LiveMarketInstrument[] {
  if (!raw) {
    return DEFAULT_INSTRUMENTS;
  }

  const items = raw
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [label, instrumentKey] = entry.includes(":") ? entry.split(":") : [entry, entry];
      return {
        label: label.trim(),
        instrumentKey: instrumentKey.trim(),
      };
    })
    .filter((entry) => entry.label && entry.instrumentKey);

  return items.length > 0 ? items : DEFAULT_INSTRUMENTS;
}

export default async function LiveMarketPage() {
  const instruments = parseInstrumentConfig(process.env.LIVE_MARKET_INSTRUMENTS);

  return (
    <div>
      <PageHeader
        title="Live Market"
        subtitle="Select a stock from the watchlist to inspect its live quote snapshot and stored price chart."
      />

      <LiveMarketBoard instruments={instruments} />
    </div>
  );
}
