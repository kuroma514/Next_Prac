import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import "./globals.css";

const outfit = Outfit({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "Draw-Relay | お絵描きリレーゲーム",
  description:
    "みんなで一つの絵を完成させよう！2〜8人で遊べるリアルタイムお絵描きリレーゲーム",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className={`${outfit.variable} antialiased`}>
        {/* Background decoration blobs */}
        <div
          className="bg-blob"
          style={{
            width: 400,
            height: 400,
            background: "#7c3aed",
            top: "-5%",
            left: "-5%",
          }}
        />
        <div
          className="bg-blob"
          style={{
            width: 350,
            height: 350,
            background: "#ec4899",
            bottom: "10%",
            right: "-5%",
          }}
        />
        <div
          className="bg-blob"
          style={{
            width: 300,
            height: 300,
            background: "#06b6d4",
            top: "40%",
            left: "60%",
          }}
        />

        <main className="relative z-10 min-h-screen">{children}</main>
      </body>
    </html>
  );
}
