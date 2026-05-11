import { Outlet } from "react-router-dom";
import BottomNav from "./BottomNav";
import OfflineBanner from "./OfflineBanner";

const AppLayout = () => {
  return (
    <div className="min-h-screen bg-background no-overscroll">
      <OfflineBanner />
      <main className="mx-auto max-w-lg pb-24">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
};

export default AppLayout;
