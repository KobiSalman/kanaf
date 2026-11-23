// שמות דגמים, חברות תעופה וכיוונים – משותף לשרת ולדפדפן.

export const AIRCRAFT = {
  B789: 'Boeing 787-9 Dreamliner', B788: 'Boeing 787-8 Dreamliner', B78X: 'Boeing 787-10 Dreamliner',
  B738: 'Boeing 737-800', B739: 'Boeing 737-900', B737: 'Boeing 737-700', B38M: 'Boeing 737 MAX 8', B39M: 'Boeing 737 MAX 9',
  B77W: 'Boeing 777-300ER', B772: 'Boeing 777-200', B77L: 'Boeing 777-200LR', B763: 'Boeing 767-300', B752: 'Boeing 757-200',
  B744: 'Boeing 747-400', B748: 'Boeing 747-8', A320: 'Airbus A320', A20N: 'Airbus A320neo', A321: 'Airbus A321',
  A21N: 'Airbus A321neo', A319: 'Airbus A319', A318: 'Airbus A318', A333: 'Airbus A330-300', A332: 'Airbus A330-200',
  A339: 'Airbus A330-900neo', A359: 'Airbus A350-900', A35K: 'Airbus A350-1000', A388: 'Airbus A380', BCS3: 'Airbus A220-300',
  BCS1: 'Airbus A220-100', E190: 'Embraer E190', E195: 'Embraer E195', E290: 'Embraer E190-E2', E295: 'Embraer E195-E2',
  E75L: 'Embraer E175', CRJ2: 'Bombardier CRJ200', CRJ9: 'Bombardier CRJ900', AT76: 'ATR 72-600', AT72: 'ATR 72',
  DH8D: 'Dash 8-400', K35R: 'KC-135 (מטוס תדלוק)', C130: 'C-130 הרקולס', C30J: 'C-130J הרקולס', F16: 'F-16',
  B350: 'Beechcraft King Air', C172: 'Cessna 172', PC12: 'Pilatus PC-12', GLF6: 'Gulfstream G650', GLEX: 'Bombardier Global'
};

export const AIRLINES = {
  ELY: 'אל על', ISR: 'ישראייר', AIZ: 'ארקיע', WZZ: 'וויז אייר', WUK: 'וויז אייר', WMT: 'וויז אייר', RYR: 'ריינאייר',
  EZY: 'איזיג׳ט', EJU: 'איזיג׳ט', EZS: 'איזיג׳ט', UAE: 'אמירייטס', FDB: 'פליי דובאי', ETD: 'איתיחאד', DLH: 'לופטהנזה',
  BAW: 'בריטיש איירווייז', AFR: 'אייר פראנס', KLM: 'KLM', THY: 'טורקיש איירליינס', PGT: 'פגסוס', AEE: 'אגאן',
  SWR: 'סוויס', AUA: 'אוסטריאן', ITY: 'ITA', LOT: 'LOT', TAP: 'TAP', IBE: 'איבריה', VLG: 'וואלינג', UAL: 'יונייטד',
  DAL: 'דלתא', AAL: 'אמריקן', ACA: 'אייר קנדה', CYP: 'קפריסין איירווייז', RJA: 'רויאל ג׳ורדניאן', MSR: 'איג׳יפט אייר',
  TVS: 'סמארטווינגס', TOM: 'TUI', BBG: 'בלו בירד', HFY: 'הי פליי', ETH: 'אתיופיאן', AIC: 'אייר אינדיה', SVA: 'סעודיה',
  GFA: 'גאלף אייר', QTR: 'קטאר', MGX: 'מונטנגרו', TRA: 'טרנסוויה', SXS: 'סאן אקספרס', AZW: 'אייר זימבבואה',
  ROT: 'טארום', SAS: 'SAS', FIN: 'פינאייר', NOZ: 'נורוויג׳ן'
};

const COMPASS = ['צפון', 'צפון-מזרח', 'מזרח', 'דרום-מזרח', 'דרום', 'דרום-מערב', 'מערב', 'צפון-מערב'];
export const compass = (deg) => COMPASS[Math.round((((deg % 360) + 360) % 360) / 45) % 8];

export const airlineOf = (callsign) => {
  if (!callsign) return null;
  const m = callsign.match(/^([A-Z]{3})\d/);
  return m ? AIRLINES[m[1]] || null : null;
};

const R = 6371, rad = Math.PI / 180;
export function distanceKm(lat1, lon1, lat2, lon2) {
  const a = Math.sin(((lat2 - lat1) * rad) / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(((lon2 - lon1) * rad) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
export function bearingDeg(lat1, lon1, lat2, lon2) {
  const y = Math.sin((lon2 - lon1) * rad) * Math.cos(lat2 * rad);
  const x = Math.cos(lat1 * rad) * Math.sin(lat2 * rad) - Math.sin(lat1 * rad) * Math.cos(lat2 * rad) * Math.cos((lon2 - lon1) * rad);
  return (Math.atan2(y, x) / rad + 360) % 360;
}
