import "./globals.css";

export const metadata = {
  title: "Dune Falcon Dubai | Desert Safari Booking",
  description: "Book your Dubai desert safari with Dune Falcon: dune bashing, camel ride, belly dance, fire show and BBQ dinner with hotel pickup. Pay at pickup.",
  openGraph: {
    title: "Dune Falcon Dubai | Desert Safari Booking",
    description: "Evening, private, morning and overnight desert safaris with hotel pickup.",
    type: "website",
  },
};

export const viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#f3eee7" };

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Marcellus&family=Figtree:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap" />
      </head>
      <body>{children}</body>
    </html>
  );
}
