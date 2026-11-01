import "./globals.css";
import Navbar from "@/components/Navbar";

export const metadata = {
  title: "User Analytics Platform",
  description:
    "Serverless real-time user telemetry and click heatmap dashboard",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
        <Navbar />
        <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-8">
          {children}
        </main>
      </body>
    </html>
  );
}

