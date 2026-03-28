import type { TelecomRecord } from "./model";

// Demo data uses dates relative to TODAY so the default "last10" filter always shows them
function daysAgo(n: number, hour = 8, minute = 0): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

const BASE = "+919876543210";

function rec(
  id: string,
  daysBack: number,
  hour: number,
  target: string,
  callType: "Voice" | "SMS" | "Data",
  duration: number,
  place: string,
  lat: number,
  lng: number,
  operator: string,
  network: string,
  band: string,
  fake: boolean,
  silent: "None" | "Ping" | "Spy",
  smsStatus?: "Delivered" | "Failed"
): TelecomRecord {
  const startISO = daysAgo(daysBack, hour);
  const start = new Date(startISO);
  const end = new Date(start.getTime() + duration * 1000);
  return {
    id,
    dateTime: startISO,
    imsi: `4041${id.padStart(11, "0")}`,
    imei: `35693${id.padStart(10, "0")}`,
    msisdn: BASE,
    target,
    callType,
    deviceModel: "Samsung Galaxy S23",
    operator,
    network,
    country: "India",
    place,
    band,
    ran: network === "5G" ? "NR" : "LTE",
    mode: "Active",
    latitude: lat,
    longitude: lng,
    startTime: startISO,
    endTime: end.toISOString(),
    duration,
    smsStatus,
    fake,
    silentCallType: silent,
    name: "Target Alpha",
    rxLevel: -75,
    arfcn: 632628,
    receiverLatitude: lat + 0.05,
    receiverLongitude: lng + 0.05,
    towers: [],
  };
}

export const DEMO_RECORDS: TelecomRecord[] = [
  // Day 0 (today)
  rec("030", 0, 8,  "+919812345678", "Voice", 330, "New Delhi",       28.6139, 77.2090, "Airtel", "5G",  "n78", false, "None"),
  rec("029", 0, 11, "+919432109876", "Voice", 600, "Dwarka Mor",      28.6000, 77.0600, "Airtel", "4G",  "n41", true,  "Spy"),
  // Day 1
  rec("027", 1, 8,  "+919654321098", "Voice", 330, "New Delhi",       28.6139, 77.2090, "Airtel", "5G",  "n78", false, "None"),
  rec("028", 1, 10, "+919543210987", "SMS",   2,   "Uttam Nagar",     28.6200, 77.0500, "BSNL",   "LTE", "83",  false, "None", "Delivered"),
  // Day 2
  rec("024", 2, 9,  "+919988776655", "Voice", 270, "New Delhi",       28.6139, 77.2090, "Airtel", "5G",  "n78", false, "None"),
  rec("025", 2, 11, "+919876543211", "SMS",   1,   "Shahdara",        28.6700, 77.2900, "Jio",    "4G",  "n41", true,  "None", "Failed"),
  rec("026", 2, 15, "+919765432109", "Voice", 450, "Laxmi Nagar",     28.6300, 77.2800, "Airtel", "5G",  "n78", false, "None"),
  // Day 3
  rec("021", 3, 7,  "+919812345678", "Voice", 390, "New Delhi",       28.6139, 77.2090, "Airtel", "5G",  "n78", false, "None"),
  rec("022", 3, 10, "+919210987654", "SMS",   2,   "Mayur Vihar",     28.6080, 77.2960, "VI",     "4G",  "87",  false, "None", "Delivered"),
  rec("023", 3, 14, "+919109876543", "Voice", 660, "Preet Vihar",     28.6400, 77.2900, "Airtel", "4G",  "n41", false, "Spy"),
  // Day 4
  rec("018", 4, 8,  "+919543210987", "Voice", 300, "New Delhi",       28.6139, 77.2090, "Airtel", "5G",  "n78", false, "None"),
  rec("019", 4, 12, "+919432109876", "Voice", 540, "Nehru Place",     28.5491, 77.2519, "Jio",    "4G",  "n41", true,  "Ping"),
  rec("020", 4, 16, "+919321098765", "SMS",   1,   "Greater Kailash", 28.5355, 77.2310, "Airtel", "5G",  "n78", false, "None", "Delivered"),
  // Day 5
  rec("014", 5, 9,  "+919988776655", "Voice", 480, "New Delhi",       28.6139, 77.2090, "Airtel", "5G",  "n78", false, "None"),
  rec("015", 5, 11, "+919876543211", "SMS",   1,   "Vasant Kunj",     28.5200, 77.1588, "Airtel", "LTE", "83",  true,  "None", "Failed"),
  rec("016", 5, 15, "+919765432109", "Voice", 720, "Janakpuri",       28.6219, 77.0878, "BSNL",   "LTE", "83",  false, "None"),
  rec("017", 5, 19, "+919654321098", "SMS",   2,   "Pitampura",       28.7000, 77.1300, "Airtel", "5G",  "n78", false, "Spy",  "Delivered"),
  // Day 6
  rec("011", 6, 8,  "+919812345678", "Voice", 360, "New Delhi",       28.6139, 77.2090, "Airtel", "5G",  "n78", false, "None"),
  rec("012", 6, 10, "+919109876543", "Voice", 150, "Karol Bagh",      28.6519, 77.1909, "Airtel", "4G",  "n41", false, "Ping"),
  rec("013", 6, 14, "+919098765432", "SMS",   2,   "Saket",           28.5244, 77.2066, "Jio",    "5G",  "n78", false, "None", "Delivered"),
  // Day 7
  rec("007", 7, 7,  "+919543210987", "Voice", 240, "New Delhi",       28.6139, 77.2090, "Airtel", "5G",  "n78", false, "None"),
  rec("008", 7, 9,  "+919432109876", "SMS",   2,   "Dwarka",          28.5921, 77.0460, "Airtel", "LTE", "83",  false, "None", "Delivered"),
  rec("009", 7, 13, "+919321098765", "Voice", 510, "Rohini",          28.7041, 77.1025, "Jio",    "4G",  "n41", true,  "Spy"),
  rec("010", 7, 18, "+919210987654", "SMS",   1,   "Lajpat Nagar",    28.5677, 77.2433, "Airtel", "5G",  "n78", false, "None", "Delivered"),
  // Day 8
  rec("004", 8, 9,  "+919812345678", "Voice", 420, "New Delhi",       28.6139, 77.2090, "Airtel", "4G",  "n41", false, "None"),
  rec("005", 8, 11, "+919765432109", "SMS",   1,   "Noida",           28.5355, 77.3910, "Jio",    "4G",  "n41", true,  "None", "Failed"),
  rec("006", 8, 16, "+919654321098", "Voice", 600, "Gurugram",        28.4595, 77.0266, "Airtel", "5G",  "n78", false, "Spy"),
  // Day 9
  rec("001", 9, 8,  "+919812345678", "Voice", 330, "New Delhi",       28.6139, 77.2090, "Airtel", "5G",  "n78", false, "None"),
  rec("002", 9, 10, "+919123456789", "SMS",   2,   "New Delhi",       28.6140, 77.2100, "Airtel", "5G",  "n78", false, "None", "Delivered"),
  rec("003", 9, 14, "+919988776655", "Voice", 180, "Connaught Place", 28.6315, 77.2167, "Airtel", "5G",  "n78", false, "Ping"),
];
