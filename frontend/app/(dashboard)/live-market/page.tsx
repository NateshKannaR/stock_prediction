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
  { label: "TATAMOTORS", instrumentKey: "NSE_EQ|INE155A01022" },
  { label: "TATASTEEL", instrumentKey: "NSE_EQ|INE721A01013" },
  { label: "AXISBANK", instrumentKey: "NSE_EQ|INE019A01038" },
  { label: "KOTAK", instrumentKey: "NSE_EQ|INE238A01034" },
  { label: "ASIANPAINT", instrumentKey: "NSE_EQ|INE120A01034" },
  { label: "ADANIENT", instrumentKey: "NSE_EQ|INE752E01010" },
  { label: "ADANIPORTS", instrumentKey: "NSE_EQ|INE742F01042" },
  { label: "MARUTI", instrumentKey: "NSE_EQ|INE066A01021" },
  { label: "MAHINDRA", instrumentKey: "NSE_EQ|INE101D01020" },
  { label: "WIPRO", instrumentKey: "NSE_EQ|INE239A01016" },
  { label: "SUNPHARMA", instrumentKey: "NSE_EQ|INE040H01021" },
  { label: "POWERGRID", instrumentKey: "NSE_EQ|INE002S01010" },
  { label: "TITAN", instrumentKey: "NSE_EQ|INE192A01025" },
  { label: "BAJFINANCE", instrumentKey: "NSE_EQ|INE114A01011" },
  { label: "BAJAJFINSV", instrumentKey: "NSE_EQ|INE296A01024" },
  { label: "HCL", instrumentKey: "NSE_EQ|INE860A01027" },
  { label: "TECHM", instrumentKey: "NSE_EQ|INE075A01022" },
  { label: "ONGC", instrumentKey: "NSE_EQ|INE769A01020" },
  { label: "ULTRACEMCO", instrumentKey: "NSE_EQ|INE213A01029" },
  { label: "NESTLEIND", instrumentKey: "NSE_EQ|INE021A01026" },
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
