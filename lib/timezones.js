// אזור זמן לכל שדה תעופה ברשימה, כדי להציג שעות מקומיות ושמיים לפי השעה ביעד
const Z = {
  'Asia/Jerusalem': 'TLV ETM', 'Europe/London': 'LHR LGW LTN STN MAN', 'Europe/Dublin': 'DUB',
  'Europe/Paris': 'CDG ORY NCE LYS MRS', 'Europe/Amsterdam': 'AMS', 'Europe/Brussels': 'BRU',
  'Europe/Berlin': 'FRA MUC BER DUS HAM CGN', 'Europe/Zurich': 'ZRH GVA', 'Europe/Vienna': 'VIE SZG',
  'Europe/Prague': 'PRG', 'Europe/Budapest': 'BUD', 'Europe/Warsaw': 'WAW KRK KTW', 'Europe/Copenhagen': 'CPH',
  'Europe/Stockholm': 'ARN', 'Europe/Rome': 'FCO MXP LIN VCE NAP CTA PMO VRN', 'Europe/Madrid': 'BCN MAD',
  'Europe/Lisbon': 'LIS OPO', 'Europe/Athens': 'ATH SKG HER RHO', 'Asia/Nicosia': 'LCA PFO', 'Europe/Istanbul': 'IST',
  'Europe/Sofia': 'SOF', 'Europe/Bucharest': 'OTP', 'Europe/Belgrade': 'BEG', 'Asia/Tbilisi': 'TBS BUS',
  'Europe/Ljubljana': 'LJU', 'Europe/Tirane': 'TIA', 'Asia/Amman': 'AMM', 'Africa/Cairo': 'CAI SSH',
  'Asia/Dubai': 'DXB AUH', 'Asia/Qatar': 'DOH', 'Asia/Bahrain': 'BAH', 'Asia/Kolkata': 'DEL BOM',
  'Asia/Bangkok': 'BKK HKT', 'Asia/Singapore': 'SIN', 'Asia/Hong_Kong': 'HKG', 'Asia/Shanghai': 'PEK',
  'Asia/Seoul': 'ICN', 'Asia/Tokyo': 'HND NRT', 'America/New_York': 'JFK EWR BOS IAD MIA', 'America/Chicago': 'ORD',
  'America/Los_Angeles': 'LAX SFO', 'America/Toronto': 'YYZ', 'America/Vancouver': 'YVR', 'Africa/Addis_Ababa': 'ADD',
  'Europe/Moscow': 'AER KRR MRV ZIA', 'Europe/Bratislava': 'BTS', 'Asia/Yerevan': 'EVN', 'Asia/Baku': 'GYD',
  'Asia/Ho_Chi_Minh': 'HAN', 'Europe/Minsk': 'MSQ', 'Europe/Chisinau': 'RMO', 'Indian/Mahe': 'SEZ',
  'Asia/Samarkand': 'SKD', 'Europe/Vilnius': 'VNO', 'Africa/Dar_es_Salaam': 'ZNZ'
};
export const TIMEZONES = Object.fromEntries(Object.entries(Z).flatMap(([tz, codes]) => codes.split(' ').map((c) => [c, tz])));
