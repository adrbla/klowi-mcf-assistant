import Chat from "./Chat";

export default function Home() {
  // `key="new"` forces a fresh mount when navigating from /conv/[id] back
  // to /, so state never bleeds across routes.
  return <Chat key="new" />;
}
