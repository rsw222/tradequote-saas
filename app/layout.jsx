import "./globals.css";

export const metadata = {
  title: "TradeQuote",
  description: "Automated quote generator for trades people with RAG-assisted pricing guidance.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "TradeQuote",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0f766e",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
