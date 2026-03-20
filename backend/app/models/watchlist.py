from __future__ import annotations

# Top 50 liquid NSE stocks for intraday trading
INTRADAY_UNIVERSE = [
    "NSE_EQ|INE002A01018",  # Reliance Industries
    "NSE_EQ|INE467B01029",  # Tata Steel
    "NSE_EQ|INE040A01034",  # HDFC Bank
    "NSE_EQ|INE009A01021",  # Infosys
    "NSE_EQ|INE090A01021",  # ICICI Bank
    "NSE_EQ|INE062A01020",  # State Bank of India
    "NSE_EQ|INE397D01024",  # Bajaj Finance
    "NSE_EQ|INE154A01025",  # ITC
    "NSE_EQ|INE018A01030",  # Larsen & Toubro
    "NSE_EQ|INE030A01027",  # HDFC
    "NSE_EQ|INE155A01022",  # Bharti Airtel
    "NSE_EQ|INE721A01013",  # Shriram Finance
    "NSE_EQ|INE019A01038",  # Asian Paints
    "NSE_EQ|INE238A01034",  # Axis Bank
    "NSE_EQ|INE120A01034",  # SBI Life Insurance
    "NSE_EQ|INE752E01010",  # Adani Ports
    "NSE_EQ|INE742F01042",  # Adani Enterprises
    "NSE_EQ|INE066A01021",  # Bajaj Finserv
    "NSE_EQ|INE101D01020",  # Mahindra & Mahindra
    "NSE_EQ|INE239A01016",  # Nestle India
    "NSE_EQ|INE040H01021",  # Adani Green Energy
    "NSE_EQ|INE002S01010",  # Adani Total Gas
    "NSE_EQ|INE192A01025",  # Wipro
    "NSE_EQ|INE114A01011",  # Titan Company
    "NSE_EQ|INE296A01024",  # Maruti Suzuki
    "NSE_EQ|INE860A01027",  # HCL Technologies
    "NSE_EQ|INE075A01022",  # Tech Mahindra
    "NSE_EQ|INE769A01020",  # Adani Transmission
    "NSE_EQ|INE213A01029",  # Tata Consultancy Services
    "NSE_EQ|INE021A01026",  # Bajaj Auto
]

# Sector mapping for rotation analysis
SECTOR_MAP = {
    "NSE_EQ|INE002A01018": "Energy",
    "NSE_EQ|INE467B01029": "Metals",
    "NSE_EQ|INE040A01034": "Banking",
    "NSE_EQ|INE009A01021": "IT",
    "NSE_EQ|INE090A01021": "Banking",
    "NSE_EQ|INE062A01020": "Banking",
    "NSE_EQ|INE397D01024": "Financial Services",
    "NSE_EQ|INE154A01025": "FMCG",
    "NSE_EQ|INE018A01030": "Infrastructure",
    "NSE_EQ|INE030A01027": "Financial Services",
    "NSE_EQ|INE155A01022": "Telecom",
    "NSE_EQ|INE721A01013": "Financial Services",
    "NSE_EQ|INE019A01038": "Consumer Goods",
    "NSE_EQ|INE238A01034": "Banking",
    "NSE_EQ|INE120A01034": "Financial Services",
    "NSE_EQ|INE752E01010": "Infrastructure",
    "NSE_EQ|INE742F01042": "Conglomerate",
    "NSE_EQ|INE066A01021": "Financial Services",
    "NSE_EQ|INE101D01020": "Auto",
    "NSE_EQ|INE239A01016": "FMCG",
    "NSE_EQ|INE040H01021": "Energy",
    "NSE_EQ|INE002S01010": "Energy",
    "NSE_EQ|INE192A01025": "IT",
    "NSE_EQ|INE114A01011": "Consumer Goods",
    "NSE_EQ|INE296A01024": "Auto",
    "NSE_EQ|INE860A01027": "IT",
    "NSE_EQ|INE075A01022": "IT",
    "NSE_EQ|INE769A01020": "Infrastructure",
    "NSE_EQ|INE213A01029": "IT",
    "NSE_EQ|INE021A01026": "Auto",
}
