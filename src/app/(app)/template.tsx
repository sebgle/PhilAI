// Remounts on every navigation (unlike the layout), so each page's content
// rises in while the nav and the backdrop stay put.
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="page-in">{children}</div>;
}
