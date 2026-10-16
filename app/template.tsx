// A template re-mounts on every navigation, so each page eases in.
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="lk-page">{children}</div>;
}
