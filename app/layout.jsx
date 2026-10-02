import "./styles.css";

export const metadata = {
  title: "MFH Hair — Made for your moment",
  description: "Shop ponytails, wigs and extensions from MFH Hair.",
};

export default function RootLayout({ children }) {
  return <html lang="en"><body>{children}</body></html>;
}
