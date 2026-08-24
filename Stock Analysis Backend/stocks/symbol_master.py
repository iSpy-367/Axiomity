import os
import csv
import logging
import difflib

logger = logging.getLogger(__name__)


DEFAULT_SYMBOL_MASTER = [
    {"symbol": "RELIANCE", "name": "Reliance Industries Limited", "exchanges": ["NSE", "BSE"], "sector": "Energy & Conglomerate"},
    {"symbol": "TCS", "name": "Tata Consultancy Services Limited", "exchanges": ["NSE", "BSE"], "sector": "Information Technology"},
    {"symbol": "HDFCBANK", "name": "HDFC Bank Limited", "exchanges": ["NSE", "BSE"], "sector": "Banking & Financial Services"},
    {"symbol": "BHARTIARTL", "name": "Bharti Airtel Limited", "exchanges": ["NSE", "BSE"], "sector": "Telecommunications"},
    {"symbol": "ICICIBANK", "name": "ICICI Bank Limited", "exchanges": ["NSE", "BSE"], "sector": "Banking & Financial Services"},
    {"symbol": "INFY", "name": "Infosys Limited", "exchanges": ["NSE", "BSE"], "sector": "Information Technology"},
    {"symbol": "SBIN", "name": "State Bank of India", "exchanges": ["NSE", "BSE"], "sector": "Banking & Financial Services"},
    {"symbol": "LICI", "name": "Life Insurance Corporation of India", "exchanges": ["NSE", "BSE"], "sector": "Insurance"},
    {"symbol": "ITC", "name": "ITC Limited", "exchanges": ["NSE", "BSE"], "sector": "FMCG"},
    {"symbol": "HINDUNILVR", "name": "Hindustan Unilever Limited", "exchanges": ["NSE", "BSE"], "sector": "FMCG"},
    {"symbol": "LT", "name": "Larsen & Toubro Limited", "exchanges": ["NSE", "BSE"], "sector": "Engineering & Construction"},
    {"symbol": "LTIM", "name": "LTIMindtree Limited", "exchanges": ["NSE", "BSE"], "sector": "Information Technology", "bse_code": "540005"},
    {"symbol": "LTTS", "name": "L&T Technology Services Limited", "exchanges": ["NSE", "BSE"], "sector": "Information Technology"},
    {"symbol": "LTF", "name": "L&T Finance Limited", "exchanges": ["NSE", "BSE"], "sector": "Financial Services"},
    {"symbol": "BAJFINANCE", "name": "Bajaj Finance Limited", "exchanges": ["NSE", "BSE"], "sector": "Financial Services"},
    {"symbol": "HCLTECH", "name": "HCL Technologies Limited", "exchanges": ["NSE", "BSE"], "sector": "Information Technology"},
    {"symbol": "MARUTI", "name": "Maruti Suzuki India Limited", "exchanges": ["NSE", "BSE"], "sector": "Automobile"},
    {"symbol": "SUNPHARMA", "name": "Sun Pharmaceutical Industries Limited", "exchanges": ["NSE", "BSE"], "sector": "Pharmaceuticals"},
    {"symbol": "ONGC", "name": "Oil & Natural Gas Corporation Limited", "exchanges": ["NSE", "BSE"], "sector": "Oil & Gas"},
    {"symbol": "TMCV", "name": "Tata Motors Limited", "exchanges": ["NSE", "BSE"], "sector": "Automobile"},
    {"symbol": "NTPC", "name": "NTPC Limited", "exchanges": ["NSE", "BSE"], "sector": "Power & Energy"},
    {"symbol": "KOTAKBANK", "name": "Kotak Mahindra Bank Limited", "exchanges": ["NSE", "BSE"], "sector": "Banking & Financial Services"},
    {"symbol": "TITAN", "name": "Titan Company Limited", "exchanges": ["NSE", "BSE"], "sector": "Consumer Discretionary"},
    {"symbol": "AXISBANK", "name": "Axis Bank Limited", "exchanges": ["NSE", "BSE"], "sector": "Banking & Financial Services"},
    {"symbol": "ADANIENT", "name": "Adani Enterprises Limited", "exchanges": ["NSE", "BSE"], "sector": "Metals & Mining"},
    {"symbol": "ADANIPORTS", "name": "Adani Ports and Special Economic Zone Limited", "exchanges": ["NSE", "BSE"], "sector": "Infrastructure"},
    {"symbol": "COALINDIA", "name": "Coal India Limited", "exchanges": ["NSE", "BSE"], "sector": "Mining & Minerals"},
    {"symbol": "POWERGRID", "name": "Power Grid Corporation of India Limited", "exchanges": ["NSE", "BSE"], "sector": "Power & Energy"},
    {"symbol": "M&M", "name": "Mahindra & Mahindra Limited", "exchanges": ["NSE", "BSE"], "sector": "Automobile"},
    {"symbol": "ASIANPAINT", "name": "Asian Paints Limited", "exchanges": ["NSE", "BSE"], "sector": "Consumer Goods & Paints"},
    {"symbol": "BAJAJFINSV", "name": "Bajaj Finserv Limited", "exchanges": ["NSE", "BSE"], "sector": "Financial Services"},
    {"symbol": "ULTRACEMCO", "name": "UltraTech Cement Limited", "exchanges": ["NSE", "BSE"], "sector": "Cement & Building Materials"},
    {"symbol": "NESTLEIND", "name": "Nestle India Limited", "exchanges": ["NSE", "BSE"], "sector": "FMCG & Food"},
    {"symbol": "WIPRO", "name": "Wipro Limited", "exchanges": ["NSE", "BSE"], "sector": "Information Technology"},
    {"symbol": "JSWSTEEL", "name": "JSW Steel Limited", "exchanges": ["NSE", "BSE"], "sector": "Metals & Steel"},
    {"symbol": "TATASTEEL", "name": "Tata Steel Limited", "exchanges": ["NSE", "BSE"], "sector": "Metals & Steel"},
    {"symbol": "GRASIM", "name": "Grasim Industries Limited", "exchanges": ["NSE", "BSE"], "sector": "Chemicals & Materials"},
    {"symbol": "TECHM", "name": "Tech Mahindra Limited", "exchanges": ["NSE", "BSE"], "sector": "Information Technology"},
    {"symbol": "HINDALCO", "name": "Hindalco Industries Limited", "exchanges": ["NSE", "BSE"], "sector": "Metals & Aluminium"},
    {"symbol": "INDUSINDBK", "name": "IndusInd Bank Limited", "exchanges": ["NSE", "BSE"], "sector": "Banking"},
    {"symbol": "BRITANNIA", "name": "Britannia Industries Limited", "exchanges": ["NSE", "BSE"], "sector": "FMCG"},
    {"symbol": "CIPLA", "name": "Cipla Limited", "exchanges": ["NSE", "BSE"], "sector": "Pharmaceuticals"},
    {"symbol": "DIVISLAB", "name": "Divi's Laboratories Limited", "exchanges": ["NSE", "BSE"], "sector": "Pharmaceuticals"},
    {"symbol": "DRREDDY", "name": "Dr. Reddy's Laboratories Limited", "exchanges": ["NSE", "BSE"], "sector": "Pharmaceuticals"},
    {"symbol": "EICHERMOT", "name": "Eicher Motors Limited", "exchanges": ["NSE", "BSE"], "sector": "Automobile"},
    {"symbol": "APOLLOHOSP", "name": "Apollo Hospitals Enterprise Limited", "exchanges": ["NSE", "BSE"], "sector": "Healthcare"},
    {"symbol": "HEROMOTOCO", "name": "Hero MotoCorp Limited", "exchanges": ["NSE", "BSE"], "sector": "Automobile"},
    {"symbol": "BAJAJ-AUTO", "name": "Bajaj Auto Limited", "exchanges": ["NSE", "BSE"], "sector": "Automobile"},
    {"symbol": "TATACONSUM", "name": "Tata Consumer Products Limited", "exchanges": ["NSE", "BSE"], "sector": "FMCG"},
    {"symbol": "BPCL", "name": "Bharat Petroleum Corporation Limited", "exchanges": ["NSE", "BSE"], "sector": "Oil & Gas"},
    {"symbol": "SHREECEM", "name": "Shree Cement Limited", "exchanges": ["NSE", "BSE"], "sector": "Cement"},
    {"symbol": "SBILIFE", "name": "SBI Life Insurance Company Limited", "exchanges": ["NSE", "BSE"], "sector": "Insurance"},
    {"symbol": "HDFCLIFE", "name": "HDFC Life Insurance Company Limited", "exchanges": ["NSE", "BSE"], "sector": "Insurance"},

    {"symbol": "VBL", "name": "Varun Beverages Limited", "exchanges": ["NSE", "BSE"], "sector": "Beverages & FMCG"},
    {"symbol": "VISL", "name": "Vedanta Iron and Steel Limited", "exchanges": ["NSE", "BSE"], "sector": "Metals & Steel"},
    {"symbol": "TRENT", "name": "Trent Limited", "exchanges": ["NSE", "BSE"], "sector": "Retail & Fashion"},
    {"symbol": "BEL", "name": "Bharat Electronics Limited", "exchanges": ["NSE", "BSE"], "sector": "Defense & Aerospace"},
    {"symbol": "HAL", "name": "Hindustan Aeronautics Limited", "exchanges": ["NSE", "BSE"], "sector": "Defense & Aerospace"},
    {"symbol": "ZOMATO", "name": "Zomato Limited", "exchanges": ["NSE", "BSE"], "sector": "Consumer Tech & Food Delivery"},
    {"symbol": "JIOFIN", "name": "Jio Financial Services Limited", "exchanges": ["NSE", "BSE"], "sector": "Financial Services"},
    {"symbol": "DMART", "name": "Avenue Supermarts Limited (DMart)", "exchanges": ["NSE", "BSE"], "sector": "Retail"},
    {"symbol": "VEDL", "name": "Vedanta Limited", "exchanges": ["NSE", "BSE"], "sector": "Metals & Mining"},
    {"symbol": "CHOLAFIN", "name": "Cholamandalam Investment and Finance Company Limited", "exchanges": ["NSE", "BSE"], "sector": "NBFC"},
    {"symbol": "DLF", "name": "DLF Limited", "exchanges": ["NSE", "BSE"], "sector": "Real Estate"},
    {"symbol": "PAYTM", "name": "One97 Communications Limited (Paytm)", "exchanges": ["NSE", "BSE"], "sector": "Fintech"},
    {"symbol": "IRCTC", "name": "Indian Railway Catering and Tourism Corporation Limited", "exchanges": ["NSE", "BSE"], "sector": "Railways & Tourism"},
    {"symbol": "BHEL", "name": "Bharat Heavy Electricals Limited", "exchanges": ["NSE", "BSE"], "sector": "Capital Goods"},
    {"symbol": "SAIL", "name": "Steel Authority of India Limited", "exchanges": ["NSE", "BSE"], "sector": "Steel"},
    {"symbol": "IOC", "name": "Indian Oil Corporation Limited", "exchanges": ["NSE", "BSE"], "sector": "Oil & Gas"},
    {"symbol": "GAIL", "name": "GAIL (India) Limited", "exchanges": ["NSE", "BSE"], "sector": "Natural Gas"},
    {"symbol": "PFC", "name": "Power Finance Corporation Limited", "exchanges": ["NSE", "BSE"], "sector": "Financial Services"},
    {"symbol": "RECLTD", "name": "REC Limited", "exchanges": ["NSE", "BSE"], "sector": "Financial Services"},
    {"symbol": "MUTHOOTFIN", "name": "Muthoot Finance Limited", "exchanges": ["NSE", "BSE"], "sector": "NBFC & Gold Loans"},
    {"symbol": "TVSMOTOR", "name": "TVS Motor Company Limited", "exchanges": ["NSE", "BSE"], "sector": "Automobile"},
    {"symbol": "POLYCAB", "name": "Polycab India Limited", "exchanges": ["NSE", "BSE"], "sector": "Electrical Cables & Wires"},
    {"symbol": "PERSISTENT", "name": "Persistent Systems Limited", "exchanges": ["NSE", "BSE"], "sector": "Information Technology"},
    {"symbol": "MPHASIS", "name": "Mphasis Limited", "exchanges": ["NSE", "BSE"], "sector": "Information Technology"},
    {"symbol": "COFORGE", "name": "Coforge Limited", "exchanges": ["NSE", "BSE"], "sector": "Information Technology"},
    {"symbol": "ABB", "name": "ABB India Limited", "exchanges": ["NSE", "BSE"], "sector": "Capital Goods & Automation"},
    {"symbol": "SIEMENS", "name": "Siemens Limited", "exchanges": ["NSE", "BSE"], "sector": "Industrial Manufacturing"},
    {"symbol": "CUMMINSIND", "name": "Cummins India Limited", "exchanges": ["NSE", "BSE"], "sector": "Engines & Power"},
    {"symbol": "SUZLON", "name": "Suzlon Energy Limited", "exchanges": ["NSE", "BSE"], "sector": "Renewable Energy"},
    {"symbol": "YESBANK", "name": "Yes Bank Limited", "exchanges": ["NSE", "BSE"], "sector": "Banking"},
    {"symbol": "IDFCFIRSTB", "name": "IDFC First Bank Limited", "exchanges": ["NSE", "BSE"], "sector": "Banking"},
    {"symbol": "FEDERALBNK", "name": "The Federal Bank Limited", "exchanges": ["NSE", "BSE"], "sector": "Banking"},
    {"symbol": "PNB", "name": "Punjab National Bank", "exchanges": ["NSE", "BSE"], "sector": "Banking"},
    {"symbol": "BANKBARODA", "name": "Bank of Baroda", "exchanges": ["NSE", "BSE"], "sector": "Banking"},
    {"symbol": "CANBK", "name": "Canara Bank", "exchanges": ["NSE", "BSE"], "sector": "Banking"},
    {"symbol": "UNIONBANK", "name": "Union Bank of India", "exchanges": ["NSE", "BSE"], "sector": "Banking"},
    {"symbol": "IOB", "name": "Indian Overseas Bank", "exchanges": ["NSE", "BSE"], "sector": "Banking"},
    {"symbol": "INDIANB", "name": "Indian Bank", "exchanges": ["NSE", "BSE"], "sector": "Banking"},
    {"symbol": "RVNL", "name": "Rail Vikas Nigam Limited", "exchanges": ["NSE", "BSE"], "sector": "Railways Infrastructure"},
    {"symbol": "IRFC", "name": "Indian Railway Finance Corporation Limited", "exchanges": ["NSE", "BSE"], "sector": "Railway Finance"},
    {"symbol": "NHPC", "name": "NHPC Limited", "exchanges": ["NSE", "BSE"], "sector": "Hydroelectric Power"},
    {"symbol": "SJVN", "name": "SJVN Limited", "exchanges": ["NSE", "BSE"], "sector": "Power Generation"},
    {"symbol": "MAZDOCK", "name": "Mazagon Dock Shipbuilders Limited", "exchanges": ["NSE", "BSE"], "sector": "Defense Shipbuilding"},
    {"symbol": "COCHINSHIP", "name": "Cochin Shipyard Limited", "exchanges": ["NSE", "BSE"], "sector": "Shipbuilding"},
    {"symbol": "GRSE", "name": "Garden Reach Shipbuilders & Engineers Limited", "exchanges": ["NSE", "BSE"], "sector": "Shipbuilding"},
    {"symbol": "BDL", "name": "Bharat Dynamics Limited", "exchanges": ["NSE", "BSE"], "sector": "Defense Missiles"},
    {"symbol": "BEML", "name": "BEML Limited", "exchanges": ["NSE", "BSE"], "sector": "Heavy Engineering"},
    {"symbol": "BOSCHLTD", "name": "Bosch Limited", "exchanges": ["NSE", "BSE"], "sector": "Auto Components"},
    {"symbol": "COLPAL", "name": "Colgate-Palmolive (India) Limited", "exchanges": ["NSE", "BSE"], "sector": "Personal Care"},
    {"symbol": "MARICO", "name": "Marico Limited", "exchanges": ["NSE", "BSE"], "sector": "FMCG"},
    {"symbol": "BERGEPAINT", "name": "Berger Paints India Limited", "exchanges": ["NSE", "BSE"], "sector": "Paints"},
    {"symbol": "PIDILITIND", "name": "Pidilite Industries Limited", "exchanges": ["NSE", "BSE"], "sector": "Specialty Chemicals"},
    {"symbol": "HAVELLS", "name": "Havells India Limited", "exchanges": ["NSE", "BSE"], "sector": "Electricals"},
    {"symbol": "DABUR", "name": "Dabur India Limited", "exchanges": ["NSE", "BSE"], "sector": "FMCG & Ayurveda"},
    {"symbol": "GODREJCP", "name": "Godrej Consumer Products Limited", "exchanges": ["NSE", "BSE"], "sector": "FMCG"},
    {"symbol": "MOTHERSON", "name": "Samvardhana Motherson International Limited", "exchanges": ["NSE", "BSE"], "sector": "Auto Components"},
    {"symbol": "BALKRISIND", "name": "Balkrishna Industries Limited", "exchanges": ["NSE", "BSE"], "sector": "Tyres"},
    {"symbol": "MRF", "name": "MRF Limited", "exchanges": ["NSE", "BSE"], "sector": "Tyres"},
    {"symbol": "APOLLOTYRE", "name": "Apollo Tyres Limited", "exchanges": ["NSE", "BSE"], "sector": "Tyres"},
    {"symbol": "CEATLTD", "name": "CEAT Limited", "exchanges": ["NSE", "BSE"], "sector": "Tyres"},
    {"symbol": "EXIDEIND", "name": "Exide Industries Limited", "exchanges": ["NSE", "BSE"], "sector": "Batteries"},
    {"symbol": "AMARAJABAT", "name": "Amara Raja Energy & Mobility Limited", "exchanges": ["NSE", "BSE"], "sector": "Batteries"},
    {"symbol": "ASTRAL", "name": "Astral Limited", "exchanges": ["NSE", "BSE"], "sector": "Pipes & Plastics"},
    {"symbol": "SUPREMEIND", "name": "Supreme Industries Limited", "exchanges": ["NSE", "BSE"], "sector": "Plastics"},
    {"symbol": "PIIND", "name": "PI Industries Limited", "exchanges": ["NSE", "BSE"], "sector": "Agro Chemicals"},
    {"symbol": "DEEPAKNTR", "name": "Deepak Nitrite Limited", "exchanges": ["NSE", "BSE"], "sector": "Chemicals"},
    {"symbol": "SRF", "name": "SRF Limited", "exchanges": ["NSE", "BSE"], "sector": "Chemicals & Packaging"},
    {"symbol": "NAVINFLUOR", "name": "Navin Fluorine International Limited", "exchanges": ["NSE", "BSE"], "sector": "Fluorochemicals"},
    {"symbol": "ATUL", "name": "Atul Limited", "exchanges": ["NSE", "BSE"], "sector": "Chemicals"},
    {"symbol": "AARTIIND", "name": "Aarti Industries Limited", "exchanges": ["NSE", "BSE"], "sector": "Chemicals"},
    {"symbol": "TATACHEM", "name": "Tata Chemicals Limited", "exchanges": ["NSE", "BSE"], "sector": "Chemicals"},
    {"symbol": "COROMANDEL", "name": "Coromandel International Limited", "exchanges": ["NSE", "BSE"], "sector": "Fertilizers"},
    {"symbol": "UPL", "name": "UPL Limited", "exchanges": ["NSE", "BSE"], "sector": "Agrochemicals"},
    {"symbol": "PAGEIND", "name": "Page Industries Limited (Jockey)", "exchanges": ["NSE", "BSE"], "sector": "Apparel"},
    {"symbol": "TRIDENT", "name": "Trident Limited", "exchanges": ["NSE", "BSE"], "sector": "Textiles & Paper"},
    {"symbol": "RAYMOND", "name": "Raymond Limited", "exchanges": ["NSE", "BSE"], "sector": "Textiles & Real Estate"},
    {"symbol": "DIXON", "name": "Dixon Technologies (India) Limited", "exchanges": ["NSE", "BSE"], "sector": "Electronics Manufacturing"},
    {"symbol": "VOLTAS", "name": "Voltas Limited", "exchanges": ["NSE", "BSE"], "sector": "Consumer Electronics & ACs"},
    {"symbol": "BLUESTARCO", "name": "Blue Star Limited", "exchanges": ["NSE", "BSE"], "sector": "Air Conditioning"},
    {"symbol": "CROMPTON", "name": "Crompton Greaves Consumer Electricals Limited", "exchanges": ["NSE", "BSE"], "sector": "Consumer Electricals"},
    {"symbol": "BATAINDIA", "name": "Bata India Limited", "exchanges": ["NSE", "BSE"], "sector": "Footwear"},
    {"symbol": "RELAXO", "name": "Relaxo Footwears Limited", "exchanges": ["NSE", "BSE"], "sector": "Footwear"},
    {"symbol": "METROBRAND", "name": "Metro Brands Limited", "exchanges": ["NSE", "BSE"], "sector": "Footwear"},
    {"symbol": "JUBLFOOD", "name": "Jubilant FoodWorks Limited (Domino's)", "exchanges": ["NSE", "BSE"], "sector": "Quick Service Restaurants"},
    {"symbol": "DEVYANI", "name": "Devyani International Limited (KFC/Pizza Hut)", "exchanges": ["NSE", "BSE"], "sector": "QSR"},
    {"symbol": "INDIGO", "name": "InterGlobe Aviation Limited (IndiGo)", "exchanges": ["NSE", "BSE"], "sector": "Aviation"},
    {"symbol": "GMRINFRA", "name": "GMR Airports Infrastructure Limited", "exchanges": ["NSE", "BSE"], "sector": "Airports & Infra"},
    {"symbol": "ADANIPOWER", "name": "Adani Power Limited", "exchanges": ["NSE", "BSE"], "sector": "Power Generation"},
    {"symbol": "ADANIGREEN", "name": "Adani Green Energy Limited", "exchanges": ["NSE", "BSE"], "sector": "Renewable Power"},
    {"symbol": "ATGL", "name": "Adani Total Gas Limited", "exchanges": ["NSE", "BSE"], "sector": "City Gas Distribution"},
    {"symbol": "AWL", "name": "Adani Wilmar Limited", "exchanges": ["NSE", "BSE"], "sector": "Edible Oils & Foods"},
    {"symbol": "ZEEL", "name": "Zee Entertainment Enterprises Limited", "exchanges": ["NSE", "BSE"], "sector": "Media & Entertainment"},
    {"symbol": "PVRINOX", "name": "PVR INOX Limited", "exchanges": ["NSE", "BSE"], "sector": "Movie Theatres & Media"},
    {"symbol": "SUNTV", "name": "Sun TV Network Limited", "exchanges": ["NSE", "BSE"], "sector": "Broadcasting"},
    {"symbol": "NAUKRI", "name": "Info Edge (India) Limited (Naukri/99acres)", "exchanges": ["NSE", "BSE"], "sector": "Internet & Recruitment"},
    {"symbol": "POLICYBZR", "name": "PB Fintech Limited (Policybazaar)", "exchanges": ["NSE", "BSE"], "sector": "Fintech & Insurance"},
    {"symbol": "NYKAA", "name": "FSN E-Commerce Ventures Limited (Nykaa)", "exchanges": ["NSE", "BSE"], "sector": "E-Commerce"},
    {"symbol": "DELHIVERY", "name": "Delhivery Limited", "exchanges": ["NSE", "BSE"], "sector": "Logistics"},
    {"symbol": "TATAELXSI", "name": "Tata Elxsi Limited", "exchanges": ["NSE", "BSE"], "sector": "Design & Technology Services"},
    {"symbol": "KPITTECH", "name": "KPIT Technologies Limited", "exchanges": ["NSE", "BSE"], "sector": "Automotive Software"},
    {"symbol": "SONACOMS", "name": "Sona BLW Precision Forgings Limited", "exchanges": ["NSE", "BSE"], "sector": "EV & Auto Drivetrain"},
    {"symbol": "UNOMINDA", "name": "Uno Minda Limited", "exchanges": ["NSE", "BSE"], "sector": "Auto Components"},
    {"symbol": "THERMAX", "name": "Thermax Limited", "exchanges": ["NSE", "BSE"], "sector": "Energy & Environment"},
    {"symbol": "KEC", "name": "KEC International Limited", "exchanges": ["NSE", "BSE"], "sector": "Power T&D & EPC"},
    {"symbol": "NBCC", "name": "NBCC (India) Limited", "exchanges": ["NSE", "BSE"], "sector": "Civil Construction"},
    {"symbol": "JKCEMENT", "name": "JK Cement Limited", "exchanges": ["NSE", "BSE"], "sector": "Cement"},
    {"symbol": "DALBHARAT", "name": "Dalmia Bharat Limited", "exchanges": ["NSE", "BSE"], "sector": "Cement"},

    {"symbol": "500325", "name": "Reliance Industries (BSE Code 500325)", "exchanges": ["BSE"], "sector": "Conglomerate"},
    {"symbol": "532540", "name": "Tata Consultancy Services (BSE Code 532540)", "exchanges": ["BSE"], "sector": "Information Technology"},
    {"symbol": "BSE", "name": "BSE Limited", "exchanges": ["NSE", "BSE"], "sector": "Financial Exchange"},
    {"symbol": "CDSL", "name": "Central Depository Services (India) Limited", "exchanges": ["NSE", "BSE"], "sector": "Financial Infrastructure"},
    {"symbol": "MCX", "name": "Multi Commodity Exchange of India Limited", "exchanges": ["NSE", "BSE"], "sector": "Financial Exchange"},
    {"symbol": "IEX", "name": "Indian Energy Exchange Limited", "exchanges": ["NSE", "BSE"], "sector": "Energy Exchange"},
    {"symbol": "KALYANKJIL", "name": "Kalyan Jewellers India Limited", "exchanges": ["NSE", "BSE"], "sector": "Jewellery & Retail"},
    {"symbol": "SENCO", "name": "Senco Gold Limited", "exchanges": ["NSE", "BSE"], "sector": "Jewellery"},
    {"symbol": "MOTILALOFS", "name": "Motilal Oswal Financial Services Limited", "exchanges": ["NSE", "BSE"], "sector": "Broking & Wealth"},
    {"symbol": "ANGELONE", "name": "Angel One Limited", "exchanges": ["NSE", "BSE"], "sector": "Broking & Fintech"},
    {"symbol": "500410", "name": "ACC Limited (BSE 500410)", "exchanges": ["BSE"], "sector": "Cement"},
    {"symbol": "ACC", "name": "ACC Limited", "exchanges": ["NSE", "BSE"], "sector": "Cement"},
    {"symbol": "AMBUJACEM", "name": "Ambuja Cements Limited", "exchanges": ["NSE", "BSE"], "sector": "Cement"},
]

class SymbolMaster:
    def __init__(self):
        self._symbols = {}
        self._all_items = []
        self._load_master_data()

    def _load_master_data(self):
        for item in DEFAULT_SYMBOL_MASTER:
            sym = item["symbol"].strip().upper()
            record = {
                "symbol": sym,
                "name": item["name"].strip(),
                "exchanges": item.get("exchanges", ["NSE", "BSE"]),
                "sector": item.get("sector", "Equities"),
                "bse_code": item.get("bse_code"),
                "is_nse": "NSE" in item.get("exchanges", []),
                "is_bse": "BSE" in item.get("exchanges", []),
            }
            self._symbols[sym] = record
            self._all_items.append(record)

        csv_path = os.path.join(os.path.dirname(__file__), "data", "EQUITY_L.csv")
        if os.path.exists(csv_path):
            try:
                with open(csv_path, mode="r", encoding="utf-8-sig") as f:
                    reader = csv.DictReader(f)
                    for row in reader:
                        sym = (row.get("SYMBOL") or row.get("symbol") or "").strip().upper()
                        name = (row.get("NAME OF COMPANY") or row.get("name") or sym).strip()
                        if sym and sym not in self._symbols:
                            rec = {
                                "symbol": sym,
                                "name": name,
                                "exchanges": ["NSE"],
                                "sector": row.get("SERIES", "EQ"),
                                "is_nse": True,
                                "is_bse": False,
                            }
                            self._symbols[sym] = rec
                            self._all_items.append(rec)
            except Exception as exc:
                logger.warning(f"Unable to read local CSV symbol master: {exc}")

        logger.info(f"SymbolMaster initialized with {len(self._symbols)} Indian equities.")

    def clean_symbol(self, raw_symbol: str) -> str:
        if not raw_symbol:
            return ""
        s = str(raw_symbol).strip().upper()
        if s.startswith("^"):
            return s
        for suffix in [".NS", ".BO", ".NSE", ".BSE", ".BOM", ".NSI"]:
            if s.endswith(suffix):
                s = s[:-len(suffix)]
                break
        return s.strip()

    ALIASES = {
        "LTM": "LTIM",
        "LTIMINDTREE": "LTIM",
        "MINDTREE": "LTIM",
        "LTI": "LTIM",
        "INFOSYS": "INFY",
        "RELIANCEIND": "RELIANCE",
        "TATAMOTOR": "TMCV",
        "TATAMOTORS": "TMCV",
        "BAJAJ": "BAJFINANCE",
        "MARUTISUZUKI": "MARUTI",
        "VEDANTA": "VEDL",
    }

    def lookup(self, raw_symbol: str):
        clean = self.clean_symbol(raw_symbol)
        if not clean:
            return None

        if clean in self.ALIASES:
            clean = self.ALIASES[clean]

        if clean in self._symbols:
            return self._symbols[clean]

        for sym, data in self._symbols.items():
            if sym.lower() == clean.lower():
                return data

        all_syms = list(self._symbols.keys())
        close_matches = difflib.get_close_matches(clean, all_syms, n=1, cutoff=0.85)
        if close_matches:
            return self._symbols[close_matches[0]]

        return None

    def search(self, query: str, limit: int = 8):
        q = (query or "").strip().upper()
        if not q:
            return []

        clean_q = self.clean_symbol(q)
        results = []

        exact_sym = []
        prefix_sym = []
        substring_sym = []
        name_matches = []

        for item in self._all_items:
            sym = item["symbol"]
            name = item["name"].upper()

            if sym == clean_q or sym == q:
                exact_sym.append(item)
            elif sym.startswith(clean_q) or sym.startswith(q):
                prefix_sym.append(item)
            elif clean_q in sym or q in sym:
                substring_sym.append(item)
            elif clean_q in name or q in name:
                name_matches.append(item)

        seen = set()
        for group in [exact_sym, prefix_sym, substring_sym, name_matches]:
            for r in group:
                if r["symbol"] not in seen:
                    seen.add(r["symbol"])
                    results.append({
                        "symbol": r["symbol"],
                        "name": r["name"],
                        "exchange": "NSE" if r["is_nse"] else "BSE",
                        "exchanges": r["exchanges"],
                        "sector": r["sector"],
                        "is_nse": r["is_nse"],
                        "is_bse": r["is_bse"],
                    })
                    if len(results) >= limit:
                        return results

        return results

symbol_master = SymbolMaster()
