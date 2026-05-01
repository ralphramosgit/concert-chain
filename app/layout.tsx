import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Navbar } from "./_components/Navbar";
import { StoreProvider } from "./_components/StoreProvider";
import { SessionProvider } from "./_components/SessionProvider";
import { Web3Provider } from "./_components/Web3Provider";
import { getSession } from "@/lib/session";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Concert Chain",
  description: "Buy and resell concert tickets on-chain.",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await getSession();
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Web3Provider>
          <SessionProvider session={session}>
            <StoreProvider>
              <Navbar session={session} />
              <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {children}
              </main>
            </StoreProvider>
          </SessionProvider>
        </Web3Provider>
      </body>
    </html>
  );
}
