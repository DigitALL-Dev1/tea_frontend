import type { DemoUser, Supplier, User } from "@/types";

export const MOCK_USERS: User[] = [
  {
    id: "u-bernard",
    name: "Bernard George",
    title: "Chief Executive Officer",
    role: "CEO",
    initials: "BG",
    email: "bernard.george@green.com.pg",
    active: true,
  },
  {
    id: "u-kowsalya",
    name: "Kowsalya",
    title: "Solution Engineering Lead",
    role: "SOLUTION_LEAD",
    initials: "KO",
    email: "kowsalya@green.com.pg",
    active: true,
  },
  {
    id: "u-zain",
    name: "Zain",
    title: "Administrator",
    role: "ADMIN",
    initials: "ZA",
    email: "zain@green.com.pg",
    active: true,
  },
  {
    id: "u-michael",
    name: "Michael Tom",
    title: "Network Engineer",
    role: "STAFF",
    initials: "MT",
    email: "michael.tom@green.com.pg",
    active: true,
  },
  {
    id: "u-grace",
    name: "Grace Kaupa",
    title: "Bid Coordinator",
    role: "STAFF",
    initials: "GK",
    email: "grace.kaupa@green.com.pg",
    active: true,
  },
];

export const DEMO_USER_IDS = ["u-bernard", "u-kowsalya", "u-zain"] as const;

export const MOCK_DEMO_USERS: DemoUser[] = MOCK_USERS.filter((u): u is DemoUser =>
  (DEMO_USER_IDS as readonly string[]).includes(u.id),
);

export const MOCK_SUPPLIERS: Supplier[] = [
  {
    id: "s-kumul",
    name: "Kumul Solar Supplies",
    country: "Papua New Guinea",
    contactEmail: "sales@kumulsolar.example",
  },
  {
    id: "s-southern",
    name: "Southern Cross Energy",
    country: "Australia",
    contactEmail: "tenders@southerncross.example",
  },
  {
    id: "s-coral",
    name: "Coral Sea Networks",
    country: "Papua New Guinea",
    contactEmail: "quotes@coralsea.example",
  },
  {
    id: "s-melanesia",
    name: "Melanesia ICT Distribution",
    country: "Fiji",
    contactEmail: "rfq@melanesiaict.example",
  },
  {
    id: "s-honiara",
    name: "Honiara Tech Traders",
    country: "Solomon Islands",
    contactEmail: "office@honiaratech.example",
  },
  {
    id: "s-zambezi",
    name: "Zambezi Solar Works",
    country: "Zimbabwe",
    contactEmail: "bids@zambezisolar.example",
  },
];
