import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Warung Sembako by RAS POS",
  description: "Point of Sale System for Retail Shops",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
