// Starting data. Used only until the matching rows exist in Supabase
// (supabase/schema.sql seeds the same values).
export const DEFAULT_PACKAGES = [
  { id: "evening-shared", name: "Evening Desert Safari", type: "Shared", price: 150, childPrice: 120, unit: "person", maxGuests: 6, duration: "6 hours", window: "15:00 – 21:30", slots: ["evening"], popular: true, active: true, order: 1,
    inclusions: ["Hotel pickup & drop-off in a shared 4×4", "30–40 min dune bashing", "Sunset photo stop", "Camel ride & sandboarding", "Henna, Arabic coffee & dates", "Tanoura, belly dance & fire show", "BBQ buffet dinner, soft drinks & water"] },
  { id: "evening-private", name: "Private Land Cruiser Safari", type: "Private", price: 900, childPrice: 0, unit: "vehicle", maxGuests: 6, duration: "6 hours", window: "Your pickup time", slots: ["evening"], popular: false, active: true, order: 2,
    inclusions: ["Whole Land Cruiser for your group (up to 6)", "Driver waits on your timing", "Everything in the Evening Safari", "VIP majlis seating at camp", "Priority BBQ service"] },
  { id: "morning", name: "Morning Dune Bashing", type: "Shared", price: 120, childPrice: 100, unit: "person", maxGuests: 6, duration: "4 hours", window: "08:00 – 12:00", slots: ["morning"], popular: false, active: true, order: 3,
    inclusions: ["Hotel pickup & drop-off", "45 min dune bashing", "Camel ride & sandboarding", "Bottled water & refreshments"] },
  { id: "overnight", name: "Overnight Desert Camp", type: "Shared", price: 350, childPrice: 280, unit: "person", maxGuests: 6, duration: "18 hours", window: "15:00 – 09:00", slots: ["evening"], popular: false, active: true, order: 4,
    inclusions: ["Everything in the Evening Safari", "Sleep in a Bedouin tent", "Breakfast at sunrise", "Morning drop-off at your hotel"] },
];

export const DEFAULT_SCHEDULE = {
  openDays: [0, 1, 2, 3, 4, 5, 6],
  cutoffHours: 4,
  blocked: [],
  slots: [
    { id: "morning", label: "Morning", time: "08:00", capacity: 24 },
    { id: "evening", label: "Evening", time: "15:00", capacity: 60 },
  ],
};

export const DEFAULT_BUSINESS = {
  whatsapp: "+971502341729",
  email: "dunefalcondubai@gmail.com",
  licence: "",
  currency: "AED",
  addons: [
    { id: "quad", name: "Quad bike, 30 min", price: 150, unit: "person" },
    { id: "buggy", name: "Dune buggy, 30 min (2-seat)", price: 450, unit: "booking" },
    { id: "vip", name: "VIP majlis seating", price: 50, unit: "person" },
    { id: "falcon", name: "Falcon photo", price: 40, unit: "person" },
    { id: "cake", name: "Birthday cake at camp", price: 120, unit: "booking" },
  ],
};
